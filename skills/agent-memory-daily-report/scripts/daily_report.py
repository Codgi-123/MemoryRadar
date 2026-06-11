#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch or push Agent Memory daily and weekly reports.")
    parser.add_argument("--api-base", default=None, help="Memory Market Watcher API base URL.")
    parser.add_argument(
        "--config",
        default=os.getenv("MEMORY_REPORT_CONFIG"),
        help="Optional JSON config file with api_base, webhook_url, and webhook_type.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    fetch_parser = subparsers.add_parser("fetch", help="Fetch a generated report.")
    add_report_args(fetch_parser)
    fetch_parser.add_argument("--format", choices=["markdown", "json"], default="markdown")

    push_parser = subparsers.add_parser("push", help="Fetch and push a generated report to a webhook.")
    add_report_args(push_parser)
    push_parser.add_argument("--webhook-url", default=os.getenv("MEMORY_REPORT_WEBHOOK_URL"))
    push_parser.add_argument(
        "--webhook-type",
        choices=["generic", "feishu", "dingtalk", "slack"],
        default=os.getenv("MEMORY_REPORT_WEBHOOK_TYPE"),
    )

    args = parser.parse_args()
    try:
        config = load_config(args.config)
        api_base = resolve_api_base(args.api_base, config)
        report_type = args.report_type
        report = fetch_report(api_base, report_type, args.date, args.latest)
        if args.command == "fetch":
            if args.format == "json":
                print(json.dumps(report, ensure_ascii=False, indent=2))
            else:
                print(report["content_markdown"])
            return 0

        webhook_url = args.webhook_url or config.get("webhook_url")
        webhook_type = args.webhook_type or config.get("webhook_type") or "generic"
        if not webhook_url:
            raise SystemExit("Missing webhook URL. Set MEMORY_REPORT_WEBHOOK_URL or pass --webhook-url.")
        push_report(webhook_url, webhook_type, report)
        print(f"Pushed {report_type} report {report['report_date']} to {webhook_type} webhook.")
        return 0
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            print("No generated report exists for the requested date.", file=sys.stderr)
            return 2
        print(f"HTTP error {exc.code}: {exc.reason}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1


def add_report_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--report-type",
        choices=["daily", "weekly"],
        default="daily",
        help="Report type to fetch or push. Defaults to daily.",
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--date", help="Report date as YYYY-MM-DD, today, or yesterday.")
    group.add_argument("--latest", action="store_true", help="Use the newest report from the list endpoint.")


def fetch_report(api_base: str, report_type: str, date_value: str | None, latest: bool) -> dict:
    api_base = api_base.rstrip("/")
    if latest:
        reports = request_json(f"{api_base}/api/reports/{report_type}")
        if not reports:
            raise SystemExit(f"No generated {report_type} reports found.")
        return reports[0]

    report_date = normalize_date(date_value or "today")
    return request_json(f"{api_base}/api/reports/{report_type}/{urllib.parse.quote(report_date)}")


def load_config(path_value: str | None) -> dict:
    candidates = []
    if path_value:
        candidates.append(Path(path_value).expanduser())
    candidates.extend(
        [
            Path.cwd() / ".memory-report-skill.json",
            Path.home() / ".memory-report-skill.json",
        ]
    )
    for path in candidates:
        if path.exists():
            with path.open("r", encoding="utf-8") as handle:
                return json.load(handle)
    return {}


def resolve_api_base(cli_value: str | None, config: dict) -> str:
    value = cli_value or os.getenv("MEMORY_REPORT_API_BASE") or config.get("api_base")
    if value:
        return str(value).rstrip("/")
    raise SystemExit(
        "Missing API base URL. Set MEMORY_REPORT_API_BASE, pass --api-base, "
        "or create .memory-report-skill.json from the Memory Watcher /skills page."
    )


def normalize_date(value: str) -> str:
    today = dt.date.today()
    if value == "today":
        return today.isoformat()
    if value == "yesterday":
        return (today - dt.timedelta(days=1)).isoformat()
    dt.date.fromisoformat(value)
    return value


def request_json(url: str) -> dict | list:
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def push_report(webhook_url: str, webhook_type: str, report: dict) -> None:
    payload = build_payload(webhook_type, report)
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        webhook_url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        response.read()


def build_payload(webhook_type: str, report: dict) -> dict:
    report_type = report.get("report_type") or "daily"
    title = report.get("title") or f"Agent Memory {report_type.title()} Report - {report.get('report_date', '')}"
    markdown = report.get("content_markdown") or ""
    text = f"{title}\n\n{markdown}".strip()

    if webhook_type == "feishu":
        return {"msg_type": "text", "content": {"text": text}}
    if webhook_type == "dingtalk":
        return {"msgtype": "markdown", "markdown": {"title": title, "text": text}}
    if webhook_type == "slack":
        return {"text": text}
    return {
        "title": title,
        "date": report.get("report_date"),
        "markdown": markdown,
        "report": report,
    }


if __name__ == "__main__":
    raise SystemExit(main())
