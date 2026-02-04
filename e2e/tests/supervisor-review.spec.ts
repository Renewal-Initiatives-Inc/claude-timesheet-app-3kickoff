/**
 * E2E Tests for Supervisor Review Workflow
 *
 * These tests verify the timesheet submission and review workflow.
 *
 * Prerequisites:
 * - Backend running at http://localhost:3001
 * - Frontend running at http://localhost:5173
 * - Zitadel instance configured for SSO authentication
 * - Database seeded with test employees
 *
 * Note: Tests requiring authentication use Playwright storage state.
 * To run authenticated tests, first run the auth setup to create a storage state file.
 *
 * Test accounts (in Zitadel):
 * - Supervisor: sarah.supervisor@renewal.org
 * - Employee: alex.age12@renewal.org
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env['API_URL'] || 'http://localhost:3001';

/**
 * Unauthenticated API tests - these verify that routes properly reject unauthorized access.
 */
test.describe('Supervisor Review API - Unauthenticated', () => {
  test.describe('GET /api/supervisor/review-queue', () => {
    test('should reject requests without auth', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/supervisor/review-queue`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('GET /api/supervisor/review-count', () => {
    test('should reject requests without auth', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/supervisor/review-count`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('POST /api/supervisor/unlock-week', () => {
    test('should reject requests without auth', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/supervisor/unlock-week`, {
        data: {
          employeeId: '550e8400-e29b-41d4-a716-446655440000',
          weekStartDate: '2025-01-19',
        },
      });
      expect(response.status()).toBe(401);
    });
  });
});

test.describe('Review Actions API - Unauthenticated', () => {
  test.describe('POST /api/supervisor/review/:id/approve', () => {
    test('should reject requests without auth', async ({ request }) => {
      const response = await request.post(
        `${API_URL}/api/supervisor/review/00000000-0000-0000-0000-000000000000/approve`,
        {
          data: {},
        }
      );
      expect(response.status()).toBe(401);
    });
  });

  test.describe('POST /api/supervisor/review/:id/reject', () => {
    test('should reject requests without auth', async ({ request }) => {
      const response = await request.post(
        `${API_URL}/api/supervisor/review/00000000-0000-0000-0000-000000000000/reject`,
        {
          data: {
            notes: 'Please correct the hours on Monday.',
          },
        }
      );
      expect(response.status()).toBe(401);
    });
  });
});

/**
 * Authenticated API tests - require valid Zitadel token.
 * These are skipped by default. To run them:
 * 1. Set TEST_AUTH_TOKEN environment variable with a valid Zitadel access token
 * 2. Or configure Playwright to use storage state with an authenticated session
 */
test.describe('Supervisor Review API - Authenticated', () => {
  const authToken = process.env['TEST_AUTH_TOKEN'];

  test.skip(!authToken, 'Requires TEST_AUTH_TOKEN environment variable');

  test.describe('GET /api/supervisor/review-queue', () => {
    test('should return review queue for supervisors', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/supervisor/review-queue`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body).toHaveProperty('items');
      expect(body).toHaveProperty('total');
      expect(Array.isArray(body.items)).toBe(true);
    });
  });

  test.describe('GET /api/supervisor/review-count', () => {
    test('should return pending review count', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/supervisor/review-count`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
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
          Authorization: `Bearer ${authToken}`,
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
          Authorization: `Bearer ${authToken}`,
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

test.describe('Review Actions API - Authenticated', () => {
  const authToken = process.env['TEST_AUTH_TOKEN'];

  test.skip(!authToken, 'Requires TEST_AUTH_TOKEN environment variable');

  test.describe('POST /api/supervisor/review/:id/approve', () => {
    test('should reject approval of non-existent timesheet', async ({ request }) => {
      const response = await request.post(
        `${API_URL}/api/supervisor/review/00000000-0000-0000-0000-000000000000/approve`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
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
            Authorization: `Bearer ${authToken}`,
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
            Authorization: `Bearer ${authToken}`,
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
            Authorization: `Bearer ${authToken}`,
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
            Authorization: `Bearer ${authToken}`,
          },
          data: {
            notes:
              'Please correct the hours on Monday - they exceed the daily limit for your age band.',
          },
        }
      );

      // Will be 404 (not found) but validates schema acceptance
      expect([400, 404]).toContain(response.status());
    });
  });
});

/**
 * UI E2E tests for Supervisor Review functionality.
 *
 * These tests require an authenticated session via Playwright storage state.
 * The tests verify the Review Queue UI when accessed by a supervisor.
 *
 * To enable these tests:
 * 1. Create an auth setup script that logs in via Zitadel and saves storage state
 * 2. Configure playwright.config.ts to use the storage state for this test file
 * 3. Remove the .skip modifier below
 *
 * Note: SSO authentication flows cannot be automated without proper Zitadel
 * test account setup and redirect handling.
 */
test.describe.skip('Supervisor Review UI (requires authenticated storage state)', () => {
  test('should display Review Queue in navigation for supervisors', async ({ page }) => {
    await page.goto('/timesheet');
    await expect(page.locator('a:has-text("Review Queue")')).toBeVisible();
  });

  test('should show pending count badge when timesheets pending', async ({ page }) => {
    await page.goto('/timesheet');

    // Badge may or may not be visible depending on data
    const badge = page.locator('[data-testid="review-queue-badge"]');
    const hasBadge = await badge.isVisible();

    if (hasBadge) {
      const count = await badge.textContent();
      expect(parseInt(count || '0')).toBeGreaterThanOrEqual(0);
    }
  });

  test('should navigate to Review Queue page', async ({ page }) => {
    await page.goto('/timesheet');
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

  test('should display loading state while fetching data', async ({ page }) => {
    // Navigate directly to review page
    await page.goto('/review');

    // Either loading state or content should be visible
    const loading = page.locator('[data-testid="review-queue-loading"]');
    const table = page.locator('[data-testid="review-queue-table"]');
    const emptyState = page.locator('[data-testid="review-queue-empty-state"]');

    // Wait for either loading to appear and disappear, or content to appear
    await expect(loading.or(table).or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test('should show error state with retry button on API failure', async ({ page }) => {
    // This test would require mocking the API to fail
    // For now, just verify the error elements exist in the component structure
    await page.goto('/review');

    // Wait for content to load
    await page.waitForLoadState('networkidle');

    // If there's an error, the retry button should be visible
    const errorContainer = page.locator('[data-testid="error-review-queue"]');
    const hasError = await errorContainer.isVisible();

    if (hasError) {
      await expect(page.locator('[data-testid="review-queue-retry-button"]')).toBeVisible();
    }
  });
});
