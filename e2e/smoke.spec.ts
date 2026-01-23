import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('login page loads and displays heading', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Renewal Initiatives'
    );
    await expect(page.getByText('Timesheet Management System')).toBeVisible();
  });

  test('login page displays login form', async ({ page }) => {
    await page.goto('/login');

    // Check login form elements are present
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('backend health endpoint responds', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/health');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  test('no console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/login');
    await page.waitForTimeout(2000); // Wait for any async operations

    // Filter out known acceptable errors (like favicon 404)
    const realErrors = errors.filter((err) => !err.includes('favicon') && !err.includes('404'));
    expect(realErrors).toHaveLength(0);
  });
});
