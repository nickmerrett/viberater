import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useDataStore } from '../store/useDataStore';
import { usePWAInstall } from '../hooks/usePWAInstall';
import CaptureChat from '../components/CaptureChat';
import IdeasView from '../components/IdeasView';
import ProjectsView from '../components/ProjectsView';
import RemindersView from '../components/RemindersView';
import AreaFilter from '../components/AreaFilter';
import AreasSettings from '../components/AreasSettings';
import { useAreaStore } from '../store/useAreaStore';
import PWAInstallPrompt from '../components/PWAInstallPrompt';
import OfflineIndicator from '../components/OfflineIndicator';
import HealthCheck from '../components/HealthCheck';
import MobileConsole from '../components/MobileConsole';
import UpdatePrompt from '../components/UpdatePrompt';
import { VERSION, BUILD_ID } from '../version';
import { getSetting, setSetting } from '../services/settings';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const fetchAreas = useAreaStore(s => s.fetch);
  const activeArea = useAreaStore(s => s.activeArea);
  const { install, canInstall, isInstalled } = usePWAInstall();
  const [activeTab, setActiveTab] = useState('capture');
  const [showAreasSettings, setShowAreasSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [batchGap, setBatchGap] = useState(() => getSetting('batchGapSeconds'));

  // Debug PWA install state
  useEffect(() => {
    console.log('[Dashboard] PWA Install State:', { canInstall, isInstalled });
  }, [canInstall, isInstalled]);

  useEffect(() => {
    fetchAreas();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleInstall = async () => {
    setShowMenu(false);
    await install();
  };

  const tabs = [
    { id: 'capture', label: '💬 Capture' },
    { id: 'ideas', label: '💡 Ideas' },
    { id: 'projects', label: '🚀 Projects' },
    { id: 'reminders', label: '🔔 Reminders' },
  ];

  return (
    <>
      <PWAInstallPrompt />
      <OfflineIndicator />
      <HealthCheck />
      <UpdatePrompt />
      <MobileConsole isOpen={showConsole} onClose={() => setShowConsole(false)} />
      <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="glass border-b border-white/10 px-4 py-2 sm:px-6 sm:py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-lg sm:text-2xl font-bold bg-gradient-accent bg-clip-text text-transparent">
            viberater
          </h1>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-sm text-gray-400">
              {user?.name}
            </div>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-8 h-8 rounded-lg glass hover:bg-white/5 flex items-center justify-center transition-all text-sm"
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
              onClick={() => { setShowMenu(false); setShowAreasSettings(true); }}
              className="w-full text-left px-4 py-2 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-2 mb-2"
            >
              <span>🗂️</span>
              <span>Manage Areas</span>
            </button>

            <div className="px-4 py-2 mb-2">
              <div className="text-xs text-gray-500 mb-1.5">Offline batch gap</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={batchGap}
                  onChange={e => {
                    const v = Math.max(1, Math.min(60, parseInt(e.target.value) || 5));
                    setBatchGap(v);
                    setSetting('batchGapSeconds', v);
                  }}
                  className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-center outline-none focus:border-primary/40"
                />
                <span className="text-xs text-gray-400">seconds between messages</span>
              </div>
            </div>

            <button
              onClick={() => { setShowMenu(false); setShowConsole(true); }}
              className="w-full text-left px-4 py-2 rounded-lg hover:bg-white/5 text-gray-400 transition-colors flex items-center gap-2 mb-2"
            >
              <span>🐛</span>
              <span>Console</span>
            </button>

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
      <nav className="glass border-b border-white/10 px-3 py-1.5 sm:px-6 sm:py-2 flex gap-1.5 flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-3 py-1.5 sm:px-5 sm:py-2 rounded-lg text-sm font-medium transition-all duration-300
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

      {showAreasSettings && <AreasSettings onClose={() => setShowAreasSettings(false)} />}

      {/* Area Filter */}
      <AreaFilter />

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'capture' && <CaptureChat onNavigate={setActiveTab} />}
        {activeTab === 'ideas' && <IdeasView activeArea={activeArea} />}
        {activeTab === 'projects' && <ProjectsView activeArea={activeArea} />}
        {activeTab === 'reminders' && <RemindersView activeArea={activeArea} />}

        {/* Version Footer */}
        <div className="absolute bottom-2 left-4 text-xs text-gray-600 pointer-events-none">
          v{VERSION} <span className="text-gray-700">• {BUILD_ID}</span>
        </div>
      </main>
    </div>
    </>
  );
}
