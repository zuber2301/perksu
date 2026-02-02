-- SQL schema for Tenant Dashboard core tables (Postgres)

-- UUID extension (enable in DB if not already)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  favicon_url TEXT,
  theme_config JSONB DEFAULT '{}'::jsonb,
  branding_config JSONB DEFAULT '{}'::jsonb,
  domain_whitelist JSONB DEFAULT '[]'::jsonb,
  auth_method TEXT DEFAULT 'OTP_ONLY',
  currency_label TEXT DEFAULT 'Points',
  conversion_rate NUMERIC(10,4) DEFAULT 1.0,
  subscription_tier TEXT DEFAULT 'basic',
  master_budget_balance NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES departments(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  personal_email TEXT,
  mobile_phone TEXT,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL,
  org_role TEXT NOT NULL DEFAULT 'employee',
  department_id UUID NOT NULL REFERENCES departments(id),
  manager_id UUID REFERENCES users(id),
  avatar_url TEXT,
  date_of_birth DATE,
  hire_date DATE,
  is_super_admin BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending_invite',
  invitation_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_users_tenant_email ON users(tenant_id, email);

CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance NUMERIC(15,2) DEFAULT 0,
  lifetime_earned NUMERIC(15,2) DEFAULT 0,
  lifetime_spent NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX idx_wallet_user ON wallets(user_id);

CREATE TABLE wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  wallet_user_id UUID NOT NULL,
  transaction_type TEXT NOT NULL,
  source TEXT,
  points NUMERIC(15,2) NOT NULL,
  balance_after NUMERIC(15,2) NOT NULL,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_wallet_ledger_wallet ON wallet_ledger(wallet_id);

CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  name TEXT NOT NULL,
  points NUMERIC(12,2) DEFAULT 0,
  icon_url TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE recognitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES badges(id),
  recognition_type TEXT,
  points NUMERIC(15,2) DEFAULT 0,
  message TEXT,
  visibility TEXT DEFAULT 'public',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_recognitions_tenant_created ON recognitions(tenant_id, created_at DESC);

CREATE TABLE feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_feed_tenant_created ON feed(tenant_id, created_at DESC);

CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT,
  total_points NUMERIC(15,2) DEFAULT 0,
  spent_points NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE department_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  allocated_points NUMERIC(15,2) DEFAULT 0,
  spent_points NUMERIC(15,2) DEFAULT 0
);

CREATE TABLE redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT,
  item_id UUID,
  item_name TEXT,
  point_cost INTEGER,
  actual_cost NUMERIC(15,2),
  markup_amount NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'PENDING',
  otp_code TEXT,
  otp_expires_at TIMESTAMPTZ,
  otp_verified_at TIMESTAMPTZ,
  otp_attempts INTEGER DEFAULT 0,
  delivery_details JSONB DEFAULT '{}'::jsonb,
  voucher_code TEXT,
  tracking_number TEXT,
  voucher_id UUID REFERENCES vouchers(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE redemption_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  redemption_id UUID NOT NULL REFERENCES redemptions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  status_before TEXT,
  status_after TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Note: table `vouchers` and `merchandise_catalog` expected elsewhere in schema

-- Recommended additional indexes
CREATE INDEX idx_users_tenant_role ON users(tenant_id, role);
CREATE INDEX idx_wallets_tenant_user ON wallets(tenant_id, user_id);
CREATE INDEX idx_recog_to_user ON recognitions(to_user_id);
CREATE INDEX idx_recog_from_user ON recognitions(from_user_id);

-- End of schema
