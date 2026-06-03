from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.settings import settings


def app_timezone() -> ZoneInfo:
    try:
        return ZoneInfo(settings.app_timezone)
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def app_now() -> datetime:
    return datetime.now(app_timezone())


def app_today() -> date:
    return app_now().date()


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)
