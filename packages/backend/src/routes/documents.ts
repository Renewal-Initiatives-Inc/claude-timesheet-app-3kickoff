import { Router, Request, Response } from 'express';
import multer from 'multer';
import { requireAuth, requireSupervisor } from '../middleware/auth.middleware.js';
import {
  createDocument,
  getDocumentById,
  getDocumentDownloadUrl,
  invalidateDocument,
  markSafetyTrainingComplete,
  DocumentError,
} from '../services/document.service.js';
import { EmployeeError } from '../services/employee.service.js';
import { isAllowedFileType, MAX_FILE_SIZE } from '../services/storage.service.js';
import { documentUploadSchema } from '../validation/document.schema.js';

const router: Router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    if (isAllowedFileType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, PNG, JPG'));
    }
  },
});

/**
 * POST /api/employees/:id/documents
 * Upload a document for an employee.
 */
router.post(
  '/employees/:id/documents',
  requireAuth,
  requireSupervisor,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const id = req.params['id'] as string;
      // Validate metadata
      const metadataResult = documentUploadSchema.safeParse(req.body);
      if (!metadataResult.success) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid document metadata',
          details: metadataResult.error.errors,
        });
        return;
      }

      // Check for file
      if (!req.file) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'No file uploaded',
        });
        return;
      }

      const { type, expiresAt } = metadataResult.data;
      const document = await createDocument(
        id,
        req.employee!.id,
        req.file.buffer,
        req.file.originalname,
        type,
        expiresAt
      );

      res.status(201).json({ document });
    } catch (error) {
      if (error instanceof DocumentError || error instanceof EmployeeError) {
        const statusCode =
          error.code === 'EMPLOYEE_NOT_FOUND' ? 404 :
          error.code === 'DOCUMENT_NOT_FOUND' ? 404 :
          400;
        res.status(statusCode).json({
          error: error.code,
          message: error.message,
        });
        return;
      }
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            error: 'FILE_TOO_LARGE',
            message: `File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
          });
          return;
        }
      }
      throw error;
    }
  }
);

/**
 * POST /api/employees/:id/safety-training
 * Mark safety training as complete for an employee.
 */
router.post(
  '/employees/:id/safety-training',
  requireAuth,
  requireSupervisor,
  async (req: Request, res: Response) => {
    try {
      const id = req.params['id'] as string;
      const document = await markSafetyTrainingComplete(id, req.employee!.id);

      res.status(201).json({
        message: 'Safety training marked as complete',
        document,
      });
    } catch (error) {
      if (error instanceof DocumentError || error instanceof EmployeeError) {
        const statusCode = error.code === 'EMPLOYEE_NOT_FOUND' ? 404 : 400;
        res.status(statusCode).json({
          error: error.code,
          message: error.message,
        });
        return;
      }
      throw error;
    }
  }
);

/**
 * GET /api/documents/:id
 * Get document details.
 */
router.get('/:id', requireAuth, requireSupervisor, async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const document = await getDocumentById(id);

    if (!document) {
      res.status(404).json({
        error: 'DOCUMENT_NOT_FOUND',
        message: 'Document not found',
      });
      return;
    }

    res.json({ document });
  } catch (error) {
    throw error;
  }
});

/**
 * GET /api/documents/:id/download
 * Get a signed download URL for a document.
 */
router.get(
  '/:id/download',
  requireAuth,
  requireSupervisor,
  async (req: Request, res: Response) => {
    try {
      const id = req.params['id'] as string;
      const { url, expiresAt } = await getDocumentDownloadUrl(id);

      res.json({ url, expiresAt });
    } catch (error) {
      if (error instanceof DocumentError) {
        const statusCode = error.code === 'DOCUMENT_NOT_FOUND' ? 404 : 400;
        res.status(statusCode).json({
          error: error.code,
          message: error.message,
        });
        return;
      }
      throw error;
    }
  }
);

/**
 * DELETE /api/documents/:id
 * Invalidate a document (consent revocation).
 * Sets invalidatedAt timestamp - does not delete the record.
 */
router.delete('/:id', requireAuth, requireSupervisor, async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    await invalidateDocument(id);

    res.json({ message: 'Document invalidated successfully' });
  } catch (error) {
    if (error instanceof DocumentError) {
      const statusCode =
        error.code === 'DOCUMENT_NOT_FOUND' ? 404 :
        error.code === 'ALREADY_INVALIDATED' ? 400 :
        400;
      res.status(statusCode).json({
        error: error.code,
        message: error.message,
      });
      return;
    }
    throw error;
  }
});

export default router;
