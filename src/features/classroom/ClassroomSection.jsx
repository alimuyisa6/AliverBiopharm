 // pages/ClassroomSection.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLayout } from '../../contexts/LayoutContext';
import { getLiveClassroomFeed } from '../../api/cachedClient';
import SplitCard from '../../components/SplitCard/SplitCard';
import EmptyState from '../../components/EmptyState/EmptyState';
import Button from '../../components/Button/Button';
import Icon from '../../components/Icon/Icon';
import Spinner from '../../components/Spinner/Spinner';
import './ClassroomSection.css';

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
  const { bootstrap } = useLayout();
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

  function getUiImage(key) {
    const uiComponents = bootstrap?.ui_components || [];
    const component = uiComponents.find((item) => item.component_key === key);
    return component?.properties?.image_url || null;
  }

  if (loading) {
    return (
      <section id="classroom" className="section">
        <div className="classroom-loading">
          <Spinner size="lg" />
        </div>
      </section>
    );
  }

  const backgroundUrl = getUiImage('classroom_section_background') || '/images/marketplace.jpg';

  return (
    <section
      id="classroom"
      className={`section reveal ${feed.length > 0 ? 'section-with-bg' : ''}`}
      style={feed.length > 0 ? {
        backgroundImage: `url(${backgroundUrl})`,
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
          <EmptyState
            image={getUiImage('empty_state_classroom')}
            title="The room is quiet, for now"
            description="No live discussions are running at the moment. Start one yourself or check back shortly."
            action={
              <Button variant="secondary" onClick={() => navigate('/tutor/apply')}>
                <Icon name="user-pen" /> Become a Tutor
              </Button>
            }
          />
        ) : (
          <div className="classroom-level-grid">
            {feed.slice(0, 6).map((room) => (
              <SplitCard
                key={room.id}
                image={room.image_url}
                fallbackImage={getUiImage('default_classroom_thumbnail') || '/images/classroom-default.jpg'}
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
