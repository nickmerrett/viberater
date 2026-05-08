import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { useDataStore } from './store/useDataStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SharedIdea from './pages/SharedIdea';
import ErrorBoundary from './components/ErrorBoundary';

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function App() {
  useEffect(() => {
    if (window.location.pathname.startsWith('/share')) return;
    const init = async () => {
      try {
        console.log('[App] Initializing database...');
        await useDataStore.getState().initialize();
        console.log('[App] Database initialized successfully');
      } catch (error) {
        console.error('[App] Failed to initialize:', error);
      }
    };
    init();
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/share/:token" element={<SharedIdea />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
