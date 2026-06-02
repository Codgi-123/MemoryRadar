from datetime import date
from pathlib import Path

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.bootstrap import seed_defaults
from app.db import get_db, init_db
from app.models import Event, JobRun, Project, Report, SearchQuery
from app.processors.github_radar import build_project_radar
from app.schemas import (
    EventOut,
    EventPatch,
    JobRunOut,
    ProjectIn,
    ProjectOut,
    ProjectRadarOut,
    ReportOut,
    WatchlistImport,
    WatchlistImportResult,
)
from app.services import build_report_context, generate_daily_report, run_collection_job, start_collection_job
from app.settings import settings
from app.worker import daily_run

app = FastAPI(title="Memory Market Watcher")

cors_origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()
    db = next(get_db())
    try:
        seed_defaults(db)
    finally:
        db.close()


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/settings/status")
def settings_status() -> dict:
    return {
        "serper_search": bool(settings.serper_api_key),
        "serper_base_url": settings.serper_base_url,
        "github": bool(settings.github_token),
        "openai": bool(settings.openai_api_key),
        "openai_base_url": settings.openai_base_url,
        "anthropic": bool(settings.anthropic_api_key),
        "anthropic_base_url": settings.anthropic_base_url,
        "llm_provider": settings.llm_provider,
        "daily_run_time": f"{settings.daily_run_cron_hour:02d}:{settings.daily_run_cron_minute:02d}",
        "timezone": settings.app_timezone,
    }


@app.get("/api/system/status")
def system_status(db: Session = Depends(get_db)) -> dict:
    return build_report_context(db)


@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db)) -> dict:
    latest_report = db.query(Report).order_by(Report.report_date.desc()).first()
    return {
        "projects": db.query(Project).count(),
        "events_today": db.query(Event).filter(Event.event_date == date.today()).count(),
        "important_events": db.query(Event).filter(Event.status == "important").count(),
        "reports": db.query(Report).count(),
        "report_context": build_report_context(db),
        "latest_report": ReportOut.model_validate(latest_report).model_dump(mode="json") if latest_report else None,
        "recent_jobs": [
            JobRunOut.model_validate(job).model_dump(mode="json")
            for job in db.query(JobRun).order_by(JobRun.started_at.desc()).limit(5).all()
        ],
    }


@app.get("/api/watchlist/projects", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)) -> list[ProjectOut]:
    projects = db.query(Project).order_by(Project.priority.desc(), Project.name).all()
    result = []
    for project in projects:
        result.append(_project_out(project))
    return result


@app.get("/api/watchlist/export")
def export_watchlist(db: Session = Depends(get_db)) -> dict:
    projects = db.query(Project).order_by(Project.priority.desc(), Project.name).all()
    return {
        "version": 1,
        "projects": [_project_out(project).model_dump(mode="json", exclude={"id", "created_at"}) for project in projects],
    }


@app.post("/api/watchlist/import", response_model=WatchlistImportResult)
def import_watchlist(payload: WatchlistImport, db: Session = Depends(get_db)) -> WatchlistImportResult:
    created = 0
    updated = 0
    for item in payload.projects:
        project = db.query(Project).filter(Project.name == item.name).first()
        if project:
            updated += 1
        else:
            project = Project(name=item.name)
            db.add(project)
            db.flush()
            created += 1

        project.type = item.type
        project.github_repo = item.github_repo
        project.homepage_url = item.homepage_url
        project.enabled = item.enabled
        project.priority = item.priority
        db.query(SearchQuery).filter(SearchQuery.project_id == project.id).delete()
        for query in item.queries:
            db.add(SearchQuery(project_id=project.id, query=query))

    db.commit()
    return WatchlistImportResult(imported=len(payload.projects), created=created, updated=updated)


@app.post("/api/watchlist/projects", response_model=ProjectOut)
def create_project(payload: ProjectIn, db: Session = Depends(get_db)) -> ProjectOut:
    project = Project(
        name=payload.name,
        type=payload.type,
        github_repo=payload.github_repo,
        homepage_url=payload.homepage_url,
        enabled=payload.enabled,
        priority=payload.priority,
    )
    db.add(project)
    db.flush()
    for query in payload.queries:
        db.add(SearchQuery(project_id=project.id, query=query))
    db.commit()
    db.refresh(project)
    return _project_out(project)


@app.patch("/api/watchlist/projects/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, payload: ProjectIn, db: Session = Depends(get_db)) -> ProjectOut:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.name = payload.name
    project.type = payload.type
    project.github_repo = payload.github_repo
    project.homepage_url = payload.homepage_url
    project.enabled = payload.enabled
    project.priority = payload.priority
    db.query(SearchQuery).filter(SearchQuery.project_id == project.id).delete()
    for query in payload.queries:
        db.add(SearchQuery(project_id=project.id, query=query))
    db.commit()
    db.refresh(project)
    return _project_out(project)


@app.delete("/api/watchlist/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)) -> dict:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return {"ok": True}


@app.get("/api/events", response_model=list[EventOut])
def list_events(
    status: str | None = None,
    entity: str | None = None,
    limit: int = Query(default=100, le=300),
    db: Session = Depends(get_db),
) -> list[Event]:
    query = db.query(Event)
    if status:
        query = query.filter(Event.status == status)
    if entity:
        query = query.filter(Event.entity == entity)
    return query.order_by(Event.event_date.desc(), Event.importance_score.desc(), Event.created_at.desc()).limit(limit).all()


@app.get("/api/radar/projects", response_model=list[ProjectRadarOut])
def project_radar(db: Session = Depends(get_db)) -> list[dict]:
    return build_project_radar(db)


@app.patch("/api/events/{event_id}", response_model=EventOut)
def patch_event(event_id: int, payload: EventPatch, db: Session = Depends(get_db)) -> Event:
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.status = payload.status
    db.commit()
    db.refresh(event)
    return event


@app.get("/api/reports/daily", response_model=list[ReportOut])
def list_reports(db: Session = Depends(get_db)) -> list[Report]:
    return db.query(Report).order_by(Report.report_date.desc()).limit(60).all()


@app.get("/api/reports/daily/{target_date}", response_model=ReportOut)
def get_report(target_date: date, db: Session = Depends(get_db)) -> Report:
    report = db.query(Report).filter(Report.report_date == target_date, Report.report_type == "daily").first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@app.post("/api/reports/daily/{target_date}/regenerate", response_model=ReportOut)
async def regenerate_report(target_date: date, db: Session = Depends(get_db)) -> Report:
    return await generate_daily_report(db, target_date)


@app.get("/api/jobs", response_model=list[JobRunOut])
def list_jobs(db: Session = Depends(get_db)) -> list[JobRun]:
    return db.query(JobRun).order_by(JobRun.started_at.desc()).limit(100).all()


@app.post("/api/jobs/run-daily")
def enqueue_daily() -> dict:
    task = daily_run.delay()
    return {"task_id": task.id, "status": "queued"}


@app.post("/api/jobs/collect")
def collect_now(background_tasks: BackgroundTasks, db: Session = Depends(get_db)) -> dict:
    job_id = start_collection_job(db)
    background_tasks.add_task(run_collection_job, job_id)
    return {"job_id": job_id, "status": "queued"}


@app.post("/api/jobs/backfill")
def backfill_now(background_tasks: BackgroundTasks, db: Session = Depends(get_db)) -> dict:
    job_id = start_collection_job(db, job_type="backfill")
    background_tasks.add_task(run_collection_job, job_id, 7)
    return {"job_id": job_id, "status": "queued", "days": 7}


def _project_out(project: Project) -> ProjectOut:
    return ProjectOut(
        id=project.id,
        name=project.name,
        type=project.type,
        github_repo=project.github_repo,
        homepage_url=project.homepage_url,
        enabled=project.enabled,
        priority=project.priority,
        created_at=project.created_at,
        queries=[query.query for query in project.queries],
    )


# --------------- Skill file serving ---------------

_APP_ROOT = Path(__file__).resolve().parent.parent  # /app in Docker, backend/ locally
SKILL_DIR = _APP_ROOT / "skills" / "agent-memory-daily-report"
if not SKILL_DIR.exists():
    SKILL_DIR = _APP_ROOT.parent / "skills" / "agent-memory-daily-report"

INSTALL_SH_TEMPLATE = r"""#!/usr/bin/env bash
# Agent Memory Daily Report Skill 安装脚本
# 用法（默认装到 Claude Code skills 目录）：
#   curl -fsSL {base_url}/api/skill/install.sh | bash
#
# 装到其他 Agent 平台：
#   SKILL_DIR=$HOME/.codex/skills/agent-memory-daily-report  bash <(curl -fsSL {base_url}/api/skill/install.sh)
#   SKILL_DIR=$HOME/.gemini/skills/agent-memory-daily-report bash <(curl -fsSL {base_url}/api/skill/install.sh)
set -e

DEFAULT_DIR="$HOME/.claude/skills/agent-memory-daily-report"
SKILL_DIR="${{SKILL_DIR:-$DEFAULT_DIR}}"
BASE_URL="{base_url}"

echo ""
echo "Installing Agent Memory Daily Report Skill"
echo "  → $SKILL_DIR"
echo ""

mkdir -p "$SKILL_DIR/scripts"
mkdir -p "$SKILL_DIR/references"

curl -fsSL "$BASE_URL/api/skill/SKILL.md"                -o "$SKILL_DIR/SKILL.md"
curl -fsSL "$BASE_URL/api/skill/scripts/daily_report.py" -o "$SKILL_DIR/scripts/daily_report.py"
curl -fsSL "$BASE_URL/api/skill/references/api.md"       -o "$SKILL_DIR/references/api.md"
chmod +x "$SKILL_DIR/scripts/daily_report.py"

cat > "$SKILL_DIR/.memory-report-skill.json" <<JSON
{{
  "api_base": "$BASE_URL",
  "webhook_url": "",
  "webhook_type": "generic"
}}
JSON

echo ""
echo "✓ Done."
echo ""
echo "  API Base: $BASE_URL"
echo "  Config:   $SKILL_DIR/.memory-report-skill.json"
echo ""
echo "Next: restart your Agent or start a new conversation, then try:"
echo "  - 获取今天的 Agent Memory 市场日报"
echo "  - 推送日报到飞书群"
echo ""
echo "Other Agent platforms (re-run with SKILL_DIR set):"
echo "  Codex CLI:    SKILL_DIR=\$HOME/.codex/skills/agent-memory-daily-report  bash <(curl -fsSL $BASE_URL/api/skill/install.sh)"
echo "  Gemini CLI:   SKILL_DIR=\$HOME/.gemini/skills/agent-memory-daily-report bash <(curl -fsSL $BASE_URL/api/skill/install.sh)"
echo ""
"""


def _get_base_url(request: Request) -> str:
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
    return f"{scheme}://{host}"


@app.get("/api/skill/install.sh", response_class=PlainTextResponse)
def skill_install_sh(request: Request) -> str:
    base_url = _get_base_url(request)
    return INSTALL_SH_TEMPLATE.format(base_url=base_url)


@app.get("/api/skill/SKILL.md", response_class=PlainTextResponse)
def skill_md() -> str:
    path = SKILL_DIR / "SKILL.md"
    if not path.exists():
        raise HTTPException(status_code=404, detail="SKILL.md not found")
    return path.read_text(encoding="utf-8")


@app.get("/api/skill/scripts/daily_report.py", response_class=PlainTextResponse)
def skill_script() -> str:
    path = SKILL_DIR / "scripts" / "daily_report.py"
    if not path.exists():
        raise HTTPException(status_code=404, detail="daily_report.py not found")
    return path.read_text(encoding="utf-8")


@app.get("/api/skill/references/api.md", response_class=PlainTextResponse)
def skill_api_ref() -> str:
    path = SKILL_DIR / "references" / "api.md"
    if not path.exists():
        raise HTTPException(status_code=404, detail="api.md not found")
    return path.read_text(encoding="utf-8")
