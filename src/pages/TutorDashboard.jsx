 import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getClassroomLevels, getClassroomTopics } from '../api/client';

export default function TutorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tutorStatus, setTutorStatus] = useState(null);
  const [levels, setLevels] = useState([]);
  const [activeRooms, setActiveRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [roomsError, setRoomsError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    level: '',
    class_name: '',
    topic_id: '',
    topic_name: '',
    room_type: 'free',
    scheduled_at: '',
  });
  const [topics, setTopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createSuccess, setCreateSuccess] = useState(null);

  useEffect(() => {
    if (!user) {
      setError('You must be logged in to access the tutor dashboard.');
      setLoading(false);
      return;
    }
    fetchDashboard();
  }, [user]);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    setStatusError(null);

    try {
      const statusRes = await fetch('/api/server?module=classroom&path=tutor_status', {
        credentials: 'include',
      });

      if (!statusRes.ok) {
        const errData = await statusRes.json().catch(() => ({}));
        if (statusRes.status === 401) {
          setStatusError('Your session has expired. Please log in again.');
        } else if (statusRes.status === 403) {
          setStatusError('Access denied. Please log in again.');
        } else if (statusRes.status === 404) {
          setStatusError('Tutor service not available. Please try again later.');
        } else {
          setStatusError(errData.error || `Server error (${statusRes.status}). Please try again.`);
        }
        setLoading(false);
        return;
      }

      const statusData = await statusRes.json();
      setTutorStatus(statusData?.application || null);

      try {
        const levelsData = await getClassroomLevels();
        setLevels(levelsData || []);
      } catch {
        setLevels([]);
      }

      if (statusData?.application?.status === 'approved') {
        fetchActiveRooms();
      }
    } catch (err) {
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        setError('Network error. Please check your internet connection and try again.');
      } else {
        setError('Failed to load dashboard. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveRooms = async () => {
    setRoomsError(null);
    try {
      const res = await fetch('/api/server?module=classroom&path=tutor_rooms', {
        credentials: 'include',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setRoomsError(errData.error || 'Failed to load your rooms.');
        return;
      }

      const data = await res.json();
      setActiveRooms(data?.rooms || data || []);
    } catch {
      setRoomsError('Network error while loading rooms.');
    }
  };

  const fetchTopics = async (level, className) => {
    setLoadingTopics(true);
    try {
      const data = await getClassroomTopics(level, className);
      setTopics(data || []);
    } catch {
      setTopics([]);
    } finally {
      setLoadingTopics(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!form.title || !form.level || !form.class_name || !form.topic_id || !form.topic_name) {
      setCreateError('Please fill all required fields.');
      return;
    }
    if ((form.room_type === 'hard_topic' || form.room_type === 'premium') && !form.scheduled_at) {
      setCreateError('Scheduled date and time is required for this room type.');
      return;
    }
    setSubmitting(true);
    setCreateError(null);
    setCreateSuccess(null);
    try {
      const res = await fetch(`/api/server?module=classroom&path=create`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          setCreateError(data.error || 'You are not authorized to create rooms.');
        } else if (res.status === 401) {
          setCreateError('Your session has expired. Please log in again.');
        } else {
          setCreateError(data.error || 'Failed to create room.');
        }
        return;
      }

      setCreateSuccess('Classroom created successfully!');
      setShowCreateForm(false);
      setForm({
        title: '',
        level: '',
        class_name: '',
        topic_id: '',
        topic_name: '',
        room_type: 'free',
        scheduled_at: '',
      });
      setTopics([]);
      fetchActiveRooms();
      setTimeout(() => setCreateSuccess(null), 5000);
    } catch {
      setCreateError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndRoom = async (roomId) => {
    try {
      const res = await fetch(`/api/server?module=classroom&path=end_room`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setRoomsError(errData.error || 'Failed to end room.');
        return;
      }

      fetchActiveRooms();
    } catch {
      setRoomsError('Network error while ending room.');
    }
  };

  const statusLabels = {
    pending: { label: 'Pending Review', className: 'status-pending', icon: 'fa-clock' },
    scheduled: { label: 'Interview Scheduled', className: 'status-scheduled', icon: 'fa-calendar-check' },
    interviewed: { label: 'Interview Completed', className: 'status-interviewed', icon: 'fa-check-double' },
    approved: { label: 'Approved Tutor', className: 'status-approved', icon: 'fa-circle-check' },
    rejected: { label: 'Application Rejected', className: 'status-rejected', icon: 'fa-circle-xmark' },
  };

  const roomStatusIcons = {
    live: { icon: 'fa-tower-broadcast', className: 'status-live-bar', label: 'Live' },
    open_floor: { icon: 'fa-users', className: 'status-open-floor-bar', label: 'Open Floor' },
    upcoming: { icon: 'fa-clock', className: 'status-upcoming-bar', label: 'Upcoming' },
  };

  if (loading) {
    return (
      <div className="tutor-dashboard-page">
        <div className="tutor-dashboard-loading">
          <div className="tutor-loading-spinner">
            <i className="fa-solid fa-spinner fa-spin"></i>
          </div>
          <p className="tutor-loading-text">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tutor-dashboard-page">
        <div className="tutor-dashboard-error">
          <div className="tutor-error-icon">
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h2>Something went wrong</h2>
          <p className="tutor-error-text">{error}</p>
          <div className="tutor-error-actions">
            <button className="tutor-btn tutor-btn-primary" onClick={fetchDashboard}>
              <i className="fa-solid fa-rotate"></i> Try Again
            </button>
            <button className="tutor-btn tutor-btn-secondary" onClick={() => navigate('/classroom')}>
              <i className="fa-solid fa-users"></i> Back to Classrooms
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (statusError) {
    return (
      <div className="tutor-dashboard-page">
        <div className="tutor-dashboard-error">
          <div className="tutor-error-icon">
            <i className="fa-solid fa-lock"></i>
          </div>
          <h2>Unable to Load Tutor Status</h2>
          <p className="tutor-error-text">{statusError}</p>
          <div className="tutor-error-actions">
            <button className="tutor-btn tutor-btn-primary" onClick={() => navigate('/login')}>
              <i className="fa-solid fa-right-to-bracket"></i> Log In
            </button>
            <button className="tutor-btn tutor-btn-secondary" onClick={fetchDashboard}>
              <i className="fa-solid fa-rotate"></i> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const application = tutorStatus;
  const isApproved = application?.status === 'approved';
  const status = application ? statusLabels[application.status] : null;

  return (
    <div className="tutor-dashboard-page">
      <div className="tutor-dashboard-container">
        <div className="tutor-dashboard-hero">
          <div className="tutor-hero-content">
            <span className="tutor-hero-label">Teaching Portal</span>
            <h1 className="tutor-hero-title">Tutor Dashboard</h1>
            <p className="tutor-hero-subtitle">
              Manage your classrooms, track sessions, and engage with students.
            </p>
          </div>
          <div className="tutor-hero-icon">
            <i className="fa-solid fa-chalkboard-user"></i>
          </div>
        </div>

        {!application && (
          <div className="tutor-empty-state">
            <div className="tutor-empty-icon">
              <i className="fa-solid fa-graduation-cap"></i>
            </div>
            <h2 className="tutor-empty-title">No Application Found</h2>
            <p className="tutor-empty-text">
              You haven't applied to become a tutor yet. Apply now to start leading classroom discussions and make an impact.
            </p>
            <div className="tutor-empty-actions">
              <button className="tutor-btn tutor-btn-primary" onClick={() => navigate('/tutor/apply')}>
                <i className="fa-solid fa-paper-plane"></i> Start Application
              </button>
            </div>
          </div>
        )}

        {application && !isApproved && status && (
          <div className="tutor-application-card">
            <div className={`tutor-app-status tutor-app-status--${application.status}`}>
              <div className={`tutor-app-status-icon ${status.className}`}>
                <i className={`fa-solid ${status.icon}`}></i>
              </div>
              <div className="tutor-app-status-info">
                <span className={`tutor-app-status-label ${status.className}`}>{status.label}</span>
                <span className="tutor-app-status-date">
                  Applied {new Date(application.created_at).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </span>
              </div>
            </div>

            <div className="tutor-app-details">
              <div className="tutor-app-detail">
                <i className="fa-solid fa-layer-group tutor-detail-icon-muted"></i>
                <div>
                  <span className="tutor-detail-label">Level</span>
                  <span className="tutor-detail-value">{application.level}</span>
                </div>
              </div>
              <div className="tutor-app-detail">
                <i className="fa-solid fa-users tutor-detail-icon-muted"></i>
                <div>
                  <span className="tutor-detail-label">Class</span>
                  <span className="tutor-detail-value">{application.class_name}</span>
                </div>
              </div>
              <div className="tutor-app-detail">
                <i className="fa-solid fa-book-open tutor-detail-icon-muted"></i>
                <div>
                  <span className="tutor-detail-label">Subjects</span>
                  <span className="tutor-detail-value">
                    {(application.subjects || []).join(', ')}
                  </span>
                </div>
              </div>
            </div>

            {application.status === 'scheduled' && application.interview_scheduled_at && (
              <div className="tutor-interview-card">
                <i className={`fa-solid fa-calendar-check ${status.className}`}></i>
                <div>
                  <span className="tutor-interview-label">Interview Scheduled</span>
                  <span className="tutor-interview-date">
                    {new Date(application.interview_scheduled_at).toLocaleString('en-US', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            )}

            {application.status === 'rejected' && application.rejection_reason && (
              <div className="tutor-rejection-card">
                <div className="tutor-rejection-header">
                  <i className={`fa-solid fa-circle-info ${status.className}`}></i>
                  <span>Reason for Rejection</span>
                </div>
                <p className="tutor-rejection-text">{application.rejection_reason}</p>
              </div>
            )}
          </div>
        )}

        {isApproved && (
          <div className="tutor-approved-panel">
            <div className="tutor-approved-banner">
              <div className="tutor-approved-badge">
                <i className="fa-solid fa-circle-check status-approved"></i>
                <span>Approved Tutor</span>
              </div>
              <div className="tutor-approved-info">
                <span className="tutor-approved-name">{application.display_name || 'Tutor'}</span>
                <span className="tutor-approved-meta">
                  {application.level} · {application.class_name}
                </span>
              </div>
              <div className="tutor-approved-subjects">
                {(application.subjects || []).map(subject => (
                  <span key={subject} className="tutor-subject-tag">{subject}</span>
                ))}
              </div>
            </div>

            <div className="tutor-dashboard-actions">
              <button
                className={`tutor-btn ${showCreateForm ? 'tutor-btn-outline' : 'tutor-btn-primary'}`}
                onClick={() => {
                  setShowCreateForm(!showCreateForm);
                  setCreateError(null);
                  setCreateSuccess(null);
                }}
              >
                <i className={`fa-solid ${showCreateForm ? 'fa-xmark' : 'fa-plus-circle'}`}></i>
                {showCreateForm ? 'Cancel' : 'Create Classroom'}
              </button>
              <button className="tutor-btn tutor-btn-ghost" onClick={fetchActiveRooms}>
                <i className="fa-solid fa-arrows-rotate"></i> Refresh
              </button>
            </div>

            {createSuccess && (
              <div className="tutor-alert tutor-alert--success">
                <i className="fa-solid fa-circle-check"></i>
                <span>{createSuccess}</span>
              </div>
            )}

            {showCreateForm && (
              <div className="tutor-create-form">
                <h3 className="tutor-form-title">
                  <i className="fa-solid fa-plus-circle"></i> New Classroom
                </h3>
                <p className="tutor-form-subtitle">
                  Fill in the details below to create a new classroom session.
                </p>

                <div className="tutor-form-group">
                  <label className="tutor-form-label">
                    Room Title <span className="tutor-required">*</span>
                  </label>
                  <input
                    type="text"
                    className="tutor-form-input"
                    placeholder="e.g., Introduction to Cell Biology"
                    value={form.title}
                    onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                    maxLength={200}
                  />
                </div>

                <div className="tutor-form-row">
                  <div className="tutor-form-group">
                    <label className="tutor-form-label">
                      Level <span className="tutor-required">*</span>
                    </label>
                    <select
                      className="tutor-form-select"
                      value={form.level}
                      onChange={e => {
                        setForm(prev => ({ ...prev, level: e.target.value, class_name: '', topic_id: '', topic_name: '' }));
                        setTopics([]);
                      }}
                    >
                      <option value="">Choose level...</option>
                      {levels.map(lvl => (
                        <option key={lvl.key} value={lvl.key}>{lvl.key}</option>
                      ))}
                    </select>
                  </div>

                  <div className="tutor-form-group">
                    <label className="tutor-form-label">
                      Class <span className="tutor-required">*</span>
                    </label>
                    <select
                      className="tutor-form-select"
                      value={form.class_name}
                      onChange={e => {
                        const cls = e.target.value;
                        setForm(prev => ({ ...prev, class_name: cls, topic_id: '', topic_name: '' }));
                        if (form.level && cls) fetchTopics(form.level, cls);
                      }}
                      disabled={!form.level}
                    >
                      <option value="">Choose class...</option>
                      {(levels.find(l => l.key === form.level)?.classes || []).map(cls => {
                        const val = typeof cls === 'string' ? cls : cls.id;
                        const label = typeof cls === 'string' ? cls : cls.name;
                        return <option key={val} value={val}>{label}</option>;
                      })}
                    </select>
                  </div>
                </div>

                <div className="tutor-form-group">
                  <label className="tutor-form-label">
                    Topic <span className="tutor-required">*</span>
                  </label>
                  <select
                    className="tutor-form-select"
                    value={form.topic_id}
                    onChange={e => {
                      const selected = topics.find(t => t.id === e.target.value);
                      setForm(prev => ({
                        ...prev,
                        topic_id: e.target.value,
                        topic_name: selected?.topic_name || '',
                      }));
                    }}
                    disabled={!form.class_name || loadingTopics}
                  >
                    <option value="">
                      {loadingTopics ? 'Loading topics...' : 'Choose topic...'}
                    </option>
                    {topics.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.topic_name}{t.is_hard_topic ? ' (Hard Topic)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="tutor-form-row">
                  <div className="tutor-form-group">
                    <label className="tutor-form-label">
                      Room Type <span className="tutor-required">*</span>
                    </label>
                    <select
                      className="tutor-form-select"
                      value={form.room_type}
                      onChange={e => setForm(prev => ({ ...prev, room_type: e.target.value }))}
                    >
                      <option value="free">Free Discussion (Open Floor)</option>
                      <option value="hard_topic">Hard Topic (Scheduled)</option>
                      <option value="premium">Premium (Scheduled)</option>
                    </select>
                  </div>

                  {(form.room_type === 'hard_topic' || form.room_type === 'premium') && (
                    <div className="tutor-form-group">
                      <label className="tutor-form-label">
                        Schedule <span className="tutor-required">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        className="tutor-form-input"
                        value={form.scheduled_at}
                        onChange={e => setForm(prev => ({ ...prev, scheduled_at: e.target.value }))}
                      />
                    </div>
                  )}
                </div>

                {createError && (
                  <div className="tutor-alert tutor-alert--error">
                    <i className="fa-solid fa-circle-exclamation"></i>
                    <span>{createError}</span>
                  </div>
                )}

                <button
                  className="tutor-btn tutor-btn-primary tutor-btn-full"
                  onClick={handleCreateRoom}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i> Creating Classroom...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-plus-circle"></i> Create Classroom
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="tutor-rooms-section">
              <div className="tutor-rooms-header">
                <h3 className="tutor-rooms-title">
                  <i className="fa-solid fa-broadcast-tower tutor-rooms-title-icon"></i>
                  Your Active Classrooms
                  {activeRooms.length > 0 && (
                    <span className="tutor-rooms-count">{activeRooms.length}</span>
                  )}
                </h3>
              </div>

              {roomsError && (
                <div className="tutor-alert tutor-alert--error">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <span>{roomsError}</span>
                  <button className="tutor-btn tutor-btn-sm tutor-btn-secondary" onClick={fetchActiveRooms}>
                    Retry
                  </button>
                </div>
              )}

              {!roomsError && activeRooms.length === 0 && (
                <div className="tutor-rooms-empty">
                  <div className="tutor-rooms-empty-icon">
                    <i className="fa-solid fa-door-closed"></i>
                  </div>
                  <h4 className="tutor-rooms-empty-title">No Active Classrooms</h4>
                  <p className="tutor-rooms-empty-text">
                    You haven't created any classrooms yet. Click "Create Classroom" to get started.
                  </p>
                </div>
              )}

              {!roomsError && activeRooms.length > 0 && (
                <div className="tutor-rooms-grid">
                  {activeRooms.map(room => {
                    const roomStatus = roomStatusIcons[room.status] || roomStatusIcons.upcoming;
                    return (
                      <div key={room.id} className={`tutor-room-card tutor-room-card--${room.status}`}>
                        <div className="tutor-room-card-header">
                          <div className={`tutor-room-status tutor-room-status--${room.status} ${roomStatus.className}`}>
                            <i className={`fa-solid ${roomStatus.icon}`}></i>
                            <span>{roomStatus.label}</span>
                          </div>
                          <span className="tutor-room-participants">
                            <i className="fa-solid fa-user"></i> {room.participant_count || 0}
                          </span>
                        </div>

                        <div className="tutor-room-card-body">
                          <h4 className="tutor-room-title">{room.title}</h4>
                          <div className="tutor-room-meta">
                            <span>
                              <i className="fa-solid fa-book tutor-room-meta-icon"></i> {room.topic_name}
                            </span>
                            <span>
                              <i className="fa-solid fa-user-graduate tutor-room-meta-icon"></i> {room.class_name}
                            </span>
                          </div>
                          {room.scheduled_at && (
                            <div className="tutor-room-schedule">
                              <i className="fa-solid fa-calendar tutor-room-schedule-icon"></i>
                              <span>
                                {new Date(room.scheduled_at).toLocaleString('en-US', {
                                  weekday: 'short', month: 'short', day: 'numeric',
                                  hour: '2-digit', minute: '2-digit',
                                })}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="tutor-room-card-footer">
                          <button
                            className="tutor-btn tutor-btn-primary tutor-btn-sm"
                            onClick={() => navigate(`/classroom/${room.id}`)}
                          >
                            <i className="fa-solid fa-door-open"></i> Enter Room
                          </button>
                          <button
                            className="tutor-btn tutor-btn-danger tutor-btn-sm"
                            onClick={() => handleEndRoom(room.id)}
                          >
                            <i className="fa-solid fa-stop-circle"></i> End
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
