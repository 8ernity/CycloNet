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
_users = {}
_lock = threading.Lock()
KEY_PREFIX = "cyclonet:inference"
ACQUIRE = """
for i=1,2 do redis.call('ZREMRANGEBYSCORE',KEYS[i],'-inf',ARGV[1]) end
if redis.call('ZCARD',KEYS[1])>=8 or redis.call('ZCARD',KEYS[2])>=2 then return 0 end
for i=1,2 do redis.call('ZADD',KEYS[i],ARGV[2],ARGV[3]); redis.call('EXPIRE',KEYS[i],300) end
return 1
"""

def acquire(request, user):
    identity = user.get('id') if user else request.client.host if request.client else 'unknown'
    identity = hashlib.sha256(identity.encode()).hexdigest()
    client = rate_limit._redis_client
    if rate_limit.ENVIRONMENT == 'production':
        if client is None:
            raise HTTPException(503, 'Inference budget service unavailable')
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
            raise
        except Exception:
            raise HTTPException(503, 'Inference budget service unavailable')
        def release():
            try:
                for key in keys:
                    client.zrem(key, token)
            except Exception:
                logger.warning('inference_slot_release_failed')
        return release
    with _lock:
        if _users.get(identity, 0) >= 2 or not _local.acquire(blocking=False):
            raise HTTPException(429, 'Inference concurrency exceeded', headers={'Retry-After':'5'})
        _users[identity] = _users.get(identity, 0)+1
    def release():
        with _lock:
            _users[identity] -= 1
            if not _users[identity]:
                del _users[identity]
            _local.release()
    return release

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
