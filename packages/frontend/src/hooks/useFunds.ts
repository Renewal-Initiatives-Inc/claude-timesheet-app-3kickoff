import { useState, useEffect, useCallback } from 'react';
import type { CachedFund } from '@renewal/types';
import { getFunds, ApiRequestError } from '../api/client.js';

interface UseFundsResult {
  funds: CachedFund[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook for fetching cached funds for dropdown rendering.
 */
export function useFunds(): UseFundsResult {
  const [funds, setFunds] = useState<CachedFund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFunds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getFunds();
      setFunds(response.funds);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to load funds');
      }
      // Non-blocking: fund selection is optional
      setFunds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFunds();
  }, [fetchFunds]);

  return { funds, loading, error, refetch: fetchFunds };
}
