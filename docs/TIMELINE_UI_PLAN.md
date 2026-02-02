# Plan: Timeline-Based Timesheet Entry with Unified Compliance UX

**Status**: ✅ Complete
**Last Updated**: 2026-02-02
**Session**: All phases implemented

---

## Overview

Replace the current day-card + modal workflow with a visual timeline view that supports drag-to-create time blocks. This addresses two problems:

1. **Tedious entry workflow**: Currently requires 10-15 "Add Entry" modal interactions per week
2. **Inconsistent compliance feedback**: Some warnings appear in-modal, others after submission

---

## Design Summary

### Timeline View (All Users)

A week-long visual timeline with:
- **Days as columns** (Sun-Sat)
- **Hours as rows** (6am-10pm or configurable)
- **Drag to create blocks**: Vertical drag = single day, diagonal drag = same time across multiple days
- **Task assignment after drag**: Popover appears to select task code
- **Colored blocks per task**: Each task code gets a distinct color + label inside block

```
         SUN       MON       TUE       WED       THU       FRI       SAT
6 AM    ─────────────────────────────────────────────────────────────────
7 AM    │         │░░░░░░░░░│░░░░░░░░░│░░░░░░░░░│░░░░░░░░░│░░░░░░░░░│         │
8 AM    │         │░░░░░░░░░│░░░░░░░░░│░░░░░░░░░│░░░░░░░░░│░░░░░░░░░│         │
...     │         │░ SCHOOL░│░ SCHOOL░│░ SCHOOL░│░ SCHOOL░│░ SCHOOL░│         │
3 PM    │         │░░░░░░░░░│░░░░░░░░░│░░░░░░░░░│░░░░░░░░░│░░░░░░░░░│         │
4 PM    │         │████████│████████│████████│████████│████████│         │
5 PM    │         │█ C1    █│█ C1    █│█ C1    █│█ C1    █│█ C1    █│         │
6 PM    │         │████████│████████│████████│████████│████████│         │
7 PM    ─────────────────────────────────────────────────────────────────
```

*░░░ = School hours (7am-3pm) - grayed only for youth <18 on school days*
*████ = Time block with task code label and assigned color*

### Age-Conditional Features

| Feature | Youth (<18) | Adult (18+) |
|---------|-------------|-------------|
| School hours grayed (7am-3pm) | Yes, on school days | No |
| Daily hour limit indicator | Yes (visual line) | No |
| Weekly hour limit indicator | Yes | No |
| Supervisor prompt | Yes, for tasks requiring it | No |
| Meal break prompt | Yes, if shift >6 hours | No |
| Real-time compliance warnings | Yes | Minimal |

### Core Interactions

1. **Create single-day block**: Click at 9am Monday, drag down to 11am → 2-hour block created
2. **Create multi-day blocks**: Click at 9am Monday, drag diagonally to 11am Thursday → same 9am-11am block created on Mon, Tue, Wed, Thu
3. **Assign task**: After releasing drag, popover appears with task selector
4. **Edit block**: Click block to select → drag edges to resize, or click delete
5. **Delete block**: Select block → press Delete or click trash icon
6. **View block details**: Hover shows tooltip with task name, times, hours, rate

### Compliance Warnings (Unified)

All compliance warnings appear **inline on the timeline** during block creation:

- **School hours overlap**: If youth drags into grayed school hours, block turns red + warning tooltip
- **Daily limit exceeded**: If block would exceed daily limit, visual indicator + warning
- **Weekly limit exceeded**: Running total shown, warning if exceeded
- **Supervisor required**: After task selection, prompt appears inline if task requires supervisor
- **Meal break required**: After creating >6 hour block, checkbox prompt appears inline

**No more post-submission-only errors** - all validatable violations are caught during entry.

---

## Files to Modify/Create

### New Components (Frontend)

1. **`TimelineView.tsx`** - Main timeline grid component
   - Renders hour rows and day columns
   - Handles drag-to-create interaction
   - Shows school hours overlay for youth
   - Manages block selection state

2. **`TimeBlock.tsx`** - Individual time block component
   - Colored by task code
   - Shows task label
   - Handles resize/delete interactions
   - Shows compliance warning indicators

3. **`TaskAssignmentPopover.tsx`** - Task selection after drag
   - Task code dropdown
   - Supervisor name input (conditional)
   - Meal break confirmation (conditional)
   - Compliance warnings display

4. **`TimelineView.css`** - Timeline styling
   - Grid layout
   - School hours overlay
   - Block colors
   - Drag feedback

### Modified Components (Frontend)

5. **`packages/frontend/src/pages/Timesheet.tsx`**
   - Replace `TimesheetGrid` with `TimelineView`
   - Update state management for drag interaction
   - Handle multi-day block creation

6. **`packages/frontend/src/hooks/useTimesheet.ts`**
   - Add `addMultipleEntries()` for multi-day drag
   - Update entry management for timeline model

### New Hook (Frontend)

7. **`useTaskColors.ts`** - Assigns consistent colors to task codes
   - Maps task code ID → color
   - Persists across session
   - Provides color palette

### Backend Changes

8. **`packages/backend/src/routes/timesheets.ts`**
   - Add `POST /api/timesheets/:id/entries/bulk` - Create multiple entries at once
   - Add `POST /api/timesheets/:id/entries/preview` - Preview compliance for proposed entry

9. **`packages/backend/src/services/timesheet-entry.service.ts`**
   - Add `createMultipleEntries()` - Batch create entries
   - Add `previewEntryCompliance()` - Check compliance without saving

### Shared Types

10. **`shared/types/src/api.ts`**
    - Add `BulkCreateEntriesRequest` type
    - Add `EntryPreviewRequest` / `EntryPreviewResponse` types
    - Add `ComplianceWarning` type

---

## Implementation Phases

### Phase 1: Timeline Foundation
- [x] Create `TimelineView.tsx` with basic grid rendering
- [x] Implement single-day drag-to-create
- [x] Task assignment popover (basic)
- [x] Replace `TimesheetGrid` on Timesheet page

### Phase 2: Multi-Day Drag
- [x] Implement diagonal drag detection
- [x] Create multiple entries from single drag action
- [x] Backend bulk create endpoint (`POST /api/timesheets/:id/entries/bulk`)

### Phase 3: Compliance Integration
- [x] School hours overlay for youth
- [x] Real-time compliance preview API
- [x] Inline warning display during block creation
- [x] Supervisor/meal break prompts

### Phase 4: Block Management
- [x] Block selection and editing
- [x] Resize by dragging edges
- [x] Delete functionality
- [x] Task color assignment

### Phase 5: Polish
- [x] Hour limit visual indicators
- [x] Keyboard navigation
- [x] Accessibility improvements
- [x] Loading/error states

---

## Key Design Decisions

1. **Task selection AFTER drag** - More flexible for multi-day; "What did you do during this time?"

2. **One task per block** - No overlapping task codes for same time slot

3. **Colored blocks with labels** - Each task code gets distinct color + label visible in block

4. **Desktop-first** - Mobile drag UX is acceptable to deprioritize; PC/Mac is primary

5. **Unified compliance UX** - All warnings shown inline during entry, not after submission

---

## Data Model Considerations

### Current Schema (No Change Needed)
```typescript
timesheetEntries: {
  id: string;
  timesheetId: string;
  workDate: string;        // YYYY-MM-DD
  taskCodeId: string;
  startTime: string;       // HH:MM
  endTime: string;         // HH:MM
  hours: string;           // Decimal string
  isSchoolDay: boolean;
  supervisorPresentName: string | null;
  mealBreakConfirmed: boolean | null;
  // ...
}
```

Multi-day drag creates **multiple entries** (one per day) with same start/end times.

### Task Colors
- Store in frontend only (no persistence needed)
- Generate deterministically from task code ID (hash → hue)
- Or maintain a small color palette and assign round-robin

---

## Verification Plan

### Manual Testing
1. Log in as adult (18+) - verify no school hours blocking
2. Log in as youth (13) - verify school hours grayed on Mon-Fri
3. Single-day drag: Create block on Monday 9am-11am
4. Multi-day drag: Create block Mon-Thu 4pm-6pm (should create 4 entries)
5. Compliance: As youth, try to drag into school hours - verify warning
6. Compliance: As youth, try to exceed 4hr daily limit - verify warning
7. Task assignment: After drag, select task, verify color applied
8. Edit: Click block, resize end time, verify update
9. Delete: Select block, delete, verify removal

### Automated Testing
- Unit tests for drag interaction logic
- Unit tests for compliance preview
- E2E tests for full entry workflow
- E2E tests for compliance blocking

---

## Progress Log

*Update this section as implementation progresses*

| Date | Phase | Status | Notes |
|------|-------|--------|-------|
| 2026-02-02 | Planning | Complete | Plan approved |
| 2026-02-02 | Phase 1 | Complete | TimelineView, TimeBlock, TaskAssignmentPopover created; Timesheet page updated |
| 2026-02-02 | Phase 2 | Complete | Multi-day drag with bulk API endpoint; diagonal drag detection working |
| 2026-02-02 | Phase 3 | Complete | Real-time compliance preview API, school hours overlay, drag warnings, enhanced prompts |
| 2026-02-02 | Phase 4 | Complete | Block selection, resize handles, keyboard delete, task color legend |
| 2026-02-02 | Phase 5 | Complete | Tab/arrow navigation, aria-labels, live regions, focus management, limit indicators |

---

## Resume Instructions

To continue implementation in a new session, point Claude to this file:

```
Continue implementing the timeline UI plan in docs/TIMELINE_UI_PLAN.md.
Check the Progress Log and Phase checkboxes to see current status.
```
