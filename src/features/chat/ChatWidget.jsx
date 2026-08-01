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
    <div className="chat-widget">
      <button
        className="btn btn-primary btn-icon btn-lg chat-toggle-btn"
        onClick={onToggle}
        aria-label={chatOpen ? 'Close support chat' : 'Open support chat'}
        aria-expanded={chatOpen}
      >
        <Icon name={chatOpen ? 'xmark' : 'message'} />
      </button>

      {chatOpen && (
        <div className="chat-panel" role="dialog" aria-label="Support chat">
          <div className="chat-panel-header">
            <div className="chat-panel-header-info">
              <span className="chat-panel-header-avatar">
                <Icon name="headset" />
              </span>
              <div>
                <div className="chat-panel-title">Support</div>
                <div className="chat-panel-status">
                  <span className={`status-dot ${adminOnline ? 'status-dot-success' : 'status-dot-error'}`} />
                  {adminOnline ? 'We usually reply within minutes' : 'Currently offline — leave a message'}
                </div>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={onToggle} aria-label="Close chat">
              <Icon name="xmark" />
            </button>
          </div>

          <div ref={chatBodyRef} className="chat-body">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-message-row${msg.sender_type === 'user' ? ' is-own' : ''}`}
              >
                <div className="chat-message-bubble">
                  <div className="chat-message-sender">
                    {msg.sender_type === 'user' ? 'You' : 'Support Team'}
                  </div>
                  <div className="chat-message-content">{msg.content}</div>
                  {msg.sender_type === 'user' && (
                    <button
                      className="btn btn-ghost btn-sm chat-message-delete"
                      onClick={() => onDeleteMsg(msg.id)}
                      aria-label="Delete message"
                    >
                      <Icon name="trash" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="chat-input-row">
            <textarea
              className="form-textarea chat-textarea"
              placeholder="Type your message..."
              value={chatInput}
              onChange={handleInput}
              onKeyDown={handleKeyPress}
              rows={1}
              maxLength={500}
              aria-label="Message"
            />
            <button
              className="btn btn-primary chat-send-btn"
              onClick={onSend}
              disabled={!chatInput.trim()}
              aria-label="Send message"
            >
              <Icon name="paper-plane" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
