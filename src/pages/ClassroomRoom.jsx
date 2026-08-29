// pages/ClassroomRoom.jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLevelFilter } from '../hooks/useLevelFilter';
import {
  joinClassroom,
  leaveClassroom,
  getClassroomRoom,
  getClassroomMessages,
  getClassroomParticipants,
  sendClassroomMessage,
  raiseHand
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
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isWhiteboardVisible, setIsWhiteboardVisible] = useState(true);
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

  async function doJoinRoom() {
    try {
      await joinClassroom(roomId);
    } catch {}
  }

  async function leaveRoomSilent() {
    try {
      await leaveClassroom(roomId);
    } catch {}
  }

  async function fetchRoom() {
    try {
      const data = await getClassroomRoom(roomId);
      setRoom(data);
      setLoading(false);
    } catch {
      setError('Failed to load room');
      setLoading(false);
    }
  }

  async function fetchMessages() {
    try {
      const data = await getClassroomMessages(roomId);
      setMessages(data || []);
    } catch {}
  }

  async function fetchParticipants() {
    try {
      const data = await getClassroomParticipants(roomId);
      setParticipants(data || []);
    } catch {}
  }

  async function handleSendMessage() {
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput('');
    try {
      await sendClassroomMessage(roomId, text);
      fetchMessages();
    } catch {}
  }

  async function handleRaiseHand() {
    try {
      await raiseHand(roomId, !handRaised);
      setHandRaised((value) => !value);
    } catch {}
  }

  async function handleLeaveRoom() {
    try {
      await leaveClassroom(roomId);
    } catch {
    } finally {
      navigate('/classroom');
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  }

  function getEmptyStateImage(key) {
    const uiComponents = bootstrap?.ui_components || [];
    const component = uiComponents.find((item) => item.component_key === `empty_state_${key}`);
    return component?.properties?.image_url || null;
  }

  function toggleMute() {
    setIsMuted(!isMuted);
    // In real app, would call API to toggle audio
  }

  function toggleVideo() {
    setIsVideoOn(!isVideoOn);
    // In real app, would call API to toggle video
  }

  function toggleScreenShare() {
    setIsScreenSharing(!isScreenSharing);
    // In real app, would call API to toggle screen share
  }

  function toggleWhiteboard() {
    setIsWhiteboardVisible(!isWhiteboardVisible);
  }

  function muteAll() {
    // In real app, would call API to mute all participants
    setParticipants(participants.map(p => ({ ...p, is_muted: true })));
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
      <div className="section classroom-room-error">
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
          <h2 className="classroom-room-header-title">
            {room.title}<br />
            <span className="classroom-room-header-sub">
              {room.topic_name && <span className="chip classroom-chip-topic">{room.topic_name}</span>}
              {roomClass && <span className="chip classroom-chip-class">{roomClass}</span>}
              {levelName && <span className="chip classroom-chip-level-alt">{levelName}</span>}
            </span>
          </h2>
        </div>

        <div className="classroom-room-header-actions">
          <span className="recording-badge"><span className="rec-dot"></span> Recording</span>
          <div className="classroom-room-live-indicator">
            <span className="status-dot status-dot-success" />
            <span className="classroom-room-live-label">Live</span>
          </div>
        </div>
      </div>

      <div className="classroom-room-layout">
        <div className="classroom-room-left">
          <div className="classroom-video-grid">
            {participants.map((participant) => (
              <div
                key={participant.id || participant.user_id}
                className={`video-tile ${participant.is_speaking ? 'speaking' : ''} ${participant.user_id === user?.id ? 'self' : ''}`}
              >
                {participant.role === 'tutor' && <span className="tile-badge tutor">Tutor</span>}
                {participant.role === 'admin' && <span className="tile-badge admin">Admin</span>}
                <i className={`avatar fa-solid ${participant.role === 'tutor' ? 'fa-user-graduate' : participant.role === 'admin' ? 'fa-user-tie' : 'fa-user'}`}></i>
                <span className="name">{participant.user_name || 'User'}{participant.user_id === user?.id ? ' (you)' : ''}</span>
                {participant.is_muted && <i className="tile-status muted fa-solid fa-microphone-slash"></i>}
                {participant.hand_raised && <i className="tile-status hand fa-solid fa-hand"></i>}
                {participant.is_screen_sharing && <i className="tile-status screen fa-solid fa-desktop"></i>}
              </div>
            ))}
          </div>

          <div className="classroom-video-controls">
            <Button variant={isMuted ? 'ghost' : 'primary'} size="sm" onClick={toggleMute}>
              <Icon name={isMuted ? 'microphone-slash' : 'microphone'} />
              {isMuted ? 'Unmute' : 'Mute'}
            </Button>
            <Button variant={isVideoOn ? 'ghost' : 'primary'} size="sm" onClick={toggleVideo}>
              <Icon name={isVideoOn ? 'video' : 'video-slash'} />
              {isVideoOn ? 'Camera' : 'Camera Off'}
            </Button>
            <Button variant={isScreenSharing ? 'primary' : 'ghost'} size="sm" onClick={toggleScreenShare}>
              <Icon name="desktop" />
              {isScreenSharing ? 'Stop Share' : 'Share'}
            </Button>
            <Button variant={handRaised ? 'warm' : 'secondary'} size="sm" onClick={handleRaiseHand}>
              <Icon name="hand" />
              {handRaised ? 'Hand Raised' : 'Raise Hand'}
            </Button>
            <Button variant="secondary" size="sm" onClick={toggleWhiteboard}>
              <Icon name="pencil" />
              {isWhiteboardVisible ? 'Board' : 'Show Board'}
            </Button>
          </div>

          {isWhiteboardVisible && (
            <div className="classroom-whiteboard">
              <div className="whiteboard-toolbar">
                <Button variant="secondary" size="xs"><Icon name="pencil" /> Pen</Button>
                <Button variant="secondary" size="xs"><Icon name="eraser" /> Eraser</Button>
                <Button variant="secondary" size="xs"><Icon name="shapes" /> Shape</Button>
                <Button variant="secondary" size="xs"><Icon name="palette" /> Color</Button>
                <Button variant="secondary" size="xs"><Icon name="undo" /></Button>
                <Button variant="secondary" size="xs"><Icon name="redo" /></Button>
                <Button variant="secondary" size="xs"><Icon name="trash" /> Clear</Button>
                <span className="whiteboard-label">Collaborative Whiteboard</span>
              </div>
              <div className="whiteboard-canvas">
                <Icon name="pen-fancy" />
                <span>Draw here — everyone sees it live</span>
              </div>
            </div>
          )}
        </div>

        <div className="classroom-room-right">
          <div className="classroom-chat-panel">
            <div className="chat-panel-header">
              <h4><Icon name="comment-dots" /> Live Chat</h4>
              <div className="chat-actions">
                <Button variant="ghost" size="xs"><Icon name="smile" /></Button>
                <Button variant="ghost" size="xs"><Icon name="ellipsis-vertical" /></Button>
              </div>
            </div>
            <div className="classroom-chat-body" ref={chatBodyRef}>
              {messages.map((message) => (
                <div key={message.id} className="classroom-message">
                  {message.message_type === 'system' ? (
                    <div className="classroom-message-system">
                      <Icon name="circle-info" />
                      {message.content}
                    </div>
                  ) : message.message_type === 'resource' ? (
                    <div className="card classroom-message-resource">
                      <div className="classroom-message-resource-header">
                        <strong>{message.sender_name || 'Tutor'}</strong>
                        <span className="classroom-message-resource-time">
                          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="classroom-message-resource-file">
                        <Icon name="file-pdf" />
                        <a href={message.file_url} target="_blank" rel="noreferrer" download={message.file_name}>
                          {message.file_name}
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className={`classroom-message-row${message.user_id === user?.id ? ' is-own' : ''}`}>
                      <div className="classroom-message-bubble">
                        <div className="classroom-message-bubble-header">
                          {message.sender_name || 'User'}
                          <span className="classroom-message-bubble-time">
                            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="classroom-message-bubble-text">{message.content}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="classroom-chat-input-row">
              <button className="btn-emoji" onClick={() => {
                const emojis = ['👍', '❤️', '😂', '😮', '🎉', '🙌', '👏', '💯'];
                const pick = emojis[Math.floor(Math.random() * emojis.length)];
                setChatInput(chatInput + pick);
              }}>😊</button>
              <textarea
                className="form-textarea classroom-chat-textarea"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                maxLength={1000}
              />
              <Button onClick={handleSendMessage} disabled={!chatInput.trim()} icon>
                <Icon name="paper-plane" />
              </Button>
            </div>
          </div>

          <div className="classroom-participants-panel">
            <div className="participants-panel-header">
              <h4><Icon name="users" /> Participants ({participants.length})</h4>
              <Button variant="secondary" size="xs" onClick={muteAll}>
                <Icon name="microphone-slash" /> Mute all
              </Button>
            </div>
            <div className="classroom-participants-list">
              {participants.map((participant) => (
                <div key={participant.id || participant.user_id} className="classroom-participant-row">
                  <Icon
                    name={participant.role === 'tutor' ? 'user-graduate' : participant.role === 'admin' ? 'shield-halved' : 'user'}
                    className={`classroom-participant-role-icon ${participant.role === 'tutor' ? 'tutor' : participant.role === 'admin' ? 'admin' : ''}`}
                  />
                  <div>
                    <div className="classroom-participant-name">{participant.user_name || 'User'}</div>
                    <div className="classroom-participant-role">{participant.role}</div>
                  </div>
                  {participant.is_muted && <Icon name="microphone-slash" className="classroom-participant-status-icon icon-muted" />}
                  {participant.hand_raised && <Icon name="hand" className="classroom-participant-status-icon icon-handraised" />}
                  {participant.is_screen_sharing && <Icon name="desktop" className="classroom-participant-status-icon icon-screen" />}
                </div>
              ))}
            </div>
          </div>

          <div className="classroom-room-info-panel">
            <h4><Icon name="circle-info" /> Session Info</h4>
            <div className="classroom-room-info-grid">
              {room.level && <div className="info-item"><strong>Level</strong> {room.level}</div>}
              {roomClass && <div className="info-item"><strong>Class</strong> {roomClass}</div>}
              {room.topic_name && <div className="info-item"><strong>Topic</strong> {room.topic_name}</div>}
              <div className="info-item"><strong>Type</strong> {room.room_type === 'free' ? 'Free Discussion' : room.room_type === 'hard_topic' ? 'Hard Topic' : 'Premium'}</div>
              {room.tutor_name && <div className="info-item"><strong>Tutor</strong> {room.tutor_name}</div>}
              <div className="info-item"><strong>Status</strong> {room.status === 'live' ? '● Live' : room.status}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="classroom-room-footer">
        <Button variant="danger" size="sm" onClick={handleLeaveRoom}>
          <Icon name="right-from-bracket" /> Leave
        </Button>
        <Button variant="secondary" size="sm">
          <Icon name="file-export" /> Export notes
        </Button>
        <Button variant="secondary" size="sm">
          <Icon name="flag" /> Report
        </Button>
      </div>
    </div>
  );
}
