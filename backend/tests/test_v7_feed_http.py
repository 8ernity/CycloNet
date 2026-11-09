import httpx
import pytest
from app.services.feed_http import FeedClient, MAX_FEED_BYTES


@pytest.mark.asyncio
async def test_oversized_chunked_feed_closes_stream_before_parser():
    class Stream(httpx.AsyncByteStream):
        closed = False
        async def __aiter__(self):
            yield b'x' * MAX_FEED_BYTES
            yield b'x'
            raise AssertionError('Read past byte limit')
        async def aclose(self):
            self.closed = True
    stream=Stream()
    transport=httpx.MockTransport(lambda request:httpx.Response(200,stream=stream))
    async with FeedClient(transport=transport) as client:
        with pytest.raises(ValueError,match='byte limit'):
            await client.get('https://agency.example/feed')
    assert stream.closed


@pytest.mark.asyncio
async def test_transient_provider_failure_retries_once_then_returns_failure():
    calls=[]
    def respond(request):
        calls.append(request)
        return httpx.Response(503,content=b'unavailable')
    async with FeedClient(transport=httpx.MockTransport(respond)) as client:
        response=await client.get('https://agency.example/feed')
    assert response.status_code==503
    assert len(calls)==2


@pytest.mark.asyncio
async def test_success_preserves_source_content():
    async with FeedClient(transport=httpx.MockTransport(lambda request:httpx.Response(200,text='<rss>source</rss>'))) as client:
        response=await client.get('https://agency.example/feed')
    assert response.text=='<rss>source</rss>'
