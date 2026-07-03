 import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLiveClassroomFeed } from '../../api/cachedClient';

function formatDuration(seconds) {
  if (!seconds) return '0m';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

export function ClassroomSection({ user }) {
  const navigate = useNavigate();
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLiveClassroomFeed().then(setFeed).finally(() => setLoading(false));
    const interval = setInterval(() => getLiveClassroomFeed().then(setFeed), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="classroom" className="section reveal">
      <span className="sec-label">Live Learning</span>
      <h2 className="section-title">Live Classroom Discussions</h2>
      <p className="section-subtitle">
        Join real-time discussions led by verified tutors. Select your level, pick a topic, raise your hand and start learning with fellow students.
      </p>

      {loading ? (
        <div className="classroom-loading"><i className="fa-solid fa-spinner fa-spin"></i></div>
      ) : feed.length === 0 ? (
        <div className="classroom-empty">
          <i className="fa-solid fa-door-closed"></i>
          <p>No sessions running right now. Check back soon.</p>
        </div>
      ) : (
        <div className="classroom-level-grid">
          {feed.map(room => (
            <div key={room.id} className={`classroom-level-card classroom-status-${room.status === 'open_floor' ? 'open' : room.status}`}>
              <div className="room-status-bar">
                <i className={`fa-solid ${room.status === 'live' || room.status === 'open_floor' ? 'fa-tower-broadcast' : 'fa-clock'}`}></i>
                <span>{room.status === 'open_floor' ? 'Open Floor' : room.status === 'live' ? 'Live' : 'Upcoming'}</span>
              </div>
              <h3 className="classroom-level-title">{room.topic_name}</h3>
              <p className="classroom-level-classes">{room.level} · {room.class_name}</p>
              {room.tutor_name && <p className="room-tutor-line"><i className="fa-solid fa-user-tie"></i> {room.tutor_name}</p>}
              {room.live_duration_seconds !== undefined && (
                <p className="room-duration-line"><i className="fa-solid fa-hourglass-half"></i> Running {formatDuration(room.live_duration_seconds)}</p>
              )}
              {room.starts_in_seconds !== undefined && (
                <p className="room-duration-line"><i className="fa-solid fa-clock"></i> Starts in {formatDuration(room.starts_in_seconds)}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="classroom-section-actions">
        <button className="btn-primary" onClick={() => navigate('/classroom')}>
          <i className="fa-solid fa-users"></i> {user ? 'Enter Classroom' : 'Login to Join'}
        </button>
        <button className="btn-download" onClick={() => navigate('/tutor/apply')}>
          <i className="fa-solid fa-user-tie"></i> Become a Tutor
        </button>
      </div>
    </section>
  );
}
