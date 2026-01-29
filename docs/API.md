# Renewal Initiatives Timesheet API Documentation

## Base URL

- Development: `http://localhost:3001/api`
- Production: `https://[your-vercel-domain]/api`

## Authentication

All API endpoints (except `/auth/login` and `/health`) require authentication via JWT token.

Include the token in the `Authorization` header:

```
Authorization: Bearer <token>
```

### CSRF Protection

State-changing requests (POST, PUT, PATCH, DELETE) require a CSRF token:

1. GET `/api/csrf-token` to obtain a token (stored in cookie)
2. Include `X-CSRF-Token: <token>` header in subsequent requests

---

## Endpoints

### Health Check

| Endpoint  | Method | Description           |
| --------- | ------ | --------------------- |
| `/health` | GET    | Health check endpoint |

### Authentication (`/auth`)

| Endpoint                        | Method | Description                             | Rate Limit  |
| ------------------------------- | ------ | --------------------------------------- | ----------- |
| `/auth/login`                   | POST   | Authenticate user                       | 5 req/15min |
| `/auth/logout`                  | POST   | Logout user                             | -           |
| `/auth/me`                      | GET    | Get current user info                   | -           |
| `/auth/register`                | POST   | Register new employee (supervisor only) | 3 req/hour  |
| `/auth/change-password`         | POST   | Change password                         | -           |
| `/auth/password-reset/request`  | POST   | Request password reset                  | 3 req/hour  |
| `/auth/password-reset/complete` | POST   | Complete password reset                 | -           |

### Employees (`/employees`)

| Endpoint                   | Method | Description            | Auth       |
| -------------------------- | ------ | ---------------------- | ---------- |
| `/employees`               | GET    | List all employees     | Supervisor |
| `/employees/:id`           | GET    | Get employee details   | Supervisor |
| `/employees/:id`           | PUT    | Update employee        | Supervisor |
| `/employees/:id/documents` | GET    | Get employee documents | Supervisor |

### Documents (`/documents`)

| Endpoint            | Method | Description     | Auth       |
| ------------------- | ------ | --------------- | ---------- |
| `/documents/upload` | POST   | Upload document | Supervisor |
| `/documents/:id`    | DELETE | Delete document | Supervisor |

### Task Codes (`/task-codes`)

| Endpoint                | Method | Description           | Auth          |
| ----------------------- | ------ | --------------------- | ------------- |
| `/task-codes`           | GET    | List all task codes   | Authenticated |
| `/task-codes`           | POST   | Create task code      | Supervisor    |
| `/task-codes/:id`       | GET    | Get task code details | Authenticated |
| `/task-codes/:id`       | PUT    | Update task code      | Supervisor    |
| `/task-codes/:id/rates` | GET    | Get task code rates   | Supervisor    |
| `/task-codes/:id/rates` | POST   | Add new rate          | Supervisor    |

### Timesheets (`/timesheets`)

| Endpoint                           | Method | Description              | Auth             |
| ---------------------------------- | ------ | ------------------------ | ---------------- |
| `/timesheets`                      | GET    | List employee timesheets | Authenticated    |
| `/timesheets`                      | POST   | Create/get timesheet     | Authenticated    |
| `/timesheets/:id`                  | GET    | Get timesheet details    | Owner/Supervisor |
| `/timesheets/:id/entries`          | POST   | Add entry                | Owner            |
| `/timesheets/:id/entries/:entryId` | PUT    | Update entry             | Owner            |
| `/timesheets/:id/entries/:entryId` | DELETE | Delete entry             | Owner            |
| `/timesheets/:id/submit`           | POST   | Submit for review        | Owner            |

### Supervisor Review (`/supervisor`)

| Endpoint                                            | Method | Description            | Auth       |
| --------------------------------------------------- | ------ | ---------------------- | ---------- |
| `/supervisor/review-queue`                          | GET    | Get pending reviews    | Supervisor |
| `/supervisor/review-queue/count`                    | GET    | Get pending count      | Supervisor |
| `/supervisor/timesheets/:id/review`                 | POST   | Review timesheet       | Supervisor |
| `/supervisor/employees/:id/timesheets/:timesheetId` | GET    | Get employee timesheet | Supervisor |

### Dashboard (`/dashboard`)

| Endpoint     | Method | Description        | Auth          |
| ------------ | ------ | ------------------ | ------------- |
| `/dashboard` | GET    | Get dashboard data | Authenticated |

### Payroll (`/payroll`)

| Endpoint             | Method | Description         | Auth       |
| -------------------- | ------ | ------------------- | ---------- |
| `/payroll/calculate` | POST   | Calculate payroll   | Supervisor |
| `/payroll/export`    | POST   | Export payroll      | Supervisor |
| `/payroll/records`   | GET    | Get payroll records | Supervisor |

### Reports (`/reports`)

| Endpoint                     | Method | Description              | Auth       |
| ---------------------------- | ------ | ------------------------ | ---------- |
| `/reports/compliance-audit`  | GET    | Compliance audit report  | Supervisor |
| `/reports/timesheet-history` | GET    | Timesheet history report | Supervisor |

---

## Request/Response Formats

### Login

```json
// Request POST /auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

// Response 200
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "user@example.com",
    "isSupervisor": false
  }
}
```

### Create Timesheet Entry

```json
// Request POST /timesheets/:id/entries
{
  "workDate": "2024-01-15",
  "taskCodeId": "uuid",
  "startTime": "09:00",
  "endTime": "12:00",
  "isSchoolDay": false,
  "supervisorPresentName": "Sarah Supervisor"
}

// Response 201
{
  "id": "uuid",
  "timesheetId": "uuid",
  "workDate": "2024-01-15",
  "taskCodeId": "uuid",
  "startTime": "09:00:00",
  "endTime": "12:00:00",
  "hours": "3.00",
  "isSchoolDay": false,
  "supervisorPresentName": "Sarah Supervisor",
  "createdAt": "2024-01-15T14:00:00.000Z"
}
```

### Submit Timesheet

```json
// Request POST /timesheets/:id/submit
// (no body required)

// Response 200 (success)
{
  "success": true,
  "message": "Timesheet submitted for review",
  "timesheet": { ... }
}

// Response 400 (compliance failure)
{
  "success": false,
  "error": "COMPLIANCE_FAILED",
  "message": "Timesheet has compliance violations",
  "violations": [
    {
      "ruleId": "RULE-002",
      "ruleName": "Ages 12-13 Daily Hour Limit",
      "message": "On 2024-01-15, you worked 5 hours which exceeds the 4 hour daily limit.",
      "remediation": "Reduce hours on this date to 4 hours or less."
    }
  ]
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable message",
  "details": { ... }  // Optional, development only
}
```

### Common Error Codes

| Code                  | HTTP Status | Description              |
| --------------------- | ----------- | ------------------------ |
| `INVALID_CREDENTIALS` | 401         | Wrong email/password     |
| `TOKEN_EXPIRED`       | 401         | JWT token expired        |
| `FORBIDDEN`           | 403         | Insufficient permissions |
| `NOT_FOUND`           | 404         | Resource not found       |
| `VALIDATION_ERROR`    | 400         | Invalid input data       |
| `COMPLIANCE_FAILED`   | 400         | Compliance check failed  |
| `RATE_LIMITED`        | 429         | Too many requests        |

---

## Rate Limiting

| Endpoint                 | Limit        | Window     |
| ------------------------ | ------------ | ---------- |
| `/auth/login`            | 5 requests   | 15 minutes |
| `/auth/register`         | 3 requests   | 1 hour     |
| `/auth/password-reset/*` | 3 requests   | 1 hour     |
| All other endpoints      | 100 requests | 15 minutes |

Rate limit headers:

- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Requests remaining
- `RateLimit-Reset`: Time until reset (seconds)
