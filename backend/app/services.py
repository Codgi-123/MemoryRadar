import asyncio
from datetime import date, timedelta

from sqlalchemy import distinct
from sqlalchemy.orm import Session

from app.collectors.github import collect_github_repo
from app.collectors.serper_search import collect_serper_results
from app.llm.provider import summarize_daily, summarize_weekly
from app.models import Event, GithubProjectSnapshot, JobRun, JobStatus, Project, Report, SearchQuery, SystemState
from app.processors.events import create_events_from_raw, store_raw_items
from app.processors.github_radar import build_project_radar, collect_github_project_snapshot, store_github_snapshot
from app.time_utils import app_today, utc_now


async def _collect_with_errors(label: str, collector) -> tuple[str, list[dict], str | None]:
    try:
        return label, await collector(), None
    except Exception as exc:
        return label, [], str(exc)


async def _collect_with_limit(semaphore: asyncio.Semaphore, label: str, collector) -> tuple[str, list[dict], str | None]:
    async with semaphore:
        return await _collect_with_errors(label, collector)


async def _snapshot_with_errors(project: Project) -> tuple[str, dict | None, str | None]:
    try:
        return project.name, await collect_github_project_snapshot(project, app_today()), None
    except Exception as exc:
        return project.name, None, str(exc)


async def run_collection(db: Session, days: int = 1) -> dict:
    total_raw = 0
    errors: list[str] = []
    queries = db.query(SearchQuery).filter(SearchQuery.enabled.is_(True)).all()
    projects = db.query(Project).filter(Project.enabled.is_(True), Project.github_repo.isnot(None)).all()

    serper_limit = asyncio.Semaphore(3)
    tasks = [
        _collect_with_limit(serper_limit, query.query, lambda query=query: collect_serper_results(query.query, days=days))
        for query in queries
    ]
    tasks.extend(
        _collect_with_errors(project.github_repo or project.name, lambda project=project: collect_github_repo(project.github_repo or ""))
        for project in projects
        if project.github_repo
    )

    for label, items, error in await asyncio.gather(*tasks):
        if error:
            errors.append(f"{label}: {error}")
            continue
        total_raw += store_raw_items(db, items)

    snapshot_tasks = [_snapshot_with_errors(project) for project in projects if project.github_repo]
    for label, snapshot, error in await asyncio.gather(*snapshot_tasks):
        if error:
            errors.append(f"{label} github radar: {error}")
            continue
        if snapshot:
            store_github_snapshot(db, snapshot)

    report_context = build_report_context(db)
    target_date = app_today()
    event_count = create_events_from_raw(
        db,
        target_date=target_date,
        is_cold_start=report_context["is_cold_start"],
        collection_days=days,
    )
    _set_state(db, "last_collection_at", utc_now().isoformat())
    return {"raw_inserted": total_raw, "events_inserted": event_count, "errors": errors}


def start_collection_job(db: Session, job_type: str = "collect") -> int:
    job = JobRun(job_type=job_type, status=JobStatus.running.value)
    db.add(job)
    db.commit()
    return job.id


def run_collection_job(job_id: int, days: int = 1) -> None:
    from app.db import SessionLocal

    db = SessionLocal()
    try:
        job = db.get(JobRun, job_id)
        if not job:
            return
        try:
            result = asyncio.run(run_collection(db, days=days))
            job.status = JobStatus.success.value
            job.error_message = "\n".join(result["errors"]) if result["errors"] else None
            if days >= 7:
                _set_state(db, "baseline_backfill_completed_at", utc_now().isoformat())
                _set_state(db, "baseline_days", str(days))
        except Exception as exc:
            job.status = JobStatus.failed.value
            job.error_message = str(exc)
        finally:
            job.finished_at = utc_now()
            db.commit()
    finally:
        db.close()


async def generate_daily_report(db: Session, target_date: date | None = None) -> Report:
    target_date = target_date or app_today()
    events = (
        db.query(Event)
        .filter(Event.event_date >= target_date - timedelta(days=1))
        .order_by(Event.importance_score.desc(), Event.created_at.desc())
        .limit(80)
        .all()
    )
    previous = (
        db.query(Report)
        .filter(Report.report_date < target_date, Report.report_type == "daily")
        .order_by(Report.report_date.desc())
        .first()
    )
    payload = [_event_payload(event) for event in events]
    project_radar = build_project_radar(db, target_date)
    report_context = build_report_context(db, target_date)
    content, model = await summarize_daily(payload, previous.content_markdown if previous else None, project_radar, report_context)
    title = f"Agent Memory 市场日报 - {target_date.isoformat()}"

    return _upsert_report(db, target_date, "daily", title, content, model)


async def generate_weekly_report(db: Session, target_date: date | None = None) -> Report:
    target_date = target_date or app_today()
    start_date = target_date - timedelta(days=6)
    daily_reports = (
        db.query(Report)
        .filter(Report.report_type == "daily", Report.report_date >= start_date, Report.report_date <= target_date)
        .order_by(Report.report_date.asc())
        .all()
    )
    weekly_events = (
        db.query(Event)
        .filter(Event.event_date >= start_date, Event.event_date <= target_date)
        .order_by(Event.event_date.desc(), Event.importance_score.desc(), Event.created_at.desc())
        .limit(160)
        .all()
    )
    daily_payload = [
        {
            "report_date": report.report_date.isoformat(),
            "title": report.title,
            "content_markdown": report.content_markdown[:12000],
            "generated_by_model": report.generated_by_model,
        }
        for report in daily_reports
    ]
    event_payload = [_event_payload(event) for event in weekly_events]
    project_radar = build_project_radar(db, target_date)
    report_context = build_report_context(db, target_date) | {
        "report_type": "weekly",
        "week_start_date": start_date.isoformat(),
        "week_end_date": target_date.isoformat(),
        "daily_report_count": len(daily_payload),
        "weekly_event_count": len(event_payload),
        "schedule": "每周三 10:00",
    }
    content, model = await summarize_weekly(daily_payload, event_payload, project_radar, report_context)
    title = f"Agent Memory 市场周报 - {start_date.isoformat()} 至 {target_date.isoformat()}"

    return _upsert_report(db, target_date, "weekly", title, content, model)


def _event_payload(event: Event) -> dict:
    return {
        "entity": event.entity,
        "event_type": event.event_type,
        "title": event.title,
        "summary": event.summary,
        "url": event.url,
        "source": event.source,
        "event_date": event.event_date.isoformat(),
        "importance_score": event.importance_score,
        "novelty_score": event.novelty_score,
        "date_confidence": event.date_confidence,
        "is_baseline_event": event.is_baseline_event,
        "is_market_latest": event.is_market_latest,
        "evidence_reason": event.evidence_reason,
    }


def _upsert_report(
    db: Session,
    report_date: date,
    report_type: str,
    title: str,
    content_markdown: str,
    generated_by_model: str | None,
) -> Report:
    report = db.query(Report).filter(Report.report_date == report_date, Report.report_type == report_type).first()
    if report:
        report.title = title
        report.content_markdown = content_markdown
        report.generated_by_model = generated_by_model
    else:
        report = Report(
            report_date=report_date,
            report_type=report_type,
            title=title,
            content_markdown=content_markdown,
            generated_by_model=generated_by_model,
        )
        db.add(report)
    db.commit()
    db.refresh(report)
    return report


def run_daily_job(db: Session) -> dict:
    job = JobRun(job_type="daily_run", status=JobStatus.running.value)
    db.add(job)
    db.commit()
    try:
        collection = asyncio.run(run_collection(db))
        report = asyncio.run(generate_daily_report(db))
        job.status = JobStatus.success.value
        job.finished_at = utc_now()
        db.commit()
        return {"job_id": job.id, "collection": collection, "report_id": report.id}
    except Exception as exc:
        job.status = JobStatus.failed.value
        job.error_message = str(exc)
        job.finished_at = utc_now()
        db.commit()
        raise


def run_weekly_job(db: Session) -> dict:
    job = JobRun(job_type="weekly_run", status=JobStatus.running.value)
    db.add(job)
    db.commit()
    try:
        report = asyncio.run(generate_weekly_report(db))
        job.status = JobStatus.success.value
        job.finished_at = utc_now()
        db.commit()
        return {"job_id": job.id, "report_id": report.id}
    except Exception as exc:
        job.status = JobStatus.failed.value
        job.error_message = str(exc)
        job.finished_at = utc_now()
        db.commit()
        raise


def build_report_context(db: Session, target_date: date | None = None) -> dict:
    target_date = target_date or app_today()
    snapshot_dates = (
        db.query(distinct(GithubProjectSnapshot.snapshot_date))
        .filter(GithubProjectSnapshot.snapshot_date <= target_date)
        .all()
    )
    snapshot_date_count = len(snapshot_dates)
    baseline_completed_at = _get_state(db, "baseline_backfill_completed_at")
    market_latest_count = (
        db.query(Event)
        .filter(Event.event_date >= target_date - timedelta(days=1), Event.is_market_latest.is_(True))
        .count()
    )
    baseline_event_count = (
        db.query(Event)
        .filter(Event.event_date >= target_date - timedelta(days=7), Event.is_baseline_event.is_(True))
        .count()
    )
    low_confidence_event_count = (
        db.query(Event)
        .filter(Event.event_date >= target_date - timedelta(days=1), Event.date_confidence == "low")
        .count()
    )
    is_cold_start = snapshot_date_count < 2
    readiness = "ready"
    if is_cold_start and baseline_completed_at:
        readiness = "warming"
    elif is_cold_start:
        readiness = "cold"
    return {
        "target_date": target_date.isoformat(),
        "is_cold_start": is_cold_start,
        "readiness": readiness,
        "snapshot_date_count": snapshot_date_count,
        "baseline_ready": not is_cold_start,
        "baseline_backfill_completed_at": baseline_completed_at,
        "market_latest_count": market_latest_count,
        "baseline_event_count": baseline_event_count,
        "low_confidence_event_count": low_confidence_event_count,
        "market_latest_rule": (
            "Only events with is_market_latest=true may be described as today's market latest updates. "
            "Baseline or low-confidence first-seen items must be described as recently observed signals."
        ),
        "guidance": (
            "当前处于初始化基线期。不得把系统首次采集到的内容称为今日新发布；市场最新动态只能写有明确发布时间证据的内容。"
            if is_cold_start
            else "已有至少两天 GitHub 快照，可正常进行相对昨日的变化判断。"
        ),
    }


def _get_state(db: Session, key: str) -> str | None:
    state = db.get(SystemState, key)
    return state.value if state else None


def _set_state(db: Session, key: str, value: str) -> None:
    state = db.get(SystemState, key)
    if state:
        state.value = value
    else:
        db.add(SystemState(key=key, value=value))
    db.flush()
