import { useState, useEffect } from 'react';
import { syncService } from '../services/syncService';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sync listeners
    syncService.onSyncStart(() => setIsSyncing(true));
    syncService.onSyncComplete(({ synced }) => {
      setIsSyncing(false);
      setPendingCount(0);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !isSyncing && pendingCount === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      {!isOnline && (
        <div className="glass rounded-full px-4 py-2 flex items-center gap-2 border border-orange-500/50 bg-orange-500/10">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-sm text-orange-200">Offline Mode</span>
        </div>
      )}

      {isOnline && isSyncing && (
        <div className="glass rounded-full px-4 py-2 flex items-center gap-2 border border-blue-500/50 bg-blue-500/10">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-sm text-blue-200">Syncing...</span>
        </div>
      )}
    </div>
  );
}
