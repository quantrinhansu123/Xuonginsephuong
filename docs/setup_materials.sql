-- SQL update for Materials management
-- Run this in your Supabase SQL Editor

-- 1. Add category column if not exists
ALTER TABLE materials ADD COLUMN IF NOT EXISTS category text DEFAULT 'Giấy';
ALTER TABLE materials ADD COLUMN IF NOT EXISTS unit_price numeric DEFAULT 0;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS supplier text;

-- 2. Ensure RLS is active (Safety first)
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- 3. Create simple policies if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'materials' AND policyname = 'Allow all for authenticated') THEN
        CREATE POLICY "Allow all for authenticated" ON materials FOR ALL TO authenticated USING (true);
    END IF;
END $$;

-- 4. Initial categories suggestion: 'Giấy', 'Mực', 'Khuôn in', 'Vật tư phụ', 'Hóa chất'
