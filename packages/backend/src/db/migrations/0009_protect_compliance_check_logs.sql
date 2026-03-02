-- Append-only protection for compliance_check_logs (§7.3 audit trail integrity)
-- Prevents deletion and modification of audit records at the database level.

CREATE OR REPLACE FUNCTION prevent_compliance_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'compliance_check_logs rows cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER compliance_check_logs_no_delete
  BEFORE DELETE ON "compliance_check_logs"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_compliance_log_modification();

CREATE TRIGGER compliance_check_logs_no_update
  BEFORE UPDATE ON "compliance_check_logs"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_compliance_log_modification();
