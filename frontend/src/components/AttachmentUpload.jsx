import { useState, useRef } from 'react';
import { api } from '../services/api';

export default function AttachmentUpload({ ideaId, onUploaded }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  async function uploadFile(file) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const result = await api.uploadAttachment(ideaId, file);
      onUploaded(result.attachment);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleFiles(files) {
    for (const file of Array.from(files)) {
      await uploadFile(file);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function handlePaste(e) {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find(i => i.type.startsWith('image/'));
    if (imageItem) {
      e.preventDefault();
      uploadFile(imageItem.getAsFile());
    }
  }

  async function addLink(e) {
    e.preventDefault();
    const url = linkUrl.trim();
    if (!url) return;
    setUploading(true);
    setError(null);
    try {
      let meta = { title: null, description: null, favicon: null };
      try {
        const preview = await api.fetchLinkPreview(url);
        meta = { title: preview.title, description: preview.description, favicon: preview.favicon };
      } catch {}

      const result = await api.addLinkAttachment(ideaId, { url, ...meta });
      onUploaded(result.attachment);
      setLinkUrl('');
      setLinkMode(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div onPaste={handlePaste}>
      {linkMode ? (
        <form onSubmit={addLink} className="flex gap-2">
          <input
            autoFocus
            type="url"
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/40"
          />
          <button
            type="submit"
            disabled={!linkUrl.trim() || uploading}
            className="px-3 py-2 rounded-xl bg-primary/20 text-primary text-sm border border-primary/30 disabled:opacity-40 hover:bg-primary/30 transition-all"
          >
            {uploading ? '…' : 'Add'}
          </button>
          <button
            type="button"
            onClick={() => { setLinkMode(false); setLinkUrl(''); }}
            className="px-3 py-2 rounded-xl glass text-sm text-gray-400"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed transition-colors p-3 ${
            dragging ? 'border-primary/60 bg-primary/5' : 'border-white/10'
          }`}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-40"
            >
              {uploading ? <span className="animate-spin">⏳</span> : '📎'}
              {uploading ? 'Uploading…' : 'Attach image'}
            </button>
            <button
              type="button"
              onClick={() => setLinkMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass text-xs text-gray-400 hover:text-white transition-colors"
            >
              🔗 Add link
            </button>
            <span className="text-xs text-gray-600">or drag & drop · paste screenshot</span>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  );
}
