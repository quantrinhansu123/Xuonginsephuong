-- SQL schema for Machine Maintenance Logs
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS machine_maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID REFERENCES machines(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'repair', 'maintenance'
  description TEXT,
  cost DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE machine_maintenance_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users (following the project pattern)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'machine_maintenance_logs' AND policyname = 'Allow all for authenticated') THEN
        CREATE POLICY "Allow all for authenticated" ON machine_maintenance_logs FOR ALL TO authenticated USING (true);
    END IF;
END $$;

-- Insert some dummy data for the Konica machines
INSERT INTO machine_maintenance_logs (machine_id, type, description, cost, created_at)
SELECT id, 'maintenance', 'Bảo trì định kỳ, thay mực và vệ sinh cụm sấy', 1500000, NOW() - INTERVAL '5 days'
FROM machines WHERE code = 'KM-01' LIMIT 1;

INSERT INTO machine_maintenance_logs (machine_id, type, description, cost, created_at)
SELECT id, 'repair', 'Sửa lỗi kẹt giấy khay 2, thay lô cuốn', 800000, NOW() - INTERVAL '12 days'
FROM machines WHERE code = 'KM-01' LIMIT 1;
