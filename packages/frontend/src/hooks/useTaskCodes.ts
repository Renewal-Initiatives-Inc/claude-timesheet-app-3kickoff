import { useState, useEffect, useCallback } from 'react';
import type {
  TaskCodeWithCurrentRate,
  TaskCodeDetailResponse,
  TaskCodeListParams,
  CreateTaskCodeRequest,
  UpdateTaskCodeRequest,
  AddRateRequest,
  TaskCodeRate,
} from '@renewal/types';
import {
  getTaskCodes,
  getTaskCode,
  createTaskCode as createTaskCodeApi,
  updateTaskCode as updateTaskCodeApi,
  addTaskCodeRate,
  getTaskCodesForEmployee,
  ApiRequestError,
} from '../api/client.js';

interface UseTaskCodesOptions {
  isAgricultural?: 'true' | 'false';
  isHazardous?: 'true' | 'false';
  forAge?: number;
  includeInactive?: 'true' | 'false';
  search?: string;
}

interface UseTaskCodesResult {
  taskCodes: TaskCodeWithCurrentRate[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook for fetching task code list
 */
export function useTaskCodes(options: UseTaskCodesOptions = {}): UseTaskCodesResult {
  const [taskCodes, setTaskCodes] = useState<TaskCodeWithCurrentRate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTaskCodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: TaskCodeListParams = {};
      if (options.isAgricultural) params.isAgricultural = options.isAgricultural;
      if (options.isHazardous) params.isHazardous = options.isHazardous;
      if (options.forAge !== undefined) params.forAge = options.forAge;
      if (options.includeInactive) params.includeInactive = options.includeInactive;
      if (options.search) params.search = options.search;

      const response = await getTaskCodes(params);
      setTaskCodes(response.taskCodes);
      setTotal(response.total);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to load task codes');
      }
    } finally {
      setLoading(false);
    }
  }, [
    options.isAgricultural,
    options.isHazardous,
    options.forAge,
    options.includeInactive,
    options.search,
  ]);

  useEffect(() => {
    fetchTaskCodes();
  }, [fetchTaskCodes]);

  return { taskCodes, total, loading, error, refetch: fetchTaskCodes };
}

interface UseTaskCodeResult {
  taskCode: TaskCodeDetailResponse['taskCode'] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook for fetching a single task code with rate history
 */
export function useTaskCode(id: string | undefined): UseTaskCodeResult {
  const [taskCode, setTaskCode] = useState<TaskCodeDetailResponse['taskCode'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTaskCode = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await getTaskCode(id);
      setTaskCode(response.taskCode);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to load task code');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTaskCode();
  }, [fetchTaskCode]);

  return { taskCode, loading, error, refetch: fetchTaskCode };
}

interface UseTaskCodesForEmployeeResult {
  taskCodes: TaskCodeWithCurrentRate[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook for fetching age-filtered task codes for an employee
 * @param employeeId - The employee's ID
 * @param workDate - Optional date to calculate age as of (YYYY-MM-DD format). Defaults to today.
 */
export function useTaskCodesForEmployee(
  employeeId: string | undefined,
  workDate?: string
): UseTaskCodesForEmployeeResult {
  const [taskCodes, setTaskCodes] = useState<TaskCodeWithCurrentRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTaskCodes = useCallback(async () => {
    if (!employeeId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await getTaskCodesForEmployee(employeeId, workDate);
      setTaskCodes(response.taskCodes);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to load task codes for employee');
      }
    } finally {
      setLoading(false);
    }
  }, [employeeId, workDate]);

  useEffect(() => {
    fetchTaskCodes();
  }, [fetchTaskCodes]);

  return { taskCodes, loading, error, refetch: fetchTaskCodes };
}

interface UseTaskCodeActionsResult {
  createTaskCode: (data: CreateTaskCodeRequest) => Promise<TaskCodeWithCurrentRate>;
  updateTaskCode: (id: string, data: UpdateTaskCodeRequest) => Promise<TaskCodeWithCurrentRate>;
  addRate: (id: string, data: AddRateRequest) => Promise<TaskCodeRate>;
  archiveTaskCode: (id: string) => Promise<TaskCodeWithCurrentRate>;
  loading: boolean;
  error: string | null;
}

/**
 * Hook for task code actions (create, update, add rate, archive)
 */
export function useTaskCodeActions(): UseTaskCodeActionsResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTaskCode = useCallback(async (data: CreateTaskCodeRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await createTaskCodeApi(data);
      return response.taskCode;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to create task code');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTaskCode = useCallback(async (id: string, data: UpdateTaskCodeRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await updateTaskCodeApi(id, data);
      return response.taskCode;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to update task code');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addRate = useCallback(async (id: string, data: AddRateRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await addTaskCodeRate(id, data);
      return response.rate;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to add rate');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const archiveTaskCode = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await updateTaskCodeApi(id, { isActive: false });
      return response.taskCode;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to archive task code');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createTaskCode, updateTaskCode, addRate, archiveTaskCode, loading, error };
}
