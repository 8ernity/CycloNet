"""initial_domain_models

Revision ID: 7ebcad6e592b
Revises: 
Create Date: 2026-11-06 23:27:17.135403

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7ebcad6e592b'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema idempotently."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 1. cyclone_archive
    if "cyclone_archive" not in existing_tables:
        op.create_table(
            'cyclone_archive',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('name', sa.String()),
            sa.Column('year', sa.Integer()),
            sa.Column('basin', sa.String()),
            sa.Column('max_category', sa.String()),
            sa.Column('dates', sa.String(), nullable=True),
        )
        op.create_index(op.f('ix_cyclone_archive_id'), 'cyclone_archive', ['id'], unique=False)

    # 2. active_cyclone_state
    if "active_cyclone_state" not in existing_tables:
        op.create_table(
            'active_cyclone_state',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('active_count', sa.Integer(), default=0),
            sa.Column('systems_json', sa.String(), default="[]"),
            sa.Column('last_sync', sa.DateTime()),
        )
        op.create_index(op.f('ix_active_cyclone_state_id'), 'active_cyclone_state', ['id'], unique=False)

    # 3. classification_history
    if "classification_history" not in existing_tables:
        op.create_table(
            'classification_history',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('user_id', sa.String(), nullable=True),
            sa.Column('filename', sa.String()),
            sa.Column('predicted_category', sa.String()),
            sa.Column('confidence', sa.Float()),
            sa.Column('timestamp', sa.DateTime()),
        )
        op.create_index(op.f('ix_classification_history_id'), 'classification_history', ['id'], unique=False)
        op.create_index(op.f('ix_classification_history_user_id'), 'classification_history', ['user_id'], unique=False)
        op.create_index(op.f('ix_classification_history_filename'), 'classification_history', ['filename'], unique=False)
    else:
        cols = [c['name'] for c in inspector.get_columns('classification_history')]
        if 'user_id' not in cols:
            op.add_column('classification_history', sa.Column('user_id', sa.String(), nullable=True))
            op.create_index(op.f('ix_classification_history_user_id'), 'classification_history', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "classification_history" in existing_tables:
        cols = [c['name'] for c in inspector.get_columns('classification_history')]
        if 'user_id' in cols:
            try:
                op.drop_index(op.f('ix_classification_history_user_id'), table_name='classification_history')
                op.drop_column('classification_history', 'user_id')
            except Exception:
                pass
