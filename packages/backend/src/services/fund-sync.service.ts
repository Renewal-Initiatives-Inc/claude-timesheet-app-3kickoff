/**
 * Fund sync service — reads funds from financial-system DB and upserts
 * into the local funds_cache table for dropdown rendering.
 */

import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { financialDb, funds as externalFunds } from '../db/financial-system.js';
import type { CachedFund } from '@renewal/types';

const { fundsCache } = schema;

/**
 * Sync funds from financial-system into local cache.
 * Returns the number of funds synced.
 */
export async function syncFundsFromFinancialSystem(): Promise<number> {
  if (!financialDb) {
    throw new Error(
      'Financial system database not configured. Set FINANCIAL_SYSTEM_DATABASE_URL.'
    );
  }

  // Read all active funds from financial-system
  const remoteFunds = await financialDb
    .select({
      id: externalFunds.id,
      name: externalFunds.name,
      fundCode: externalFunds.fundCode,
      isActive: externalFunds.isActive,
    })
    .from(externalFunds);

  // Upsert each fund into local cache
  for (const fund of remoteFunds) {
    const existing = await db.query.fundsCache.findFirst({
      where: eq(fundsCache.id, fund.id),
    });

    if (existing) {
      await db
        .update(fundsCache)
        .set({
          name: fund.name,
          fundCode: fund.fundCode,
          isActive: fund.isActive,
          cachedAt: new Date(),
        })
        .where(eq(fundsCache.id, fund.id));
    } else {
      await db.insert(fundsCache).values({
        id: fund.id,
        name: fund.name,
        fundCode: fund.fundCode,
        isActive: fund.isActive,
        cachedAt: new Date(),
      });
    }
  }

  return remoteFunds.length;
}

/**
 * Get all cached funds (active only by default).
 */
export async function getCachedFunds(includeInactive = false): Promise<{
  funds: CachedFund[];
  lastSyncedAt: string | null;
}> {
  const allFunds = await db.query.fundsCache.findMany();

  const filtered = includeInactive ? allFunds : allFunds.filter((f) => f.isActive);

  // Find the most recent cached_at timestamp
  let lastSyncedAt: string | null = null;
  if (allFunds.length > 0) {
    const latest = allFunds.reduce((max, f) =>
      f.cachedAt > max.cachedAt ? f : max
    );
    lastSyncedAt = latest.cachedAt.toISOString();
  }

  return {
    funds: filtered.map((f) => ({
      id: f.id,
      name: f.name,
      fundCode: f.fundCode,
      isActive: f.isActive,
    })),
    lastSyncedAt,
  };
}
