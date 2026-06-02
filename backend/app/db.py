from collections.abc import Generator
from pathlib import Path
import time

from sqlalchemy import create_engine, event, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.settings import settings


class Base(DeclarativeBase):
    pass


if settings.database_url.startswith("sqlite:///"):
    sqlite_path = settings.database_url.replace("sqlite:///", "", 1)
    if sqlite_path != ":memory:":
        Path(sqlite_path).parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False, "timeout": 30},
        pool_pre_ping=True,
    )
else:
    engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


if settings.database_url.startswith("sqlite:///"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app import models  # noqa: F401

    last_error: Exception | None = None
    for _ in range(20):
        try:
            Base.metadata.create_all(bind=engine)
            _ensure_sqlite_columns()
            return
        except OperationalError as exc:
            last_error = exc
            time.sleep(1)
    if last_error:
        raise last_error


def _ensure_sqlite_columns() -> None:
    if not settings.database_url.startswith("sqlite:///"):
        return
    column_specs = {
        "raw_items": {
            "date_evidence": "VARCHAR(300)",
            "first_seen_at": "DATETIME",
        },
        "events": {
            "date_confidence": "VARCHAR(40) DEFAULT 'low'",
            "is_baseline_event": "BOOLEAN DEFAULT 0",
            "is_market_latest": "BOOLEAN DEFAULT 0",
            "evidence_reason": "TEXT",
        },
    }
    with engine.begin() as connection:
        for table, columns in column_specs.items():
            existing = {row[1] for row in connection.execute(text(f"PRAGMA table_info({table})")).fetchall()}
            for name, ddl in columns.items():
                if name not in existing:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
        connection.execute(text("UPDATE raw_items SET first_seen_at = COALESCE(first_seen_at, fetched_at, CURRENT_TIMESTAMP)"))
