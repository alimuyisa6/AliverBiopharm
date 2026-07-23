import React, { useState } from 'react';
import { FaUpload, FaSpinner, FaTrash, FaFilePdf, FaFileImage } from 'react-icons/fa6';
import { uploadFile, deleteFile } from '../api/client';

export function FileUpload({ category, onUploadComplete }) {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('File must be under 10MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category || 'general');

    setUploading(true);
    setError('');

    try {
      const result = await uploadFile(formData);
      if (result.success) {
        setFiles(prev => [result.file, ...prev]);
        if (onUploadComplete) onUploadComplete(result.file);
        e.target.value = '';
      }
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId) => {
    try {
      await deleteFile(fileId);
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (err) {
      setError('Failed to delete file');
    }
  };

  const getIcon = (mimeType) => {
    if (mimeType === 'application/pdf') return <FaFilePdf className="file-icon-pdf" />;
    return <FaFileImage className="file-icon-image" />;
  };

  return (
    <div className="file-upload-container">
      <div className="file-upload-area">
        <label className="file-upload-label">
          <FaUpload className="upload-icon" />
          <span>Upload File</span>
          <input
            type="file"
            accept=".pdf,image/*"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
        {uploading && <FaSpinner className="icon-spin upload-spinner" />}
        {error && <div className="file-error">{error}</div>}
      </div>

      {files.length > 0 && (
        <div className="file-list">
          {files.map(f => (
            <div key={f.id} className="file-item">
              {getIcon(f.file_mime_type)}
              <span className="file-name">{f.file_name}</span>
              <span className="file-size">{(f.file_size / 1024).toFixed(0)} KB</span>
              <button className="file-delete-btn" onClick={() => handleDelete(f.id)}>
                <FaTrash />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
