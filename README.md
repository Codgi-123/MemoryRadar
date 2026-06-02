# Memory Market Watcher

Agent Memory 市场动态采集器 MVP：通过 Serper 采集 Google Search / GitHub 动态，结构化事件，并用 LLM 生成每日中文日报。默认使用 SQLite，方便本地直接启动。

## 快速启动

1. 复制环境变量：

```bash
cp .env.example .env
```

2. 填入你的 Serper API key、GitHub token、OpenAI 或 Claude key。OpenAI 和 Claude 都支持配置 base URL，便于接第三方服务商。

3. 启动：

```bash
docker compose up --build
```

4. 打开：

- 前端管理台：http://localhost:3000
- 后端 API：http://localhost:8000/docs

## MVP 功能

- Dashboard：查看今日事件、项目、任务和最新日报
- Watchlist：管理重点项目和搜索词
- Events：查看、标记、筛选事件
- Reports：生成、查看、重新生成日报
- Jobs：手动触发每日采集总结
- Docker Compose：SQLite、Redis、API、Worker、Scheduler、Frontend

## 本地直接启动

后端：

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --port 8000
```

前端：

```bash
cd frontend
npm install
npm run dev
```

本地直接启动时，如果不跑 Redis 和 worker，仍然可以使用“仅采集”和“生成 / 重新生成日报”。“运行每日任务”和定时任务需要 Redis：

```bash
redis-server
cd backend
source .venv/bin/activate
celery -A app.worker.celery_app worker --loglevel=info
celery -A app.worker.celery_app beat --loglevel=info
```

## 默认追踪项目

- openviking
- mem0
- memos
- Tencent Agent Memory
