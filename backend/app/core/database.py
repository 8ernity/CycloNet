import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger(__name__)

raw_db_url = os.getenv("DATABASE_URL", "sqlite:///./cyclone_tracker.db")

# Fix Render PostgreSQL URL compatibility (Render uses postgres://, SQLAlchemy requires postgresql://)
if raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)

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
    try:
        from app.models import domain
        domain.Base.metadata.create_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        
        try:
            from app.services.data_ingestion import seed_historical_data
            db = SessionLocal()
            seed_historical_data(db)
            db.close()
        except Exception as seed_err:
            logger.warning("[Database] Seed warning: %s", seed_err)
    except Exception as e:
        logger.error("[Database] Initialization error: %s", e)
