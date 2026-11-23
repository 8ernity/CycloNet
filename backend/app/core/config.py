"""Centralized environment loading and configuration helpers."""

import logging
import os
import re
from pathlib import Path

logger = logging.getLogger(__name__)
_ENV_KEY_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _parse_env_value(raw_value: str) -> str:
    value = raw_value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
        return value[1:-1]
    if " #" in value:
        value = value.split(" #", 1)[0].rstrip()
    return value


def load_local_env() -> Path | None:
    """Load key=value pairs from the first valid local .env file outside production."""
    if os.getenv("ENVIRONMENT", "").lower() == "production":
        return None
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
        except (OSError, UnicodeDecodeError) as exc:
            logger.warning("Unable to read environment file %s: %s", env_path, exc)
            continue
        for raw_line in content.splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            if line.startswith("export "):
                line = line[7:].lstrip()
            key, raw_value = line.split("=", 1)
            key = key.strip()
            if not _ENV_KEY_RE.match(key):
                continue
            if key not in os.environ:
                os.environ[key] = _parse_env_value(raw_value)
        return env_path
    return None
