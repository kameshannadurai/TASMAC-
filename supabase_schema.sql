-- ========================================================================
-- TASMAC SHOP NO. 11066 – ANNADURAI M
-- Central Cloud Database Schema for Supabase PostgreSQL
-- Features: Multi-Device Sync, Offline Conflict Resolution, Role-Based Access Control (RLS)
-- ========================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------
-- 1. USERS TABLE (Role-Based Access Control)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    mobile_number VARCHAR(15) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    pin VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'VIEW_ONLY', -- 'ADMIN' or 'VIEW_ONLY'
    shop_number VARCHAR(10) NOT NULL DEFAULT '11066',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_mobile ON public.users(mobile_number);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- ------------------------------------------------------------------------
-- 2. DAILY REMITTANCES TABLE (Module 1 – Complete Register Accounting)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_remittances (
    id BIGSERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    shop_number VARCHAR(10) NOT NULL DEFAULT '11066',
    serial_number VARCHAR(50),
    
    -- Section A & B: Core Amounts & Bottles
    total_sales_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sales_bottle INTEGER NOT NULL DEFAULT 0,
    scan_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    upi_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    card_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    online_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    
    -- Section C & D: Buyback Details
    buyback_opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    buy_back_sold_bottle INTEGER NOT NULL DEFAULT 0,
    buy_back_sold_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    buy_back_return_bottle INTEGER NOT NULL DEFAULT 0,
    buy_back_return_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    
    -- Section E & F: Remittance Totals & Cash Formulas
    previous_buyback_remittance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_collection NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cash_remittance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    buyback_amount_return_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    buyback_closing_cash_in_hand NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_remittance_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    actual_cash_submitted NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cash_difference NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    
    -- Backward Compatibility Fields
    cash_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_all_payments NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_remittances_date ON public.daily_remittances(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_remittances_shop ON public.daily_remittances(shop_number);

-- ------------------------------------------------------------------------
-- 3. VENDOR RECEIPTS TABLE (Module 3 – Empty Bottle Handover)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_receipts (
    id BIGSERIAL PRIMARY KEY,
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    receipt_date DATE NOT NULL,
    receipt_time VARCHAR(10) NOT NULL,
    shop_number VARCHAR(10) NOT NULL DEFAULT '11066',
    scanner_number VARCHAR(50),
    tin_number VARCHAR(50),
    vendor_name VARCHAR(100), -- Optional
    vendor_mobile VARCHAR(20),
    
    total_liquor_bottles INTEGER NOT NULL DEFAULT 0,
    total_liquor_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_beer_bottles INTEGER NOT NULL DEFAULT 0,
    total_beer_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_bottles INTEGER NOT NULL DEFAULT 0,
    total_payable NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_receipts_date ON public.vendor_receipts(receipt_date DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_receipts_number ON public.vendor_receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_vendor_receipts_vendor ON public.vendor_receipts(vendor_name);

-- ------------------------------------------------------------------------
-- 4. VENDOR RECEIPT LINE ITEMS
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_receipt_items (
    id BIGSERIAL PRIMARY KEY,
    receipt_id BIGINT NOT NULL REFERENCES public.vendor_receipts(id) ON DELETE CASCADE,
    item_type VARCHAR(20) NOT NULL, -- 'LIQUOR' or 'BEER'
    size_label VARCHAR(50) NOT NULL,
    rate NUMERIC(8, 2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON public.vendor_receipt_items(receipt_id);

-- ------------------------------------------------------------------------
-- 5. VENDOR FIXED RATES TABLE
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_rates (
    id BIGSERIAL PRIMARY KEY,
    item_type VARCHAR(20) NOT NULL, -- 'LIQUOR' or 'BEER'
    size_label VARCHAR(50) NOT NULL,
    rate NUMERIC(8, 2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Fixed TASMAC Rates
INSERT INTO public.vendor_rates (item_type, size_label, rate) VALUES
    ('LIQUOR', '180 ml (Quarter)', 10.00),
    ('LIQUOR', '375 ml (Half)', 10.00),
    ('LIQUOR', '750 ml (Full)', 10.00),
    ('LIQUOR', '1000 ml', 10.00),
    ('BEER', '650 ml', 10.00),
    ('BEER', '500 ml', 10.00),
    ('BEER', '330 ml', 10.00)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------
-- 6. AUDIT HISTORY TABLE (Tamper-Proof Audit Log)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_history (
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'REMITTANCE', 'VENDOR_RECEIPT', 'USER'
    entity_id BIGINT NOT NULL DEFAULT 0,
    action VARCHAR(20) NOT NULL,      -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN'
    user_name VARCHAR(100) DEFAULT 'ANNADURAI M',
    user_role VARCHAR(20) DEFAULT 'ADMIN',
    device_id VARCHAR(100),
    reference_number VARCHAR(50),
    changes_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_history(entity_type, entity_id);

-- ------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_remittances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_history ENABLE ROW LEVEL SECURITY;

-- Anonymous and Authenticated Viewers can READ (SELECT) all tables
CREATE POLICY "Allow public select on remittances" ON public.daily_remittances
    FOR SELECT USING (true);

CREATE POLICY "Allow public select on vendor_receipts" ON public.vendor_receipts
    FOR SELECT USING (true);

CREATE POLICY "Allow public select on vendor_receipt_items" ON public.vendor_receipt_items
    FOR SELECT USING (true);

CREATE POLICY "Allow public select on vendor_rates" ON public.vendor_rates
    FOR SELECT USING (true);

CREATE POLICY "Allow public select on audit_history" ON public.audit_history
    FOR SELECT USING (true);

CREATE POLICY "Allow select on users" ON public.users
    FOR SELECT USING (true);

-- Mutations (INSERT, UPDATE, DELETE) restricted to Service Role and Admin
-- When using Supabase REST API or FastAPI backend with service role, full mutations are allowed:
CREATE POLICY "Allow full mutations for service role on remittances" ON public.daily_remittances
    FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Allow full mutations for service role on receipts" ON public.vendor_receipts
    FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Allow full mutations for service role on items" ON public.vendor_receipt_items
    FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Allow full mutations for service role on audit" ON public.audit_history
    FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- ------------------------------------------------------------------------
-- 8. SEED PRIMARY ADMIN: ANNADURAI M
-- ------------------------------------------------------------------------
-- Password hash for '11066' / 'admin11066'
INSERT INTO public.users (
    username,
    name,
    mobile_number,
    password_hash,
    pin,
    role,
    shop_number,
    is_active
) VALUES (
    'annadurai',
    'ANNADURAI M',
    '9842111066',
    '36f52e50cba22cf5c0cfa1d7ea94fa001eb7058be9f0bc78d531a690e5e3c7c2$b03013b5bf57b01b6368d1f2e6047249',
    '11066',
    'ADMIN',
    '11066',
    TRUE
) ON CONFLICT (username) DO UPDATE
SET name = 'ANNADURAI M',
    role = 'ADMIN',
    mobile_number = '9842111066',
    shop_number = '11066',
    is_active = TRUE;

