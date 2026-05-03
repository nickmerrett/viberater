import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function SplitIdeaModal({ idea, onSplit, onClose }) {
  const [suggesting, setSuggesting] = useState(false);
  const [partA, setPartA] = useState({ title: '', summary: '' });
  const [partB, setPartB] = useState({ title: '', summary: '' });
  const [splitting, setSplitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    suggestSplit();
  }, []);

  async function suggestSplit() {
    setSuggesting(true);
    setError(null);
    try {
      const prompt = `This idea might contain two distinct concepts worth tracking separately:

Title: ${idea.title}
Summary: ${idea.summary || '(no summary)'}
Tags: ${(idea.tags || []).join(', ') || 'none'}
Notes: ${idea.notes || '(none)'}

Suggest a clean split into exactly 2 separate ideas. Each should be a coherent, standalone idea.
Reply with JSON only, no other text:
{
  "a": { "title": "...", "summary": "..." },
  "b": { "title": "...", "summary": "..." }
}`;

      const result = await api.chatWithAI(
        [{ role: 'user', content: prompt }],
        { systemPrompt: 'You are a concise assistant that splits ideas. Reply with valid JSON only.' }
      );

      const raw = result.message?.content || result.content || '';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setPartA(parsed.a || { title: '', summary: '' });
        setPartB(parsed.b || { title: '', summary: '' });
      }
    } catch (e) {
      setError('Could not get AI suggestion — fill in manually below.');
      setPartA({ title: idea.title + ' (part 1)', summary: '' });
      setPartB({ title: idea.title + ' (part 2)', summary: '' });
    } finally {
      setSuggesting(false);
    }
  }

  async function handleSplit() {
    if (!partA.title.trim() || !partB.title.trim()) return;
    setSplitting(true);
    try {
      await onSplit(idea, partA, partB);
      onClose();
    } catch (e) {
      setError('Failed to split idea: ' + e.message);
      setSplitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass rounded-2xl w-full max-w-lg border border-white/10 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 flex-shrink-0">
          <div>
            <h2 className="font-semibold">Split Idea</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{idea.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {suggesting ? (
            <div className="flex items-center gap-3 text-gray-400 py-8 justify-center">
              <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
              <span className="text-sm">AI is suggesting a split…</span>
            </div>
          ) : (
            <>
              {error && <p className="text-xs text-orange-400">{error}</p>}

              {/* Part A */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold flex-shrink-0">A</span>
                  <span className="text-sm font-medium">First idea</span>
                </div>
                <input
                  value={partA.title}
                  onChange={e => setPartA(p => ({ ...p, title: e.target.value }))}
                  placeholder="Title"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/40"
                />
                <textarea
                  value={partA.summary}
                  onChange={e => setPartA(p => ({ ...p, summary: e.target.value }))}
                  placeholder="Summary (optional)"
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/40 resize-none"
                />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-gray-600">✂️</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Part B */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold flex-shrink-0">B</span>
                  <span className="text-sm font-medium">Second idea</span>
                </div>
                <input
                  value={partB.title}
                  onChange={e => setPartB(p => ({ ...p, title: e.target.value }))}
                  placeholder="Title"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/40"
                />
                <textarea
                  value={partB.summary}
                  onChange={e => setPartB(p => ({ ...p, summary: e.target.value }))}
                  placeholder="Summary (optional)"
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/40 resize-none"
                />
              </div>

              <p className="text-xs text-gray-500">The original idea will be archived. Both new ideas inherit its tags and area.</p>
            </>
          )}
        </div>

        {/* Footer */}
        {!suggesting && (
          <div className="p-5 border-t border-white/10 flex gap-3 flex-shrink-0">
            <button
              onClick={suggestSplit}
              className="px-3 py-2 rounded-xl glass text-sm text-gray-400 hover:text-white transition-all"
            >
              🔄 Re-suggest
            </button>
            <button
              onClick={handleSplit}
              disabled={!partA.title.trim() || !partB.title.trim() || splitting}
              className="flex-1 py-2 rounded-xl bg-primary/20 text-primary border border-primary/30 text-sm font-medium hover:bg-primary/30 transition-all disabled:opacity-40"
            >
              {splitting ? 'Splitting…' : '✂️ Split into 2 ideas'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
