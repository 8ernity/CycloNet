"""Migration rehearsal must preserve ownership and fail without partial writes."""
import hashlib
import sqlite3
from pathlib import Path

import pytest
from alembic import command
from sqlalchemy import create_engine, text

from test_v5_infrastructure import infrastructure
from scripts.rehearse_sqlite_migration import backup_sqlite, copy_verified_records, validate_target


def source_database(tmp_path):
    from app.models.domain import Base
    path = tmp_path / 'source.sqlite'
    engine = create_engine('sqlite:///' + path.as_posix())
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO cyclone_archive(id,name,year,start_date) VALUES ('fixture','Fixture',2001,'2001-01-01')"))
        conn.execute(text("INSERT INTO classification_history(id,user_id,filename,confidence,timestamp) VALUES (41,'fixture-owner','fixture.png',NULL,'2001-01-01 03:00:00.000000')"))
        conn.execute(text("INSERT INTO active_cyclone_state(id,active_count,systems_json,fencing_generation,leader_token) VALUES ('CURRENT_ACTIVE_SYSTEMS',1,:systems,9,'fixture-token')"),
                     {'systems': '[{"id":"fixture","is_simulation":true}]'})
    return path, engine


def test_backup_is_consistent_readonly_and_never_overwrites(tmp_path):
    path, engine = source_database(tmp_path)
    engine.dispose()
    before = hashlib.sha256(path.read_bytes()).hexdigest()
    backup = tmp_path / 'backup.sqlite'
    backup_sqlite(path, backup)
    with sqlite3.connect(backup) as conn:
        assert conn.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        assert conn.execute('SELECT user_id FROM classification_history').fetchone()[0] == 'fixture-owner'
    assert hashlib.sha256(path.read_bytes()).hexdigest() == before
    with pytest.raises(FileExistsError):
        backup_sqlite(path, backup)
    with pytest.raises(FileNotFoundError):
        backup_sqlite(tmp_path / 'missing.sqlite', tmp_path / 'other.sqlite')
    assert not (tmp_path / 'other.sqlite').exists()


def test_backup_includes_committed_wal_records(tmp_path):
    source, backup = tmp_path / 'wal.sqlite', tmp_path / 'backup.sqlite'
    with sqlite3.connect(source) as writer:
        writer.execute('PRAGMA journal_mode=WAL')
        writer.execute('PRAGMA wal_autocheckpoint=0')
        writer.execute('CREATE TABLE records(id INTEGER PRIMARY KEY, value TEXT)')
        writer.execute("INSERT INTO records VALUES (1,'committed fixture')")
        writer.commit()
        assert Path(str(source) + '-wal').exists()
        backup_sqlite(source, backup)
        with sqlite3.connect(backup) as restored:
            assert restored.execute('SELECT value FROM records').fetchone() == ('committed fixture',)


def test_failed_backup_removes_only_its_new_partial_copy(tmp_path):
    source = tmp_path / 'corrupt.sqlite'
    source.write_bytes(b'not a SQLite database')
    destination = tmp_path / 'partial.sqlite'
    with pytest.raises(sqlite3.DatabaseError):
        backup_sqlite(source, destination)
    assert source.read_bytes() == b'not a SQLite database'
    assert not destination.exists()


@pytest.mark.parametrize('url', [
    'postgresql://user:password@cloud.example/cyclonet_test',
    'postgresql://user:password@localhost/production',
    'postgresql://user:password@localhost:5432/cyclonet_test',
    'postgresql://user:password@localhost:55432/cyclonet_test?host=cloud.example',
    'sqlite:///local.sqlite',
])
def test_rehearsal_rejects_non_disposable_targets(url):
    with pytest.raises(ValueError):
        validate_target(url)


def test_import_preserves_all_records_and_repairs_sequence(infrastructure, tmp_path):
    config, target, _, _ = infrastructure
    command.upgrade(config, 'head')
    _, source = source_database(tmp_path)
    try:
        report = copy_verified_records(source, target)
        assert report['verified'] is True
        assert report['counts'] == {'cyclone_archive': 1, 'classification_history': 1, 'active_cyclone_state': 1}
        with target.begin() as conn:
            assert conn.execute(text('SELECT user_id, confidence FROM classification_history')).one() == ('fixture-owner', None)
            assert conn.execute(text('SELECT fencing_generation, leader_token FROM active_cyclone_state')).one() == (9, 'fixture-token')
            assert conn.execute(text("INSERT INTO classification_history(user_id) VALUES ('next-owner') RETURNING id")).scalar() == 42
        # A second import cannot overwrite existing records.
        with pytest.raises(ValueError, match='empty'):
            copy_verified_records(source, target)
    finally:
        source.dispose()


def test_unknown_columns_rejected_before_copy(infrastructure, tmp_path):
    config, target, _, _ = infrastructure
    command.upgrade(config, 'head')
    _, source = source_database(tmp_path)
    try:
        with source.begin() as conn:
            conn.execute(text('ALTER TABLE classification_history ADD COLUMN unreviewed_data TEXT'))
        with pytest.raises(ValueError, match='schema'):
            copy_verified_records(source, target)
        with target.connect() as conn:
            assert conn.execute(text('SELECT COUNT(*) FROM cyclone_archive')).scalar() == 0
    finally:
        source.dispose()


def test_failed_import_rolls_back_every_table(infrastructure, tmp_path):
    config, target, _, _ = infrastructure
    command.upgrade(config, 'head')
    _, source = source_database(tmp_path)
    try:
        with source.begin() as conn:
            conn.execute(text("UPDATE classification_history SET filename=:invalid"), {'invalid': 'invalid\x00text'})
        with pytest.raises(Exception):
            copy_verified_records(source, target)
        with target.connect() as conn:
            assert conn.execute(text('SELECT COUNT(*) FROM cyclone_archive')).scalar() == 0
            assert conn.execute(text('SELECT active_count FROM active_cyclone_state')).scalar() == 0
    finally:
        source.dispose()
