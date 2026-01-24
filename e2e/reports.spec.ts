/**
 * E2E Tests for Reports Feature
 *
 * These tests verify the reporting functionality end-to-end using Playwright.
 *
 * Prerequisites:
 * - Backend running at http://localhost:3001
 * - Frontend running at http://localhost:5173
 * - Database seeded with test users, timesheets, and compliance data
 *
 * Test credentials:
 * - Supervisor: sarah.supervisor@renewal.org / TestPass123!
 * - Employee: alex.age12@renewal.org / TestPass123!
 */

import { test, expect } from '@playwright/test';

// Helper function to login as supervisor
async function loginAsSupervisor(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'sarah.supervisor@renewal.org');
  await page.fill('input[type="password"]', 'TestPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/);
}

// Helper function to login as employee
async function loginAsEmployee(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'alex.age12@renewal.org');
  await page.fill('input[type="password"]', 'TestPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/);
}

test.describe('Reports Dashboard - Access Control', () => {
  test('supervisor can access reports dashboard', async ({ page }) => {
    await loginAsSupervisor(page);

    // Navigate to reports page
    await page.goto('/reports');

    // Should see the reports dashboard
    await expect(page.locator('h1')).toContainText('Reports');
    await expect(
      page.locator('[data-testid="reports-dashboard-payroll-card"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="reports-dashboard-compliance-card"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="reports-dashboard-timesheet-card"]')
    ).toBeVisible();
  });

  test('employee cannot access reports dashboard (403)', async ({ page }) => {
    await loginAsEmployee(page);

    // Try to navigate to reports page
    await page.goto('/reports');

    // Should be denied access
    await expect(page.locator('h1')).toContainText('Access Denied');
    await expect(page.locator('text=supervisor privileges')).toBeVisible();
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/reports');

    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Reports Dashboard - Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
    await page.goto('/reports');
  });

  test('can navigate to payroll report', async ({ page }) => {
    await page.click('[data-testid="reports-dashboard-payroll-card"]');
    await expect(page).toHaveURL(/reports\/payroll/);
    await expect(page.locator('h1')).toContainText('Payroll');
  });

  test('can navigate to compliance audit report', async ({ page }) => {
    await page.click('[data-testid="reports-dashboard-compliance-card"]');
    await expect(page).toHaveURL(/reports\/compliance-audit/);
    await expect(page.locator('h1')).toContainText('Compliance Audit');
  });

  test('can navigate to timesheet history report', async ({ page }) => {
    await page.click('[data-testid="reports-dashboard-timesheet-card"]');
    await expect(page).toHaveURL(/reports\/timesheet-history/);
    await expect(page.locator('h1')).toContainText('Timesheet History');
  });
});

test.describe('Compliance Audit Report - Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
    await page.goto('/reports/compliance-audit');
  });

  test('has all required filter controls', async ({ page }) => {
    await expect(page.locator('[data-testid="compliance-audit-start-date"]')).toBeVisible();
    await expect(page.locator('[data-testid="compliance-audit-end-date"]')).toBeVisible();
    await expect(page.locator('[data-testid="compliance-audit-employee-filter"]')).toBeVisible();
    await expect(page.locator('[data-testid="compliance-audit-age-band-filter"]')).toBeVisible();
    await expect(page.locator('[data-testid="compliance-audit-result-filter"]')).toBeVisible();
    await expect(page.locator('[data-testid="compliance-audit-search-button"]')).toBeVisible();
  });

  test('can apply date range filter', async ({ page }) => {
    // Set date range
    await page.fill('[data-testid="compliance-audit-start-date"]', '2024-01-01');
    await page.fill('[data-testid="compliance-audit-end-date"]', '2024-12-31');

    // Click search
    await page.click('[data-testid="compliance-audit-search-button"]');

    // Should see results or empty message
    await page.waitForSelector('[data-testid="compliance-audit-results-table"], .compliance-audit-report-empty', { timeout: 10000 });
  });

  test('can filter by age band', async ({ page }) => {
    // Set date range first
    await page.fill('[data-testid="compliance-audit-start-date"]', '2024-01-01');
    await page.fill('[data-testid="compliance-audit-end-date"]', '2024-12-31');

    // Select age band
    await page.selectOption('[data-testid="compliance-audit-age-band-filter"]', '12-13');

    // Click search
    await page.click('[data-testid="compliance-audit-search-button"]');

    // Should complete without error
    await page.waitForSelector('[data-testid="compliance-audit-results-table"], .compliance-audit-report-empty', { timeout: 10000 });
  });

  test('can filter by result (pass/fail/na)', async ({ page }) => {
    // Set date range first
    await page.fill('[data-testid="compliance-audit-start-date"]', '2024-01-01');
    await page.fill('[data-testid="compliance-audit-end-date"]', '2024-12-31');

    // Select result filter
    await page.selectOption('[data-testid="compliance-audit-result-filter"]', 'fail');

    // Click search
    await page.click('[data-testid="compliance-audit-search-button"]');

    // Should complete without error
    await page.waitForSelector('[data-testid="compliance-audit-results-table"], .compliance-audit-report-empty', { timeout: 10000 });
  });

  test('shows empty results message for no matching records', async ({ page }) => {
    // Set a very old date range that won't have records
    await page.fill('[data-testid="compliance-audit-start-date"]', '1990-01-01');
    await page.fill('[data-testid="compliance-audit-end-date"]', '1990-01-31');

    // Apply filters
    await page.click('[data-testid="compliance-audit-search-button"]');

    // Should show empty state message
    await expect(page.locator('text=No compliance checks found')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Compliance Audit Report - Summary Display', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
    await page.goto('/reports/compliance-audit');
  });

  test('displays summary cards after search', async ({ page }) => {
    await page.fill('[data-testid="compliance-audit-start-date"]', '2024-01-01');
    await page.fill('[data-testid="compliance-audit-end-date"]', '2024-12-31');
    await page.click('[data-testid="compliance-audit-search-button"]');

    // Wait for loading to complete
    await page.waitForSelector('.compliance-audit-report-loading', { state: 'hidden', timeout: 10000 });

    // Summary cards should be visible
    await expect(page.locator('[data-testid="compliance-audit-summary-total"]')).toBeVisible();
    await expect(page.locator('[data-testid="compliance-audit-summary-pass"]')).toBeVisible();
    await expect(page.locator('[data-testid="compliance-audit-summary-fail"]')).toBeVisible();
  });
});

test.describe('Compliance Audit Report - CSV Export', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
    await page.goto('/reports/compliance-audit');
  });

  test('export button triggers CSV download when records exist', async ({ page }) => {
    // First, get some data
    await page.fill('[data-testid="compliance-audit-start-date"]', '2024-01-01');
    await page.fill('[data-testid="compliance-audit-end-date"]', '2024-12-31');
    await page.click('[data-testid="compliance-audit-search-button"]');

    // Wait for loading
    await page.waitForSelector('.compliance-audit-report-loading', { state: 'hidden', timeout: 10000 });

    // Check if export button is visible (only shown when records exist)
    const exportButton = page.locator('[data-testid="compliance-audit-export-csv"]');
    if (await exportButton.isVisible()) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download');

      // Click export
      await exportButton.click();

      // Verify download started
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('compliance-audit');
      expect(download.suggestedFilename()).toContain('.csv');
    }
  });
});

test.describe('Timesheet History Report - Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
    await page.goto('/reports/timesheet-history');
  });

  test('has all required filter controls', async ({ page }) => {
    await expect(page.locator('[data-testid="timesheet-history-start-date"]')).toBeVisible();
    await expect(page.locator('[data-testid="timesheet-history-end-date"]')).toBeVisible();
    await expect(page.locator('[data-testid="timesheet-history-employee-filter"]')).toBeVisible();
    await expect(page.locator('[data-testid="timesheet-history-status-filter"]')).toBeVisible();
    await expect(page.locator('[data-testid="timesheet-history-age-band-filter"]')).toBeVisible();
    await expect(page.locator('[data-testid="timesheet-history-search-button"]')).toBeVisible();
  });

  test('can filter by status', async ({ page }) => {
    // Set date range first
    await page.fill('[data-testid="timesheet-history-start-date"]', '2024-01-01');
    await page.fill('[data-testid="timesheet-history-end-date"]', '2024-12-31');

    // Select status filter
    await page.selectOption('[data-testid="timesheet-history-status-filter"]', 'rejected');

    // Click search
    await page.click('[data-testid="timesheet-history-search-button"]');

    // Should complete without error
    await page.waitForSelector('[data-testid="timesheet-history-results-table"], .timesheet-history-report-empty', { timeout: 10000 });
  });

  test('shows rejection notes for rejected timesheets', async ({ page }) => {
    // Set date range
    await page.fill('[data-testid="timesheet-history-start-date"]', '2024-01-01');
    await page.fill('[data-testid="timesheet-history-end-date"]', '2024-12-31');

    // Filter for rejected
    await page.selectOption('[data-testid="timesheet-history-status-filter"]', 'rejected');

    // Search
    await page.click('[data-testid="timesheet-history-search-button"]');

    // Wait for results
    await page.waitForSelector('.timesheet-history-report-loading', { state: 'hidden', timeout: 10000 });

    // If there are rejected timesheets with notes, expand button should be visible
    const expandButton = page.locator('.expand-button').first();
    if (await expandButton.isVisible()) {
      await expandButton.click();
      // Notes section should be visible after expanding
      await expect(page.locator('.details-content')).toBeVisible();
    }
  });
});

test.describe('Timesheet History Report - Summary Display', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
    await page.goto('/reports/timesheet-history');
  });

  test('displays summary cards after search', async ({ page }) => {
    await page.fill('[data-testid="timesheet-history-start-date"]', '2024-01-01');
    await page.fill('[data-testid="timesheet-history-end-date"]', '2024-12-31');
    await page.click('[data-testid="timesheet-history-search-button"]');

    // Wait for loading to complete
    await page.waitForSelector('.timesheet-history-report-loading', { state: 'hidden', timeout: 10000 });

    // Summary cards should be visible
    await expect(page.locator('[data-testid="timesheet-history-summary-total"]')).toBeVisible();
    await expect(page.locator('[data-testid="timesheet-history-summary-approved"]')).toBeVisible();
    await expect(page.locator('[data-testid="timesheet-history-summary-rejected"]')).toBeVisible();
  });
});

test.describe('Payroll Report - Age Band Filter', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
    await page.goto('/reports/payroll');
  });

  test('has age band filter control', async ({ page }) => {
    await expect(page.locator('[data-testid="payroll-report-age-band-filter"]')).toBeVisible();
  });

  test('can filter by age band', async ({ page }) => {
    // Set date range
    await page.fill('[data-testid="payroll-report-start-date"]', '2024-01-01');
    await page.fill('[data-testid="payroll-report-end-date"]', '2024-12-31');

    // Select age band filter
    await page.selectOption('[data-testid="payroll-report-age-band-filter"]', '14-15');

    // Apply filters
    await page.click('[data-testid="payroll-report-apply-filters"]');

    // Should complete without error
    await page.waitForSelector('[data-testid="payroll-report-loading"]', { state: 'hidden', timeout: 10000 });
  });
});

test.describe('Reports - Read-Only Verification', () => {
  test('compliance audit report has no edit controls', async ({ page }) => {
    await loginAsSupervisor(page);
    await page.goto('/reports/compliance-audit');

    // Search for data
    await page.fill('[data-testid="compliance-audit-start-date"]', '2024-01-01');
    await page.fill('[data-testid="compliance-audit-end-date"]', '2024-12-31');
    await page.click('[data-testid="compliance-audit-search-button"]');

    // Wait for results
    await page.waitForSelector('.compliance-audit-report-loading', { state: 'hidden', timeout: 10000 });

    // Verify no edit buttons exist in the table
    await expect(page.locator('button:has-text("Edit")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Delete")')).not.toBeVisible();
    await expect(page.locator('input:not([type="date"])')).not.toBeVisible();
  });

  test('timesheet history report has no edit controls', async ({ page }) => {
    await loginAsSupervisor(page);
    await page.goto('/reports/timesheet-history');

    // Search for data
    await page.fill('[data-testid="timesheet-history-start-date"]', '2024-01-01');
    await page.fill('[data-testid="timesheet-history-end-date"]', '2024-12-31');
    await page.click('[data-testid="timesheet-history-search-button"]');

    // Wait for results
    await page.waitForSelector('.timesheet-history-report-loading', { state: 'hidden', timeout: 10000 });

    // Verify no edit buttons exist in the table (except View links)
    await expect(page.locator('button:has-text("Edit")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Delete")')).not.toBeVisible();
  });
});

test.describe('Reports - Date Range Validation', () => {
  test('compliance audit report validates start date before end date', async ({ page }) => {
    await loginAsSupervisor(page);
    await page.goto('/reports/compliance-audit');

    // Set invalid date range (start after end)
    await page.fill('[data-testid="compliance-audit-start-date"]', '2024-12-31');
    await page.fill('[data-testid="compliance-audit-end-date"]', '2024-01-01');

    // Try to search
    await page.click('[data-testid="compliance-audit-search-button"]');

    // Should show error message
    await expect(page.locator('[data-testid="error-compliance-audit"]')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Reports - Navigation Links', () => {
  test('reports link visible in navigation for supervisors', async ({ page }) => {
    await loginAsSupervisor(page);

    // Should see Reports link in nav
    await expect(page.locator('nav a[href="/reports"]')).toBeVisible();
  });

  test('reports link not visible for regular employees', async ({ page }) => {
    await loginAsEmployee(page);

    // Should NOT see Reports link in nav
    await expect(page.locator('nav a[href="/reports"]')).not.toBeVisible();
  });
});
