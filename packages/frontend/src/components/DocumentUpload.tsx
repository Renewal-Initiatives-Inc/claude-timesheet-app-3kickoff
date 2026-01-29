import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import type { DocumentType } from '@renewal/types';
import './DocumentUpload.css';

interface DocumentUploadProps {
  employeeId: string;
  documentType: DocumentType;
  requireExpiration?: boolean;
  onUpload: (
    employeeId: string,
    file: File,
    type: DocumentType,
    expiresAt?: string
  ) => Promise<void>;
  onSuccess?: () => void;
  disabled?: boolean;
}

/**
 * Document upload widget with drag-and-drop support
 */
export function DocumentUpload({
  employeeId,
  documentType,
  requireExpiration = false,
  onUpload,
  onSuccess,
  disabled = false,
}: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [expiresAt, setExpiresAt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  const handleFileSelect = (selectedFile: File) => {
    setError(null);

    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Invalid file type. Allowed: PDF, PNG, JPG');
      return;
    }

    if (selectedFile.size > maxSize) {
      setError('File too large. Maximum size: 10MB');
      return;
    }

    setFile(selectedFile);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    if (requireExpiration && !expiresAt) {
      setError('Expiration date is required');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      await onUpload(employeeId, file, documentType, expiresAt || undefined);
      setFile(null);
      setExpiresAt('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onSuccess?.();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Upload failed');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="doc-upload">
      <div
        className={`doc-upload-dropzone ${isDragging ? 'doc-upload-dragging' : ''} ${disabled ? 'doc-upload-disabled' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        data-testid="doc-upload-dropzone"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={handleInputChange}
          disabled={disabled}
          className="doc-upload-input"
          data-testid="doc-upload-file-input"
        />
        {file ? (
          <div className="doc-upload-selected">
            <span className="doc-upload-filename">{file.name}</span>
            <span className="doc-upload-size">({(file.size / 1024).toFixed(1)} KB)</span>
          </div>
        ) : (
          <div className="doc-upload-placeholder">
            <span className="doc-upload-icon">📄</span>
            <span>Drop file here or click to select</span>
            <span className="doc-upload-hint">PDF, PNG, or JPG up to 10MB</span>
          </div>
        )}
      </div>

      {requireExpiration && (
        <div className="doc-upload-expiration">
          <label htmlFor={`expiration-${documentType}`}>Expiration Date</label>
          <input
            id={`expiration-${documentType}`}
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            disabled={disabled}
            data-testid="field-expiresAt"
          />
        </div>
      )}

      {error && <p className="doc-upload-error">{error}</p>}

      <button
        type="button"
        onClick={handleUpload}
        disabled={!file || uploading || disabled}
        className="doc-upload-button"
        data-testid="doc-upload-submit-button"
      >
        {uploading ? 'Uploading...' : 'Upload Document'}
      </button>
    </div>
  );
}
