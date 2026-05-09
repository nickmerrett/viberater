import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../services/api';

export default function ShareTarget() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    if (!isAuthenticated) {
      const here = window.location.pathname + window.location.search;
      navigate(`/login?redirect=${encodeURIComponent(here)}`);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const url = params.get('url') || '';
    const title = params.get('title') || '';
    const text = params.get('text') || '';

    // Build a human-readable idea title from what was shared
    const ideaTitle = title || url || text.slice(0, 80) || 'Shared link';
    const notes = [text, url].filter(Boolean).join('\n').trim() || null;

    async function save() {
      try {
        const idea = await api.createIdea({ title: ideaTitle, notes });

        // If a URL was shared, attach it with OG metadata
        if (url) {
          try {
            const preview = await api.fetchLinkPreview(url);
            await api.addLinkAttachment(idea.idea.id, {
              url,
              title: preview.title || title || url,
              description: preview.description,
              favicon: preview.favicon,
            });
          } catch {
            // Link preview failed — skip silently
          }
        }

        navigate('/?tab=ideas');
      } catch {
        navigate('/');
      }
    }

    save();
  }, [isAuthenticated]);

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-2xl mb-3 animate-pulse">💡</div>
        <p className="text-gray-400 text-sm">Saving idea…</p>
      </div>
    </div>
  );
}
