# CONVENTIONS

Claude: Read this before generating UI components, API routes, or tests.

## REQUIRED: Test IDs

All interactive elements MUST have data-testid:

```
data-testid="{context}-{action}-button"    // task-code-submit-button
data-testid="field-{name}"                 // field-email, field-startTime
data-testid="{name}-modal"                 // entry-form-modal
data-testid="error-{context}"              // error-form, error-field-email
```

## REQUIRED: Modal Props

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void; // NOT onCancel, onDismiss
  onSubmit?: () => void; // NOT onConfirm
  onSuccess?: () => void; // optional, after submit succeeds
}
```

## REQUIRED: Error State

```typescript
const [error, setError] = useState<string | null>(null);
const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
// NOT: validationError, errors, errorMessage
```

## Naming Patterns

| Context           | Pattern          | Example                 |
| ----------------- | ---------------- | ----------------------- |
| Components        | PascalCase       | TimesheetGrid.tsx       |
| Hooks             | use + PascalCase | useTimesheet            |
| Internal handlers | handle + Action  | handleSubmit            |
| Callback props    | on + Action      | onSubmit, onClose       |
| Boolean state     | is + State       | isLoading, isOpen       |
| Date-only fields  | \*Date           | workDate, effectiveDate |
| Timestamp fields  | \*At             | createdAt, submittedAt  |

## Toolset-Enforced (No Action Needed)

| Layer         | Convention      | Enforcer             |
| ------------- | --------------- | -------------------- |
| DB columns    | snake_case      | Drizzle ORM          |
| TS properties | camelCase       | Drizzle auto-convert |
| API fields    | camelCase       | Zod validation       |
| Error codes   | SCREAMING_SNAKE | Custom pattern       |

## CSS Classes

```
.{component}-{element}
.{component}--{state}
```
