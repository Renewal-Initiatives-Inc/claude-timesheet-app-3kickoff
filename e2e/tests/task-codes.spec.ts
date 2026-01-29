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
async function login(
  page: ReturnType<(typeof test)['fn']>['page'],
  email: string,
  password: string
) {
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
    await page.getByRole('link', { name: /task codes/i }).click();
    await page.waitForURL('/task-codes');

    // Verify page loaded
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Task Codes');

    // Verify table is visible
    await expect(page.getByTestId('task-codes-table')).toBeVisible();

    // Verify at least one task code is listed (from seed data)
    const rows = page.getByTestId('task-codes-table').locator('tbody tr');
    await expect(rows).not.toHaveCount(0);
  });

  test('supervisor can filter task codes by type', async ({ page }) => {
    await page.goto('/task-codes');

    // Filter by Agricultural
    await page.getByTestId('field-isAgricultural').selectOption('true');

    // Wait for results to update
    await page.waitForTimeout(500);

    // Check that all visible task codes are Agricultural
    const typeBadges = page.getByTestId('task-code-type-badge');
    const count = await typeBadges.count();

    for (let i = 0; i < count; i++) {
      await expect(typeBadges.nth(i)).toContainText('Agricultural');
    }
  });

  test('supervisor can search task codes', async ({ page }) => {
    await page.goto('/task-codes');

    // Search for a specific task code
    await page.getByTestId('field-search').fill('Field');

    // Wait for results to update
    await page.waitForTimeout(500);

    // Verify search results contain the search term
    const rows = page.getByTestId('task-codes-table').locator('tbody tr');
    const rowCount = await rows.count();

    expect(rowCount).toBeGreaterThan(0);
  });

  test('supervisor can view task code detail', async ({ page }) => {
    await page.goto('/task-codes');

    // Click on the first task code's View link
    await page
      .getByTestId('task-codes-table')
      .locator('tbody tr')
      .first()
      .getByRole('link', { name: 'View' })
      .click();

    // Wait for detail page
    await page.waitForURL(/\/task-codes\/[a-zA-Z0-9-]+$/);

    // Verify the page shows task code details (h1 contains task code name)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('supervisor can create a new task code', async ({ page }) => {
    await page.goto('/task-codes');

    // Click Add Task Code button
    await page.getByTestId('task-code-add-button').click();
    await page.waitForURL('/task-codes/new');

    // Fill in the form
    const uniqueCode = `T${Date.now().toString().slice(-4)}`;
    await page.getByTestId('field-code').fill(uniqueCode);
    await page.getByTestId('field-name').fill('Test Task Code');
    await page.getByTestId('field-description').fill('A test task code for E2E testing');

    // Set classification (work type select)
    await page.getByTestId('field-type').selectOption('agricultural');

    // Set minimum age
    await page.getByTestId('field-minAge').selectOption('14');

    // Set initial rate
    await page.getByTestId('field-initialRate').fill('10.00');

    // Set effective date (today)
    const today = new Date().toISOString().split('T')[0];
    await page.getByTestId('field-rateEffectiveDate').fill(today!);

    // Submit the form
    await page.getByTestId('task-code-submit-button').click();

    // Wait for redirect to list page (form has 1.5s delay)
    await page.waitForURL('/task-codes', { timeout: 10000 });

    // Verify task code appears in list
    await page.getByTestId('field-search').fill(uniqueCode);
    await page.waitForTimeout(500);

    await expect(page.getByText(uniqueCode)).toBeVisible();
  });

  test('supervisor can edit a task code', async ({ page }) => {
    await page.goto('/task-codes');

    // Navigate to first task code detail
    await page
      .getByTestId('task-codes-table')
      .locator('tbody tr')
      .first()
      .getByRole('link', { name: 'View' })
      .click();
    await page.waitForURL(/\/task-codes\/[a-zA-Z0-9-]+$/);

    // Click Edit button
    await page.getByTestId('task-code-edit-button').click();
    await page.waitForURL(/\/task-codes\/[a-zA-Z0-9-]+\/edit$/);

    // Modify the name
    const originalName = await page.getByTestId('field-name').inputValue();
    const newName = `${originalName} (Updated)`;
    await page.getByTestId('field-name').fill(newName);

    // Submit the form
    await page.getByTestId('task-code-submit-button').click();

    // Verify redirect back to detail page (form has 1.5s delay)
    await page.waitForURL(/\/task-codes\/[a-zA-Z0-9-]+$/, { timeout: 10000 });

    // Verify the name was updated
    await expect(page.getByRole('heading', { level: 1 })).toContainText(newName);
  });

  test('supervisor can add a new rate', async ({ page }) => {
    await page.goto('/task-codes');

    // Navigate to first task code detail
    await page
      .getByTestId('task-codes-table')
      .locator('tbody tr')
      .first()
      .getByRole('link', { name: 'View' })
      .click();
    await page.waitForURL(/\/task-codes\/[a-zA-Z0-9-]+$/);

    // Get initial rate count
    const initialRateRows = await page
      .getByTestId('rate-history-table')
      .locator('tbody tr')
      .count();

    // Click Add New Rate button
    await page.getByTestId('task-code-add-rate-button').click();

    // Wait for modal
    await expect(page.getByTestId('add-rate-modal')).toBeVisible();

    // Fill in the new rate
    await page.getByTestId('field-hourlyRate').fill('12.00');

    // Set future effective date
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    await page.getByTestId('field-effectiveDate').fill(futureDate.toISOString().split('T')[0]!);

    await page.getByTestId('field-justificationNotes').fill('Rate increase for testing');

    // Submit the form
    await page.getByTestId('add-rate-modal-submit-button').click();

    // Wait for modal to close
    await expect(page.getByTestId('add-rate-modal')).not.toBeVisible({ timeout: 5000 });

    // Verify new rate appears in history
    const newRateRows = await page.getByTestId('rate-history-table').locator('tbody tr').count();
    expect(newRateRows).toBe(initialRateRows + 1);
  });

  test('supervisor can archive a task code', async ({ page }) => {
    // First create a task code to archive
    await page.goto('/task-codes/new');

    const uniqueCode = `A${Date.now().toString().slice(-4)}`;
    await page.getByTestId('field-code').fill(uniqueCode);
    await page.getByTestId('field-name').fill('Task Code To Archive');
    await page.getByTestId('field-minAge').selectOption('12');
    await page.getByTestId('field-initialRate').fill('8.00');

    const today = new Date().toISOString().split('T')[0];
    await page.getByTestId('field-rateEffectiveDate').fill(today!);

    await page.getByTestId('task-code-submit-button').click();
    await page.waitForURL('/task-codes', { timeout: 10000 });

    // Navigate to the task code detail
    await page.getByTestId('field-search').fill(uniqueCode);
    await page.waitForTimeout(500);
    await page.getByText(uniqueCode).click();
    await page.waitForURL(/\/task-codes\/[a-zA-Z0-9-]+$/);

    // Click Archive button
    await page.getByTestId('task-code-archive-button').click();

    // Confirm archive
    await page.getByTestId('task-code-archive-confirm-button').click();

    // Should redirect to list
    await page.waitForURL('/task-codes', { timeout: 10000 });

    // Verify task code is not visible by default (active only)
    await page.getByTestId('field-search').fill(uniqueCode);
    await page.waitForTimeout(500);
    await expect(page.getByTestId('task-codes-table').getByText(uniqueCode)).not.toBeVisible();

    // Enable "Include Inactive" filter
    await page.getByTestId('field-includeInactive').selectOption('true');
    await page.waitForTimeout(500);

    // Verify task code is now visible
    await expect(page.getByText(uniqueCode)).toBeVisible();
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
