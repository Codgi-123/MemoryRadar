from datetime import datetime, timedelta, timezone
import re

import httpx

from app.settings import settings


async def collect_serper_results(query: str, days: int = 2) -> list[dict]:
    if not settings.serper_api_key:
        return []

    payload = {
        "q": query,
        "num": settings.serper_num_results,
        "gl": settings.serper_gl,
        "hl": settings.serper_hl,
        "tbs": _time_window(days),
    }
    endpoint = f"{settings.serper_base_url.rstrip('/')}/search"
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            endpoint,
            headers={
                "X-API-KEY": settings.serper_api_key,
                "Content-Type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    fetched_at = datetime.now(timezone.utc)
    items = []
    for item in data.get("organic", []):
        date_evidence = item.get("date")
        items.append(
            {
                "source": "serper_search",
                "url": item.get("link") or item.get("url", ""),
                "title": item.get("title", ""),
                "snippet": item.get("snippet", ""),
                "raw_content": item.get("snippet", ""),
                "published_at": _parse_serper_date(date_evidence, fetched_at),
                "date_evidence": date_evidence,
                "fetched_at": fetched_at,
            }
        )
    return [item for item in items if item["url"] and item["title"]]


def _time_window(days: int) -> str:
    if days <= 1:
        return "qdr:d"
    if days <= 7:
        return "qdr:w"
    if days <= 31:
        return "qdr:m"
    return "qdr:y"


def _parse_serper_date(value: str | None, now: datetime) -> datetime | None:
    if not value:
        return None
    text = value.strip().lower()
    if text in {"today", "今天"}:
        return now
    if text in {"yesterday", "昨天"}:
        return now - timedelta(days=1)

    patterns = [
        (r"(\d+)\s*minute", "minutes"),
        (r"(\d+)\s*分钟", "minutes"),
        (r"(\d+)\s*hour", "hours"),
        (r"(\d+)\s*小时", "hours"),
        (r"(\d+)\s*day", "days"),
        (r"(\d+)\s*天", "days"),
        (r"(\d+)\s*week", "weeks"),
        (r"(\d+)\s*周", "weeks"),
    ]
    for pattern, unit in patterns:
        match = re.search(pattern, text)
        if match:
            return now - timedelta(**{unit: int(match.group(1))})

    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%b %d, %Y", "%B %d, %Y"):
        try:
            parsed = datetime.strptime(value.strip(), fmt)
            return parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None
