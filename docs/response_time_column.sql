-- Thêm cột lưu thời gian phản hồi vào bảng tasks
-- Response time = Thời gian từ khi giao việc (ready_at) đến khi xác nhận (start_time)

-- 1. Thêm cột response_time_minutes
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS response_time_minutes INTEGER;

-- 2. Tạo function tự động tính response_time khi start_time được cập nhật
CREATE OR REPLACE FUNCTION calculate_response_time()
RETURNS TRIGGER AS $$
BEGIN
  -- Chỉ tính khi start_time được set và ready_at đã có
  IF NEW.start_time IS NOT NULL AND NEW.ready_at IS NOT NULL THEN
    -- Tính số phút từ ready_at đến start_time
    NEW.response_time_minutes := EXTRACT(EPOCH FROM (NEW.start_time - NEW.ready_at)) / 60;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Tạo trigger để tự động tính response_time
DROP TRIGGER IF EXISTS trg_calculate_response_time ON tasks;
CREATE TRIGGER trg_calculate_response_time
  BEFORE INSERT OR UPDATE OF start_time, ready_at ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION calculate_response_time();

-- 4. Cập nhật response_time cho các task hiện có (nếu có)
UPDATE tasks
SET response_time_minutes = EXTRACT(EPOCH FROM (start_time - ready_at)) / 60
WHERE start_time IS NOT NULL 
  AND ready_at IS NOT NULL 
  AND response_time_minutes IS NULL;

-- 5. Tạo index để query nhanh hơn
CREATE INDEX IF NOT EXISTS idx_tasks_response_time ON tasks(response_time_minutes);

-- 6. Comment mô tả
COMMENT ON COLUMN tasks.response_time_minutes IS 'Thời gian phản hồi (phút) = start_time - ready_at. Được tự động tính bởi trigger.';

-- Test query: Xem các task có response time chậm (> 30 phút)
-- SELECT 
--   t.id,
--   po.code as order_code,
--   d.name as department,
--   t.response_time_minutes,
--   t.ready_at,
--   t.start_time
-- FROM tasks t
-- JOIN production_orders po ON t.order_id = po.id
-- JOIN departments d ON t.department_id = d.id
-- WHERE t.response_time_minutes > 30
-- ORDER BY t.response_time_minutes DESC;
