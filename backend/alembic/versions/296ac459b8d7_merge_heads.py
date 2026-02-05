"""merge heads

Revision ID: 296ac459b8d7
Revises: 0003_points_allocation_system, 0005_rename_points_to_budget
Create Date: 2026-02-04 10:41:57.007661

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '296ac459b8d7'
down_revision: Union[str, None] = ('0003_points_allocation_system', '0005_rename_points_to_budget')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
