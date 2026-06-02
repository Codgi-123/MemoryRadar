---
name: agent-memory-daily-report
description: Fetch generated Agent Memory daily reports from a Memory Market Watcher API, retrieve today's or a specific date's Markdown report, and schedule or send daily report notifications to webhook-based channels or other agents. Use when asked to get, forward, push, schedule, or integrate the Agent Memory market daily report.
---

# Agent Memory Daily Report

Use this skill to retrieve generated Agent Memory market daily reports and push them to another agent, chat channel, webhook, or scheduler.

## Installation

One-line install (auto-detects platform):

```bash
curl -fsSL {{BASE_URL}}/api/skill/install.sh | bash
```

Other Agent platforms:

```bash
# Codex CLI
SKILL_DIR=$HOME/.codex/skills/agent-memory-daily-report bash <(curl -fsSL {{BASE_URL}}/api/skill/install.sh)

# Gemini CLI
SKILL_DIR=$HOME/.gemini/skills/agent-memory-daily-report bash <(curl -fsSL {{BASE_URL}}/api/skill/install.sh)
```

The install script will:
1. Download SKILL.md, daily_report.py, and api.md into the skills directory
2. Auto-generate `.memory-report-skill.json` config with the correct API base URL

## Configuration

After installation, the config file `.memory-report-skill.json` in the skill directory contains:

```json
{
  "api_base": "{{BASE_URL}}",
  "webhook_url": "",
  "webhook_type": "generic"
}
```

Environment-variable alternative:

```bash
export MEMORY_REPORT_API_BASE="{{BASE_URL}}"
export MEMORY_REPORT_WEBHOOK_URL="https://..."
export MEMORY_REPORT_WEBHOOK_TYPE="generic"  # generic | feishu | dingtalk | slack
```

The watcher API must expose:

- `GET /api/reports/daily` for recent reports.
- `GET /api/reports/daily/{YYYY-MM-DD}` for one date.

## Fetch A Report

Prefer the bundled script:

```bash
python skills/agent-memory-daily-report/scripts/daily_report.py fetch --date today
python skills/agent-memory-daily-report/scripts/daily_report.py fetch --date 2026-06-02
python skills/agent-memory-daily-report/scripts/daily_report.py fetch --latest
```

Output defaults to Markdown. Use JSON when another agent needs structured fields:

```bash
python skills/agent-memory-daily-report/scripts/daily_report.py fetch --date today --format json
```

## Push A Report

Push today's report to the configured webhook:

```bash
python skills/agent-memory-daily-report/scripts/daily_report.py push --date today
```

Push a specific date:

```bash
python skills/agent-memory-daily-report/scripts/daily_report.py push --date 2026-06-02
```

Override channel options inline:

```bash
python skills/agent-memory-daily-report/scripts/daily_report.py push \
  --date today \
  --webhook-url "$WEBHOOK_URL" \
  --webhook-type feishu
```

## Schedule Daily Push

For cron:

```cron
30 8 * * * cd /path/to/project && MEMORY_REPORT_API_BASE={{BASE_URL}} MEMORY_REPORT_WEBHOOK_URL=https://... MEMORY_REPORT_WEBHOOK_TYPE=feishu python skills/agent-memory-daily-report/scripts/daily_report.py push --date today
```

If the host environment has its own automation/reminder system, schedule that same command after the report generation time.

## Agent Workflow

When another agent uses this skill:

1. Check `MEMORY_REPORT_API_BASE`.
   - If it is absent, look for `.memory-report-skill.json`.
   - If both are absent, run the install command above.
2. Fetch the target report by date; use `--latest` only when the user asks for the newest report.
3. If pushing, use the channel-specific webhook type.
4. Preserve Markdown links in the report; do not strip source URLs.
5. If the date report is missing, report that no generated report exists and optionally call the watcher API's regenerate endpoint if the user explicitly allows generation.

For exact API and payload details, read `references/api.md` only when needed.
