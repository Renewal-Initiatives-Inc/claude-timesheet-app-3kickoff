# Entry Notes — Plan

**Status:** Implementation Complete — Needs Migration + Smoke Test
**Last Updated:** 2026-02-12
**Author:** Jeff + Claude
**Traces to:** Invoice justification for consulting clients

> **Protocol**: This section is auto-updated before session end. Start new sessions with: `@docs/ENTRY-NOTES-PLAN.md Continue.`

---

## 1. Problem Statement

The app lacks a general-purpose notes field on individual time entries. Invoicing consulting clients requires per-entry line-item justification (e.g., "Client meeting re: Phase 2 scope"), and there is currently no way to capture or export this.

---

## 2. Discovery

### Questions

1. Does a notes-like field already exist in the data model?
2. What is the full data flow for creating/updating a timesheet entry?
3. How do MyTimesheetHistory and TimesheetHistoryReport currently render data — entry-level or aggregate?
4. What CSV export patterns exist to follow?
5. Where in the EntryFormModal should the field go?

### Responses

1. **Two specialized notes fields exist, neither general-purpose:**
   - `supervisor_notes` on `timesheets` table (weekly level, supervisor-only, review workflow)
   - `school_day_override_note` on `timesheet_entries` table (only when toggling school day status, 10+ chars required, not displayed back in UI)
   - Neither serves invoice justification needs

2. **Entry data flow**: Schema (`packages/backend/src/db/schema/timesheet.ts`) → Zod validation (`packages/backend/src/validation/timesheet.schema.ts`) → Service layer (`packages/backend/src/services/timesheet-entry.service.ts` with `CreateEntryInput`/`UpdateEntryInput` interfaces, `toPublicEntry()` mapper) → Shared types (`shared/types/src/db.ts` `TimesheetEntry`, `shared/types/src/api.ts` `CreateEntryRequest`/`UpdateEntryRequest`) → Frontend form (`packages/frontend/src/components/EntryFormModal.tsx`)

3. **Report views aggregate at the timesheet level, not entry level:**
   - `packages/frontend/src/pages/MyTimesheetHistory.tsx` — table of weekly timesheets with expandable rows showing supervisor notes and compliance status
   - `packages/frontend/src/pages/TimesheetHistoryReport.tsx` — same pattern for supervisors with filters
   - Neither currently shows individual entries. Expandable rows would need a new "entry log" section.

4. **CSV export patterns to follow:**
   - `packages/backend/src/utils/payroll-export.ts` — `escapeCSVValue()`, `generatePayrollCSV()`, `generatePayrollFilename()` pattern
   - `packages/backend/src/routes/payroll.ts:125` — POST endpoint with Content-Type/Content-Disposition headers
   - `packages/frontend/src/api/client.ts:797` — `exportPayrollCSV()` with auth headers, returns blob
   - `packages/frontend/src/pages/PayrollReportPage.tsx:118` — `createObjectURL → click → revokeObjectURL` download pattern

5. **EntryFormModal placement**: After the conditional meal-break section (line 310), before `modal-actions` div (line 312). Unlike supervisor/meal-break fields, notes are NOT conditional — always rendered.

### Synthesis

This is a clean "add a field through every layer" feature. The optional nullable field pattern is well-established (`schoolDayOverrideNote`, `supervisorPresentName`). The main new work is: (a) the field itself through schema→types→validation→service→form, (b) surfacing entry-level detail in the two report views (currently aggregate-only), and (c) a CSV export endpoint.

---

## 3. Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | 500 char max, no minimum | Matches `schoolDayOverrideNote` max. No min because "billable" or "internal" are valid short notes. |
| D2 | Always visible in EntryFormModal (not conditional) | User requirement: available for every entry regardless of age, task code, or role. |
| D3 | Entry log appended to expandable rows in report views | User said "doesn't have to be pretty, can read like a log." Simpler than a full entry detail table. |
| D4 | GET endpoint on `/api/timesheets/:id/entries/export` for CSV | Simpler than POST (no body needed), scoped to a single timesheet. Ownership validated same as other timesheet routes. |
| D5 | Export button on Timesheet.tsx (My Timesheets page) | Primary use case is exporting current/recent week entries for invoicing. Available in any status, not just editable. |

---

## 4. Requirements

### P0: Must Have

- REQ-P0-1: `notes` column on `timesheet_entries` (text, nullable)
- REQ-P0-2: Notes field in EntryFormModal — textarea, optional, 500 char max
- REQ-P0-3: Notes included in create/update entry API (validation, service, types)
- REQ-P0-4: Notes visible in TimeBlock tooltip on hover
- REQ-P0-5: Entry-level detail (date, task, hours, notes) in MyTimesheetHistory expandable rows
- REQ-P0-6: Entry-level detail (date, task, hours, notes) in TimesheetHistoryReport expandable rows
- REQ-P0-7: CSV export of entries with notes from My Timesheets page

### P1: Nice to Have

- REQ-P1-1: Character counter in the notes textarea (show when typing)

### P2: Future

- REQ-P2-1: Notes search/filter in reports
- REQ-P2-2: Bulk notes (apply same note to multi-day drag entries)

---

## 5. Data Model

**Migration: `0004_add_entry_notes.sql`**

```sql
ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS notes TEXT;
```

**Schema change in `packages/backend/src/db/schema/timesheet.ts`:**

```typescript
// Add before createdAt in timesheetEntries table
notes: text('notes'),
```

**Type changes:**

| File | Interface | Addition |
|------|-----------|----------|
| `shared/types/src/db.ts` | `TimesheetEntry` | `notes: string \| null` |
| `shared/types/src/api.ts` | `CreateEntryRequest` | `notes?: string \| null` |
| `shared/types/src/api.ts` | `UpdateEntryRequest` | `notes?: string \| null` |

---

## 6. Implementation Plan

### Phase 1: Data Layer (schema, types, validation, service)

| Task | Status | Notes |
|------|--------|-------|
| Add `notes` column to Drizzle schema | ✅ | `packages/backend/src/db/schema/timesheet.ts:59` |
| Create migration `0004_add_entry_notes.sql` | ✅ | `packages/backend/src/db/migrations/` |
| Add `notes` to `TimesheetEntry` in shared types | ✅ | `shared/types/src/db.ts:89` |
| Add `notes` to `CreateEntryRequest` and `UpdateEntryRequest` | ✅ | `shared/types/src/api.ts:462,475` |
| Add `notes` to Zod `createEntrySchema` and `updateEntrySchema` | ✅ | `packages/backend/src/validation/timesheet.schema.ts:42,71` |
| Add `notes` to `CreateEntryInput`, `UpdateEntryInput`, `toPublicEntry()` | ✅ | `packages/backend/src/services/timesheet-entry.service.ts` |
| Add `notes` to `createEntry()` .values() | ✅ | `timesheet-entry.service.ts:263` |
| Add `notes` to `createMultipleEntries()` .values() | ✅ | `timesheet-entry.service.ts:348` |
| Add `notes` to `updateEntry()` conditionals | ✅ | `timesheet-entry.service.ts:451` |
| Add `notes` to `entriesWithRates` mapping in `getTimesheetWithEntries` | ✅ | `packages/backend/src/services/timesheet.service.ts:196` |

### Phase 2: Frontend Entry Form + TimeBlock

| Task | Status | Notes |
|------|--------|-------|
| Add `notes` to `EntryFormData` interface and `FormErrors` | ✅ | `packages/frontend/src/components/EntryFormModal.tsx:51,59` |
| Initialize `notes` in edit and create modes | ✅ | `EntryFormModal.tsx:92,100` |
| Add `notes` to submit data (both branches) | ✅ | `EntryFormModal.tsx:154-174` |
| Add notes textarea JSX (always visible, after line 310) | ✅ | With char counter, `data-testid="field-notes"` |
| Add textarea CSS | ✅ | `packages/frontend/src/components/EntryFormModal.css` |
| Add notes to TimeBlock title/tooltip | ✅ | `packages/frontend/src/components/TimeBlock.tsx:140` |
| Add notes to TimeBlock accessible label | ✅ | `TimeBlock.tsx:123` |

### Phase 3: Report Views — Entry Log in Expandable Rows

| Task | Status | Notes |
|------|--------|-------|
| Ensure reports API returns entry-level data (or add it) | ✅ | Check `packages/backend/src/services/reports.service.ts` |
| Add entry log to MyTimesheetHistory expandable rows | ✅ | `packages/frontend/src/pages/MyTimesheetHistory.tsx` |
| Add entry log to TimesheetHistoryReport expandable rows | ✅ | `packages/frontend/src/pages/TimesheetHistoryReport.tsx` |

### Phase 4: CSV Export

| Task | Status | Notes |
|------|--------|-------|
| Create `packages/backend/src/utils/entry-export.ts` | ✅ | Follow `payroll-export.ts` pattern |
| Add GET `/api/timesheets/:id/entries/export` route | ✅ | `packages/backend/src/routes/timesheets.ts` |
| Add `exportTimesheetEntries()` to frontend API client | ✅ | `packages/frontend/src/api/client.ts` |
| Add "Export CSV" button to Timesheet.tsx | ✅ | `packages/frontend/src/pages/Timesheet.tsx:396` |

### Phase 5: Verification

| Task | Status | Notes |
|------|--------|-------|
| Build all packages (`npm run build`) | ✅ | All packages clean — 0 compile errors |
| Run existing tests (`npm run test`) | ✅ | 50 pre-existing failures (3 test files), 0 new failures |
| Manual smoke test: create/edit entries with notes | 🔲 | Migration applied; needs live app test |
| Verify tooltip shows notes on TimeBlock | 🔲 | Migration applied; needs live app test |
| Verify report expandable rows show entry log | 🔲 | Migration applied; needs live app test |
| Export CSV and verify notes column | 🔲 | Migration applied; needs live app test |
| Run E2E tests (`npx playwright test`) | ⏳ | Blocked in CLI sandbox (exit 137); run manually |

---

## 7. Verification

1. **Type safety**: `npm run build` in all packages — no compile errors
2. **Existing tests**: `npm run test` — no regressions (field is optional/nullable)
3. **Manual test flow**: Create entry with notes → verify tooltip → view in MyTimesheetHistory expanded row → export CSV → open CSV and confirm notes column
4. **E2E**: `npx playwright test` — existing tests pass (new field is optional)
5. **Edge cases**: Entry with no notes (null in DB, empty in CSV), notes with commas/quotes (CSV escaping), 500-char notes (max length)

---

## 8. Session Progress

### Session 1: 2026-02-12 (Discovery + Implementation)

**Completed:**
- [x] Created plan document
- [x] Full codebase exploration of existing notes functionality
- [x] Mapped complete entry data flow (schema → validation → service → API → frontend)
- [x] Phase 1: Data layer — schema, migration, types, validation, service (10 files)
- [x] Phase 2: Frontend entry form + TimeBlock tooltip (3 files)
- [x] Phase 3: Report views — entry log in expandable rows (4 files: backend service, frontend types, both report pages)
- [x] Phase 4: CSV export — new utility, backend route, frontend API, export button (4 new/modified files)
- [x] Phase 5 (partial): Frontend builds clean, 0 test regressions

**Files Modified (19 modified, 3 new):**
- `packages/backend/src/db/schema/timesheet.ts` — added `notes` column
- `packages/backend/src/db/migrations/0004_add_entry_notes.sql` — NEW
- `shared/types/src/db.ts` — `TimesheetEntry.notes`
- `shared/types/src/api.ts` — `CreateEntryRequest.notes`, `UpdateEntryRequest.notes`
- `packages/backend/src/validation/timesheet.schema.ts` — both Zod schemas
- `packages/backend/src/services/timesheet-entry.service.ts` — interfaces, CRUD, toPublicEntry
- `packages/backend/src/services/timesheet.service.ts` — entriesWithRates mapping
- `packages/backend/src/services/reports.service.ts` — EntryLogItem type, entries in response
- `packages/backend/src/utils/entry-export.ts` — NEW
- `packages/backend/src/routes/timesheets.ts` — export endpoint
- `packages/frontend/src/api/client.ts` — exportTimesheetEntries()
- `packages/frontend/src/api/reports.ts` — EntryLogItem type, entries in TimesheetHistoryRecord
- `packages/frontend/src/components/EntryFormModal.tsx` — notes textarea
- `packages/frontend/src/components/EntryFormModal.css` — textarea styling
- `packages/frontend/src/components/TimeBlock.tsx` — tooltip + a11y label
- `packages/frontend/src/pages/Timesheet.tsx` — export button + handler
- `packages/frontend/src/pages/Timesheet.css` — export button styling
- `packages/frontend/src/pages/MyTimesheetHistory.tsx` — entry log in expandable rows
- `packages/frontend/src/pages/TimesheetHistoryReport.tsx` — entry log in expandable rows
- `packages/frontend/src/pages/TimesheetHistoryReport.css` — entry-log-table styling
- `docs/ENTRY-NOTES-PLAN.md` — NEW

### Session 2: 2026-02-12 (Bug fixes + Verification)

**Completed:**
- [x] Fixed missing `notes` field in local `TimesheetEntryWithTaskCode` interface in `timesheet.service.ts` (line 332)
- [x] Fixed missing `notes` in `EntryFormModal` initial `useState` (line 87)
- [x] Full clean build — 0 compile errors across all packages (tsc --build + Vite)
- [x] Test verification — 50 pre-existing failures (route tests + compliance preview), 0 new

**Next Steps:**
- [x] Run migration `0004_add_entry_notes.sql` against database
- [x] Added `ZITADEL_ISSUER` to root `.env.local` (was missing, causing backend startup failure)
- [ ] E2E tests blocked by sandbox SIGKILL — run manually: `npx playwright test`
- [ ] Manual smoke test with live app
- [ ] Commit
