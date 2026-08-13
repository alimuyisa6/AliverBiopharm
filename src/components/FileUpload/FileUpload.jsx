 /* components/FileUpload/FileUpload.jsx */
import { useState, useRef } from 'react';
import { uploadFile, deleteUserFile } from '../../api/client';
import Icon from '../Icon/Icon';
import Button from '../Button/Button';
import Spinner from '../Spinner/Spinner';

export default function FileUpload({ category, onUploadComplete }) {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  async function handleUpload(event) {
    const file = event.target.files[0];

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
        setFiles((prev) => [result.file, ...prev]);
        if (onUploadComplete) onUploadComplete(result.file);
        event.target.value = '';
      }
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(fileId) {
    try {
      await deleteUserFile(fileId);

      setFiles((prev) => prev.filter((file) => file.id !== fileId));
    } catch {
      setError('Failed to delete file');
    }
  }

  function getFileIcon(mimeType) {
    if (mimeType === 'application/pdf') return 'file-pdf';
    if (mimeType && mimeType.startsWith('image/')) return 'image';
    return 'file-lines';
  }

  return (
    <div className="file-upload">
      <div className="file-upload-actions">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          icon="upload"
        >
          Upload File
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/*"
          onChange={handleUpload}
          disabled={uploading}
          className="file-upload-input"
        />

        {uploading && <Spinner size="sm" />}
        {error && <span className="form-error">{error}</span>}
      </div>

      {files.length > 0 && (
        <div className="file-upload-list">
          {files.map((file) => (
            <div key={file.id} className="card file-upload-card">
              <Icon
                name={getFileIcon(file.file_mime_type)}
                className={file.file_mime_type === 'application/pdf' ? 'file-upload-icon pdf' : 'file-upload-icon'}
              />
              <span className="file-upload-name">{file.file_name}</span>
              <span className="file-upload-size">{(file.file_size / 1024).toFixed(0)} KB</span>
              <Button variant="ghost" size="sm" icon onClick={() => handleDelete(file.id)}>
                <Icon name="trash" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
