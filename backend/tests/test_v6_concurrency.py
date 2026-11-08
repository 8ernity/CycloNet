import threading
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from app.core import inference_budget, rate_limit

def test_parallel_user_work_is_bounded(monkeypatch):
    monkeypatch.setattr(rate_limit,'ENVIRONMENT','test')
    request=SimpleNamespace(client=SimpleNamespace(host='fixture-concurrency'))
    barrier=threading.Barrier(8)
    release_all=threading.Event()
    def attempt(_):
        barrier.wait()
        try: release=inference_budget.acquire(request,None)
        except HTTPException as exc: return exc.status_code
        release_all.wait(2)
        release()
        return 200
    with ThreadPoolExecutor(max_workers=8) as pool:
        results=list(pool.map(attempt,range(8)))
    assert results.count(200)==2
    assert results.count(429)==6
    assert not inference_budget._users

def test_production_ai_budget_fails_closed(monkeypatch):
    monkeypatch.setattr(rate_limit,'ENVIRONMENT','production')
    monkeypatch.setattr(rate_limit,'_redis_client',None)
    with pytest.raises(HTTPException) as error:
        inference_budget.acquire(SimpleNamespace(client=None),{'id':'fixture'})
    assert error.value.status_code==503
