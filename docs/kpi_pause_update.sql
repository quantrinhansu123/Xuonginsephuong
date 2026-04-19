
-- Schema Update: KPI and Pause Logic Improvements
-- Run this if your 'tasks' table is missing timing and KPI columns

-- 1. Ensure tasks table has KPI and timing columns
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS kpi_start_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS hold_start_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS total_hold_seconds INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_duration_seconds INTEGER DEFAULT 0;

-- 2. Add transition tracking columns if missing
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS kpi_transferred_to INTEGER REFERENCES departments(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS kpi_transferred_at TIMESTAMP WITH TIME ZONE;

-- 3. Comments for clarity
COMMENT ON COLUMN tasks.hold_start_time IS 'Thời điểm bắt đầu tạm hoãn hoặc báo sự cố';
COMMENT ON COLUMN tasks.total_hold_seconds IS 'Tổng cộng thời gian gián đoạn đã tích lũy (không tính lần hoãn hiện tại)';
COMMENT ON COLUMN tasks.estimated_duration_seconds IS 'Thời gian dự kiến hoàn thành công đoạn (KPI) tính bằng giây';
