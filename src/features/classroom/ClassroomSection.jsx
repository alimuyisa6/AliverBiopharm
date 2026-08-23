 import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLiveClassroomFeed } from '../../api/cachedClient';
import SplitCard from '../../components/SplitCard/SplitCard';
import Button from '../../components/Button/Button';
import Icon from '../../components/Icon/Icon';
import Spinner from '../../components/Spinner/Spinner';

const STATUS_LABEL = {
  live: 'Live Now',
  open_floor: 'Open Floor',
  upcoming: 'Upcoming'
};

const STATUS_VARIANT = {
  live: 'danger',
  open_floor: 'primary',
  upcoming: 'warm'
};

export function ClassroomSection({ user }) {
  const navigate = useNavigate();
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getLiveClassroomFeed()
      .then((data) => { if (!cancelled) setFeed(data); })
      .finally(() => { if (!cancelled) setLoading(false); });

    const interval = setInterval(() => {
      getLiveClassroomFeed().then((data) => { if (!cancelled) setFeed(data); });
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
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
      className={`section reveal ${feed.length > 0 ? 'section-with-bg' : ''}`}
      style={feed.length > 0 ? {
        backgroundImage: `url(/images/marketplace.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      } : undefined}
    >
      <div className={feed.length > 0 ? 'section-overlay' : ''}>
        <span className="sec-label">Live Learning</span>
        <h2 className="section-title">
          Where Questions<br />Meet Real Answers
        </h2>
        <p className="section-subtitle">
          Step into live sessions with verified tutors — ask, discuss, and learn in real time.
        </p>

        {feed.length === 0 ? (
          <div className="section-empty-state">
            <img
              src="/images/empty-classroom.svg"
              alt=""
              className="section-empty-image"
            />
            <h3 className="section-empty-title">The room is quiet, for now</h3>
            <p className="section-empty-text">
              No live discussions are running at the moment. Start one yourself or check back shortly.
            </p>
            <div className="section-empty-actions">
              <Button variant="secondary" onClick={() => navigate('/tutor/apply')}>
                <Icon name="user-pen" /> Become a Tutor
              </Button>
            </div>
          </div>
        ) : (
          <div className="classroom-level-grid">
            {feed.slice(0, 6).map((room) => (
              <SplitCard
                key={room.id}
                image={room.image_url}
                fallbackImage="/images/classroom-default.jpg"
                title={room.topic_name}
                subtitle={STATUS_LABEL[room.status] || room.status}
                badge={STATUS_LABEL[room.status] || room.status}
                badgeVariant={STATUS_VARIANT[room.status] || 'primary'}
                link={`/classroom/${room.id}`}
                buttonText={user ? 'Enter' : 'Join'}
              />
            ))}
          </div>
        )}

        {feed.length > 0 && (
          <div className="classroom-section-actions">
            <Button onClick={() => navigate('/classroom')}>
              <Icon name="users" /> {user ? 'View All Rooms' : 'Login to Join'}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/tutor/apply')}>
              <Icon name="user-pen" /> Become a Tutor
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
