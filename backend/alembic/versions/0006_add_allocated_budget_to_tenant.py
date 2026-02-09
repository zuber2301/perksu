"""Add allocated_budget column to tenants

Revision ID: 0006_add_allocated_budget_to_tenant
Revises: 0005_rename_points_to_budget
Create Date: 2026-02-09 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0006_add_allocated_budget_to_tenant'
down_revision = '0005_rename_points_to_budget'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('tenants', sa.Column('allocated_budget', sa.Numeric(15,2), nullable=False, server_default='0'))


def downgrade():
    op.drop_column('tenants', 'allocated_budget')
