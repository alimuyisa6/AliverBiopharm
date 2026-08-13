/* pages/Classroom.jsx */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRequireOnboarding } from '../hooks/useRequireOnboarding';
import { useLevelFilter } from '../hooks/useLevelFilter';
import { useContentAccess } from '../hooks/useContentAccess';
import { useLayout } from '../contexts/LayoutContext';
import { PendingApprovalScreen } from '../components/access/PendingApprovalScreen';
import { AccessDenied } from '../components/access/AccessDenied';
import { listClassrooms, getUnits } from '../api/client';
import Icon from '../components/Icon/Icon';
import Spinner from '../components/Spinner/Spinner';
import Button from '../components/Button/Button';
import EmptyState from '../components/EmptyState/EmptyState';

const STATUS_ICONS = {
  live: 'circle',
  upcoming: 'clock',
  open_floor: 'users',
  ended: 'circle-check',
  offline: 'circle'
};

const STATUS_LABELS = {
  live: 'Live',
  upcoming: 'Upcoming',
  open_floor: 'Open Floor',
  ended: 'Ended',
  offline: 'Offline'
};

export default function Classroom() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isReady } = useRequireOnboarding();
  const access = useContentAccess();
  const { level, class_name, showAll, displayName } = useLevelFilter();
  const { groups, bootstrap } = useLayout();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeUnitId, setActiveUnitId] = useState(null);

  useEffect(() => {
    if (!groups?.length || !user) return;

    const groupId = user?.profile?.active_group_id || groups[0]?.id;

    if (!groupId) return;

    getUnits({ group_id: groupId })
      .then((units) => {
        if (units?.length) setActiveUnitId(units[0].id);
      })
      .catch(() => {});
  }, [groups, user]);

  useEffect(() => {
    if (!isReady || !access.canAccess || access.isPending || !activeUnitId) return;

    fetchRooms();
  }, [isReady, access.canAccess, access.isPending, activeUnitId]);

  async function fetchRooms() {
    setLoading(true);
    setError(null);

    try {
      const data = await listClassrooms(activeUnitId, null);

      setRooms(data || []);
    } catch {
      setError('Failed to load classrooms');
    } finally {
      setLoading(false);
    }
  }

  function getEmptyStateImage(key) {
    const uiComponents = bootstrap?.ui_components || [];
    const component = uiComponents.find((item) => item.component_key === `empty_state_${key}`);

    return component?.properties?.image_url || null;
  }

  if (!isReady || access.isPending) return <PendingApprovalScreen />;
  if (!access.canAccess) return <AccessDenied />;

  if (loading) {
    return (
      <div className="fcd-loading-wrap">
        <Spinner size="lg" />
      </div>
    );
  }

  const levelName = displayName || level?.id || '';
  const classLabel = class_name || '';

  return (
    <div className="classroom-page">
      <div className="section classroom-list-section">
        <span className="sec-label">Live Learning</span>
        <h1 className="section-title classroom-page-title">
          Classrooms<br />{levelName ? `– ${levelName}` : ''}
        </h1>

        {classLabel && <p className="classroom-class-label">{classLabel}</p>}

        {levelName && !showAll && (
          <div className="classroom-level-chips">
            <span className="chip classroom-chip-level">{levelName}</span>
            {classLabel && <span className="chip classroom-chip-class">{classLabel}</span>}
          </div>
        )}

        {showAll && (
          <div className="classroom-teacher-badge-wrap">
            <span className="badge badge-primary">All Levels (Teacher Access)</span>
          </div>
        )}

        {error && (
          <div className="alert alert-error classroom-error-alert">
            <Icon name="exclamation-triangle" /> {error}
            <Button variant="secondary" size="sm" onClick={fetchRooms} className="classroom-error-retry">Retry</Button>
          </div>
        )}

        {!loading && !error && rooms.length === 0 && (
          <EmptyState
            image={getEmptyStateImage('classrooms')}
            title="No Classrooms Available"
            description={`No active rooms for ${classLabel || levelName || 'your level'}.`}
            action={
              <Button onClick={() => navigate('/tutor/apply')}>
                <Icon name="user-pen" /> Become a Tutor
              </Button>
            }
          />
        )}

        {!loading && !error && rooms.length > 0 && (
          <div className="grid grid-cols-3">
            {rooms.map((room) => {
              const statusKey = STATUS_LABELS[room.status] ? room.status : 'offline';

              return (
                <div key={room.id} className={`card classroom-room-card status-${statusKey}`}>
                  <div className="card-image-placeholder">
                    {room.cover_image_url ? (
                      <img src={room.cover_image_url} alt={room.title} className="card-image" />
                    ) : (
                      <Icon name="users" className="classroom-room-status-icon" />
                    )}
                  </div>

                  <div className="classroom-room-status-bar">
                    <Icon name={STATUS_ICONS[room.status] || 'circle'} />
                    <span>{STATUS_LABELS[room.status] || room.status}</span>
                  </div>

                  <div className="card-body">
                    <h3 className="card-title">{room.title}</h3>
                    <p className="card-text">{room.topic_name} · {room.class_name}</p>

                    {room.tutor_name && (
                      <p className="card-text classroom-room-meta">
                        <Icon name="user" /> {room.tutor_name}
                      </p>
                    )}

                    {room.participant_count > 0 && (
                      <p className="card-text classroom-room-meta">
                        <Icon name="users" /> {room.participant_count} participants
                      </p>
                    )}
                  </div>

                  <div className="card-footer">
                    {room.status === 'live' || room.status === 'open_floor' ? (
                      <Button size="sm" onClick={() => navigate(`/classroom/${room.id}`)}>
                        <Icon name="door-open" /> Join
                      </Button>
                    ) : room.status === 'upcoming' ? (
                      <Button size="sm" variant="secondary" disabled>
                        <Icon name="clock" />
                        {new Date(room.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" disabled>
                        <Icon name="circle" /> {STATUS_LABELS[room.status] || 'Offline'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
} 
