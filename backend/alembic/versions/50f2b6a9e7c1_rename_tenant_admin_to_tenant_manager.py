"""Rename tenant_admin -> tenant_manager in stored user org_role values

Revision ID: 50f2b6a9e7c1
Revises: 40f5473e5b23
Create Date: 2026-02-03 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "50f2b6a9e7c1"
down_revision: Union[str, None] = "40f5473e5b23"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1) Update existing user rows from tenant_admin -> tenant_manager
    conn.execute(
        text("UPDATE users SET org_role = 'tenant_manager' WHERE org_role = 'tenant_admin'")
    )

    # 2) If Postgres, update CHECK constraint to include tenant_manager
    if conn.dialect.name == "postgresql":
        # Find any check constraints referencing org_role and drop them
        constraints = conn.execute(
            text(
                """
                SELECT conname
                FROM pg_constraint
                WHERE conrelid = 'users'::regclass
                  AND pg_get_constraintdef(oid) LIKE '%org_role%'
                """
            )
        ).fetchall()

        for row in constraints:
            conname = row[0]
            conn.execute(text(f'ALTER TABLE users DROP CONSTRAINT IF EXISTS "{conname}"'))

        # Add a new explicit constraint with tenant_manager in the allowed set
        conn.execute(
            text(
                """
                ALTER TABLE users
                ADD CONSTRAINT users_org_role_check
                CHECK (org_role IN ('platform_admin', 'tenant_manager', 'hr_admin', 'tenant_lead', 'manager', 'corporate_user', 'employee'))
                """
            )
        )


def downgrade() -> None:
    conn = op.get_bind()

    # Revert values tenant_manager -> tenant_admin
    conn.execute(
        text("UPDATE users SET org_role = 'tenant_admin' WHERE org_role = 'tenant_manager'")
    )

    # For Postgres, restore a constraint that includes tenant_admin
    if conn.dialect.name == "postgresql":
        # Drop any org_role-related constraints
        constraints = conn.execute(
            text(
                """
                SELECT conname
                FROM pg_constraint
                WHERE conrelid = 'users'::regclass
                  AND pg_get_constraintdef(oid) LIKE '%org_role%'
                """
            )
        ).fetchall()

        for row in constraints:
            conname = row[0]
            conn.execute(text(f'ALTER TABLE users DROP CONSTRAINT IF EXISTS "{conname}"'))

        # Add old constraint including tenant_admin
        conn.execute(
            text(
                """
                ALTER TABLE users
                ADD CONSTRAINT users_org_role_check
                CHECK (org_role IN ('platform_admin', 'tenant_admin', 'hr_admin', 'tenant_lead', 'manager', 'corporate_user', 'employee'))
                """
            )
        )
