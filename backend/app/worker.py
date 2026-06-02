from celery import Celery
from celery.schedules import crontab

from app.db import SessionLocal, init_db
from app.services import run_daily_job
from app.settings import settings


celery_app = Celery("memory_market", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.timezone = settings.app_timezone
celery_app.conf.beat_schedule = {
    "daily-memory-market-run": {
        "task": "app.worker.daily_run",
        "schedule": crontab(hour=settings.daily_run_cron_hour, minute=settings.daily_run_cron_minute),
    }
}


@celery_app.task(name="app.worker.daily_run")
def daily_run() -> dict:
    init_db()
    db = SessionLocal()
    try:
        return run_daily_job(db)
    finally:
        db.close()
