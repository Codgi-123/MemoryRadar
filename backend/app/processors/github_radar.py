from datetime import date, datetime, timedelta, timezone

import httpx
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import GithubProjectSnapshot, Project
from app.settings import settings

SEVERE_KEYWORDS = [
    "data loss",
    "corrupt",
    "privacy",
    "security",
    "leak",
    "crash",
    "panic",
    "deadlock",
    "thread exhaustion",
    "memory leak",
    "incorrect",
    "wrong result",
    "empty results",
    "retrieval failure",
    "cannot start",
    "contaminat",
    "language leakage",
    "multi-tenant",
    "数据丢失",
    "隐私",
    "泄露",
    "崩溃",
    "无法启动",
    "错误结果",
]


async def collect_github_project_snapshot(project: Project, target_date: date | None = None) -> dict:
    target_date = target_date or date.today()
    since = datetime.combine(target_date - timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
    repo = project.github_repo or ""
    headers = {"Accept": "application/vnd.github+json"}
    if settings.github_token:
        headers["Authorization"] = f"Bearer {settings.github_token}"

    async with httpx.AsyncClient(timeout=30, headers=headers) as client:
        repo_resp, releases_resp, issues_resp, commits_resp = await asyncio_gather_compat(
            client.get(f"https://api.github.com/repos/{repo}"),
            client.get(f"https://api.github.com/repos/{repo}/releases", params={"per_page": 10}),
            client.get(
                f"https://api.github.com/repos/{repo}/issues",
                params={"state": "all", "since": since.isoformat(), "per_page": 100, "sort": "updated"},
            ),
            client.get(f"https://api.github.com/repos/{repo}/commits", params={"since": since.isoformat(), "per_page": 100}),
        )

    if repo_resp.status_code != 200:
        raise RuntimeError(f"GitHub repo fetch failed for {repo}: HTTP {repo_resp.status_code}")

    repo_data = repo_resp.json()
    releases = releases_resp.json() if releases_resp.status_code == 200 else []
    issues_payload = issues_resp.json() if issues_resp.status_code == 200 else []
    commits = commits_resp.json() if commits_resp.status_code == 200 else []

    issues = [item for item in issues_payload if "pull_request" not in item]
    prs = [item for item in issues_payload if "pull_request" in item]
    new_issues = [item for item in issues if _dt(item.get("created_at")) and _dt(item.get("created_at")) >= since]
    closed_issues = [item for item in issues if item.get("state") == "closed" and _dt(item.get("closed_at")) and _dt(item.get("closed_at")) >= since]
    new_prs = [item for item in prs if _dt(item.get("created_at")) and _dt(item.get("created_at")) >= since]
    closed_prs = [item for item in prs if item.get("state") == "closed" and _dt(item.get("closed_at")) and _dt(item.get("closed_at")) >= since]
    new_releases = [item for item in releases if _dt(item.get("published_at")) and _dt(item.get("published_at")) >= since]
    changed_issues = {item.get("id"): item for item in [*new_issues, *closed_issues]}.values()
    severe_issues = [item for item in changed_issues if _is_severe_issue(item)]
    latest_release = releases[0] if releases else None

    return {
        "project_id": project.id,
        "project_name": project.name,
        "github_repo": repo,
        "snapshot_date": target_date,
        "stars": repo_data.get("stargazers_count", 0),
        "forks": repo_data.get("forks_count", 0),
        "watchers": repo_data.get("subscribers_count") or repo_data.get("watchers_count", 0),
        "open_issues_count": repo_data.get("open_issues_count", 0),
        "recent_commit_count": len(commits),
        "new_release_count": len(new_releases),
        "latest_release_tag": (latest_release or {}).get("tag_name"),
        "latest_release_url": (latest_release or {}).get("html_url"),
        "new_issue_count": len(new_issues),
        "closed_issue_count": len(closed_issues),
        "new_pr_count": len(new_prs),
        "closed_pr_count": len(closed_prs),
        "severe_issue_count": len(severe_issues),
        "severe_issue_summary": _issue_summary(severe_issues[:5]),
        "pushed_at": _dt(repo_data.get("pushed_at")),
    }


async def asyncio_gather_compat(*aws):
    import asyncio

    return await asyncio.gather(*aws)


def store_github_snapshot(db: Session, snapshot: dict) -> None:
    existing = (
        db.query(GithubProjectSnapshot)
        .filter(
            GithubProjectSnapshot.project_id == snapshot["project_id"],
            GithubProjectSnapshot.snapshot_date == snapshot["snapshot_date"],
        )
        .first()
    )
    if existing:
        for key, value in snapshot.items():
            setattr(existing, key, value)
    else:
        db.add(GithubProjectSnapshot(**snapshot))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()


def build_project_radar(db: Session, target_date: date | None = None) -> list[dict]:
    target_date = target_date or date.today()
    snapshots = (
        db.query(GithubProjectSnapshot)
        .filter(GithubProjectSnapshot.snapshot_date == target_date)
        .order_by(GithubProjectSnapshot.project_name)
        .all()
    )
    radar = []
    for snapshot in snapshots:
        previous = (
            db.query(GithubProjectSnapshot)
            .filter(
                GithubProjectSnapshot.project_id == snapshot.project_id,
                GithubProjectSnapshot.snapshot_date < target_date,
            )
            .order_by(GithubProjectSnapshot.snapshot_date.desc())
            .first()
        )
        star_delta = snapshot.stars - previous.stars if previous else None
        open_issue_delta = snapshot.open_issues_count - previous.open_issues_count if previous else None
        radar.append(
            {
                "project": snapshot.project_name,
                "github_repo": snapshot.github_repo,
                "stars": snapshot.stars,
                "star_delta": star_delta,
                "forks": snapshot.forks,
                "open_issues_count": snapshot.open_issues_count,
                "open_issue_delta": open_issue_delta,
                "recent_commit_count": snapshot.recent_commit_count,
                "new_release_count": snapshot.new_release_count,
                "latest_release_tag": snapshot.latest_release_tag,
                "latest_release_url": snapshot.latest_release_url,
                "new_issue_count": snapshot.new_issue_count,
                "closed_issue_count": snapshot.closed_issue_count,
                "new_pr_count": snapshot.new_pr_count,
                "closed_pr_count": snapshot.closed_pr_count,
                "severe_issue_count": snapshot.severe_issue_count,
                "severe_issue_summary": snapshot.severe_issue_summary,
                "pushed_at": snapshot.pushed_at.isoformat() if snapshot.pushed_at else None,
            }
        )
    return radar


def _is_severe_issue(issue: dict) -> bool:
    text = f"{issue.get('title', '')}\n{issue.get('body', '')}".lower()
    labels = " ".join(label.get("name", "") for label in issue.get("labels", [])).lower()
    return any(keyword in text or keyword in labels for keyword in SEVERE_KEYWORDS)


def _issue_summary(issues: list[dict]) -> str | None:
    if not issues:
        return None
    lines = []
    for issue in issues:
        lines.append(f"#{issue.get('number')} {issue.get('title')} ({issue.get('html_url')})")
    return "\n".join(lines)


def _dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))
