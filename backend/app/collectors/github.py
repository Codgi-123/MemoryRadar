import asyncio
from datetime import datetime, timezone

import httpx

from app.settings import settings


async def collect_github_repo(repo: str) -> list[dict]:
    if not repo:
        return []

    headers = {"Accept": "application/vnd.github+json"}
    if settings.github_token:
        headers["Authorization"] = f"Bearer {settings.github_token}"

    async with httpx.AsyncClient(timeout=30, headers=headers) as client:
        release_resp, commits_resp, repo_resp = await asyncio.gather(
            client.get(f"https://api.github.com/repos/{repo}/releases", params={"per_page": 5}),
            client.get(f"https://api.github.com/repos/{repo}/commits", params={"per_page": 5}),
            client.get(f"https://api.github.com/repos/{repo}"),
        )

    items: list[dict] = []
    fetched_at = datetime.now(timezone.utc)

    if repo_resp.status_code == 200:
        data = repo_resp.json()
        items.append(
            {
                "source": "github_repo",
                "url": data.get("html_url", f"https://github.com/{repo}"),
                "title": f"{repo} repo snapshot",
                "snippet": f"Stars: {data.get('stargazers_count')}; forks: {data.get('forks_count')}; updated: {data.get('updated_at')}",
                "raw_content": data.get("description") or "",
                "published_at": _parse_dt(data.get("updated_at")),
                "fetched_at": fetched_at,
            }
        )

    if release_resp.status_code == 200:
        for rel in release_resp.json():
            items.append(
                {
                    "source": "github_release",
                    "url": rel.get("html_url", ""),
                    "title": f"{repo} release: {rel.get('name') or rel.get('tag_name')}",
                    "snippet": rel.get("body", "")[:600],
                    "raw_content": rel.get("body", ""),
                    "published_at": _parse_dt(rel.get("published_at")),
                    "fetched_at": fetched_at,
                }
            )

    if commits_resp.status_code == 200:
        for commit in commits_resp.json():
            meta = commit.get("commit", {})
            items.append(
                {
                    "source": "github_commit",
                    "url": commit.get("html_url", ""),
                    "title": f"{repo} commit: {meta.get('message', '').splitlines()[0][:120]}",
                    "snippet": meta.get("message", ""),
                    "raw_content": meta.get("message", ""),
                    "published_at": _parse_dt(meta.get("committer", {}).get("date")),
                    "fetched_at": fetched_at,
                }
            )

    return [item for item in items if item["url"] and item["title"]]


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))
