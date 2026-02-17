-- Phase 4: Staging Record Submission — local tracking table
-- Tracks what staging_records were submitted to financial-system per timesheet

CREATE TABLE staging_sync_status (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timesheet_id    UUID NOT NULL REFERENCES timesheets(id) ON DELETE RESTRICT,
  source_record_id VARCHAR(255) NOT NULL,  -- e.g., ts_{timesheetId}_fund_{fundId}
  fund_id         INTEGER NOT NULL,         -- mirrors financial-system funds.id
  amount          NUMERIC(12,2) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'received',
  metadata        JSONB,
  synced_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_checked_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(timesheet_id, fund_id)
);

CREATE INDEX idx_staging_sync_timesheet ON staging_sync_status(timesheet_id);
