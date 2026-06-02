from datetime import datetime, date
from enum import Enum

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class EventStatus(str, Enum):
    new = "new"
    important = "important"
    ignored = "ignored"
    read = "read"


class JobStatus(str, Enum):
    running = "running"
    success = "success"
    failed = "failed"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    type: Mapped[str] = mapped_column(String(80), default="open_source")
    github_repo: Mapped[str | None] = mapped_column(String(300), nullable=True)
    homepage_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    enabled: Mapped[bool] = mapped_column(default=True)
    priority: Mapped[int] = mapped_column(Integer, default=5)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    queries: Mapped[list["SearchQuery"]] = relationship(cascade="all, delete-orphan")


class SearchQuery(Base):
    __tablename__ = "search_queries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    query: Mapped[str] = mapped_column(String(500), index=True)
    enabled: Mapped[bool] = mapped_column(default=True)


class SystemState(Base):
    __tablename__ = "system_state"

    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class RawItem(Base):
    __tablename__ = "raw_items"
    __table_args__ = (UniqueConstraint("url", "source", name="uq_raw_url_source"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(100), index=True)
    url: Mapped[str] = mapped_column(String(1000), index=True)
    title: Mapped[str] = mapped_column(String(500))
    snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    date_evidence: Mapped[str | None] = mapped_column(String(300), nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    fetched_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (UniqueConstraint("url", "title", name="uq_event_url_title"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity: Mapped[str] = mapped_column(String(200), index=True)
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(500))
    summary: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(String(1000), index=True)
    source: Mapped[str] = mapped_column(String(100), index=True)
    event_date: Mapped[date] = mapped_column(Date, index=True)
    date_confidence: Mapped[str] = mapped_column(String(40), default="low", index=True)
    is_baseline_event: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_market_latest: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    evidence_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    importance_score: Mapped[float] = mapped_column(Float, default=0.5)
    novelty_score: Mapped[float] = mapped_column(Float, default=0.5)
    status: Mapped[str] = mapped_column(String(40), default=EventStatus.new.value, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class GithubProjectSnapshot(Base):
    __tablename__ = "github_project_snapshots"
    __table_args__ = (UniqueConstraint("project_id", "snapshot_date", name="uq_github_snapshot_project_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    project_name: Mapped[str] = mapped_column(String(200), index=True)
    github_repo: Mapped[str] = mapped_column(String(300), index=True)
    snapshot_date: Mapped[date] = mapped_column(Date, index=True)
    stars: Mapped[int] = mapped_column(Integer, default=0)
    forks: Mapped[int] = mapped_column(Integer, default=0)
    watchers: Mapped[int] = mapped_column(Integer, default=0)
    open_issues_count: Mapped[int] = mapped_column(Integer, default=0)
    recent_commit_count: Mapped[int] = mapped_column(Integer, default=0)
    new_release_count: Mapped[int] = mapped_column(Integer, default=0)
    latest_release_tag: Mapped[str | None] = mapped_column(String(200), nullable=True)
    latest_release_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    new_issue_count: Mapped[int] = mapped_column(Integer, default=0)
    closed_issue_count: Mapped[int] = mapped_column(Integer, default=0)
    new_pr_count: Mapped[int] = mapped_column(Integer, default=0)
    closed_pr_count: Mapped[int] = mapped_column(Integer, default=0)
    severe_issue_count: Mapped[int] = mapped_column(Integer, default=0)
    severe_issue_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    pushed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (UniqueConstraint("report_date", "report_type", name="uq_report_date_type"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_date: Mapped[date] = mapped_column(Date, index=True)
    report_type: Mapped[str] = mapped_column(String(80), default="daily")
    title: Mapped[str] = mapped_column(String(300))
    content_markdown: Mapped[str] = mapped_column(Text)
    generated_by_model: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class JobRun(Base):
    __tablename__ = "job_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_type: Mapped[str] = mapped_column(String(100), index=True)
    status: Mapped[str] = mapped_column(String(40), default=JobStatus.running.value, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
