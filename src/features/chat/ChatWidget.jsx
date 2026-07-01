// features/chat/ChatWidget.jsx
import React from 'react';

export function ChatWidget({ chatOpen, chatMessages, chatInput, adminOnline, onToggle, onSend, onInputChange, onDeleteMsg, chatBodyRef }) {
  const safeMessages = chatMessages || [];

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (chatInput.trim()) onSend();
    }
  };

  const handleInputChange = (e) => {
    onInputChange(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  };

  return (
    <div className="chat-widget-container">
      <button className="chat-bubble-btn" onClick={onToggle} aria-label="Open support chat">
        <i className="fa-solid fa-message chat-bubble-icon"></i>
      </button>
      {chatOpen && (
        <div className="chat-window open">
          <div className="chat-header">
            <div className="chat-header-left">
              <div className="chat-avatar"><i className="fa-solid fa-headset"></i></div>
              <div className="chat-header-info">
                <span className="chat-header-name">Support</span>
                <span className="chat-header-status">
                  <span className={`admin-dot ${adminOnline ? 'online' : 'offline'}`}></span>
                  {adminOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
            <button className="chat-close-btn" onClick={onToggle} aria-label="Close chat">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div className="chat-body" ref={chatBodyRef}>
            {safeMessages.filter(Boolean).map(msg => (
              <div key={msg.id} className={`chat-msg ${msg.sender_type === 'user' ? 'user' : 'admin'}`}>
                <span className="chat-msg-sender">{msg.sender_type === 'user' ? 'You' : 'Admin'}:</span> {msg.content}
                {msg.sender_type === 'user' && (
                  <button className="chat-clear-btn" onClick={() => onDeleteMsg(msg.id)} aria-label="Delete message">
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="chat-input-area">
            <div className="chat-input-wrapper">
              <textarea
                className="chat-input"
                placeholder="Type a message..."
                value={chatInput}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                rows="1"
                maxLength="500"
              />
            </div>
            <button className="chat-send-btn" onClick={onSend} disabled={!chatInput.trim()} aria-label="Send message">
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
