import os
import sys
import time
import json
import logging
import tempfile
import uuid
import asyncio
from typing import Optional

logger = logging.getLogger(__name__)

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
REDIS_URL = os.getenv("REDIS_URL", "").strip()
LOCK_KEY = "cyclonet:worker_leader_lock"
LOCK_TTL_SECONDS = 60
HEARTBEAT_INTERVAL_SECONDS = 15

# BACK-02 & FIX-02: Unique random token for this process instance to prevent lease stealing
WORKER_TOKEN = f"{os.getpid()}_{uuid.uuid4().hex}"

# Store file lock in system temp directory for local single-node development only
LOCK_FILE = os.path.join(tempfile.gettempdir(), "cyclonet_worker_leader.lock")

# Optional Redis client for multi-worker distributed coordination
_redis_client = None
if REDIS_URL:
    try:
        import redis
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True, socket_timeout=2.0)
    except Exception as e:
        logger.warning("[WorkerLock] Could not initialize Redis client (%s).", e)
        _redis_client = None

# FIX 02: Atomic Redis Lua Scripts for Compare-and-Set / Compare-and-Delete
RENEW_LOCK_LUA = """
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('expire', KEYS[1], tonumber(ARGV[2]))
else
    return 0
end
"""

RELEASE_LOCK_LUA = """
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
else
    return 0
end
"""

_is_leader: bool = False

def is_leader() -> bool:
    """Returns True if the current process holds active leader status."""
    return _is_leader

def is_pid_running(pid: int) -> bool:
    """Checks if a process ID is currently running on the operating system."""
    if pid <= 0:
        return False
    if sys.platform == "win32":
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            handle = kernel32.OpenProcess(0x0400, False, pid)  # PROCESS_QUERY_INFORMATION
            if handle:
                kernel32.CloseHandle(handle)
                return True
            return False
        except Exception:
            return False
    else:
        try:
            os.kill(pid, 0)
            return True
        except (OSError, ProcessLookupError):
            return False

def acquire_worker_leader_lock() -> bool:
    """
    BACK-02 & FIX-02: Ensures only a single background ingestion worker runs across multi-worker deployments.
    Uses Redis SET NX EX with a unique worker token.
    Returns True if this process acquired the leader lock, False if another worker holds it.
    """
    global _is_leader
    enabled_env = os.getenv("ENABLE_INGESTION_WORKER", "true").lower()
    if enabled_env in ("0", "false", "no", "disabled"):
        logger.info("[WorkerLock] Background ingestion worker explicitly disabled via ENABLE_INGESTION_WORKER.")
        _is_leader = False
        return False

    current_pid = os.getpid()

    # 1. Distributed Redis Lock (FIX 02)
    if _redis_client:
        try:
            acquired = _redis_client.set(LOCK_KEY, WORKER_TOKEN, nx=True, ex=LOCK_TTL_SECONDS)
            if acquired:
                logger.info("[WorkerLock] Process %s acquired Redis distributed leader lock with token %s.", current_pid, WORKER_TOKEN)
                _is_leader = True
                return True
            else:
                current_leader = _redis_client.get(LOCK_KEY)
                logger.info("[WorkerLock] Leader lock held by %s. Process %s serves web traffic only.", current_leader, current_pid)
                _is_leader = False
                return False
        except Exception as e:
            logger.warning("[WorkerLock] Redis lock attempt failed (%s).", e)
            if ENVIRONMENT == "production":
                logger.error("[WorkerLock] In production, filesystem lock is forbidden as multi-instance coordination. Ingestion worker disabled.")
                _is_leader = False
                return False

    # In production without Redis, disallow multi-node file-lock fallback
    if ENVIRONMENT == "production":
        logger.warning("[WorkerLock] REDIS_URL not configured in production. Background leader election disabled.")
        _is_leader = False
        return False

    # 2. Resilient System Tempfile Lock (Development / Single-Node Fallback Only)
    try:
        if os.path.exists(LOCK_FILE):
            try:
                with open(LOCK_FILE, "r") as f:
                    data = json.load(f)
                    locked_pid = data.get("pid")
                    last_heartbeat = data.get("heartbeat", 0)

                if locked_pid and is_pid_running(locked_pid) and (time.time() - last_heartbeat < 60):
                    logger.info("[WorkerLock] Process %s is running as leader. Worker %s will serve web traffic only.", locked_pid, current_pid)
                    _is_leader = False
                    return False
            except Exception:
                pass  # Stale or corrupt lock file

        with open(LOCK_FILE, "w") as f:
            json.dump({"pid": current_pid, "token": WORKER_TOKEN, "heartbeat": time.time(), "acquired_at": time.time()}, f)
        logger.info("[WorkerLock] Process %s acquired local file leader lock at %s", current_pid, LOCK_FILE)
        _is_leader = True
        return True
    except Exception as e:
        logger.warning("[WorkerLock] Could not evaluate local file leader lock (%s).", e)
        _is_leader = True
        return True

def update_worker_heartbeat() -> bool:
    """
    FIX 02: Atomic lease renewal.
    Renews leader lease only if this process's unique WORKER_TOKEN matches the lock value.
    """
    global _is_leader
    if not _is_leader:
        return False

    current_pid = os.getpid()
    if _redis_client:
        try:
            res = _redis_client.eval(RENEW_LOCK_LUA, 1, LOCK_KEY, WORKER_TOKEN, str(LOCK_TTL_SECONDS))
            if int(res) == 1:
                return True
            else:
                logger.error("[WorkerLock] Redis leadership lost! Lock token mismatch or expired.")
                _is_leader = False
                return False
        except Exception as e:
            logger.warning("[WorkerLock] Error renewing Redis lock: %s", e)
            return False

    try:
        with open(LOCK_FILE, "w") as f:
            json.dump({"pid": current_pid, "token": WORKER_TOKEN, "heartbeat": time.time()}, f)
        return True
    except Exception:
        return False

async def run_worker_heartbeat_task(interval_seconds: int = HEARTBEAT_INTERVAL_SECONDS):
    """
    FIX 02: Separate background heartbeat task that continuously renews the lease
    every 15-20 seconds as long as this process remains the leader.
    """
    global _is_leader
    logger.info("[WorkerLock] Autonomous heartbeat task started (cadence: %ss, lease TTL: %ss).", interval_seconds, LOCK_TTL_SECONDS)
    while _is_leader:
        await asyncio.sleep(interval_seconds)
        if not _is_leader:
            break
        success = update_worker_heartbeat()
        if not success:
            logger.warning("[WorkerLock] Heartbeat lease renewal failed. Relinquishing leader status.")
            _is_leader = False
            break

def release_worker_leader_lock():
    """
    FIX 02: Releases the lock on process shutdown via atomic compare-and-delete Lua script.
    """
    global _is_leader
    _is_leader = False
    current_pid = os.getpid()

    if _redis_client:
        try:
            _redis_client.eval(RELEASE_LOCK_LUA, 1, LOCK_KEY, WORKER_TOKEN)
            logger.info("[WorkerLock] Safely released Redis leader lock with token %s.", WORKER_TOKEN)
        except Exception as e:
            logger.warning("[WorkerLock] Error releasing Redis leader lock: %s", e)

    try:
        if os.path.exists(LOCK_FILE):
            with open(LOCK_FILE, "r") as f:
                data = json.load(f)
            if data.get("token") == WORKER_TOKEN or data.get("pid") == current_pid:
                os.remove(LOCK_FILE)
    except Exception:
        pass
