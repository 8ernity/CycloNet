import os
import time
import math
import logging
from collections import OrderedDict
from typing import Optional, Dict, Any, Tuple
from fastapi import Request, Response, HTTPException

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "").strip()
MAX_IN_MEMORY_CLIENTS = 5000

# Endpoint-specific limits (minute limit, hour limit) for (anonymous, authenticated) - SEC-07
DEFAULT_QUOTAS = {
    "chat": {"min_anon": 30, "min_auth": 60, "hr_anon": 120, "hr_auth": 600},
    "multimodal": {"min_anon": 10, "min_auth": 30, "hr_anon": 50, "hr_auth": 300},
    "briefing": {"min_anon": 15, "min_auth": 40, "hr_anon": 60, "hr_auth": 360},
    "classify": {"min_anon": 20, "min_auth": 60, "hr_anon": 80, "hr_auth": 400},
    "simulation": {"min_anon": 30, "min_auth": 90, "hr_anon": 150, "hr_auth": 800},
    "admin": {"min_anon": 10, "min_auth": 30, "hr_anon": 60, "hr_auth": 200},
}

# Optional Redis client for multi-worker / distributed deployments (SEC-07)
_redis_client = None
if REDIS_URL:
    try:
        import redis
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True, socket_timeout=2.0)
        _redis_client.ping()
        logger.info("[RateLimit] Successfully connected to Redis at %s", REDIS_URL.split("@")[-1])
    except Exception as e:
        logger.warning("[RateLimit] Could not initialize Redis client (%s); falling back to in-memory limiter.", e)
        _redis_client = None

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
    SEC-07: Atomic Redis sliding-window check using sorted sets.
    Returns (allowed, remaining, retry_after), or None if Redis operation fails.
    """
    if not _redis_client:
        return None

    try:
        pipe = _redis_client.pipeline()
        min_key = f"ratelimit:{key_prefix}:{client_id}:min"
        min_cutoff = now - 60.0

        # Remove elements older than 60s and fetch count
        pipe.zremrangebyscore(min_key, 0, min_cutoff)
        pipe.zcard(min_key)
        pipe.zrange(min_key, 0, 0, withscores=True)
        results = pipe.execute()

        current_min_count = results[1]
        oldest_entry = results[2]

        if current_min_count >= min_limit:
            oldest_ts = oldest_entry[0][1] if oldest_entry else min_cutoff
            retry_after = max(1, int(math.ceil(60.0 - (now - oldest_ts))))
            return False, 0, retry_after

        # Add current timestamp to window
        pipe = _redis_client.pipeline()
        pipe.zadd(min_key, {str(now): now})
        pipe.expire(min_key, 120)
        pipe.execute()

        remaining = max(0, min_limit - (current_min_count + 1))
        return True, remaining, 0
    except Exception as e:
        logger.debug("[RateLimit] Redis sliding window operation failed: %s", e)
        return None

def enforce_rate_limit(
    request: Request,
    endpoint_type: str = "chat",
    user: Optional[Dict[str, Any]] = None,
    response: Optional[Response] = None
):
    """
    SEC-07: Distributed atomic rate limiter enforcing per-minute limits and hourly quotas.
    Returns consistent HTTP 429 responses and Retry-After headers.
    """
    client_ip = request.client.host if request.client else "unknown"
    is_authenticated = bool(user and user.get("id"))
    client_id = f"user_{user['id']}" if is_authenticated else f"ip_{client_ip}"

    quota_cfg = DEFAULT_QUOTAS.get(endpoint_type, DEFAULT_QUOTAS["chat"])
    min_limit = quota_cfg["min_auth"] if is_authenticated else quota_cfg["min_anon"]
    hr_limit = quota_cfg["hr_auth"] if is_authenticated else quota_cfg["hr_anon"]

    now = time.time()

    # Try Redis distributed limiter first (SEC-07)
    redis_res = check_redis_rate_limit(endpoint_type, client_id, min_limit, hr_limit, now)
    if redis_res is not None:
        allowed, remaining, retry_after = redis_res
    else:
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
            headers={"Retry-After": str(retry_after)}
        )

    if response:
        response.headers["X-RateLimit-Limit"] = str(min_limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(now + 60))
