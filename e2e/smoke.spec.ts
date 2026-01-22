import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads and displays heading', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Renewal Initiatives Timesheet'
    );
  });

  test('homepage shows health status from backend', async ({ page }) => {
    await page.goto('/');

    // Wait for the health status to load
    await expect(page.getByText('Status:')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('ok')).toBeVisible();
  });

  test('homepage displays timestamp from backend', async ({ page }) => {
    await page.goto('/');

    // Wait for timestamp to appear
    await expect(page.getByText('Last checked:')).toBeVisible({ timeout: 10000 });
    // Timestamp should be visible in the code element
    await expect(page.locator('code')).toBeVisible();
  });

  test('no console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForTimeout(2000); // Wait for any async operations

    // Filter out known acceptable errors (like favicon 404)
    const realErrors = errors.filter((err) => !err.includes('favicon') && !err.includes('404'));
    expect(realErrors).toHaveLength(0);
  });
});
