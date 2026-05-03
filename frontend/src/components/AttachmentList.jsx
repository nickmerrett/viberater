import { useState } from 'react';
import { api } from '../services/api';

function ImageAttachment({ attachment, onDelete }) {
  const [lightbox, setLightbox] = useState(false);

  return (
    <>
      <div className="relative group rounded-xl overflow-hidden border border-white/10 bg-white/5 aspect-square">
        <img
          src={attachment.url}
          alt={attachment.filename}
          className="w-full h-full object-cover cursor-pointer"
          onClick={() => setLightbox(true)}
        />
        <button
          onClick={() => onDelete(attachment.id)}
          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500/80"
        >
          ✕
        </button>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <img
            src={attachment.url}
            alt={attachment.filename}
            className="max-w-full max-h-full object-contain rounded-xl"
          />
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full glass text-white flex items-center justify-center"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}

function LinkAttachment({ attachment, onDelete }) {
  const meta = attachment.metadata || {};
  const domain = (() => { try { return new URL(attachment.url).hostname; } catch { return attachment.url; } })();

  return (
    <div className="group flex items-start gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 transition-colors">
      {meta.favicon
        ? <img src={meta.favicon} alt="" className="w-4 h-4 mt-0.5 flex-shrink-0 rounded-sm" onError={e => e.target.style.display='none'} />
        : <span className="text-gray-500 mt-0.5 flex-shrink-0">🔗</span>
      }
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0"
      >
        <div className="text-sm font-medium truncate">{meta.title || attachment.filename}</div>
        {meta.description && <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{meta.description}</div>}
        <div className="text-xs text-gray-600 mt-1">{domain}</div>
      </a>
      <button
        onClick={() => onDelete(attachment.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-400 flex-shrink-0"
      >
        ✕
      </button>
    </div>
  );
}

export default function AttachmentList({ attachments, onDelete }) {
  if (!attachments?.length) return null;

  const images = attachments.filter(a => a.type === 'image');
  const links = attachments.filter(a => a.type === 'link');

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map(a => (
            <ImageAttachment key={a.id} attachment={a} onDelete={onDelete} />
          ))}
        </div>
      )}
      {links.length > 0 && (
        <div className="space-y-2">
          {links.map(a => (
            <LinkAttachment key={a.id} attachment={a} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
