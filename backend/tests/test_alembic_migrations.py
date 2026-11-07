import os
import pytest
from alembic.config import Config
from alembic import command

def test_alembic_migrations_upgrade_head():
    """
    FIX-012: Asserts that Alembic migrations run cleanly to head on the active test database.
    """
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ini_path = os.path.join(backend_dir, "alembic.ini")
    
    alembic_cfg = Config(ini_path)
    alembic_cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))
    
    # Run upgrade head programmatically; should complete without exception
    command.upgrade(alembic_cfg, "head")
