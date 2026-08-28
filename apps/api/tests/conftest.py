import os
import sys

# Ensure root and apps/api are in PYTHONPATH
root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
api_dir = os.path.join(root_dir, "apps", "api")
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

if "DATABASE_URL" not in os.environ:
    os.environ["DATABASE_URL"] = "sqlite://"

os.environ["JWT_SECRET_KEY"] = "test_jwt_secret_key_for_testing_purposes_only"
os.environ["CELERY_BROKER_URL"] = "memory://"
os.environ["CELERY_RESULT_BACKEND"] = "cache+memory://"

import pytest
from core.database import Base, engine
from workers.celery_app import celery_app

celery_app.conf.update(
    task_always_eager=True,
    task_eager_propagates=False,
    broker_url="memory://",
    result_backend="cache+memory://",
    broker_connection_retry_on_startup=False,
    broker_connection_max_retries=1
)

@pytest.fixture(scope="session", autouse=True)
def setup_api_test_database():
    """Ensure database schema is created on test database."""
    Base.metadata.create_all(bind=engine)
    yield
