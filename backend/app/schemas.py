from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ProjectIn(BaseModel):
    name: str
    type: str = "open_source"
    github_repo: str | None = None
    homepage_url: str | None = None
    enabled: bool = True
    priority: int = 5
    queries: list[str] = Field(default_factory=list)


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: str
    github_repo: str | None
    homepage_url: str | None
    enabled: bool
    priority: int
    created_at: datetime
    queries: list[str] = Field(default_factory=list)


class WatchlistImport(BaseModel):
    projects: list[ProjectIn]


class WatchlistImportResult(BaseModel):
    imported: int
    created: int
    updated: int


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entity: str
    event_type: str
    title: str
    summary: str
    url: str
    source: str
    event_date: date
    date_confidence: str
    is_baseline_event: bool
    is_market_latest: bool
    evidence_reason: str | None
    importance_score: float
    novelty_score: float
    status: str
    created_at: datetime


class EventPatch(BaseModel):
    status: str


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    report_date: date
    report_type: str
    title: str
    content_markdown: str
    generated_by_model: str | None
    created_at: datetime


class JobRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_type: str
    status: str
    started_at: datetime
    finished_at: datetime | None
    error_message: str | None


class ProjectRadarOut(BaseModel):
    project: str
    github_repo: str
    stars: int
    star_delta: int | None
    forks: int
    open_issues_count: int
    open_issue_delta: int | None
    recent_commit_count: int
    new_release_count: int
    latest_release_tag: str | None
    latest_release_url: str | None
    new_issue_count: int
    closed_issue_count: int
    new_pr_count: int
    closed_pr_count: int
    severe_issue_count: int
    severe_issue_summary: str | None
    pushed_at: str | None
