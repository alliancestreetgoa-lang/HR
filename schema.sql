-- ============================================================
--  Multi-Company HR Management System — PostgreSQL Schema
-- ============================================================

-- Companies
CREATE TABLE IF NOT EXISTS companies (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  address      TEXT DEFAULT '',
  contact      TEXT DEFAULT '',
  currency     TEXT DEFAULT '₹',
  working_days TEXT DEFAULT 'auto',
  logo         TEXT DEFAULT '',
  ot_rate      NUMERIC(10,2) DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  company_id   TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  designation  TEXT DEFAULT '',
  department   TEXT DEFAULT '',
  join_date    DATE,
  salary       NUMERIC(14,2) DEFAULT 0,
  phone        TEXT DEFAULT '',
  bank         TEXT DEFAULT '',
  pan          TEXT DEFAULT '',
  allowance    NUMERIC(14,2) DEFAULT 0,
  deduction    NUMERIC(14,2) DEFAULT 0,
  PRIMARY KEY (company_id, code)
);

-- Attendance  (one row per employee per date)
CREATE TABLE IF NOT EXISTS attendance (
  company_id     TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_code  TEXT NOT NULL,
  att_date       DATE NOT NULL,
  status         TEXT NOT NULL,   -- P A H PL ML
  PRIMARY KEY (company_id, employee_code, att_date)
);

-- Overtime
CREATE TABLE IF NOT EXISTS overtime (
  company_id     TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_code  TEXT NOT NULL,
  ot_date        DATE NOT NULL,
  hours          NUMERIC(6,2) DEFAULT 0,
  PRIMARY KEY (company_id, employee_code, ot_date)
);

-- Holidays
CREATE TABLE IF NOT EXISTS holidays (
  company_id  TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  hol_date    DATE NOT NULL,
  name        TEXT NOT NULL,
  PRIMARY KEY (company_id, hol_date)
);

-- Leave requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id             TEXT PRIMARY KEY,
  company_id     TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_code  TEXT NOT NULL,
  type           TEXT NOT NULL,      -- PL ML A H
  from_date      DATE NOT NULL,
  to_date        DATE NOT NULL,
  reason         TEXT DEFAULT '',
  status         TEXT DEFAULT 'pending',  -- pending approved rejected
  submitted_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Payroll runs  (one per company per month)
CREATE TABLE IF NOT EXISTS payroll_runs (
  id           SERIAL PRIMARY KEY,
  company_id   TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  month        TEXT NOT NULL,        -- YYYY-MM
  run_date     DATE DEFAULT CURRENT_DATE,
  total_gross  NUMERIC(16,2) DEFAULT 0,
  total_net    NUMERIC(16,2) DEFAULT 0,
  notes        TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, month)
);

-- Payments  (one per employee per payroll run)
CREATE TABLE IF NOT EXISTS payments (
  id                SERIAL PRIMARY KEY,
  company_id        TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payroll_run_id    INTEGER REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_code     TEXT NOT NULL,
  month             TEXT NOT NULL,          -- YYYY-MM
  working_days      NUMERIC(5,1) DEFAULT 0,
  payable_days      NUMERIC(6,2) DEFAULT 0,
  basic_earned      NUMERIC(14,2) DEFAULT 0,
  allowance_earned  NUMERIC(14,2) DEFAULT 0,
  ot_amount         NUMERIC(14,2) DEFAULT 0,
  gross_amount      NUMERIC(14,2) DEFAULT 0,
  statutory_deduct  NUMERIC(14,2) DEFAULT 0,
  advance_deducted  NUMERIC(14,2) DEFAULT 0,
  net_amount        NUMERIC(14,2) DEFAULT 0,
  status            TEXT DEFAULT 'pending',  -- pending paid hold
  payment_mode      TEXT DEFAULT '',          -- bank cash cheque upi
  payment_date      DATE,
  remarks           TEXT DEFAULT '',
  UNIQUE (company_id, employee_code, month)
);

-- Advances / Loans
CREATE TABLE IF NOT EXISTS advances (
  id                  SERIAL PRIMARY KEY,
  company_id          TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_code       TEXT NOT NULL,
  amount              NUMERIC(14,2) NOT NULL,
  reason              TEXT DEFAULT '',
  given_date          DATE DEFAULT CURRENT_DATE,
  repayment_months    INTEGER DEFAULT 1,
  monthly_deduction   NUMERIC(14,2) DEFAULT 0,
  amount_recovered    NUMERIC(14,2) DEFAULT 0,
  status              TEXT DEFAULT 'active',   -- active cleared
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common lookups
CREATE INDEX IF NOT EXISTS idx_att_company_date    ON attendance(company_id, att_date);
CREATE INDEX IF NOT EXISTS idx_att_company_emp     ON attendance(company_id, employee_code);
CREATE INDEX IF NOT EXISTS idx_payments_company    ON payments(company_id, month);
CREATE INDEX IF NOT EXISTS idx_advances_company    ON advances(company_id, employee_code);
CREATE INDEX IF NOT EXISTS idx_leaves_company      ON leave_requests(company_id, status);
