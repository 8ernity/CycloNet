import threading
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from app.core import inference_budget, rate_limit
from unittest.mock import Mock

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


def test_expired_redis_leases_cannot_admit_unbounded_local_work(monkeypatch):
    # Redis has forgotten old leases while the native worker calls are still alive.
    redis=Mock()
    redis.eval.return_value=1
    monkeypatch.setattr(rate_limit,'ENVIRONMENT','production')
    monkeypatch.setattr(rate_limit,'_redis_client',redis)
    monkeypatch.setattr(rate_limit,'check_redis_rate_limit',lambda *args:(True,1,0,'minute'))
    held=[]
    try:
        for i in range(8):held.append(inference_budget.acquire(SimpleNamespace(client=None),{'id':str(i)}))
        with pytest.raises(HTTPException) as error:
            extra=inference_budget.acquire(SimpleNamespace(client=None),{'id':'overflow'})
            held.append(extra)
        assert error.value.status_code==429
    finally:
        for release in held:release()


@pytest.mark.parametrize('budget', [None, (False,0,0,'minute')])
def test_failed_distributed_admission_returns_local_slot(monkeypatch, budget):
    monkeypatch.setattr(rate_limit,'ENVIRONMENT','production')
    monkeypatch.setattr(rate_limit,'_redis_client',Mock())
    monkeypatch.setattr(rate_limit,'check_redis_rate_limit',lambda *args:budget)
    for _ in range(12):
        with pytest.raises(HTTPException):
            inference_budget.acquire(SimpleNamespace(client=None),{'id':'denied'})
    assert not inference_budget._users


def test_expired_redis_user_leases_do_not_erase_running_user_work(monkeypatch):
    redis=Mock();redis.eval.return_value=1
    monkeypatch.setattr(rate_limit,'ENVIRONMENT','production')
    monkeypatch.setattr(rate_limit,'_redis_client',redis)
    monkeypatch.setattr(rate_limit,'check_redis_rate_limit',lambda *args:(True,1,0,'minute'))
    held=[]
    try:
        for _ in range(2):held.append(inference_budget.acquire(SimpleNamespace(client=None),{'id':'same'}))
        with pytest.raises(HTTPException) as error:
            held.append(inference_budget.acquire(SimpleNamespace(client=None),{'id':'same'}))
        assert error.value.status_code==429
    finally:
        for release in held:release()
