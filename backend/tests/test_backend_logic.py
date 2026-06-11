from datetime import date, datetime
import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.bootstrap import seed_defaults
from app.db import Base
from app.main import list_reports, list_weekly_reports, require_admin
from app.models import Event, Project, RawItem, Report, SearchQuery
from app.settings import settings
from app.processors.events import _date_signal, create_events_from_raw, score_serper_candidate
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

    def test_score_serper_candidate_drops_hardware_memory_noise(self) -> None:
        raw = RawItem(
            source="serper_search",
            url="https://example.com/nvidia-ai-pc-memory-market",
            title="NVIDIA AI PC memory market expected to grow in 2026",
            snippet="Analysts discuss GPU memory, DRAM, and Windows PC chip demand.",
            published_at=datetime(2026, 6, 3, 9, 0, 0),
            fetched_at=datetime(2026, 6, 3, 9, 5, 0),
        )

        score = score_serper_candidate(raw, date(2026, 6, 3))

        self.assertTrue(score.should_drop)
        self.assertLess(score.relevance, 0.35)
        self.assertIn("noise", score.reason)

    def test_low_score_serper_candidate_does_not_create_event(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        SessionLocal = sessionmaker(bind=engine)
        db = SessionLocal()
        try:
            db.add(
                RawItem(
                    source="serper_search",
                    url="https://example.com/nvidia-ai-pc-memory-market",
                    title="NVIDIA AI PC memory market expected to grow in 2026",
                    snippet="Analysts discuss GPU memory, DRAM, and Windows PC chip demand.",
                    published_at=datetime(2026, 6, 3, 9, 0, 0),
                    fetched_at=datetime(2026, 6, 3, 9, 5, 0),
                )
            )
            db.commit()

            inserted = create_events_from_raw(db, target_date=date(2026, 6, 3))

            self.assertEqual(inserted, 0)
            self.assertEqual(db.query(Event).count(), 0)
        finally:
            db.close()

    def test_high_score_serper_candidate_keeps_event_with_score_reason(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        SessionLocal = sessionmaker(bind=engine)
        db = SessionLocal()
        try:
            db.add(
                RawItem(
                    source="serper_search",
                    url="https://mem0.ai/changelog/v1-2-benchmark",
                    title="Mem0 v1.2 benchmark update improves agent memory retrieval",
                    snippet="The new version adds benchmark results and updated memory APIs.",
                    published_at=datetime(2026, 6, 3, 9, 0, 0),
                    fetched_at=datetime(2026, 6, 3, 9, 5, 0),
                )
            )
            db.commit()

            inserted = create_events_from_raw(db, target_date=date(2026, 6, 3))

            self.assertEqual(inserted, 1)
            event = db.query(Event).one()
            self.assertTrue(event.is_market_latest)
            self.assertGreaterEqual(event.importance_score, 0.75)
            self.assertIn("Serper candidate score", event.evidence_reason or "")
        finally:
            db.close()

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

    def test_report_lists_filter_by_report_type(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        SessionLocal = sessionmaker(bind=engine)
        db = SessionLocal()
        try:
            db.add_all(
                [
                    Report(
                        report_date=date(2026, 6, 3),
                        report_type="daily",
                        title="Daily report",
                        content_markdown="daily",
                    ),
                    Report(
                        report_date=date(2026, 6, 3),
                        report_type="weekly",
                        title="Weekly report",
                        content_markdown="weekly",
                    ),
                ]
            )
            db.commit()

            daily_reports = list_reports(db)
            weekly_reports = list_weekly_reports(db)

            self.assertEqual([report.report_type for report in daily_reports], ["daily"])
            self.assertEqual([report.report_type for report in weekly_reports], ["weekly"])
        finally:
            db.close()

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
