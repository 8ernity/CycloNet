import os
import jwt
import datetime
import pytest
import tempfile
from pathlib import Path

# Tests must never mutate a developer's persisted storm state or history.
_test_storage = tempfile.TemporaryDirectory(prefix='cyclonet-tests-')
os.environ['DATABASE_URL'] = 'sqlite:///' + (Path(_test_storage.name) / 'tests.db').as_posix()

# Ensure test environment variables are loaded prior to app imports
os.environ["ENVIRONMENT"] = "test"
os.environ["ADMIN_API_KEY"] = "test-remediation-admin-key-2026"
os.environ["JWT_SECRET_KEY"] = "test-remediation-secret-key-32byteslong!!"
os.environ["CLERK_SECRET_KEY"] = "test-clerk-secret-key"

from app.core import auth
from app.core.database import init_db

# Re-read environment variables in auth module for test runner
auth.ADMIN_API_KEY = os.environ["ADMIN_API_KEY"]
auth.JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]

@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Initializes database schema and seed records before running test suites."""
    init_db()
    yield
    from app.core.database import engine
    engine.dispose()


@pytest.fixture(autouse=True)
def isolate_active_storms():
    from app.core.database import SessionLocal
    from app.models.domain import ActiveCycloneState
    from app.services.live_ingestion import live_ingestion_service
    with SessionLocal.begin() as db:
        state = db.get(ActiveCycloneState, 'CURRENT_ACTIVE_SYSTEMS')
        state.systems_json = '[]'
        state.active_count = 0
    live_ingestion_service._in_memory_systems = []
    yield

def make_valid_test_token(sub: str = "user_test_123", role: str = "member", exp_minutes: int = 60) -> str:
    """Helper to generate signed, cryptographically valid tokens for test suites."""
    payload = {
        "sub": sub,
        "role": role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=exp_minutes),
        "nbf": datetime.datetime.utcnow() - datetime.timedelta(seconds=5),
        "iat": datetime.datetime.utcnow()
    }
    return jwt.encode(payload, auth.JWT_SECRET_KEY, algorithm="HS256")
