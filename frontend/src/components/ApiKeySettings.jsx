import { useState } from 'react';
import { api } from '../services/api';

export default function ApiKeySettings({ hasApiKey: initialHasKey, onClose }) {
  const [hasKey, setHasKey] = useState(initialHasKey);
  const [newKey, setNewKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.generateApiKey();
      setNewKey(data.apiKey);
      setHasKey(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke() {
    if (!confirm('Revoke API key? Any integrations using it will stop working.')) return;
    setLoading(true);
    setError(null);
    try {
      await api.revokeApiKey();
      setHasKey(false);
      setNewKey(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="glass rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">API Key</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        <p className="text-sm text-gray-400 mb-5 leading-relaxed">
          Use an API key to access Viberater from external tools, scripts, or MCP-compatible agents.
          The key is shown only once — store it somewhere safe.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-3 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}

        {newKey ? (
          <div className="mb-5">
            <div className="text-xs text-yellow-400 font-medium mb-2">⚠ Copy this key now — it won't be shown again</div>
            <div className="flex gap-2">
              <code className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-green-400 font-mono break-all">
                {newKey}
              </code>
              <button
                onClick={handleCopy}
                className="px-3 py-2 glass rounded-lg text-xs hover:bg-white/10 transition-colors flex-shrink-0"
              >
                {copied ? '✓' : 'Copy'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 mb-5 px-3 py-3 bg-white/5 rounded-lg">
            <span className="text-lg">{hasKey ? '🔑' : '🔓'}</span>
            <span className="text-sm text-gray-300">
              {hasKey ? 'An API key is active' : 'No API key — generate one to get started'}
            </span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? '…' : hasKey ? 'Regenerate Key' : 'Generate Key'}
          </button>
          {hasKey && !newKey && (
            <button
              onClick={handleRevoke}
              disabled={loading}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              Revoke
            </button>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-gray-500">
            Use as <code className="text-gray-400">Authorization: Bearer vbr_...</code> on API and MCP requests.
          </p>
        </div>
      </div>
    </div>
  );
}
