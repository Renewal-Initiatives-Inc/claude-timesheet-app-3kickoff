import { eq, and } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { uploadDocument, getDownloadUrl } from './storage.service.js';
import type { DocumentType, EmployeeDocument } from '@renewal/types';

const { employees, employeeDocuments } = schema;

export class DocumentError extends Error {
  constructor(
    message: string,
    public code:
      | 'EMPLOYEE_NOT_FOUND'
      | 'DOCUMENT_NOT_FOUND'
      | 'INVALID_DOCUMENT_TYPE'
      | 'UPLOAD_FAILED'
      | 'EXPIRATION_REQUIRED'
      | 'ALREADY_INVALIDATED'
  ) {
    super(message);
    this.name = 'DocumentError';
  }
}

/**
 * Upload a document for an employee.
 *
 * @param employeeId - Employee UUID
 * @param uploaderId - Uploader's employee UUID
 * @param file - File buffer
 * @param filename - Original filename
 * @param type - Document type
 * @param expiresAt - Expiration date (required for work permits)
 * @returns Created document record
 */
export async function createDocument(
  employeeId: string,
  uploaderId: string,
  file: Buffer,
  filename: string,
  type: DocumentType,
  expiresAt?: string
): Promise<EmployeeDocument> {
  // Verify employee exists
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
  });

  if (!employee) {
    throw new DocumentError('Employee not found', 'EMPLOYEE_NOT_FOUND');
  }

  // Work permits require expiration date
  if (type === 'work_permit' && !expiresAt) {
    throw new DocumentError('Work permits require an expiration date', 'EXPIRATION_REQUIRED');
  }

  // Upload to storage
  const filePath = await uploadDocument(file, filename, employeeId, type);

  // Create database record
  const [document] = await db
    .insert(employeeDocuments)
    .values({
      employeeId,
      type,
      filePath,
      uploadedBy: uploaderId,
      expiresAt: expiresAt ?? null,
    })
    .returning();

  return {
    id: document!.id,
    employeeId: document!.employeeId,
    type: document!.type as DocumentType,
    filePath: document!.filePath,
    uploadedAt: document!.uploadedAt.toISOString(),
    uploadedBy: document!.uploadedBy,
    expiresAt: document!.expiresAt,
    invalidatedAt: document!.invalidatedAt?.toISOString() ?? null,
  };
}

/**
 * Get a document by ID.
 *
 * @param documentId - Document UUID
 * @returns Document record or null if not found
 */
export async function getDocumentById(documentId: string): Promise<EmployeeDocument | null> {
  const document = await db.query.employeeDocuments.findFirst({
    where: eq(employeeDocuments.id, documentId),
  });

  if (!document) {
    return null;
  }

  return {
    id: document.id,
    employeeId: document.employeeId,
    type: document.type as DocumentType,
    filePath: document.filePath,
    uploadedAt: document.uploadedAt.toISOString(),
    uploadedBy: document.uploadedBy,
    expiresAt: document.expiresAt,
    invalidatedAt: document.invalidatedAt?.toISOString() ?? null,
  };
}

/**
 * Get download URL for a document.
 *
 * @param documentId - Document UUID
 * @returns Download URL and expiration
 */
export async function getDocumentDownloadUrl(
  documentId: string
): Promise<{ url: string; expiresAt: string }> {
  const document = await db.query.employeeDocuments.findFirst({
    where: eq(employeeDocuments.id, documentId),
  });

  if (!document) {
    throw new DocumentError('Document not found', 'DOCUMENT_NOT_FOUND');
  }

  return getDownloadUrl(document.filePath);
}

/**
 * Invalidate a document.
 * This is used for consent revocation - sets invalidatedAt timestamp.
 * The document record is preserved for audit purposes.
 *
 * @param documentId - Document UUID
 */
export async function invalidateDocument(documentId: string): Promise<void> {
  const document = await db.query.employeeDocuments.findFirst({
    where: eq(employeeDocuments.id, documentId),
  });

  if (!document) {
    throw new DocumentError('Document not found', 'DOCUMENT_NOT_FOUND');
  }

  if (document.invalidatedAt) {
    throw new DocumentError('Document is already invalidated', 'ALREADY_INVALIDATED');
  }

  await db
    .update(employeeDocuments)
    .set({
      invalidatedAt: new Date(),
    })
    .where(eq(employeeDocuments.id, documentId));
}

/**
 * Get all documents for an employee by type.
 *
 * @param employeeId - Employee UUID
 * @param type - Document type to filter by
 * @returns List of documents of that type
 */
export async function getDocumentsByType(
  employeeId: string,
  type: DocumentType
): Promise<EmployeeDocument[]> {
  const docs = await db.query.employeeDocuments.findMany({
    where: and(eq(employeeDocuments.employeeId, employeeId), eq(employeeDocuments.type, type)),
    orderBy: (docs, { desc }) => [desc(docs.uploadedAt)],
  });

  return docs.map((d) => ({
    id: d.id,
    employeeId: d.employeeId,
    type: d.type as DocumentType,
    filePath: d.filePath,
    uploadedAt: d.uploadedAt.toISOString(),
    uploadedBy: d.uploadedBy,
    expiresAt: d.expiresAt,
    invalidatedAt: d.invalidatedAt?.toISOString() ?? null,
  }));
}

/**
 * Mark safety training as complete for an employee.
 * Creates a safety_training document record (no file upload needed).
 *
 * @param employeeId - Employee UUID
 * @param supervisorId - Supervisor marking the training complete
 * @returns Created document record
 */
export async function markSafetyTrainingComplete(
  employeeId: string,
  supervisorId: string
): Promise<EmployeeDocument> {
  // Verify employee exists
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
  });

  if (!employee) {
    throw new DocumentError('Employee not found', 'EMPLOYEE_NOT_FOUND');
  }

  // Create a safety training record (filePath is a placeholder)
  const [document] = await db
    .insert(employeeDocuments)
    .values({
      employeeId,
      type: 'safety_training',
      filePath: 'internal://safety-training-verified',
      uploadedBy: supervisorId,
      expiresAt: null,
    })
    .returning();

  return {
    id: document!.id,
    employeeId: document!.employeeId,
    type: document!.type as DocumentType,
    filePath: document!.filePath,
    uploadedAt: document!.uploadedAt.toISOString(),
    uploadedBy: document!.uploadedBy,
    expiresAt: document!.expiresAt,
    invalidatedAt: document!.invalidatedAt?.toISOString() ?? null,
  };
}
