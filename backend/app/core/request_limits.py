"""Reject oversized bodies before FastAPI parses or invokes handlers."""
import json
import asyncio
from starlette.responses import JSONResponse

class RequestLimitsMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or scope.get('method') not in ('POST', 'PUT', 'PATCH'):
            return await self.app(scope, receive, send)
        headers = dict(scope.get('headers', []))
        content_type = headers.get(b'content-type', b'').lower().split(b';',1)[0].strip()
        is_json = not content_type or content_type == b'application/json' or content_type.endswith(b'+json')
        is_upload = b'multipart/form-data' in headers.get(b'content-type', b'').lower() and scope.get('path') in ('/api/classify', '/api/ai/analyze-multimodal')
        maximum = 16 * 1024 * 1024 if is_upload else 65536
        async def reject(code, detail):
            await JSONResponse({'detail':detail}, status_code=code)(scope, receive, send)
        try:
            if int(headers.get(b'content-length', b'0')) > maximum:
                return await reject(413, 'Request body exceeds allowed size')
        except ValueError:
            return await reject(400, 'Invalid Content-Length')
        body = bytearray()
        deadline = asyncio.get_running_loop().time() + 15
        while True:
            try:
                message = await asyncio.wait_for(receive(), timeout=max(0.001, deadline - asyncio.get_running_loop().time()))
            except asyncio.TimeoutError:
                return await reject(408, "Request body timed out")
            if message['type'] == 'http.disconnect':
                return
            body.extend(message.get('body', b''))
            if len(body) > maximum:
                return await reject(413, 'Request body exceeds allowed size')
            if not message.get('more_body'):
                break
        # Bodyless POST endpoints still reach their authentication dependency.
        # Payload-requiring endpoints let Pydantic reject an absent body.
        if is_json and body:
            try:
                value = json.loads(body)
                stack = [(value, 0)]
                while stack:
                    node, depth = stack.pop()
                    if depth > 8:
                        return await reject(400, 'JSON nesting exceeds allowed depth')
                    if isinstance(node, dict):
                        stack.extend((v, depth+1) for v in node.values())
                    elif isinstance(node, list):
                        stack.extend((v, depth+1) for v in node)
            except (ValueError, UnicodeError, RecursionError):
                return await reject(400, 'Malformed JSON')
        delivered = False
        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {'type':'http.request', 'body':bytes(body), 'more_body':False}
            return await receive()
        return await self.app(scope, replay, send)
