-- Add requires_password_change column to employees table
-- This flag indicates whether an employee must change their password on next login
ALTER TABLE employees ADD COLUMN requires_password_change BOOLEAN NOT NULL DEFAULT false;
