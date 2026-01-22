/**
 * E2E Tests for Authentication Flow
 *
 * These tests verify the authentication system end-to-end using Playwright.
 * Note: The frontend login UI will be built in Phase 4.
 * For now, these tests serve as a stub/specification for the expected behavior.
 *
 * Prerequisites:
 * - Backend running at http://localhost:3001
 * - Frontend running at http://localhost:5173
 * - Database seeded with test users
 *
 * Test credentials:
 * - Supervisor: sarah.supervisor@renewal.org / TestPass123!
 * - Employee: alex.age12@renewal.org / TestPass123!
 */

import { test, expect } from '@playwright/test';

// Skip all tests until frontend is implemented
test.describe.skip('Authentication Flow', () => {
  test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login');

      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');

      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');

      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText(
        /invalid/i
      );
    });

    test('should login successfully with valid credentials', async ({ page }) => {
      await page.goto('/login');

      await page.fill('input[name="email"]', 'sarah.supervisor@renewal.org');
      await page.fill('input[name="password"]', 'TestPass123!');
      await page.click('button[type="submit"]');

      // Should redirect to dashboard
      await expect(page).toHaveURL(/dashboard/);
    });

    test('should show user name after login', async ({ page }) => {
      await page.goto('/login');

      await page.fill('input[name="email"]', 'sarah.supervisor@renewal.org');
      await page.fill('input[name="password"]', 'TestPass123!');
      await page.click('button[type="submit"]');

      await expect(page.locator('[data-testid="user-name"]')).toContainText(
        'Sarah Supervisor'
      );
    });

    test('should show account locked message after too many failed attempts', async ({
      page,
    }) => {
      await page.goto('/login');

      // Attempt login 5 times with wrong password
      for (let i = 0; i < 5; i++) {
        await page.fill('input[name="email"]', 'sarah.supervisor@renewal.org');
        await page.fill('input[name="password"]', 'wrongpassword');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(500); // Brief wait between attempts
      }

      // 6th attempt should show locked message
      await page.fill('input[name="email"]', 'sarah.supervisor@renewal.org');
      await page.fill('input[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');

      await expect(page.locator('[data-testid="error-message"]')).toContainText(
        /locked/i
      );
    });
  });

  test.describe('Logout', () => {
    test.beforeEach(async ({ page }) => {
      // Login first
      await page.goto('/login');
      await page.fill('input[name="email"]', 'sarah.supervisor@renewal.org');
      await page.fill('input[name="password"]', 'TestPass123!');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/dashboard/);
    });

    test('should logout successfully', async ({ page }) => {
      await page.click('[data-testid="logout-button"]');

      // Should redirect to login
      await expect(page).toHaveURL(/login/);
    });

    test('should not access protected page after logout', async ({ page }) => {
      await page.click('[data-testid="logout-button"]');
      await expect(page).toHaveURL(/login/);

      // Try to access dashboard directly
      await page.goto('/dashboard');

      // Should redirect back to login
      await expect(page).toHaveURL(/login/);
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect to login when accessing protected route unauthenticated', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/login/);
    });

    test('should redirect to login when accessing timesheets unauthenticated', async ({
      page,
    }) => {
      await page.goto('/timesheets');
      await expect(page).toHaveURL(/login/);
    });

    test('should show supervisor-only features for supervisors', async ({ page }) => {
      // Login as supervisor
      await page.goto('/login');
      await page.fill('input[name="email"]', 'sarah.supervisor@renewal.org');
      await page.fill('input[name="password"]', 'TestPass123!');
      await page.click('button[type="submit"]');

      // Should see employee management link
      await expect(page.locator('[data-testid="nav-employees"]')).toBeVisible();
    });

    test('should hide supervisor-only features for regular employees', async ({
      page,
    }) => {
      // Login as regular employee
      await page.goto('/login');
      await page.fill('input[name="email"]', 'alex.age12@renewal.org');
      await page.fill('input[name="password"]', 'TestPass123!');
      await page.click('button[type="submit"]');

      // Should NOT see employee management link
      await expect(page.locator('[data-testid="nav-employees"]')).not.toBeVisible();
    });
  });

  test.describe('Password Reset Flow', () => {
    test('should navigate to password reset from login page', async ({ page }) => {
      await page.goto('/login');
      await page.click('[data-testid="forgot-password-link"]');

      await expect(page).toHaveURL(/password-reset/);
    });

    test('should show success message after requesting reset', async ({ page }) => {
      await page.goto('/password-reset');
      await page.fill('input[name="email"]', 'sarah.supervisor@renewal.org');
      await page.click('button[type="submit"]');

      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-message"]')).toContainText(
        /reset link/i
      );
    });

    // Note: Full password reset flow requires email delivery testing
    // which is typically done in integration tests, not E2E
  });
});

// API-level E2E tests (these can run without frontend)
test.describe('Auth API E2E', () => {
  const API_URL = process.env['API_URL'] || 'http://localhost:3001';

  test('POST /api/auth/login - successful login', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        email: 'sarah.supervisor@renewal.org',
        password: 'TestPass123!',
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('token');
    expect(body).toHaveProperty('employee');
    expect(body.employee.email).toBe('sarah.supervisor@renewal.org');
  });

  test('POST /api/auth/login - invalid credentials', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        email: 'sarah.supervisor@renewal.org',
        password: 'wrongpassword',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('INVALID_CREDENTIALS');
  });

  test('GET /api/auth/me - with valid token', async ({ request }) => {
    // First login to get token
    const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        email: 'sarah.supervisor@renewal.org',
        password: 'TestPass123!',
      },
    });
    const { token } = await loginResponse.json();

    // Use token to get current user
    const meResponse = await request.get(`${API_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(meResponse.ok()).toBeTruthy();
    const body = await meResponse.json();
    expect(body.employee.email).toBe('sarah.supervisor@renewal.org');
    expect(body.employee.isSupervisor).toBe(true);
  });

  test('GET /api/auth/me - without token', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/auth/me`);
    expect(response.status()).toBe(401);
  });

  test('POST /api/auth/logout - invalidates session', async ({ request }) => {
    // Login first
    const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        email: 'sarah.supervisor@renewal.org',
        password: 'TestPass123!',
      },
    });
    const { token } = await loginResponse.json();

    // Logout
    const logoutResponse = await request.post(`${API_URL}/api/auth/logout`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(logoutResponse.status()).toBe(204);

    // Try to use token again
    const meResponse = await request.get(`${API_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(meResponse.status()).toBe(401);
  });

  test('POST /api/auth/password-reset/request - always succeeds', async ({
    request,
  }) => {
    // Test with non-existent email (should still return 200 for security)
    const response = await request.post(
      `${API_URL}/api/auth/password-reset/request`,
      {
        data: {
          email: 'nonexistent@example.com',
        },
      }
    );

    expect(response.ok()).toBeTruthy();
  });
});
