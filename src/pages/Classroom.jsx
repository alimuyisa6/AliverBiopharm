// pages/Classroom.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
 
import { ClassroomOnboarding } from '../features/classroom/ClassroomOnboarding';
import { useAuth } from '../contexts/AuthContext';
import { getAllSiteSections } from '../api/client';

export default function Classroom() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sections, setSections] = useState(null);
  const [onboarding, setOnboarding] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(true);

  useEffect(() => {
    getAllSiteSections().then(setSections).catch(() => {});
    const saved = localStorage.getItem('classroom_onboarding');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setOnboarding(parsed);
        setShowOnboarding(false);
        fetchRooms(parsed);
      } catch {
        localStorage.removeItem('classroom_onboarding');
      }
    }
  }, []);

  const fetchRooms = async (onboardData) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        level: onboardData.level,
        class_name: onboardData.class_name,
        topic_id: onboardData.topic?.id || onboardData.topic?.topic_name || onboardData.topic?.unit_name || '',
      });
      const res = await fetch(`/api/server?module=classroom&path=list&${params}`, { credentials: 'include' });
      const data = await res.json();
      setRooms(data.data || data || []);
    } catch {
      setError('Failed to load classrooms');
    }
    setLoading(false);
  };

  const handleOnboardingComplete = (data) => {
    setOnboarding(data);
    setShowOnboarding(false);
    localStorage.setItem('classroom_onboarding', JSON.stringify(data));
    fetchRooms(data);
  };

  const handleResetOnboarding = () => {
    setShowOnboarding(true);
    setRooms([]);
    setOnboarding(null);
    localStorage.removeItem('classroom_onboarding');
  };

  const handleJoinRoom = (roomId) => {
    navigate(`/classroom/${roomId}`);
  };

  const statusIcons = {
    live: { icon: 'fa-circle', color: '#10b981', label: 'Live' },
    upcoming: { icon: 'fa-clock', color: '#f59e0b', label: 'Upcoming' },
    open_floor: { icon: 'fa-users', color: '#3b82f6', label: 'Open Floor' },
    ended: { icon: 'fa-circle-check', color: '#94a3b8', label: 'Ended' },
    offline: { icon: 'fa-circle', color: '#64748b', label: 'Offline' },
  };

  return (
    <PageLayout sections={sections}>
      <div className="classroom-page">
        <div className="classroom-header">
          <span className="sec-label">Live Learning</span>
          <h1 className="section-title">Classrooms</h1>
          {onboarding && !showOnboarding && (
            <div className="classroom-active-filters">
              <span className="filter-tag">{onboarding.level}</span>
              <span className="filter-tag">{onboarding.class_name}</span>
              <span className="filter-tag">{onboarding.topic?.topic_name || onboarding.topic?.unit_name || onboarding.topic?.name}</span>
              <button className="filter-change-btn" onClick={handleResetOnboarding}>
                <i className="fa-solid fa-pen"></i> Change
              </button>
            </div>
          )}
        </div>

        {showOnboarding && (
          <ClassroomOnboarding onComplete={handleOnboardingComplete} />
        )}

        {!showOnboarding && loading && (
          <div className="classroom-loading">
            <i className="fa-solid fa-spinner fa-spin"></i>
            <p>Finding classrooms...</p>
          </div>
        )}

        {!showOnboarding && error && (
          <div className="classroom-error">
            <p>{error}</p>
            <button className="btn-secondary" onClick={() => fetchRooms(onboarding)}>Retry</button>
          </div>
        )}

        {!showOnboarding && !loading && !error && rooms.length === 0 && (
          <div className="classroom-empty">
            <i className="fa-solid fa-door-closed"></i>
            <h3>No Classrooms Available</h3>
            <p>No active rooms for this topic. Check back later or start a discussion.</p>
            <button className="btn-primary" onClick={() => navigate('/tutor/apply')}>
              <i className="fa-solid fa-chalkboard-user"></i> Become a Tutor
            </button>
          </div>
        )}

        {!showOnboarding && !loading && !error && rooms.length > 0 && (
          <div className="classroom-grid">
            {rooms.map(room => {
              const status = statusIcons[room.status] || statusIcons.offline;
              return (
                <div key={room.id} className={`classroom-card ${room.status}`}>
                  <div className="room-status-bar" style={{ background: status.color }}>
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
                      <button className="btn-primary" onClick={() => handleJoinRoom(room.id)}>
                        <i className="fa-solid fa-door-open"></i> Join Now
                      </button>
                    )}
                    {room.status === 'upcoming' && room.scheduled_at && (
                      <button className="btn-secondary" disabled>
                        <i className="fa-solid fa-clock"></i> {new Date(room.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </button>
                    )}
                    {room.status === 'open_floor' && (
                      <button className="btn-primary" onClick={() => handleJoinRoom(room.id)}>
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
    </PageLayout>
  );
}
