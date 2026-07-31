 /* features/chat/ChatWidget.jsx */
import { useRef, useEffect } from 'react';
import Icon from '../../components/Icon/Icon';

export function ChatWidget({ chatOpen, chatMessages = [], chatInput, adminOnline, onToggle, onSend, onInputChange, onDeleteMsg, chatBodyRef }) {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (chatInput.trim()) onSend();
    }
  };

  const handleInput = (e) => {
    onInputChange(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  };

  return (
    <div style={{ position: 'fixed', bottom: 'var(--space-6)', right: 'var(--space-6)', zIndex: 'var(--z-dropdown)' }}>
      <button className="btn btn-primary btn-icon btn-lg" onClick={onToggle} aria-label="Chat" style={{ borderRadius: '50%', width: 52, height: 52 }}>
        <Icon name={chatOpen ? 'xmark' : 'message'} />
      </button>
      {chatOpen && (
        <div style={{ position: 'absolute', bottom: 64, right: 0, width: 340, background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4)', borderBottom: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <Icon name="headset" style={{ color: 'var(--primary)' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Support</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
                  <span className={`status-dot ${adminOnline ? 'status-dot-success' : 'status-dot-error'}`} />
                  {adminOnline ? 'Online' : 'Offline'}
                </div>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={onToggle}><Icon name="xmark" /></button>
          </div>
          <div ref={chatBodyRef} style={{ height: 300, overflowY: 'auto', padding: 'var(--space-4)' }}>
            {chatMessages.map((msg) => (
              <div key={msg.id} style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: msg.sender_type === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '80%', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)', background: msg.sender_type === 'user' ? 'var(--primary-light)' : 'var(--bg-card-hover)', fontSize: 'var(--text-sm)' }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)', marginBottom: 'var(--space-1)' }}>
                    {msg.sender_type === 'user' ? 'You' : 'Admin'}
                  </div>
                  <div>{msg.content}</div>
                  {msg.sender_type === 'user' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => onDeleteMsg(msg.id)} style={{ marginTop: 'var(--space-1)', padding: 0 }}>
                      <Icon name="trash" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3)', borderTop: '1px solid var(--border-default)' }}>
            <textarea
              className="form-textarea"
              placeholder="Type a message..."
              value={chatInput}
              onChange={handleInput}
              onKeyDown={handleKeyPress}
              rows={1}
              maxLength={500}
              style={{ minHeight: 40, flex: 1 }}
            />
            <button className="btn btn-primary btn-icon btn-sm" onClick={onSend} disabled={!chatInput.trim()}>
              <Icon name="paper-plane" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
