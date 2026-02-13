-- Add optional notes field to timesheet entries for invoice justification
ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS notes TEXT;
