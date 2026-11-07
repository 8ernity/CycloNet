"""Persist authoritative fencing ownership and repair legacy dates column."""
from alembic import op
import sqlalchemy as sa

revision = '20261107_fenced_state'
down_revision = '7ebcad6e592b'
branch_labels = depends_on = None

def upgrade():
    inspector = sa.inspect(op.get_bind())
    cols = {c['name'] for c in inspector.get_columns('active_cyclone_state')}
    if 'fencing_generation' not in cols:
        op.add_column('active_cyclone_state', sa.Column('fencing_generation', sa.BigInteger(), nullable=False, server_default='0'))
    if 'leader_token' not in cols:
        op.add_column('active_cyclone_state', sa.Column('leader_token', sa.String(), nullable=True))
    if 'dates' not in {c['name'] for c in inspector.get_columns('cyclone_archive')}:
        op.add_column('cyclone_archive', sa.Column('dates', sa.String(), nullable=True))
    state = sa.table('active_cyclone_state', sa.column('id'), sa.column('active_count'),
                     sa.column('systems_json'), sa.column('fencing_generation'))
    exists = op.get_bind().execute(sa.select(state.c.id).where(state.c.id == 'CURRENT_ACTIVE_SYSTEMS')).first()
    if not exists:
        op.execute(state.insert().values(id='CURRENT_ACTIVE_SYSTEMS', active_count=0, systems_json='[]', fencing_generation=0))

def downgrade():
    # Payload and historical records are retained; old code must remain stopped.
    op.drop_column('active_cyclone_state', 'leader_token')
    op.drop_column('active_cyclone_state', 'fencing_generation')
