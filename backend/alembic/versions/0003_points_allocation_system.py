"""Add points allocation system - allocation_logs, platform_billing_logs, and points_allocation_balance

Revision ID: 0003_points_allocation_system
Revises: 50f2b6a9e7c1
Create Date: 2026-02-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0003_points_allocation_system'
down_revision = '50f2b6a9e7c1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add points_allocation_balance column to tenants table
    op.add_column(
        'tenants',
        sa.Column(
            'points_allocation_balance',
            sa.Numeric(precision=15, scale=2),
            nullable=False,
            server_default='0'
        )
    )

    # Create allocation_logs table
    op.create_table(
        'allocation_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.func.gen_random_uuid()),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('allocated_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('amount', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='INR'),
        sa.Column('reference_note', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='COMPLETED'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['allocated_by'], ['system_admins.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # Create platform_billing_logs table
    op.create_table(
        'platform_billing_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.func.gen_random_uuid()),
        sa.Column('admin_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('amount', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='INR'),
        sa.Column('reference_note', sa.Text(), nullable=True),
        sa.Column('transaction_type', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['admin_id'], ['system_admins.id']),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes
    op.create_index('idx_allocation_logs_tenant_id', 'allocation_logs', ['tenant_id'])
    op.create_index('idx_allocation_logs_allocated_by', 'allocation_logs', ['allocated_by'])
    op.create_index('idx_platform_billing_logs_tenant_id', 'platform_billing_logs', ['tenant_id'])
    op.create_index('idx_platform_billing_logs_admin_id', 'platform_billing_logs', ['admin_id'])

    # Add check constraint for positive balance
    op.create_check_constraint(
        'positive_points_allocation_balance',
        'tenants',
        'points_allocation_balance >= 0'
    )


def downgrade() -> None:
    # Drop check constraint
    op.drop_constraint('positive_points_allocation_balance', 'tenants', type_='check')

    # Drop indexes
    op.drop_index('idx_platform_billing_logs_admin_id', table_name='platform_billing_logs')
    op.drop_index('idx_platform_billing_logs_tenant_id', table_name='platform_billing_logs')
    op.drop_index('idx_allocation_logs_allocated_by', table_name='allocation_logs')
    op.drop_index('idx_allocation_logs_tenant_id', table_name='allocation_logs')

    # Drop tables
    op.drop_table('platform_billing_logs')
    op.drop_table('allocation_logs')

    # Drop column
    op.drop_column('tenants', 'points_allocation_balance')
