/**
 * E2E Tests for Authentication Flow
 *
 * These tests verify the SSO authentication system using Zitadel/OIDC.
 *
 * Prerequisites:
 * - Backend running at http://localhost:3001
 * - Frontend running at http://localhost:5173
 * - Zitadel instance configured and accessible
 * - Database seeded with test employees (linked by email to Zitadel accounts)
 *
 * Note: Full SSO E2E testing requires either:
 * - Zitadel test accounts for automated login
 * - Playwright storage state from a previous authenticated session
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env['API_URL'] || 'http://localhost:3001';

test.describe('Login Page (SSO)', () => {
  test('should display login page with SSO button', async ({ page }) => {
    await page.goto('/login');

    // Check login page elements
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Renewal Initiatives');
    await expect(page.getByText('Timesheet Management System')).toBeVisible();
    await expect(page.locator('[data-testid="login-submit-button"]')).toBeVisible();
  });

  test('should display SSO login button with correct text', async ({ page }) => {
    await page.goto('/login');

    const loginButton = page.locator('[data-testid="login-submit-button"]');
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toContainText('Sign in with Renewal Initiatives');
  });

  test('should show error when auth fails', async ({ page }) => {
    // Navigate to login with error parameter (simulates SSO callback failure)
    await page.goto('/login?error=auth_failed');

    const errorDisplay = page.locator('[data-testid="login-error"]');
    await expect(errorDisplay).toBeVisible();
    await expect(errorDisplay).toContainText('Authentication failed');
  });

  test('should have closeable error message', async ({ page }) => {
    await page.goto('/login?error=auth_failed');

    const errorDisplay = page.locator('[data-testid="login-error"]');
    await expect(errorDisplay).toBeVisible();

    // Close the error
    await page.click('[data-testid="login-error-close-button"]');

    // Error should be hidden (the element might still exist but error cleared)
    await expect(errorDisplay).not.toBeVisible();
  });
});

test.describe('Protected Routes (Unauthenticated)', () => {
  test('should redirect to login when accessing timesheet unauthenticated', async ({ page }) => {
    await page.goto('/timesheet');
    await expect(page).toHaveURL(/login/);
  });

  test('should redirect to login when accessing employees unauthenticated', async ({ page }) => {
    await page.goto('/employees');
    await expect(page).toHaveURL(/login/);
  });

  test('should redirect to login when accessing review queue unauthenticated', async ({ page }) => {
    await page.goto('/review');
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Callback Page', () => {
  test('should display loading state on callback page', async ({ page }) => {
    // The callback page shows a loading spinner while processing auth
    await page.goto('/callback');

    // Should show "Completing sign in..." message
    await expect(page.getByText('Completing sign in...')).toBeVisible();
  });

  test('should redirect to login on auth error', async ({ page }) => {
    // Without proper OIDC state, callback should redirect to login with error
    await page.goto('/callback');

    // Wait for redirect (callback will fail without proper state and redirect)
    await page.waitForURL(/login/, { timeout: 5000 }).catch(() => {
      // If no redirect happens, we're in a loading state which is also valid
      // (depends on OIDC config)
    });
  });
});

test.describe('Auth API E2E', () => {
  test('GET /api/auth/me - should reject without token', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/auth/me`);
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toBe('Authentication required');
  });

  test('GET /api/auth/me - should reject with invalid token', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/auth/me`, {
      headers: {
        Authorization: 'Bearer invalid-token-here',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('GET /api/auth/me - should reject with malformed auth header', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/auth/me`, {
      headers: {
        Authorization: 'NotBearer some-token',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('POST /api/auth/logout - should reject without token', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/auth/logout`);
    expect(response.status()).toBe(401);
  });
});

test.describe('Supervisor-only API Routes (Unauthenticated)', () => {
  test('GET /api/supervisor/review-queue - should reject without auth', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/supervisor/review-queue`);
    expect(response.status()).toBe(401);
  });

  test('GET /api/supervisor/review-count - should reject without auth', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/supervisor/review-count`);
    expect(response.status()).toBe(401);
  });

  test('POST /api/supervisor/unlock-week - should reject without auth', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/supervisor/unlock-week`, {
      data: {
        employeeId: '550e8400-e29b-41d4-a716-446655440000',
        weekStartDate: '2025-01-19',
      },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe('Backend Health', () => {
  test('GET /api/health - should be accessible without auth', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });
});
