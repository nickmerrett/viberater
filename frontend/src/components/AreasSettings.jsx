import { useState } from 'react';
import { useAreaStore } from '../store/useAreaStore';

const PRESET_COLORS = [
  '#3b82f6', '#22c55e', '#a855f7', '#f97316',
  '#ef4444', '#eab308', '#06b6d4', '#ec4899',
  '#84cc16', '#f43f5e', '#8b5cf6', '#14b8a6',
];

export default function AreasSettings({ onClose }) {
  const { areas, create, update, remove } = useAreaStore();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    await create(newName.trim(), newColor);
    setNewName('');
  }

  async function handleSaveEdit(id) {
    await update(id, { name: editName, color: editColor });
    setEditId(null);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Manage Areas</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        {/* Existing areas */}
        <div className="space-y-2 mb-5">
          {areas.map(area => (
            <div key={area.id} className="flex items-center gap-3">
              {editId === area.id ? (
                <>
                  <input
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary/40"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(area.id); if (e.key === 'Escape') setEditId(null); }}
                    autoFocus
                  />
                  <div className="flex gap-1 flex-wrap w-32">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setEditColor(c)}
                        className={`w-5 h-5 rounded-full border-2 transition-all ${editColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <button onClick={() => handleSaveEdit(area.id)} className="text-xs text-primary hover:text-primary/80">Save</button>
                  <button onClick={() => setEditId(null)} className="text-xs text-gray-400">Cancel</button>
                </>
              ) : (
                <>
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: area.color }} />
                  <span className="flex-1 text-sm">{area.name}</span>
                  <button
                    onClick={() => { setEditId(area.id); setEditName(area.name); setEditColor(area.color); }}
                    className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1"
                  >✎</button>
                  <button
                    onClick={() => remove(area.id)}
                    className="text-xs text-gray-400 hover:text-red-400 px-2 py-1"
                  >✕</button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add new */}
        <form onSubmit={handleCreate} className="border-t border-white/10 pt-4">
          <p className="text-xs text-gray-400 mb-3">Add area</p>
          <div className="flex gap-2 mb-3">
            <input
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary/40"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Inverloch"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap mb-3">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${newColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            type="submit"
            disabled={!newName.trim()}
            className="w-full py-2 rounded-lg bg-primary/20 text-primary border border-primary/30 text-sm font-medium hover:bg-primary/30 transition-all disabled:opacity-40"
          >
            Add Area
          </button>
        </form>
      </div>
    </div>
  );
}
