"""Consolidate roles to 4 new roles: platform_admin, hr_admin, dept_lead, user

Revision ID: consolidate_roles_v1
Revises: ba13b63b92f3
Create Date: 2026-02-20 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "consolidate_roles_v1"
down_revision: Union[str, None] = "ba13b63b92f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Consolidate roles to 4 new roles: platform_admin, hr_admin, dept_lead, user.

    This migration consolidates all role values to a simplified 4-role system:
    - platform_admin: System-wide administrator (replaces platform_admin)
    - hr_admin: Tenant-level administrator (replaces tenant_manager)
    - dept_lead: Department lead (replaces manager, tenant_lead)
    - user: Regular user (replaces employee)

    Business Logic:
    - tenant_manager -> hr_admin
    - tenant_lead -> dept_lead
    - manager -> dept_lead
    - employee -> user
    - corporate_user -> user
    - All others remain or become user
    """
    conn = op.get_bind()
    dialect = conn.dialect.name

    # Drop existing CHECK constraint for org_role (PostgreSQL specific)
    if dialect == 'postgresql':
        try:
            conn.execute(sa.text("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_org_role_check"))
        except Exception:
            pass

    # Update role mappings from old to new consolidated roles
    conn.execute(sa.text("UPDATE users SET org_role = 'hr_admin' WHERE org_role = 'tenant_manager'"))
    conn.execute(sa.text("UPDATE users SET org_role = 'dept_lead' WHERE org_role IN ('tenant_lead', 'manager')"))
    conn.execute(sa.text("UPDATE users SET org_role = 'user' WHERE org_role IN ('employee', 'corporate_user')"))
    # Set any remaining unknown roles to 'user'
    conn.execute(sa.text("UPDATE users SET org_role = 'user' WHERE org_role NOT IN ('platform_admin', 'hr_admin', 'dept_lead', 'user')"))

    # Recreate CHECK constraint with new values (PostgreSQL specific)
    if dialect == 'postgresql':
        try:
            conn.execute(sa.text("ALTER TABLE users ADD CONSTRAINT users_org_role_check CHECK (org_role IN ('platform_admin', 'hr_admin', 'dept_lead', 'user'))"))
        except Exception:
            pass
    
    conn.commit()


def downgrade() -> None:
    """Downgrade not supported - this is a one-way consolidation"""
    pass
