from celery import Celery
from celery.schedules import crontab

from app.db import SessionLocal, init_db
from app.services import run_daily_job, run_weekly_job
from app.settings import settings


celery_app = Celery("memory_market", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.timezone = settings.app_timezone
celery_app.conf.beat_schedule = {
    "daily-memory-market-run": {
        "task": "app.worker.daily_run",
        "schedule": crontab(hour=settings.daily_run_cron_hour, minute=settings.daily_run_cron_minute),
    },
    "weekly-memory-market-report": {
        "task": "app.worker.weekly_run",
        "schedule": crontab(
            day_of_week=settings.weekly_run_cron_day_of_week,
            hour=settings.weekly_run_cron_hour,
            minute=settings.weekly_run_cron_minute,
        ),
    },
}


@celery_app.task(name="app.worker.daily_run")
def daily_run() -> dict:
    init_db()
    db = SessionLocal()
    try:
        return run_daily_job(db)
    finally:
        db.close()


@celery_app.task(name="app.worker.weekly_run")
def weekly_run() -> dict:
    init_db()
    db = SessionLocal()
    try:
        return run_weekly_job(db)
    finally:
        db.close()
