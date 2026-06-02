
import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { MapPage } from './pages/MapPage';
import { GlobePage } from './pages/GlobePage';
import { Settings } from './pages/Settings';
import { FieldDetails } from './pages/FieldDetails';
import { AiDiagnosis } from './pages/AiDiagnosis';
import { YieldPrediction } from './pages/YieldPrediction';
import { DiseasePrediction } from './pages/DiseasePrediction';
import { Subscription } from './pages/Subscription';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';

// Wrapper for protected routes
const PrivateRoute = ({ children }: { children?: React.ReactNode }) => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-emerald-800" size={40} />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isGlobeView = location.pathname === '/globe';

  return (
    <div className="flex h-screen w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Sidebar Navigation is only visible when authenticated */}
      <Sidebar />

      {/* Main Content Area */}
      <main className={`flex-1 overflow-y-auto h-full transition-all duration-200 ease-in-out ${isGlobeView ? 'p-0' : 'p-8'}`}>
        <div className={`${isGlobeView ? 'max-w-none w-full' : 'max-w-7xl mx-auto'} h-full`}>
          {children}
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        <Route path="/dashboard" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } />
        
        <Route path="/field/:id" element={
          <PrivateRoute>
            <FieldDetails />
          </PrivateRoute>
        } />
        
        <Route path="/map" element={
          <PrivateRoute>
            <MapPage />
          </PrivateRoute>
        } />

        <Route path="/globe" element={
          <PrivateRoute>
            <GlobePage />
          </PrivateRoute>
        } />
        
        <Route path="/ai" element={
          <PrivateRoute>
            <AiDiagnosis />
          </PrivateRoute>
        } />
        
        <Route path="/yield" element={
          <PrivateRoute>
            <YieldPrediction />
          </PrivateRoute>
        } />

        <Route path="/disease" element={
          <PrivateRoute>
            <DiseasePrediction />
          </PrivateRoute>
        } />

        <Route path="/subscription" element={
          <PrivateRoute>
            <Subscription />
          </PrivateRoute>
        } />
        
        <Route path="/settings" element={
          <PrivateRoute>
            <Settings />
          </PrivateRoute>
        } />
      </Routes>
    </HashRouter>
  );
};

export default App;
