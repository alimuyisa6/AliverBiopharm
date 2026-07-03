 // pages/ClassroomRoom.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAllSiteSections } from '../api/client';

export default function ClassroomRoom() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const chatBodyRef = useRef(null);
  const [sections, setSections] = useState(null);
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isMuted, setIsMuted] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAllSiteSections().then(setSections).catch(() => {});
    joinRoom();
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

  const joinRoom = async () => {
    try {
      await fetch(`/api/server?module=classroom&path=join`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId }),
      });
    } catch {}
  };

  const leaveRoomSilent = async () => {
    try {
      await fetch(`/api/server?module=classroom&path=leave`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId }),
      });
    } catch {}
  };

  const fetchRoom = async () => {
    try {
      const res = await fetch(`/api/server?module=classroom&path=room&room_id=${roomId}`, { credentials: 'include' });
      const data = await res.json();
      setRoom(data.data || data);
      setLoading(false);
    } catch {
      setError('Failed to load room');
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/server?module=classroom&path=messages&room_id=${roomId}`, { credentials: 'include' });
      const data = await res.json();
      setMessages(data.data || data || []);
    } catch {}
  };

  const fetchParticipants = async () => {
    try {
      const res = await fetch(`/api/server?module=classroom&path=participants&room_id=${roomId}`, { credentials: 'include' });
      const data = await res.json();
      setParticipants(data.data || data || []);
    } catch {}
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    try {
      await fetch(`/api/server?module=classroom&path=send_message`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId, message: chatInput.trim() }),
      });
      setChatInput('');
      fetchMessages();
    } catch {}
  };

  const handleRaiseHand = async () => {
    try {
      await fetch(`/api/server?module=classroom&path=raise_hand`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId, raise: !handRaised }),
      });
      setHandRaised(!handRaised);
    } catch {}
  };

  const handleLeaveRoom = async () => {
    try {
      await fetch(`/api/server?module=classroom&path=leave`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId }),
      });
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
      <div className="classroom-loading">
        <i className="fa-solid fa-spinner fa-spin"></i>
        <p>Entering classroom...</p>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="classroom-error">
        <i className="fa-solid fa-triangle-exclamation"></i>
        <p>{error || 'Room not found'}</p>
        <button className="btn-secondary" onClick={() => navigate('/classroom')}>Back to Classrooms</button>
      </div>
    );
  }

  return (
    <div className="classroom-room">
      <div className="room-topbar">
        <button className="room-back-btn" onClick={handleLeaveRoom}>
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <div className="room-info">
          <h2>{room.title}</h2>
          <span className="room-topic-badge">{room.topic_name}</span>
          <span className="room-class-badge">{room.class_name}</span>
        </div>
        <div className="room-status-indicator">
          <span className="status-dot live"></span>
          Live
        </div>
      </div>

      <div className="room-main">
        <div className="room-chat-section">
          <div className="room-chat-header">
            <span>Discussion</span>
            <span className="msg-count">{messages.length} messages</span>
          </div>
          <div className="room-chat-body" ref={chatBodyRef}>
            {messages.map(msg => (
              <div key={msg.id} className={`room-message ${msg.user_id === user?.id ? 'own' : ''} ${msg.message_type}`}>
                {msg.message_type === 'system' ? (
                  <div className="system-message">
                    <i className="fa-solid fa-circle-info"></i> {msg.content}
                  </div>
                ) : msg.message_type === 'resource' ? (
                  <div className="resource-message">
                    <div className="resource-header">
                      <strong>{msg.sender_name || 'Tutor'}</strong>
                      <span className="msg-time">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="resource-content">
                      <i className="fa-solid fa-file"></i>
                      <a href={msg.file_url} target="_blank" rel="noreferrer" download={msg.file_name}>
                        {msg.file_name}
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="chat-message">
                    <div className="msg-header">
                      <strong>{msg.sender_name || 'User'}</strong>
                      <span className="msg-time">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="msg-content">{msg.content}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="room-chat-input">
            <textarea
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              rows="1"
              maxLength="1000"
            />
            <button className="btn-send" onClick={handleSendMessage} disabled={!chatInput.trim()}>
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>

        <div className="room-sidebar">
          <div className="sidebar-section">
            <h4><i className="fa-solid fa-users"></i> Participants ({participants.length})</h4>
            <div className="participants-list">
              {participants.map(p => (
                <div key={p.id || p.user_id} className={`participant ${p.role}`}>
                  <div className="participant-avatar">
                    <i className={`fa-solid ${p.role === 'tutor' ? 'fa-chalkboard-user' : p.role === 'admin' ? 'fa-shield-halved' : 'fa-user'}`}></i>
                  </div>
                  <div className="participant-info">
                    <span className="participant-name">{p.user_name || 'User'}</span>
                    <span className="participant-role">{p.role}</span>
                  </div>
                  {p.is_muted && <i className="fa-solid fa-microphone-slash muted-icon"></i>}
                  {p.hand_raised && <i className="fa-solid fa-hand raised-icon"></i>}
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <h4><i className="fa-solid fa-circle-info"></i> Room Info</h4>
            <div className="room-details">
              <p><strong>Level:</strong> {room.level}</p>
              <p><strong>Class:</strong> {room.class_name}</p>
              <p><strong>Topic:</strong> {room.topic_name}</p>
              <p><strong>Type:</strong> {room.room_type === 'free' ? 'Free Discussion' : room.room_type === 'hard_topic' ? 'Hard Topic' : 'Premium'}</p>
              {room.tutor_name && <p><strong>Tutor:</strong> {room.tutor_name}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="room-controls">
        <div className="controls-left">
          <button
            className={`control-btn ${isMuted ? 'muted' : 'unmuted'}`}
            disabled
            title="Mute controlled by tutor"
          >
            <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
            {isMuted ? 'Muted' : 'Unmuted'}
          </button>
        </div>
        <div className="controls-center">
          <button
            className={`control-btn raise-hand ${handRaised ? 'active' : ''}`}
            onClick={handleRaiseHand}
          >
            <i className="fa-solid fa-hand"></i>
            {handRaised ? 'Hand Raised' : 'Raise Hand'}
          </button>
        </div>
        <div className="controls-right">
          <button className="control-btn leave" onClick={handleLeaveRoom}>
            <i className="fa-solid fa-right-from-bracket"></i>
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
