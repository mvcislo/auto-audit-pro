
-- Tables for AutoAudit Pro

-- 1. Appraisers
CREATE TABLE IF NOT EXISTS appraisers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Technicians
CREATE TABLE IF NOT EXISTS technicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tech_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Standards
CREATE TABLE IF NOT EXISTS standards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL UNIQUE,
    file_name TEXT,
    upload_date BIGINT,
    extracted_rules TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Inspection Cases
CREATE TABLE IF NOT EXISTS inspection_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp BIGINT NOT NULL,
    mode TEXT NOT NULL,
    vehicle JSONB NOT NULL,
    data JSONB NOT NULL,
    analysis TEXT,
    detected_total NUMERIC,
    current_status TEXT NOT NULL,
    status_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Settings (e.g., brand)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Initial Brand
INSERT INTO settings (key, value) VALUES ('dealership_brand', 'Honda') ON CONFLICT (key) DO NOTHING;
