import { useState, useEffect } from 'react';

export default function HealthCheck() {
  const [health, setHealth] = useState({
    serviceWorker: 'checking...',
    indexedDB: 'checking...',
    online: navigator.onLine ? '✅' : '❌',
    localStorage: 'checking...',
  });

  useEffect(() => {
    const checkHealth = async () => {
      // Check Service Worker
      const swStatus = 'serviceWorker' in navigator ? '✅ Available' : '❌ Not supported';

      // Check IndexedDB
      let dbStatus = '❌ Failed';
      try {
        const dbTest = indexedDB.open('health-check-test', 1);
        await new Promise((resolve, reject) => {
          dbTest.onsuccess = () => resolve();
          dbTest.onerror = () => reject();
        });
        dbStatus = '✅ Working';
        indexedDB.deleteDatabase('health-check-test');
      } catch (e) {
        dbStatus = '❌ Error: ' + e.message;
      }

      // Check localStorage
      let lsStatus = '❌ Failed';
      try {
        localStorage.setItem('health-check', 'test');
        localStorage.removeItem('health-check');
        lsStatus = '✅ Working';
      } catch (e) {
        lsStatus = '❌ Error: ' + e.message;
      }

      setHealth({
        serviceWorker: swStatus,
        indexedDB: dbStatus,
        online: navigator.onLine ? '✅ Online' : '❌ Offline',
        localStorage: lsStatus,
      });
    };

    checkHealth();

    // Listen for online/offline
    const handleOnline = () => setHealth(h => ({ ...h, online: '✅ Online' }));
    const handleOffline = () => setHealth(h => ({ ...h, online: '❌ Offline' }));
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Only show in development or with ?debug=true
  const showDebug = import.meta.env.DEV || window.location.search.includes('debug=true');

  if (!showDebug) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 glass rounded-lg p-4 text-xs max-w-xs">
      <div className="font-bold mb-2">Health Check</div>
      <div className="space-y-1">
        <div>Service Worker: {health.serviceWorker}</div>
        <div>IndexedDB: {health.indexedDB}</div>
        <div>LocalStorage: {health.localStorage}</div>
        <div>Network: {health.online}</div>
      </div>
    </div>
  );
}
