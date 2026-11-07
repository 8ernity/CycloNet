import time
import pytest
from unittest.mock import MagicMock, patch
from fastapi import Request, Response, HTTPException

from app.core import rate_limit
from app.core.rate_limit import (
    BoundedSlidingWindowLimiter,
    check_redis_rate_limit,
    enforce_rate_limit
)

def test_in_memory_sliding_window_enforces_limits_and_retry_after():
    limiter = BoundedSlidingWindowLimiter(max_clients=10)
    now = 1000.0

    # 3 requests allowed under a limit of 3
    for _ in range(3):
        allowed, remaining, retry_after = limiter.check_limit("client_1", min_limit=3, hr_limit=10, now=now)
        assert allowed is True

    # 4th request must be rejected
    allowed, remaining, retry_after = limiter.check_limit("client_1", min_limit=3, hr_limit=10, now=now)
    assert allowed is False
    assert remaining == 0
    assert retry_after > 0

    # Advance time by 61 seconds: requests should be allowed again
    allowed, remaining, retry_after = limiter.check_limit("client_1", min_limit=3, hr_limit=10, now=now + 61.0)
    assert allowed is True
    assert remaining == 2

def test_enforce_rate_limit_sets_response_headers():
    mock_request = MagicMock(spec=Request)
    mock_request.client.host = "192.168.1.100"
    response = Response()

    with patch.object(rate_limit, "_redis_client", None):
        enforce_rate_limit(mock_request, endpoint_type="chat", user=None, response=response)

    assert "X-RateLimit-Limit" in response.headers
    assert "X-RateLimit-Remaining" in response.headers
    assert "X-RateLimit-Reset" in response.headers

def test_rate_limit_fail_closed_in_production_when_redis_unavailable():
    mock_request = MagicMock(spec=Request)
    mock_request.client.host = "10.0.0.1"

    with patch.object(rate_limit, "ENVIRONMENT", "production"):
        with patch.object(rate_limit, "REDIS_FAIL_CLOSED", True):
            with patch.object(rate_limit, "_redis_client", None):
                with pytest.raises(HTTPException) as exc:
                    enforce_rate_limit(mock_request, endpoint_type="admin", user=None)
                assert exc.value.status_code == 503
                assert "fail-closed" in exc.value.detail.lower()

def test_redis_lua_script_uses_unique_members():
    mock_redis = MagicMock()
    # Mock Lua script returning allowed=True, remaining=29, retry_after=0
    mock_redis.eval.return_value = [1, 29, 0, "ok"]

    with patch.object(rate_limit, "_redis_client", mock_redis):
        res = check_redis_rate_limit("chat", "user_123", min_limit=30, hr_limit=120, now=1000.0)
        assert res == (True, 29, 0)
        # Verify eval was called with atomic Lua script
        assert mock_redis.eval.called
        args, kwargs = mock_redis.eval.call_args
        # Check ARGV member contains unique uuid pattern (args[7] is ARGV[4])
        unique_member = args[7]
        assert ":" in unique_member
