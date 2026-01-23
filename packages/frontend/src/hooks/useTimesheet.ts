import { useState, useEffect, useCallback } from 'react';
import type {
  TimesheetWithEntries,
  TimesheetTotals,
  CreateEntryRequest,
  UpdateEntryRequest,
  TimesheetEntry,
  Timesheet,
  TimesheetListParams,
} from '@renewal/types';
import {
  getCurrentTimesheet,
  getTimesheetByWeek,
  getTimesheetById,
  getTimesheets,
  createTimesheetEntry,
  updateTimesheetEntry,
  deleteTimesheetEntry,
  ApiRequestError,
} from '../api/client.js';

interface UseTimesheetOptions {
  weekStartDate?: string; // If not provided, uses current week
}

interface UseTimesheetResult {
  timesheet: TimesheetWithEntries | null;
  totals: TimesheetTotals | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  addEntry: (entry: CreateEntryRequest) => Promise<void>;
  updateEntry: (entryId: string, updates: UpdateEntryRequest) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
  refresh: () => void;
}

/**
 * Hook for managing a single timesheet with entries
 */
export function useTimesheet(options: UseTimesheetOptions = {}): UseTimesheetResult {
  const [timesheet, setTimesheet] = useState<TimesheetWithEntries | null>(null);
  const [totals, setTotals] = useState<TimesheetTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchTimesheet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = options.weekStartDate
        ? await getTimesheetByWeek(options.weekStartDate)
        : await getCurrentTimesheet();
      setTimesheet(result);
      setTotals(result.totals);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to load timesheet');
      }
    } finally {
      setLoading(false);
    }
  }, [options.weekStartDate]);

  useEffect(() => {
    fetchTimesheet();
  }, [fetchTimesheet]);

  const addEntry = useCallback(async (entry: CreateEntryRequest) => {
    if (!timesheet) return;
    setSaving(true);
    setError(null);
    try {
      await createTimesheetEntry(timesheet.id, entry);
      await fetchTimesheet(); // Refresh to get updated totals
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to add entry');
      }
      throw err;
    } finally {
      setSaving(false);
    }
  }, [timesheet, fetchTimesheet]);

  const updateEntry = useCallback(async (entryId: string, updates: UpdateEntryRequest) => {
    if (!timesheet) return;
    setSaving(true);
    setError(null);
    try {
      await updateTimesheetEntry(timesheet.id, entryId, updates);
      await fetchTimesheet(); // Refresh to get updated totals
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to update entry');
      }
      throw err;
    } finally {
      setSaving(false);
    }
  }, [timesheet, fetchTimesheet]);

  const deleteEntry = useCallback(async (entryId: string) => {
    if (!timesheet) return;
    setSaving(true);
    setError(null);
    try {
      await deleteTimesheetEntry(timesheet.id, entryId);
      await fetchTimesheet(); // Refresh to get updated totals
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to delete entry');
      }
      throw err;
    } finally {
      setSaving(false);
    }
  }, [timesheet, fetchTimesheet]);

  return {
    timesheet,
    totals,
    loading,
    error,
    saving,
    addEntry,
    updateEntry,
    deleteEntry,
    refresh: fetchTimesheet,
  };
}

interface UseTimesheetsOptions {
  status?: 'open' | 'submitted' | 'approved' | 'rejected' | 'all';
  limit?: number;
  offset?: number;
}

interface UseTimesheetsResult {
  timesheets: Timesheet[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook for fetching list of timesheets
 */
export function useTimesheets(options: UseTimesheetsOptions = {}): UseTimesheetsResult {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTimesheets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: TimesheetListParams = {};
      if (options.status) params.status = options.status;
      if (options.limit !== undefined) params.limit = options.limit;
      if (options.offset !== undefined) params.offset = options.offset;

      const response = await getTimesheets(params);
      setTimesheets(response.timesheets);
      setTotal(response.total);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to load timesheets');
      }
    } finally {
      setLoading(false);
    }
  }, [options.status, options.limit, options.offset]);

  useEffect(() => {
    fetchTimesheets();
  }, [fetchTimesheets]);

  return { timesheets, total, loading, error, refetch: fetchTimesheets };
}

interface UseTimesheetByIdResult {
  timesheet: TimesheetWithEntries | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  addEntry: (entry: CreateEntryRequest) => Promise<void>;
  updateEntry: (entryId: string, updates: UpdateEntryRequest) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
  refresh: () => void;
}

/**
 * Hook for fetching a specific timesheet by ID
 */
export function useTimesheetById(id: string | undefined): UseTimesheetByIdResult {
  const [timesheet, setTimesheet] = useState<TimesheetWithEntries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchTimesheet = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await getTimesheetById(id);
      setTimesheet(result);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to load timesheet');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTimesheet();
  }, [fetchTimesheet]);

  const addEntry = useCallback(async (entry: CreateEntryRequest) => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await createTimesheetEntry(id, entry);
      await fetchTimesheet();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to add entry');
      }
      throw err;
    } finally {
      setSaving(false);
    }
  }, [id, fetchTimesheet]);

  const updateEntry = useCallback(async (entryId: string, updates: UpdateEntryRequest) => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await updateTimesheetEntry(id, entryId, updates);
      await fetchTimesheet();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to update entry');
      }
      throw err;
    } finally {
      setSaving(false);
    }
  }, [id, fetchTimesheet]);

  const deleteEntry = useCallback(async (entryId: string) => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await deleteTimesheetEntry(id, entryId);
      await fetchTimesheet();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to delete entry');
      }
      throw err;
    } finally {
      setSaving(false);
    }
  }, [id, fetchTimesheet]);

  return {
    timesheet,
    loading,
    error,
    saving,
    addEntry,
    updateEntry,
    deleteEntry,
    refresh: fetchTimesheet,
  };
}
