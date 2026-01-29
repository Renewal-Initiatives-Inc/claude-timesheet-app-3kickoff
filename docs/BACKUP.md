# Backup & Recovery Procedures

## Overview

This document outlines backup and recovery procedures for the Renewal Initiatives Timesheet Application. Per REQ-022, all data must be retained for a minimum of 3 years.

---

## Automatic Backups

### Vercel Postgres

Vercel Postgres (powered by Neon) provides automatic backups:

| Plan  | Backup Frequency | Retention | Point-in-Time Recovery |
| ----- | ---------------- | --------- | ---------------------- |
| Hobby | Daily            | 7 days    | No                     |
| Pro   | Continuous       | 30 days   | Yes                    |

**Note**: For production use with compliance requirements, consider upgrading to Pro plan for point-in-time recovery.

### What's Automatically Backed Up

- All database tables and data
- Database schema and indexes
- Stored procedures (if any)

### What's NOT Automatically Backed Up

- Vercel Blob storage (documents)
- Environment variables
- Application code (use Git for this)

---

## Manual Backup Procedures

### Database Export

#### Full Database Backup

```bash
# Set the production DATABASE_URL
export DATABASE_URL="postgres://user:password@host:5432/database"

# Create timestamped backup
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup (recommended for larger databases)
pg_dump "$DATABASE_URL" | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

#### Critical Tables Only

For quick backups of essential compliance data:

```bash
pg_dump "$DATABASE_URL" \
  -t employees \
  -t timesheets \
  -t timesheet_entries \
  -t compliance_check_logs \
  -t payroll_records \
  > critical_$(date +%Y%m%d).sql
```

#### Export to CSV (for analysis)

```bash
# Export timesheets to CSV
psql "$DATABASE_URL" -c "\COPY timesheets TO 'timesheets_export.csv' WITH CSV HEADER"

# Export compliance logs
psql "$DATABASE_URL" -c "\COPY compliance_check_logs TO 'compliance_logs_export.csv' WITH CSV HEADER"
```

### Document Backup (Vercel Blob)

Vercel Blob storage is not automatically backed up. Implement monthly document export:

#### Option 1: Manual Download

1. Go to Vercel Dashboard → Storage → Blob
2. Download documents individually or use the list API

#### Option 2: Script-based Export

```typescript
// scripts/export-documents.ts
import { list, head } from '@vercel/blob';
import fs from 'fs';
import path from 'path';

async function exportDocuments() {
  const outputDir = `./document_backup_${new Date().toISOString().split('T')[0]}`;
  fs.mkdirSync(outputDir, { recursive: true });

  let cursor: string | undefined;
  do {
    const { blobs, cursor: nextCursor } = await list({ cursor });

    for (const blob of blobs) {
      const response = await fetch(blob.url);
      const buffer = await response.arrayBuffer();
      const filename = path.join(outputDir, blob.pathname);
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.writeFileSync(filename, Buffer.from(buffer));
      console.log(`Exported: ${blob.pathname}`);
    }

    cursor = nextCursor;
  } while (cursor);

  console.log(`Documents exported to: ${outputDir}`);
}

exportDocuments();
```

### Configuration Backup

```bash
# Export environment variables list (values redacted)
vercel env ls > env_variables_$(date +%Y%m%d).txt

# Export project settings
vercel project ls > project_settings_$(date +%Y%m%d).txt
```

---

## Recovery Procedures

### Full Database Restore

#### From SQL Backup

```bash
# 1. Create new database (if needed)
# Via Vercel Dashboard: Storage → Create Database

# 2. Set new DATABASE_URL
export NEW_DATABASE_URL="postgres://user:password@new-host:5432/database"

# 3. Restore from backup
psql "$NEW_DATABASE_URL" < backup_20240115.sql

# Or for compressed backup
gunzip -c backup_20240115.sql.gz | psql "$NEW_DATABASE_URL"

# 4. Update Vercel environment variable
vercel env rm DATABASE_URL production
vercel env add DATABASE_URL production
# Enter new connection string when prompted

# 5. Redeploy application
vercel --prod
```

#### Point-in-Time Recovery (Pro Plan)

1. Go to Vercel Dashboard → Storage → Your Database
2. Click "Branches" or "Recovery"
3. Select "Restore to point in time"
4. Choose the desired date/time
5. Click "Restore"
6. Wait for restoration to complete
7. Verify data integrity

### Partial Data Recovery

#### Restore Specific Tables

```bash
# Extract specific table from backup
pg_restore -t employees backup.dump > employees_only.sql

# Or use grep for SQL dumps
grep -A 1000 "COPY employees" backup.sql | grep -B 1000 "^\\\\\.$" > employees_data.sql

# Import to database
psql "$DATABASE_URL" < employees_only.sql
```

#### Restore to Different Environment

```bash
# Restore production backup to development
export DEV_DATABASE_URL="postgres://..."
psql "$DEV_DATABASE_URL" < production_backup.sql
```

### Document Recovery

1. Locate document backup folder
2. Re-upload documents via application UI
3. Or use Vercel Blob API:

```typescript
import { put } from '@vercel/blob';
import fs from 'fs';

async function restoreDocument(localPath: string, blobPath: string) {
  const fileBuffer = fs.readFileSync(localPath);
  const blob = await put(blobPath, fileBuffer, { access: 'public' });
  console.log(`Restored: ${blob.url}`);
}
```

---

## Backup Schedule

### Daily (Automatic)

- Vercel Postgres automatic backup
- Application logs retained

### Weekly (Manual)

- [ ] Verify automatic backup completed (check Vercel dashboard)
- [ ] Review backup integrity (spot check)

### Monthly (Manual)

| Task                              | Owner | Due          |
| --------------------------------- | ----- | ------------ |
| Export database to local storage  | Admin | 1st of month |
| Export documents from Vercel Blob | Admin | 1st of month |
| Test backup restoration           | Admin | 1st of month |
| Verify 3-year-old data accessible | Admin | Quarterly    |

### Backup Storage Locations

| Backup Type   | Primary Location   | Secondary Location    |
| ------------- | ------------------ | --------------------- |
| Database      | Vercel (automatic) | Local encrypted drive |
| Documents     | Vercel Blob        | Local encrypted drive |
| Code          | GitHub             | Local Git clone       |
| Env variables | Vercel             | Password manager      |

---

## Testing Backups

### Monthly Restoration Drill

Perform this test monthly to ensure backups are valid:

1. **Export production database**

   ```bash
   pg_dump "$PROD_DATABASE_URL" > test_restore.sql
   ```

2. **Create test database**
   - Use local PostgreSQL or Vercel preview database

3. **Restore backup**

   ```bash
   psql "$TEST_DATABASE_URL" < test_restore.sql
   ```

4. **Verify data integrity**

   ```sql
   -- Check record counts
   SELECT 'employees' as table_name, COUNT(*) as count FROM employees
   UNION ALL
   SELECT 'timesheets', COUNT(*) FROM timesheets
   UNION ALL
   SELECT 'compliance_check_logs', COUNT(*) FROM compliance_check_logs;

   -- Verify recent data present
   SELECT MAX(created_at) as latest_record FROM timesheets;
   ```

5. **Test application functionality**
   - Point local app at test database
   - Login as test user
   - View timesheets
   - Run compliance check

6. **Document results**
   - Record test date
   - Note any issues
   - Update procedures if needed

### Verification Checklist

- [ ] Backup file exists and is not zero bytes
- [ ] Backup can be decompressed (if compressed)
- [ ] Tables have expected row counts
- [ ] Recent data is present
- [ ] Application functions correctly with restored data
- [ ] Historical data (3+ years) is accessible

---

## Data Retention Policy

Per REQ-022, retain all data for minimum 3 years:

### Data Types and Retention

| Data Type                    | Retention Period          | Notes             |
| ---------------------------- | ------------------------- | ----------------- |
| Timesheets                   | 3 years minimum           | Never delete      |
| Timesheet entries            | 3 years minimum           | Never delete      |
| Compliance check logs        | 3 years minimum           | Audit trail       |
| Payroll records              | 3 years minimum           | Financial records |
| Employee records             | 3 years after termination | Include archived  |
| Documents (consent, permits) | 3 years minimum           | Legal requirement |
| Session data                 | 30 days                   | Can be purged     |
| Alerts                       | 1 year                    | Can be archived   |

### Soft Delete Policy

The application uses soft deletion for core records:

```sql
-- Records are marked inactive, not deleted
UPDATE employees SET status = 'archived' WHERE id = ?;

-- For audit queries, include archived records
SELECT * FROM employees WHERE status IN ('active', 'archived');
```

### Data Archival (Future)

For long-term retention beyond 3 years:

1. Export data older than 3 years to cold storage
2. Maintain searchable index
3. Document restoration procedure
4. Test restoration annually

---

## Disaster Recovery

### Scenario: Complete Data Loss

1. **Assess situation**
   - Determine cause (breach, corruption, deletion)
   - Identify affected systems

2. **Notify stakeholders**
   - Organization leadership
   - Affected users
   - Legal/compliance if required

3. **Recover from backup**
   - Identify most recent valid backup
   - Create new database instance
   - Restore data
   - Restore documents

4. **Verify recovery**
   - Run integrity checks
   - Test critical functionality
   - Compare record counts to pre-disaster

5. **Update systems**
   - Update DATABASE_URL
   - Redeploy application
   - Clear any caches

6. **Document incident**
   - Timeline of events
   - Data loss (if any)
   - Recovery steps taken
   - Lessons learned

### Recovery Time Objectives

| Scenario            | Target Recovery Time |
| ------------------- | -------------------- |
| Application outage  | < 15 minutes         |
| Database corruption | < 1 hour             |
| Complete data loss  | < 4 hours            |
| Document loss       | < 24 hours           |

---

## Contacts

### Backup Issues

- **Vercel Support**: support.vercel.com (hosting/database)
- **Postmark Support**: support.postmarkapp.com (email)
- **Organization IT**: [Contact TBD]

### Emergency Contacts

- **Primary Admin**: [Name/Email TBD]
- **Backup Admin**: [Name/Email TBD]

---

## Change Log

| Date       | Change           | Author              |
| ---------- | ---------------- | ------------------- |
| 2026-01-24 | Initial document | Phase 13 deployment |
