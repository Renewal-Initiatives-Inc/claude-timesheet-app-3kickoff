import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';

async function globalTeardown(config: FullConfig) {
  console.log('\n🧹 Running global test teardown...\n');

  // Report any orphaned processes on test ports (informational only)
  try {
    const frontendPids = execSync('lsof -ti :5173 2>/dev/null || true', { encoding: 'utf-8' }).trim();
    const backendPids = execSync('lsof -ti :3001 2>/dev/null || true', { encoding: 'utf-8' }).trim();

    if (frontendPids) {
      console.log(`ℹ Processes still on port 5173: ${frontendPids.split('\n').join(', ')}`);
    }
    if (backendPids) {
      console.log(`ℹ Processes still on port 3001: ${backendPids.split('\n').join(', ')}`);
    }

    if (!frontendPids && !backendPids) {
      console.log('✓ All test ports are clear');
    }
  } catch (e) {
    // Non-fatal - just informational
  }

  console.log('\n✓ Global teardown complete\n');
}

export default globalTeardown;
