"""Real service checks share the isolated-schema fixture, never production state."""
import json
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from alembic import command
from sqlalchemy import text
from fastapi import HTTPException
from app.core import inference_budget, rate_limit
from test_v5_infrastructure import infrastructure

def test_postgres_archive_index_and_bounded_page(infrastructure):
    config,engine,_,_=infrastructure
    command.upgrade(config,'head')
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO cyclone_archive(id,name,year,dates,start_date) SELECT 'fixture-'||n,'Fixture',2020,'Jan 1-2',date '2020-01-01'+(n%365) FROM generate_series(1,20000) n"))
        conn.execute(text('ANALYZE cyclone_archive'))
        plan=conn.execute(text('EXPLAIN (FORMAT JSON) SELECT id,start_date FROM cyclone_archive ORDER BY start_date DESC,id DESC LIMIT 25 OFFSET 100')).scalar()
        assert 'ix_archive_chronology' in json.dumps(plan)
        rows=conn.execute(text('SELECT id,start_date FROM cyclone_archive ORDER BY start_date DESC,id DESC LIMIT 25 OFFSET 100')).all()
        assert len(rows)==25
        assert rows==sorted(rows,key=lambda row:(row.start_date,row.id),reverse=True)

def test_real_redis_bounds_global_concurrency_and_releases_slots(infrastructure,monkeypatch):
    _,_,client,_=infrastructure
    prefix='cyclonet:v6:test:'+uuid.uuid4().hex
    monkeypatch.setattr(rate_limit,'_redis_client',client)
    monkeypatch.setattr(rate_limit,'ENVIRONMENT','production')
    monkeypatch.setattr(inference_budget,'KEY_PREFIX',prefix)
    start=threading.Barrier(16)
    finish=threading.Barrier(16)
    def attempt(index):
        start.wait()
        release=None
        try:
            release=inference_budget.acquire(SimpleNamespace(client=None),{'id':str(index)})
            code=200
        except HTTPException as exc:
            code=exc.status_code
        finish.wait()
        if release: release()
        return code
    try:
        with ThreadPoolExecutor(max_workers=16) as pool:
            results=list(pool.map(attempt,range(16)))
        assert results.count(200)==8
        assert results.count(429)==8
        assert client.zcard(prefix+':global')==0
        first=inference_budget.acquire(SimpleNamespace(client=None),{'id':'same-user'})
        second=inference_budget.acquire(SimpleNamespace(client=None),{'id':'same-user'})
        try:
            try: inference_budget.acquire(SimpleNamespace(client=None),{'id':'same-user'})
            except HTTPException as exc: assert exc.status_code==429
            else: raise AssertionError('Per-user concurrency limit bypassed')
        finally:
            first(); second()
    finally:
        keys=list(client.scan_iter(match='*'+prefix+'*'))
        if keys: client.delete(*keys)
