"""make audit_log actor_id nullable

Revision ID: ba13b63b92f3
Revises: 296ac459b8d7
Create Date: 2026-02-04 10:42:02.367208

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ba13b63b92f3'
down_revision: Union[str, None] = '296ac459b8d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make actor_id nullable
    op.alter_column('audit_log', 'actor_id', nullable=True)


def downgrade() -> None:
    # Make actor_id not nullable (but this might fail if there are NULLs)
    op.alter_column('audit_log', 'actor_id', nullable=False)
