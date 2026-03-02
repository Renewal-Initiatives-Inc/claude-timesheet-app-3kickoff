-- Change date_of_birth from date to text to store AES-256-GCM encrypted values.
-- After applying, run: npx tsx scripts/encrypt-dob.ts to encrypt existing values.
ALTER TABLE employees ALTER COLUMN date_of_birth TYPE text USING date_of_birth::text;
