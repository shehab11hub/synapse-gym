-- ==============================================================================
-- SYNAPSE GYM SAAS - PRODUCTION SUPABASE DATABASE SCHEMA (schema.sql)
-- Complete PostgreSQL / Supabase SQL Schema for Fitness Clubs & Sports Centers
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. ENUMS & DOMAINS
-- ==============================================================================

-- Roles: Admin / Manager vs Receptionist
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'receptionist');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Member Types
DO $$ BEGIN
  CREATE TYPE member_type AS ENUM ('member', 'doctor');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Session Categories
DO $$ BEGIN
  CREATE TYPE session_category AS ENUM ('private', 'group', 'physio', 'massage', 'gym');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Coach Contract Types
DO $$ BEGIN
  CREATE TYPE coach_contract_type AS ENUM ('monthly', 'percentage', 'per_session', 'daily');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- POS Categories
DO $$ BEGIN
  CREATE TYPE pos_category AS ENUM ('supplements', 'drinks', 'apparel', 'snacks', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Payment Methods
DO $$ BEGIN
  CREATE TYPE payment_method_type AS ENUM ('cash', 'card', 'instapay', 'coach_collected', 'coach_debt');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 3. TABLES DEFINITION
-- ==============================================================================

-- TABLE: users
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'receptionist' CHECK (role IN ('admin', 'receptionist')),
  phone TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: members
CREATE TABLE IF NOT EXISTS public.members (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  code VARCHAR(10) UNIQUE NOT NULL, -- 6-digit numeric ID (e.g. 102938)
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  age INT,
  residential_area TEXT,
  photo_url TEXT,
  type TEXT NOT NULL DEFAULT 'member' CHECK (type IN ('member', 'doctor')),
  subscription_plan TEXT NOT NULL,
  subscription_fee NUMERIC(12, 2) DEFAULT 0.00,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'instapay', 'coach_collected')),
  collected_by_coach_id TEXT,
  payment_status TEXT DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending_on_coach', 'unpaid')),
  session_category TEXT DEFAULT 'gym' CHECK (session_category IN ('private', 'group', 'physio', 'massage', 'gym')),
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  total_days INT DEFAULT 30,
  remaining_days INT DEFAULT 30,
  total_sessions INT DEFAULT 0,
  remaining_sessions INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  assigned_session_id TEXT,
  assigned_trainer_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: coaches
CREATE TABLE IF NOT EXISTS public.coaches (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  code VARCHAR(10),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  specialty TEXT NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'percentage' CHECK (payment_type IN ('monthly', 'percentage', 'per_session', 'daily')),
  rate_per_session NUMERIC(10, 2) DEFAULT 0.00,
  monthly_salary NUMERIC(10, 2) DEFAULT 0.00,
  commission_rate NUMERIC(5, 2) DEFAULT 0.00,
  current_balance NUMERIC(12, 2) DEFAULT 0.00, -- مستحقات الكابتن (ليه كام)
  total_paid_today NUMERIC(12, 2) DEFAULT 0.00,
  monthly_salary_paid_this_month BOOLEAN DEFAULT FALSE,
  last_salary_payment_date DATE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: gym_sessions
CREATE TABLE IF NOT EXISTS public.gym_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  title TEXT NOT NULL,
  sport TEXT NOT NULL,
  hall TEXT NOT NULL,
  coach_ids JSONB DEFAULT '[]'::JSONB,
  session_category TEXT DEFAULT 'group' CHECK (session_category IN ('private', 'group', 'physio', 'massage', 'gym')),
  price NUMERIC(10, 2) DEFAULT 0.00,
  tier1_price NUMERIC(10, 2) DEFAULT 0.00,
  tier2_price NUMERIC(10, 2) DEFAULT 0.00,
  tier3_price NUMERIC(10, 2) DEFAULT 0.00,
  start_time TEXT,
  end_time TEXT,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'in-progress', 'completed')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  days_of_week JSONB DEFAULT '[]'::JSONB,
  enrolled_player_ids JSONB DEFAULT '[]'::JSONB,
  temporary_player_ids JSONB DEFAULT '[]'::JSONB,
  completed_today_by_coach JSONB DEFAULT '{}'::JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: physio_bookings
CREATE TABLE IF NOT EXISTS public.physio_bookings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  doctor_name TEXT NOT NULL,
  doctor_code TEXT NOT NULL,
  doctor_phone TEXT,
  patient_name TEXT NOT NULL,
  patient_code TEXT,
  room_name TEXT NOT NULL,
  hourly_rate NUMERIC(10, 2) DEFAULT 0.00,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  elapsed_minutes INT DEFAULT 0,
  total_fee NUMERIC(10, 2) DEFAULT 0.00,
  extra_fee NUMERIC(10, 2) DEFAULT 0.00,
  extra_fee_reason TEXT,
  service_type TEXT DEFAULT 'physio' CHECK (service_type IN ('physio', 'massage')),
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'paused', 'completed', 'cancelled')),
  is_paused BOOLEAN DEFAULT FALSE,
  paused_at TIMESTAMPTZ,
  total_paused_seconds INT DEFAULT 0,
  billed_to TEXT CHECK (billed_to IN ('patient', 'doctor', 'coach')),
  payment_method TEXT CHECK (payment_method IN ('cash', 'instapay', 'coach_debt')),
  instapay_ref TEXT,
  charged_to_coach_id TEXT,
  paid BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: pos_products (Bar & Store Inventory)
CREATE TABLE IF NOT EXISTS public.pos_products (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('supplements', 'drinks', 'apparel', 'snacks', 'other')),
  buy_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  sell_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  stock INT NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 5, -- تنبيه النقصان التلقائي
  barcode TEXT,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: pos_transactions (Bar Sales)
CREATE TABLE IF NOT EXISTS public.pos_transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  items JSONB NOT NULL DEFAULT '[]'::JSONB,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  profit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'instapay', 'coach_debt')),
  coach_id TEXT,
  coach_name TEXT,
  notes TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  cashier_name TEXT NOT NULL
);

-- TABLE: check_in_logs (Reception Attendance Queue)
CREATE TABLE IF NOT EXISTS public.check_in_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  member_id TEXT NOT NULL,
  member_name TEXT NOT NULL,
  member_code VARCHAR(10) NOT NULL,
  member_type TEXT NOT NULL DEFAULT 'member' CHECK (member_type IN ('member', 'doctor')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  method TEXT NOT NULL DEFAULT 'manual' CHECK (method IN ('qr', 'manual')),
  subscription_valid BOOLEAN DEFAULT TRUE,
  seating_status TEXT DEFAULT 'unassigned',
  assigned_category TEXT,
  assigned_coach_id TEXT,
  assigned_coach_name TEXT,
  assigned_session_id TEXT,
  assigned_session_title TEXT,
  payment_mode TEXT,
  charged_amount NUMERIC(10, 2) DEFAULT 0.00,
  session_started_at TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 0,
  pricing_tier TEXT,
  extra_fee_paid NUMERIC(10, 2) DEFAULT 0.00,
  extra_payment_method TEXT,
  check_out_status TEXT DEFAULT 'active'
);

-- TABLE: settlement_logs
CREATE TABLE IF NOT EXISTS public.settlement_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  coach_id TEXT NOT NULL,
  coach_name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  authorized_by TEXT NOT NULL
);

-- TABLE: trainer_transactions (Unified Double-Entry Coach Ledger)
CREATE TABLE IF NOT EXISTS public.trainer_transactions (
  transaction_id TEXT PRIMARY KEY,
  coach_id TEXT NOT NULL,
  coach_name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  collected_by TEXT NOT NULL CHECK (collected_by IN ('gym', 'coach')),
  payer_type TEXT NOT NULL,
  payer_name TEXT,
  gym_share NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  coach_share NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  month TEXT,
  type TEXT,
  payment_method TEXT,
  settled_at TIMESTAMPTZ,
  settled_by TEXT,
  notes TEXT
);

-- TABLE: expenses (Drawer Outflows)
CREATE TABLE IF NOT EXISTS public.expenses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('electricity', 'water', 'maintenance', 'rent', 'trainer_payout', 'supplies', 'other')),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  date TIMESTAMPTZ DEFAULT NOW(),
  recorded_by TEXT NOT NULL,
  notes TEXT,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'instapay')),
  auto_generated BOOLEAN DEFAULT FALSE,
  related_entity_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: cash_inflows (Drawer Inflows & Custody Deposits)
CREATE TABLE IF NOT EXISTS public.cash_inflows (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  type TEXT NOT NULL CHECK (type IN ('subscription', 'pos', 'physio', 'manual_deposit', 'coach_settlement')),
  title TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  date TIMESTAMPTZ DEFAULT NOW(),
  member_name TEXT,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'instapay')),
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: master_report_entries (Comprehensive Monthly Activity Sheet)
CREATE TABLE IF NOT EXISTS public.master_report_entries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  month TEXT NOT NULL,
  date TIMESTAMPTZ DEFAULT NOW(),
  player_name TEXT NOT NULL,
  player_code VARCHAR(10) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  coach_id TEXT,
  coach_name TEXT NOT NULL,
  session_category TEXT NOT NULL CHECK (session_category IN ('private', 'group', 'physio', 'massage', 'gym')),
  session_title TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'instapay', 'card', 'coach_collected', 'coach_debt')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('paid', 'pending_on_coach', 'unpaid')),
  notes TEXT,
  source_type TEXT NOT NULL,
  entry_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  pricing_tier TEXT,
  extra_fee_paid NUMERIC(10, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: monthly_billing_cycles
CREATE TABLE IF NOT EXISTS public.monthly_billing_cycles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TIMESTAMPTZ DEFAULT NOW(),
  closed_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  total_collected NUMERIC(12, 2) DEFAULT 0.00,
  total_pending_on_coaches NUMERIC(12, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: daily_shift_closings (Daily Drawer Closings)
CREATE TABLE IF NOT EXISTS public.daily_shift_closings (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  closing_day_date DATE,
  next_day_date DATE,
  shift_date_label TEXT,
  closed_at TIMESTAMPTZ DEFAULT NOW(),
  closed_by TEXT NOT NULL,
  total_direct_cash NUMERIC(12, 2) DEFAULT 0.00,
  total_repayments NUMERIC(12, 2) DEFAULT 0.00,
  total_pos_cash NUMERIC(12, 2) DEFAULT 0.00,
  total_physio_cash NUMERIC(12, 2) DEFAULT 0.00,
  total_expenses NUMERIC(12, 2) DEFAULT 0.00,
  expected_net_drawer_cash NUMERIC(12, 2) DEFAULT 0.00,
  actual_counted_cash NUMERIC(12, 2) DEFAULT 0.00,
  difference NUMERIC(12, 2) DEFAULT 0.00,
  total_coach_debts_loaded_today NUMERIC(12, 2) DEFAULT 0.00,
  total_coach_earnings_today NUMERIC(12, 2) DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: monthly_archives (Historical Snapshots for Offline Analytics)
CREATE TABLE IF NOT EXISTS public.monthly_archives (
  id TEXT PRIMARY KEY,
  month TEXT NOT NULL,
  closed_at TIMESTAMPTZ DEFAULT NOW(),
  closed_by TEXT NOT NULL,
  total_revenue NUMERIC(12, 2) DEFAULT 0.00,
  total_expenses NUMERIC(12, 2) DEFAULT 0.00,
  net_profit NUMERIC(12, 2) DEFAULT 0.00,
  total_pos_cash NUMERIC(12, 2) DEFAULT 0.00,
  master_entries_snapshot JSONB DEFAULT '[]'::JSONB,
  expenses_snapshot JSONB DEFAULT '[]'::JSONB,
  cash_inflows_snapshot JSONB DEFAULT '[]'::JSONB,
  trainer_transactions_snapshot JSONB DEFAULT '[]'::JSONB,
  pos_transactions_snapshot JSONB DEFAULT '[]'::JSONB,
  coach_debt_carry_over JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: yearly_archives (Annual Financial Archive)
CREATE TABLE IF NOT EXISTS public.yearly_archives (
  id TEXT PRIMARY KEY,
  year INT NOT NULL,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  archived_by TEXT NOT NULL,
  total_revenue NUMERIC(12, 2) DEFAULT 0.00,
  total_expenses NUMERIC(12, 2) DEFAULT 0.00,
  net_profit NUMERIC(12, 2) DEFAULT 0.00,
  total_check_ins INT DEFAULT 0,
  total_direct_subscriptions NUMERIC(12, 2) DEFAULT 0.00,
  total_coach_debts_loaded NUMERIC(12, 2) DEFAULT 0.00,
  total_coach_settlements NUMERIC(12, 2) DEFAULT 0.00,
  monthly_stats JSONB DEFAULT '[]'::JSONB,
  check_in_logs_snapshot JSONB DEFAULT '[]'::JSONB,
  master_entries_snapshot JSONB DEFAULT '[]'::JSONB,
  expenses_snapshot JSONB DEFAULT '[]'::JSONB,
  cash_inflows_snapshot JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_members_code ON public.members (code);
CREATE INDEX IF NOT EXISTS idx_members_active ON public.members (active);
CREATE INDEX IF NOT EXISTS idx_check_in_logs_member_id ON public.check_in_logs (member_id);
CREATE INDEX IF NOT EXISTS idx_check_in_logs_timestamp ON public.check_in_logs (timestamp);
CREATE INDEX IF NOT EXISTS idx_trainer_transactions_coach_id ON public.trainer_transactions (coach_id);
CREATE INDEX IF NOT EXISTS idx_trainer_transactions_status ON public.trainer_transactions (status);
CREATE INDEX IF NOT EXISTS idx_trainer_transactions_month ON public.trainer_transactions (month);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses (date);
CREATE INDEX IF NOT EXISTS idx_cash_inflows_date ON public.cash_inflows (date);
CREATE INDEX IF NOT EXISTS idx_master_report_month ON public.master_report_entries (month);
CREATE INDEX IF NOT EXISTS idx_daily_closings_date ON public.daily_shift_closings (date);
CREATE INDEX IF NOT EXISTS idx_pos_products_category ON public.pos_products (category);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_timestamp ON public.pos_transactions (timestamp);

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) & OPEN POLICIES
-- ==============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physio_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_in_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_inflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_report_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_billing_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_shift_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yearly_archives ENABLE ROW LEVEL SECURITY;

-- Allow anon and authenticated clients full access (for local/API SaaS usage)
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Public access on %I" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Public access on %I" ON public.%I FOR ALL USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;

-- ==============================================================================
-- 6. DEFAULT SEED DATA
-- ==============================================================================

-- 1. Default Admin User (المدير العام) & Receptionist (موظف الاستقبال)
INSERT INTO public.users (id, username, password, name, role, phone, active)
VALUES
  ('user-admin-1', 'admin', 'admin123', 'المدير العام', 'admin', '01000000001', true),
  ('user-reception-1', 'reception', 'rec123', 'كابتن الاستقبال', 'receptionist', '01000000002', true)
ON CONFLICT (username) DO NOTHING;

-- 2. Default Current Monthly Billing Cycle
INSERT INTO public.monthly_billing_cycles (id, name, start_date, is_active, total_collected, total_pending_on_coaches)
VALUES
  ('cycle-current', 'نوفمبر 2026', NOW(), true, 0.00, 0.00)
ON CONFLICT (id) DO NOTHING;

-- 3. Default Essential Bar Products
INSERT INTO public.pos_products (id, name, category, buy_price, sell_price, stock, low_stock_threshold, barcode)
VALUES
  ('prod-water-600', 'زجاجة مياه معدنية 600 مل', 'drinks', 5.00, 10.00, 48, 10, '62210001'),
  ('prod-iso-shake', 'شيك بروتين آيزوليت (شوكولاتة)', 'supplements', 45.00, 75.00, 15, 5, '62210002'),
  ('prod-bcaa-drink', 'مشروب طاقة BCAA منعش', 'drinks', 30.00, 50.00, 20, 5, '62210003'),
  ('prod-protein-bar', 'بروتين بار شوفان وفول سوداني', 'snacks', 25.00, 45.00, 24, 6, '62210004'),
  ('prod-creatine-mon', 'كرياتين مونوهيدرات 300 جم', 'supplements', 350.00, 500.00, 8, 3, '62210005')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 7. SUPABASE REALTIME CONFIGURATION (Multi-Device Live Sync)
-- ==============================================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE 
    public.check_in_logs,
    public.members,
    public.gym_sessions,
    public.physio_bookings,
    public.expenses,
    public.cash_inflows,
    public.pos_products,
    public.daily_shift_closings,
    public.trainer_transactions,
    public.master_report_entries;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN undefined_object THEN null;
END $$;

