from unittest.mock import patch, PropertyMock
from fastapi.testclient import TestClient
from app.main import app
from app.core import database
from app.services import feed_policy
from app.services.live_ingestion import live_ingestion_service
from sqlalchemy import event


def test_catalog_cannot_call_stale_records_live():
    with patch.object(type(live_ingestion_service), 'live_systems', new_callable=PropertyMock) as systems:
        systems.return_value=[{'id':'source-id','name':'Source','reconciliation_status':'ACTIVE_STALE','is_stale':True}]
        data=TestClient(app).get('/api/cyclones').json()
    record=next(row for row in data if row['id']=='source-id')
    assert record['is_live'] is False
    assert record['dates'] != 'Current Active'


def test_catalog_query_has_database_limit():
    statements=[]
    def capture(conn,cursor,statement,parameters,context,executemany):
        if 'cyclone_archive' in statement.lower(): statements.append(statement.upper())
    event.listen(database.engine,'before_cursor_execute',capture)
    try:
        assert TestClient(app).get('/api/cyclones?limit=2').status_code==200
    finally:
        event.remove(database.engine,'before_cursor_execute',capture)
    assert any('LIMIT' in s for s in statements)


def test_malformed_provider_timestamp_is_unknown():
    for value in [42, {}, [], True]:
        assert feed_policy.parse_time(value) is None


def test_catalog_retains_explicit_drill_provenance():
    records=TestClient(app).get('/api/cyclones').json()
    drill=next(record for record in records if record['id']=='BOB05-2026')
    assert drill['is_simulation'] is True


def test_registered_drill_track_cannot_be_presented_as_historical_measurement():
    from app.services.best_tracks import get_cyclone_trajectory
    drill=get_cyclone_trajectory('BOB05-2026','Deep Depression (BOB-05)','Bay of Bengal','Deep Depression')
    assert drill['is_simulation'] is True
    assert drill['is_measured_observation'] is False
    assert all(point['is_observed'] is False for point in drill['track_forecast'])
    assert 'Official IMD' not in drill['track_generation_method']
