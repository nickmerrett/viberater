import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useReminderNotifications } from '../hooks/useReminderNotifications';
import AreaBadge from './AreaBadge';

const today = () => new Date().toISOString().split('T')[0];

function dueBadge(due_date) {
  if (!due_date) return null;
  const d = today();
  if (due_date < d) return { label: 'Overdue', cls: 'bg-red-500/20 text-red-400 border-red-500/30' };
  if (due_date === d) return { label: 'Today', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
  return { label: due_date, cls: 'bg-white/5 text-gray-400 border-white/10' };
}

export default function RemindersView({ activeArea = null }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [aiMode, setAiMode] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [draft, setDraft] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});

  const { requestPermission, permission } = useReminderNotifications(reminders);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const data = await api.getReminders();
      setReminders(data.reminders);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!input.trim()) return;

    if (aiMode) {
      setAiLoading(true);
      try {
        const res = await api.suggestReminder(`Set a reminder: ${input}`);
        const text = res.content?.[0]?.text || res.message || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          setDraft({ title: parsed.title || input, note: parsed.note || '', due_date: parsed.due_date || '' });
        } else {
          setDraft({ title: input, note: '', due_date: '' });
        }
      } catch {
        setDraft({ title: input, note: '', due_date: '' });
      } finally {
        setAiLoading(false);
      }
      return;
    }

    await save({ title: input.trim(), note: '', due_date: '' });
    setInput('');
  }

  async function confirmDraft(e) {
    e.preventDefault();
    await save(draft);
    setDraft(null);
    setInput('');
  }

  async function save(data) {
    try {
      const res = await api.createReminder(data);
      setReminders(prev => [res.reminder, ...prev]);
    } catch (e) {
      console.error(e);
    }
  }

  async function toggleComplete(id) {
    try {
      const res = await api.completeReminder(id);
      setReminders(prev => prev.map(r => r.id === id ? res.reminder : r));
    } catch (e) {
      console.error(e);
    }
  }

  async function remove(id) {
    try {
      await api.deleteReminder(id);
      setReminders(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      console.error(e);
    }
  }

  async function saveEdit(id) {
    try {
      const res = await api.updateReminder(id, editData);
      setReminders(prev => prev.map(r => r.id === id ? res.reminder : r));
      setEditId(null);
    } catch (e) {
      console.error(e);
    }
  }

  const active = reminders.filter(r => !r.completed && (!activeArea || r.area_id === activeArea));
  const completed = reminders.filter(r => r.completed && (!activeArea || r.area_id === activeArea));

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 max-w-2xl mx-auto">

      {/* Notification permission banner */}
      {permission === 'default' && (
        <button
          onClick={requestPermission}
          className="w-full mb-4 glass rounded-xl px-4 py-3 text-sm text-yellow-400 border border-yellow-500/20 flex items-center gap-2 hover:bg-yellow-500/5 transition-all"
        >
          <span>🔔</span>
          <span>Enable notifications to get reminded when items are due</span>
        </button>
      )}

      {/* Add form */}
      <form onSubmit={handleAdd} className="glass rounded-2xl p-4 mb-6 border border-white/10">
        <div className="flex gap-2 mb-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={aiMode ? 'e.g. "follow up with John next Friday"' : 'Add a reminder...'}
            className="flex-1 bg-transparent outline-none text-sm placeholder-gray-500"
            disabled={aiLoading}
          />
          <button
            type="button"
            onClick={() => setAiMode(m => !m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${aiMode ? 'bg-primary/30 text-primary border border-primary/40' : 'glass hover:bg-white/5 text-gray-400'}`}
            title="AI mode — describe in plain English"
          >
            AI
          </button>
          <button
            type="submit"
            disabled={!input.trim() || aiLoading}
            className="px-4 py-1.5 rounded-lg bg-primary/20 text-primary border border-primary/30 text-sm font-medium hover:bg-primary/30 transition-all disabled:opacity-40"
          >
            {aiLoading ? '...' : 'Add'}
          </button>
        </div>
        {aiMode && (
          <p className="text-xs text-gray-500">AI will extract the title, note and due date from plain English</p>
        )}
      </form>

      {/* AI draft confirmation */}
      {draft && (
        <form onSubmit={confirmDraft} className="glass rounded-2xl p-4 mb-6 border border-primary/30 bg-primary/5">
          <p className="text-xs text-primary mb-3 font-medium">AI suggested — confirm or edit:</p>
          <input
            className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm mb-2 outline-none border border-white/10 focus:border-primary/40"
            value={draft.title}
            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            placeholder="Title"
          />
          <input
            className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm mb-2 outline-none border border-white/10 focus:border-primary/40"
            value={draft.note}
            onChange={e => setDraft(d => ({ ...d, note: e.target.value }))}
            placeholder="Note (optional)"
          />
          <input
            type="date"
            className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm mb-3 outline-none border border-white/10 focus:border-primary/40"
            value={draft.due_date || ''}
            onChange={e => setDraft(d => ({ ...d, due_date: e.target.value }))}
          />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-2 rounded-lg bg-primary/20 text-primary text-sm font-medium hover:bg-primary/30 transition-all">
              Save
            </button>
            <button type="button" onClick={() => setDraft(null)} className="px-4 py-2 rounded-lg glass text-sm hover:bg-white/5 transition-all">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Active reminders */}
      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading...</div>
      ) : active.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          <div className="text-4xl mb-3">🎉</div>
          <div>Nothing to follow up on</div>
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {active.map(r => (
            <ReminderRow
              key={r.id}
              reminder={r}
              editId={editId}
              editData={editData}
              onToggle={toggleComplete}
              onDelete={remove}
              onEditStart={() => { setEditId(r.id); setEditData({ title: r.title, note: r.note || '', due_date: r.due_date || '' }); }}
              onEditChange={setEditData}
              onEditSave={() => saveEdit(r.id)}
              onEditCancel={() => setEditId(null)}
            />
          ))}
        </div>
      )}

      {/* Completed section */}
      {completed.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(s => !s)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors mb-2 flex items-center gap-1"
          >
            <span>{showCompleted ? '▾' : '▸'}</span>
            <span>{completed.length} completed</span>
          </button>
          {showCompleted && (
            <div className="space-y-2 opacity-50">
              {completed.map(r => (
                <ReminderRow
                  key={r.id}
                  reminder={r}
                  editId={editId}
                  editData={editData}
                  onToggle={toggleComplete}
                  onDelete={remove}
                  onEditStart={() => { setEditId(r.id); setEditData({ title: r.title, note: r.note || '', due_date: r.due_date || '' }); }}
                  onEditChange={setEditData}
                  onEditSave={() => saveEdit(r.id)}
                  onEditCancel={() => setEditId(null)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReminderRow({ reminder: r, editId, editData, onToggle, onDelete, onEditStart, onEditChange, onEditSave, onEditCancel }) {
  const badge = dueBadge(r.due_date);
  const isEditing = editId === r.id;

  if (isEditing) {
    return (
      <div className="glass rounded-xl p-3 border border-primary/30">
        <input
          className="w-full bg-white/5 rounded-lg px-3 py-1.5 text-sm mb-2 outline-none border border-white/10 focus:border-primary/40"
          value={editData.title}
          onChange={e => onEditChange(d => ({ ...d, title: e.target.value }))}
        />
        <input
          className="w-full bg-white/5 rounded-lg px-3 py-1.5 text-sm mb-2 outline-none border border-white/10 focus:border-primary/40"
          value={editData.note}
          onChange={e => onEditChange(d => ({ ...d, note: e.target.value }))}
          placeholder="Note"
        />
        <input
          type="date"
          className="w-full bg-white/5 rounded-lg px-3 py-1.5 text-sm mb-2 outline-none border border-white/10 focus:border-primary/40"
          value={editData.due_date}
          onChange={e => onEditChange(d => ({ ...d, due_date: e.target.value }))}
        />
        <div className="flex gap-2">
          <button onClick={onEditSave} className="flex-1 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-all">Save</button>
          <button onClick={onEditCancel} className="px-3 py-1.5 rounded-lg glass text-xs hover:bg-white/5 transition-all">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`glass rounded-xl px-4 py-3 border border-white/10 flex items-start gap-3 group hover:border-white/20 transition-all ${r.completed ? 'opacity-60' : ''}`}>
      <button
        onClick={() => onToggle(r.id)}
        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all ${r.completed ? 'bg-primary border-primary' : 'border-gray-500 hover:border-primary'}`}
      >
        {r.completed && <span className="text-white text-xs flex items-center justify-center w-full h-full">✓</span>}
      </button>

      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${r.completed ? 'line-through text-gray-500' : ''}`}>{r.title}</div>
        {r.note && <div className="text-xs text-gray-500 mt-0.5 truncate">{r.note}</div>}
        {badge && (
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full border ${badge.cls}`}>
            {badge.label}
          </span>
        )}
        {r.area_id && <AreaBadge areaId={r.area_id} className="mt-1" />}
      </div>

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={onEditStart} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all text-xs">✎</button>
        <button onClick={() => onDelete(r.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all text-xs">✕</button>
      </div>
    </div>
  );
}
