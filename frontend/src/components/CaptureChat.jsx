import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { getSetting } from '../services/settings';
import { useAreaStore } from '../store/useAreaStore';

const COMMANDS = [
  { cmd: '/idea',     args: '[title]',     desc: 'Save an idea instantly'       },
  { cmd: '/remind',   args: '[text]',      desc: 'Create a reminder'            },
  { cmd: '/note',     args: '[text]',      desc: 'Log a quick thought'          },
  { cmd: '/area',     args: '[name]',      desc: 'Switch active area'           },
  { cmd: '/ideas',    args: '',            desc: 'Go to Ideas tab'              },
  { cmd: '/projects', args: '',            desc: 'Go to Projects tab'           },
  { cmd: '/help',     args: '',            desc: 'Show all commands'            },
];

const PENDING_KEY = 'viberater_pending_capture';

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return isOnline;
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return `Yesterday ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function loadPending() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; }
}

function savePending(msgs) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(msgs));
}

// Group messages where gap between consecutive messages < gapMs into batches
function batchByTimeGap(messages, gapMs = 5000) {
  if (!messages.length) return [];
  const batches = [[messages[0]]];
  for (let i = 1; i < messages.length; i++) {
    const gap = new Date(messages[i].created_at) - new Date(messages[i - 1].created_at);
    if (gap > gapMs) batches.push([messages[i]]);
    else batches[batches.length - 1].push(messages[i]);
  }
  return batches;
}

export default function CaptureChat({ onNavigate }) {
  const isOnline = useOnlineStatus();
  const { areas, setActive: setActiveArea } = useAreaStore();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [capturedIdeas, setCapturedIdeas] = useState([]);
  const [pendingMessages, setPendingMessages] = useState(loadPending);
  const [cmdSuggestions, setCmdSuggestions] = useState([]);
  const [cmdIndex, setCmdIndex] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const syncingRef = useRef(false);

  useEffect(() => { loadHistory(); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingMessages]);

  // When coming back online, flush the pending queue
  useEffect(() => {
    if (isOnline && pendingMessages.length > 0 && !syncingRef.current) {
      flushPending();
    }
  }, [isOnline]);

  async function loadHistory() {
    try {
      const data = await api.getCaptureMessages();
      setMessages(data.messages || []);
    } catch (e) {
      console.error('Failed to load capture history:', e);
    }
  }

  function addSystemMsg(text) {
    setMessages(prev => [...prev, {
      id: `sys-${Date.now()}`,
      role: 'system',
      content: text,
      created_at: new Date().toISOString(),
    }]);
  }

  async function runCommand(raw) {
    const parts = raw.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const rest = parts.slice(1).join(' ').trim();

    switch (cmd) {
      case '/idea': {
        if (!rest) { addSystemMsg('Usage: /idea [title]'); return; }
        try {
          await api.createIdea({ title: rest });
          addSystemMsg(`💡 Idea saved: "${rest}"`);
        } catch { addSystemMsg('Failed to save idea.'); }
        break;
      }
      case '/note': {
        if (!rest) { addSystemMsg('Usage: /note [text]'); return; }
        try {
          await api.createIdea({ title: rest, tags: ['note'] });
          addSystemMsg(`📝 Note logged: "${rest}"`);
        } catch { addSystemMsg('Failed to save note.'); }
        break;
      }
      case '/remind': {
        if (!rest) { addSystemMsg('Usage: /remind [text]'); return; }
        try {
          addSystemMsg('⏳ Creating reminder…');
          const suggestion = await api.suggestReminder(rest);
          const raw = suggestion?.message?.content || suggestion?.content || '';
          const match = raw.match(/\{[\s\S]*\}/);
          const parsed = match ? JSON.parse(match[0]) : { title: rest, due_date: null };
          await api.createReminder({ title: parsed.title || rest, due_date: parsed.due_date || null, note: parsed.note || '' });
          setMessages(prev => prev.filter(m => m.content !== '⏳ Creating reminder…'));
          addSystemMsg(`🔔 Reminder set: "${parsed.title || rest}"${parsed.due_date ? ` · ${parsed.due_date}` : ''}`);
        } catch { addSystemMsg('Failed to create reminder.'); }
        break;
      }
      case '/area': {
        if (!rest) {
          const list = areas.map(a => a.name).join(', ') || 'none';
          addSystemMsg(`Available areas: ${list}`);
          return;
        }
        const match = areas.find(a => a.name.toLowerCase().startsWith(rest.toLowerCase()));
        if (match) {
          setActiveArea(match.id);
          addSystemMsg(`🗂️ Switched to area: ${match.name}`);
        } else {
          addSystemMsg(`Area "${rest}" not found. Available: ${areas.map(a => a.name).join(', ')}`);
        }
        break;
      }
      case '/ideas':
        onNavigate?.('ideas');
        addSystemMsg('📖 Navigating to Ideas…');
        break;
      case '/projects':
        onNavigate?.('projects');
        addSystemMsg('🚀 Navigating to Projects…');
        break;
      case '/help': {
        const lines = COMMANDS.map(c => `${c.cmd}${c.args ? ' ' + c.args : ''} — ${c.desc}`).join('\n');
        addSystemMsg(lines);
        break;
      }
      default:
        addSystemMsg(`Unknown command: ${cmd}. Type /help for available commands.`);
    }
  }

  function handleInputChange(e) {
    const val = e.target.value;
    setInput(val);
    // Slash command autocomplete — only when input IS just a command word (no space yet)
    if (val.startsWith('/') && !val.includes(' ')) {
      const filtered = COMMANDS.filter(c => c.cmd.startsWith(val.toLowerCase()));
      setCmdSuggestions(filtered);
      setCmdIndex(0);
    } else {
      setCmdSuggestions([]);
    }
  }

  function selectSuggestion(cmd) {
    const needsArgs = cmd.args !== '';
    setInput(needsArgs ? cmd.cmd + ' ' : cmd.cmd);
    setCmdSuggestions([]);
    inputRef.current?.focus();
  }

  const flushPending = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;

    const queue = loadPending();
    const batches = batchByTimeGap(queue, getSetting('batchGapSeconds') * 1000);

    for (const batch of batches) {
      try {
        const content = batch.map(m => m.content).join('\n\n');
        const ids = batch.map(m => m.id);
        await streamMessage(content, ids);
        const remaining = loadPending().filter(p => !ids.includes(p.id));
        savePending(remaining);
        setPendingMessages(remaining);
      } catch (e) {
        console.error('Failed to flush pending batch:', e);
        break;
      }
    }

    syncingRef.current = false;
  }, []);

  async function streamMessage(content, replacePendingIds = null) {
    const streamingMsg = { id: 'streaming', role: 'assistant', content: '', created_at: new Date().toISOString() };
    const ids = Array.isArray(replacePendingIds) ? replacePendingIds : replacePendingIds ? [replacePendingIds] : null;

    if (ids) {
      // Promote each pending message to a real user message bubble, then add streaming
      const pending = loadPending().filter(p => ids.includes(p.id));
      const realUserMsgs = pending.map((p, i) => ({ id: `user-${Date.now()}-${i}`, role: 'user', content: p.content, created_at: p.created_at }));
      setMessages(prev => [...prev, ...realUserMsgs, streamingMsg]);
      setPendingMessages(prev => prev.filter(p => !ids.includes(p.id)));
    } else {
      setMessages(prev => [...prev, streamingMsg]);
    }

    setSending(true);

    await new Promise((resolve, reject) => {
      api.streamCaptureMessage(
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
          resolve();
        },
        (err) => {
          console.error('Stream error:', err);
          setMessages(prev => prev.filter(m => m.id !== 'streaming'));
          setSending(false);
          reject(new Error(err));
        }
      );
    });
  }

  async function send(e) {
    e?.preventDefault();
    const content = input.trim();
    if (!content || sending) return;

    // Command autocomplete selection takes priority
    if (cmdSuggestions.length > 0) {
      selectSuggestion(cmdSuggestions[cmdIndex]);
      return;
    }

    setInput('');
    setCmdSuggestions([]);

    // Slash command
    if (content.startsWith('/')) {
      await runCommand(content);
      return;
    }

    if (!isOnline) {
      // Save locally — will be sent when back online
      const pending = { id: `pending-${Date.now()}`, content, created_at: new Date().toISOString() };
      const updated = [...loadPending(), pending];
      savePending(updated);
      setPendingMessages(updated);
      inputRef.current?.focus();
      return;
    }

    const userMsg = { id: `user-${Date.now()}`, role: 'user', content, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    await streamMessage(content);
  }

  function handleKey(e) {
    if (cmdSuggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setCmdIndex(i => Math.min(i + 1, cmdSuggestions.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setCmdIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Escape')    { setCmdSuggestions([]); return; }
      if (e.key === 'Tab')       { e.preventDefault(); selectSuggestion(cmdSuggestions[cmdIndex]); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // Merge server messages + pending into a single display list grouped by date
  const allForDisplay = [
    ...messages,
    ...pendingMessages.map(p => ({ ...p, role: 'user', pending: true })),
  ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const grouped = allForDisplay.reduce((acc, msg) => {
    const day = new Date(msg.created_at).toDateString();
    if (!acc[day]) acc[day] = [];
    acc[day].push(msg);
    return acc;
  }, {});

  const hasPending = pendingMessages.length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {allForDisplay.length === 0 && (
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
              const isSystem = msg.role === 'system';
              const showTime = !isSystem && (i === dayMessages.length - 1 ||
                new Date(dayMessages[i + 1]?.created_at) - new Date(msg.created_at) > 300000);

              return (
                <div key={msg.id} className={`flex ${isSystem ? 'justify-center' : isUser ? 'justify-end' : 'justify-start'} mb-1`}>
                  <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className={`
                      px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                      ${msg.role === 'system'
                        ? 'bg-white/5 text-gray-400 border border-white/5 font-mono text-xs'
                        : isUser
                          ? `bg-primary/30 text-white rounded-br-sm border ${msg.pending ? 'border-orange-400/40 opacity-70' : 'border-primary/30'}`
                          : 'glass text-gray-100 rounded-bl-sm border border-white/10'
                      }
                    `}>
                      {msg.content || <span className="animate-pulse text-gray-500">···</span>}
                    </div>
                    {showTime && (
                      <div className="flex items-center gap-1 mt-1 px-1">
                        {msg.pending && (
                          <span className="text-xs text-orange-400/70">⏳ queued</span>
                        )}
                        {!msg.pending && (
                          <span className="text-xs text-gray-600">{formatTime(msg.created_at)}</span>
                        )}
                      </div>
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

      {/* Offline / pending banner */}
      {(!isOnline || (isOnline && hasPending && sending)) && (
        <div className={`mx-4 mb-2 px-4 py-2.5 rounded-xl flex items-center gap-2 border ${
          !isOnline
            ? 'bg-orange-500/10 border-orange-500/30'
            : 'bg-blue-500/10 border-blue-500/30'
        }`}>
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${!isOnline ? 'bg-orange-400' : 'bg-blue-400 animate-pulse'}`} />
          <span className={`text-sm ${!isOnline ? 'text-orange-200' : 'text-blue-200'}`}>
            {!isOnline
              ? `Messages will be sent when you're back online${hasPending ? ` · ${pendingMessages.length} queued` : ''}`
              : `Sending ${pendingMessages.length} queued message${pendingMessages.length > 1 ? 's' : ''}…`
            }
          </span>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/10">
        {/* Slash command autocomplete */}
        {cmdSuggestions.length > 0 && (
          <div className="mb-2 glass rounded-xl border border-white/10 overflow-hidden">
            {cmdSuggestions.map((c, i) => (
              <button
                key={c.cmd}
                type="button"
                onClick={() => selectSuggestion(c)}
                className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${i === cmdIndex ? 'bg-primary/20' : 'hover:bg-white/5'}`}
              >
                <span className="text-primary font-mono text-sm font-medium w-24 flex-shrink-0">{c.cmd}</span>
                {c.args && <span className="text-gray-500 text-xs font-mono">{c.args}</span>}
                <span className="text-gray-400 text-xs ml-auto">{c.desc}</span>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={send} className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKey}
            placeholder={isOnline ? "What's on your mind..." : "Type your idea — it'll be sent when you're back online"}
            rows={1}
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm resize-none outline-none focus:border-primary/40 transition-colors placeholder-gray-600 max-h-32 disabled:opacity-40"
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
        <p className="text-xs text-gray-600 mt-1.5 px-1">
          {isOnline ? 'Enter to send · Shift+Enter for new line' : 'Offline · messages queued locally'}
        </p>
      </div>
    </div>
  );
}
