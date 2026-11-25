"""Centralized environment loading and configuration helpers."""

import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def load_local_env() -> Optional[Path]:
    """Load key=value pairs from the first existing .env file without overriding set env vars."""
    backend_dir = Path(__file__).resolve().parents[2]
    repo_root = backend_dir.parent
    search_paths = [
        Path(".env"),
        backend_dir / ".env",
        repo_root / ".env",
    ]
    for env_path in search_paths:
        if not env_path.is_file():
            continue
        try:
            content = env_path.read_text(encoding="utf-8")
        except OSError as exc:
            logger.warning("Unable to read environment file %s: %s", env_path, exc)
            continue
        for raw_line in content.splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip("'\"")
            if key and key not in os.environ:
                os.environ[key] = value
        return env_path
    return None
