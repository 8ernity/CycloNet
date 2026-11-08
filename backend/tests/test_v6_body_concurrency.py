import asyncio
import pytest
from app.core.request_limits import RequestLimitsMiddleware


@pytest.mark.asyncio
@pytest.mark.parametrize('content_type,body,capacity', [
    (b'multipart/form-data; boundary=fixture', b'fixture', 4),
    (b'application/json', b'{}', 32),
])
async def test_parallel_upload_bodies_are_bounded_before_reading(content_type,body,capacity):
    entered=asyncio.Event();finish=asyncio.Event()
    async def app(scope,receive,send):
        entered.set()
        await finish.wait()
    middleware=RequestLimitsMiddleware(app)
    scope={'type':'http','method':'POST','path':'/api/classify',
           'headers':[(b'content-type',content_type)]}
    async def receive():return {'type':'http.request','body':body,'more_body':False}
    async def send(message):pass
    held=[]
    try:
        for _ in range(capacity):
            entered.clear()
            held.append(asyncio.create_task(middleware(scope,receive,send)))
            await asyncio.wait_for(entered.wait(),1)
        messages=[];read=False
        async def extra_receive():
            nonlocal read
            read=True
            return await receive()
        async def extra_send(message):messages.append(message)
        # Excess bodies must be rejected immediately, not buffered or queued.
        try:
            await asyncio.wait_for(middleware(scope,extra_receive,extra_send),.2)
        except asyncio.TimeoutError:pytest.fail('Unbounded upload admission')
        assert not read
        assert messages[0]['status']==429
    finally:
        finish.set()
        await asyncio.gather(*held)
    # All permits return when the request ends.
    await middleware(scope,receive,send)
