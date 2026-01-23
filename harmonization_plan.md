# Post-Build Harmonization Tasks

## BLOCKING (Fix before E2E test suite)

### Missing data-testid
Files needing data-testid on interactive elements:
- packages/frontend/src/components/EntryFormModal.tsx
- packages/frontend/src/components/AddRateModal.tsx
- packages/frontend/src/components/SchoolDayOverrideModal.tsx
- packages/frontend/src/components/DayCell.tsx
- packages/frontend/src/components/TimesheetGrid.tsx
- packages/frontend/src/components/WeekSelector.tsx
- packages/frontend/src/components/DocumentUpload.tsx
- packages/frontend/src/pages/TaskCodeDetail.tsx
- packages/frontend/src/pages/EmployeeDetail.tsx
- packages/frontend/src/pages/TaskCodeList.tsx
- packages/frontend/src/pages/EmployeeList.tsx

### Modal Callback Naming
- SchoolDayOverrideModal.tsx: onCancel → onClose, onConfirm → onSubmit

## WARNING (Fix for consistency)

### Error State Naming
- AddRateModal.tsx: validationError → error
- TaskCodeForm.tsx: validationError → error
- EntryFormModal.tsx: errors object → error + fieldErrors

### Button Class Naming
- SchoolDayOverrideModal.tsx: .confirm-button → .submit-button

## INFO (Optional cleanup)

### CSS Class Patterns
- Standardize .age-band vs .age-band-badge
- Consider BEM: .component__element--modifier

### Database Type Mismatch
- expiresAt: date in employee_documents vs timestamp in sessions
  (Decide: should document expiry include time?)

## Playwright Test Updates (After data-testid added)

Update e2e/tests/*.spec.ts to prefer:
- page.getByTestId() over page.locator('.class')
- page.getByRole() over page.click('button:has-text()')
