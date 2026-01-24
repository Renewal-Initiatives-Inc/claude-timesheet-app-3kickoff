import { useState, useEffect, useCallback } from 'react';
import type { ReviewQueueItem, TimesheetReviewData, ComplianceCheckLog } from '@renewal/types';
import {
  getReviewQueue,
  getPendingReviewCount,
  getTimesheetForReview,
  approveTimesheet,
  rejectTimesheet,
  ApiRequestError,
} from '../api/client.js';

export interface UseReviewQueueResult {
  items: ReviewQueueItem[];
  total: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export interface UseReviewQueueOptions {
  employeeId?: string;
}

/**
 * Hook for fetching the supervisor review queue.
 */
export function useReviewQueue(options?: UseReviewQueueOptions): UseReviewQueueResult {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getReviewQueue({ employeeId: options?.employeeId });
      setItems(response.items);
      setTotal(response.total);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to load review queue');
      }
    } finally {
      setLoading(false);
    }
  }, [options?.employeeId]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  return {
    items,
    total,
    loading,
    error,
    refresh: fetchQueue,
  };
}

export interface UsePendingReviewCountResult {
  count: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Hook for fetching the count of pending reviews.
 */
export function usePendingReviewCount(): UsePendingReviewCountResult {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCount = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getPendingReviewCount();
      setCount(response.count);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to load pending review count');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  return {
    count,
    loading,
    error,
    refresh: fetchCount,
  };
}

export interface UseReviewDetailResult {
  reviewData: TimesheetReviewData | null;
  loading: boolean;
  error: string | null;
  approving: boolean;
  rejecting: boolean;
  approve: (notes?: string) => Promise<boolean>;
  reject: (notes: string) => Promise<boolean>;
  refresh: () => void;
}

/**
 * Hook for fetching a single timesheet for review and performing actions.
 */
export function useReviewDetail(timesheetId: string | undefined): UseReviewDetailResult {
  const [reviewData, setReviewData] = useState<TimesheetReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const fetchReviewData = useCallback(async () => {
    if (!timesheetId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getTimesheetForReview(timesheetId);
      setReviewData(data);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to load timesheet for review');
      }
    } finally {
      setLoading(false);
    }
  }, [timesheetId]);

  useEffect(() => {
    fetchReviewData();
  }, [fetchReviewData]);

  const approve = useCallback(async (notes?: string): Promise<boolean> => {
    if (!timesheetId) return false;

    setApproving(true);
    setError(null);
    try {
      await approveTimesheet(timesheetId, notes);
      return true;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to approve timesheet');
      }
      return false;
    } finally {
      setApproving(false);
    }
  }, [timesheetId]);

  const reject = useCallback(async (notes: string): Promise<boolean> => {
    if (!timesheetId) return false;

    setRejecting(true);
    setError(null);
    try {
      await rejectTimesheet(timesheetId, notes);
      return true;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to reject timesheet');
      }
      return false;
    } finally {
      setRejecting(false);
    }
  }, [timesheetId]);

  return {
    reviewData,
    loading,
    error,
    approving,
    rejecting,
    approve,
    reject,
    refresh: fetchReviewData,
  };
}
