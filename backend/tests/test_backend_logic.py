from datetime import date, datetime
import unittest

from app.models import RawItem
from app.processors.events import _date_signal
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


if __name__ == "__main__":
    unittest.main()
