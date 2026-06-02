# Memory Market Watcher Report API

Use the Memory Watcher frontend `/skills` page to generate the deployment-specific API base URL. Do not assume localhost, because deployments may use different hosts, ports, or reverse proxies.

## Endpoints

### List reports

```http
GET /api/reports/daily
```

Returns recent daily reports, newest first.

### Get one report

```http
GET /api/reports/daily/{YYYY-MM-DD}
```

Returns `404` if no report has been generated for that date.

### Regenerate one report

```http
POST /api/reports/daily/{YYYY-MM-DD}/regenerate
```

Use only when the user explicitly wants to generate or refresh the report.

## Report Shape

```json
{
  "id": 1,
  "report_date": "2026-06-02",
  "report_type": "daily",
  "title": "Agent Memory 市场日报 - 2026-06-02",
  "content_markdown": "# Agent Memory 市场日报\\n...",
  "generated_by_model": "claude-opus-4-6",
  "created_at": "2026-06-02T08:30:00"
}
```

`content_markdown` is the canonical report body. It may contain Markdown tables and source links.

## Webhook Payloads

The bundled script supports these outgoing payload shapes:

- `generic`: `{"title": "...", "date": "...", "markdown": "...", "report": {...}}`
- `feishu`: `{"msg_type": "text", "content": {"text": "...markdown..."}}`
- `dingtalk`: `{"msgtype": "markdown", "markdown": {"title": "...", "text": "...markdown..."}}`
- `slack`: `{"text": "...markdown..."}`

If the receiving agent expects a different schema, call `fetch --format json` and transform the payload in that agent.
