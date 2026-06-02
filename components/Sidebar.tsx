import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Map as MapIcon, Settings, Sprout, LogOut, Globe, Wifi, WifiOff, Loader2, Scan, CreditCard, Database, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { getBackendUrl } from '../utils/geeService';

export const Sidebar: React.FC = () => {
  const { currentUser, logout, profile } = useAuth();
  const { t } = useSettings();
  const navigate = useNavigate();
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  
  const navItems = [
    { name: t('nav.dashboard'), path: '/dashboard', icon: LayoutDashboard },
    { name: t('nav.map'), path: '/map', icon: MapIcon },
    { name: t('nav.globe'), path: '/globe', icon: Globe },
    { name: t('nav.ai'), path: '/ai', icon: Scan },
    { name: t('nav.yield'), path: '/yield', icon: Database },
    { name: t('nav.disease'), path: '/disease', icon: ShieldAlert },
    { name: t('nav.subscription'), path: '/subscription', icon: CreditCard },
    { name: t('nav.settings'), path: '/settings', icon: Settings },
  ];

  const checkConnection = async () => {
    const url = getBackendUrl();
    if (!url) {
      setConnectionStatus('offline');
      return;
    }
    try {
      const res = await fetch(`${url}/`, { 
        headers: { 'ngrok-skip-browser-warning': 'true' },
        signal: AbortSignal.timeout(3000)
      });
      setConnectionStatus(res.ok ? 'online' : 'offline');
    } catch (e) {
      setConnectionStatus('offline');
    }
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 hidden md:flex flex-col h-full shadow-sm transition-colors duration-200">
      <div className="h-16 flex items-center px-6 border-b border-gray-100 dark:border-gray-700 gap-2">
        <div className="rounded-lg overflow-hidden flex items-center justify-center">
          <img src="https://i.postimg.cc/3NWz4Xs6/Chat-GPT-Image-May-12-2026-05-00-44-PM.png" alt="AgriNorr Logo" className="w-8 h-8 object-contain" />
        </div>
        <span className="text-xl font-bold text-emerald-950 dark:text-emerald-50 tracking-tight">AgriNorr</span>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 rounded-lg transition-colors duration-200 font-medium ${
                isActive
                  ? 'bg-emerald-50 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-400'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={20}
                  className={`mr-3 ${isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}
                />
                {item.name}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100 dark:border-gray-700 space-y-4">
        {/* Connection Status Indicator */}
        <div 
          onClick={() => navigate('/settings')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
            connectionStatus === 'online' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 
            connectionStatus === 'checking' ? 'bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400' : 
            'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
          }`}
        >
          {connectionStatus === 'checking' ? <Loader2 size={14} className="animate-spin" /> :
           connectionStatus === 'online' ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span className="text-xs font-bold uppercase tracking-wider">
            {connectionStatus === 'online' ? 'Backend Live' : 
             connectionStatus === 'checking' ? 'Connecting...' : 'Backend Offline'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-800 dark:text-emerald-400 font-bold text-sm">
            {profile?.firstName ? profile.firstName[0].toUpperCase() : (currentUser?.email ? currentUser.email[0].toUpperCase() : 'U')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate capitalize">
              {profile?.firstName ? `${profile.firstName} ${profile.lastName}` : (profile?.role || 'Researcher')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {profile?.employeeId ? `ID: ${profile.employeeId}` : currentUser?.email || 'N/A'}
            </p>
          </div>
        </div>
        
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
        >
          <LogOut size={16} />
          {t('nav.signout')}
        </button>
      </div>
    </aside>
  );
};