"""Read-only operational probe. A successful HTTP ping is not readiness evidence."""
import json
import os
import sys
import time
from urllib.request import Request, urlopen
from urllib.parse import urlsplit


def validate_readiness(payload):
    if not isinstance(payload, dict):
        return False
    return (payload.get('status') == 'ready' and payload.get('database') == 'connected'
            and payload.get('schema_current') is True and payload.get('authentication_configured') is True
            and payload.get('redis') == 'connected')


def check(url, *, ready=False):
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError('Monitoring URL must be a public HTTPS URL without credentials or query parameters')
    started = time.monotonic()
    with urlopen(Request(url, headers={'Accept': 'application/json' if ready else 'text/html'}), timeout=15) as response:
        if response.status != 200:
            return False, 0
        if ready:
            body = response.read(65537)
            if len(body) > 65536 or not validate_readiness(json.loads(body)):
                return False, 0
    return True, round((time.monotonic() - started) * 1000)


def main():
    checks = [('frontend', os.getenv('FRONTEND_URL', 'https://cyclonet-frontend.onrender.com') + '/login', False),
              ('backend_readiness', os.getenv('BACKEND_URL', 'https://cyclonet-backend.onrender.com') + '/health/ready', True)]
    results=[]
    for name, url, ready in checks:
        try:
            ok, duration = check(url, ready=ready)
            results.append({'check':name, 'ok':ok, 'duration_ms':duration})
        except Exception as exc:
            results.append({'check':name, 'ok':False, 'error_type':type(exc).__name__})
    print(json.dumps({'checks':results}))
    return 0 if all(row['ok'] for row in results) else 1


if __name__ == '__main__':
    sys.exit(main())
