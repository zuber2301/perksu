
import psycopg2
import os

def fix_db():
    conn = psycopg2.connect("postgresql://perksu:perksu_secret_2024@localhost:6432/perksu")
    cur = conn.cursor()
    
    print("Fixing redemptions table...")
    try:
        cur.execute("ALTER TABLE redemptions ADD COLUMN IF NOT EXISTS voucher_id UUID;")
        cur.execute("ALTER TABLE redemptions ADD COLUMN IF NOT EXISTS voucher_code VARCHAR(255);")
        cur.execute("ALTER TABLE redemptions ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(255);")
    except Exception as e:
        print(f"Error updating redemptions: {e}")
        conn.rollback()
    else:
        conn.commit()

    print("Fixing tenants table columns...")
    try:
        # Check current types
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tenants' AND column_name IN ('domain_whitelist', 'enabled_rewards', 'award_tiers');")
        columns = cur.fetchall()
        print(f"Current columns: {columns}")
        
        # Convert to JSONB if they are ARRAY or something else
        for col, dtype in columns:
            if dtype != 'jsonb':
                print(f"Converting {col} to JSONB...")
                # We use USING to convert the data. If it's an array, we might need to convert it to jsonb.
                # Simplest is to clear it if it's broken, or try to cast it.
                cur.execute(f"ALTER TABLE tenants ALTER COLUMN {col} DROP DEFAULT;")
                cur.execute(f"ALTER TABLE tenants ALTER COLUMN {col} TYPE JSONB USING (CASE WHEN {col} IS NULL THEN '[]'::jsonb ELSE to_jsonb({col}) END);")
                cur.execute(f"ALTER TABLE tenants ALTER COLUMN {col} SET DEFAULT '[]'::jsonb;")
        
        conn.commit()
    except Exception as e:
        print(f"Error updating tenants: {e}")
        conn.rollback()

    cur.close()
    conn.close()
    print("Database fix complete.")

if __name__ == "__main__":
    fix_db()
