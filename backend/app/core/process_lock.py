import os
import sys
import time
import json
import logging
import tempfile
from typing import Optional

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "").strip()
LOCK_KEY = "cyclonet:worker_leader_lock"
LOCK_TTL_SECONDS = 60

# BACK-02: Store lock in system temp directory, NEVER repository root
LOCK_FILE = os.path.join(tempfile.gettempdir(), "cyclonet_worker_leader.lock")

# Optional Redis client for multi-worker distributed coordination
_redis_client = None
if REDIS_URL:
    try:
        import redis
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True, socket_timeout=2.0)
    except Exception:
        _redis_client = None

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
    BACK-02: Ensures only a single background ingestion worker runs across multi-worker deployments.
    Supports Redis distributed locking with automatic fallback to system-tempfile locking.
    Returns True if this process acquired the leader lock, False if another worker holds it.
    """
    enabled_env = os.getenv("ENABLE_INGESTION_WORKER", "true").lower()
    if enabled_env in ("0", "false", "no", "disabled"):
        logger.info("[WorkerLock] Background ingestion worker explicitly disabled via ENABLE_INGESTION_WORKER.")
        return False

    current_pid = os.getpid()

    # 1. Distributed Redis Lock (BACK-02)
    if _redis_client:
        try:
            acquired = _redis_client.set(LOCK_KEY, str(current_pid), nx=True, ex=LOCK_TTL_SECONDS)
            if acquired:
                logger.info("[WorkerLock] Process %s acquired Redis distributed leader lock.", current_pid)
                return True
            else:
                current_leader = _redis_client.get(LOCK_KEY)
                logger.info("[WorkerLock] Process %s holds Redis leader lock. Process %s serves web traffic only.", current_leader, current_pid)
                return False
        except Exception as e:
            logger.warning("[WorkerLock] Redis lock attempt failed (%s); falling back to file lock.", e)

    # 2. Resilient System Tempfile Lock
    try:
        if os.path.exists(LOCK_FILE):
            try:
                with open(LOCK_FILE, "r") as f:
                    data = json.load(f)
                    locked_pid = data.get("pid")
                    last_heartbeat = data.get("heartbeat", 0)

                if locked_pid and is_pid_running(locked_pid) and (time.time() - last_heartbeat < 60):
                    logger.info("[WorkerLock] Process %s is running as leader. Worker %s will serve web traffic only.", locked_pid, current_pid)
                    return False
            except Exception:
                pass  # Stale or corrupt lock file

        with open(LOCK_FILE, "w") as f:
            json.dump({"pid": current_pid, "heartbeat": time.time(), "acquired_at": time.time()}, f)
        logger.info("[WorkerLock] Process %s acquired file leader lock at %s", current_pid, LOCK_FILE)
        return True
    except Exception as e:
        logger.warning("[WorkerLock] Could not evaluate worker leader lock (%s). Proceeding as leader.", e)
        return True

def update_worker_heartbeat():
    """Updates heartbeat for leader worker in Redis or tempfile."""
    current_pid = os.getpid()
    if _redis_client:
        try:
            val = _redis_client.get(LOCK_KEY)
            if val == str(current_pid):
                _redis_client.expire(LOCK_KEY, LOCK_TTL_SECONDS)
        except Exception:
            pass

    try:
        with open(LOCK_FILE, "w") as f:
            json.dump({"pid": current_pid, "heartbeat": time.time()}, f)
    except Exception:
        pass

def release_worker_leader_lock():
    """Releases the lock on process shutdown if owned by current process."""
    current_pid = os.getpid()
    if _redis_client:
        try:
            val = _redis_client.get(LOCK_KEY)
            if val == str(current_pid):
                _redis_client.delete(LOCK_KEY)
        except Exception:
            pass

    try:
        if os.path.exists(LOCK_FILE):
            with open(LOCK_FILE, "r") as f:
                data = json.load(f)
            if data.get("pid") == current_pid:
                os.remove(LOCK_FILE)
    except Exception:
        pass
