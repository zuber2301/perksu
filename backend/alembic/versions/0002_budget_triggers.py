"""add_budget_triggers

Revision ID: 0002_budget_triggers
Revises: 0001_tenant_dashboard_schema
Create Date: 2026-02-02 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0002_budget_triggers'
down_revision = '0001_tenant_dashboard_schema'
branch_labels = None
depends_on = None


def upgrade():
    # 1) Ensure department spent_points does not exceed allocated_points
    op.execute("""
CREATE OR REPLACE FUNCTION fn_check_dept_spent() RETURNS trigger AS $$
BEGIN
    IF NEW.spent_points IS NOT NULL AND NEW.allocated_points IS NOT NULL AND NEW.spent_points > NEW.allocated_points THEN
        RAISE EXCEPTION 'Department spent_points (% ) exceeds allocated_points (% )', NEW.spent_points, NEW.allocated_points;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
""")

    op.execute("""
CREATE OR REPLACE FUNCTION fn_check_dept_allocations() RETURNS trigger AS $$
DECLARE
    v_budget_id uuid;
    v_total numeric;
    v_sum numeric;
BEGIN
    v_budget_id := COALESCE(NEW.budget_id, OLD.budget_id);
    IF v_budget_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT total_points INTO v_total FROM budgets WHERE id = v_budget_id;
    SELECT COALESCE(SUM(allocated_points), 0) INTO v_sum FROM department_budgets WHERE budget_id = v_budget_id;

    IF v_total IS NOT NULL AND v_sum > v_total THEN
        RAISE EXCEPTION 'Total department allocations (% ) exceed budget total (% )', v_sum, v_total;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
""")

    op.execute("""
CREATE OR REPLACE FUNCTION fn_check_budget_total() RETURNS trigger AS $$
DECLARE
    v_sum numeric;
BEGIN
    SELECT COALESCE(SUM(allocated_points), 0) INTO v_sum FROM department_budgets WHERE budget_id = NEW.id;
    IF NEW.total_points IS NOT NULL AND v_sum > NEW.total_points THEN
        RAISE EXCEPTION 'Budget total (% ) cannot be less than allocated department sum (% )', NEW.total_points, v_sum;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
""")

    # Create triggers
    op.execute("""
DROP TRIGGER IF EXISTS trg_dept_spent ON department_budgets;
CREATE TRIGGER trg_dept_spent
  BEFORE INSERT OR UPDATE ON department_budgets
  FOR EACH ROW EXECUTE FUNCTION fn_check_dept_spent();
""")

    op.execute("""
DROP TRIGGER IF EXISTS trg_dept_allocations ON department_budgets;
CREATE TRIGGER trg_dept_allocations
  AFTER INSERT OR UPDATE OR DELETE ON department_budgets
  FOR EACH ROW EXECUTE FUNCTION fn_check_dept_allocations();
""")

    op.execute("""
DROP TRIGGER IF EXISTS trg_budget_total ON budgets;
CREATE TRIGGER trg_budget_total
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION fn_check_budget_total();
""")


def downgrade():
    op.execute("""
DROP TRIGGER IF EXISTS trg_dept_spent ON department_budgets;
DROP TRIGGER IF EXISTS trg_dept_allocations ON department_budgets;
DROP TRIGGER IF EXISTS trg_budget_total ON budgets;
DROP FUNCTION IF EXISTS fn_check_dept_spent();
DROP FUNCTION IF EXISTS fn_check_dept_allocations();
DROP FUNCTION IF EXISTS fn_check_budget_total();
""")
