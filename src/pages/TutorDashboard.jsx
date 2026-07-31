 /* pages/TutorDashboard.jsx */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLayout } from '../contexts/LayoutContext';
import { useLevelFilter } from '../hooks/useLevelFilter';
import {
  getClassroomLevels,
  getClassroomTopics,
  getTutorStatus,
  getTutorRooms,
  createClassroom,
  endClassroom,
} from '../api/client';
import Icon from '../components/Icon/Icon';
import Spinner from '../components/Spinner/Spinner';
import Button from '../components/Button/Button';
import Input from '../components/Input/Input';
import Select from '../components/Select/Select';
import Card from '../components/Card/Card';
import Modal from '../components/Modal/Modal';
import EmptyState from '../components/EmptyState/EmptyState';
import { useToast } from '../components/Toast/Toast';

export default function TutorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { displayName } = useLevelFilter();
  const addToast = useToast();

  const [tutorStatus, setTutorStatus] = useState(null);
  const [levels, setLevels] = useState([]);
  const [activeRooms, setActiveRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    level: '',
    group_id: '',
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

  useEffect(() => {
    if (!user) {
      setError('You must be logged in.');
      setLoading(false);
      return;
    }
    fetchDashboard();
  }, [user]);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusData, levelsData] = await Promise.all([
        getTutorStatus(),
        getClassroomLevels(),
      ]);
      setTutorStatus(statusData?.application || null);
      setLevels(levelsData || []);
      if (statusData?.application?.status === 'approved') {
        fetchActiveRooms();
      }
    } catch (err) {
      setError('Failed to load dashboard. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveRooms = async () => {
    try {
      const data = await getTutorRooms();
      setActiveRooms(data?.rooms || data || []);
    } catch {
      addToast('Failed to load your rooms.', 'error');
    }
  };

  const fetchTopics = async (groupId) => {
    setLoadingTopics(true);
    try {
      const data = await getClassroomTopics(groupId);
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
    setSubmitting(true);
    setCreateError(null);
    try {
      await createClassroom({
        title: form.title,
        unit_id: form.topic_id,
        room_type: form.room_type,
        scheduled_at: form.scheduled_at || null,
      });
      addToast('Classroom created successfully!', 'success');
      setShowCreateForm(false);
      setForm({
        title: '',
        level: '',
        group_id: '',
        class_name: '',
        topic_id: '',
        topic_name: '',
        room_type: 'free',
        scheduled_at: '',
      });
      fetchActiveRooms();
    } catch (err) {
      setCreateError(err.message || 'Failed to create room.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndRoom = async (roomId) => {
    try {
      await endClassroom(roomId);
      addToast('Room ended.', 'success');
      fetchActiveRooms();
    } catch (err) {
      addToast(err.message || 'Failed to end room.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="section" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="section" style={{ textAlign: 'center', paddingTop: 'var(--space-16)' }}>
        <EmptyState
          icon="exclamation-triangle"
          title="Error"
          description={error}
          action={<Button onClick={() => navigate('/login')}>Log In</Button>}
        />
      </div>
    );
  }

  const application = tutorStatus;
  const isApproved = application?.status === 'approved';
  const statusLabels = {
    pending: { label: 'Pending Review', color: 'var(--warning)', icon: 'clock' },
    scheduled: { label: 'Interview Scheduled', color: 'var(--primary)', icon: 'calendar' },
    interviewed: { label: 'Interview Completed', color: 'var(--accent)', icon: 'check-double' },
    approved: { label: 'Approved Tutor', color: 'var(--success)', icon: 'circle-check' },
    rejected: { label: 'Application Rejected', color: 'var(--error)', icon: 'circle-xmark' },
  };

  const levelName = displayName || '';

  return (
    <div className="tutor-dashboard-page">
      <div className="section" style={{ paddingTop: 'var(--space-6)' }}>
        <span className="sec-label">Teaching Portal</span>
        <h1 className="section-title" style={{ textAlign: 'left', margin: '0 0 var(--space-4)' }}>
          Tutor Dashboard{levelName ? ` – ${levelName}` : ''}
        </h1>
        <p className="section-subtitle" style={{ textAlign: 'left', marginBottom: 'var(--space-6)' }}>
          Manage your classrooms, track sessions, and engage with students.
        </p>

        {!application && (
          <EmptyState
            icon="graduation-cap"
            title="No Application Found"
            description="You haven't applied to become a tutor yet."
            action={
              <Button onClick={() => navigate('/tutor/apply')} icon="paper-plane">
                Start Application
              </Button>
            }
          />
        )}

        {application && !isApproved && statusLabels[application.status] && (
          <Card style={{ padding: 'var(--space-8)', maxWidth: 600, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
              <Icon name={statusLabels[application.status].icon} style={{ fontSize: '2rem', color: statusLabels[application.status].color }} />
              <div>
                <span className="badge" style={{ background: `${statusLabels[application.status].color}20`, color: statusLabels[application.status].color }}>
                  {statusLabels[application.status].label}
                </span>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-dim)', marginTop: 'var(--space-2)' }}>
                  Applied {new Date(application.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <p><strong>Level:</strong> {application.level}</p>
              <p><strong>Class:</strong> {application.class_name}</p>
              <p><strong>Subjects:</strong> {(application.subjects || []).join(', ')}</p>
            </div>
            {application.status === 'rejected' && application.rejection_reason && (
              <div className="alert alert-error" style={{ marginTop: 'var(--space-4)' }}>
                <Icon name="circle-info" /> {application.rejection_reason}
              </div>
            )}
          </Card>
        )}

        {isApproved && (
          <div>
            <div className="alert alert-success" style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Icon name="circle-check" style={{ marginRight: 'var(--space-3)' }} />
                Approved Tutor — {application.display_name || 'Tutor'}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <Button
                  variant={showCreateForm ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => {
                    setShowCreateForm(!showCreateForm);
                    setCreateError(null);
                  }}
                  icon={showCreateForm ? 'xmark' : 'plus'}
                >
                  {showCreateForm ? 'Cancel' : 'Create Classroom'}
                </Button>
                <Button variant="ghost" size="sm" onClick={fetchActiveRooms} icon="rotate">
                  Refresh
                </Button>
              </div>
            </div>

            {showCreateForm && (
              <Card style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-8)' }}>
                <h3 style={{ marginBottom: 'var(--space-6)' }}>
                  <Icon name="plus" style={{ marginRight: 'var(--space-3)', color: 'var(--primary)' }} />
                  New Classroom
                </h3>
                <Input
                  label="Room Title"
                  placeholder="e.g., Introduction to Cell Biology"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  required
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <Select
                    label="Level"
                    value={form.level}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, level: e.target.value, group_id: '', class_name: '', topic_id: '', topic_name: '' }));
                      setTopics([]);
                    }}
                    options={levels.map((l) => ({ value: l.key, label: l.key }))}
                    placeholder="Choose level..."
                  />
                  <Select
                    label="Class"
                    value={form.group_id}
                    onChange={(e) => {
                      const groupId = e.target.value;
                      const found = (levels.find((l) => l.key === form.level)?.classes || []).find((c) => (typeof c === 'string' ? c : c.id) === groupId);
                      const name = found ? (typeof found === 'string' ? found : found.name) : '';
                      setForm((prev) => ({ ...prev, group_id: groupId, class_name: name, topic_id: '', topic_name: '' }));
                      if (groupId) fetchTopics(groupId);
                    }}
                    options={(levels.find((l) => l.key === form.level)?.classes || []).map((c) => ({
                      value: typeof c === 'string' ? c : c.id,
                      label: typeof c === 'string' ? c : c.name,
                    }))}
                    placeholder="Choose class..."
                    disabled={!form.level}
                  />
                </div>
                <Select
                  label="Topic"
                  value={form.topic_id}
                  onChange={(e) => {
                    const selected = topics.find((t) => t.id === e.target.value);
                    setForm((prev) => ({
                      ...prev,
                      topic_id: e.target.value,
                      topic_name: selected?.topic_name || '',
                    }));
                  }}
                  options={topics.map((t) => ({ value: t.id, label: t.topic_name }))}
                  placeholder={loadingTopics ? 'Loading topics...' : 'Choose topic...'}
                  disabled={!form.group_id || loadingTopics}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <Select
                    label="Room Type"
                    value={form.room_type}
                    onChange={(e) => setForm((prev) => ({ ...prev, room_type: e.target.value }))}
                    options={[
                      { value: 'free', label: 'Free Discussion' },
                      { value: 'hard_topic', label: 'Hard Topic (Scheduled)' },
                      { value: 'premium', label: 'Premium (Scheduled)' },
                    ]}
                  />
                  {(form.room_type === 'hard_topic' || form.room_type === 'premium') && (
                    <Input
                      label="Schedule"
                      type="datetime-local"
                      value={form.scheduled_at}
                      onChange={(e) => setForm((prev) => ({ ...prev, scheduled_at: e.target.value }))}
                    />
                  )}
                </div>
                {createError && (
                  <div className="alert alert-error" style={{ marginTop: 'var(--space-4)' }}>
                    <Icon name="exclamation-triangle" /> {createError}
                  </div>
                )}
                <div style={{ marginTop: 'var(--space-6)' }}>
                  <Button onClick={handleCreateRoom} loading={submitting} icon="plus">
                    Create Classroom
                  </Button>
                </div>
              </Card>
            )}

            <h3 style={{ marginBottom: 'var(--space-6)' }}>
              <Icon name="users" style={{ marginRight: 'var(--space-3)', color: 'var(--primary)' }} />
              Your Active Classrooms ({activeRooms.length})
            </h3>

            {activeRooms.length === 0 ? (
              <EmptyState
                icon="door-closed"
                title="No Active Classrooms"
                description="You haven't created any classrooms yet."
              />
            ) : (
              <div className="grid grid-cols-3">
                {activeRooms.map((room) => {
                  const statusIconMap = {
                    live: 'circle',
                    open_floor: 'users',
                    upcoming: 'clock',
                  };
                  const statusLabelMap = {
                    live: 'Live',
                    open_floor: 'Open Floor',
                    upcoming: 'Upcoming',
                  };
                  return (
                    <Card key={room.id}>
                      <div style={{ padding: 'var(--space-3) var(--space-4)', background: room.status === 'live' ? 'var(--success)' : room.status === 'open_floor' ? 'var(--primary)' : 'var(--warning)', color: '#fff', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <Icon name={statusIconMap[room.status] || 'circle'} />
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                          {statusLabelMap[room.status] || room.status}
                        </span>
                      </div>
                      <div className="card-body">
                        <h4 className="card-title">{room.title}</h4>
                        <p className="card-text">{room.topic_name} · {room.class_name}</p>
                        {room.participant_count > 0 && (
                          <p className="card-text">
                            <Icon name="users" style={{ marginRight: 'var(--space-1)' }} />
                            {room.participant_count} participants
                          </p>
                        )}
                      </div>
                      <div className="card-footer" style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <Button size="sm" onClick={() => navigate(`/classroom/${room.id}`)} icon="door-open">
                          Enter
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleEndRoom(room.id)} icon="stop">
                          End
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
