"""Bounded structured request records without headers, identities, or raw URLs."""
import json
import logging
import time
import uuid
from datetime import datetime, timezone

logger = logging.getLogger('cyclonet.requests')
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter('%(message)s'))
    logger.addHandler(handler)
logger.propagate = False


class RequestObservabilityMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        request_id = uuid.uuid4().hex
        scope.setdefault('state', {})['request_id'] = request_id
        started = time.monotonic()
        status_code = 500

        async def response(message):
            nonlocal status_code
            if message['type'] == 'http.response.start':
                status_code = message['status']
                message = {**message, 'headers': [*message.get('headers', []),
                           (b'x-request-id', request_id.encode('ascii'))]}
            await send(message)

        try:
            await self.app(scope, receive, response)
        finally:
            route = getattr(scope.get('route'), 'path', 'unmatched')
            # Route templates exclude IDs, names, query strings and arbitrary paths.
            logger.info(json.dumps({'event': 'http_request', 'request_id': request_id,
                'time': datetime.now(timezone.utc).isoformat(), 'route': route,
                'method': scope['method'] if scope['method'] in {'GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD'} else 'OTHER',
                'status': status_code, 'duration_ms': round((time.monotonic()-started)*1000, 2)}))
