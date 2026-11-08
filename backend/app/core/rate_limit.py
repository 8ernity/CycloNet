import os
import time
import math
import logging
import uuid
from collections import OrderedDict
from typing import Optional, Dict, Any, Tuple
from fastapi import Request, Response, HTTPException

logger = logging.getLogger(__name__)

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
REDIS_URL = os.getenv("REDIS_URL", "").strip()
REDIS_FAIL_CLOSED = os.getenv("REDIS_FAIL_CLOSED", "false").lower() in ("true", "1", "yes")
MAX_IN_MEMORY_CLIENTS = 5000

# Endpoint-specific limits (minute limit, hour limit) for (anonymous, authenticated) - SEC-07 / FIX-01
DEFAULT_QUOTAS = {
    "websocket": {"min_anon": 20, "min_auth": 20, "hr_anon": 120, "hr_auth": 120},
    "chat": {"min_anon": 30, "min_auth": 60, "hr_anon": 120, "hr_auth": 600},
    "multimodal": {"min_anon": 10, "min_auth": 30, "hr_anon": 50, "hr_auth": 300},
    "briefing": {"min_anon": 15, "min_auth": 40, "hr_anon": 60, "hr_auth": 360},
    "classify": {"min_anon": 20, "min_auth": 60, "hr_anon": 80, "hr_auth": 400},
    "simulation": {"min_anon": 30, "min_auth": 90, "hr_anon": 150, "hr_auth": 800},
    "admin": {"min_anon": 10, "min_auth": 30, "hr_anon": 60, "hr_auth": 200},
}

# Optional Redis client for multi-worker / distributed deployments (SEC-07 / FIX-01)
_redis_client = None
if REDIS_URL:
    try:
        import redis
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True, socket_timeout=2.0)
        _redis_client.ping()
        logger.info("[RateLimit] Successfully connected to Redis at %s", REDIS_URL.split("@")[-1])
    except Exception as e:
        logger.warning("[RateLimit] Could not initialize Redis client (%s); fallback policy active.", e)
        # Keep a constructed client's connection pool: subsequent requests retry
        # after a transient startup outage. Production still fails closed until
        # an atomic Redis check succeeds. Invalid configuration leaves it None.

# FIX 01: Single atomic Redis Lua script evaluating both minute and hour sliding windows
# KEYS[1] = minute key, KEYS[2] = hour key
# ARGV[1] = now, ARGV[2] = min_limit, ARGV[3] = hr_limit, ARGV[4] = unique member, ARGV[5] = min_ttl, ARGV[6] = hr_ttl
ATOMIC_RATE_LIMIT_LUA = """
local min_key = KEYS[1]
local hr_key = KEYS[2]
local now = tonumber(ARGV[1])
local min_limit = tonumber(ARGV[2])
local hr_limit = tonumber(ARGV[3])
local member = ARGV[4]
local min_ttl = tonumber(ARGV[5])
local hr_ttl = tonumber(ARGV[6])

local min_cutoff = now - 60.0
local hr_cutoff = now - 3600.0

-- 1. Remove expired entries
redis.call('ZREMRANGEBYSCORE', min_key, '-inf', min_cutoff)
redis.call('ZREMRANGEBYSCORE', hr_key, '-inf', hr_cutoff)

-- 2. Count active entries
local min_count = redis.call('ZCARD', min_key)
local hr_count = redis.call('ZCARD', hr_key)

-- 3. Check minute limit
if min_count >= min_limit then
    local oldest = redis.call('ZRANGE', min_key, 0, 0, 'WITHSCORES')
    local retry_after = 60
    if oldest and #oldest >= 2 then
        local oldest_ts = tonumber(oldest[2])
        retry_after = math.max(1, math.ceil(60.0 - (now - oldest_ts)))
    end
    return {0, 0, retry_after, 'minute'}
end

-- 4. Check hour limit
if hr_count >= hr_limit then
    local oldest = redis.call('ZRANGE', hr_key, 0, 0, 'WITHSCORES')
    local retry_after = 3600
    if oldest and #oldest >= 2 then
        local oldest_ts = tonumber(oldest[2])
        retry_after = math.max(1, math.ceil(3600.0 - (now - oldest_ts)))
    end
    return {0, 0, retry_after, 'hour'}
end

-- 5. Add unique member to both windows atomically
redis.call('ZADD', min_key, now, member)
redis.call('ZADD', hr_key, now, member)

-- 6. Set TTLs
redis.call('EXPIRE', min_key, min_ttl)
redis.call('EXPIRE', hr_key, hr_ttl)

-- 7. Return success and remaining in minute window
local remaining_min = math.max(0, min_limit - (min_count + 1))
return {1, remaining_min, 0, 'ok'}
"""

class BoundedSlidingWindowLimiter:
    """
    SEC-07: Sliding-window rate limiter with active eviction and bounded memory.
    Prevents unbounded growth of keys associated with unique clients.
    """
    def __init__(self, max_clients: int = MAX_IN_MEMORY_CLIENTS):
        self.max_clients = max_clients
        self.minute_records: OrderedDict[str, list] = OrderedDict()
        self.hour_records: OrderedDict[str, list] = OrderedDict()

    def _evict_stale_records(self, record_dict: OrderedDict, cutoff: float):
        """Removes records older than cutoff and evicts LRU keys if over capacity."""
        keys_to_remove = []
        for key, timestamps in list(record_dict.items()):
            active = [t for t in timestamps if t > cutoff]
            if not active:
                keys_to_remove.append(key)
            else:
                record_dict[key] = active
        for k in keys_to_remove:
            record_dict.pop(k, None)

        while len(record_dict) > self.max_clients:
            record_dict.popitem(last=False)

    def check_limit(
        self,
        client_id: str,
        min_limit: int,
        hr_limit: int,
        now: float
    ) -> Tuple[bool, int, int]:
        """Returns (is_allowed, remaining_in_minute, retry_after)."""
        min_cutoff = now - 60.0
        hr_cutoff = now - 3600.0

        if len(self.minute_records) > self.max_clients * 0.9:
            self._evict_stale_records(self.minute_records, min_cutoff)
        if len(self.hour_records) > self.max_clients * 0.9:
            self._evict_stale_records(self.hour_records, hr_cutoff)

        # 1. Check minute sliding window
        min_ts = [t for t in self.minute_records.get(client_id, []) if t > min_cutoff]
        if len(min_ts) >= min_limit:
            retry_after = max(1, int(math.ceil(60.0 - (now - min_ts[0]))))
            return False, 0, retry_after

        # 2. Check hourly quota
        hr_ts = [t for t in self.hour_records.get(client_id, []) if t > hr_cutoff]
        if len(hr_ts) >= hr_limit:
            retry_after = max(1, int(math.ceil(3600.0 - (now - hr_ts[0]))))
            return False, 0, retry_after

        min_ts.append(now)
        hr_ts.append(now)
        self.minute_records[client_id] = min_ts
        self.hour_records[client_id] = hr_ts

        self.minute_records.move_to_end(client_id)
        self.hour_records.move_to_end(client_id)

        remaining = max(0, min_limit - len(min_ts))
        return True, remaining, 0

_in_memory_limiter = BoundedSlidingWindowLimiter()

def check_redis_rate_limit(
    key_prefix: str,
    client_id: str,
    min_limit: int,
    hr_limit: int,
    now: float
) -> Optional[Tuple[bool, int, int]]:
    """
    FIX 01: Atomic Redis sliding-window check using a single Lua script.
    Evaluates both minute and hour windows without race conditions.
    Returns (allowed, remaining, retry_after), or None if Redis is unavailable/fails.
    """
    if not _redis_client:
        return None

    try:
        min_key = f"ratelimit:{key_prefix}:{client_id}:min"
        hr_key = f"ratelimit:{key_prefix}:{client_id}:hr"
        request_member = f"{now:.6f}:{uuid.uuid4().hex[:8]}"

        result = _redis_client.eval(
            ATOMIC_RATE_LIMIT_LUA,
            2,
            min_key,
            hr_key,
            str(now),
            str(min_limit),
            str(hr_limit),
            request_member,
            "120",
            "7200"
        )
        if result and isinstance(result, (list, tuple)) and len(result) >= 3:
            allowed = bool(result[0])
            remaining = int(result[1])
            retry_after = int(result[2])
            return allowed, remaining, retry_after
        return None
    except Exception as e:
        logger.warning("[RateLimit] Atomic Redis rate check failed: %s", e)
        return None

def enforce_rate_limit(
    request: Request,
    endpoint_type: str = "chat",
    user: Optional[Dict[str, Any]] = None,
    response: Optional[Response] = None
):
    """
    SEC-07 & FIX-01: Distributed atomic rate limiter enforcing per-minute limits and hourly quotas.
    Returns consistent HTTP 429 responses and Retry-After headers.
    """
    client_ip = request.client.host if request.client else "unknown"
    is_authenticated = bool(user and user.get("id"))
    client_id = f"user_{user['id']}" if is_authenticated else f"ip_{client_ip}"

    quota_cfg = DEFAULT_QUOTAS.get(endpoint_type, DEFAULT_QUOTAS["chat"])
    min_limit = quota_cfg["min_auth"] if is_authenticated else quota_cfg["min_anon"]
    hr_limit = quota_cfg["hr_auth"] if is_authenticated else quota_cfg["hr_anon"]

    now = time.time()

    # Try Redis distributed limiter first (FIX 01)
    redis_res = check_redis_rate_limit(endpoint_type, client_id, min_limit, hr_limit, now)
    if redis_res is not None:
        allowed, remaining, retry_after = redis_res
    else:
        # In production with fail-closed policy enabled, reject if distributed Redis is down
        if ENVIRONMENT == "production":
            logger.error("[RateLimit] Redis unavailable in production with REDIS_FAIL_CLOSED=true; failing closed.")
            raise HTTPException(
                status_code=503,
                detail="Rate limiting service temporarily unavailable (fail-closed policy)."
            )

        # Fall back to bounded in-memory sliding window
        allowed, remaining, retry_after = _in_memory_limiter.check_limit(
            client_id=f"{endpoint_type}:{client_id}",
            min_limit=min_limit,
            hr_limit=hr_limit,
            now=now
        )

    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded for {endpoint_type}: limit is {min_limit} requests/minute. Try again in {retry_after}s.",
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": str(min_limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(int(now + retry_after))
            }
        )

    if response:
        response.headers["X-RateLimit-Limit"] = str(min_limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(now + 60))
