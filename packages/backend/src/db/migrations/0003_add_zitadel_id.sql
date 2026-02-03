-- Add zitadel_id column for Zitadel SSO integration (Phase 7)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS zitadel_id VARCHAR(255) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_employees_zitadel_id ON employees(zitadel_id);
