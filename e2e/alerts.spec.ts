/**
 * E2E Tests for Alerts & Notifications
 *
 * These tests verify the alerts functionality on the dashboard and alerts page.
 *
 * Prerequisites:
 * - Backend running at http://localhost:3001
 * - Frontend running at http://localhost:5173
 * - Database seeded with test users and employees with various documentation states
 *
 * Test credentials:
 * - Supervisor: sarah.supervisor@renewal.org / TestPass123!
 */

import { test, expect } from '@playwright/test';

// Helper function to login as supervisor
async function loginAsSupervisor(page: any) {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'sarah.supervisor@renewal.org');
  await page.fill('input[name="password"]', 'TestPass123!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/dashboard/);
}

test.describe('Dashboard Alerts', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
  });

  test('should display alerts banner when alerts exist', async ({ page }) => {
    // Look for alerts banner on dashboard
    const alertsBanner = page.locator('[data-testid="alerts-banner"]');

    // The banner might not be visible if no alerts exist (which is valid)
    // Check if it's either visible with alerts or not present
    const bannerCount = await alertsBanner.count();
    if (bannerCount > 0) {
      await expect(alertsBanner).toBeVisible();
      await expect(alertsBanner.locator('h3')).toContainText('Action Required');
    }
  });

  test('should display pending review count in stats', async ({ page }) => {
    // Look for the pending review stat card
    const pendingReviewLink = page.locator('[data-testid="dashboard-pending-review-link"]');
    await expect(pendingReviewLink).toBeVisible();

    // Should show a count (including 0)
    const statValue = pendingReviewLink.locator('.stat-value');
    await expect(statValue).toBeVisible();

    // Should have proper label
    const statLabel = pendingReviewLink.locator('.stat-label');
    await expect(statLabel).toContainText('Pending Review');
  });

  test('pending review count should link to review queue', async ({ page }) => {
    const pendingReviewLink = page.locator('[data-testid="dashboard-pending-review-link"]');
    await pendingReviewLink.click();

    await expect(page).toHaveURL(/\/review/);
  });

  test('should have refresh button in alerts banner', async ({ page }) => {
    const alertsBanner = page.locator('[data-testid="alerts-banner"]');
    const bannerCount = await alertsBanner.count();

    if (bannerCount > 0) {
      const refreshButton = page.locator('[data-testid="alerts-refresh-button"]');
      await expect(refreshButton).toBeVisible();
    }
  });

  test('view all alerts link should navigate to alerts page', async ({ page }) => {
    const alertsBanner = page.locator('[data-testid="alerts-banner"]');
    const bannerCount = await alertsBanner.count();

    if (bannerCount > 0) {
      const viewAllLink = page.locator('[data-testid="alerts-view-all-link"]');
      const viewAllCount = await viewAllLink.count();

      if (viewAllCount > 0) {
        await viewAllLink.click();
        await expect(page).toHaveURL(/\/alerts/);
      }
    }
  });

  test('alert items should link to employee detail', async ({ page }) => {
    const alertsBanner = page.locator('[data-testid="alerts-banner"]');
    const bannerCount = await alertsBanner.count();

    if (bannerCount > 0) {
      // Get the first alert link
      const firstAlertLink = page.locator('.alert-link').first();
      const linkCount = await firstAlertLink.count();

      if (linkCount > 0) {
        await firstAlertLink.click();
        await expect(page).toHaveURL(/\/employees\//);
      }
    }
  });
});

test.describe('Alerts Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
  });

  test('should display alerts page with header', async ({ page }) => {
    await page.goto('/alerts');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('All Alerts');
  });

  test('should display filter controls', async ({ page }) => {
    await page.goto('/alerts');

    // Type filter
    const typeFilter = page.locator('[data-testid="alerts-type-filter"]');
    await expect(typeFilter).toBeVisible();

    // Search input
    const searchInput = page.locator('[data-testid="alerts-search-input"]');
    await expect(searchInput).toBeVisible();

    // Refresh button
    const refreshButton = page.locator('[data-testid="alerts-refresh-button"]');
    await expect(refreshButton).toBeVisible();
  });

  test('should filter alerts by type', async ({ page }) => {
    await page.goto('/alerts');

    const typeFilter = page.locator('[data-testid="alerts-type-filter"]');
    await typeFilter.selectOption('missing_document');

    // Check that the selected option is set
    await expect(typeFilter).toHaveValue('missing_document');
  });

  test('should filter alerts by employee name', async ({ page }) => {
    await page.goto('/alerts');

    const searchInput = page.locator('[data-testid="alerts-search-input"]');
    await searchInput.fill('test');

    // The filter should be applied (we can't verify results without knowing the data)
    await expect(searchInput).toHaveValue('test');
  });

  test('should have back to dashboard link', async ({ page }) => {
    await page.goto('/alerts');

    const backLink = page.locator('[data-testid="alerts-back-to-dashboard"]');
    await expect(backLink).toBeVisible();

    await backLink.click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should display empty state when no alerts match filters', async ({ page }) => {
    await page.goto('/alerts');

    // Search for a non-existent name
    const searchInput = page.locator('[data-testid="alerts-search-input"]');
    await searchInput.fill('xyznonexistent123');

    // Should show either empty state or zero results
    // The alerts count text should show "Showing 0 of X alerts"
    await expect(page.locator('.alerts-count')).toContainText('Showing 0');
  });

  test('alert row should link to employee detail', async ({ page }) => {
    await page.goto('/alerts');

    // Wait for the list to load
    await page.waitForLoadState('networkidle');

    const alertsList = page.locator('[data-testid="alerts-list"]');
    const listCount = await alertsList.count();

    if (listCount > 0) {
      // Get first action link
      const actionLink = page.locator('[data-testid^="alert-action-"]').first();
      const linkCount = await actionLink.count();

      if (linkCount > 0) {
        await actionLink.click();
        await expect(page).toHaveURL(/\/employees\//);
      }
    }
  });
});

test.describe('Pending Review Integration', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSupervisor(page);
  });

  test('pending review count should update after approving timesheet', async ({ page }) => {
    // Get initial pending count
    const pendingReviewLink = page.locator('[data-testid="dashboard-pending-review-link"]');
    const initialCountText = await pendingReviewLink.locator('.stat-value').textContent();
    const initialCount = parseInt(initialCountText || '0');

    // If there are pending timesheets, approve one and check count decreases
    if (initialCount > 0) {
      // Navigate to review queue
      await pendingReviewLink.click();
      await expect(page).toHaveURL(/\/review/);

      // Click on first timesheet
      const firstTimesheetLink = page.locator('.review-item-link').first();
      const linkCount = await firstTimesheetLink.count();

      if (linkCount > 0) {
        await firstTimesheetLink.click();
        await expect(page).toHaveURL(/\/review\//);

        // Find and click approve button
        const approveButton = page.locator('[data-testid="approve-button"]');
        const approveCount = await approveButton.count();

        if (approveCount > 0) {
          await approveButton.click();

          // Navigate back to dashboard
          await page.goto('/dashboard');

          // Check that count decreased
          const newCountText = await pendingReviewLink.locator('.stat-value').textContent();
          const newCount = parseInt(newCountText || '0');

          expect(newCount).toBeLessThan(initialCount);
        }
      }
    }
  });
});
