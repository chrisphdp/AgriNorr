import React, { useState, useEffect } from 'react';
import { Save, Satellite, Key, CheckCircle, Server, ExternalLink, Activity, Wifi, WifiOff, Loader2, ShieldAlert, Terminal, AlertTriangle, ToggleLeft, ToggleRight, Zap, Moon, Sun, Globe, Bell, BellOff, Ruler, Palette, Users } from 'lucide-react';
import { DEFAULT_API_KEY, getApiKey } from '../utils/agromonitoring';
import { DEFAULT_BACKEND_URL, getBackendUrl } from '../utils/geeService';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useAuth, UserRole } from '../context/AuthContext';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { t, theme: ctxTheme, setTheme: ctxSetTheme, language: ctxLanguage, setLanguage: ctxSetLanguage, notifications: ctxNotifications, setNotifications: ctxSetNotifications, units: ctxUnits, setUnits: ctxSetUnits } = useSettings();
  const { profile, updateRole } = useAuth();
  
  const [apiKey, setApiKey] = useState('');
  const [backendUrl, setBackendUrl] = useState('');
  const [simulationMode, setSimulationMode] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // New Settings State
  const [theme, setTheme] = useState<'light' | 'dark'>(ctxTheme);
  const [language, setLanguage] = useState(ctxLanguage);
  const [notifications, setNotifications] = useState(ctxNotifications);
  const [units, setUnits] = useState<'metric' | 'imperial'>(ctxUnits);
  
  const [role, setRole] = useState<UserRole>(profile?.role || 'researcher');
  
  // Connection Testing State
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [mixedContentWarning, setMixedContentWarning] = useState(false);

  useEffect(() => {
    // Load existing keys and settings
    setApiKey(getApiKey());
    setBackendUrl(getBackendUrl());
    setSimulationMode(localStorage.getItem('gee_simulation_mode') === 'true');

    // Check if we are in a Mixed Content scenario (HTTPS app, but default HTTP backend)
    const isHttps = window.location.protocol === 'https:';
    if (isHttps) {
      setMixedContentWarning(true);
    }
  }, []);

  const cleanUrl = (input: string) => {
      let cleaned = input.trim();
      // Common copy paste error fix
      if (cleaned.includes(' (0.0.0.0)')) {
          cleaned = cleaned.replace(' (0.0.0.0)', '');
      }
      if (cleaned.endsWith('/')) {
          cleaned = cleaned.slice(0, -1);
      }
      if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
          cleaned = 'http://' + cleaned;
      }
      return cleaned;
  };

  useEffect(() => {
    if (profile?.role) {
      setRole(profile.role);
    }
  }, [profile?.role]);

  const handleSave = async () => {
    const cleanedUrl = cleanUrl(backendUrl);

    localStorage.setItem('agro_api_key', apiKey.trim());
    localStorage.setItem('gee_backend_url', cleanedUrl || DEFAULT_BACKEND_URL);
    localStorage.setItem('gee_simulation_mode', String(simulationMode));
    
    // Save new settings
    ctxSetTheme(theme);
    ctxSetLanguage(language as any);
    ctxSetNotifications(notifications);
    ctxSetUnits(units);
    
    if (role !== profile?.role) {
      try {
        await updateRole(role);
      } catch (err) {
        console.error("Failed to update role", err);
      }
    }
    
    setBackendUrl(cleanedUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestConnection = async () => {
      if (simulationMode) {
          setTestStatus('success');
          setTestMessage('Offline Mode Active (Network Bypassed)');
          return;
      }

      setTestStatus('testing');
      setTestMessage('');
      
      const url = cleanUrl(backendUrl || DEFAULT_BACKEND_URL);
      setBackendUrl(url); // Update UI with cleaned URL

      // Check for Mixed Content warning
      const isAppHttps = window.location.protocol === 'https:';
      const isTargetHttp = url.startsWith('http://');
      
      if (isAppHttps && isTargetHttp) {
          setMixedContentWarning(true);
          console.warn("Attempting Mixed Content Request (HTTPS -> HTTP)...");
      }

      try {
          // Add ngrok header to bypass warning page
          const res = await fetch(`${url}/?t=${Date.now()}`, {
              headers: { 'ngrok-skip-browser-warning': 'true' }
          });
          
          if (res.ok) {
              setTestStatus('success');
              setTestMessage('Connected successfully!');
          } else {
              setTestStatus('error');
              setTestMessage(`Server responded with ${res.status}`);
          }
      } catch (err: any) {
          console.error(err);
          setTestStatus('error');
          
          if (isAppHttps && isTargetHttp) {
              setTestMessage('Blocked by Browser. Use the ngrok HTTPS URL.');
          } else {
              setTestMessage('Connection refused. Is the server running?');
          }
      }
  };

  return (
        <div className="max-w-4xl mx-auto pb-12 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t('nav.settings')}</h1>
                    <p className="text-gray-500 dark:text-gray-400">Configure your data providers and application preferences.</p>
                </div>
                <button 
                    onClick={handleSave}
                    className="bg-emerald-800 hover:bg-emerald-900 text-white px-8 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                    {saved ? <CheckCircle size={20} /> : <Save size={20} />}
                    {saved ? 'Settings Saved' : 'Save Configuration'}
                </button>
            </div>

      {/* User Profile & Demo RBAC Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-colors">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-blue-800 dark:text-blue-400">
                <Users size={24} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Access Management</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Adjust your account clearance level for testing.</p>
             </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Users size={16} className="text-gray-400 dark:text-gray-500" />
              Role Simulator
            </label>
            <div className="flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                onClick={() => setRole('administrator')}
                className={`px-4 py-2 text-sm font-medium border rounded-l-lg flex flex-1 items-center justify-center gap-2 transition-colors ${
                  role === 'administrator' 
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 z-10' 
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
              >
                Administrator
              </button>
              <button
                type="button"
                onClick={() => setRole('operator')}
                className={`px-4 py-2 text-sm font-medium border-t border-b border-gray-200 flex flex-1 items-center justify-center gap-2 transition-colors ${
                  role === 'operator' 
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 z-10 border-l border-r' 
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 border-l-0 border-r-0 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
              >
                Operator
              </button>
              <button
                type="button"
                onClick={() => setRole('researcher')}
                className={`px-4 py-2 text-sm font-medium border-t border-b border-gray-200 flex flex-1 items-center justify-center gap-2 transition-colors ${
                  role === 'researcher' 
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 z-10 border-l border-r' 
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 border-l-0 border-r-0 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
              >
                Researcher
              </button>
              <button
                type="button"
                onClick={() => setRole('guest')}
                className={`px-4 py-2 text-sm font-medium border rounded-r-lg flex flex-1 items-center justify-center gap-2 transition-colors ${
                  role === 'guest' 
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 z-10' 
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 border-l-0'
                }`}
              >
                Guest
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Changes will apply on save. <strong>Administrator</strong> can edit fields. <strong>Operator/Researcher/Guest</strong> have read-only access.
            </p>
          </div>
        </div>
      </div>

      {/* General Preferences */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-colors">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg text-emerald-800 dark:text-emerald-400">
                <Palette size={24} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">General Preferences</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Customize your app experience.</p>
             </div>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Theme Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Sun size={16} className="text-gray-400 dark:text-gray-500" />
              Theme Appearance
            </label>
            <div className="flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                onClick={() => { setTheme('light'); ctxSetTheme('light'); }}
                className={`px-4 py-2 text-sm font-medium border rounded-l-lg flex flex-1 items-center justify-center gap-2 transition-colors ${
                  theme === 'light' 
                    ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 z-10' 
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-emerald-600 dark:hover:text-emerald-400'
                }`}
              >
                <Sun size={16} /> Light
              </button>
              <button
                type="button"
                onClick={() => { setTheme('dark'); ctxSetTheme('dark'); }}
                className={`px-4 py-2 text-sm font-medium border -ml-px rounded-r-lg flex flex-1 items-center justify-center gap-2 transition-colors ${
                  theme === 'dark' 
                    ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 z-10' 
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-emerald-600 dark:hover:text-emerald-400'
                }`}
              >
                <Moon size={16} /> Dark
              </button>
            </div>
          </div>

          {/* Language Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Globe size={16} className="text-gray-400 dark:text-gray-500" />
              Display Language
            </label>
            <select
              value={language}
              onChange={(e) => {
                  const val = e.target.value;
                  setLanguage(val);
                  ctxSetLanguage(val as any);
              }}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm rounded-md border"
            >
              <option value="en">English</option>
              <option value="da">Danish (Dansk)</option>
              <option value="no">Norwegian (Norsk)</option>
              <option value="sv">Swedish (Svenska)</option>
            </select>
          </div>

          {/* Measurement Units */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Ruler size={16} className="text-gray-400 dark:text-gray-500" />
              Measurement Units
            </label>
            <div className="flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                onClick={() => setUnits('metric')}
                className={`px-4 py-2 text-sm font-medium border rounded-l-lg flex flex-1 items-center justify-center gap-2 transition-colors ${
                  units === 'metric' 
                    ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 z-10' 
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-emerald-600 dark:hover:text-emerald-400'
                }`}
              >
                Metric (ha, °C)
              </button>
              <button
                type="button"
                onClick={() => setUnits('imperial')}
                className={`px-4 py-2 text-sm font-medium border -ml-px rounded-r-lg flex flex-1 items-center justify-center gap-2 transition-colors ${
                  units === 'imperial' 
                    ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 z-10' 
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-emerald-600 dark:hover:text-emerald-400'
                }`}
              >
                Imperial (ac, °F)
              </button>
            </div>
          </div>

          {/* Notifications Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Bell size={16} className="text-gray-400 dark:text-gray-500" />
              System Notifications
            </label>
            <div className="flex items-center justify-between border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg p-3">
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable alerts and updates</span>
              <button 
                  onClick={() => setNotifications(!notifications)}
                  className="focus:outline-none transition-transform active:scale-95"
              >
                  {notifications 
                    ? <ToggleRight size={32} className="text-emerald-600 dark:text-emerald-400" /> 
                    : <ToggleLeft size={32} className="text-gray-300 dark:text-gray-600" />
                  }
              </button>
            </div>
          </div>
        </div>
      </div>





    </div>
  );
};