 /* components/FileUpload/FileUpload.jsx */
import { useState, useRef } from 'react';
import { uploadUserFile, deleteUserFile } from '../../api/client';
import Icon from '../Icon/Icon';
import Button from '../Button/Button';
import Spinner from '../Spinner/Spinner';

export default function FileUpload({ category, onUploadComplete }) {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

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
      const result = await uploadUserFile(formData);
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
      await deleteUserFile(fileId);
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (err) {
      setError('Failed to delete file');
    }
  };

  const getFileIcon = (mimeType) => {
    if (mimeType === 'application/pdf') return 'file-pdf';
    if (mimeType && mimeType.startsWith('image/')) return 'image';
    return 'file-lines';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
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
          style={{ display: 'none' }}
        />
        {uploading && <Spinner size="sm" />}
        {error && <span className="form-error">{error}</span>}
      </div>

      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {files.map((f) => (
            <div key={f.id} className="card" style={{ padding: 'var(--space-3) var(--space-4)', flexDirection: 'row', alignItems: 'center', gap: 'var(--space-3)' }}>
              <Icon name={getFileIcon(f.file_mime_type)} style={{ color: f.file_mime_type === 'application/pdf' ? 'var(--error)' : 'var(--primary)', fontSize: '1.25rem' }} />
              <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--text-main)' }}>{f.file_name}</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{(f.file_size / 1024).toFixed(0)} KB</span>
              <Button variant="ghost" size="sm" icon onClick={() => handleDelete(f.id)}>
                <Icon name="trash" style={{ color: 'var(--error)' }} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
