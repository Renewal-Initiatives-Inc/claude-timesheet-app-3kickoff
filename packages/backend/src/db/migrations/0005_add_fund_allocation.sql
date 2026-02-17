-- Phase 2: Fund Allocation
-- Adds fund_id to timesheet_entries and creates local funds_cache table

-- 1. Add fund_id column to timesheet_entries (nullable — NULL = General Fund)
ALTER TABLE timesheet_entries
  ADD COLUMN IF NOT EXISTS fund_id INTEGER;

-- 2. Create local cache of financial-system funds (for dropdown rendering)
CREATE TABLE IF NOT EXISTS funds_cache (
  id            INTEGER PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  fund_code     VARCHAR(20) NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  cached_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
