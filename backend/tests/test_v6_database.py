import runpy
from unittest.mock import patch
import pytest
from sqlalchemy import create_engine, event
from fastapi.testclient import TestClient
from app.main import app
from app.core import database

def test_production_rejects_sqlite(monkeypatch):
    monkeypatch.setenv('ENVIRONMENT','production')
    monkeypatch.setenv('DATABASE_URL','sqlite:///:memory:')
    with pytest.raises(RuntimeError,match='PostgreSQL'):
        runpy.run_path('app/core/database.py')

def test_startup_does_not_mutate_schema(monkeypatch):
    monkeypatch.setenv('ENVIRONMENT', 'production')
    monkeypatch.setattr(database,'engine',create_engine('sqlite:///:memory:'))
    with patch('alembic.command.upgrade') as upgrade:
        with pytest.raises(RuntimeError,match='migration'):
            database.validate_schema()
        upgrade.assert_not_called()

def test_archive_page_is_bounded_in_database():
    statements=[]
    def capture(conn,cursor,statement,parameters,context,executemany):
        if 'cyclone_archive' in statement.lower(): statements.append(statement.upper())
    event.listen(database.engine,'before_cursor_execute',capture)
    try:
        assert TestClient(app).get('/api/history/search?limit=2&offset=1').status_code==200
    finally:
        event.remove(database.engine,'before_cursor_execute',capture)
    assert any('ORDER BY' in s and 'LIMIT' in s and 'OFFSET' in s for s in statements)
