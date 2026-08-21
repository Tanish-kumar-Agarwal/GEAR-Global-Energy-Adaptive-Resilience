import os
import sys

from celery import Celery

# simulation/, graph/ and optimization/ live at the repository root, outside apps/api.
# The API adds this in main.py; the worker has its own entrypoint and needs it too.
_repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)

REDIS_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

celery_app = Celery(
    "gear_worker",
    broker=REDIS_URL,
    backend=CELERY_RESULT_BACKEND,
    include=["workers.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Both publishing and worker consumption follow this queue. Overriding it
    # (CELERY_TASK_QUEUE=gear_geo) lets a second API+worker pair run against the
    # same Redis without the default-queue workers stealing its jobs.
    task_default_queue=os.getenv("CELERY_TASK_QUEUE", "celery"),
)
