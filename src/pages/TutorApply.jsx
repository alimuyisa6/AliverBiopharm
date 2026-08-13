/* pages/TutorApply.jsx */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLevelFilter } from '../hooks/useLevelFilter';
import {
  getClassroomLevels,
  getClassroomTopics,
  applyAsTutor,
  getTutorStatus
} from '../api/client';
import Icon from '../components/Icon/Icon';
import Spinner from '../components/Spinner/Spinner';
import Button from '../components/Button/Button';
import Card from '../components/Card/Card';
import Textarea from '../components/Textarea/Textarea';
import { useToast } from '../components/Toast/Toast';

const CARD_COLORS = ['var(--primary)', 'var(--secondary)', 'var(--accent)'];

export default function TutorApply() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { displayName } = useLevelFilter();
  const addToast = useToast();

  const [step, setStep] = useState(1);
  const [levels, setLevels] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [topics, setTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [qualifications, setQualifications] = useState('');
  const [experience, setExperience] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingApplication, setExistingApplication] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [levelsData, statusRes] = await Promise.all([
          getClassroomLevels(),
          getTutorStatus()
        ]);

        setLevels(levelsData || []);

        if (statusRes?.application) setExistingApplication(statusRes.application);
      } catch {
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    if (user?.profile?.track && levels.length && step === 1) {
      const matched = levels.find((lvl) => lvl.key === user.profile.track || lvl.display_name === user.profile.track);

      if (matched) {
        setSelectedLevel(matched);
        setStep(2);
      }
    }
  }, [user, levels, step]);

  function handleLevelSelect(level) {
    setSelectedLevel(level);
    setSelectedClass(null);
    setSelectedTopics([]);
    setStep(2);
  }

  async function handleClassSelect(cls) {
    const classObj = typeof cls === 'string' ? { id: cls, name: cls } : cls;

    setSelectedClass(classObj);
    setSelectedTopics([]);

    try {
      const data = await getClassroomTopics(classObj.id, selectedLevel.key);

      setTopics(data || []);
    } catch {
      setTopics([]);
    }

    setStep(3);
  }

  function toggleTopic(topicName) {
    setSelectedTopics((prev) => (
      prev.includes(topicName)
        ? prev.filter((topic) => topic !== topicName)
        : [...prev, topicName]
    ));
  }

  async function handleSubmit() {
    const storedTrack = user?.profile?.track;
    const levelToSubmit = storedTrack || selectedLevel?.key;

    if (!levelToSubmit || !selectedClass || selectedTopics.length === 0) {
      addToast('Please complete all required fields', 'error');
      return;
    }

    if (storedTrack && selectedLevel && selectedLevel.key !== storedTrack) {
      addToast('Submitted level does not match your signup level', 'error');
      return;
    }

    setSubmitting(true);

    try {
      await applyAsTutor(
        levelToSubmit,
        selectedClass.name,
        selectedTopics,
        qualifications,
        experience
      );

      setSubmitted(true);
    } catch (err) {
      addToast(err.message || 'Failed to submit application', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="section" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (existingApplication) {
    const statusLabels = {
      pending: { label: 'Pending Review', color: 'var(--warning)' },
      scheduled: { label: 'Interview Scheduled', color: 'var(--primary)' },
      interviewed: { label: 'Interview Completed', color: 'var(--accent)' },
      approved: { label: 'Approved', color: 'var(--success)' },
      rejected: { label: 'Rejected', color: 'var(--error)' }
    };

    const status = statusLabels[existingApplication.status] || statusLabels.pending;

    return (
      <div className="section" style={{ paddingTop: 'var(--space-6)' }}>
        <span className="sec-label">Teaching</span>
        <h1 className="section-title" style={{ textAlign: 'left', margin: '0 0 var(--space-4)' }}>
          Tutor Application<br />Status
        </h1>

        <Card style={{ padding: 'var(--space-8)', textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
          <Icon name="circle-check" style={{ fontSize: '3rem', color: status.color, marginBottom: 'var(--space-4)' }} />
          <h2 style={{ color: status.color, marginBottom: 'var(--space-4)' }}>{status.label}</h2>

          <div style={{ marginBottom: 'var(--space-6)' }}>
            <p><strong>Level:</strong> {existingApplication.level}</p>
            <p><strong>Class:</strong> {existingApplication.class_name}</p>
            <p><strong>Subjects:</strong> {(existingApplication.subjects || []).join(', ')}</p>
            {existingApplication.rejection_reason && <p style={{ color: 'var(--error)' }}><strong>Reason:</strong> {existingApplication.rejection_reason}</p>}
            {existingApplication.interview_scheduled_at && <p><strong>Interview:</strong> {new Date(existingApplication.interview_scheduled_at).toLocaleString()}</p>}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center' }}>
            <Button onClick={() => navigate('/tutor/dashboard')} icon="gauge-high">Tutor Dashboard</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="section" style={{ paddingTop: 'var(--space-6)', textAlign: 'center' }}>
        <Icon name="circle-check" style={{ fontSize: '3rem', color: 'var(--success)', marginBottom: 'var(--space-4)' }} />
        <h1 className="section-title">
          Application<br />Submitted
        </h1>
        <p className="section-subtitle">
          Your tutor application has been received.
        </p>

        <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', marginTop: 'var(--space-6)' }}>
          <Button onClick={() => navigate('/tutor/dashboard')} icon="gauge-high">Go to Tutor Dashboard</Button>
          <Button variant="secondary" onClick={() => navigate('/classroom')} icon="users">Back to Classrooms</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="tutor-apply-page">
      <div className="section" style={{ paddingTop: 'var(--space-6)' }}>
        <span className="sec-label">Teaching</span>
        <h1 className="section-title" style={{ textAlign: 'left', margin: '0 0 var(--space-4)' }}>
          Become a<br />Tutor
        </h1>
        <p className="section-subtitle" style={{ textAlign: 'left', marginBottom: 'var(--space-6)' }}>
          Share your knowledge with students.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-8)', marginBottom: 'var(--space-8)' }}>
          {[1, 2, 3].map((number) => (
            <div key={number} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span className={`badge ${step >= number ? 'badge-primary' : 'badge-ghost'}`} style={{ borderRadius: '50%', width: 32, height: 32, justifyContent: 'center' }}>
                {number}
              </span>
              <span style={{ fontSize: 'var(--text-sm)', color: step >= number ? 'var(--text-main)' : 'var(--text-muted)' }}>
                {number === 1 ? 'Level' : number === 2 ? 'Class' : 'Subjects'}
              </span>
            </div>
          ))}
        </div>

        {step === 1 && !user?.profile?.track && (
          <div>
            <h3 style={{ marginBottom: 'var(--space-6)' }}>Select your level to teach</h3>

            <div className="grid grid-cols-3">
              {levels.map((level, index) => (
                <Card key={level.key}>
                  <div className="card-image-placeholder" style={{ background: `${CARD_COLORS[index % 3]}15` }}>
                    <Icon name={level.icon === 'dna' ? 'microscope' : level.icon || 'graduation-cap'} style={{ fontSize: '2rem', color: CARD_COLORS[index % 3] }} />
                  </div>
                  <div className="card-body" style={{ textAlign: 'center' }}>
                    <h3 className="card-title">{level.key}</h3>
                  </div>
                  <div className="card-footer">
                    <Button size="sm" onClick={() => handleLevelSelect(level)}>Select</Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {step === 2 && selectedLevel && (
          <div>
            <Button variant="ghost" onClick={() => setStep(1)} icon="arrow-left" style={{ marginBottom: 'var(--space-6)' }}>Back</Button>
            <h3 style={{ marginBottom: 'var(--space-6)' }}>Select your class in {selectedLevel.key}</h3>

            <div className="grid grid-cols-3">
              {(selectedLevel.classes || []).map((cls, index) => {
                const name = typeof cls === 'string' ? cls : cls.name;
                const icon = typeof cls === 'object' ? cls.icon : null;

                return (
                  <Card key={name}>
                    <div className="card-image-placeholder" style={{ background: `${CARD_COLORS[index % 3]}15` }}>
                      <Icon name={icon === 'dna' ? 'microscope' : icon || 'book-open'} style={{ fontSize: '2rem', color: CARD_COLORS[index % 3] }} />
                    </div>
                    <div className="card-body" style={{ textAlign: 'center' }}>
                      <h3 className="card-title">{name}</h3>
                    </div>
                    <div className="card-footer">
                      <Button size="sm" onClick={() => handleClassSelect(cls)}>Select</Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <Button variant="ghost" onClick={() => setStep(2)} icon="arrow-left" style={{ marginBottom: 'var(--space-6)' }}>Back</Button>
            <h3 style={{ marginBottom: 'var(--space-6)' }}>
              Select topics you can teach in {selectedClass?.name}
            </h3>

            {topics.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', marginBottom: 'var(--space-6)' }}>No topics available for this class.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
                {topics.map((topic) => (
                  <Button
                    key={topic.id}
                    variant={selectedTopics.includes(topic.topic_name) ? 'primary' : 'ghost'}
                    onClick={() => toggleTopic(topic.topic_name)}
                    icon={selectedTopics.includes(topic.topic_name) ? 'square-check' : 'square'}
                  >
                    {topic.topic_name}
                    {topic.is_hard_topic && <span className="badge badge-error">Hard</span>}
                  </Button>
                ))}
              </div>
            )}

            <Textarea
              label="Qualifications"
              placeholder="Describe your qualifications..."
              value={qualifications}
              onChange={(event) => setQualifications(event.target.value)}
              rows={4}
            />

            <Textarea
              label="Teaching Experience"
              placeholder="Describe your teaching experience..."
              value={experience}
              onChange={(event) => setExperience(event.target.value)}
              rows={4}
            />

            <div style={{ marginTop: 'var(--space-8)', textAlign: 'right' }}>
              <Button onClick={handleSubmit} loading={submitting} disabled={selectedTopics.length === 0} icon="paper-plane">
                Submit Application
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 
