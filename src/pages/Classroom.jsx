 import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRequireOnboarding } from '../hooks/useRequireOnboarding';
import { useLevelFilter } from '../hooks/useLevelFilter';
import { useContentAccess } from '../hooks/useContentAccess';
import { useLayout } from '../contexts/LayoutContext';
import { PendingApprovalScreen } from '../components/access/PendingApprovalScreen';
import { listClassrooms, getUnits } from '../api/client';

const STATUS_CLASSES = {
  live: 'room-status-live',
  upcoming: 'room-status-upcoming',
  open_floor: 'room-status-open',
  ended: 'room-status-ended',
  offline: 'room-status-offline',
};

export default function Classroom() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isReady } = useRequireOnboarding();
  const access = useContentAccess();
  const { level, class_name, showAll } = useLevelFilter();
  const { groups } = useLayout();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeUnitId, setActiveUnitId] = useState(null);

  // Determine the active unit id from the user's active group, or fallback to the first group's first unit
  useEffect(() => {
    if (!groups || !Array.isArray(groups) || groups.length === 0) return;
    const groupId = user?.profile?.active_group_id || groups[0]?.id;
    if (!groupId) return;
    getUnits({ group_id: groupId }).then(units => {
      if (units && units.length > 0) {
        setActiveUnitId(units[0].id);
      }
    }).catch(() => {});
  }, [groups, user]);

  useEffect(() => {
    if (!isReady || !access.canAccess || access.isPending || !activeUnitId) return;
    fetchRooms();
  }, [isReady, access.canAccess, access.isPending, activeUnitId]);

  const fetchRooms = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use unit_id for classroom listing (new endpoint)
      const data = await listClassrooms(activeUnitId, null);
      setRooms(data || []);
    } catch (err) {
      setError('Failed to load classrooms');
      console.error(err);
    }
    setLoading(false);
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
        <i className="fa-solid fa-spinner fa-spin"></i>
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
            const statusClass = STATUS_CLASSES[room.status] || 'room-status-offline';
            const isPremium = room.room_type === 'premium';
            const isHard = room.room_type === 'hard_topic';
            return (
              <div key={room.id} className={`classroom-card ${room.status}`}>
                <div className="classroom-card-media">
                  {room.cover_image_url ? (
                    <img src={room.cover_image_url} alt={room.title} loading="lazy" />
                  ) : (
                    <div className="card-media-fallback">
                      <i className="fa-solid fa-chalkboard-user"></i>
                    </div>
                  )}
                  {isHard && (
                    <span className="card-media-ribbon ribbon-hard">
                      <i className="fa-solid fa-triangle-exclamation"></i> Hard Topic
                    </span>
                  )}
                  {isPremium && !isHard && (
                    <span className="card-media-ribbon ribbon-premium">
                      <i className="fa-solid fa-crown"></i> Premium
                    </span>
                  )}
                </div>
                <div className={`room-status-bar ${statusClass}`}>
                  <i className={`fa-solid ${STATUS_META_ICONS[room.status] || 'fa-circle'}`}></i>
                  <span>{STATUS_META_LABELS[room.status] || 'Offline'}</span>
                </div>
                <div className="room-body">
                  <h3 className="room-title">{room.title}</h3>
                  <div className="room-meta">
                    <span>
                      <i className="fa-solid fa-book room-meta-icon-cyan"></i>
                      {room.topic_name}
                    </span>
                    <span>
                      <i className="fa-solid fa-user-graduate room-meta-icon-blue"></i>
                      {room.class_name}
                    </span>
                  </div>
                  <div className="room-stats">
                    <span>
                      <i className="fa-solid fa-users room-stats-icon-purple"></i>
                      {room.participant_count || 0} participants
                    </span>
                    {room.room_type !== 'free' && (
                      <span className={`room-type-badge ${room.room_type}`}>
                        <i className={`fa-solid ${room.room_type === 'hard_topic' ? 'fa-triangle-exclamation' : 'fa-crown'}`}></i>
                        {room.room_type === 'hard_topic' ? 'Hard Topic' : 'Premium'}
                      </span>
                    )}
                  </div>
                  {room.tutor_name && (
                    <div className="room-tutor">
                      {room.tutor_avatar_url ? (
                        <img src={room.tutor_avatar_url} alt={room.tutor_name} className="room-tutor-avatar" />
                      ) : (
                        <i className="fa-solid fa-chalkboard-user"></i>
                      )}
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
                      <i className="fa-solid fa-clock room-status-icon-orange"></i>
                      {new Date(room.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

// Icon and label maps for status
const STATUS_META_ICONS = {
  live: 'fa-circle',
  upcoming: 'fa-clock',
  open_floor: 'fa-users',
  ended: 'fa-circle-check',
  offline: 'fa-circle',
};

const STATUS_META_LABELS = {
  live: 'Live',
  upcoming: 'Upcoming',
  open_floor: 'Open Floor',
  ended: 'Ended',
  offline: 'Offline',
};
