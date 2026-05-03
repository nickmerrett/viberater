import { useState } from 'react';
import { api } from '../services/api';

export default function ShareToggle({ idea, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const isEnabled = idea.sharing_enabled;
  const shareUrl = isEnabled && idea.share_token
    ? `${window.location.origin}/share/${idea.share_token}`
    : null;

  async function toggle() {
    setLoading(true);
    try {
      const result = await api.toggleSharing(idea.id, !isEnabled);
      onUpdate({ ...idea, sharing_enabled: result.sharing_enabled ? 1 : 0, share_token: result.share_token });
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function loadComments() {
    setLoadingComments(true);
    try {
      const result = await api.getIdeaComments(idea.id);
      setComments(result.comments || []);
      onUpdate({ ...idea, unread_comment_count: 0 });
    } finally {
      setLoadingComments(false);
      setShowComments(true);
    }
  }

  async function reply(e) {
    e.preventDefault();
    if (!replyText.trim()) return;
    const result = await api.replyToComment(idea.id, replyText.trim());
    setComments(prev => [...prev, result.comment]);
    setReplyText('');
  }

  async function deleteComment(commentId) {
    await api.deleteComment(idea.id, commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
  }

  return (
    <div className="space-y-3">
      {/* Share toggle row */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
            isEnabled
              ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
              : 'glass border-white/10 text-gray-400 hover:text-white hover:border-white/20'
          } disabled:opacity-40`}
        >
          {loading ? '…' : isEnabled ? '🔗 Sharing on' : '🔗 Share this idea'}
        </button>

        {shareUrl && (
          <button
            onClick={copyLink}
            className="px-3 py-2 rounded-xl glass border border-white/10 text-xs text-gray-400 hover:text-white transition-all"
          >
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
        )}

        {isEnabled && (
          <button
            onClick={showComments ? () => setShowComments(false) : loadComments}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass border border-white/10 text-xs text-gray-400 hover:text-white transition-all"
          >
            💬 Comments
            {idea.unread_comment_count > 0 && (
              <span className="w-4 h-4 rounded-full bg-primary text-white text-xs flex items-center justify-center">
                {idea.unread_comment_count}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Share URL display */}
      {shareUrl && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
          <span className="text-xs text-gray-400 truncate flex-1">{shareUrl}</span>
        </div>
      )}

      {/* Comments panel */}
      {showComments && (
        <div className="glass rounded-xl p-4 border border-white/10 space-y-4">
          {loadingComments ? (
            <div className="text-xs text-gray-500">Loading…</div>
          ) : comments.length === 0 ? (
            <div className="text-xs text-gray-500">No comments yet.</div>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {comments.map(c => (
                <div key={c.id} className={`text-sm ${c.is_author_reply ? 'pl-3 border-l-2 border-primary/40' : ''}`}>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={`font-medium text-xs ${c.is_author_reply ? 'text-primary' : 'text-gray-300'}`}>
                      {c.is_author_reply ? '✏️ You' : c.author_name}
                    </span>
                    {!c.is_author_reply && (
                      <button onClick={() => deleteComment(c.id)} className="text-xs text-gray-600 hover:text-red-400 transition-colors">✕</button>
                    )}
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed">{c.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* Reply form */}
          <form onSubmit={reply} className="flex gap-2">
            <input
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Reply…"
              maxLength={2000}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-primary/40"
            />
            <button
              type="submit"
              disabled={!replyText.trim()}
              className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs border border-primary/30 disabled:opacity-40 hover:bg-primary/30 transition-all"
            >
              Reply
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
