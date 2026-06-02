from sqlalchemy.orm import Session

from app.models import Project, SearchQuery


DEFAULT_PROJECTS = [
    {
        "name": "openviking",
        "github_repo": "volcengine/OpenViking",
        "queries": ["openviking agent memory", "openviking AI memory"],
    },
    {
        "name": "mem0",
        "github_repo": "mem0ai/mem0",
        "queries": ["mem0 AI memory", "mem0 agent memory", "mem0 memory platform"],
    },
    {
        "name": "memos",
        "github_repo": "MemTensor/MemOS",
        "queries": ["memos AI memory", "memos agent memory", "memos open source memory"],
    },
    {
        "name": "Tencent Agent Memory",
        "github_repo": "Tencent/TencentDB-Agent-Memory",
        "queries": ["Tencent Agent Memory", "腾讯 Agent Memory", "Tencent AI agent memory"],
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
    "Agent Memory Protocol release",
    "Agent Memory 发布",
    "AI Agent 记忆 产品 发布",
    "AI Agent 长期记忆 开源",
    "智能体 记忆 框架 发布",
]


def seed_defaults(db: Session) -> None:
    if db.query(Project).count() == 0:
        for item in DEFAULT_PROJECTS:
            project = Project(
                name=item["name"],
                github_repo=item["github_repo"] or None,
                type="open_source",
                priority=8 if item["name"] in {"mem0", "Tencent Agent Memory"} else 6,
            )
            db.add(project)
            db.flush()
            for query in item["queries"]:
                db.add(SearchQuery(project_id=project.id, query=query))

    for query in MARKET_QUERIES:
        exists = db.query(SearchQuery).filter(SearchQuery.project_id.is_(None), SearchQuery.query == query).first()
        if not exists:
            db.add(SearchQuery(project_id=None, query=query))

    db.commit()
