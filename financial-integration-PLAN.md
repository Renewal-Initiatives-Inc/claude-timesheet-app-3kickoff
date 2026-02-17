# Financial System Integration — Plan

**Status:** Phases 1-5 Code Complete — Phase 6 (Testing) Remaining
**Last Updated:** 2026-02-17
**Author:** Jeff + Claude
**Traces to:** INT-P0-001, INT-P0-004, INT-P0-005, INT-P0-006, INT-P0-007

> **Protocol**: Start new sessions with: `@financial-integration-PLAN.md Continue.`

---

## 1. Problem Statement

renewal-timesheets calculates payroll internally but the data stays siloed — it never flows to financial-system for GL posting, fund accounting, or payment matching. We need to add fund allocation per time entry, read compensation data from app-portal, and write staging records to financial-system's DB on timesheet approval.

---

## 2. What Exists Today (renewal-timesheets)

| Layer | What's There | Key Files |
|-------|-------------|-----------|
| Schema | `timesheets`, `timesheet_entries`, `payroll_records`, `task_codes`, `task_code_rates` | `packages/backend/src/db/schema/` |
| Payroll engine | Calculates hours by category (agricultural/non-ag/overtime), earnings using task code rates | `packages/backend/src/services/payroll.service.ts` |
| Approval flow | Supervisor approves → payroll records generated | `packages/backend/src/services/review.service.ts` |
| Export | CSV export of payroll records | `packages/backend/src/utils/payroll-export.ts` |
| Auth | JWT + Zitadel OIDC (`zitadelId` on employees) | `packages/backend/src/middleware/` |
| Env vars | `DATABASE_URL`, `JWT_SECRET`, `POSTMARK_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET` | `.env.example` |

**What does NOT exist yet:**
- No fund concept (all entries are un-allocated)
- No connection to financial-system DB
- No connection to app-portal DB for compensation data
- No staging record writes
- No status read-back from financial-system

---

## 3. What Gets Built

### Overview

```
                   ┌─────────────────┐
                   │   app-portal    │
                   │  (Neon Postgres) │
                   │                 │
                   │  employees tbl  │
                   │  compensation,  │
                   │  hourly rate    │
                   └────────┬────────┘
                            │ READ (timesheets_reader role)
                            ▼
┌───────────────────────────────────────────────────┐
│              renewal-timesheets                    │
│                                                    │
│  1. Time entry + fund selection                   │
│  2. Read comp data → calculate earnings           │
│  3. On approval → aggregate by fund               │
│  4. INSERT staging_records per fund               │
│  5. Read status back for display                  │
└───────────────────────────────┬───────────────────┘
                                │ WRITE (timesheets_role)
                                ▼
                   ┌─────────────────┐
                   │ financial-system │
                   │ (Neon Postgres)  │
                   │                  │
                   │ staging_records  │
                   │ funds (ref)      │
                   │ accounts (ref)   │
                   └─────────────────┘
```

---

## 4. Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Add `fund_id` column to `timesheet_entries` table | Fund allocation is per-entry, not per-timesheet (employee may split hours across funds) |
| D2 | Fund dropdown populated from financial-system's `funds` table (cached) | Source of truth lives in financial-system; cache locally to avoid cross-DB reads on every form render |
| D3 | Default fund = General Fund (Unrestricted) | Per D-024 in financial-system design; fund selection is optional |
| D4 | Read compensation data from app-portal at approval time | Hourly rate must come from app-portal (single source of truth for comp), not duplicated in timesheets |
| D5 | Staging INSERT happens inside the approval transaction | If staging write fails, approval should fail too — supervisor sees the error and can retry |
| D6 | One staging_records row per fund per timesheet | Financial-system processes per-fund; aggregation happens at write time |
| D7 | Use separate Drizzle instances for each external DB | Each connection uses a restricted Postgres role with minimal permissions |

---

## 5. Environment Variables to Add

```bash
# ── Cross-DB: financial-system (Neon) ──
# Connection using timesheets_role (SELECT on funds/accounts, INSERT+SELECT on staging_records)
FINANCIAL_SYSTEM_DATABASE_URL=postgres://timesheets_role:<password>@<financial-system-neon-host>/financial_system?sslmode=require

# ── Cross-DB: app-portal (Neon) ──
# Connection using timesheets_reader role (SELECT on employees)
PEOPLE_DATABASE_URL=postgres://timesheets_reader:<password>@<app-portal-neon-host>/app_portal?sslmode=require
```

These are in addition to the existing `DATABASE_URL` for renewal-timesheets' own DB.

**Vercel env var setup:** Add both to the renewal-timesheets Vercel project (Production + Preview).

---

## 6. Database Changes (renewal-timesheets DB)

### 6a. Add `fund_id` to `timesheet_entries`

```sql
ALTER TABLE timesheet_entries
  ADD COLUMN fund_id INTEGER;
-- nullable — NULL means "General Fund (Unrestricted)", resolved at staging write time
```

**Drizzle schema change** in `packages/backend/src/db/schema/`:
```typescript
// In timesheet-entries schema
fundId: integer('fund_id'),  // nullable, references financial-system funds table (not a local FK)
```

Note: This is NOT a foreign key — the `funds` table lives in financial-system's DB. Validation happens at staging INSERT time (FK on `staging_records.fund_id → funds.id`).

### 6b. Add `funds_cache` table (local cache of financial-system funds)

```sql
CREATE TABLE funds_cache (
  id            INTEGER PRIMARY KEY,  -- mirrors financial-system funds.id
  name          VARCHAR(255) NOT NULL,
  fund_code     VARCHAR(20) NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  cached_at     TIMESTAMP NOT NULL DEFAULT now()
);
```

Populated by a sync mechanism (cron job or on-demand refresh). Used for dropdown rendering only — the real FK validation happens at INSERT time on financial-system's DB.

### 6c. Add `staging_sync_status` table (local tracking)

```sql
CREATE TABLE staging_sync_status (
  id              SERIAL PRIMARY KEY,
  timesheet_id    INTEGER NOT NULL REFERENCES timesheets(id),
  source_record_id VARCHAR(255) NOT NULL,  -- e.g., ts_123_fund_1
  fund_id         INTEGER NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'received',  -- mirrors financial-system status
  synced_at       TIMESTAMP NOT NULL DEFAULT now(),
  last_checked_at TIMESTAMP,
  UNIQUE(timesheet_id, fund_id)
);
```

This lets timesheets track what was submitted and display status without hitting financial-system DB on every page load.

---

## 7. External Tables (READ-ONLY references)

### 7a. financial-system `funds` table (SELECT via `timesheets_role`)

| Column | Type | Used For |
|--------|------|----------|
| `id` | integer PK | FK value for staging_records.fund_id |
| `name` | varchar | Display in dropdown |
| `fund_code` | varchar | Display label |
| `is_active` | boolean | Filter inactive funds |

### 7b. financial-system `staging_records` table (INSERT + SELECT via `timesheets_role`)

| Column | Type | Source in renewal-timesheets |
|--------|------|-----------------------------|
| `source_app` | varchar(50) | Always `'timesheets'` |
| `source_record_id` | varchar(255) | `ts_{timesheetId}_fund_{fundId}` |
| `record_type` | varchar(50) | Always `'timesheet_fund_summary'` |
| `employee_id` | varchar(255) | Employee UUID from timesheet |
| `reference_id` | varchar(255) | Timesheet ID (as string) |
| `date_incurred` | date | Pay period end date |
| `amount` | numeric(12,2) | Total earnings for this fund allocation |
| `fund_id` | integer (FK → funds) | Fund ID from aggregated entries |
| `gl_account_id` | integer | `NULL` (financial-system assigns Salaries & Wages) |
| `metadata` | jsonb | `{ regular_hours, overtime_hours, regular_earnings, overtime_earnings }` |
| `status` | varchar(20) | Always `'received'` on INSERT |

**Unique constraint:** `(source_app, source_record_id)` — prevents duplicate submissions.

### 7c. app-portal `employees` table (SELECT via `timesheets_reader`)

| Column | Type | Used For |
|--------|------|----------|
| `id` | uuid | Match to timesheet employee |
| `zitadel_user_id` | text | Match via Zitadel SSO identity |
| `compensation_type` | text | `PER_TASK` or `SALARIED` |
| `annual_salary` | numeric(12,2) | Salaried employees only |
| `expected_annual_hours` | integer | Hourly rate denominator |
| `exempt_status` | text | `EXEMPT` or `NON_EXEMPT` — overtime eligibility |
| `is_active` | boolean | Filter |

**Calculated hourly rate:** `annual_salary ÷ expected_annual_hours` (for SALARIED employees).

---

## 8. Implementation Plan

### Phase 1: Cross-DB Infrastructure

| Task | Status | Notes |
|------|--------|-------|
| Create `packages/backend/src/db/financial-system.ts` — Drizzle client for financial-system DB | ✅ | Dual-mode (Neon HTTP / pg Pool), exports `financialDb`, `funds`, `accounts`, `stagingRecords` |
| Create `packages/backend/src/db/app-portal.ts` — Drizzle client for app-portal DB | ✅ | Dual-mode, exports `portalDb`, `portalEmployees` |
| Define external table schemas (funds, staging_records, employees) as Drizzle table refs | ✅ | Inlined in each client file — type-safe, not managed by migrations |
| Add env vars to `.env.example` | ✅ | Both root and `packages/backend/.env.example` updated |
| Create `timesheets_reader` Postgres role on app-portal DB | 🔲 | Jeff: run SQL in Neon console — SELECT on `employees` only |

### Phase 2: Fund Allocation (Schema + UI)

| Task | Status | Notes |
|------|--------|-------|
| Add `fund_id` column to `timesheet_entries` (migration) | ✅ | Migration 0005, applied to production DB |
| Create `funds_cache` table (migration) | ✅ | Same migration, integer PK mirrors financial-system |
| Create fund sync service (`services/fund-sync.service.ts`) | ✅ | Reads from `financialDb.funds`, upserts local cache |
| Add fund sync API route or cron trigger | ✅ | `POST /api/funds/sync` (supervisor-only) |
| Add fund dropdown to `EntryFormModal.tsx` | ✅ | Conditional: only shows when funds are cached; default = General Fund |
| Add `GET /api/funds` route | ✅ | Returns cached funds for frontend dropdown (any auth user) |
| Update shared types: add `fundId` to `TimesheetEntry` | ✅ | `db.ts`, `api.ts`, entry service, local type in `timesheet.service.ts` |

### Phase 3: Compensation Data Read

| Task | Status | Notes |
|------|--------|-------|
| Create `services/compensation.service.ts` | ✅ | Looks up local employee → zitadelId → app-portal; returns comp type, salary, exempt status, calculated hourly rate |
| Read `compensation_type`, `annual_salary`, `expected_annual_hours`, `exempt_status` | ✅ | SELECT via portalDb with timesheets_reader role |
| Integrate with existing payroll.service.ts | ✅ | `calculatePayrollForTimesheet` calls `getSalariedHourlyRate` before processing entries |
| Handle PER_TASK vs SALARIED logic | ✅ | SALARIED: calculated rate for all entries; PER_TASK/unavailable: task_code_rates; EXEMPT: no overtime |

### Phase 4: Staging Record Submission

| Task | Status | Notes |
|------|--------|-------|
| Create `services/staging.service.ts` | ✅ | `submitStagingRecords()`, `getTimesheetStagingStatus()`, `refreshStagingStatus()` |
| Create `staging_sync_status` table (migration) | ✅ | Migration 0006, UUID PK, JSONB metadata |
| On approval: aggregate entries by fund_id | ✅ | Pro-rata earnings distribution by hours per fund |
| INSERT staging_records rows (one per fund) | ✅ | Via `financialDb.insert(stagingRecords)` |
| Generate `source_record_id` as `ts_{timesheetId}_fund_{fundId}` | ✅ | Unique constraint prevents duplicates |
| Build metadata JSONB: `{ regular_hours, overtime_hours, regular_earnings, overtime_earnings }` | ✅ | `StagingMetadata` type in shared types |
| Write local `staging_sync_status` records | ✅ | Mirror rows written after financial-system INSERT |
| Handle errors: FK failures (bad fund_id), unique constraint (duplicate submit) | ✅ | `DUPLICATE_SUBMISSION`, `STAGING_INSERT_FAILED` error codes |
| Hook into review.service.ts approval flow | ✅ | Non-blocking: staging error doesn't block approval, surfaces as `stagingError` |

### Phase 5: Status Read-Back

| Task | Status | Notes |
|------|--------|-------|
| Create `services/staging-status.service.ts` | ✅ | Merged into `staging.service.ts` — `getTimesheetStagingStatus()` + `refreshStagingStatus()` |
| Add `GET /api/timesheets/:id/financial-status` route | ✅ | On timesheets router, supports `?refresh=true` for on-demand sync |
| Cron or on-demand: sync status back to `staging_sync_status` | ✅ | `refreshStagingStatus()` reads from financial-system, updates local records |
| Frontend: status badges on timesheet detail | ✅ | `FinancialStatusBadge` component — detailed view on ReviewDetail |
| Frontend: status column on MyTimesheetHistory | ✅ | Compact badge in new "Financial" column |

### Phase 6: Testing & Verification

| Task | Status | Notes |
|------|--------|-------|
| Unit tests for staging.service.ts (aggregation logic) | 🔲 | Mock DB, verify row generation |
| Unit tests for compensation.service.ts | 🔲 | PER_TASK vs SALARIED rate calculation |
| Integration test: staging INSERT with real financial-system DB | 🔲 | Verify FK constraints, unique constraint |
| E2E: fund selection → approval → staging record appears | 🔲 | Full flow test |
| Verify idempotency: re-approving same timesheet doesn't duplicate | 🔲 | Unique constraint on `(source_app, source_record_id)` |

---

## 9. Files to Create / Modify

### New Files

| File | Purpose |
|------|---------|
| `packages/backend/src/db/financial-system.ts` | Drizzle client + external table schemas for financial-system |
| `packages/backend/src/db/app-portal.ts` | Drizzle client + external table schema for app-portal employees |
| `packages/backend/src/services/fund-sync.service.ts` | Sync funds from financial-system → local cache |
| `packages/backend/src/services/compensation.service.ts` | Read comp data from app-portal |
| `packages/backend/src/services/staging.service.ts` | Aggregate + write staging records + status read-back (merged staging-status into this) |
| `packages/backend/src/routes/funds.ts` | `GET /api/funds` (cached list), `POST /api/funds/sync` |
| `packages/frontend/src/components/FundSelector.tsx` | Fund dropdown component |
| `packages/frontend/src/components/FinancialStatusBadge.tsx` | Financial status badge (compact + detailed modes) |

### Modified Files

| File | Change |
|------|--------|
| `packages/backend/src/db/schema/` | Add `fund_id` to entries, add `funds_cache` + `staging_sync_status` tables |
| `packages/backend/src/services/review.service.ts` | Hook staging write into approval flow |
| `packages/backend/src/services/payroll.service.ts` | Integrate comp data from app-portal for rate calculation |
| `packages/backend/src/routes/timesheets.ts` | Add `GET /:id/financial-status` route |
| `packages/backend/src/routes/supervisor.ts` | Include `staging` + `stagingError` in approval response |
| `packages/frontend/src/components/EntryFormModal.tsx` | Add FundSelector dropdown |
| `packages/frontend/src/pages/MyTimesheetHistory.tsx` | Add financial status column |
| `packages/frontend/src/pages/ReviewDetail.tsx` | Show per-fund staging status after approval |
| `shared/types/src/db.ts` | Add `fundId` to TimesheetEntry type |
| `shared/types/src/api.ts` | Add fund + staging status DTOs |
| `.env.example` | Add `FINANCIAL_SYSTEM_DATABASE_URL`, `PEOPLE_DATABASE_URL` |

---

## 10. Postgres Roles (Already Provisioned on Target DBs)

### On financial-system Neon DB: `timesheets_role`

```sql
-- Already created in financial-system Phase 22 Step 11b
CREATE ROLE timesheets_role WITH LOGIN PASSWORD '...';
GRANT SELECT ON accounts TO timesheets_role;
GRANT SELECT ON funds TO timesheets_role;
GRANT INSERT, SELECT ON staging_records TO timesheets_role;
-- No UPDATE, no DELETE
```

**Status:** ✅ Created and verified

### On app-portal Neon DB: `timesheets_reader`

```sql
-- NEEDS TO BE CREATED (Jeff: run in Neon console)
CREATE ROLE timesheets_reader WITH LOGIN PASSWORD '...';
GRANT SELECT ON employees TO timesheets_reader;
-- Read-only, compensation fields only needed
```

**Status:** 🔲 Not yet created

---

## 11. Status Flow Reference

```
renewal-timesheets                    financial-system
─────────────────                    ────────────────
Supervisor approves timesheet
  → aggregate by fund
  → INSERT staging_records ──────→  status: 'received'
                                      │
                                    staging processor cron
                                      │
                                      ▼
  ← read status back ◄──────────  status: 'posted' (GL entry created)
                                      │
                                    payroll matching
                                      │
                                      ▼
  ← read status back ◄──────────  status: 'matched_to_payment'
                                      │
                                    payment cleared
                                      │
                                      ▼
  ← read status back ◄──────────  status: 'paid'
```

---

## 12. Open Questions

| # | Question | Answer |
|---|----------|--------|
| Q1 | Does `timesheets_reader` role exist on app-portal yet? | 🔲 Need to check/create |
| Q2 | What is the General Fund's `id` in financial-system? | Need to query `SELECT id FROM funds WHERE name ILIKE '%general%'` |
| Q3 | Should PER_TASK employees still use task_code_rates for earnings? | Likely yes — app-portal comp data is for SALARIED only |
| Q4 | How should overtime be split across funds? | Pro-rata by fund hours? Or all overtime to primary fund? |

---

## 13. Session Progress

### Session 1: 2026-02-17 (Discovery + Plan)

**Completed:**
- [x] Read financial-system integration specs (renewal-timesheets.md, app-portal.md)
- [x] Read staging_records schema from financial-system
- [x] Read app-portal employee schema plan (Phases 1-3 complete)
- [x] Explored renewal-timesheets full architecture (schema, services, routes, frontend)
- [x] Created this plan document

**Next Steps:**
- [ ] Answer open questions (Q1-Q4)
- [ ] Jeff: Create `timesheets_reader` role on app-portal Neon DB
- [ ] Jeff: Add `FINANCIAL_SYSTEM_DATABASE_URL` + `PEOPLE_DATABASE_URL` to Vercel
- [x] ~~Begin Phase 1: Cross-DB infrastructure~~

### Session 2: 2026-02-17 (Phase 1 Implementation)

**Completed:**
- [x] Phase 1: Created `packages/backend/src/db/financial-system.ts` (Drizzle client + `funds`, `accounts`, `stagingRecords` schemas)
- [x] Phase 1: Created `packages/backend/src/db/app-portal.ts` (Drizzle client + `portalEmployees` schema)
- [x] Phase 1: Updated `.env.example` (root + backend) with `FINANCIAL_SYSTEM_DATABASE_URL` and `PEOPLE_DATABASE_URL`
- [x] TypeScript build passes cleanly

**Design Notes:**
- External DB clients return `null` when env var is missing (graceful degradation — app starts without integration configured)
- Both clients use dual-mode: Neon HTTP on Vercel, pg Pool locally (same pattern as main DB)
- External schemas are defined inline in each client file (not exported to `schema/index.ts` to avoid drizzle-kit managing them)
- Pool size set to 3 (vs 10 for main DB) — cross-DB queries are infrequent

**Remaining for Phase 1:**
- [x] ~~Jeff: Create `timesheets_reader` Postgres role on app-portal Neon DB~~
- [x] ~~Jeff: Add env vars to Vercel project (Production + Preview)~~

### Session 2 (continued): Phase 2 — Fund Allocation

**Completed:**
- [x] Migration 0005: `fund_id` column on `timesheet_entries` + `funds_cache` table — applied to production DB
- [x] Drizzle schema: `fundId` on `timesheetEntries`, new `fundsCache` table
- [x] Shared types: `fundId` on `TimesheetEntry`, `CreateEntryRequest`, `UpdateEntryRequest`; new `CachedFund`, `FundListResponse`, `FundSyncResponse`
- [x] Backend: `fund-sync.service.ts` (sync from financial-system → local cache)
- [x] Backend: `routes/funds.ts` — `GET /api/funds` (any auth), `POST /api/funds/sync` (supervisor)
- [x] Backend: entry service updated — `fundId` flows through create, bulk create, update, and toPublicEntry
- [x] Backend: local `TimesheetEntryWithTaskCode` + entry mapping in `getTimesheetWithEntries` updated
- [x] Frontend: `useFunds` hook + `getFunds`/`syncFunds` API client functions
- [x] Frontend: Fund dropdown in `EntryFormModal.tsx` — conditional (shows only when funds cached), default "General Fund"
- [x] TypeScript build passes cleanly
- [x] `timesheets_reader` role created on app-portal Neon DB with SELECT on employees
- [x] Both `FINANCIAL_SYSTEM_DATABASE_URL` and `PEOPLE_DATABASE_URL` added to Vercel (production + preview) and local `.env.local`

**Next:** Phase 3 — Compensation Data Read (app-portal integration for salaried hourly rate calculation)

### Session 3: 2026-02-17 (Phase 3 — Compensation Data Read)

**Completed:**
- [x] Created `packages/backend/src/services/compensation.service.ts`
  - `getEmployeeCompensation()` — looks up local employee → zitadelId → app-portal portalEmployees
  - `getSalariedWeeklyPay()` — returns fixed weekly pay + exempt status + FLSA warnings
  - Graceful degradation: returns null when portal DB not configured, employee has no zitadelId, or not found in portal
  - FLSA validation: warns if EXEMPT but below $684/week threshold
- [x] Integrated into `payroll.service.ts` `calculatePayrollForTimesheet()`
  - Two distinct calculation paths: SALARIED vs PER_TASK
  - **SALARIED**: fixed weekly pay = `annual_salary / 52`, allocated across ag/non-ag pro-rata by hours logged
  - **SALARIED 0-hour week**: full weekly pay → non-agricultural earnings (General Fund)
  - **SALARIED + NON_EXEMPT OT**: FLSA fluctuating workweek method: `(weeklyPay / actualHrs) × 0.5 × otHrs`
  - **SALARIED + EXEMPT**: no overtime
  - **PER_TASK**: hours × task_code_rate (unchanged behavior, no regression)
  - Comp lookup failure: logs warning, falls back to PER_TASK path (non-blocking)
- [x] TypeScript build passes cleanly
- [x] No shared type changes needed (comp data is backend-internal)

**Design Notes (corrected after FLSA research):**
- Salaried employees earn fixed weekly pay regardless of hours worked
- Hours logged by salaried employees are for fund allocation, not pay calculation
- "EXEMPT" requires BOTH salary >= $684/week AND qualifying job duties (DOL Fact Sheet #17a)
- Employee at $20k/yr ($384.62/week) CANNOT be legally exempt — system warns if misconfigured
- Rounding fix: non-ag earnings = weeklyPay − agEarnings (ensures exact sum)
- 0-hour salaried week: full pay defaults to General Fund (non-agricultural), supervisor approves as normal

**Next:** Phase 4 — Staging Record Submission (aggregate by fund on approval → INSERT to financial-system)

### Session 4: 2026-02-17 (Phase 4 — Staging Record Submission)

**Completed:**
- [x] Migration 0006: `staging_sync_status` table — UUID PK, JSONB metadata, unique(timesheet_id, fund_id)
- [x] Drizzle schema: `stagingSyncStatus` table + relations
- [x] Shared types: `StagingSyncRecord`, `StagingMetadata`, `StagingSyncStatusValue`, `StagingSubmitResult`, `TimesheetFinancialStatus`
- [x] Created `packages/backend/src/services/staging.service.ts`
  - `submitStagingRecords()` — aggregates entries by fund_id, distributes payroll earnings pro-rata, INSERTs to financial-system, writes local sync records
  - `getTimesheetStagingStatus()` — reads local sync records for display
  - `refreshStagingStatus()` — reads from financial-system, updates local status
- [x] Hooked into `review.service.ts` `approveTimesheet()` — non-blocking: staging error doesn't block approval
- [x] `ApproveTimesheetResult` extended with `staging` and `stagingError` fields
- [x] TypeScript build passes cleanly

**Design Notes:**
- Staging submission is non-blocking: approval succeeds even if staging INSERT fails (supervisor sees `stagingError` message)
- Idempotency: checks local `staging_sync_status` first, catches unique constraint violations from financial-system
- Earnings distribution: pro-rata by hours per fund, last fund gets remainder to avoid rounding drift
- 0-hour timesheet: all earnings go to General Fund (DEFAULT_FUND_ID = 1)
- Status read-back functions built into same service (no separate `staging-status.service.ts` needed)

**Next:** Phase 5 (Status Read-Back) — continued in same session below

### Session 4 (continued): Phase 5 — Status Read-Back

**Completed:**
- [x] Migration 0006 applied to production DB
- [x] `GET /api/timesheets/:id/financial-status` route on timesheets router
  - Access check: owner or supervisor
  - Optional `?refresh=true` param triggers live read-back from financial-system
- [x] Supervisor approval response updated: now includes `staging` + `stagingError` fields
- [x] Frontend: `FinancialStatusBadge` component
  - Compact mode (pill badge) for table rows
  - Detailed mode (per-fund list) for review pages
  - Color-coded: gray=received, blue=posted, purple=matched, green=paid, red=error
- [x] Frontend: `getTimesheetFinancialStatus()` API client function
- [x] ReviewDetail page: shows detailed financial status for approved timesheets
- [x] MyTimesheetHistory: new "Financial" column with compact status badges
- [x] TypeScript build passes cleanly

**Remaining:**
- [ ] Phase 6: Testing & Verification
- [ ] Smoke test: approve a timesheet → verify staging records appear in financial-system
- [ ] Verify status read-back works end-to-end
