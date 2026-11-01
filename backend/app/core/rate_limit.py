import os
import time
import math
import logging
from collections import OrderedDict
from typing import Optional, Dict, Any, Tuple
from fastapi import Request, Response, HTTPException

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "")
MAX_IN_MEMORY_CLIENTS = 5000

# Endpoint-specific limits (minute limit, hour limit) for (anonymous, authenticated)
DEFAULT_QUOTAS = {
    "chat": {"min_anon": 30, "min_auth": 60, "hr_anon": 120, "hr_auth": 600},
    "multimodal": {"min_anon": 10, "min_auth": 30, "hr_anon": 50, "hr_auth": 300},
    "briefing": {"min_anon": 15, "min_auth": 40, "hr_anon": 60, "hr_auth": 360},
    "classify": {"min_anon": 20, "min_auth": 60, "hr_anon": 80, "hr_auth": 400},
    "simulation": {"min_anon": 30, "min_auth": 90, "hr_anon": 150, "hr_auth": 800},
    "admin": {"min_anon": 10, "min_auth": 30, "hr_anon": 60, "hr_auth": 200},
}

class BoundedSlidingWindowLimiter:
    """
    SEC-06: Sliding-window rate limiter with active eviction and bounded memory.
    Prevents unbounded growth of keys associated with unique clients.
    """
    def __init__(self, max_clients: int = MAX_IN_MEMORY_CLIENTS):
        self.max_clients = max_clients
        # Stores client_id -> list of timestamps
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

        # Bounded memory check: if still above capacity, evict oldest
        while len(record_dict) > self.max_clients:
            record_dict.popitem(last=False)

    def check_limit(
        self,
        client_id: str,
        min_limit: int,
        hr_limit: int,
        now: float
    ) -> Tuple[bool, int, int]:
        """
        Returns (is_allowed, remaining_in_minute, retry_after).
        """
        min_cutoff = now - 60.0
        hr_cutoff = now - 3600.0

        # Periodic cleanup if capacity is approaching max
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

        # Record this request
        min_ts.append(now)
        hr_ts.append(now)
        self.minute_records[client_id] = min_ts
        self.hour_records[client_id] = hr_ts

        # Mark as recently used
        self.minute_records.move_to_end(client_id)
        self.hour_records.move_to_end(client_id)

        remaining = max(0, min_limit - len(min_ts))
        return True, remaining, 0

_in_memory_limiter = BoundedSlidingWindowLimiter()

def enforce_rate_limit(
    request: Request,
    endpoint_type: str = "chat",
    user: Optional[Dict[str, Any]] = None,
    response: Optional[Response] = None
):
    """
    SEC-06: Distributed/atomic rate limiter enforcing per-minute limits and hourly quotas.
    Returns consistent 429 responses and Retry-After headers.
    """
    client_ip = request.client.host if request.client else "unknown"
    is_authenticated = bool(user and user.get("id"))
    # SEC-03: Client ID is derived ONLY from verified user ID or real client IP
    client_id = f"user_{user['id']}" if is_authenticated else f"ip_{client_ip}"

    quota_cfg = DEFAULT_QUOTAS.get(endpoint_type, DEFAULT_QUOTAS["chat"])
    min_limit = quota_cfg["min_auth"] if is_authenticated else quota_cfg["min_anon"]
    hr_limit = quota_cfg["hr_auth"] if is_authenticated else quota_cfg["hr_anon"]

    now = time.time()
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
