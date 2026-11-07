import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger(__name__)

raw_db_url = os.getenv("DATABASE_URL", "sqlite:///./cyclone_tracker.db")
if os.getenv('ENVIRONMENT', '').lower() == 'production' and not raw_db_url.startswith(('postgres://', 'postgresql://', 'postgresql+psycopg2://')):
    raise RuntimeError('Production requires an explicit PostgreSQL DATABASE_URL')

# Fix Render PostgreSQL URL compatibility (Render uses postgres://, SQLAlchemy requires postgresql://)
if raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)
if raw_db_url.startswith('postgresql://'):
    raw_db_url = raw_db_url.replace('postgresql://', 'postgresql+psycopg2://', 1)

SQLALCHEMY_DATABASE_URL = raw_db_url

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    if os.getenv("ENVIRONMENT") == "production":
        logger.warning(
            "[Database] PRODUCTION WARNING: Running with SQLite fallback in production. "
            "Configure DATABASE_URL to connect to a managed PostgreSQL cluster."
        )
    connect_args = {"check_same_thread": False}
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args=connect_args
    )
else:
    # Production PostgreSQL connection pool configuration (BACK-01)
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_size=int(os.getenv("DB_POOL_SIZE", "10")),
        max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "20")),
        pool_timeout=int(os.getenv("DB_POOL_TIMEOUT", "30")),
        pool_recycle=int(os.getenv("DB_POOL_RECYCLE", "1800")),
        pool_pre_ping=True
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
    if os.getenv('ENVIRONMENT', '').lower() == 'production':
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
    """Startup only checks the version. Deployment owns schema changes."""
    from sqlalchemy import text
    with engine.connect() as conn:
        revision = conn.execute(text('SELECT version_num FROM alembic_version')).scalar()
    if revision != '20261107_fenced_state':
        raise RuntimeError('Database schema is not current; run alembic upgrade head before startup')
