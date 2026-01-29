# Post-Build Harmonization Tasks

## WARNING (Fix for consistency)

### Error State Naming

- TaskCodeForm.tsx: validationError → error

### Button Class Naming

- SchoolDayOverrideModal.tsx: .confirm-button → .submit-button

## INFO (Optional cleanup)

### CSS Class Patterns

- Standardize .age-band vs .age-band-badge
- Consider BEM: .component\_\_element--modifier

### Database Type Mismatch

- expiresAt: date in employee_documents vs timestamp in sessions
  (Decide: should document expiry include time?)
