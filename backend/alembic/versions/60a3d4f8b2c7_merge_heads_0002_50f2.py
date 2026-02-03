"""Merge heads: 0002_budget_triggers & 50f2b6a9e7c1

Revision ID: 60a3d4f8b2c7
Revises: 0002_budget_triggers, 50f2b6a9e7c1
Create Date: 2026-02-03 00:30:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "60a3d4f8b2c7"
down_revision: Union[str, Sequence[str], None] = ("0002_budget_triggers", "50f2b6a9e7c1")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # merge-only revision: no DB schema changes
    pass


def downgrade() -> None:
    # nothing to revert
    pass
