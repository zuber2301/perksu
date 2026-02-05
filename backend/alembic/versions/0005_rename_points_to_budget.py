"""Rename points_* columns to budget_* for clarity

Revision ID: 0005_rename_points_to_budget
Revises: 0004_fix_missing_columns
Create Date: 2026-02-04 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0005_rename_points_to_budget'
down_revision = '0004_fix_missing_columns'
branch_labels = None
depends_on = None


def upgrade():
    # Rename tenant column
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='points_allocation_balance') THEN
            ALTER TABLE tenants RENAME COLUMN points_allocation_balance TO budget_allocation_balance;
        END IF;
    END$$;
    """)

    # Rename check constraint if exists
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS(SELECT 1 FROM pg_constraint WHERE conname='positive_points_allocation_balance') THEN
            ALTER TABLE tenants DROP CONSTRAINT IF EXISTS positive_points_allocation_balance;
            ALTER TABLE tenants ADD CONSTRAINT positive_budget_allocation_balance CHECK (budget_allocation_balance >= 0);
        END IF;
    END$$;
    """)

    # Ensure `allocated_budget` columns exist on budgets, department_budgets, lead_allocations
    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='budgets' AND column_name='allocated_budget') THEN
            ALTER TABLE budgets ADD COLUMN IF NOT EXISTS allocated_budget NUMERIC(15,2) DEFAULT 0;
        END IF;
        IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='department_budgets' AND column_name='allocated_budget') THEN
            ALTER TABLE department_budgets ADD COLUMN IF NOT EXISTS allocated_budget NUMERIC(15,2) DEFAULT 0;
        END IF;
        IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='lead_allocations' AND column_name='allocated_points') THEN
            ALTER TABLE lead_allocations RENAME COLUMN allocated_points TO allocated_budget;
        ELSIF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='lead_allocations' AND column_name='allocated_budget') THEN
            ALTER TABLE lead_allocations ADD COLUMN allocated_budget NUMERIC(15,2) DEFAULT 0;
        END IF;
    END$$;
    """)


def downgrade():
    # Downgrade intentionally left empty to avoid accidental reversion
    # of production column renames. This migration is one-way.
    pass
