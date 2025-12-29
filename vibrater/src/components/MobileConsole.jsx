import { useState, useEffect } from 'react';

export default function MobileConsole() {
  const [logs, setLogs] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Capture console.log
    const originalLog = console.log;
    console.log = (...args) => {
      originalLog(...args);
      setLogs(prev => [...prev.slice(-50), {
        type: 'log',
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '),
        time: new Date().toLocaleTimeString()
      }]);
    };

    // Capture console.error
    const originalError = console.error;
    console.error = (...args) => {
      originalError(...args);
      setLogs(prev => [...prev.slice(-50), {
        type: 'error',
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '),
        time: new Date().toLocaleTimeString()
      }]);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-purple-600 text-white shadow-lg flex items-center justify-center"
        style={{ touchAction: 'manipulation' }}
      >
        🐛
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="font-bold">Console</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setLogs([])}
            className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-sm"
          >
            Clear
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="px-3 py-1 bg-white/10 rounded text-sm"
          >
            Close
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="text-gray-500">No logs yet...</div>
        ) : (
          logs.map((log, i) => (
            <div
              key={i}
              className={`mb-2 p-2 rounded ${
                log.type === 'error' ? 'bg-red-500/10 text-red-300' : 'bg-white/5'
              }`}
            >
              <div className="text-gray-500 text-xs mb-1">{log.time}</div>
              <pre className="whitespace-pre-wrap break-all">{log.message}</pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
