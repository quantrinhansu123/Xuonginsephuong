-- Schema Update for Dynamic Configuration

-- 1. Add permissions column to departments table
ALTER TABLE departments ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT ARRAY['tasks'];

-- 1.1 Add material allocation snapshot on orders
-- Lưu danh sách vật tư đã cấp phát từ kho theo từng LSX
-- Ví dụ:
-- [
--   { "material_id": 12, "name": "Giấy C300", "unit": "Tờ", "quantity": 1500 }
-- ]
ALTER TABLE production_orders
ADD COLUMN IF NOT EXISTS material_allocations JSONB DEFAULT '[]'::jsonb;

-- 2. Add workflow_templates table for configurable workflows
CREATE TABLE IF NOT EXISTS workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  department_sequence INTEGER[] NOT NULL, -- Array of department IDs in order
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Add machines table
CREATE TABLE IF NOT EXISTS machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT, -- 'Digital', 'Offset', 'Processing'
  department_id INTEGER REFERENCES departments(id),
  status TEXT DEFAULT 'active', -- 'active', 'maintenance', 'inactive'
  specs JSONB, -- Additional specs like max_size, speed, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Update departments with permissions
UPDATE departments SET permissions = ARRAY['tasks'] WHERE permissions IS NULL;

-- Kho 2 has additional warehouse permission
UPDATE departments SET permissions = ARRAY['tasks', 'warehouse'] WHERE code = 'WH2';

-- 5. Insert default workflow templates
INSERT INTO workflow_templates (name, description, department_sequence) VALUES
('Tầng 1 → Tầng 3 → Kho 2', 'Quy trình in kỹ thuật số cơ bản', ARRAY[2, 3, 7]),
('Tầng G → Tầng 1 → Tầng 3 → Kho 2', 'Quy trình có chuẩn bị', ARRAY[1, 2, 3, 7]),
('Tầng 1 → Tầng 4 → Tầng 5 → Kho 2', 'Quy trình gia công phức tạp', ARRAY[2, 4, 5, 7]),
('In Offset → Tầng 3 → Kho 2', 'Quy trình in offset', ARRAY[6, 3, 7]),
('Tầng G → In Offset → Tầng 3 → Kho 2', 'Quy trình offset có chuẩn bị', ARRAY[1, 6, 3, 7]),
('Tầng 1 → Tầng 3', 'Quy trình ngắn không qua kho', ARRAY[2, 3]),
('In Offset → Kho 2', 'Quy trình offset ngắn', ARRAY[6, 7]),
('Tầng G → Kho 2', 'Quy trình trực tiếp', ARRAY[1, 7]),
('Tầng 1 → Kho 2', 'Quy trình nhanh', ARRAY[2, 7])
ON CONFLICT DO NOTHING;

-- 6. Insert default machines
INSERT INTO machines (code, name, type, department_id, status) VALUES
-- Tầng 1 - Digital Printing
('KM-01', 'Konica 6120', 'Digital', 2, 'active'),
('KM-02', 'Konica 1085', 'Digital', 2, 'active'),
('KM-03', 'Ricoh Pro C5200', 'Digital', 2, 'active'),

-- Tầng G - Preparation
('PREP-01', 'Máy cắt giấy', 'Processing', 1, 'active'),

-- Tầng 3 - Processing
('LP-01', 'Máy bế', 'Processing', 3, 'active'),
('GL-01', 'Máy dán keo', 'Processing', 3, 'active'),
('LM-01', 'Máy cán màng', 'Processing', 3, 'active'),

-- Tầng 4 - Processing
('BN-01', 'Máy đóng ghim', 'Processing', 4, 'active'),
('BN-02', 'Máy khâu chỉ', 'Processing', 4, 'active'),

-- Tầng 5 - Processing
('FOLD-01', 'Máy gấp', 'Processing', 5, 'active'),

-- In Offset
('OS-01', 'Offset 4 Màu Heidelberg', 'Offset', 6, 'active'),
('OS-02', 'Offset 2 Màu', 'Offset', 6, 'active')

ON CONFLICT (code) DO NOTHING;

-- 7. Add valid_first_step column to departments
ALTER TABLE departments ADD COLUMN IF NOT EXISTS is_entry_point BOOLEAN DEFAULT false;

-- 8. Add display step label for workflow ordering
ALTER TABLE departments ADD COLUMN IF NOT EXISTS step_name TEXT;

-- 9. RLS policies for workflow_templates (for app client access)
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflow_templates_select_all ON workflow_templates;
CREATE POLICY workflow_templates_select_all
  ON workflow_templates
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS workflow_templates_insert_all ON workflow_templates;
CREATE POLICY workflow_templates_insert_all
  ON workflow_templates
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS workflow_templates_update_all ON workflow_templates;
CREATE POLICY workflow_templates_update_all
  ON workflow_templates
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS workflow_templates_delete_all ON workflow_templates;
CREATE POLICY workflow_templates_delete_all
  ON workflow_templates
  FOR DELETE
  USING (true);

-- Mark entry point departments
UPDATE departments SET is_entry_point = true WHERE code IN ('FLG', 'FL1', 'OFFSET');
