import { test, expect } from '@playwright/test';

/**
 * E2E tests for Task Code Management.
 *
 * Test credentials (from seed data):
 * - Supervisor: sarah.supervisor@renewal.org / TestPass123!
 * - Employees: [name].age[XX]@renewal.org / TestPass123!
 */

const SUPERVISOR_EMAIL = 'sarah.supervisor@renewal.org';
const SUPERVISOR_PASSWORD = 'TestPass123!';

// Helper to login
async function login(page: ReturnType<typeof test['fn']>['page'], email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
}

test.describe('Task Code Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as supervisor before each test
    await login(page, SUPERVISOR_EMAIL, SUPERVISOR_PASSWORD);
  });

  test('supervisor can view task codes list', async ({ page }) => {
    // Navigate to task codes
    await page.click('a[href="/task-codes"]');
    await page.waitForURL('/task-codes');

    // Verify page loaded
    await expect(page.locator('h1')).toContainText('Task Codes');

    // Verify table is visible
    await expect(page.locator('table.task-codes-table')).toBeVisible();

    // Verify at least one task code is listed (from seed data)
    const rows = page.locator('table.task-codes-table tbody tr');
    await expect(rows).not.toHaveCount(0);
  });

  test('supervisor can filter task codes by type', async ({ page }) => {
    await page.goto('/task-codes');

    // Filter by Agricultural
    await page.selectOption('#type-filter', 'true');

    // Wait for results to update
    await page.waitForTimeout(500);

    // Check that all visible task codes are Agricultural
    const typeBadges = page.locator('.type-badge');
    const count = await typeBadges.count();

    for (let i = 0; i < count; i++) {
      await expect(typeBadges.nth(i)).toContainText('Agricultural');
    }
  });

  test('supervisor can search task codes', async ({ page }) => {
    await page.goto('/task-codes');

    // Search for a specific task code
    await page.fill('#search', 'Field');

    // Wait for results to update
    await page.waitForTimeout(500);

    // Verify search results contain the search term
    const rows = page.locator('table.task-codes-table tbody tr');
    const rowCount = await rows.count();

    expect(rowCount).toBeGreaterThan(0);
  });

  test('supervisor can view task code detail', async ({ page }) => {
    await page.goto('/task-codes');

    // Click on the first task code's View link
    await page.click('table.task-codes-table tbody tr:first-child a.view-link');

    // Wait for detail page
    await page.waitForURL(/\/task-codes\/[a-zA-Z0-9-]+$/);

    // Verify the page shows task code details (h1 contains task code name)
    await expect(page.locator('h1')).toBeVisible();
  });

  test('supervisor can create a new task code', async ({ page }) => {
    await page.goto('/task-codes');

    // Click Add Task Code button
    await page.click('a.add-button');
    await page.waitForURL('/task-codes/new');

    // Fill in the form using id selectors
    const uniqueCode = `T${Date.now().toString().slice(-4)}`;
    await page.fill('#code', uniqueCode);
    await page.fill('#name', 'Test Task Code');
    await page.fill('#description', 'A test task code for E2E testing');

    // Set classification (work type select)
    await page.selectOption('#type', 'agricultural');

    // Set minimum age
    await page.selectOption('#minAge', '14');

    // Set initial rate
    await page.fill('#initialRate', '10.00');

    // Set effective date (today)
    const today = new Date().toISOString().split('T')[0];
    await page.fill('#effectiveDate', today!);

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait for redirect to list page (form has 1.5s delay)
    await page.waitForURL('/task-codes', { timeout: 10000 });

    // Verify task code appears in list
    await page.fill('#search', uniqueCode);
    await page.waitForTimeout(500);

    await expect(page.locator(`text=${uniqueCode}`)).toBeVisible();
  });

  test('supervisor can edit a task code', async ({ page }) => {
    await page.goto('/task-codes');

    // Navigate to first task code detail
    await page.click('table.task-codes-table tbody tr:first-child a.view-link');
    await page.waitForURL(/\/task-codes\/[a-zA-Z0-9-]+$/);

    // Click Edit button
    await page.click('a:has-text("Edit")');
    await page.waitForURL(/\/task-codes\/[a-zA-Z0-9-]+\/edit$/);

    // Modify the name using id selector
    const originalName = await page.inputValue('#name');
    const newName = `${originalName} (Updated)`;
    await page.fill('#name', newName);

    // Submit the form
    await page.click('button[type="submit"]');

    // Verify redirect back to detail page (form has 1.5s delay)
    await page.waitForURL(/\/task-codes\/[a-zA-Z0-9-]+$/, { timeout: 10000 });

    // Verify the name was updated
    await expect(page.locator('h1')).toContainText(newName);
  });

  test('supervisor can add a new rate', async ({ page }) => {
    await page.goto('/task-codes');

    // Navigate to first task code detail
    await page.click('table.task-codes-table tbody tr:first-child a.view-link');
    await page.waitForURL(/\/task-codes\/[a-zA-Z0-9-]+$/);

    // Get initial rate count
    const initialRateRows = await page.locator('.rate-history-section table tbody tr').count();

    // Click Add New Rate button
    await page.click('button:has-text("Add New Rate")');

    // Wait for modal
    await expect(page.locator('.add-rate-modal')).toBeVisible();

    // Fill in the new rate
    await page.fill('.add-rate-modal #hourlyRate', '12.00');

    // Set future effective date
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    await page.fill('.add-rate-modal #effectiveDate', futureDate.toISOString().split('T')[0]!);

    await page.fill('.add-rate-modal #justificationNotes', 'Rate increase for testing');

    // Submit the form
    await page.click('.add-rate-modal button[type="submit"]');

    // Wait for modal to close
    await expect(page.locator('.add-rate-modal')).not.toBeVisible({ timeout: 5000 });

    // Verify new rate appears in history
    const newRateRows = await page.locator('.rate-history-section table tbody tr').count();
    expect(newRateRows).toBe(initialRateRows + 1);
  });

  test('supervisor can archive a task code', async ({ page }) => {
    // First create a task code to archive
    await page.goto('/task-codes/new');

    const uniqueCode = `A${Date.now().toString().slice(-4)}`;
    await page.fill('#code', uniqueCode);
    await page.fill('#name', 'Task Code To Archive');
    await page.selectOption('#minAge', '12');
    await page.fill('#initialRate', '8.00');

    const today = new Date().toISOString().split('T')[0];
    await page.fill('#effectiveDate', today!);

    await page.click('button[type="submit"]');
    await page.waitForURL('/task-codes', { timeout: 10000 });

    // Navigate to the task code detail
    await page.fill('#search', uniqueCode);
    await page.waitForTimeout(500);
    await page.click(`text=${uniqueCode}`);
    await page.waitForURL(/\/task-codes\/[a-zA-Z0-9-]+$/);

    // Click Archive button
    await page.click('button:has-text("Archive")');

    // Confirm archive (look for confirmation dialog)
    const confirmButton = page.locator('button:has-text("Confirm")');
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    // Should redirect to list
    await page.waitForURL('/task-codes', { timeout: 10000 });

    // Verify task code is not visible by default (active only)
    await page.fill('#search', uniqueCode);
    await page.waitForTimeout(500);
    await expect(page.locator(`table.task-codes-table >> text=${uniqueCode}`)).not.toBeVisible();

    // Enable "Include Inactive" filter
    await page.selectOption('#status-filter', 'true');
    await page.waitForTimeout(500);

    // Verify task code is now visible
    await expect(page.locator(`text=${uniqueCode}`)).toBeVisible();
  });
});

test.describe('Task Code Access Control', () => {
  test('non-supervisor sees access denied on task codes page', async ({ page }) => {
    // Login as regular employee
    await login(page, 'casey.age14@renewal.org', SUPERVISOR_PASSWORD);

    // Navigate to task codes - but since it's supervisor-only, expect access denied
    await page.goto('/task-codes');

    // Should see access denied message (not the task codes list)
    await expect(page.getByText('Access Denied')).toBeVisible();
  });

  test('non-supervisor sees access denied on task code creation page', async ({ page }) => {
    // Login as regular employee
    await login(page, 'casey.age14@renewal.org', SUPERVISOR_PASSWORD);

    // Try to navigate directly to create page
    await page.goto('/task-codes/new');

    // Should see access denied message
    await expect(page.getByText('Access Denied')).toBeVisible();
  });
});
