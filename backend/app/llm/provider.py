import httpx

from app.settings import settings


async def summarize_daily(
    events: list[dict],
    previous_report: str | None = None,
    project_radar: list[dict] | None = None,
    report_context: dict | None = None,
) -> tuple[str, str]:
    prompt = _build_prompt(events, previous_report, project_radar or [], report_context or {})
    if settings.llm_provider == "anthropic" and settings.anthropic_api_key:
        return await _anthropic(prompt)
    if settings.openai_api_key:
        return await _openai(prompt)
    return _fallback_summary(events), "fallback-no-llm"


async def summarize_weekly(
    daily_reports: list[dict],
    weekly_events: list[dict],
    project_radar: list[dict] | None = None,
    report_context: dict | None = None,
) -> tuple[str, str]:
    prompt = _build_weekly_prompt(daily_reports, weekly_events, project_radar or [], report_context or {})
    if settings.llm_provider == "anthropic" and settings.anthropic_api_key:
        return await _anthropic(prompt, marker="# Agent Memory 市场周报")
    if settings.openai_api_key:
        return await _openai(prompt, marker="# Agent Memory 市场周报")
    return _fallback_weekly_summary(daily_reports, weekly_events), "fallback-no-llm"


def _build_prompt(events: list[dict], previous_report: str | None, project_radar: list[dict], report_context: dict) -> str:
    return f"""
你是 Agent Memory 市场分析师和日报编辑。请用中文生成一份高信号、克制、可快速阅读的每日市场简报，重点说明“相对昨天新增了什么”。

写作要求：
- 只输出 Markdown 日报正文，第一行必须是“# Agent Memory 市场日报”；不要输出寒暄、解释、确认语或元说明。
- 不要堆砌所有链接，只保留真正有市场意义、产品意义或项目风险的内容。
- 报告中提到的具体产品、项目、版本、Issue、Release、新闻或文章，必须尽量使用 Markdown 链接格式 `[标题](原始URL)` 给出可访问原链接；不要只写来源名称。
- “市场最新动态”尤其必须包含原链接。表格中必须有“原链接”列，单元格使用 `[来源/标题](url)`。
- 明确区分“市场最新动态”和“开源项目日常变化”。
- 如果信息不足，请写“暂无明确重大动态”，不要编造。
- 每条重要判断都要能从今天的结构化事件中找到依据。
- 优先关注：新产品、新开源项目、重大版本发布、stars 明显变化、严重 issue 提出或修复、关键 PR/commit。
- 输出 Markdown。
- “开源项目雷达”必须优先使用 GitHub 项目雷达数据；不要从搜索结果里猜 stars、新版本或 issue。
- 如果报告上下文中的 is_cold_start 为 true，必须在“今日总结”第一条说明当前是初始化基线日报；不得把系统首次采集到的内容称为今日新发布。
- “市场最新动态”只能使用 is_market_latest=true 的事件；is_baseline_event=true 或 date_confidence=low 的事件不得写成“新发布”“今天推出”“今日发布”。
- “市场最新动态”必须严格属于 Agent Memory / AI Agent 长期记忆 / 记忆协议 / 记忆框架 / 记忆安全方向；普通 AI Agent、模型、芯片、融资、长上下文新闻不要写入第 2 节，除非它明确涉及 Agent Memory。
- 如果 market_latest_count 为 0，“市场最新动态”必须写“暂无明确重大产品发布或重大市场更新”，可补一句“基线期观察到的近期信号放入值得关注”。
- 对 date_confidence=medium 的 GitHub 事件，可以写成“过去 24 小时观察到”，不要夸大为官方发布，除非事件类型和链接明确是 release。
- 值得关注内容可以使用基线事件，但要标注“基线期首次观察/近期信号”，不要当作今日新增。

输出结构：
# Agent Memory 市场日报

## 1. 今日总结
用 3-5 条 bullet 总结今天最重要的结论。不要超过 150 字。

## 2. 市场最新动态
只写 Agent Memory 市场中新发布的产品、新开源项目，或者已有产品/项目的重大更新。
优先使用 Markdown 表格，字段必须包含：
| 事件 | 原链接 | 判断 |
其中“原链接”必须是可点击 Markdown 链接，例如 `[GitHub Release](https://...)` 或 `[媒体报道](https://...)`。
如果没有明显的新产品或重大更新，写“暂无明确重大产品发布或重大市场更新”。

## 3. 开源项目雷达
先给一个 Markdown 表格，字段必须包含：
| 项目 | Stars / 热度变化 | 新版本 | Issue / 修复 | 今日判断 |
其中“新版本”和“Issue / 修复”里如有 release_url、issue_url 或 repo 地址，必须使用 Markdown 链接。

然后按项目逐一给详细分析，至少覆盖这些重点项目：
- mem0
- MemOS
- TencentDB-Agent-Memory
- OpenViking

每个项目的分析格式：
### 项目名
- 今日变化：
- Stars / 热度：
- 新版本 / Release：
- Issue / 修复：
- 判断：

## 4. 值得关注的内容
列出 3-6 条后续值得继续跟踪的信号、风险或机会。

昨天日报摘要：
{previous_report or "暂无"}

今天结构化事件：
{events}

GitHub 项目雷达数据：
{project_radar}

报告上下文：
{report_context}
""".strip()


def _build_weekly_prompt(daily_reports: list[dict], weekly_events: list[dict], project_radar: list[dict], report_context: dict) -> str:
    return f"""
你是 Agent Memory 市场分析师。请基于最近 7 天日报和结构化事件，生成一份“周报”，重点提取观察产品/开源项目的核心版本更新或功能更新。

写作要求：
- 只输出 Markdown 周报正文，第一行必须是“# Agent Memory 市场周报”；不要输出寒暄、解释、确认语或元说明。
- 周报不是日报拼接，必须做归纳、去重和趋势判断。
- 重点关注观察产品/项目的核心版本更新、功能更新、重要 issue 修复、能力边界变化。
- 每条核心更新必须尽量体现：发布时间、进展简述、能力分析。
- 如果不能确认发布时间，写“发布时间：未明确”，不要编造。
- 报告中提到的 Release、Issue、PR、文章、项目必须尽量使用 Markdown 链接 `[标题](URL)`。
- 不要把冷启动或基线期首次观察误写成“本周发布”；证据不足时写“本周观察到”。
- 输出中文 Markdown。

输出结构：
# Agent Memory 市场周报

## 1. 本周总结
用 3-5 条 bullet 总结本周最值得关注的变化和结论。

## 2. 核心版本 / 功能更新
用 Markdown 表格，字段必须包含：
| 产品 / 项目 | 发布时间 | 进展简述 | 能力分析 | 原链接 |

只放确实与 Agent Memory、AI Agent 长期记忆、记忆框架、记忆安全、记忆数据库相关的内容。

## 3. 观察产品逐项分析
按产品/项目逐一分析，至少覆盖近 7 天日报或事件中出现的重要观察对象。
每个对象使用：
### 产品 / 项目名
- 发布时间：
- 进展简述：
- 能力分析：
- 影响判断：
- 后续观察点：

## 4. 本周值得关注
列出 3-6 条下周继续跟踪的方向、风险或机会。

近 7 天日报：
{daily_reports}

近 7 天结构化事件：
{weekly_events}

GitHub 项目雷达数据：
{project_radar}

报告上下文：
{report_context}
""".strip()


async def _openai(prompt: str, marker: str = "# Agent Memory 市场日报") -> tuple[str, str]:
    endpoint = _chat_completions_endpoint(settings.openai_base_url)
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            endpoint,
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json={
                "model": settings.openai_model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "max_tokens": 10240,
            },
        )
        response.raise_for_status()
        data = response.json()
    return _normalize_report_markdown(data["choices"][0]["message"]["content"], marker), settings.openai_model


def _chat_completions_endpoint(base_url: str) -> str:
    base_url = base_url.rstrip("/")
    if base_url.endswith("/chat/completions"):
        return base_url
    return f"{base_url}/chat/completions"


async def _anthropic(prompt: str, marker: str = "# Agent Memory 市场日报") -> tuple[str, str]:
    endpoint = f"{settings.anthropic_base_url.rstrip('/')}/v1/messages"
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            endpoint,
            headers={
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
            },
            json={
                "model": settings.anthropic_model,
                "max_tokens": 10240,
                "temperature": 0.2,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        response.raise_for_status()
        data = response.json()
    return _normalize_report_markdown(data["content"][0]["text"], marker), settings.anthropic_model


def _normalize_report_markdown(content: str, marker: str = "# Agent Memory 市场日报") -> str:
    content = content.strip()
    marker_index = content.find(marker)
    if marker_index > 0:
        return content[marker_index:].strip()
    return content


def _fallback_summary(events: list[dict]) -> str:
    lines = ["# Agent Memory 市场日报", "", "## 1. 今日总结"]
    lines.append(f"- 今天采集到 {len(events)} 条候选动态。当前未配置 LLM key，因此先生成规则版摘要。")
    lines.extend(["", "## 2. 市场最新动态"])
    market_events = [event for event in events if event.get("event_type") in {"product_launch", "release", "benchmark"}]
    if market_events:
        for event in market_events[:6]:
            lines.append(f"- [{event['title']}]({event['url']})：{event['summary'][:160]}")
    else:
        lines.append("- 暂无明确重大产品发布或重大市场更新。")

    lines.extend(
        [
            "",
            "## 3. 开源项目雷达",
            "| 项目 | Stars / 热度变化 | 新版本 | Issue / 修复 | 今日判断 |",
            "|---|---|---|---|---|",
        ]
    )
    for project in ["mem0", "MemOS", "TencentDB-Agent-Memory", "OpenViking"]:
        project_events = [
            event
            for event in events
            if project.lower() in event.get("entity", "").lower()
            or project.lower() in event.get("title", "").lower()
            or project.lower() in event.get("url", "").lower()
        ]
        judgment = "有新增动态" if project_events else "暂无明显新增动态"
        lines.append(f"| {project} | 待 LLM 分析 | 待 LLM 分析 | 待 LLM 分析 | {judgment} |")

    for project in ["mem0", "MemOS", "TencentDB-Agent-Memory", "OpenViking"]:
        lines.extend(["", f"### {project}", "- 今日变化：待 LLM 分析。", "- Stars / 热度：待 LLM 分析。", "- 新版本 / Release：待 LLM 分析。", "- Issue / 修复：待 LLM 分析。", "- 判断：待 LLM 分析。"])

    lines.extend(["", "## 4. 值得关注的内容"])
    for event in events[:8]:
        lines.append(f"- [{event['title']}]({event['url']})：{event['summary'][:160]}")
    return "\n".join(lines)


def _fallback_weekly_summary(daily_reports: list[dict], weekly_events: list[dict]) -> str:
    lines = ["# Agent Memory 市场周报", "", "## 1. 本周总结"]
    lines.append(f"- 本周可用日报 {len(daily_reports)} 份，结构化事件 {len(weekly_events)} 条。当前未配置 LLM key，因此先生成规则版周报。")
    lines.extend(
        [
            "",
            "## 2. 核心版本 / 功能更新",
            "| 产品 / 项目 | 发布时间 | 进展简述 | 能力分析 | 原链接 |",
            "|---|---|---|---|---|",
        ]
    )
    update_events = [event for event in weekly_events if event.get("event_type") in {"release", "product_launch", "benchmark"}]
    if update_events:
        for event in update_events[:10]:
            lines.append(
                f"| {event.get('entity', '未知')} | {event.get('event_date', '未明确')} | {event.get('title', '')} | 待 LLM 深入分析 | [原链接]({event.get('url', '')}) |"
            )
    else:
        lines.append("| 暂无明确核心更新 | 未明确 | 本周未识别到明确版本或功能更新 | 继续观察 | - |")

    lines.extend(["", "## 3. 观察产品逐项分析"])
    for entity in sorted({event.get("entity", "未知") for event in update_events})[:8]:
        lines.extend(
            [
                "",
                f"### {entity}",
                "- 发布时间：待 LLM 分析。",
                "- 进展简述：待 LLM 分析。",
                "- 能力分析：待 LLM 分析。",
                "- 影响判断：待 LLM 分析。",
                "- 后续观察点：待 LLM 分析。",
            ]
        )
    lines.extend(["", "## 4. 本周值得关注"])
    for event in weekly_events[:6]:
        lines.append(f"- [{event.get('title', '未命名事件')}]({event.get('url', '')})")
    return "\n".join(lines)
