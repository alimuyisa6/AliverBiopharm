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

const STATUS_CLASS = {
  live: 'classroom-status-live',
  open_floor: 'classroom-status-open',
  upcoming: 'classroom-status-upcoming',
};

export function ClassroomSection({ user }) {
  const navigate = useNavigate();
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLiveClassroomFeed()
      .then(setFeed)
      .finally(() => setLoading(false));
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
        <div className="classroom-loading"><i className="fa-solid fa-spinner fa-spin" style={{ color: 'var(--clr-cyan)' }}></i></div>
      ) : feed.length === 0 ? (
        <div className="classroom-empty">
          <i className="fa-solid fa-door-closed" style={{ color: 'var(--clr-text-muted)' }}></i>
          <p>No sessions running right now. Check back soon.</p>
        </div>
      ) : (
        <div className="classroom-level-grid">
          {feed.map(room => {
            const statusClass = STATUS_CLASS[room.status] || '';
            const isPremium = room.room_type === 'premium';
            const isHard = room.room_type === 'hard_topic';
            const statusColor = room.status === 'live' ? 'var(--clr-green)' : 
                               room.status === 'open_floor' ? 'var(--clr-blue)' : 
                               'var(--clr-orange)';
            return (
              <div key={room.id} className={`classroom-level-card ${statusClass}`}>
                <div className="card-media">
                  {room.image_url ? (
                    <img src={room.image_url} alt={room.topic_name} loading="lazy" />
                  ) : (
                    <div className="card-media-fallback">
                      <i className="fa-solid fa-dna" style={{ color: 'var(--clr-cyan)' }}></i>
                    </div>
                  )}
                  {isHard && <span className="card-media-ribbon ribbon-hard">Hard Topic</span>}
                  {isPremium && !isHard && <span className="card-media-ribbon ribbon-premium">Premium</span>}
                </div>
                <div className="room-status-bar" style={{ backgroundColor: statusColor }}>
                  <i className={`fa-solid ${room.status === 'live' || room.status === 'open_floor' ? 'fa-tower-broadcast' : 'fa-clock'}`}></i>
                  <span>{room.status === 'open_floor' ? 'Open Floor' : room.status === 'live' ? 'Live' : 'Upcoming'}</span>
                </div>
                <div className="classroom-level-body">
                  <h3 className="classroom-level-title">{room.topic_name}</h3>
                  <p className="classroom-level-classes">{room.level} · {room.class_name}</p>
                  {room.tutor_name && (
                    <p className="room-tutor-line">
                      {room.tutor_avatar_url ? (
                        <img src={room.tutor_avatar_url} alt={room.tutor_name} className="room-tutor-avatar" />
                      ) : (
                        <i className="fa-solid fa-user-tie" style={{ color: 'var(--clr-magenta)' }}></i>
                      )}
                      {room.tutor_name}
                    </p>
                  )}
                  {room.live_duration_seconds !== undefined && (
                    <p className="room-duration-line">
                      <i className="fa-solid fa-hourglass-half" style={{ color: 'var(--clr-blue)' }}></i>
                      Running {formatDuration(room.live_duration_seconds)}
                    </p>
                  )}
                  {room.starts_in_seconds !== undefined && (
                    <p className="room-duration-line">
                      <i className="fa-solid fa-clock" style={{ color: 'var(--clr-orange)' }}></i>
                      Starts in {formatDuration(room.starts_in_seconds)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
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
