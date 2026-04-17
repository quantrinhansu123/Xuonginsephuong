-- Finance Schema - Sổ quỹ và Thu chi

-- 1. Bảng Sổ quỹ (Cash Accounts)
CREATE TABLE IF NOT EXISTS cash_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'cash', -- 'cash', 'bank', 'momo', 'other'
  account_number TEXT, -- Số tài khoản (nếu là bank)
  bank_name TEXT, -- Tên ngân hàng
  balance DECIMAL(15,2) DEFAULT 0, -- Số dư hiện tại
  currency TEXT DEFAULT 'VND',
  is_active BOOLEAN DEFAULT true,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Bảng Danh mục thu chi (Transaction Categories)
CREATE TABLE IF NOT EXISTS transaction_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'income', 'expense'
  parent_id UUID REFERENCES transaction_categories(id),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Bảng Giao dịch thu chi (Transactions)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- Mã giao dịch tự động: THU-00001, CHI-00001
  type TEXT NOT NULL, -- 'income', 'expense'
  category_id UUID REFERENCES transaction_categories(id),
  cash_account_id UUID REFERENCES cash_accounts(id) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  customer_id UUID REFERENCES customers(id), -- Khách hàng liên quan (nếu có)
  order_id UUID REFERENCES production_orders(id), -- Đơn hàng liên quan (nếu có)
  reference_type TEXT, -- 'order_payment', 'refund', 'salary', 'material', 'utility', 'other'
  reference_id TEXT, -- ID của đối tượng liên quan
  description TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by TEXT, -- User ID
  approved_by TEXT, -- User ID (duyệt giao dịch)
  status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'cancelled'
  note TEXT,
  attachment_url TEXT, -- URL file đính kèm (hóa đơn, phiếu thu...)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Bảng Lịch sử số dư (Balance History)
CREATE TABLE IF NOT EXISTS balance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_account_id UUID REFERENCES cash_accounts(id) NOT NULL,
  transaction_id UUID REFERENCES transactions(id),
  balance_before DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  change_amount DECIMAL(15,2) NOT NULL,
  change_type TEXT NOT NULL, -- 'income', 'expense', 'transfer_in', 'transfer_out', 'adjustment'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Bảng Chuyển khoản nội bộ (Internal Transfers)
CREATE TABLE IF NOT EXISTS internal_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  from_account_id UUID REFERENCES cash_accounts(id) NOT NULL,
  to_account_id UUID REFERENCES cash_accounts(id) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  description TEXT,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by TEXT,
  status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'cancelled'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default cash accounts
INSERT INTO cash_accounts (code, name, type, balance) VALUES
('TK-TM', 'Tiền mặt tại quỹ', 'cash', 0),
('TK-NH-VCB', 'Tài khoản VCB', 'bank', 0),
('TK-NH-TCB', 'Tài khoản Techcombank', 'bank', 0),
('TK-MOMO', 'Ví MoMo', 'momo', 0)
ON CONFLICT (code) DO NOTHING;

-- Insert default transaction categories
INSERT INTO transaction_categories (code, name, type, description) VALUES
-- Thu
('THU-DH', 'Thu tiền đơn hàng', 'income', 'Khách thanh toán đơn hàng'),
('THU-TT', 'Thu tiền tạm ứng', 'income', 'Khách tạm ứng'),
('THU-CU', 'Thu công nợ cũ', 'income', 'Thu hồi công nợ'),
('THU-KHAC', 'Thu khác', 'income', 'Các khoản thu khác'),

-- Chi
('CHI-VL', 'Chi mua vật liệu', 'expense', 'Mua nguyên vật liệu in'),
('CHI-LUONG', 'Chi lương nhân viên', 'expense', 'Trả lương nhân viên'),
('CHI-DV', 'Chi dịch vụ', 'expense', 'Điện, nước, internet, thuê mặt bằng'),
('CHI-VANHANH', 'Chi vận hành', 'expense', 'Chi phí vận hành máy móc, bảo trì'),
('CHI-HOAN', 'Hoàn tiền khách', 'expense', 'Hoàn tiền cho khách hàng'),
('CHI-KHAC', 'Chi khác', 'expense', 'Các khoản chi khác')
ON CONFLICT (code) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_cash_account ON transactions(cash_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_order ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_balance_history_account ON balance_history(cash_account_id);
CREATE INDEX IF NOT EXISTS idx_balance_history_date ON balance_history(created_at);

-- Function to generate transaction code
CREATE OR REPLACE FUNCTION generate_transaction_code(tx_type TEXT)
RETURNS TEXT AS $$
DECLARE
  prefix TEXT := CASE WHEN tx_type = 'income' THEN 'THU' ELSE 'CHI' END;
  next_num INTEGER;
  new_code TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 5) AS INTEGER)), 0) + 1
  INTO next_num
  FROM transactions
  WHERE type = tx_type AND code LIKE prefix || '-%';
  
  new_code := prefix || '-' || LPAD(next_num::TEXT, 5, '0');
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update balance after transaction
CREATE OR REPLACE FUNCTION update_balance_after_transaction()
RETURNS TRIGGER AS $$
DECLARE
  old_balance DECIMAL(15,2);
  new_balance DECIMAL(15,2);
BEGIN
  -- Get current balance
  SELECT balance INTO old_balance FROM cash_accounts WHERE id = NEW.cash_account_id;
  
  -- Calculate new balance
  IF NEW.type = 'income' THEN
    new_balance := old_balance + NEW.amount;
  ELSE
    new_balance := old_balance - NEW.amount;
  END IF;
  
  -- Update cash account balance
  UPDATE cash_accounts SET balance = new_balance, updated_at = NOW() WHERE id = NEW.cash_account_id;
  
  -- Record balance history
  INSERT INTO balance_history (cash_account_id, transaction_id, balance_before, balance_after, change_amount, change_type)
  VALUES (NEW.cash_account_id, NEW.id, old_balance, new_balance, NEW.amount, NEW.type);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists, then create
DROP TRIGGER IF EXISTS trg_update_balance ON transactions;
CREATE TRIGGER trg_update_balance
AFTER INSERT OR UPDATE ON transactions
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION update_balance_after_transaction();

-- Function to handle transaction cancellation
CREATE OR REPLACE FUNCTION handle_transaction_cancel()
RETURNS TRIGGER AS $$
DECLARE
  old_balance DECIMAL(15,2);
  new_balance DECIMAL(15,2);
BEGIN
  IF OLD.status = 'completed' AND NEW.status = 'cancelled' THEN
    -- Get current balance
    SELECT balance INTO old_balance FROM cash_accounts WHERE id = NEW.cash_account_id;
    
    -- Reverse the transaction
    IF NEW.type = 'income' THEN
      new_balance := old_balance - NEW.amount;
    ELSE
      new_balance := old_balance + NEW.amount;
    END IF;
    
    -- Update cash account balance
    UPDATE cash_accounts SET balance = new_balance, updated_at = NOW() WHERE id = NEW.cash_account_id;
    
    -- Record balance history
    INSERT INTO balance_history (cash_account_id, transaction_id, balance_before, balance_after, change_amount, change_type)
    VALUES (NEW.cash_account_id, NEW.id, old_balance, new_balance, -NEW.amount, 'adjustment');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_handle_cancel ON transactions;
CREATE TRIGGER trg_handle_cancel
AFTER UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION handle_transaction_cancel();

