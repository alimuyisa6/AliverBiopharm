 import React, { useState, useRef } from 'react';
import { FaCamera, FaSpinner, FaTrash, FaUser } from 'react-icons/fa6';
import { uploadProfilePicture, deleteProfilePicture } from '../api/client';

export function ProfilePictureUpload({ currentUrl, onUpdate, size = 120 }) {
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState(currentUrl);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
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
      e.target.value = '';
    }
  };

  const handleDelete = async () => {
    if (!imageUrl) return;
    setUploading(true);

    try {
      await deleteProfilePicture();
      setImageUrl(null);
      if (onUpdate) onUpdate(null);
    } catch (err) {
      setError('Failed to delete profile picture');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="profile-picture-container">
      <div 
        className="profile-picture-wrapper"
        style={{ width: size, height: size }}
      >
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt="Profile" 
            className="profile-picture-image"
          />
        ) : (
          <div className="profile-picture-placeholder">
            <FaUser className="profile-picture-icon" />
          </div>
        )}
        
        {uploading && (
          <div className="profile-picture-overlay">
            <FaSpinner className="icon-spin" />
          </div>
        )}
      </div>

      <div className="profile-picture-actions">
        <button 
          className="profile-picture-btn upload"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <FaCamera />
          Upload
        </button>
        {imageUrl && (
          <button 
            className="profile-picture-btn delete"
            onClick={handleDelete}
            disabled={uploading}
          >
            <FaTrash />
            Remove
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleUpload}
          style={{ display: 'none' }}
        />
      </div>

      {error && <div className="profile-picture-error">{error}</div>}
    </div>
  );
}
