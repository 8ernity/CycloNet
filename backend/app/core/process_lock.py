import os
import sys
import time
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

LOCK_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "worker_leader.lock")

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
    Ensures that only a single background ingestion worker runs across multi-worker deployments.
    Fixes Problem #67 (Startup event spawns background workers in every process on multi-worker deployments).
    
    Returns True if this process acquired the leader lock, False if another active worker holds it.
    """
    # Check if background workers are explicitly disabled via environment
    enabled_env = os.getenv("ENABLE_INGESTION_WORKER", "true").lower()
    if enabled_env in ("0", "false", "no", "disabled"):
        logger.info("[WorkerLock] Background ingestion worker explicitly disabled via ENABLE_INGESTION_WORKER.")
        return False

    current_pid = os.getpid()

    try:
        if os.path.exists(LOCK_FILE):
            try:
                with open(LOCK_FILE, "r") as f:
                    data = json.load(f)
                    locked_pid = data.get("pid")
                    last_heartbeat = data.get("heartbeat", 0)

                # If the process is still running and updated heartbeat recently (< 60s), avoid spawning duplicate
                if locked_pid and is_pid_running(locked_pid) and (time.time() - last_heartbeat < 60):
                    logger.info("[WorkerLock] Process %s is already running as leader. Worker %s will serve web traffic only.", locked_pid, current_pid)
                    return False
            except Exception:
                pass  # Stale or corrupted lock file, proceed to acquire

        # Acquire lock
        with open(LOCK_FILE, "w") as f:
            json.dump({"pid": current_pid, "heartbeat": time.time(), "acquired_at": time.time()}, f)
        logger.info("[WorkerLock] Process %s acquired worker leader lock.", current_pid)
        return True
    except Exception as e:
        logger.warning("[WorkerLock] Could not evaluate worker leader lock (%s). Proceeding as leader.", e)
        return True

def update_worker_heartbeat():
    """Updates the heartbeat of the active leader worker."""
    try:
        with open(LOCK_FILE, "w") as f:
            json.dump({"pid": os.getpid(), "heartbeat": time.time()}, f)
    except Exception:
        pass

def release_worker_leader_lock():
    """Releases the lock on process shutdown if owned by current process."""
    try:
        if os.path.exists(LOCK_FILE):
            with open(LOCK_FILE, "r") as f:
                data = json.load(f)
            if data.get("pid") == os.getpid():
                os.remove(LOCK_FILE)
    except Exception:
        pass
