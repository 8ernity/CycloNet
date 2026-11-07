import asyncio
import pytest
from unittest.mock import MagicMock, patch
from fastapi import Response

from app.core import process_lock
from app.core.process_lock import (
    acquire_worker_leader_lock,
    release_worker_leader_lock,
    update_worker_heartbeat,
    get_leader_generation,
    is_leader,
    step_leader_election
)
from app.main import health_ready

@pytest.fixture(autouse=True)
def cleanup_lock():
    release_worker_leader_lock()
    yield
    release_worker_leader_lock()

def test_leader_generation_increments_on_redis_acquisition():
    mock_redis = MagicMock()
    mock_redis.set.return_value = True
    mock_redis.incr.return_value = 5

    with patch.object(process_lock, "_redis_client", mock_redis):
        with patch.object(process_lock, "ENVIRONMENT", "development"):
            acquired = acquire_worker_leader_lock()
            assert acquired is True
            assert is_leader() is True
            assert get_leader_generation() == 5

@pytest.mark.asyncio
async def test_continuous_election_step_promotes_standby_worker():
    promoted = False
    async def on_promoted():
        nonlocal promoted
        promoted = True

    with patch.object(process_lock, "_is_leader", False):
        with patch.object(process_lock, "acquire_worker_leader_lock", return_value=True):
            is_lead = await step_leader_election(on_become_leader_coro=on_promoted)
            assert is_lead is True
            assert promoted is True

@pytest.mark.asyncio
async def test_continuous_election_step_demotes_on_heartbeat_failure():
    demoted = False
    async def on_demoted():
        nonlocal demoted
        demoted = True

    with patch.object(process_lock, "_is_leader", True):
        with patch.object(process_lock, "update_worker_heartbeat", return_value=False):
            is_lead = await step_leader_election(on_lose_leader_coro=on_demoted)
            assert is_lead is False
            assert demoted is True

def test_readiness_probe_returns_503_when_database_fails():
    resp = Response()
    with patch("app.main.SessionLocal") as mock_session_cls:
        mock_session_cls.side_effect = Exception("DB connection timeout")
        res = health_ready(resp)
        assert resp.status_code == 503
        assert res["status"] == "unready"
        assert res["database"] == "unreachable"

def test_readiness_probe_reports_leader_generation_and_readiness():
    resp = Response()
    mock_db = MagicMock()
    with patch("app.main.SessionLocal", return_value=mock_db):
        with patch.object(process_lock, "_is_leader", True):
            with patch.object(process_lock, "_leader_generation", 7):
                res = health_ready(resp)
                assert resp.status_code != 503
                assert res["status"] == "ready"
                assert res["database"] == "connected"
                assert res["is_worker_leader"] is True
                assert res["leader_generation"] == 7
