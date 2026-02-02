# Phase 4 Plan: Block Management

**Feature**: Timeline UI - Phase 4 (Block Management)
**Reference**: [docs/TIMELINE_UI_PLAN.md](docs/TIMELINE_UI_PLAN.md)
**Status**: Ready for Implementation

---

## Overview

Phase 4 adds interactive block management capabilities to the Timeline View:
- Block selection and editing (change task, times, or other details)
- Resize blocks by dragging edges (change start/end time visually)
- Delete functionality (already partially implemented - enhance UX)
- Task color assignment with legend

---

## Prerequisites Verification

Before starting, verify these Phase 1-3 deliverables are working:

- [ ] TimelineView renders with drag-to-create
- [ ] TimeBlock displays existing entries with colors
- [ ] TaskAssignmentPopover works for new entries
- [ ] Multi-day drag creates bulk entries
- [ ] School hours overlay shows for minors
- [ ] Compliance preview API returns warnings/violations

---

## Tasks

### Task 4.1: Block Selection State

**Goal**: Allow clicking a block to select it, showing visual feedback and enabling edit/delete actions.

**Files to modify**:
- [packages/frontend/src/components/TimelineView.tsx](packages/frontend/src/components/TimelineView.tsx)
- [packages/frontend/src/components/TimeBlock.tsx](packages/frontend/src/components/TimeBlock.tsx)
- [packages/frontend/src/components/TimeBlock.css](packages/frontend/src/components/TimeBlock.css)

**Changes**:
1. Add `selectedBlockId` state to TimelineView
2. Pass `isSelected` prop to TimeBlock
3. Add selected styling (border glow, slight scale)
4. Click on block → select it; click elsewhere → deselect
5. Prevent drag-to-create when clicking on existing block
6. Show edit/delete buttons more prominently when selected

**Acceptance Criteria**:
- Clicking a block selects it with visual feedback
- Clicking elsewhere deselects
- Clicking a different block switches selection
- Selected block shows edit/delete controls

---

### Task 4.2: Edit Entry Modal

**Goal**: Enable editing an existing entry's details (task code, times, supervisor, meal break).

**Files to create**:
- `packages/frontend/src/components/EditEntryModal.tsx`
- `packages/frontend/src/components/EditEntryModal.css`

**Files to modify**:
- [packages/frontend/src/pages/Timesheet.tsx](packages/frontend/src/pages/Timesheet.tsx) - add onEditEntry handler
- [packages/frontend/src/hooks/useTimesheet.ts](packages/frontend/src/hooks/useTimesheet.ts) - add updateEntry function
- [packages/frontend/src/api/client.ts](packages/frontend/src/api/client.ts) - add PUT /entries/:id endpoint

**Backend files to modify**:
- [packages/backend/src/routes/timesheets.ts](packages/backend/src/routes/timesheets.ts) - add PUT route
- [packages/backend/src/services/timesheet-entry.service.ts](packages/backend/src/services/timesheet-entry.service.ts) - add updateEntry method

**Changes**:
1. Create EditEntryModal that shows current entry details
2. Allow changing: task code, start time, end time, supervisor name, meal break
3. Run compliance preview before saving
4. Call backend PUT endpoint to update
5. Hook up onEditEntry in TimelineView to open modal

**Acceptance Criteria**:
- Clicking edit opens modal with current values
- Can change any field
- Compliance warnings shown before save
- Save updates the entry; Cancel closes without changes
- Entry re-renders with new values

---

### Task 4.3: Edge Resize (Visual Time Adjustment)

**Goal**: Allow dragging the top or bottom edge of a block to resize it (change start/end time).

**Files to modify**:
- [packages/frontend/src/components/TimeBlock.tsx](packages/frontend/src/components/TimeBlock.tsx)
- [packages/frontend/src/components/TimeBlock.css](packages/frontend/src/components/TimeBlock.css)
- [packages/frontend/src/components/TimelineView.tsx](packages/frontend/src/components/TimelineView.tsx)

**Changes**:
1. Add resize handles (top and bottom edges) to TimeBlock
2. On mousedown on handle, start resize mode
3. Track resize state in TimelineView (which block, which edge, new time)
4. Show preview of new size during drag
5. On mouseup, call updateEntry with new times
6. Show compliance preview during resize

**Implementation Details**:
- Top handle adjusts start time
- Bottom handle adjusts end time
- Snap to 15-minute increments
- Show time tooltip during resize
- Prevent resizing past boundaries (6 AM - 10 PM)
- Prevent overlapping other blocks on same day

**Acceptance Criteria**:
- Dragging top edge changes start time
- Dragging bottom edge changes end time
- Preview shows during resize
- Times snap to 15-min increments
- Release saves the change
- Escape cancels resize

---

### Task 4.4: Enhanced Delete UX

**Goal**: Improve delete functionality with keyboard support and better confirmation.

**Files to modify**:
- [packages/frontend/src/components/TimeBlock.tsx](packages/frontend/src/components/TimeBlock.tsx)
- [packages/frontend/src/components/TimelineView.tsx](packages/frontend/src/components/TimelineView.tsx)

**Changes**:
1. When block is selected, Delete/Backspace key triggers delete
2. Show confirmation inline (current implementation) or small modal
3. Add undo capability (optional - stretch goal)

**Acceptance Criteria**:
- Selected block + Delete key → confirmation prompt
- Confirmation required before delete
- Deleted block is removed from view
- Focus returns to timeline after delete

---

### Task 4.5: Task Color Legend

**Goal**: Show a legend mapping task codes to their colors for easy reference.

**Files to create**:
- `packages/frontend/src/components/TaskColorLegend.tsx`
- `packages/frontend/src/components/TaskColorLegend.css`

**Files to modify**:
- [packages/frontend/src/pages/Timesheet.tsx](packages/frontend/src/pages/Timesheet.tsx) - add legend component

**Changes**:
1. Create TaskColorLegend component showing used task codes and their colors
2. Only show task codes that have entries in the current timesheet
3. Position below or beside the timeline
4. Use same color generation function from TimeBlock

**Acceptance Criteria**:
- Legend shows only task codes with entries
- Colors match blocks on timeline
- Legend updates when entries added/removed

---

### Task 4.6: useTaskColors Hook (Optional Enhancement)

**Goal**: Centralize color assignment for consistency and potential customization.

**Files to create**:
- `packages/frontend/src/hooks/useTaskColors.ts`

**Files to modify**:
- [packages/frontend/src/components/TimeBlock.tsx](packages/frontend/src/components/TimeBlock.tsx) - use hook
- `packages/frontend/src/components/TaskColorLegend.tsx` - use hook

**Changes**:
1. Extract `stringToColor` to shared hook
2. Allow optional color overrides (stretch goal)
3. Memoize color assignments per session

**Acceptance Criteria**:
- Colors remain consistent across components
- Same task code always gets same color

---

## Backend Changes Summary

### New Endpoint: PUT /api/timesheets/:id/entries/:entryId

**Route**: `PUT /api/timesheets/:timesheetId/entries/:entryId`

**Request Body**:
```typescript
{
  taskCodeId?: string;
  startTime?: string;     // HH:MM
  endTime?: string;       // HH:MM
  supervisorPresentName?: string | null;
  mealBreakConfirmed?: boolean | null;
}
```

**Response**: Updated `TimesheetEntryWithTaskCode`

**Validation**:
- Timesheet must be in "open" status
- Entry must belong to timesheet
- Run compliance check on new values
- Recalculate hours if times changed

---

## Testing Plan

### Unit Tests
- [ ] TimeBlock selection state changes
- [ ] Resize calculation (pixel to time conversion)
- [ ] Color consistency for same task code
- [ ] Entry update validation

### Integration Tests
- [ ] Edit entry flow (open modal → change values → save)
- [ ] Resize saves correct times
- [ ] Delete removes entry
- [ ] Compliance check on edit

### Manual Testing Checklist
- [ ] Click block to select, visual feedback visible
- [ ] Click elsewhere to deselect
- [ ] Click edit → modal opens with correct values
- [ ] Change task code → save → block color changes
- [ ] Drag top edge → start time updates
- [ ] Drag bottom edge → end time updates
- [ ] Delete key on selected block → confirmation → delete
- [ ] Legend shows correct task codes and colors

---

## Files Summary

### New Files
| File | Purpose |
|------|---------|
| `EditEntryModal.tsx` | Modal for editing entry details |
| `EditEntryModal.css` | Styling for edit modal |
| `TaskColorLegend.tsx` | Legend showing task code colors |
| `TaskColorLegend.css` | Styling for legend |
| `useTaskColors.ts` | Centralized color assignment (optional) |

### Modified Files
| File | Changes |
|------|---------|
| `TimelineView.tsx` | Selection state, resize handling, keyboard events |
| `TimeBlock.tsx` | Selected style, resize handles, enhanced delete |
| `TimeBlock.css` | Selection styling, resize handle styling |
| `Timesheet.tsx` | Edit modal integration, legend |
| `useTimesheet.ts` | updateEntry function |
| `client.ts` | PUT entry endpoint |
| `timesheets.ts` (backend) | PUT entry route |
| `timesheet-entry.service.ts` | updateEntry method |

---

## Implementation Order

1. **Task 4.1** - Block Selection (foundation for other features)
2. **Task 4.2** - Edit Entry Modal (core editing capability)
3. **Task 4.3** - Edge Resize (visual editing)
4. **Task 4.4** - Enhanced Delete (polish existing feature)
5. **Task 4.5** - Task Color Legend (UX improvement)
6. **Task 4.6** - useTaskColors Hook (optional cleanup)

---

## Definition of Done

- [ ] All tasks completed
- [ ] Unit tests passing
- [ ] Manual testing checklist complete
- [ ] No regressions in Phase 1-3 functionality
- [ ] Code follows project conventions (CONVENTIONS.md)
- [ ] Interactive elements have data-testid attributes

---

## Notes

- Resize interaction requires careful mouse event handling to avoid conflicts with drag-to-create
- Consider touch support for resize (stretch goal for Phase 5)
- Color generation uses HSL for pleasing colors - keep this approach
- Edit modal should reuse compliance preview from TaskAssignmentPopover where possible
