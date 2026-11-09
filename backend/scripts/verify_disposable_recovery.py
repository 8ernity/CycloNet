"""Local destructive exercise ONLY for the dedicated cyclonet-v7 Compose project.

Creates isolated fixture databases, dumps/restores them, restarts that disposable
Postgres container, and checks identical records. Never accepts a production URL.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import uuid
from sqlalchemy import create_engine, text

CONTAINER = 'cyclonet-v7-postgres-1'
BASE_URL = 'postgresql+psycopg2://cyclonet_test:local-test-only@localhost:55432/'
ROOT = Path(__file__).resolve().parents[2]


def docker(*args, **kwargs):
    return subprocess.run(['docker', *args], check=True, capture_output=True, **kwargs)


def snapshot(engine):
    tables = ['alembic_version','cyclone_archive','classification_history','active_cyclone_state']
    result={}
    with engine.connect() as conn:
        for table in tables:
            rows=[tuple(row) for row in conn.execute(text(f'SELECT * FROM {table} ORDER BY 1'))]
            result[table]={'count':len(rows),'sha256':hashlib.sha256(json.dumps(rows,default=str).encode()).hexdigest()}
    return result


def main():
    info=json.loads(docker('inspect',CONTAINER).stdout)[0]
    if info['Config']['Labels'].get('com.docker.compose.project') != 'cyclonet-v7':
        raise RuntimeError('Refusing a container outside the disposable verification project')
    suffix=uuid.uuid4().hex[:12]
    source,restored='v7_source_'+suffix,'v7_restore_'+suffix
    admin=create_engine(BASE_URL+'postgres',isolation_level='AUTOCOMMIT')
    with admin.connect() as conn:
        for name in [source,restored]:
            conn.execute(text(f'CREATE DATABASE {name}'))
    admin.dispose()
    env={**os.environ,'ENVIRONMENT':'test','DATABASE_URL':BASE_URL+source}
    started=time.monotonic()
    subprocess.run([sys.executable,'-m','alembic','upgrade','head'],cwd=ROOT/'backend',env=env,check=True,capture_output=True)
    source_engine=create_engine(BASE_URL+source)
    with source_engine.begin() as conn:
        conn.execute(text("INSERT INTO cyclone_archive(id,name,year,start_date) VALUES ('recovery-fixture','Synthetic recovery fixture',2000,'2000-01-01')"))
        conn.execute(text("INSERT INTO classification_history(user_id,filename,predicted_category,confidence) VALUES ('fixture-owner','fixture.png','UNVALIDATED',NULL)"))
        conn.execute(text("UPDATE active_cyclone_state SET active_count=1, systems_json=:systems,fencing_generation=7"),
                     {'systems':json.dumps([{'id':'recovery-fixture','is_simulation':True}])})
    expected=snapshot(source_engine)
    backup=docker('exec',CONTAINER,'pg_dump','-U','cyclonet_test','-d',source,'-Fc').stdout
    (ROOT/'.verification/v7-recovery.dump').write_bytes(backup)
    docker('exec','-i',CONTAINER,'pg_restore','-U','cyclonet_test','-d',restored,'--exit-on-error',input=backup)
    restored_engine=create_engine(BASE_URL+restored)
    assert snapshot(restored_engine)==expected
    # Migration rollback/re-upgrade on the restored copy, never on the source.
    restored_env={**env,'DATABASE_URL':BASE_URL+restored}
    for operation,revision in [('downgrade','7ebcad6e592b'),('upgrade','head')]:
        subprocess.run([sys.executable,'-m','alembic',operation,revision],cwd=ROOT/'backend',env=restored_env,check=True,capture_output=True)
    # The fencing migration is intentionally reconstructed on re-upgrade; record
    # retention is checked independently from those migration-owned defaults.
    after_migration=snapshot(restored_engine)
    for table in ['cyclone_archive','classification_history']:
        assert after_migration[table]==expected[table]
    source_engine.dispose();restored_engine.dispose()
    docker('restart',CONTAINER)
    for attempt in range(60):
        try:
            assert snapshot(source_engine)==expected
            assert snapshot(restored_engine)==after_migration
            break
        except Exception:
            if attempt==59: raise
            time.sleep(.5)
    report={'scope':'disposable localhost fixtures, not production backup evidence',
            'backup_bytes':len(backup),'backup_sha256':hashlib.sha256(backup).hexdigest(),
            'restored_records':expected,'restore_equal':True,'restart_persistent':True,
            'history_survives_migration_rollback':True,'elapsed_seconds':round(time.monotonic()-started,2)}
    (ROOT/'docs/v7-local-recovery.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report))


if __name__=='__main__':
    main()
