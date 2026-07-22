 import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRequireOnboarding } from '../hooks/useRequireOnboarding';
import { useLevelFilter } from '../hooks/useLevelFilter';
import { useContentAccess } from '../hooks/useContentAccess';
import { ClassroomSection as ClassroomSectionComponent } from '../components/features/classroom/ClassroomSection';
import { PendingApprovalScreen } from '../components/access/PendingApprovalScreen';
import { listClassrooms, getClassroomLevels, getClassroomTopics } from '../api/client';

export default function Classroom() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isReady } = useRequireOnboarding();
  const access = useContentAccess();
  const { level, class_name, showAll } = useLevelFilter();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isReady || !access.canAccess || access.isPending) return;
    fetchRooms();
  }, [isReady, access.canAccess, access.isPending, level, class_name]);

  const fetchRooms = async () => {
    setLoading(true);
    setError(null);
    try {
      const effectiveLevel = showAll ? null : level;
      const effectiveClass = showAll ? null : class_name;
      const data = await listClassrooms(effectiveLevel, effectiveClass, null);
      setRooms(data || []);
    } catch (err) {
      setError('Failed to load classrooms');
      console.error(err);
    }
    setLoading(false);
  };

  const statusIcons = {
    live: { icon: 'fa-circle', color: '#10b981', label: 'Live' },
    upcoming: { icon: 'fa-clock', color: '#f59e0b', label: 'Upcoming' },
    open_floor: { icon: 'fa-users', color: '#3b82f6', label: 'Open Floor' },
    ended: { icon: 'fa-circle-check', color: '#94a3b8', label: 'Ended' },
    offline: { icon: 'fa-circle', color: '#64748b', label: 'Offline' },
  };

  if (!isReady || access.isPending) {
    return <PendingApprovalScreen />;
  }

  if (!access.canAccess) {
    return <div className="classroom-access-denied">Access restricted. Please contact support.</div>;
  }

  if (loading) {
    return (
      <div className="classroom-loading">
        <span className="loading-spinner"></span>
        <p>Loading classrooms...</p>
      </div>
    );
  }

  return (
    <div className="classroom-page">
      <div className="classroom-header">
        <span className="sec-label">Live Learning</span>
        <h1 className="section-title">Classrooms</h1>
        {level && !showAll && (
          <div className="classroom-active-filters">
            <span className="filter-tag">{level}</span>
            {class_name && <span className="filter-tag">{class_name}</span>}
          </div>
        )}
        {showAll && (
          <div className="classroom-active-filters">
            <span className="filter-tag teacher-all">All Levels (Teacher Access)</span>
          </div>
        )}
      </div>

      {error && (
        <div className="classroom-error">
          <p>{error}</p>
          <button className="btn-secondary" onClick={fetchRooms}>Retry</button>
        </div>
      )}

      {!loading && !error && rooms.length === 0 && (
        <div className="classroom-empty">
          <i className="fa-solid fa-door-closed"></i>
          <h3>No Classrooms Available</h3>
          <p>No active rooms for your level. Check back later or start a discussion.</p>
          <button className="btn-primary" onClick={() => navigate('/tutor/apply')}>
            <i className="fa-solid fa-chalkboard-user"></i> Become a Tutor
          </button>
        </div>
      )}

      {!loading && !error && rooms.length > 0 && (
        <div className="classroom-grid">
          {rooms.map(room => {
            const status = statusIcons[room.status] || statusIcons.offline;
            return (
              <div key={room.id} className={`classroom-card ${room.status}`}>
                <div className="room-status-bar" style={{ backgroundColor: status.color }}>
                  <i className={`fa-solid ${status.icon}`}></i>
                  <span>{status.label}</span>
                </div>
                <div className="room-body">
                  <h3 className="room-title">{room.title}</h3>
                  <div className="room-meta">
                    <span><i className="fa-solid fa-book"></i> {room.topic_name}</span>
                    <span><i className="fa-solid fa-user-graduate"></i> {room.class_name}</span>
                  </div>
                  <div className="room-stats">
                    <span><i className="fa-solid fa-users"></i> {room.participant_count || 0} participants</span>
                    {room.room_type !== 'free' && (
                      <span className={`room-type-badge ${room.room_type}`}>
                        {room.room_type === 'hard_topic' ? 'Hard Topic' : 'Premium'}
                      </span>
                    )}
                  </div>
                  {room.tutor_name && (
                    <div className="room-tutor">
                      <i className="fa-solid fa-chalkboard-user"></i>
                      <span>{room.tutor_name}</span>
                    </div>
                  )}
                </div>
                <div className="room-footer">
                  {room.status === 'live' && (
                    <button className="btn-primary" onClick={() => navigate(`/classroom/${room.id}`)}>
                      <i className="fa-solid fa-door-open"></i> Join Now
                    </button>
                  )}
                  {room.status === 'upcoming' && room.scheduled_at && (
                    <button className="btn-secondary" disabled>
                      <i className="fa-solid fa-clock"></i> {new Date(room.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </button>
                  )}
                  {room.status === 'open_floor' && (
                    <button className="btn-primary" onClick={() => navigate(`/classroom/${room.id}`)}>
                      <i className="fa-solid fa-users"></i> Join Discussion
                    </button>
                  )}
                  {room.status === 'ended' && (
                    <button className="btn-secondary" disabled>
                      <i className="fa-solid fa-circle-check"></i> Session Ended
                    </button>
                  )}
                  {room.status === 'offline' && (
                    <button className="btn-secondary" disabled>
                      <i className="fa-solid fa-circle"></i> Offline
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
