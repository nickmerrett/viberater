import { useState, useEffect } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export default function PWAInstallPrompt() {
  const { install, canInstall } = usePWAInstall();
  const [showPrompt, setShowPrompt] = useState(false);

  // Show prompt when installable
  useEffect(() => {
    if (canInstall) {
      setShowPrompt(true);
    }
  }, [canInstall]);

  const handleInstall = async () => {
    const installed = await install();
    if (installed) {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember dismissal for 7 days
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Check if dismissed recently
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      if (dismissedTime > sevenDaysAgo) {
        setShowPrompt(false);
      }
    }
  }, []);

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:w-96 z-50 animate-slide-up">
      <div className="glass rounded-2xl p-6 shadow-2xl border border-primary/30">
        <div className="flex items-start gap-4">
          <div className="text-4xl">📱</div>
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-2">Install viberater</h3>
            <p className="text-sm text-gray-300 mb-4">
              Install this app on your device for a better experience and offline access!
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleInstall}
                className="btn-primary flex-1"
              >
                Install
              </button>
              <button
                onClick={handleDismiss}
                className="btn-secondary"
              >
                Later
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
