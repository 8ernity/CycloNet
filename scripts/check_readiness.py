"""Read-only operational probe. A successful HTTP ping is not readiness evidence."""
import json
import os
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


class ReadinessProbeError(RuntimeError):
    """Sanitized readiness failure reason suitable for CI diagnostics."""

    def __init__(self, reason: str, status_code: int | None = None):
        super().__init__(reason)
        self.reason = reason
        self.status_code = status_code


def validate_readiness(payload):
    if not isinstance(payload, dict):
        return False
    return (
        payload.get('status') == 'ready'
        and payload.get('database') == 'connected'
        and payload.get('schema_current') is True
        and payload.get('authentication_configured') is True
        and payload.get('redis') in ('connected', 'unavailable')
    )


def _classify_http_error(exc: HTTPError) -> ReadinessProbeError:
    routing = (exc.headers.get('x-render-routing') or '').lower() if exc.headers else ''
    if routing == 'suspend':
        return ReadinessProbeError('service_suspended', status_code=exc.code)
    if exc.code == 503:
        return ReadinessProbeError('service_unavailable', status_code=exc.code)
    return ReadinessProbeError(f'http_{exc.code}', status_code=exc.code)


def check(url, *, ready=False, retries=2):
    parsed = urlsplit(url)
    if (
        parsed.scheme != 'https'
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError('Monitoring URL must be a public HTTPS URL without credentials or query parameters')
    headers = {
        'Accept': 'application/json' if ready else '*/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CycloNet-Readiness/1.0',
    }
    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        try:
            started = time.monotonic()
            req = Request(url, headers=headers)
            with urlopen(req, timeout=30) as response:
                if response.status != 200:
                    raise ReadinessProbeError(f'unexpected_status_{response.status}', status_code=response.status)
                if ready:
                    body = response.read(65537)
                    if len(body) > 65536:
                        raise ReadinessProbeError('oversized_readiness_payload', status_code=response.status)
                    payload = json.loads(body)
                    if not validate_readiness(payload):
                        raise ReadinessProbeError('unready_payload', status_code=response.status)
            return True, round((time.monotonic() - started) * 1000)
        except HTTPError as exc:
            classified = _classify_http_error(exc)
            # Suspended services will not recover within short retry backoff
            if classified.reason == 'service_suspended':
                raise classified from exc
            last_exc = classified
        except (URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError) as exc:
            last_exc = ReadinessProbeError(type(exc).__name__)
        except ReadinessProbeError:
            raise
        if attempt < retries:
            time.sleep(5)
    if last_exc:
        raise last_exc
    return False, 0


def main():
    checks = [
        ('frontend', os.getenv('FRONTEND_URL', 'https://cyclonet-frontend.onrender.com') + '/manifest.json', False),
        ('backend_readiness', os.getenv('BACKEND_URL', 'https://cyclonet-backend.onrender.com') + '/health/ready', True),
    ]
    results = []
    for name, url, ready in checks:
        try:
            ok, duration = check(url, ready=ready)
            results.append({'check': name, 'ok': ok, 'duration_ms': duration})
        except ReadinessProbeError as exc:
            entry = {'check': name, 'ok': False, 'error_type': exc.reason}
            if exc.status_code is not None:
                entry['status_code'] = exc.status_code
            results.append(entry)
        except Exception as exc:
            results.append({'check': name, 'ok': False, 'error_type': type(exc).__name__})
    print(json.dumps({'checks': results}))
    return 0 if all(row['ok'] for row in results) else 1


if __name__ == '__main__':
    sys.exit(main())
