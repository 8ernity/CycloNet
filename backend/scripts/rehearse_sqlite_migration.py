"""Rehearse an offline SQLite backup import into disposable LOCAL PostgreSQL.

Never accepts a cloud URL or writes the source database. Imported records remain
in a new isolated schema for inspection. This is not a live migration command.
Run from backend: python -m scripts.rehearse_sqlite_migration --help
"""
import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
import time
import uuid

from sqlalchemy import MetaData, Table, create_engine, inspect, select, text
from sqlalchemy.engine import make_url

TABLES = ('cyclone_archive', 'classification_history', 'active_cyclone_state')
SCHEMA_PATTERN = r'(?:verify|rehearsal)_[0-9a-f]{32}'
BACKEND = Path(__file__).resolve().parents[1]


def file_hash(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def validate_target(value, *, allow_schema=False):
    """Pin the disposable Compose endpoint; reject URL-based host overrides."""
    url = make_url(value)
    if (url.get_backend_name() != 'postgresql'
            or url.host not in ('localhost', '127.0.0.1')
            or url.port != 55432 or url.database != 'cyclonet_test'
            or url.username != 'cyclonet_test'):
        raise ValueError('Only the disposable localhost:55432/cyclonet_test target is allowed')
    if url.query and not (allow_schema and set(url.query) == {'options'}
                         and isinstance(url.query['options'], str)
                         and re.fullmatch('-csearch_path=' + SCHEMA_PATTERN, url.query['options'])):
        raise ValueError('Target connection overrides are forbidden')
    return url.set(drivername='postgresql+psycopg2')


def backup_sqlite(source, destination):
    """Consistent SQLite backup API includes WAL data; source is opened read-only."""
    source, destination = Path(source).resolve(), Path(destination).resolve()
    if not source.is_file():
        raise FileNotFoundError('The source SQLite backup must already exist')
    # Exclusive creation: never clobber an existing backup, even on failure.
    with destination.open('xb'):
        pass
    deadline = time.monotonic() + 60

    def progress(status, remaining, total):
        if time.monotonic() > deadline:
            raise TimeoutError('SQLite backup exceeded its time limit')

    try:
        with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True, timeout=5)) as src:
            with closing(sqlite3.connect(destination, timeout=5)) as dst:
                src.backup(dst, pages=256, progress=progress, sleep=.1)
                if dst.execute('PRAGMA integrity_check').fetchone() != ('ok',):
                    raise ValueError('SQLite backup failed integrity verification')
    except Exception:
        destination.unlink(missing_ok=True)
        raise


def record_digest(connection, table):
    digest, count = hashlib.sha256(), 0
    rows = connection.execute(select(table).order_by(*table.primary_key.columns))
    while batch := rows.fetchmany(500):
        for row in batch:
            # Typed SQLAlchemy values normalize SQLite/PostgreSQL date handling.
            payload = json.dumps(dict(row._mapping), sort_keys=True, default=str,
                                 ensure_ascii=True, allow_nan=False).encode()
            digest.update(len(payload).to_bytes(8, 'big'))
            digest.update(payload)
            count += 1
    return count, digest.hexdigest()


def copy_verified_records(source, target):
    """Atomic, bounded copy; reject unknown fields instead of silently dropping them."""
    validate_target(target.url, allow_schema=True)
    if source.dialect.name != 'sqlite':
        raise ValueError('Source must be the offline SQLite copy')
    with source.connect() as src, target.begin() as dst:
        schema = dst.execute(text('SELECT current_schema()')).scalar()
        if not schema or not re.fullmatch(SCHEMA_PATTERN, schema):
            raise ValueError('Target must be a new isolated rehearsal schema')
        source_names = set(inspect(src).get_table_names()) - {'alembic_version'}
        target_names = set(inspect(dst).get_table_names()) - {'alembic_version'}
        if source_names != set(TABLES) or target_names != set(TABLES):
            raise ValueError('Unreviewed database schema; refusing partial migration')
        pairs = []
        for name in TABLES:
            source_table = Table(name, MetaData(), autoload_with=src)
            target_table = Table(name, MetaData(), autoload_with=dst)
            if (set(source_table.columns.keys()) != set(target_table.columns.keys())
                    or set(source_table.primary_key.columns.keys()) != set(target_table.primary_key.columns.keys())):
                raise ValueError('Unreviewed database schema; refusing field loss')
            pairs.append((source_table, target_table))
        # Fixed identifiers only; hold locks through verification and commit.
        dst.execute(text('LOCK TABLE cyclone_archive, classification_history, active_cyclone_state IN ACCESS EXCLUSIVE MODE'))
        for _, table in pairs:
            existing = dst.execute(select(table).limit(2)).mappings().all()
            if table.name == 'active_cyclone_state' and len(existing) == 1:
                row = existing[0]
                empty_seed = (row['id'] == 'CURRENT_ACTIVE_SYSTEMS' and row['active_count'] == 0
                              and row['systems_json'] == '[]' and row['fencing_generation'] == 0
                              and row['leader_token'] is None and row['last_sync'] is None)
                if empty_seed:
                    continue
            if existing:
                raise ValueError('Target must be empty except for the untouched migration seed')
        counts = {}
        for source_table, target_table in pairs:
            dst.execute(target_table.delete())
            rows = src.execute(select(source_table).order_by(*source_table.primary_key.columns))
            while batch := rows.fetchmany(500):
                dst.execute(target_table.insert(), [dict(row._mapping) for row in batch])
            expected = record_digest(src, source_table)
            actual = record_digest(dst, target_table)
            if actual != expected:
                raise ValueError('Record verification failed; transaction rolled back')
            counts[target_table.name] = actual[0]
        # Explicit source IDs do not advance a PostgreSQL serial sequence.
        dst.execute(text("SELECT setval(pg_get_serial_sequence('classification_history','id'), "
                         "GREATEST(COALESCE(MAX(id),1),1), COUNT(*) > 0) FROM classification_history"))
    # No identities, filenames, tokens, connection strings or row hashes in report.
    return {'verified': True, 'counts': counts, 'ownership_and_nulls': 'exact record comparison',
            'scope': 'isolated local rehearsal only; not a live migration'}


def migrate_copy(url):
    env = {**os.environ, 'ENVIRONMENT': 'test', 'DATABASE_URL': url}
    result = subprocess.run([sys.executable, '-m', 'alembic', 'upgrade', 'head'],
                            cwd=BACKEND, env=env, capture_output=True, timeout=120)
    if result.returncode:
        # Provider exceptions can include connection strings or source values.
        raise RuntimeError('Migration of isolated copy failed; no live data was changed')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True, help='Previously authorized offline SQLite export')
    parser.add_argument('--output-dir', type=Path, required=True, help='New private directory outside version control')
    args = parser.parse_args()
    url = validate_target(os.environ.get('TEST_POSTGRES_URL', ''))
    # Do not accidentally operate on an unrelated database on the same port.
    result = subprocess.run(['docker', 'inspect', 'cyclonet-v7-postgres-1'],
                            capture_output=True, check=True, timeout=15)
    container = json.loads(result.stdout)[0]
    if container['Config']['Labels'].get('com.docker.compose.project') != 'cyclonet-v7':
        raise ValueError('Disposable Compose project verification failed')
    output = args.output_dir.resolve()
    private_root = (BACKEND.parent / '.verification').resolve()
    if not output.is_relative_to(private_root) or output == private_root:
        raise ValueError('Backup output must be a new directory under ignored .verification')
    output.mkdir(mode=0o700, parents=True, exist_ok=False)
    backup = output / 'source.sqlite'
    backup_sqlite(args.source, backup)
    backup_hash = file_hash(backup)
    # Keep the verified backup unchanged; migrate only a second working copy.
    working = output / 'migrated.sqlite'
    backup_sqlite(backup, working)
    migrate_copy('sqlite:///' + working.as_posix())
    schema = 'rehearsal_' + uuid.uuid4().hex
    admin = create_engine(url, connect_args={'connect_timeout': 5})
    try:
        with admin.begin() as conn:
            conn.execute(text(f'CREATE SCHEMA {schema}'))
    finally:
        admin.dispose()
    isolated = url.update_query_dict({'options': '-csearch_path=' + schema})
    migrate_copy(isolated.render_as_string(hide_password=False))
    source = create_engine('sqlite:///' + working.as_posix())
    target = create_engine(isolated, connect_args={'connect_timeout': 5, 'options': f'-csearch_path={schema} -cstatement_timeout=15000'})
    try:
        report = copy_verified_records(source, target)
    finally:
        source.dispose()
        target.dispose()
    report.update({'backup_sha256': backup_hash, 'schema': schema,
                   'source_backup_unchanged': file_hash(backup) == backup_hash})
    (output / 'verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(json.dumps({'verified': False, 'error_type': type(exc).__name__,
                          'detail': 'Rehearsal failed; sensitive diagnostics are not printed.'}), file=sys.stderr)
        raise SystemExit(1)
