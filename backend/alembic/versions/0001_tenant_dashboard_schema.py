"""initial tenant dashboard schema

Revision ID: 0001_tenant_dashboard_schema
Revises: 
Create Date: 2026-02-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from pathlib import Path

# revision identifiers, used by Alembic.
revision = '0001_tenant_dashboard_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Read SQL file generated in docs
    sql_path = Path(__file__).resolve().parents[3] / 'docs' / 'tenant_dashboard_schema.sql'
    if sql_path.exists():
        sql = sql_path.read_text()
        # Execute raw SQL
        op.execute(sa.text(sql))
    else:
        raise FileNotFoundError(f"Schema SQL file not found: {sql_path}")


def downgrade():
    # Drop tables in reverse order (best-effort)
    statements = [
        "DROP TABLE IF EXISTS redemption_ledger CASCADE;",
        "DROP TABLE IF EXISTS redemptions CASCADE;",
        "DROP TABLE IF EXISTS department_budgets CASCADE;",
        "DROP TABLE IF EXISTS budgets CASCADE;",
        "DROP TABLE IF EXISTS feed CASCADE;",
        "DROP TABLE IF EXISTS recognitions CASCADE;",
        "DROP TABLE IF EXISTS badges CASCADE;",
        "DROP TABLE IF EXISTS wallet_ledger CASCADE;",
        "DROP TABLE IF EXISTS wallets CASCADE;",
        "DROP TABLE IF EXISTS users CASCADE;",
        "DROP TABLE IF EXISTS departments CASCADE;",
        "DROP TABLE IF EXISTS tenants CASCADE;",
    ]
    for stmt in statements:
        op.execute(sa.text(stmt))
