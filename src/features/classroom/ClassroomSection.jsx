 import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLiveClassroomFeed } from '../../api/cachedClient';
import ImageStep from '../../components/ImageStep/ImageStep';
import Icon from '../../components/Icon/Icon';
import Button from '../../components/Button/Button';
import Spinner from '../../components/Spinner/Spinner';

const STATUS_LABEL = {
  live: '🔴 Live Now',
  open_floor: '💬 Open Floor',
  upcoming: '⏰ Upcoming'
};

export function ClassroomSection({ user }) {
  const navigate = useNavigate();
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLiveClassroomFeed()
      .then(setFeed)
      .finally(() => setLoading(false));

    const interval = setInterval(() => {
      getLiveClassroomFeed().then(setFeed);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <section id="classroom" className="section">
        <div className="classroom-loading">
          <Spinner size="lg" />
        </div>
      </section>
    );
  }

  return (
    <section
      id="classroom"
      className="section reveal section-with-bg"
      style={{
        backgroundImage: `url(/images/marketplace.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="section-overlay">
        <span className="sec-label">Live Learning</span>
        <h2 className="section-title">
          Live Classroom<br />Discussions
        </h2>
        <p className="section-subtitle">
          Join real-time discussions led by verified tutors.
        </p>

        {feed.length === 0 ? (
          <div className="classroom-empty">
            <Icon name="door-closed" style={{ fontSize: '2rem', marginBottom: 'var(--space-4)' }} />
            <p>No sessions running right now. Check back soon.</p>
          </div>
        ) : (
          <div className="classroom-level-grid">
            {feed.slice(0, 6).map((room) => (
              <ImageStep
                key={room.id}
                image={room.image_url || '/images/classroom-default.jpg'}
                title={room.topic_name}
                subtitle={STATUS_LABEL[room.status] || room.status}
                link={`/classroom/${room.id}`}
                buttonText={user ? 'Enter Room' : 'Join'}
              />
            ))}
          </div>
        )}

        <div className="classroom-section-actions">
          <Button onClick={() => navigate('/classroom')}>
            <Icon name="users" /> {user ? 'View All Rooms' : 'Login to Join'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/tutor/apply')}>
            <Icon name="user-pen" /> Become a Tutor
          </Button>
        </div>
      </div>
    </section>
  );
}
