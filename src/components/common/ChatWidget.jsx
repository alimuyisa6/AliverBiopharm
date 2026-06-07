import { useState, useEffect, useRef } from 'react';
import useAuth from '../../hooks/useAuth';
import { apiCall } from '../../services/apiService';

function ChatWidget() {
  const { isAuthenticated, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('');
  const [adminOnline, setAdminOnline] = useState(false);
  const intervalRef = useRef(null);

  const requestChat = async () => {
    setStatus('Connecting...');
    try {
      const res = await apiCall('request_chat');
      setRoomId(res.room_id);
      if (res.status === 'active') {
        setStatus('Chat started!');
        loadMessages(res.room_id);
        startPolling(res.room_id);
      } else {
        setStatus('Waiting for an admin...');
        const wait = setInterval(async () => {
          const msgs = await apiCall('get_chat_messages', { room_id: res.room_id });
          if (msgs?.length) {
            clearInterval(wait);
            setStatus('Chat started!');
            loadMessages(res.room_id);
            startPolling(res.room_id);
          }
        }, 3000);
      }
    } catch {
      setStatus('Failed to connect.');
    }
  };

  const loadMessages = async (rid) => {
    try {
      const msgs = await apiCall('get_chat_messages', { room_id: rid });
      setMessages(msgs || []);
    } catch {}
  };

  const sendMessage = async () => {
    if (!input.trim() || !roomId) return;
    try {
      await apiCall('send_chat_message', { room_id: roomId, message: input.trim() });
      setInput('');
      loadMessages(roomId);
    } catch (e) {
      alert('Failed to send: ' + e.message);
    }
  };

  const clearMessages = async () => {
    if (!roomId) return;
    const userMessages = messages.filter(m => m.sender_type === 'user');
    for (const msg of userMessages) {
      await apiCall('delete_chat_message', { message_id: msg.id });
    }
    loadMessages(roomId);
  };

  const startPolling = (rid) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => loadMessages(rid), 3000);
  };

  useEffect(() => {
    const checkPresence = async () => {
      const data = await apiCall('check_admin_online');
      setAdminOnline(data?.online || false);
    };
    checkPresence();
    const interval = setInterval(checkPresence, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [open]);

  return (
    <div className="chat-widget-container" id="chat-widget-container" aria-label="Chat support">
      <button className="chat-bubble-btn" id="chat-bubble-btn" onClick={() => setOpen(prev => !prev)} aria-label="Open chat">💬</button>
      <div className={`chat-window ${open ? 'open' : ''}`} id="chat-window" role="dialog" aria-label="Chat window">
        <div className="chat-header">
          <span><span className={`admin-dot ${adminOnline ? 'online' : 'offline'}`}></span> Support</span>
          <button className="chat-close-btn" id="chat-close-btn" onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
        </div>
        <div className="chat-body" id="chat-body">
          {messages.length === 0 ? <div className="chat-status" id="chat-status">{status || 'Click the button to start a chat'}</div> : (
            messages.map(msg => (
              <div key={msg.id} className={`chat-msg ${msg.sender_type}`}>
                <strong>{msg.sender_type === 'user' ? 'You' : 'Admin'}:</strong> {msg.content}
                {msg.sender_type === 'user' && (
                  <button className="chat-clear-btn" onClick={() => apiCall('delete_chat_message', { message_id: msg.id }).then(() => loadMessages(roomId))} style={{ fontSize: '0.6rem', marginLeft: '4px', background: 'none', border: 'none', color: 'var(--clr-text-muted)', cursor: 'pointer' }}>✖</button>
                )}
              </div>
            ))
          )}
        </div>
        <div className="chat-input-area">
          <input type="text" className="chat-input" id="chat-input" placeholder="Type a message..." value={input} onChange={e => setInput(e.target.value)} disabled={!isAuthenticated} aria-label="Chat message input" />
          <button className="chat-send-btn" id="chat-send-btn" onClick={sendMessage} disabled={!isAuthenticated || !input.trim()}>Send</button>
          <button className="chat-clear-btn" id="chat-clear-btn" onClick={clearMessages} aria-label="Clear chat messages">Clear</button>
        </div>
      </div>
    </div>
  );
}

export default ChatWidget;
