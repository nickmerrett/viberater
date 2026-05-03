import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

function formatTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return `Yesterday ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function CaptureChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [capturedIdeas, setCapturedIdeas] = useState([]);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadHistory() {
    try {
      const data = await api.getCaptureMessages();
      setMessages(data.messages || []);
    } catch (e) {
      console.error('Failed to load capture history:', e);
    }
  }

  async function send(e) {
    e?.preventDefault();
    const content = input.trim();
    if (!content || sending) return;

    const userMsg = { id: `user-${Date.now()}`, role: 'user', content, created_at: new Date().toISOString() };
    const streamingMsg = { id: 'streaming', role: 'assistant', content: '', created_at: new Date().toISOString() };

    setMessages(prev => [...prev, userMsg, streamingMsg]);
    setInput('');
    setSending(true);

    await api.streamCaptureMessage(
      content,
      (token) => {
        setMessages(prev => prev.map(m =>
          m.id === 'streaming' ? { ...m, content: m.content + token } : m
        ));
      },
      (done) => {
        setMessages(prev => prev.map(m =>
          m.id === 'streaming'
            ? { ...m, id: done.messageId, created_at: done.created_at }
            : m
        ));
        if (done.captured?.length) {
          setCapturedIdeas(prev => [...done.captured, ...prev]);
        }
        setSending(false);
        inputRef.current?.focus();
      },
      (err) => {
        console.error('Stream error:', err);
        setMessages(prev => prev.filter(m => m.id !== 'streaming'));
        setSending(false);
      }
    );
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // Group messages by date
  const grouped = messages.reduce((acc, msg) => {
    const day = new Date(msg.created_at).toDateString();
    if (!acc[day]) acc[day] = [];
    acc[day].push(msg);
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="text-4xl mb-4">💬</div>
            <div className="text-lg font-medium text-gray-300 mb-2">What's on your mind?</div>
            <div className="text-sm text-gray-500 leading-relaxed">
              Just type — a rough thought, a half-formed idea, something you want to follow up on.
              I'll help you shape it.
            </div>
          </div>
        )}

        {Object.entries(grouped).map(([day, dayMessages]) => (
          <div key={day}>
            {/* Date separator */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-gray-500">{
                new Date(day).toDateString() === new Date().toDateString()
                  ? 'Today'
                  : new Date(day).toDateString() === new Date(Date.now() - 86400000).toDateString()
                    ? 'Yesterday'
                    : new Date(day).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
              }</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {dayMessages.map((msg, i) => {
              const isUser = msg.role === 'user';
              const showTime = i === dayMessages.length - 1 ||
                new Date(dayMessages[i + 1]?.created_at) - new Date(msg.created_at) > 300000;

              return (
                <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-1`}>
                  <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className={`
                      px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                      ${isUser
                        ? 'bg-primary/30 text-white rounded-br-sm border border-primary/30'
                        : 'glass text-gray-100 rounded-bl-sm border border-white/10'
                      }
                    `}>
                      {msg.content}
                    </div>
                    {showTime && (
                      <span className="text-xs text-gray-600 mt-1 px-1">{formatTime(msg.created_at)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}


        <div ref={bottomRef} />
      </div>

      {/* Recently captured ideas strip */}
      {capturedIdeas.length > 0 && (
        <div className="px-4 py-2 border-t border-white/5 flex gap-2 overflow-x-auto">
          {capturedIdeas.slice(0, 5).map(idea => (
            <div key={idea.id} className="flex-shrink-0 glass rounded-lg px-3 py-1.5 text-xs border border-primary/20 text-primary flex items-center gap-1.5">
              <span>💡</span>
              <span className="max-w-[120px] truncate">{idea.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/10">
        <form onSubmit={send} className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="What's on your mind..."
            rows={1}
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm resize-none outline-none focus:border-primary/40 transition-colors placeholder-gray-600 max-h-32"
            style={{ height: 'auto' }}
            onInput={e => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
            }}
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-primary/80 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
        <p className="text-xs text-gray-600 mt-1.5 px-1">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
