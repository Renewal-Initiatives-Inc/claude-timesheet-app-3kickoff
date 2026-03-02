-- Drop legacy password_hash column (auth now handled by Zitadel SSO)
ALTER TABLE employees DROP COLUMN IF EXISTS password_hash;
