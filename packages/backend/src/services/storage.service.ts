import { put, del, head } from '@vercel/blob';
import { env } from '../config/env.js';

export class StorageError extends Error {
  constructor(
    message: string,
    public code: 'UPLOAD_FAILED' | 'DELETE_FAILED' | 'NOT_CONFIGURED' | 'FILE_NOT_FOUND'
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Upload a document to Vercel Blob storage.
 *
 * @param file - File buffer to upload
 * @param filename - Original filename
 * @param employeeId - Employee UUID for path organization
 * @param documentType - Type of document for path organization
 * @returns URL of the uploaded file
 */
export async function uploadDocument(
  file: Buffer,
  filename: string,
  employeeId: string,
  documentType: string
): Promise<string> {
  if (!env.BLOB_READ_WRITE_TOKEN) {
    // In development without blob token, store a placeholder path
    console.warn('BLOB_READ_WRITE_TOKEN not configured, using mock storage');
    const mockPath = `mock://documents/${employeeId}/${documentType}/${Date.now()}-${filename}`;
    return mockPath;
  }

  try {
    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255);
    const path = `documents/${employeeId}/${documentType}/${timestamp}-${safeName}`;

    const blob = await put(path, file, {
      access: 'public', // Vercel Blob v2 limitation; addRandomSuffix makes URLs non-guessable
      addRandomSuffix: true,
      token: env.BLOB_READ_WRITE_TOKEN,
    });

    return blob.url;
  } catch (error) {
    console.error('Failed to upload document:', error);
    throw new StorageError('Failed to upload document', 'UPLOAD_FAILED');
  }
}

/**
 * Delete a document from Vercel Blob storage.
 *
 * @param url - URL of the file to delete
 */
export async function deleteDocument(url: string): Promise<void> {
  if (!env.BLOB_READ_WRITE_TOKEN) {
    console.warn('BLOB_READ_WRITE_TOKEN not configured, skipping delete');
    return;
  }

  // Skip mock URLs
  if (url.startsWith('mock://')) {
    return;
  }

  try {
    await del(url, { token: env.BLOB_READ_WRITE_TOKEN });
  } catch (error) {
    console.error('Failed to delete document:', error);
    throw new StorageError('Failed to delete document', 'DELETE_FAILED');
  }
}

/**
 * Check if a document exists in storage.
 *
 * @param url - URL of the file to check
 * @returns True if the file exists
 */
export async function documentExists(url: string): Promise<boolean> {
  if (!env.BLOB_READ_WRITE_TOKEN) {
    return true; // Assume exists in dev mode
  }

  if (url.startsWith('mock://')) {
    return true;
  }

  try {
    const result = await head(url, { token: env.BLOB_READ_WRITE_TOKEN });
    return !!result;
  } catch {
    return false;
  }
}

/**
 * Get the download URL for a document.
 * For private blobs, this would generate a signed URL.
 * Since we're using public access with application-level auth,
 * we just return the URL with an expiration for consistency.
 *
 * @param url - URL of the file
 * @returns Download URL and expiration
 */
export function getDownloadUrl(url: string): { url: string; expiresAt: string } {
  // For mock URLs, return as-is
  if (url.startsWith('mock://')) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    return { url, expiresAt: expiresAt.toISOString() };
  }

  // For Vercel Blob public URLs, return directly
  // Expiration is handled at the application level (1 hour for consistency)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  return { url, expiresAt: expiresAt.toISOString() };
}

/**
 * Validate file type for document uploads.
 *
 * @param mimetype - MIME type of the file
 * @returns True if the file type is allowed
 */
export function isAllowedFileType(mimetype: string): boolean {
  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  return allowedTypes.includes(mimetype);
}

/**
 * Maximum file size in bytes (10MB).
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
