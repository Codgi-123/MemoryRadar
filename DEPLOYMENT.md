# Docker Deployment

## 1. Configure

Copy the example environment file and fill in API keys:

```bash
cp .env.example .env
```

Important variables:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
DATABASE_URL=sqlite:///./data/memory_market.db
REDIS_URL=redis://redis:6379/0
```

For a server deployment, set `NEXT_PUBLIC_API_URL` to the browser-accessible API URL, and add the frontend domain to `CORS_ORIGINS`.

## 2. Start

```bash
docker compose up -d --build
```

Services:

- Frontend: http://localhost:3000
- API: http://localhost:8000
- Redis: internal only
- Worker: Celery worker for background jobs
- Scheduler: Celery beat for the daily run

Only run one `scheduler` instance, otherwise the daily report may be triggered more than once.

## 3. Initialize Baseline

After the first startup, run baseline collection from the frontend Jobs page, or call:

```bash
curl -X POST http://localhost:8000/api/jobs/backfill
```

Daily collection uses a 1-day Serper window. Baseline collection uses a 7-day window.

## 4. Logs

```bash
docker compose logs -f api
docker compose logs -f worker
docker compose logs -f scheduler
docker compose logs -f frontend
```

## 5. SQLite Backup

The SQLite database is stored in the `app_data` Docker volume at `/app/data/memory_market.db`.

Create a consistent backup:

```bash
docker compose exec api python - <<'PY'
import sqlite3
src = sqlite3.connect('/app/data/memory_market.db')
dst = sqlite3.connect('/app/data/memory_market.backup.db')
src.backup(dst)
dst.close()
src.close()
PY
```

Copy the backup out:

```bash
docker compose cp api:/app/data/memory_market.backup.db ./memory_market.backup.db
```
