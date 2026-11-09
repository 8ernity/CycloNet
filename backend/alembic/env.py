import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool, text

from alembic import context

# Add backend directory to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Import models for autogenerate support
from app.models import domain
from app.core.database import SQLALCHEMY_DATABASE_URL

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = domain.Base.metadata

# Dynamic database URL from environment
db_url = os.getenv("DATABASE_URL", SQLALCHEMY_DATABASE_URL)
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
if db_url.startswith('postgresql://'):
    db_url = db_url.replace('postgresql://', 'postgresql+psycopg2://', 1)
config.set_main_option("sqlalchemy.url", db_url.replace('%', '%%'))

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        # Serialize deploy jobs; the session lock survives transaction boundaries.
        if connection.dialect.name == 'postgresql':
            connection.execute(text('SELECT pg_advisory_lock(1729463101)'))
            connection.commit()
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()
        if connection.dialect.name == 'postgresql':
            connection.execute(text('SELECT pg_advisory_unlock(1729463101)'))
            connection.commit()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
