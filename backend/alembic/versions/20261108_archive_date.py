"""Normalize archive chronology and index database pagination."""
from alembic import op
import sqlalchemy as sa
from app.core.archive_dates import archive_start_date
revision = '20261108_archive_date'
down_revision = '20261107_fenced_state'
branch_labels = depends_on = None

def upgrade():
    op.add_column('cyclone_archive', sa.Column('start_date',sa.Date(),nullable=False,server_default=sa.text("'0001-01-01'")))
    table=sa.table('cyclone_archive',sa.column('id'),sa.column('year'),sa.column('dates'),sa.column('start_date',sa.Date()))
    conn=op.get_bind()
    # Keyset batches bound migration memory and preserve all original display dates.
    last=''
    while True:
        rows=conn.execute(sa.select(table.c.id,table.c.year,table.c.dates).where(table.c.id>last).order_by(table.c.id).limit(500)).all()
        if not rows: break
        for row in rows:
            conn.execute(table.update().where(table.c.id==row.id).values(start_date=archive_start_date(row.year,row.dates)))
        last=rows[-1].id
    op.create_index('ix_archive_chronology','cyclone_archive',['start_date','id'])

def downgrade():
    op.drop_index('ix_archive_chronology',table_name='cyclone_archive')
    op.drop_column('cyclone_archive','start_date')
