"""Bound work across users and workers; keep slots until a thread really ends."""
import asyncio
import hashlib
import logging
import threading
import time
import uuid
from fastapi import HTTPException
from app.core import rate_limit

logger = logging.getLogger(__name__)
_local = threading.BoundedSemaphore(4)
_production_local = threading.BoundedSemaphore(8)
_users = {}
_lock = threading.Lock()
KEY_PREFIX = "cyclonet:inference"
ACQUIRE = """
for i=1,2 do redis.call('ZREMRANGEBYSCORE',KEYS[i],'-inf',ARGV[1]) end
if redis.call('ZCARD',KEYS[1])>=8 or redis.call('ZCARD',KEYS[2])>=2 then return 0 end
for i=1,2 do redis.call('ZADD',KEYS[i],ARGV[2],ARGV[3]); redis.call('EXPIRE',KEYS[i],300) end
return 1
"""

def acquire_local(identity, production=False):
    semaphore = _production_local if production else _local
    user_key = (production, identity)
    with _lock:
        if _users.get(user_key, 0) >= 2 or not semaphore.acquire(blocking=False):
            raise HTTPException(429, 'Inference concurrency exceeded', headers={'Retry-After':'5'})
        _users[user_key] = _users.get(user_key, 0)+1
    released = False
    def release():
        nonlocal released
        with _lock:
            if released:
                return
            released = True
            _users[user_key] -= 1
            if not _users[user_key]:
                del _users[user_key]
            semaphore.release()
    return release


def acquire(request, user):
    identity = user.get('id') if user else request.client.host if request.client else 'unknown'
    identity = hashlib.sha256(identity.encode()).hexdigest()
    client = rate_limit._redis_client
    if rate_limit.ENVIRONMENT == 'production':
        if client is None:
            raise HTTPException(503, 'Inference budget service unavailable')
        # Redis leases can expire or disappear while a native call is still alive.
        # Never let that enqueue unbounded work in this process.
        release_local = acquire_local(identity, production=True)
        keys = [KEY_PREFIX+':global', KEY_PREFIX+':user:'+identity]
        token = uuid.uuid4().hex
        try:
            now = time.time()
            budget = rate_limit.check_redis_rate_limit(KEY_PREFIX+':budget', 'all', 40, 400, now)
            if budget is None:
                raise HTTPException(503, 'Inference budget service unavailable')
            if not budget[0] or not client.eval(ACQUIRE, 2, *keys, now, now+300, token):
                logger.warning('inference_throttled')
                raise HTTPException(429, 'Inference budget exceeded', headers={'Retry-After':'30'})
        except HTTPException:
            release_local()
            raise
        except Exception:
            release_local()
            raise HTTPException(503, 'Inference budget service unavailable')
        def release():
            try:
                for key in keys:
                    client.zrem(key, token)
            except Exception:
                logger.warning('inference_slot_release_failed')
            finally:
                release_local()
        return release
    return acquire_local(identity)

async def run_inference(request, user, function, *args, **kwargs):
    release = acquire(request, user)
    def invoke():
        try:
            return function(*args, **kwargs)
        finally:
            release()
    task = asyncio.create_task(asyncio.to_thread(invoke))
    task.add_done_callback(lambda done: done.exception() if not done.cancelled() else None)
    try:
        return await asyncio.wait_for(asyncio.shield(task), timeout=60)
    except asyncio.TimeoutError:
        logger.warning('inference_timeout')
        raise HTTPException(504, 'Inference timed out')
