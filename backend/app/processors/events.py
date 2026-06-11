from dataclasses import dataclass
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

MARKET_LATEST_STORY_COOLDOWN_DAYS = 7
SERPER_CANDIDATE_MIN_SCORE = 0.45
SERPER_CANDIDATE_STRONG_SCORE = 0.65

HARD_UPDATE_TERMS = [
    "release notes",
    "changelog",
    "benchmark",
    "leaderboard",
    "integration",
    "integrates",
    "integrated",
    "plugin",
    "sdk",
    "api",
    "funding",
    "raises",
    "raised",
    "acquires",
    "partnership",
    "version",
    "v0.",
    "v1.",
    "v2.",
    "v3.",
    "新版本",
    "版本",
    "更新",
    "功能",
    "集成",
    "融资",
    "基准",
    "榜单",
]

STRONG_RELEVANCE_TERMS = [
    "agent memory",
    "ai agent memory",
    "llm memory",
    "long-term memory",
    "long term memory",
    "persistent memory",
    "memory framework",
    "memory layer",
    "memory stack",
    "memory protocol",
    "memory system for agents",
    "memory os",
    "agent第二大脑",
    "第二大脑",
    "智能体记忆",
    "长期记忆",
    "agent 记忆",
    "记忆插件",
    "记忆系统",
    "记忆框架",
    "记忆栈",
]

KNOWN_MEMORY_PROJECT_TERMS = [
    "agentmemory",
    "agentthreatbench",
    "gbrain",
    "hermes agent",
    "hy-memory",
    "langmem",
    "mem0",
    "memos",
    "openviking",
    "zep",
]

LOW_VALUE_CONTENT_TERMS = [
    "best tools",
    "course",
    "guide",
    "hiring",
    "job",
    "jobs",
    "listicle",
    "newsletter",
    "opinion",
    "roundup",
    "tutorial",
    "weekly roundup",
    "what is",
    "招聘",
    "教程",
    "课程",
    "周报",
]

ADJACENT_NOISE_TERMS = [
    "actual budget",
    "ai news week",
    "ai pc",
    "chip market",
    "dram",
    "gpu memory",
    "human memory",
    "instagram",
    "linkedin",
    "nvidia",
    "pc chip",
    "phone memory",
    "psychology",
    "ram",
    "release notes | actual budget",
    "smartphone",
    "ssd",
    "tokenomics",
    "windows pc",
    "手机",
    "英伟达",
]

HIGH_VALUE_HOSTS = [
    "arxiv.org",
    "github.com",
    "huggingface.co",
    "openreview.net",
    "paperswithcode.com",
]

OFFICIAL_HOST_HINTS = [
    "blog",
    "changelog",
    "docs",
    "release",
]

LOW_VALUE_HOSTS = [
    "instagram.com",
    "linkedin.com",
    "medium.com",
    "substack.com",
    "tiktok.com",
    "youtube.com",
    "youtu.be",
]


@dataclass(frozen=True)
class CandidateScore:
    total: float
    relevance: float
    update: float
    source: float
    freshness: float
    penalty: float
    should_drop: bool
    reason: str


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
        candidate_score = None
        if raw.source == "serper_search":
            candidate_score = score_serper_candidate(raw, target_date)
            if candidate_score.should_drop:
                continue

        event = _raw_to_event(raw, target_date=target_date, is_cold_start=is_cold_start, collection_days=collection_days)
        if candidate_score:
            _apply_candidate_score(event, candidate_score)
        _apply_story_cooldown(db, event, raw)
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


def score_serper_candidate(raw: RawItem, target_date: date) -> CandidateScore:
    text = _candidate_text(raw)
    host = _host(raw.url)
    relevance, relevance_reason = _score_candidate_relevance(text)
    update, update_reason = _score_candidate_update(text)
    source, source_reason = _score_candidate_source(host, raw.url)
    freshness, freshness_reason = _score_candidate_freshness(raw, target_date)
    penalty, penalty_reason = _score_candidate_penalty(text, host, relevance)
    total = _clamp(
        relevance * 0.45
        + update * 0.25
        + source * 0.15
        + freshness * 0.15
        - penalty
    )
    should_drop = total < SERPER_CANDIDATE_MIN_SCORE or relevance < 0.35
    reason_parts = [
        relevance_reason,
        update_reason,
        source_reason,
        freshness_reason,
    ]
    if penalty_reason:
        reason_parts.append(penalty_reason)
    reason = "; ".join(part for part in reason_parts if part)
    return CandidateScore(
        total=round(total, 3),
        relevance=round(relevance, 3),
        update=round(update, 3),
        source=round(source, 3),
        freshness=round(freshness, 3),
        penalty=round(penalty, 3),
        should_drop=should_drop,
        reason=reason,
    )


def _apply_candidate_score(event: Event, score: CandidateScore) -> None:
    score_note = (
        f"Serper candidate score={score.total:.2f} "
        f"(relevance={score.relevance:.2f}, update={score.update:.2f}, source={score.source:.2f}, "
        f"freshness={score.freshness:.2f}, penalty={score.penalty:.2f}): {score.reason}"
    )
    event.evidence_reason = f"{event.evidence_reason} {score_note}" if event.evidence_reason else score_note

    if score.total < SERPER_CANDIDATE_STRONG_SCORE:
        event.is_market_latest = False
        event.importance_score = min(event.importance_score, 0.55)
        event.novelty_score = min(event.novelty_score, 0.45)
        if event.event_type in {"release", "product_launch", "benchmark"} and score.update < 0.65:
            event.event_type = "market_signal"
        return

    event.importance_score = max(event.importance_score, min(score.total, 0.9))


def _score_candidate_relevance(text: str) -> tuple[float, str]:
    if _contains_any(text, STRONG_RELEVANCE_TERMS):
        return 0.95, "strong agent-memory relevance"
    if _contains_any(text, KNOWN_MEMORY_PROJECT_TERMS):
        return 0.85, "known memory project/entity"
    if "memory" in text and any(term in text for term in ["agent", "llm", "ai agent", "智能体", "大模型"]):
        return 0.65, "memory term paired with agent/LLM context"
    if "memory" in text or "记忆" in text:
        return 0.2, "generic memory mention only"
    return 0.0, "no agent-memory relevance signal"


def _score_candidate_update(text: str) -> tuple[float, str]:
    event_terms = [
        "announces",
        "announced",
        "arxiv",
        "commit",
        "introduces",
        "introducing",
        "launch",
        "launched",
        "launches",
        "open source",
        "open-source",
        "paper",
        "released",
        "unveils",
        "unveiled",
        "开源",
        "发布",
        "推出",
        "论文",
    ]
    if _contains_any(text, HARD_UPDATE_TERMS):
        return 0.9, "hard update signal"
    if _contains_any(text, event_terms):
        return 0.75, "event/update wording"
    if _contains_any(text, LOW_VALUE_CONTENT_TERMS):
        return 0.1, "low-actionability content type"
    return 0.35, "no explicit update signal"


def _score_candidate_source(host: str, url: str) -> tuple[float, str]:
    url_lower = url.lower()
    if _host_matches(host, HIGH_VALUE_HOSTS):
        return 0.95, "high-confidence source domain"
    if _host_matches(host, LOW_VALUE_HOSTS):
        return 0.05, "low-confidence/social source domain"
    if any(hint in host or f"/{hint}" in url_lower for hint in OFFICIAL_HOST_HINTS):
        return 0.75, "official/docs/changelog source hint"
    if host:
        return 0.45, "ordinary web source"
    return 0.25, "missing source host"


def _score_candidate_freshness(raw: RawItem, target_date: date) -> tuple[float, str]:
    if raw.published_at:
        age_days = (target_date - raw.published_at.date()).days
        if age_days < 0:
            return 0.5, "source date is after target date"
        if age_days <= 1:
            return 0.95, "fresh source date"
        if age_days <= 7:
            return 0.75, "source date within 7 days"
        if age_days <= 31:
            return 0.45, "source date within 31 days"
        return 0.2, "stale source date"
    if raw.date_evidence:
        return 0.35, "unparsed date evidence"
    return 0.25, "no explicit source date"


def _score_candidate_penalty(text: str, host: str, relevance: float) -> tuple[float, str]:
    penalties = []
    penalty = 0.0

    if _contains_any(text, ADJACENT_NOISE_TERMS):
        if relevance >= 0.85:
            penalty += 0.15
            penalties.append("adjacent noise term")
        else:
            penalty += 0.45
            penalties.append("off-topic memory/noise term")

    if _contains_any(text, LOW_VALUE_CONTENT_TERMS):
        penalty += 0.25
        penalties.append("low-value content term")

    if _host_matches(host, LOW_VALUE_HOSTS):
        penalty += 0.35
        penalties.append("low-value source")

    if any(term in text for term in ["hiring", "job", "jobs", "招聘"]):
        penalty += 0.25
        penalties.append("job/hiring content")

    return min(penalty, 0.85), ", ".join(penalties)


def _candidate_text(raw: RawItem) -> str:
    return f"{raw.title} {raw.snippet or ''} {raw.raw_content or ''} {raw.url}".lower()


def _contains_any(text: str, terms: list[str]) -> bool:
    return any(term in text for term in terms)


def _host(url: str) -> str:
    return urlparse(url).netloc.lower().removeprefix("www.")


def _host_matches(host: str, domains: list[str]) -> bool:
    return any(host == domain or host.endswith(f".{domain}") for domain in domains)


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


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


def _apply_story_cooldown(db: Session, event: Event, raw: RawItem) -> None:
    if not event.is_market_latest:
        return
    if not _has_recent_market_latest(db, event):
        return
    if _has_hard_update_signal(raw):
        return

    event.is_market_latest = False
    event.event_type = "market_signal"
    event.novelty_score = min(event.novelty_score, 0.45)
    cooldown_note = (
        f"Same entity had a market-latest item in the previous {MARKET_LATEST_STORY_COOLDOWN_DAYS} days; "
        "treating this as follow-on coverage unless it includes a hard update signal."
    )
    event.evidence_reason = f"{event.evidence_reason} {cooldown_note}" if event.evidence_reason else cooldown_note


def _has_recent_market_latest(db: Session, event: Event) -> bool:
    start_date = event.event_date - timedelta(days=MARKET_LATEST_STORY_COOLDOWN_DAYS)
    return (
        db.query(Event)
        .filter(
            Event.entity == event.entity,
            Event.is_market_latest.is_(True),
            Event.event_date >= start_date,
            Event.event_date <= event.event_date,
            Event.url != event.url,
        )
        .first()
        is not None
    )


def _has_hard_update_signal(raw: RawItem) -> bool:
    text = f"{raw.title} {raw.snippet or ''} {raw.raw_content or ''}".lower()
    return any(term in text for term in HARD_UPDATE_TERMS)


def _guess_entity(text: str, url: str) -> str:
    for name in ["openviking", "mem0", "memos", "tencent agent memory", "tencent"]:
        if name in text or name.replace(" ", "") in url.lower():
            return "Tencent Agent Memory" if name == "tencent" else name
    host = urlparse(url).netloc.replace("www.", "")
    return host or "Agent Memory"
