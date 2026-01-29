import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';

async function globalSetup(config: FullConfig) {
  console.log('\n🧹 Running global test setup...\n');

  // Run cleanup script to ensure clean environment
  try {
    execSync('npm run test:clean', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } catch (e) {
    // Cleanup script may not exist yet or may fail - that's ok
    console.warn('Cleanup script warning (non-fatal):', (e as Error).message);
  }

  // Verify Docker is running (needed for database in E2E tests)
  try {
    execSync('docker info', { stdio: 'ignore' });
    console.log('✓ Docker is running');
  } catch (e) {
    console.warn('⚠ Docker does not appear to be running - database tests may fail');
  }

  console.log('\n✓ Global setup complete\n');
}

export default globalSetup;
