"""Add route geometry (path + chokepoint_ids) and backfill from existing entities

Revision ID: b7c2f4a9d1e3
Revises: e113037ac844
Create Date: 2026-08-20 21:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session

# revision identifiers, used by Alembic.
revision: str = 'b7c2f4a9d1e3'
down_revision: Union[str, Sequence[str], None] = 'e113037ac844'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add ordered [lng, lat] path and chokepoint_ids to routes, then backfill.

    The backfill derives geometry from coordinates already stored on
    energy_assets and chokepoints (linked through trade_flows and suppliers),
    so it works on any populated database and is a no-op on an empty one.
    """
    op.add_column('routes', sa.Column('path', sa.JSON(), nullable=True))
    op.add_column('routes', sa.Column('chokepoint_ids', sa.JSON(), nullable=True))

    # env.py puts apps/api on sys.path, same import style it uses itself
    from models.domain import Route
    from services.route_geometry import derive_route_geometries

    session = Session(bind=op.get_bind())
    try:
        geometries = derive_route_geometries(session)
        for route_id, geo in geometries.items():
            session.query(Route).filter(Route.id == route_id).update(
                {"path": geo["path"], "chokepoint_ids": geo["chokepoint_ids"]}
            )
        session.commit()
    finally:
        session.close()


def downgrade() -> None:
    """Drop the geometry columns."""
    op.drop_column('routes', 'chokepoint_ids')
    op.drop_column('routes', 'path')
