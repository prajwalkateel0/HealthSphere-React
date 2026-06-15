import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

let socket;

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function DoctorMessages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [typing, setTyping] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef(null);

  const loadConversations = () => {
    api.get('/messages/conversations').then(r => setConversations(r.data));
  };

  useEffect(() => {
    loadConversations();

    socket = io('http://localhost:5002');
    socket.emit('join', String(user.id));

    socket.on('new-message', (msg) => {
      if (String(msg.senderId) === String(activeUser?.id)) {
        setMessages(prev => [...prev, msg]);
      }
      loadConversations();
    });

    socket.on('typing', ({ from }) => {
      if (String(from) === String(activeUser?.id)) {
        setTyping(true);
        setTimeout(() => setTyping(false), 2000);
      }
    });

    return () => socket?.disconnect();
  }, []);

  useEffect(() => {
    if (activeUser) {
      api.get(`/messages/${activeUser.id}`).then(r => setMessages(r.data));
    }
  }, [activeUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() || !activeUser) return;
    const { data: msg } = await api.post('/messages', {
      receiver_id: activeUser.id, content: newMsg, is_emergency: isEmergency,
    });
    setMessages(prev => [...prev, msg]);
    socket.emit('send-message', msg);
    setNewMsg('');
    setIsEmergency(false);
    loadConversations();
  };

  const handleTyping = () => {
    socket?.emit('typing', { to: String(activeUser?.id) });
  };

  const initials = (name) => name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const filteredConversations = conversations.filter(c =>
    !search.trim() || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.nhsId?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="chat-container card">
      {/* Conversations list */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <input
            className="form-control chat-search"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="chat-conv-list">
          {filteredConversations.map(c => (
            <div key={c.id} className={`conversation-item${activeUser?.id === c.id ? ' active' : ''}`}
              onClick={() => setActiveUser(c)}>
              <div className="user-avatar chat-avatar">{initials(c.name)}</div>
              <div className="conversation-info">
                <div className="conversation-name">{c.name}</div>
                {c.is_emergency && (
                  <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 700 }}>
                    <i className="fas fa-exclamation-triangle" /> Emergency
                  </div>
                )}
                <div className="conversation-preview">
                  {c.last_message ? (c.last_message.length > 45 ? c.last_message.slice(0, 45) + '...' : c.last_message) : 'No messages yet'}
                </div>
              </div>
              <div className="conversation-meta">
                {c.last_message_time && <span className="conversation-time">{timeAgo(c.last_message_time)}</span>}
                {c.unread_count > 0 && <span className="unread-badge">{c.unread_count}</span>}
              </div>
            </div>
          ))}
          {!filteredConversations.length && (
            <div className="empty-state"><div className="empty-icon">💬</div><p>No conversations yet</p></div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="chat-main">
        {activeUser ? (
          <>
            <div className="chat-header">
              <div className="user-avatar chat-avatar">{initials(activeUser.name)}</div>
              <div className="chat-header-info">
                <div className="chat-header-name">{activeUser.name}</div>
                <div className="chat-header-meta">Patient · NHS: {activeUser.nhsId || '—'}</div>
              </div>
              <a href="/doctor/patients" className="btn btn-sm btn-primary"><i className="fas fa-folder-open" /> Open Record</a>
            </div>

            <div className="chat-messages">
              {!messages.length && (
                <div className="empty-state">
                  <div className="empty-icon">💬</div>
                  <p>Start conversation with {activeUser.name}</p>
                </div>
              )}
              {messages.map(m => {
                const isSent = String(m.senderId) === String(user.id);
                return (
                  <div key={m.id} className={`message-bubble ${isSent ? 'sent' : 'received'}${m.isEmergency ? ' emergency' : ''}`}>
                    {!isSent && <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 2 }}>{m.sender_name}</div>}
                    {m.isEmergency && <div className="emergency-tag">🚨 EMERGENCY</div>}
                    {m.content}
                    <div className="message-time">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })}
              {typing && (
                <div className="message-bubble received typing-bubble">
                  <span className="typing-dots"><span></span><span></span><span></span></span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={send} className="chat-input-area">
              <button type="button" className={`emergency-toggle ${isEmergency ? 'active' : ''}`}
                onClick={() => setIsEmergency(!isEmergency)} title="Mark as emergency">
                🚨
              </button>
              <input className="form-control chat-text-input" placeholder="Type your response..."
                value={newMsg} onChange={e => setNewMsg(e.target.value)}
                onKeyDown={handleTyping} autoComplete="off" />
              <button type="submit" className="chat-send-btn" disabled={!newMsg.trim()}><i className="fas fa-paper-plane" /></button>
            </form>
            <div className="chat-footer-note"><i className="fas fa-lock" /> Encrypted · All messages are audit-logged</div>
          </>
        ) : (
          <div className="flex-center" style={{ flex: 1, flexDirection: 'column', gap: 12, color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 48 }}>💬</span>
            <p>Select a conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}
