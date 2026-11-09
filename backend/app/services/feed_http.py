"""Bound agency downloads before XML/HTML parsing, including decompressed bytes."""
import asyncio
import httpx

MAX_FEED_BYTES = 4 * 1024 * 1024


class FeedClient:
    def __init__(self, **kwargs):
        self.client = httpx.AsyncClient(**kwargs)

    async def __aenter__(self):
        await self.client.__aenter__()
        return self

    async def __aexit__(self, *args):
        return await self.client.__aexit__(*args)

    async def get(self, url, **kwargs):
        async with asyncio.timeout(20):
            for attempt in range(2):
                try:
                    async with self.client.stream('GET', url, **kwargs) as response:
                        if response.status_code in (429, 502, 503, 504) and attempt == 0:
                            await asyncio.sleep(0.25)
                            continue
                        content = bytearray()
                        async for chunk in response.aiter_bytes():
                            if len(content) + len(chunk) > MAX_FEED_BYTES:
                                raise ValueError('Agency response exceeds byte limit')
                            content.extend(chunk)
                        # Content is already decoded; don't apply compression a second time.
                        headers = {k:v for k,v in response.headers.items() if k.lower() not in ('content-encoding','content-length')}
                        return httpx.Response(response.status_code, headers=headers, content=bytes(content), request=response.request)
                except (httpx.TimeoutException, httpx.NetworkError):
                    if attempt:
                        raise
                    await asyncio.sleep(0.25)
