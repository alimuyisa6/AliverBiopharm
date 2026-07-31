 /* pages/ClassroomRoom.jsx */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLevelFilter } from '../hooks/useLevelFilter';
import {
  joinClassroom, leaveClassroom, getClassroomRoom,
  getClassroomMessages, getClassroomParticipants,
  sendClassroomMessage, raiseHand,
} from '../api/client';
import Icon from '../components/Icon/Icon';
import Spinner from '../components/Spinner/Spinner';
import Button from '../components/Button/Button';
import EmptyState from '../components/EmptyState/EmptyState';

export default function ClassroomRoom() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { displayName, class_name } = useLevelFilter();
  const chatBodyRef = useRef(null);

  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isMuted, setIsMuted] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    doJoinRoom();
    fetchRoom();
    fetchMessages();
    fetchParticipants();

    const msgInterval = setInterval(fetchMessages, 3000);
    const partInterval = setInterval(fetchParticipants, 10000);

    return () => {
      clearInterval(msgInterval);
      clearInterval(partInterval);
      leaveRoomSilent();
    };
  }, [roomId]);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages]);

  const doJoinRoom = async () => {
    try { await joinClassroom(roomId); } catch {}
  };

  const leaveRoomSilent = async () => {
    try { await leaveClassroom(roomId); } catch {}
  };

  const fetchRoom = async () => {
    try {
      const data = await getClassroomRoom(roomId);
      setRoom(data);
      setLoading(false);
    } catch {
      setError('Failed to load room');
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const data = await getClassroomMessages(roomId);
      setMessages(data || []);
    } catch {}
  };

  const fetchParticipants = async () => {
    try {
      const data = await getClassroomParticipants(roomId);
      setParticipants(data || []);
    } catch {}
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput('');
    try {
      await sendClassroomMessage(roomId, text);
      fetchMessages();
    } catch {}
  };

  const handleRaiseHand = async () => {
    try {
      await raiseHand(roomId, !handRaised);
      setHandRaised(!handRaised);
    } catch {}
  };

  const handleLeaveRoom = async () => {
    try {
      await leaveClassroom(roomId);
      navigate('/classroom');
    } catch {
      navigate('/classroom');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (loading) {
    return (
      <div className="section" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="section" style={{ textAlign: 'center', paddingTop: 'var(--space-16)' }}>
        <EmptyState
          icon="exclamation-triangle"
          title="Room Not Found"
          description={error || 'The classroom does not exist or has ended.'}
          action={
            <Button onClick={() => navigate('/classroom')}>
              <Icon name="arrow-left" /> Back to Classrooms
            </Button>
          }
        />
      </div>
    );
  }

  const levelName = displayName || room.level || '';
  const roomClass = room.class_name || class_name || '';

  return (
    <div className="classroom-room-page">
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-default)', padding: 'var(--space-4) var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <Button variant="ghost" size="sm" icon onClick={handleLeaveRoom}>
          <Icon name="arrow-left" />
        </Button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-1)' }}>{room.title}</h2>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            {room.topic_name && <span className="chip" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>{room.topic_name}</span>}
            {roomClass && <span className="chip" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>{roomClass}</span>}
            {levelName && <span className="chip" style={{ background: 'var(--secondary-light)', color: 'var(--secondary)' }}>{levelName}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span className="status-dot status-dot-success" />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Live</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', height: 'calc(100vh - 140px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }} ref={chatBodyRef}>
            {messages.map(msg => (
              <div key={msg.id} style={{ marginBottom: 'var(--space-3)' }}>
                {msg.message_type === 'system' ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>
                    <Icon name="circle-info" style={{ marginRight: 'var(--space-2)' }} />
                    {msg.content}
                  </div>
                ) : msg.message_type === 'resource' ? (
                  <div className="card" style={{ padding: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                      <strong>{msg.sender_name || 'Tutor'}</strong>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <Icon name="file-pdf" style={{ color: 'var(--error)' }} />
                      <a href={msg.file_url} target="_blank" rel="noreferrer" download={msg.file_name}>
                        {msg.file_name}
                      </a>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: msg.user_id === user?.id ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '70%', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)', background: msg.user_id === user?.id ? 'var(--primary-light)' : 'var(--bg-card-hover)' }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)', marginBottom: 'var(--space-1)' }}>
                        {msg.sender_name || 'User'}
                        <span style={{ marginLeft: 'var(--space-3)', fontWeight: 400, color: 'var(--text-muted)' }}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p style={{ fontSize: 'var(--text-sm)' }}>{msg.content}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--border-default)', padding: 'var(--space-3)', display: 'flex', gap: 'var(--space-3)' }}>
            <textarea
              className="form-textarea"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              rows={1}
              maxLength={1000}
              style={{ minHeight: 40 }}
            />
            <Button onClick={handleSendMessage} disabled={!chatInput.trim()} icon>
              <Icon name="paper-plane" />
            </Button>
          </div>
        </div>

        <div style={{ borderLeft: '1px solid var(--border-default)', padding: 'var(--space-4)', overflowY: 'auto' }}>
          <h4 style={{ marginBottom: 'var(--space-4)' }}>
            <Icon name="users" style={{ marginRight: 'var(--space-3)', color: 'var(--accent)' }} />
            Participants ({participants.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {participants.map(p => (
              <div key={p.id || p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <Icon name={p.role === 'tutor' ? 'user-graduate' : p.role === 'admin' ? 'shield-halved' : 'user'} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{p.user_name || 'User'}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{p.role}</div>
                </div>
                {p.is_muted && <Icon name="microphone-slash" style={{ color: 'var(--error)', marginLeft: 'auto' }} />}
                {p.hand_raised && <Icon name="hand" style={{ color: 'var(--warm)', marginLeft: 'auto' }} />}
              </div>
            ))}
          </div>

          <h4 style={{ marginTop: 'var(--space-8)', marginBottom: 'var(--space-4)' }}>
            <Icon name="circle-info" style={{ marginRight: 'var(--space-3)', color: 'var(--primary)' }} />
            Room Info
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
            {room.level && <p><strong>Level:</strong> {room.level}</p>}
            {roomClass && <p><strong>Class:</strong> {roomClass}</p>}
            {room.topic_name && <p><strong>Topic:</strong> {room.topic_name}</p>}
            <p><strong>Type:</strong> {room.room_type === 'free' ? 'Free Discussion' : room.room_type === 'hard_topic' ? 'Hard Topic' : 'Premium'}</p>
            {room.tutor_name && <p><strong>Tutor:</strong> {room.tutor_name}</p>}
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-default)', padding: 'var(--space-3) var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)' }}>
        <Button variant={isMuted ? 'ghost' : 'primary'} size="sm" disabled title="Mute controlled by tutor">
          <Icon name={isMuted ? 'microphone-slash' : 'microphone'} />
          {isMuted ? 'Muted' : 'Unmuted'}
        </Button>
        <Button variant={handRaised ? 'warm' : 'secondary'} size="sm" onClick={handleRaiseHand}>
          <Icon name="hand" />
          {handRaised ? 'Hand Raised' : 'Raise Hand'}
        </Button>
        <Button variant="danger" size="sm" onClick={handleLeaveRoom}>
          <Icon name="right-from-bracket" /> Leave
        </Button>
      </div>
    </div>
  );
}
