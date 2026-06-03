import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useParcels } from '../context/ParcelContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Sprout, ChevronRight, PlusCircle, Search, AlertTriangle, ArrowRight, Settings as SettingsIcon, X, CheckCircle, Activity, Lock } from 'lucide-react';
import { getBackendUrl } from '../utils/geeService';
import { getPhenologyEstimate, getFieldHealth } from '../utils/agronomy';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { parcels, loading } = useParcels();
  const { currentUser, profile } = useAuth();
  const { t } = useSettings();
  const [backendActive, setBackendActive] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  
  const canEdit = profile?.role === 'administrator';
  const roleName = profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'Researcher';
  
  // Calculate dynamic health for parcels based on agronomy logic
  const activeParcels = useMemo(() => {
     return parcels.map(p => {
         const dap = p.date ? Math.floor(Math.abs(new Date().getTime() - new Date(p.date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
         // very rough center proxy
         const lat = p.boundary && Array.isArray(p.boundary) && p.boundary.length > 0 ? 
                     (Array.isArray(p.boundary[0]) ? (p.boundary[0][0] as any)?.lat || 50 : (p.boundary[0] as any).lat || 50) : 50;
         
         const phenology = getPhenologyEstimate(p.crop, dap, lat, 20, 10);
         const currentNdvi = p.ndvi || 0;
         // mock previous ndvi from history if available or default
         const prevNdvi = p.ndviHistory && p.ndviHistory.length > 1 ? p.ndviHistory[1].ndvi : Math.max(0, currentNdvi - 0.05); 
         
         const health = getFieldHealth(currentNdvi, prevNdvi, phenology.progress);
         
         return {
             ...p,
             dynamicStatus: health.status,
             bbch: phenology.bbch,
             trend: health.trend
         };
     });
  }, [parcels]);

  const problemParcels = activeParcels.filter(p => p.dynamicStatus === 'Critical' || p.dynamicStatus === 'Warning');

  useEffect(() => {
    // Show welcome banner if redirecting from login
    if (location.state?.justLoggedIn) {
      setShowWelcome(true);
      // Automatically hide after 5 seconds
      const timer = setTimeout(() => setShowWelcome(false), 5000);
      
      // Clear location state to prevent banner on refresh
      window.history.replaceState({}, document.title);
      
      return () => clearTimeout(timer);
    }
  }, [location]);

  useEffect(() => {
    const checkBackend = async () => {
      const url = getBackendUrl();
      if (!url) {
        setBackendActive(false);
        return;
      }
      try {
        const res = await fetch(`${url}/`, { headers: { 'ngrok-skip-browser-warning': 'true' }});
        setBackendActive(res.ok);
      } catch (e) {
        setBackendActive(false);
      }
    };
    checkBackend();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-800"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Welcome Message Banner */}
      {showWelcome && (
        <div className="bg-emerald-600 text-white rounded-xl p-4 flex items-center justify-between shadow-lg animate-in slide-in-from-top-4 fade-in duration-500">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <CheckCircle size={20} />
            </div>
            <div>
              <h4 className="font-bold text-base">Welcome back, {currentUser?.email?.split('@')[0] || 'Operator'}!</h4>
              <p className="text-sm text-emerald-50">You have successfully logged into your AgriNorr dashboard.</p>
            </div>
          </div>
          <button 
            onClick={() => setShowWelcome(false)}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* Backend Warning Banner */}
      {!backendActive && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-lg text-amber-700">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">Backend Connection Required</h4>
              <p className="text-xs text-amber-700">Satellite analysis and 3D globe layers will be unavailable until you update your ngrok URL.</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors shadow-sm"
          >
            <SettingsIcon size={14} />
            Configure Backend
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm min-h-0">
        {/* Left Panel: List of Fields */}
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col bg-white flex-shrink-0 max-h-80 md:max-h-none">
          <div className="p-4 md:p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
            {canEdit ? (
              <button 
                onClick={() => navigate('/map')}
                className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors"
                title="Add New Field"
              >
                <PlusCircle size={20} />
              </button>
            ) : (
              <div 
                className="text-gray-400 p-1.5 rounded-lg cursor-not-allowed"
                title="Only administrators can add fields"
              >
                <Lock size={16} />
              </div>
            )}
          </div>
          
          {/* Search Bar */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search fields..." 
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeParcels.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center">
                <div className="rounded-xl overflow-hidden shadow-sm mb-3">
                  <img src="https://i.postimg.cc/3NWz4Xs6/Chat-GPT-Image-May-12-2026-05-00-44-PM.png" alt="AgriNorr" className="w-12 h-12 object-contain opacity-75" />
                </div>
                <p className="text-sm text-gray-500 mb-2">No fields yet.</p>
                <button 
                  onClick={() => navigate('/map')}
                  className="text-xs text-emerald-600 font-medium hover:underline"
                >
                  Create your first field
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {activeParcels.map((parcel) => (
                  <li 
                    key={parcel.id}
                    onClick={() => navigate(`/field/${parcel.id}`)}
                    className="group hover:bg-emerald-50/50 cursor-pointer transition-colors p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-emerald-900">
                            {parcel.name}
                          </h3>
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5 mb-1.5">
                          {parcel.crop} • {parcel.size} ha
                        </p>
                        <div className="flex items-center flex-wrap gap-2">
                           {parcel.dynamicStatus && (
                              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full ${
                                  parcel.dynamicStatus === 'Healthy' ? 'bg-emerald-100 text-emerald-700' :
                                  parcel.dynamicStatus === 'Watch' ? 'bg-blue-100 text-blue-700' :
                                  parcel.dynamicStatus === 'Warning' ? 'bg-amber-100 text-amber-700' :
                                  parcel.dynamicStatus === 'Critical' ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-600'
                              }`}>
                                  {parcel.dynamicStatus}
                              </span>
                           )}
                           <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-md border border-gray-100">
                               BBCH {parcel.bbch}
                           </span>
                           {parcel.ndvi && parcel.ndvi > 0 ? (
                               <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-0.5">
                                 <Activity size={10} /> {parcel.ndvi.toFixed(2)}
                                 {parcel.trend === 'up' ? ' ↑' : parcel.trend === 'down' ? ' ↓' : ' ↔'}
                               </span>
                           ) : null}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-emerald-500 flex-shrink-0 ml-2" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <div className="p-3 border-t border-gray-100 bg-gray-50 text-xs text-center text-gray-400 flex-shrink-0">
            {parcels.length} {parcels.length === 1 ? 'Field' : 'Fields'} Total
          </div>
        </div>

        {/* Right Panel: Overview Insights */}
        <div className="flex-1 bg-gray-50/30 p-4 md:p-8 overflow-y-auto w-full">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4 mb-6 md:mb-8">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1 flex items-center flex-wrap gap-2">
                  <span>{t('welcome.back')}, {profile?.firstName || profile?.employeeId || currentUser?.email?.split('@')[0] || 'Operator'}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full uppercase tracking-wide border border-gray-200">{roleName}</span>
                </h2>
                <p className="text-sm text-gray-500">
                  Select a field from the list or explore your farm overview.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 md:gap-3">
                <button 
                  onClick={() => navigate('/map')}
                  className="px-3 py-2 md:px-4 md:py-2 bg-emerald-800 text-white rounded-lg text-xs md:text-sm font-medium hover:bg-emerald-900 transition-colors shadow-sm flex-1 sm:flex-none text-center"
                >
                  Map View
                </button>
                <button 
                  onClick={() => navigate('/globe')}
                  className="px-3 py-2 md:px-4 md:py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs md:text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm flex-1 sm:flex-none text-center"
                >
                  Explore in 3D
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* Quick Stats */}
               <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                 <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4"><AlertTriangle className="text-amber-500" size={18}/> Priority Alerts</h3>
                 {problemParcels.length > 0 ? (
                    <ul className="space-y-3">
                      {problemParcels.slice(0,3).map(p => (
                         <li key={p.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <div>
                               <p className="font-semibold text-sm text-gray-900">{p.name}</p>
                               <p className="text-xs text-gray-500">{p.crop}</p>
                            </div>
                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${
                                p.dynamicStatus === 'Warning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                            }`}>
                               {p.dynamicStatus}
                            </span>
                         </li>
                      ))}
                    </ul>
                 ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center bg-emerald-50/50 rounded-lg border border-emerald-100">
                      <div className="p-2 bg-emerald-100 text-emerald-600 rounded-full mb-2">
                         <CheckCircle size={20} />
                      </div>
                      <p className="text-sm font-bold text-emerald-900">All fields are healthy</p>
                      <p className="text-xs text-emerald-700 mt-1">No immediate action required on your registered parcels.</p>
                    </div>
                 )}
               </div>

               {/* Market Overview */}
               {(profile?.role === 'administrator' || profile?.role === 'operator') && (
                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                   <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">Commodity Trends</h3>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-gray-50">
                          <div>
                             <p className="font-semibold text-sm text-gray-900">Milling Wheat</p>
                             <p className="text-[10px] text-gray-500">CBOT MAR 26</p>
                          </div>
                          <div className="text-right">
                             <p className="font-bold text-sm text-gray-900">€224.50</p>
                             <p className="text-[10px] text-emerald-600 font-bold">+1.2%</p>
                          </div>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-50">
                          <div>
                             <p className="font-semibold text-sm text-gray-900">Corn (Maize)</p>
                             <p className="text-[10px] text-gray-500">CBOT MAY 26</p>
                          </div>
                          <div className="text-right">
                             <p className="font-bold text-sm text-gray-900">€189.20</p>
                             <p className="text-[10px] text-red-500 font-bold">-0.4%</p>
                          </div>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-50">
                          <div>
                             <p className="font-semibold text-sm text-gray-900">Rapeseed</p>
                             <p className="text-[10px] text-gray-500">EURONEXT AUG 26</p>
                          </div>
                          <div className="text-right">
                             <p className="font-bold text-sm text-gray-900">€460.00</p>
                             <p className="text-[10px] text-emerald-600 font-bold">+0.8%</p>
                          </div>
                      </div>
                   </div>
                 </div>
               )}
            </div>
            
            {(profile?.role === 'administrator' || profile?.role === 'operator') && (
              <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-xl overflow-hidden shadow-lg border border-emerald-900 flex text-white relative">
                 <div className="p-8 z-10 w-2/3">
                    <h3 className="text-xl font-bold mb-3">Optimize Your Harvest</h3>
                    <p className="text-sm text-emerald-100/90 leading-relaxed max-w-lg mb-6">
                      Connect your John Deere Operations Center or Case IH AFS Connect directly to AgriNorr. Synthesize satellite biomass data with local yields for unmatched precision.
                    </p>
                    <button className="px-5 py-2 bg-white text-emerald-900 text-sm font-bold rounded-lg shadow-sm hover:bg-gray-50 transition-colors">
                      Connect Machinery
                    </button>
                 </div>
                 <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-20 pointer-events-none" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1592982537447-6f23f6ebecaf?q=80')", backgroundSize: 'cover', backgroundPosition: 'center', mixBlendMode: 'luminosity' }}></div>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
};