/**
 * E2E Tests for Payroll Report Feature
 *
 * These tests verify the payroll report functionality end-to-end using Playwright.
 *
 * Prerequisites:
 * - Backend running at http://localhost:3001
 * - Frontend running at http://localhost:5173
 * - Zitadel instance configured for SSO authentication
 * - Database seeded with test employees and approved timesheets with payroll records
 *
 * Note: These tests require an authenticated session. With SSO, authentication
 * must be handled via Playwright storage state. The tests are skipped by default.
 *
 * To enable these tests:
 * 1. Create an auth setup script that logs in via Zitadel and saves storage state
 * 2. Configure playwright.config.ts to use the storage state for this test file
 * 3. Remove the .skip modifier below
 *
 * Test accounts (in Zitadel):
 * - Supervisor: sarah.supervisor@renewal.org
 * - Employee: alex.age12@renewal.org
 */

import { test, expect } from '@playwright/test';

/**
 * Access control tests - these can run without authentication (test redirects/denials).
 */
test.describe('Payroll Report - Access Control (Unauthenticated)', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/payroll');

    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });
});

/**
 * Authenticated tests - require Playwright storage state with authenticated supervisor session.
 */
test.describe.skip('Payroll Report - Access Control (requires authenticated storage state)', () => {
  test('supervisor can access payroll report page', async ({ page }) => {
    // Navigate to payroll page
    await page.goto('/payroll');

    // Should see the payroll report page
    await expect(page.locator('h1')).toContainText('Payroll Reports');
    await expect(page.locator('[data-testid="payroll-report-start-date"]')).toBeVisible();
    await expect(page.locator('[data-testid="payroll-report-end-date"]')).toBeVisible();
  });
});

test.describe.skip(
  'Payroll Report - Employee Access Denied (requires authenticated employee storage state)',
  () => {
    test('employee cannot access payroll report page (403)', async ({ page }) => {
      // Try to navigate to payroll page
      await page.goto('/payroll');

      // Should be denied access
      await expect(page.locator('h1')).toContainText('Access Denied');
      await expect(page.locator('text=supervisor privileges')).toBeVisible();
    });
  }
);

test.describe.skip('Payroll Report - Filtering (requires authenticated storage state)', () => {
  test('can apply date range filter', async ({ page }) => {
    await page.goto('/payroll');

    // Set date range
    await page.fill('[data-testid="payroll-report-start-date"]', '2024-01-01');
    await page.fill('[data-testid="payroll-report-end-date"]', '2024-12-31');

    // Click apply filters
    await page.click('[data-testid="payroll-report-apply-filters"]');

    // Should see loading state briefly, then results or empty message
    await expect(page.locator('[data-testid="payroll-report-loading"]')).not.toBeVisible({
      timeout: 10000,
    });
  });

  test('can filter by employee', async ({ page }) => {
    await page.goto('/payroll');

    // Open employee filter dropdown
    const employeeFilter = page.locator('[data-testid="payroll-report-employee-filter"]');
    await employeeFilter.click();

    // Should see "All Employees" option
    await expect(employeeFilter.locator('option:first-child')).toContainText('All Employees');
  });

  test('shows empty results message for no matching records', async ({ page }) => {
    await page.goto('/payroll');

    // Set a very old date range that won't have records
    await page.fill('[data-testid="payroll-report-start-date"]', '1990-01-01');
    await page.fill('[data-testid="payroll-report-end-date"]', '1990-01-31');

    // Apply filters
    await page.click('[data-testid="payroll-report-apply-filters"]');

    // Wait for loading to finish
    await expect(page.locator('[data-testid="payroll-report-loading"]')).not.toBeVisible({
      timeout: 10000,
    });

    // Should show empty state message
    await expect(page.locator('text=No payroll records found')).toBeVisible();
  });
});

test.describe.skip('Payroll Report - Results Display (requires authenticated storage state)', () => {
  test('displays payroll table with correct columns', async ({ page }) => {
    await page.goto('/payroll');

    // Set a date range that likely has data
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await page.fill(
      '[data-testid="payroll-report-start-date"]',
      thirtyDaysAgo.toISOString().split('T')[0]!
    );
    await page.fill('[data-testid="payroll-report-end-date"]', today.toISOString().split('T')[0]!);

    await page.click('[data-testid="payroll-report-apply-filters"]');

    // Wait for loading to complete
    await expect(page.locator('[data-testid="payroll-report-loading"]')).not.toBeVisible({
      timeout: 10000,
    });

    // If there are records, check table structure
    const table = page.locator('[data-testid="payroll-report-table"]');
    if (await table.isVisible()) {
      // Check table headers
      await expect(table.locator('th')).toContainText(['Employee', 'Period']);
    }
  });

  test('displays summary totals when records exist', async ({ page }) => {
    await page.goto('/payroll');

    // Set a date range
    await page.fill('[data-testid="payroll-report-start-date"]', '2024-01-01');
    await page.fill('[data-testid="payroll-report-end-date"]', '2024-12-31');

    await page.click('[data-testid="payroll-report-apply-filters"]');

    // Wait for loading to complete
    await expect(page.locator('[data-testid="payroll-report-loading"]')).not.toBeVisible({
      timeout: 10000,
    });

    // Check for total earnings summary (visible if there are records)
    const totalEarnings = page.locator('[data-testid="payroll-report-total-earnings"]');
    // It may or may not be visible depending on data, but if visible should have currency format
    if (await totalEarnings.isVisible()) {
      await expect(totalEarnings).toContainText('$');
    }
  });
});

test.describe.skip('Payroll Report - CSV Export (requires authenticated storage state)', () => {
  test('export button triggers CSV download when records exist', async ({ page }) => {
    await page.goto('/payroll');

    // First, get some data
    await page.fill('[data-testid="payroll-report-start-date"]', '2024-01-01');
    await page.fill('[data-testid="payroll-report-end-date"]', '2024-12-31');
    await page.click('[data-testid="payroll-report-apply-filters"]');

    // Wait for loading
    await expect(page.locator('[data-testid="payroll-report-loading"]')).not.toBeVisible({
      timeout: 10000,
    });

    // Check if export button is visible (only shown when records exist)
    const exportButton = page.locator('[data-testid="payroll-report-export-csv"]');
    if (await exportButton.isVisible()) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download');

      // Click export
      await exportButton.click();

      // Verify download started
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('payroll-export');
      expect(download.suggestedFilename()).toContain('.csv');
    }
  });

  test('export button is hidden when no records', async ({ page }) => {
    await page.goto('/payroll');

    // Set date range with no records
    await page.fill('[data-testid="payroll-report-start-date"]', '1990-01-01');
    await page.fill('[data-testid="payroll-report-end-date"]', '1990-01-31');
    await page.click('[data-testid="payroll-report-apply-filters"]');

    // Wait for loading
    await expect(page.locator('[data-testid="payroll-report-loading"]')).not.toBeVisible({
      timeout: 10000,
    });

    // Export button should not be visible
    await expect(page.locator('[data-testid="payroll-report-export-csv"]')).not.toBeVisible();
  });
});

test.describe.skip('Payroll Report - Error Handling (requires authenticated storage state)', () => {
  test('displays error message on API failure', async ({ page }) => {
    await page.goto('/payroll');

    // Mock API to fail
    await page.route('**/api/payroll/report*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Server error' }),
      });
    });

    // Apply filters to trigger API call
    await page.click('[data-testid="payroll-report-apply-filters"]');

    // Should show error message
    await expect(page.locator('[data-testid="error-payroll-report"]')).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe.skip('Payroll Report - Navigation (requires authenticated storage state)', () => {
  test('payroll link visible in navigation for supervisors', async ({ page }) => {
    await page.goto('/timesheet');

    // Should see Payroll link in nav
    await expect(page.locator('nav a[href="/payroll"]')).toBeVisible();
  });
});

test.describe.skip(
  'Payroll Report - Employee Navigation (requires authenticated employee storage state)',
  () => {
    test('payroll link not visible for regular employees', async ({ page }) => {
      await page.goto('/timesheet');

      // Should NOT see Payroll link in nav
      await expect(page.locator('nav a[href="/payroll"]')).not.toBeVisible();
    });
  }
);
