import { useState, useCallback } from 'react';
import type { EmployeeDocument, DocumentType } from '@renewal/types';
import {
  uploadDocument as uploadDocumentApi,
  markSafetyTrainingComplete as markSafetyTrainingApi,
  invalidateDocument as invalidateDocumentApi,
  getDocumentDownloadUrl,
  ApiRequestError,
} from '../api/client.js';

interface UseDocumentActionsResult {
  uploadDocument: (
    employeeId: string,
    file: File,
    type: DocumentType,
    expiresAt?: string
  ) => Promise<EmployeeDocument>;
  markSafetyTrainingComplete: (employeeId: string) => Promise<EmployeeDocument>;
  invalidateDocument: (documentId: string) => Promise<void>;
  downloadDocument: (documentId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Hook for document actions (upload, invalidate, download)
 */
export function useDocumentActions(): UseDocumentActionsResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const uploadDocument = useCallback(
    async (
      employeeId: string,
      file: File,
      type: DocumentType,
      expiresAt?: string
    ): Promise<EmployeeDocument> => {
      setLoading(true);
      setError(null);
      try {
        const response = await uploadDocumentApi(employeeId, file, type, expiresAt);
        return response.document;
      } catch (err) {
        if (err instanceof ApiRequestError) {
          setError(err.message);
        } else {
          setError('Failed to upload document');
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const markSafetyTrainingComplete = useCallback(
    async (employeeId: string): Promise<EmployeeDocument> => {
      setLoading(true);
      setError(null);
      try {
        const response = await markSafetyTrainingApi(employeeId);
        return response.document;
      } catch (err) {
        if (err instanceof ApiRequestError) {
          setError(err.message);
        } else {
          setError('Failed to mark safety training complete');
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const invalidateDocument = useCallback(async (documentId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await invalidateDocumentApi(documentId);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to invalidate document');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const downloadDocument = useCallback(async (documentId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { url } = await getDocumentDownloadUrl(documentId);
      // Open the download URL in a new tab
      window.open(url, '_blank');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to get download URL');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    uploadDocument,
    markSafetyTrainingComplete,
    invalidateDocument,
    downloadDocument,
    loading,
    error,
    clearError,
  };
}
