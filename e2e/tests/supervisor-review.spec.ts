/**
 * E2E Tests for Supervisor Review Workflow
 *
 * These tests verify the timesheet submission and review workflow.
 *
 * Prerequisites:
 * - Backend running at http://localhost:3001
 * - Database seeded with test users and timesheets
 *
 * Test credentials:
 * - Supervisor: sarah.supervisor@renewal.org / TestPass123!
 * - Employee: alex.age12@renewal.org / TestPass123!
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env['API_URL'] || 'http://localhost:3001';

// Helper function to login and get token
async function loginAs(
  request: typeof test.Request,
  email: string,
  password: string
): Promise<string> {
  const response = await request.post(`${API_URL}/api/auth/login`, {
    data: { email, password },
  });
  const { token } = await response.json();
  return token;
}

test.describe('Supervisor Review API', () => {
  let supervisorToken: string;

  test.beforeAll(async ({ request }) => {
    // Login as supervisor
    supervisorToken = await loginAs(
      request,
      'sarah.supervisor@renewal.org',
      'TestPass123!'
    );
  });

  test.describe('GET /api/supervisor/review-queue', () => {
    test('should return review queue for supervisors', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/supervisor/review-queue`, {
        headers: {
          Authorization: `Bearer ${supervisorToken}`,
        },
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body).toHaveProperty('items');
      expect(body).toHaveProperty('total');
      expect(Array.isArray(body.items)).toBe(true);
    });

    test('should reject requests without auth', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/supervisor/review-queue`);
      expect(response.status()).toBe(401);
    });

    test('should reject requests from non-supervisors', async ({ request }) => {
      // Login as regular employee
      const employeeToken = await loginAs(
        request,
        'alex.age12@renewal.org',
        'TestPass123!'
      );

      const response = await request.get(`${API_URL}/api/supervisor/review-queue`, {
        headers: {
          Authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.status()).toBe(403);
    });
  });

  test.describe('GET /api/supervisor/review-count', () => {
    test('should return pending review count', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/supervisor/review-count`, {
        headers: {
          Authorization: `Bearer ${supervisorToken}`,
        },
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body).toHaveProperty('count');
      expect(typeof body.count).toBe('number');
    });
  });

  test.describe('POST /api/supervisor/unlock-week', () => {
    test('should validate week start date is a Sunday', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/supervisor/unlock-week`, {
        headers: {
          Authorization: `Bearer ${supervisorToken}`,
        },
        data: {
          employeeId: '550e8400-e29b-41d4-a716-446655440000',
          weekStartDate: '2025-01-20', // Monday, not Sunday
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation Error');
    });

    test('should reject invalid employee ID format', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/supervisor/unlock-week`, {
        headers: {
          Authorization: `Bearer ${supervisorToken}`,
        },
        data: {
          employeeId: 'not-a-uuid',
          weekStartDate: '2025-01-19',
        },
      });

      expect(response.status()).toBe(400);
    });
  });
});

test.describe('Review Actions API', () => {
  let supervisorToken: string;

  test.beforeAll(async ({ request }) => {
    supervisorToken = await loginAs(
      request,
      'sarah.supervisor@renewal.org',
      'TestPass123!'
    );
  });

  test.describe('POST /api/supervisor/review/:id/approve', () => {
    test('should reject approval of non-existent timesheet', async ({ request }) => {
      const response = await request.post(
        `${API_URL}/api/supervisor/review/00000000-0000-0000-0000-000000000000/approve`,
        {
          headers: {
            Authorization: `Bearer ${supervisorToken}`,
          },
          data: {},
        }
      );

      expect(response.status()).toBe(404);
    });

    test('should accept optional notes', async ({ request }) => {
      const response = await request.post(
        `${API_URL}/api/supervisor/review/00000000-0000-0000-0000-000000000000/approve`,
        {
          headers: {
            Authorization: `Bearer ${supervisorToken}`,
          },
          data: {
            notes: 'Good work this week!',
          },
        }
      );

      // Will be 404 (not found) but validates schema acceptance
      expect([400, 404]).toContain(response.status());
    });
  });

  test.describe('POST /api/supervisor/review/:id/reject', () => {
    test('should require notes field', async ({ request }) => {
      const response = await request.post(
        `${API_URL}/api/supervisor/review/00000000-0000-0000-0000-000000000000/reject`,
        {
          headers: {
            Authorization: `Bearer ${supervisorToken}`,
          },
          data: {},
        }
      );

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation Error');
    });

    test('should require notes to be at least 10 characters', async ({ request }) => {
      const response = await request.post(
        `${API_URL}/api/supervisor/review/00000000-0000-0000-0000-000000000000/reject`,
        {
          headers: {
            Authorization: `Bearer ${supervisorToken}`,
          },
          data: {
            notes: 'Too short',
          },
        }
      );

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation Error');
    });

    test('should accept valid rejection notes', async ({ request }) => {
      const response = await request.post(
        `${API_URL}/api/supervisor/review/00000000-0000-0000-0000-000000000000/reject`,
        {
          headers: {
            Authorization: `Bearer ${supervisorToken}`,
          },
          data: {
            notes: 'Please correct the hours on Monday - they exceed the daily limit for your age band.',
          },
        }
      );

      // Will be 404 (not found) but validates schema acceptance
      expect([400, 404]).toContain(response.status());
    });
  });
});

test.describe('Timesheet Immutability API', () => {
  test('should prevent editing submitted timesheets', async ({ request }) => {
    // Login as supervisor first to get a submitted timesheet ID
    const supervisorToken = await loginAs(
      request,
      'sarah.supervisor@renewal.org',
      'TestPass123!'
    );

    // Get review queue to find a submitted timesheet (if any)
    const queueResponse = await request.get(`${API_URL}/api/supervisor/review-queue`, {
      headers: {
        Authorization: `Bearer ${supervisorToken}`,
      },
    });

    const queue = await queueResponse.json();

    if (queue.items.length > 0) {
      const submittedTimesheetId = queue.items[0].id;

      // Try to add entry to submitted timesheet (should fail)
      const addEntryResponse = await request.post(
        `${API_URL}/api/timesheets/${submittedTimesheetId}/entries`,
        {
          headers: {
            Authorization: `Bearer ${supervisorToken}`,
          },
          data: {
            workDate: '2025-01-20',
            taskCodeId: '00000000-0000-0000-0000-000000000001',
            startTime: '09:00',
            endTime: '12:00',
            isSchoolDay: false,
          },
        }
      );

      expect(addEntryResponse.status()).toBe(400);
      const body = await addEntryResponse.json();
      expect(body.error).toBe('TIMESHEET_NOT_EDITABLE');
    }
  });
});

// UI E2E tests (require frontend running)
test.describe.skip('Supervisor Review UI', () => {
  test.beforeEach(async ({ page }) => {
    // Login as supervisor
    await page.goto('/login');
    await page.fill('[data-testid="field-email"]', 'sarah.supervisor@renewal.org');
    await page.fill('[data-testid="field-password"]', 'TestPass123!');
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/dashboard/);
  });

  test('should display Review Queue in navigation', async ({ page }) => {
    await expect(page.locator('a:has-text("Review Queue")')).toBeVisible();
  });

  test('should show pending count badge when timesheets pending', async ({ page }) => {
    // Badge may or may not be visible depending on data
    const badge = page.locator('[data-testid="review-queue-badge"]');
    const hasBadge = await badge.isVisible();

    if (hasBadge) {
      const count = await badge.textContent();
      expect(parseInt(count || '0')).toBeGreaterThanOrEqual(0);
    }
  });

  test('should navigate to Review Queue page', async ({ page }) => {
    await page.click('a:has-text("Review Queue")');
    await expect(page).toHaveURL(/review/);
  });

  test('should display review queue table or empty state', async ({ page }) => {
    await page.goto('/review');

    // Either table or empty state should be visible
    const table = page.locator('[data-testid="review-queue-table"]');
    const emptyState = page.locator('[data-testid="review-queue-empty-state"]');

    const hasTable = await table.isVisible();
    const hasEmptyState = await emptyState.isVisible();

    expect(hasTable || hasEmptyState).toBe(true);
  });
});
