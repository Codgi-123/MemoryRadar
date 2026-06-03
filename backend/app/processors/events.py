from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlparse

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Event, RawItem
from app.time_utils import app_today


KEYWORDS = {
    "release": "release",
    "released": "release",
    "officially release": "release",
    "changelog": "release",
    "version": "release",
    "版本": "release",
    "发布": "product_launch",
    "推出": "product_launch",
    "launch": "product_launch",
    "launched": "product_launch",
    "launches": "product_launch",
    "introducing": "product_launch",
    "introduces": "product_launch",
    "unveils": "product_launch",
    "unveiled": "product_launch",
    "announces": "product_launch",
    "announced": "product_launch",
    "open-source memory": "product_launch",
    "open source memory": "product_launch",
    "memory stack": "product_launch",
    "开源": "product_launch",
    "paper": "paper",
    "benchmark": "benchmark",
    "commit": "repo_update",
    "github": "repo_update",
    "funding": "funding",
}


def store_raw_items(db: Session, items: list[dict]) -> int:
    inserted = 0
    for item in items:
        db.add(RawItem(**item))
        try:
            db.commit()
            inserted += 1
        except IntegrityError:
            db.rollback()
    return inserted


def create_events_from_raw(
    db: Session,
    *,
    target_date: date | None = None,
    is_cold_start: bool = False,
    collection_days: int = 2,
) -> int:
    target_date = target_date or app_today()
    raw_items = db.query(RawItem).order_by(RawItem.fetched_at.desc()).limit(300).all()
    inserted = 0
    for raw in raw_items:
        event = _raw_to_event(raw, target_date=target_date, is_cold_start=is_cold_start, collection_days=collection_days)
        existing = db.query(Event).filter(Event.url == event.url, Event.title == event.title).first()
        if existing:
            _sync_event_classification(existing, event)
            db.commit()
            continue
        db.add(event)
        try:
            db.commit()
            inserted += 1
        except IntegrityError:
            db.rollback()
    return inserted


def _sync_event_classification(existing: Event, event: Event) -> None:
    existing.entity = event.entity
    existing.event_type = event.event_type
    existing.event_date = event.event_date
    existing.date_confidence = event.date_confidence
    existing.is_baseline_event = event.is_baseline_event
    existing.is_market_latest = event.is_market_latest
    existing.evidence_reason = event.evidence_reason
    existing.importance_score = event.importance_score
    existing.novelty_score = event.novelty_score


def _raw_to_event(raw: RawItem, *, target_date: date, is_cold_start: bool, collection_days: int) -> Event:
    text = f"{raw.title} {raw.snippet or ''}".lower()
    event_type = "market_signal"
    for key, value in KEYWORDS.items():
        if key in text:
            event_type = value
            break

    entity = _guess_entity(text, raw.url)
    date_signal = _date_signal(raw, target_date)
    event_date = date_signal["event_date"]
    importance = 0.75 if event_type in {"release", "product_launch", "benchmark"} else 0.55
    is_baseline_event = _is_baseline_event(date_signal["confidence"], is_cold_start, collection_days)
    is_market_latest = _is_market_latest(
        event_type,
        date_signal["confidence"],
        event_date,
        target_date,
        is_baseline_event,
        raw,
    )
    novelty = 0.75 if is_market_latest else 0.35 if is_baseline_event else 0.5

    return Event(
        entity=entity,
        event_type=event_type,
        title=raw.title[:500],
        summary=(raw.snippet or raw.raw_content or raw.title)[:2000],
        url=raw.url,
        source=raw.source,
        event_date=event_date,
        date_confidence=date_signal["confidence"],
        is_baseline_event=is_baseline_event,
        is_market_latest=is_market_latest,
        evidence_reason=date_signal["reason"],
        importance_score=importance,
        novelty_score=novelty,
    )


def _date_signal(raw: RawItem, target_date: date) -> dict:
    if raw.published_at:
        return {
            "event_date": raw.published_at.date(),
            "confidence": "high",
            "reason": f"source date evidence: {raw.date_evidence or raw.published_at.isoformat()}",
        }
    if raw.source.startswith("github_"):
        event_at = raw.fetched_at or datetime.now(timezone.utc)
        return {
            "event_date": event_at.date(),
            "confidence": "medium",
            "reason": "GitHub API item observed during the collection window.",
        }

    first_seen = raw.first_seen_at or raw.fetched_at
    if first_seen:
        return {
            "event_date": first_seen.date(),
            "confidence": "low",
            "reason": "No explicit publication date; using first-seen date instead of re-dating the item on every run.",
        }
    return {
        "event_date": target_date,
        "confidence": "low",
        "reason": "No explicit publication or first-seen date; using collection date as a fallback.",
    }


def _is_baseline_event(date_confidence: str, is_cold_start: bool, collection_days: int) -> bool:
    if not is_cold_start:
        return False
    if collection_days >= 7:
        return True
    return date_confidence == "low"


def _is_market_latest(
    event_type: str,
    date_confidence: str,
    event_date: date,
    target_date: date,
    is_baseline_event: bool,
    raw: RawItem,
) -> bool:
    if is_baseline_event:
        return False
    if event_type not in {"release", "product_launch", "benchmark"}:
        return False
    if date_confidence not in {"high", "medium"}:
        return False
    if not target_date - timedelta(days=1) <= event_date <= target_date:
        return False
    if raw.source.startswith("github_"):
        return True
    return _is_agent_memory_relevant(raw)


def _is_agent_memory_relevant(raw: RawItem) -> bool:
    text = f"{raw.title} {raw.snippet or ''} {raw.raw_content or ''} {raw.url}".lower()
    adjacent_noise_terms = [
        "ai pc",
        "windows pc",
        "pc chip",
        "chip market",
        "nvidia",
        "英伟达",
        "手机",
        "smartphone",
        "tokenomics",
        "release notes | actual budget",
        "actual budget",
        "ai news week",
        "newsletter",
        "linkedin",
        "instagram",
    ]
    if any(term in text for term in adjacent_noise_terms):
        return False

    strong_terms = [
        "agent memory",
        "llm memory",
        "long-term memory",
        "long term memory",
        "persistent memory",
        "memory stack",
        "memory protocol",
        "memory framework",
        "memory os",
        "agentthreatbench",
        "hy-memory",
        "gbrain",
        "agent第二大脑",
        "第二大脑",
        "mem0",
        "memos",
        "openviking",
        "hermes agent",
        "agentmemory",
        "长期记忆",
        "智能体记忆",
        "agent 记忆",
        "记忆插件",
        "记忆系统",
        "记忆框架",
        "记忆栈",
    ]
    return any(term in text for term in strong_terms)


def _guess_entity(text: str, url: str) -> str:
    for name in ["openviking", "mem0", "memos", "tencent agent memory", "tencent"]:
        if name in text or name.replace(" ", "") in url.lower():
            return "Tencent Agent Memory" if name == "tencent" else name
    host = urlparse(url).netloc.replace("www.", "")
    return host or "Agent Memory"
