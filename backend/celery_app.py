from celery import Celery
from config import settings

# Default broker; can be overridden via env
BROKER = getattr(settings, 'celery_broker_url', 'redis://localhost:6379/0')
BACKEND = getattr(settings, 'celery_result_backend', BROKER)

celery_app = Celery('perksu_tasks', broker=BROKER, backend=BACKEND)

# Optional: task serializer / result serializer
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
)

__all__ = ('celery_app',)
