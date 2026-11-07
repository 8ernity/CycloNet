"""One explicit browser-origin policy for HTTP and WebSocket clients."""
import ipaddress
import os
from urllib.parse import urlsplit


def normalize_origin(value: str, *, configuration: bool = False):
    try:
        parsed = urlsplit(value)
        if parsed.scheme not in ('http', 'https') or not parsed.hostname:
            return None
        if parsed.username is not None or parsed.password is not None or parsed.query or parsed.fragment:
            return None
        if parsed.path not in (('', '/') if configuration else ('',)):
            return None
        host = parsed.hostname.lower()
        port = parsed.port
        if any(char.isspace() for char in value):
            return None
        if ':' in host:
            host = f'[{host}]'
        default_port = 443 if parsed.scheme == 'https' else 80
        suffix = f':{port}' if port is not None and port != default_port else ''
        return f'{parsed.scheme}://{host}{suffix}'
    except (ValueError, TypeError):
        return None


def configured_origins():
    production = os.getenv('ENVIRONMENT', 'production').lower() == 'production'
    raw = os.getenv('ALLOWED_ORIGINS') or os.getenv('CORS_ORIGINS', '')
    candidates = raw.split(',') if raw.strip() else ['https://cyclonet-frontend.onrender.com']
    if not raw.strip() and not production:
        candidates += ['http://localhost:3000', 'http://127.0.0.1:3000']
    result = []
    for candidate in candidates:
        candidate = candidate.strip()
        if candidate == '*' and not production:
            result.append(candidate)
            continue
        origin = normalize_origin(candidate, configuration=True)
        if origin is None:
            continue
        host = urlsplit(origin).hostname
        try:
            local = ipaddress.ip_address(host).is_loopback
        except ValueError:
            local = host == 'localhost' or host.endswith('.localhost')
        if production and local:
            continue
        result.append(origin)
    return list(dict.fromkeys(result))
