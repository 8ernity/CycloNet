import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.runtime import runtime_environment

logger = logging.getLogger(__name__)

raw_db_url = os.getenv("DATABASE_URL", "sqlite:///./cyclone_tracker.db")
if runtime_environment() == 'production' and not raw_db_url.startswith(('postgres://', 'postgresql://', 'postgresql+psycopg2://')):
    raise RuntimeError("Production requires PostgreSQL; SQLite fallback is forbidden")

# Fix Render PostgreSQL URL compatibility (Render uses postgres://, SQLAlchemy requires postgresql://)
if raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)
if raw_db_url.startswith('postgresql://'):
    raw_db_url = raw_db_url.replace('postgresql://', 'postgresql+psycopg2://', 1)

SQLALCHEMY_DATABASE_URL = raw_db_url

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args=connect_args
    )
else:
    # Production PostgreSQL connection pool configuration (BACK-01)
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_size=int(os.getenv("DB_POOL_SIZE", "5")),
        max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "5")),
        pool_timeout=int(os.getenv("DB_POOL_TIMEOUT", "5")),
        pool_recycle=int(os.getenv("DB_POOL_RECYCLE", "1800")),
        pool_pre_ping=True,
        connect_args={"connect_timeout": 5, "options": "-c statement_timeout=15000"}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """
    Initializes database schema and populates historical archive seed records.
    Safe for both application startup and test runner execution (BACK-01).
    """
    if runtime_environment() == 'production':
        validate_schema()
        return
    from pathlib import Path
    from alembic.config import Config
    from alembic import command
    backend = Path(__file__).resolve().parents[2]
    config = Config(str(backend / 'alembic.ini'))
    config.set_main_option('script_location', str(backend / 'alembic'))
    command.upgrade(config, 'head')
    from app.services.data_ingestion import seed_historical_data
    with SessionLocal() as db:
        seed_historical_data(db)


def validate_schema():
    """Read-only in every environment. Initialization is a separate operation."""
    from sqlalchemy import inspect, text
    from pathlib import Path
    from alembic.config import Config
    from alembic.script import ScriptDirectory
    backend = Path(__file__).resolve().parents[2]
    config = Config(str(backend / 'alembic.ini'))
    config.set_main_option('script_location', str(backend / 'alembic'))
    expected = set(ScriptDirectory.from_config(config).get_heads())
    if 'alembic_version' not in inspect(engine).get_table_names():
        raise RuntimeError('Database migration required before startup')
    with engine.connect() as conn:
        revisions = set(conn.execute(text('SELECT version_num FROM alembic_version')).scalars())
    if revisions != expected:
        raise RuntimeError('Database migration required before startup')
    from app.models import domain  # Register every required application table.
    inspector = inspect(engine)
    actual_tables = set(inspector.get_table_names())
    for table in Base.metadata.sorted_tables:
        if table.name not in actual_tables:
            raise RuntimeError('Database schema is incomplete')
        columns = {column['name'] for column in inspector.get_columns(table.name)}
        if not set(table.columns.keys()).issubset(columns):
            raise RuntimeError('Database schema is incomplete')
