/* components/ProfilePictureUpload/ProfilePictureUpload.jsx */
import { useState, useRef } from 'react';
import Icon from '../Icon/Icon';
import { uploadProfilePicture, deleteProfilePicture } from '../../api/client';

export default function ProfilePictureUpload({ currentUrl, onUpdate, size = 80 }) {
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState(currentUrl);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  async function handleUpload(event) {
    const file = event.target.files[0];

    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Use JPEG, PNG, WebP, or GIF');
      return;
    }

    const formData = new FormData();

    formData.append('file', file);

    setUploading(true);
    setError('');

    try {
      const result = await uploadProfilePicture(formData);

      if (result.success) {
        setImageUrl(result.profile_picture_url);
        if (onUpdate) onUpdate(result.profile_picture_url);
      }
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  async function handleDelete() {
    if (!imageUrl) return;

    setUploading(true);

    try {
      await deleteProfilePicture();

      setImageUrl(null);
      if (onUpdate) onUpdate(null);
    } catch {
      setError('Failed to delete');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="profile-picture-upload">
      <div className="profile-picture-wrapper" style={{ width: size, height: size }}>
        {imageUrl ? (
          <img src={imageUrl} alt="Profile" className="profile-picture-image" />
        ) : (
          <div className="profile-picture-placeholder">
            <Icon name="user" />
          </div>
        )}

        {uploading && (
          <div className="profile-picture-overlay">
            <div className="spinner" />
          </div>
        )}
      </div>

      <div className="profile-picture-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Icon name="camera" /> Upload
        </button>

        {imageUrl && (
          <button className="btn btn-ghost btn-sm" onClick={handleDelete} disabled={uploading}>
            <Icon name="trash" /> Remove
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleUpload}
          className="profile-picture-input"
        />
      </div>

      {error && <div className="profile-picture-error">{error}</div>}
    </div>
  );
} 
