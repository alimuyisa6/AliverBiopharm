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
import { useLayout } from '../contexts/LayoutContext';

export default function ClassroomRoom() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { displayName, class_name } = useLevelFilter();
  const { bootstrap } = useLayout();
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

  function getEmptyStateImage(key) {
    const uiComponents = bootstrap?.ui_components || [];
    const comp = uiComponents.find(c => c.component_key === `empty_state_${key}`);
    return comp?.properties?.image_url || null;
  }

  if (loading) {
    return (
      <div className="fcd-loading-wrap">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="section quiz-blocks-page">
        <EmptyState
          image={getEmptyStateImage('classrooms')}
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
      <div className="classroom-room-header">
        <Button variant="ghost" size="sm" icon onClick={handleLeaveRoom}>
          <Icon name="arrow-left" />
        </Button>
        <div className="classroom-room-header-info">
          <h2 className="classroom-room-header-title">{room.title}</h2>
          <div className="classroom-room-header-chips">
            {room.topic_name && <span className="chip classroom-chip-topic">{room.topic_name}</span>}
            {roomClass && <span className="chip classroom-chip-class">{roomClass}</span>}
            {levelName && <span className="chip classroom-chip-level-alt">{levelName}</span>}
          </div>
        </div>
        <div className="classroom-room-live-indicator">
          <span className="status-dot status-dot-success" />
          <span className="classroom-room-live-label">Live</span>
        </div>
      </div>

      <div className="classroom-room-layout">
        <div className="classroom-chat-column">
          <div className="classroom-chat-body" ref={chatBodyRef}>
            {messages.map(msg => (
              <div key={msg.id} className="classroom-message">
                {msg.message_type === 'system' ? (
                  <div className="classroom-message-system">
                    <Icon name="circle-info" />
                    {msg.content}
                  </div>
                ) : msg.message_type === 'resource' ? (
                  <div className="card classroom-message-resource">
                    <div className="classroom-message-resource-header">
                      <strong>{msg.sender_name || 'Tutor'}</strong>
                      <span className="classroom-message-resource-time">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="classroom-message-resource-file">
                      <Icon name="file-pdf" />
                      <a href={msg.file_url} target="_blank" rel="noreferrer" download={msg.file_name}>
                        {msg.file_name}
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className={`classroom-message-row${msg.user_id === user?.id ? ' is-own' : ''}`}>
                    <div className="classroom-message-bubble">
                      <div className="classroom-message-bubble-header">
                        {msg.sender_name || 'User'}
                        <span className="classroom-message-bubble-time">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="classroom-message-bubble-text">{msg.content}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="classroom-chat-input-row">
            <textarea
              className="form-textarea classroom-chat-textarea"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              rows={1}
              maxLength={1000}
            />
            <Button onClick={handleSendMessage} disabled={!chatInput.trim()} icon>
              <Icon name="paper-plane" />
            </Button>
          </div>
        </div>

        <div className="classroom-sidebar">
          <h4 className="classroom-participants-heading">
            <Icon name="users" />
            Participants ({participants.length})
          </h4>
          <div className="classroom-participants-list">
            {participants.map(p => (
              <div key={p.id || p.user_id} className="classroom-participant-row">
                <Icon
                  name={p.role === 'tutor' ? 'user-graduate' : p.role === 'admin' ? 'shield-halved' : 'user'}
                  className="classroom-participant-role-icon"
                />
                <div>
                  <div className="classroom-participant-name">{p.user_name || 'User'}</div>
                  <div className="classroom-participant-role">{p.role}</div>
                </div>
                {p.is_muted && <Icon name="microphone-slash" className="classroom-participant-status-icon icon-muted" />}
                {p.hand_raised && <Icon name="hand" className="classroom-participant-status-icon icon-handraised" />}
              </div>
            ))}
          </div>

          <h4 className="classroom-roominfo-heading">
            <Icon name="circle-info" />
            Room Info
          </h4>
          <div className="classroom-room-info-list">
            {room.level && <p><strong>Level:</strong> {room.level}</p>}
            {roomClass && <p><strong>Class:</strong> {roomClass}</p>}
            {room.topic_name && <p><strong>Topic:</strong> {room.topic_name}</p>}
            <p><strong>Type:</strong> {room.room_type === 'free' ? 'Free Discussion' : room.room_type === 'hard_topic' ? 'Hard Topic' : 'Premium'}</p>
            {room.tutor_name && <p><strong>Tutor:</strong> {room.tutor_name}</p>}
          </div>
        </div>
      </div>

      <div className="classroom-room-footer">
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
