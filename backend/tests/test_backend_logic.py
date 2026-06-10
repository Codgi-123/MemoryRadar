from datetime import date, datetime
import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.bootstrap import seed_defaults
from app.db import Base
from app.main import require_admin
from app.models import Event, Project, RawItem, SearchQuery
from app.settings import settings
from app.processors.events import _date_signal, create_events_from_raw
from app.processors.github_radar import _changed_since, _since_start
from app.schemas import ProjectIn


class BackendLogicTest(unittest.TestCase):
    def test_low_confidence_event_uses_first_seen_date(self) -> None:
        raw = RawItem(
            source="serper_search",
            url="https://example.com/item",
            title="Example item",
            first_seen_at=datetime(2026, 1, 2, 12, 0, 0),
            fetched_at=datetime(2026, 1, 3, 12, 0, 0),
        )

        signal = _date_signal(raw, date(2026, 6, 3))

        self.assertEqual(signal["event_date"], date(2026, 1, 2))
        self.assertEqual(signal["confidence"], "low")

    def test_follow_on_pr_coverage_is_not_market_latest_during_cooldown(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        SessionLocal = sessionmaker(bind=engine)
        db = SessionLocal()
        try:
            db.add(
                RawItem(
                    source="serper_search",
                    url="https://example.com/mem0-launch",
                    title="Mem0 launches agent memory platform",
                    snippet="A new agent memory product launch for long-term memory.",
                    published_at=datetime(2026, 6, 1, 9, 0, 0),
                    fetched_at=datetime(2026, 6, 1, 9, 5, 0),
                )
            )
            db.commit()
            create_events_from_raw(db, target_date=date(2026, 6, 1))

            db.add(
                RawItem(
                    source="serper_search",
                    url="https://example.com/mem0-pr-followup",
                    title="Mem0 launches agent memory platform in new media coverage",
                    snippet="Follow-on coverage repeats the original long-term memory launch.",
                    published_at=datetime(2026, 6, 3, 9, 0, 0),
                    fetched_at=datetime(2026, 6, 3, 9, 5, 0),
                )
            )
            db.commit()
            create_events_from_raw(db, target_date=date(2026, 6, 3))

            followup = db.query(Event).filter(Event.url == "https://example.com/mem0-pr-followup").one()
            self.assertFalse(followup.is_market_latest)
            self.assertEqual(followup.event_type, "market_signal")
        finally:
            db.close()

    def test_hard_update_remains_market_latest_during_cooldown(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        SessionLocal = sessionmaker(bind=engine)
        db = SessionLocal()
        try:
            db.add(
                RawItem(
                    source="serper_search",
                    url="https://example.com/mem0-launch",
                    title="Mem0 launches agent memory platform",
                    snippet="A new agent memory product launch for long-term memory.",
                    published_at=datetime(2026, 6, 1, 9, 0, 0),
                    fetched_at=datetime(2026, 6, 1, 9, 5, 0),
                )
            )
            db.commit()
            create_events_from_raw(db, target_date=date(2026, 6, 1))

            db.add(
                RawItem(
                    source="serper_search",
                    url="https://example.com/mem0-v1-benchmark",
                    title="Mem0 v1.2 benchmark update improves agent memory retrieval",
                    snippet="The new version adds benchmark results and updated memory APIs.",
                    published_at=datetime(2026, 6, 3, 9, 0, 0),
                    fetched_at=datetime(2026, 6, 3, 9, 5, 0),
                )
            )
            db.commit()
            create_events_from_raw(db, target_date=date(2026, 6, 3))

            update = db.query(Event).filter(Event.url == "https://example.com/mem0-v1-benchmark").one()
            self.assertTrue(update.is_market_latest)
        finally:
            db.close()

    def test_project_schema_queries_are_not_shared_between_instances(self) -> None:
        first = ProjectIn(name="first")
        second = ProjectIn(name="second")

        first.queries.append("agent memory")

        self.assertEqual(second.queries, [])

    def test_github_changed_since_filters_by_requested_field(self) -> None:
        since = _since_start(date(2026, 6, 3))
        items = [
            {"id": 1, "created_at": "2026-06-02T00:00:00Z"},
            {"id": 2, "created_at": "2026-06-01T23:59:59Z"},
        ]

        self.assertEqual([item["id"] for item in _changed_since(items, "created_at", since)], [1])

    def test_admin_guard_requires_matching_token_when_configured(self) -> None:
        previous = settings.admin_token
        settings.admin_token = "secret"
        try:
            with self.assertRaises(HTTPException):
                require_admin()
            with self.assertRaises(HTTPException):
                require_admin("wrong")
            self.assertIsNone(require_admin("secret"))
        finally:
            settings.admin_token = previous

    def test_seed_defaults_adds_missing_queries_to_existing_project(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        SessionLocal = sessionmaker(bind=engine)
        db = SessionLocal()
        try:
            project = Project(name="OpenAI", type="vendor", priority=8)
            db.add(project)
            db.flush()
            db.add(SearchQuery(project_id=project.id, query="OpenAI ChatGPT memory"))
            db.commit()

            seed_defaults(db)
            seed_defaults(db)

            refreshed = db.query(Project).filter(Project.name == "OpenAI").one()
            queries = [
                row.query
                for row in db.query(SearchQuery)
                .filter(SearchQuery.project_id == refreshed.id)
                .order_by(SearchQuery.query)
                .all()
            ]

            self.assertIn("ChatGPT saved memories", queries)
            self.assertIn("OpenAI personalization memory", queries)
            self.assertEqual(queries.count("OpenAI ChatGPT memory"), 1)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
