import { useState } from 'react';
import { api } from '../services/api';

export default function ResearchPanel({ idea }) {
  const [state, setState] = useState('idle'); // idle | running | done | error
  const [events, setEvents] = useState([]);
  const [answer, setAnswer] = useState('');

  function reset() {
    setState('idle');
    setEvents([]);
    setAnswer('');
  }

  async function run() {
    setState('running');
    setEvents([]);
    setAnswer('');

    let accumulated = '';

    await api.streamResearch(
      idea.id,
      idea.title,
      idea.summary,
      (event) => {
        if (event.type === 'tool_call') {
          setEvents(prev => [...prev, { type: 'call', name: event.name, args: event.args }]);
        } else if (event.type === 'tool_result') {
          setEvents(prev => prev.map((e, i) =>
            i === prev.length - 1 ? { ...e, result: event.result } : e
          ));
        } else if (event.type === 'token') {
          accumulated += event.text;
          setAnswer(accumulated);
        }
      },
      () => setState('done'),
      (err) => { setEvents(prev => [...prev, { type: 'error', message: err }]); setState('error'); }
    );
  }

  return (
    <div className="space-y-4">
      {state === 'idle' && (
        <button
          onClick={run}
          className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-white/10 text-sm hover:border-primary/30 hover:text-primary transition-all"
        >
          🔍 Research this idea
        </button>
      )}

      {state !== 'idle' && (
        <div className="space-y-3">
          {/* Tool call log */}
          {events.map((e, i) => (
            <div key={i} className="text-xs font-mono">
              {e.type === 'call' && (
                <div className="flex items-center gap-2 text-gray-400">
                  <span className="animate-pulse text-primary">
                    {e.name === 'web_search' ? '🔍' : '🌐'}
                  </span>
                  <span>
                    {e.name === 'web_search'
                      ? `Searching: "${e.args.query}"`
                      : `Fetching: ${e.args.url}`}
                  </span>
                  {!e.result && <span className="animate-pulse">…</span>}
                  {e.result && <span className="text-green-500/60">✓</span>}
                </div>
              )}
              {e.type === 'error' && (
                <div className="text-red-400">Error: {e.message}</div>
              )}
            </div>
          ))}

          {/* Streaming answer */}
          {answer && (
            <div className="glass rounded-xl p-4 border border-white/10">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-200">
                {answer}
                {state === 'running' && <span className="animate-pulse">▋</span>}
              </p>
            </div>
          )}

          {/* Actions */}
          {(state === 'done' || state === 'error') && (
            <button
              onClick={reset}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              ↺ Run again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
