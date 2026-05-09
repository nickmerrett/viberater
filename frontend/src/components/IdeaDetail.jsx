import { useState } from 'react';
import { api } from '../services/api';
import AreaBadge from './AreaBadge';
import DesignDocument from './DesignDocument';
import AttachmentList from './AttachmentList';
import AttachmentUpload from './AttachmentUpload';
import ShareToggle from './ShareToggle';
import ResearchPanel from './ResearchPanel';

export default function IdeaDetail({
  idea,
  ideas = [],
  attachments,
  onBack,
  onRefine,
  onRiff,
  onPromote,
  onSplit,
  onArchive,
  onDelete,
  onUpdate,
  onAttachmentUploaded,
  onAttachmentDeleted,
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(idea.title);
  const [editingTags, setEditingTags] = useState(false);
  const [tagsInput, setTagsInput] = useState((idea.tags || []).join(', '));
  const [editing, setEditing] = useState(null); // 'summary' | 'notes' | 'excitement' | 'complexity' | 'vibe'
  const [editInput, setEditInput] = useState('');
  const [localIdea, setLocalIdea] = useState(idea);
  const [conversationExpanded, setConversationExpanded] = useState(false);

  async function saveTitle() {
    if (!titleInput.trim() || titleInput.trim() === localIdea.title) {
      setEditingTitle(false);
      return;
    }
    try {
      await onUpdate(localIdea.id, { title: titleInput.trim() });
      setLocalIdea(prev => ({ ...prev, title: titleInput.trim() }));
      setEditingTitle(false);
    } catch {
      alert('Failed to update title');
    }
  }

  async function saveTags() {
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    try {
      await onUpdate(localIdea.id, { tags });
      setLocalIdea(prev => ({ ...prev, tags }));
      setEditingTags(false);
    } catch {
      alert('Failed to update tags');
    }
  }

  function startEditing(field) {
    const val = field === 'vibe'
      ? (localIdea.vibe || []).join(', ')
      : (localIdea[field] ?? '');
    setEditInput(String(val));
    setEditing(field);
  }

  async function saveField(field) {
    let value = editInput;
    if (field === 'excitement') value = parseInt(editInput) || null;
    if (field === 'vibe') value = editInput.split(',').map(v => v.trim()).filter(Boolean);
    if (value === localIdea[field]) { setEditing(null); return; }
    try {
      await onUpdate(localIdea.id, { [field]: value });
      setLocalIdea(prev => ({ ...prev, [field]: value }));
    } catch {
      alert(`Failed to update ${field}`);
    }
    setEditing(null);
  }

  function cancelEditing() { setEditing(null); }

  async function linkIdea(selectedId) {
    if (!selectedId) return;
    const current = localIdea.related_ideas || [];
    if (current.includes(selectedId)) return;
    const updated = [...current, selectedId];
    await onUpdate(localIdea.id, { related_ideas: updated });
    setLocalIdea(prev => ({ ...prev, related_ideas: updated }));
  }

  async function unlinkIdea(relatedId) {
    const updated = (localIdea.related_ideas || []).filter(id => id !== relatedId);
    await onUpdate(localIdea.id, { related_ideas: updated });
    setLocalIdea(prev => ({ ...prev, related_ideas: updated }));
  }

  const conversation = (() => {
    if (!localIdea.conversation) return null;
    try {
      return typeof localIdea.conversation === 'string'
        ? JSON.parse(localIdea.conversation)
        : localIdea.conversation;
    } catch { return null; }
  })();

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 flex-shrink-0 glass">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl glass hover:bg-white/5 flex items-center justify-center transition-all flex-shrink-0"
          aria-label="Back"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              type="text"
              value={titleInput}
              onChange={e => setTitleInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') { setTitleInput(localIdea.title); setEditingTitle(false); }
              }}
              onBlur={saveTitle}
              className="input w-full text-base font-semibold py-1"
              autoFocus
            />
          ) : (
            <h1
              className="text-base font-semibold truncate cursor-pointer hover:text-accent transition-colors"
              onClick={() => setEditingTitle(true)}
              title="Tap to edit title"
            >
              {localIdea.title}
            </h1>
          )}
          {localIdea.area_id && <AreaBadge areaId={localIdea.area_id} className="mt-0.5" />}
        </div>

        <span className="text-xl flex-shrink-0">
          {localIdea.status === 'promoted-to-project' ? '🚀' : '💡'}
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

          {/* Summary */}
          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              {localIdea.status === 'refined' && <span className="text-xs text-accent font-medium">✨ AI Refined</span>}
              <button onClick={() => startEditing('summary')} className="text-xs text-primary hover:text-primary/80 transition-colors ml-auto">Edit</button>
            </div>
            {editing === 'summary' ? (
              <div className="space-y-2">
                <textarea
                  value={editInput}
                  onChange={e => setEditInput(e.target.value)}
                  onKeyDown={e => e.key === 'Escape' && cancelEditing()}
                  className="input w-full text-sm min-h-[80px] resize-y"
                  placeholder="Summary…"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={() => saveField('summary')} className="px-3 py-1 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs">Save</button>
                  <button onClick={cancelEditing} className="px-3 py-1 rounded-lg glass text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                {localIdea.summary || <span className="text-gray-500 italic">No summary — tap Edit to add one</span>}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Notes</h2>
              <button onClick={() => startEditing('notes')} className="text-xs text-primary hover:text-primary/80 transition-colors">Edit</button>
            </div>
            {editing === 'notes' ? (
              <div className="space-y-2">
                <textarea
                  value={editInput}
                  onChange={e => setEditInput(e.target.value)}
                  onKeyDown={e => e.key === 'Escape' && cancelEditing()}
                  className="input w-full text-sm min-h-[80px] resize-y"
                  placeholder="Notes…"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={() => saveField('notes')} className="px-3 py-1 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs">Save</button>
                  <button onClick={cancelEditing} className="px-3 py-1 rounded-lg glass text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                {localIdea.notes || <span className="text-gray-500 italic">No notes — tap Edit to add some</span>}
              </p>
            )}
          </div>

          {/* Metadata */}
          <div className="glass rounded-xl p-4 grid grid-cols-3 gap-3 text-sm">
            <button className="text-center" onClick={() => startEditing('excitement')}>
              <div className="text-xl mb-1">⚡</div>
              {editing === 'excitement' ? (
                <input
                  type="number" min="1" max="10"
                  value={editInput}
                  onChange={e => setEditInput(e.target.value)}
                  onBlur={() => saveField('excitement')}
                  onKeyDown={e => { if (e.key === 'Enter') saveField('excitement'); if (e.key === 'Escape') cancelEditing(); }}
                  className="input w-full text-center text-sm font-semibold"
                  autoFocus
                />
              ) : (
                <div className="text-white font-semibold">{localIdea.excitement ?? '—'}<span className="text-gray-500 text-xs">/10</span></div>
              )}
              <div className="text-gray-500 text-xs">Excitement</div>
            </button>
            <button className="text-center" onClick={() => startEditing('complexity')}>
              <div className="text-xl mb-1">⏱️</div>
              {editing === 'complexity' ? (
                <select
                  value={editInput}
                  onChange={async e => {
                    const val = e.target.value;
                    setEditInput(val);
                    await onUpdate(localIdea.id, { complexity: val });
                    setLocalIdea(prev => ({ ...prev, complexity: val }));
                    setEditing(null);
                  }}
                  className="input w-full text-sm"
                  autoFocus
                >
                  {['afternoon','weekend','week','month','months'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <div className="text-white font-semibold capitalize">{localIdea.complexity || '—'}</div>
              )}
              <div className="text-gray-500 text-xs">Complexity</div>
            </button>
            <div className="text-center">
              <div className="text-xl mb-1">📅</div>
              <div className="text-white font-semibold text-xs">
                {localIdea.created_at ? new Date(localIdea.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—'}
              </div>
              <div className="text-gray-500 text-xs">Created</div>
            </div>
          </div>

          {/* Tags */}
          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Tags</h2>
              {!editingTags && (
                <button onClick={() => setEditingTags(true)} className="text-xs text-primary hover:text-primary/80 transition-colors">
                  Edit
                </button>
              )}
            </div>
            {editingTags ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={tagsInput}
                  onChange={e => setTagsInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveTags();
                    if (e.key === 'Escape') { setTagsInput((localIdea.tags || []).join(', ')); setEditingTags(false); }
                  }}
                  className="input w-full text-sm"
                  placeholder="web, mobile, ai"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={saveTags} className="px-3 py-1 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs transition-all">Save</button>
                  <button onClick={() => { setTagsInput((localIdea.tags || []).join(', ')); setEditingTags(false); }} className="px-3 py-1 rounded-lg glass hover:bg-red-500/20 hover:text-red-400 text-xs transition-all">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {localIdea.tags?.length ? (
                  localIdea.tags.map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-accent/20 text-accent">#{tag}</span>
                  ))
                ) : (
                  <span className="text-gray-500 text-xs italic">No tags — tap Edit to add some</span>
                )}
              </div>
            )}

            {/* Vibe */}
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Vibe</span>
                <button onClick={() => startEditing('vibe')} className="text-xs text-primary hover:text-primary/80 transition-colors">Edit</button>
              </div>
              {editing === 'vibe' ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editInput}
                    onChange={e => setEditInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveField('vibe'); if (e.key === 'Escape') cancelEditing(); }}
                    className="input w-full text-sm"
                    placeholder="creative, practical, ambitious"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={() => saveField('vibe')} className="px-3 py-1 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs">Save</button>
                    <button onClick={cancelEditing} className="px-3 py-1 rounded-lg glass text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {localIdea.vibe?.length > 0
                    ? localIdea.vibe.map((v, i) => <span key={i} className="px-2 py-0.5 rounded-full text-xs glass">{v}</span>)
                    : <span className="text-gray-500 text-xs italic">No vibe set</span>}
                </div>
              )}
            </div>
          </div>

          {/* Design Document */}
          {localIdea.design_document && (
            <div className="glass rounded-xl p-4">
              <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">📐 Design Document</h2>
              <DesignDocument content={localIdea.design_document} />
            </div>
          )}

          {/* Related Ideas */}
          <div className="glass rounded-xl p-4">
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">🔗 Linked Ideas</h2>

            {localIdea.parent_idea_id && (() => {
              const parent = ideas.find(i => i.id === localIdea.parent_idea_id);
              return parent ? (
                <div className="mb-3">
                  <div className="text-xs text-gray-500 mb-1">Parent</div>
                  <div className="glass rounded-lg p-2.5 flex items-center gap-2 text-sm">
                    <span className="text-accent">↑</span>
                    <span className="text-white">{parent.title}</span>
                  </div>
                </div>
              ) : null;
            })()}

            {(localIdea.related_ideas || []).length > 0 && (
              <div className="space-y-1.5 mb-3">
                {localIdea.related_ideas.map(rid => {
                  const rel = ideas.find(i => i.id === rid);
                  return rel ? (
                    <div key={rid} className="glass rounded-lg p-2.5 flex items-center gap-2 text-sm group">
                      <span className="text-primary">⇄</span>
                      <span className="flex-1 text-white">{rel.title}</span>
                      <button
                        onClick={() => unlinkIdea(rid)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all px-1 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ) : null;
                })}
              </div>
            )}

            <select
              onChange={e => { linkIdea(e.target.value); e.target.value = ''; }}
              defaultValue=""
              className="input w-full text-sm"
            >
              <option value="">Link another idea…</option>
              {ideas
                .filter(i => i.id !== localIdea.id && !(localIdea.related_ideas || []).includes(i.id) && !i.archived)
                .map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
            </select>
          </div>

          {/* Attachments */}
          <div className="glass rounded-xl p-4">
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">📎 Attachments</h2>
            <div className="space-y-3">
              <AttachmentList
                attachments={attachments}
                onDelete={onAttachmentDeleted}
              />
              <AttachmentUpload ideaId={localIdea.id} onUploaded={onAttachmentUploaded} />
            </div>
          </div>

          {/* Conversation history */}
          {conversation && (
            <div className="glass rounded-xl p-4">
              <button
                className="flex items-center justify-between w-full text-left"
                onClick={() => setConversationExpanded(e => !e)}
              >
                <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider">💬 Conversation ({conversation.length})</h2>
                <span className="text-gray-600 text-xs">{conversationExpanded ? '▲ collapse' : '▼ expand'}</span>
              </button>
              {conversationExpanded && (
                <div className="space-y-3 mt-3">
                  {conversation.map((msg, i) => (
                    <div key={i} className="glass rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1 font-medium">
                        {msg.role === 'user' ? '👤 You' : '🤖 AI'}
                      </div>
                      <div className="text-gray-200 text-sm whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Research */}
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Validate idea</h3>
            <ResearchPanel idea={localIdea} />
          </div>

          {/* Share */}
          <div className="glass rounded-xl p-4">
            <ShareToggle
              idea={localIdea}
              onUpdate={updated => setLocalIdea(prev => ({ ...prev, ...updated }))}
            />
          </div>

          {/* Bottom padding so footer doesn't cover content */}
          <div className="h-2" />
        </div>
      </div>

      {/* Sticky action footer */}
      <div className="flex-shrink-0 border-t border-white/10 glass px-4 py-3 space-y-2">
        {/* Primary actions */}
        {localIdea.status !== 'promoted-to-project' && !localIdea.archived && (
          <div className="flex gap-2">
            <button
              onClick={onRefine}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-accent/20 hover:bg-accent/30 text-accent text-sm font-medium transition-all"
            >
              🤖 {localIdea.status === 'refined' ? 'Continue' : 'Refine'}
            </button>
            <button
              onClick={onRiff}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl glass hover:bg-purple-500/20 hover:text-purple-300 text-sm font-medium transition-all"
            >
              💭 Riff
            </button>
            <button
              onClick={onPromote}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl glass hover:bg-primary/20 hover:text-primary text-sm font-medium transition-all"
            >
              🚀 Promote
            </button>
          </div>
        )}

        {/* Secondary actions */}
        <div className="flex gap-2">
          {localIdea.status !== 'promoted-to-project' && !localIdea.archived && (
            <button
              onClick={onSplit}
              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl glass hover:bg-yellow-500/20 hover:text-yellow-300 text-xs transition-all"
            >
              ✂️ Split
            </button>
          )}
          <button
            onClick={() => onArchive(localIdea.id, !localIdea.archived)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl glass text-xs transition-all ${
              localIdea.archived
                ? 'hover:bg-green-500/20 hover:text-green-300'
                : 'hover:bg-orange-500/20 hover:text-orange-300'
            }`}
          >
            {localIdea.archived ? '📤 Unarchive' : '📦 Archive'}
          </button>
          <button
            onClick={() => {
              const md = buildMarkdown(localIdea);
              navigator.clipboard.writeText(md).catch(() => {});
            }}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl glass hover:bg-white/5 text-xs transition-all"
          >
            📋 Copy
          </button>
          <button
            onClick={onDelete}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl glass hover:bg-red-500/20 hover:text-red-400 text-xs transition-all"
          >
            🗑️ Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function buildMarkdown(idea) {
  let md = `# ${idea.title}\n\n`;
  if (idea.summary) md += `${idea.summary}\n\n`;
  if (idea.excitement || idea.complexity) {
    md += `**Excitement:** ${idea.excitement}/10 · **Complexity:** ${idea.complexity}\n\n`;
  }
  if (idea.tags?.length) md += `Tags: ${idea.tags.map(t => `#${t}`).join(' ')}\n\n`;
  return md;
}
