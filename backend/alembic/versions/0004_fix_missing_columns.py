"""Fix missing columns and tables required by current models

Revision ID: 0004_fix_missing_columns
Revises: 60a3d4f8b2c7
Create Date: 2026-02-04 00:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0004_fix_missing_columns'
down_revision = '60a3d4f8b2c7'
branch_labels = None
depends_on = None


def upgrade():
    # Add missing columns if they don't exist
    op.execute("""
    ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'INR',
      ADD COLUMN IF NOT EXISTS points_allocation_balance NUMERIC(15,2) DEFAULT 0;
    """)

    op.execute("""
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ;
    """)

    op.execute("""
    ALTER TABLE budgets
      ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMPTZ;
    """)

    op.execute("""
    ALTER TABLE redemptions
      ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6),
      ADD COLUMN IF NOT EXISTS voucher_id UUID;
    """)

    # Create allocation_logs table if missing
    op.execute("""
    CREATE TABLE IF NOT EXISTS allocation_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      allocated_by UUID NOT NULL,
      amount NUMERIC(15,2) NOT NULL,
      currency VARCHAR(3) NOT NULL DEFAULT 'INR',
      reference_note TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    # Create platform_billing_logs table if missing
    op.execute("""
    CREATE TABLE IF NOT EXISTS platform_billing_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_id UUID NOT NULL,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      amount NUMERIC(15,2) NOT NULL,
      currency VARCHAR(3) NOT NULL DEFAULT 'INR',
      reference_note TEXT,
      transaction_type VARCHAR(50) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    """)

    # Create indexes if not exist (Postgres will ignore duplicates with IF NOT EXISTS on CREATE INDEX CONCURRENTLY not supported here)
    try:
        op.create_index('idx_allocation_logs_tenant_id', 'allocation_logs', ['tenant_id'])
        op.create_index('idx_platform_billing_logs_tenant_id', 'platform_billing_logs', ['tenant_id'])
    except Exception:
        pass


def downgrade():
    # Attempt to remove columns/tables if downgrade requested
    op.execute("""
    ALTER TABLE redemptions
      DROP COLUMN IF EXISTS otp_code,
      DROP COLUMN IF EXISTS voucher_id;
    """)

    op.execute("""
    ALTER TABLE budgets
      DROP COLUMN IF EXISTS expiry_date;
    """)

    op.execute("""
    ALTER TABLE users
      DROP COLUMN IF EXISTS invitation_sent_at;
    """)

    op.execute("""
    ALTER TABLE tenants
      DROP COLUMN IF EXISTS points_allocation_balance,
      DROP COLUMN IF EXISTS currency;
    """)

    op.execute("DROP TABLE IF EXISTS allocation_logs CASCADE;")
    op.execute("DROP TABLE IF EXISTS platform_billing_logs CASCADE;")
