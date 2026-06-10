from sqlalchemy.orm import Session

from app.models import Project, SearchQuery


DEFAULT_PROJECTS = [
    {
        "name": "openviking",
        "github_repo": "volcengine/OpenViking",
        "queries": ["openviking agent memory", "openviking AI memory", "openviking persistent context"],
    },
    {
        "name": "mem0",
        "github_repo": "mem0ai/mem0",
        "queries": ["mem0 AI memory", "mem0 agent memory", "mem0 memory platform", "mem0 personalization"],
    },
    {
        "name": "memos",
        "github_repo": "MemTensor/MemOS",
        "queries": ["memos AI memory", "memos agent memory", "memos open source memory", "MemOS agent memory"],
    },
    {
        "name": "Tencent Agent Memory",
        "github_repo": "Tencent/TencentDB-Agent-Memory",
        "queries": ["Tencent Agent Memory", "腾讯 Agent Memory", "Tencent AI agent memory", "腾讯 智能体记忆"],
    },
    {
        "name": "OpenAI",
        "github_repo": None,
        "type": "vendor",
        "queries": [
            "OpenAI ChatGPT memory",
            "ChatGPT saved memories",
            "OpenAI personalization memory",
            "OpenAI agent memory",
            "ChatGPT user preferences memory",
        ],
    },
    {
        "name": "Anthropic",
        "github_repo": None,
        "type": "vendor",
        "queries": [
            "Anthropic Claude memory",
            "Claude personalization",
            "Claude user preferences",
            "Anthropic agent memory",
        ],
    },
    {
        "name": "Google Gemini",
        "github_repo": None,
        "type": "vendor",
        "queries": [
            "Gemini memory",
            "Gemini personalization",
            "Gemini saved information",
            "Gemini workspace context",
            "Gemini API context caching",
        ],
    },
    {
        "name": "Microsoft Copilot",
        "github_repo": None,
        "type": "vendor",
        "queries": [
            "Microsoft Copilot memory",
            "Copilot personalization",
            "Copilot user preferences",
            "Copilot workspace context",
        ],
    },
    {
        "name": "Meta AI",
        "github_repo": None,
        "type": "vendor",
        "queries": ["Meta AI memory", "Meta AI personalization", "Meta AI user preferences"],
    },
    {
        "name": "xAI Grok",
        "github_repo": None,
        "type": "vendor",
        "queries": ["Grok memory", "xAI Grok memory", "Grok personalization", "Grok user preferences"],
    },
    {
        "name": "Qwen",
        "github_repo": None,
        "type": "vendor",
        "queries": ["Qwen memory", "通义千问 记忆", "Qwen agent memory", "Qwen personalization"],
    },
    {
        "name": "Kimi",
        "github_repo": None,
        "type": "vendor",
        "queries": ["Kimi memory", "Kimi 智能体记忆", "Kimi 用户偏好", "月之暗面 Kimi 记忆"],
    },
    {
        "name": "Doubao",
        "github_repo": None,
        "type": "vendor",
        "queries": ["Doubao memory", "豆包 记忆", "豆包 用户偏好", "火山方舟 智能体记忆"],
    },
    {
        "name": "Zhipu GLM",
        "github_repo": None,
        "type": "vendor",
        "queries": ["GLM memory", "智谱 记忆", "智谱 智能体记忆", "ChatGLM personalization"],
    },
]

MARKET_QUERIES = [
    "AI agent memory product launch",
    "AI agent memory launch",
    "AI agent memory release",
    "new AI agent memory product",
    "LLM memory framework",
    "agent memory framework launch",
    "long term memory AI agent",
    "agent memory open source",
    "AI agent long-term memory open source launch",
    "site:github.com agent memory open source",
    "personal AI memory",
    "AI personalization memory",
    "LLM personalization memory",
    "saved memories AI assistant",
    "AI assistant saved memories",
    "AI assistant user preferences",
    "AI user preference memory",
    "workspace context AI assistant",
    "project context AI assistant",
    "persistent context AI agent",
    "agent state memory",
    "long running agent memory",
    "context cache AI agent",
    "context caching AI assistant",
    "memory layer AI agent",
    "memory retrieval AI agent",
    "personalized AI assistant memory",
    "ChatGPT Claude Gemini memory personalization",
    "OpenAI Anthropic Gemini agent memory",
    "Agent Memory Protocol release",
    "Agent Memory 发布",
    "AI Agent 记忆 产品 发布",
    "AI Agent 长期记忆 开源",
    "智能体 记忆 框架 发布",
    "智能体记忆 产品 发布",
    "个性化记忆 AI助手",
    "用户偏好 AI助手",
    "上下文缓存 AI助手",
    "项目上下文 AI助手",
    "持久化上下文 智能体",
    "智能体状态 记忆",
    "长期记忆 大模型 智能体",
]


def _ensure_query(db: Session, query: str, project_id: int | None = None) -> None:
    project_filter = SearchQuery.project_id.is_(None) if project_id is None else SearchQuery.project_id == project_id
    exists = (
        db.query(SearchQuery)
        .filter(project_filter, SearchQuery.query == query)
        .first()
    )
    if not exists:
        db.add(SearchQuery(project_id=project_id, query=query))


def seed_defaults(db: Session) -> None:
    for item in DEFAULT_PROJECTS:
        project = db.query(Project).filter(Project.name == item["name"]).first()
        if not project:
            project = Project(
                name=item["name"],
                github_repo=item["github_repo"] or None,
                type=item.get("type", "open_source"),
                priority=8 if item["name"] in {"mem0", "Tencent Agent Memory", "OpenAI", "Anthropic"} else 6,
            )
            db.add(project)
            db.flush()
        for query in item["queries"]:
            _ensure_query(db, query, project.id)

    for query in MARKET_QUERIES:
        _ensure_query(db, query)

    db.commit()
