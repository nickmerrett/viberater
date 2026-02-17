import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useDataStore } from '../store/useDataStore';
import { usePWAInstall } from '../hooks/usePWAInstall';
import IdeasView from '../components/IdeasView';
import ProjectsView from '../components/ProjectsView';
import PWAInstallPrompt from '../components/PWAInstallPrompt';
import OfflineIndicator from '../components/OfflineIndicator';
import HealthCheck from '../components/HealthCheck';
import MobileConsole from '../components/MobileConsole';
import { VERSION, BUILD_ID } from '../version';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { install, canInstall, isInstalled } = usePWAInstall();
  const [activeTab, setActiveTab] = useState('ideas');
  const [showMenu, setShowMenu] = useState(false);

  // Debug PWA install state
  useEffect(() => {
    console.log('[Dashboard] PWA Install State:', { canInstall, isInstalled });
  }, [canInstall, isInstalled]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleInstall = async () => {
    setShowMenu(false);
    await install();
  };

  const tabs = [
    { id: 'ideas', label: '💡 Ideas', icon: '💡' },
    { id: 'projects', label: '🚀 Projects', icon: '🚀' },
  ];

  return (
    <>
      <PWAInstallPrompt />
      <OfflineIndicator />
      <HealthCheck />
      <MobileConsole />
      <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="glass border-b border-white/10 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-accent bg-clip-text text-transparent">
            viberater
          </h1>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-sm text-gray-400">
              {user?.name}
            </div>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-10 h-10 rounded-xl glass hover:bg-white/5 flex items-center justify-center transition-all"
            >
              ☰
            </button>
          </div>
        </div>
      </header>

      {/* Menu Overlay */}
      {showMenu && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="absolute right-4 top-20 glass rounded-2xl p-4 min-w-[200px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 pb-4 border-b border-white/10">
              <div className="font-medium">{user?.name}</div>
              <div className="text-sm text-gray-400">{user?.email}</div>
            </div>

            {/* Install App Option */}
            {canInstall && (
              <button
                onClick={handleInstall}
                className="w-full text-left px-4 py-2 rounded-lg hover:bg-white/5 text-primary transition-colors flex items-center gap-2 mb-2"
              >
                <span>📱</span>
                <span>Install App</span>
              </button>
            )}

            {/* Show installed status */}
            {isInstalled && (
              <div className="w-full text-left px-4 py-2 rounded-lg bg-green-500/10 text-green-400 flex items-center gap-2 mb-2">
                <span>✓</span>
                <span>App Installed</span>
              </div>
            )}

            {/* Show install instructions if not installable yet */}
            {!canInstall && !isInstalled && (
              <div className="w-full px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 text-xs mb-2">
                <div className="font-medium mb-1">📱 Install App</div>
                <div>Use Chrome menu → "Add to Home screen"</div>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 rounded-lg hover:bg-white/5 text-red-400 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="glass border-b border-white/10 px-6 py-3 flex gap-2 flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-6 py-2.5 rounded-xl font-semibold transition-all duration-300
              ${activeTab === tab.id
                ? 'bg-primary/20 text-white border border-primary shadow-lg shadow-primary/30'
                : 'glass hover:bg-white/5'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'ideas' && <IdeasView />}
        {activeTab === 'projects' && <ProjectsView />}

        {/* Version Footer */}
        <div className="absolute bottom-2 left-4 text-xs text-gray-600 pointer-events-none">
          v{VERSION} <span className="text-gray-700">• {BUILD_ID}</span>
        </div>
      </main>
    </div>
    </>
  );
}
