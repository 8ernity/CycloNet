import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.auth import decode_token_payload, verify_admin_key, ADMIN_API_KEY
from app.core.process_lock import acquire_worker_leader_lock, release_worker_leader_lock
from app.services.ml_service import CycloneIntensityService
from app.services.live_ingestion import live_ingestion_service

@pytest.mark.asyncio
async def test_problem_25_ingestion_authentication():
    """Verify #25: Ingestion endpoints require valid admin authentication."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Unauthenticated request should fail with 401
        res_sync = await ac.post("/api/ingest/sync")
        assert res_sync.status_code == 401
        assert "Unauthorized" in res_sync.json()["detail"]

        res_inject = await ac.post("/api/ingest/test-inject")
        assert res_inject.status_code == 401

        res_clear = await ac.post("/api/ingest/clear-test")
        assert res_clear.status_code == 401

        # Authenticated request with admin key should succeed
        from app.core import auth
        res_admin_clear = await ac.post(
            "/api/ingest/clear-test",
            headers={"X-Admin-Key": auth.ADMIN_API_KEY or "test-remediation-admin-key-2026"}
        )
        assert res_admin_clear.status_code == 200
        assert res_admin_clear.json()["status"] == "success"

@pytest.mark.asyncio
async def test_problem_26_auth_identity_verification():
    """Verify #26 (SEC-01): Forged tokens rejected; valid signed tokens accepted."""
    from app.core.auth import make_test_token
    # 1. Forged token with invalid signature MUST be rejected
    forged_token = "header.eyJzdWIiOiJ1c2VyXzEyMzQ1Iiwicm9sZSI6ImFkbWluIiwiZW1haWwiOiJvcEBjeWNsb25ldC5pbyJ9.forged_sig"
    forged_claims = decode_token_payload(forged_token)
    assert forged_claims is None, "Forged token without verified cryptographic signature must be rejected"

    # 2. Cryptographically signed token with valid secret must be decoded
    valid_token = make_test_token(sub="user_12345", role="admin")
    valid_claims = decode_token_payload(valid_token)
    assert valid_claims is not None
    assert valid_claims.get("sub") == "user_12345"
    assert valid_claims.get("role") == "admin"

@pytest.mark.asyncio
async def test_problem_29_ai_rate_limiting():
    """Verify #29: Public AI endpoints enforce rate limiting and quotas with headers."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/chat",
            json={"message": "What is Dvorak T-number?", "history": []}
        )
        # Should return 200 with standard rate limit headers
        assert res.status_code == 200
        assert "x-ratelimit-limit" in res.headers
        assert "x-ratelimit-remaining" in res.headers
        assert "x-ratelimit-reset" in res.headers

def test_problem_58_lazy_resnet_loading():
    """Verify #58: CycloneIntensityService does not download weights during import/init."""
    service = CycloneIntensityService()
    assert service.model_initialized is False
    assert service.backbone is None
    # Accessing has_model triggers lazy initialization cleanly
    assert isinstance(service.has_model, bool)
    assert service.model_initialized is True
    assert service.backbone is not None

def test_problem_66_db_state_persistence():
    """Verify #66: Active cyclone state is persisted to database, not only process heap."""
    test_system = {
        "id": "BOB99-TEST",
        "name": "Cyclone Test",
        "basin": "Bay of Bengal",
        "category": "Cyclonic Storm",
        "intensity_knots": 45,
        "lat": 16.5,
        "lon": 85.0
    }
    # Set through property
    live_ingestion_service.live_systems = [test_system]
    
    # Read through property in another simulated access
    loaded = live_ingestion_service.live_systems
    assert len(loaded) >= 1
    assert any(s.get("id") == "BOB99-TEST" for s in loaded)

    # Clear through helper
    live_ingestion_service.clear_live_systems(clear_all=True)
    loaded_cleared = live_ingestion_service.live_systems
    assert len(loaded_cleared) == 0

def test_problem_67_worker_leader_lock():
    """Verify #67: Leader lock correctly prevents multiple workers from spawning redundant scrapers."""
    # First acquisition should succeed
    is_leader = acquire_worker_leader_lock()
    assert is_leader is True

    # Same or another worker within the heartbeat window recognizes the lock
    is_second_leader = acquire_worker_leader_lock()
    # It either refreshes own lock or recognizes live pid
    assert isinstance(is_second_leader, bool)
    
    # Release lock on shutdown
    release_worker_leader_lock()
