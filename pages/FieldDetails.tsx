
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useParcels, Parcel } from '../context/ParcelContext';
import { fetchFieldWeather, WeatherData, getWeatherLabel, getCoordinates } from '../utils/weatherService';
import { fetchSoilData, SoilData } from '../utils/soilService';
import { NdviPoint, getNdviColor } from '../utils/ndviService';
import { getBackendUrl, fetchGeeLayer, fetchGeeTimeSeries } from '../utils/geeService';
import { getPhenologyEstimate, getFieldHealth, getYieldEstimate, getDiseaseRisk, getRecommendations } from '../utils/agronomy';
import { ArrowLeft, Wind, Droplets, Thermometer, CloudRain, Sun, Cloud, CloudLightning, Snowflake, Calendar, MapPin, Sprout, Navigation, Layers, RefreshCw, Server, Database, XCircle, Zap, Ban, Pickaxe, Scale, Loader2, AlertTriangle, Activity, FlaskConical, Stethoscope, Search, Lock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Bar, ComposedChart, Line, LineChart, ReferenceLine, Legend } from 'recharts';
import { useAuth } from '../context/AuthContext';

declare global {
  interface Window {
    google: any;
  }
}

interface FieldMonitorMapProps {
    parcel: Parcel;
    isOffline: boolean;
    updateParcel: (id: string, data: Partial<Parcel>) => Promise<void>;
}

const FieldMonitorMap: React.FC<FieldMonitorMapProps> = ({ parcel, isOffline, updateParcel }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const overlayRef = useRef<any>(null);
    
    // Updated Active Layer Type
    const [activeLayer, setActiveLayer] = useState<'ndvi' | 'ndre' | 'ndmi' | 'lai' | 'lst'>('ndvi');
    const [loadingLayer, setLoadingLayer] = useState(false);

    // Initialize Map
    useEffect(() => {
        if (!mapRef.current || !window.google) return;

        // Only initialize once
        if (mapInstanceRef.current) return;

        // Default center
        const center = { lat: 56.2639, lng: 9.5018 };

        const map = new window.google.maps.Map(mapRef.current, {
            center,
            zoom: 13,
            mapTypeId: 'hybrid', // Base is still hybrid (Satellite + Labels)
            disableDefaultUI: true,
            zoomControl: true,
            streetViewControl: false,
        });
        mapInstanceRef.current = map;
    }, []);

    // Draw Parcel & Fit Bounds
    useEffect(() => {
        if (!mapInstanceRef.current || !parcel.boundary || !window.google) return;

        const polygon = new window.google.maps.Polygon({
            paths: parcel.boundary,
            strokeColor: '#f59e0b',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#fbbf24',
            fillOpacity: 0.0,
        });
        polygon.setMap(mapInstanceRef.current);

        const bounds = new window.google.maps.LatLngBounds();
        
        if (Array.isArray(parcel.boundary)) {
            const isMulti = Array.isArray(parcel.boundary[0]);
            if (isMulti) {
                (parcel.boundary as any[]).forEach(ring => {
                    ring.forEach((p: any) => bounds.extend(p));
                });
            } else {
                 (parcel.boundary as any[]).forEach((p: any) => bounds.extend(p));
            }
        }
        
        mapInstanceRef.current.fitBounds(bounds);
        
        return () => {
            polygon.setMap(null);
        };

    }, [parcel]);

    // Handle Layer Switching
    useEffect(() => {
        if (!mapInstanceRef.current || isOffline || !parcel.boundary) return;

        const loadLayer = async () => {
            setLoadingLayer(true);
            try {
                // Clear previous overlay
                if (overlayRef.current) {
                    mapInstanceRef.current.overlayMapTypes.removeAt(0);
                    overlayRef.current = null;
                }

                const backendUrl = getBackendUrl();
                
                let tileUrl = '';
                // Check if cached layer exists and is less than 7 days old
                if (parcel.geeLayers && parcel.geeLayers[activeLayer] && (Date.now() - parcel.geeLayers[activeLayer].timestamp < 7 * 24 * 60 * 60 * 1000) && !isOffline) {
                    tileUrl = parcel.geeLayers[activeLayer].url;
                } else {
                    const result = await fetchGeeLayer(activeLayer, parcel.boundary, backendUrl);
                    tileUrl = result?.tile_url || (result as any);
                    
                    if (tileUrl && typeof tileUrl === 'string') {
                        const newGeeLayers = { ...(parcel.geeLayers || {}), [activeLayer]: { url: tileUrl, timestamp: Date.now() } };
                        updateParcel(parcel.id, { geeLayers: newGeeLayers }).catch(e => console.warn("Caching layer failed:", e));
                    }
                }
                
                if (tileUrl && typeof tileUrl === 'string') {
                    const mapType = new window.google.maps.ImageMapType({
                        getTileUrl: (coord: any, zoom: any) => {
                            return tileUrl
                                .replace('{x}', coord.x.toString())
                                .replace('{y}', coord.y.toString())
                                .replace('{z}', zoom.toString());
                        },
                        tileSize: new window.google.maps.Size(256, 256),
                        opacity: 0.85, // Balanced transparency
                        name: activeLayer
                    });

                    mapInstanceRef.current.overlayMapTypes.push(mapType);
                    overlayRef.current = mapType;
                }
            } catch (e) {
                console.error("Layer load failed", e);
            } finally {
                setLoadingLayer(false);
            }
        };

        loadLayer();
    }, [activeLayer, isOffline, parcel]);

    // Layer Buttons Configuration
    const [layers] = useState([
        { id: 'ndvi', label: 'NDVI' },
        { id: 'ndre', label: 'NDRE' },
        { id: 'ndmi', label: 'NDMI' },
        { id: 'lai', label: 'LAI' },
        { id: 'lst', label: 'LST' },
    ]);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* CSS Filter Injection for Tile Smoothing and Contrast */}
            <style>{`
                /* Target Earth Engine tiles specifically by src pattern */
                .field-map-container img[src*="earthengine.googleapis.com"] {
                    filter: contrast(1.15) saturate(1.2) brightness(1.02);
                    image-rendering: pixelated; /* Forces nearest neighbor for native resolution */
                }
            `}</style>

            <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                    <Layers size={16} /> Field Map
                </h3>
                <div className="flex bg-white border border-gray-200 rounded-lg p-0.5">
                    {layers.map(layer => (
                        <button
                            key={layer.id}
                            onClick={() => setActiveLayer(layer.id as any)}
                            disabled={isOffline}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                activeLayer === layer.id 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'text-gray-600 hover:bg-gray-50'
                            } ${isOffline ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {layer.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="relative h-[350px] w-full bg-gray-100 field-map-container">
                <div ref={mapRef} className="absolute inset-0 w-full h-full" />
                
                {loadingLayer && (
                    <div className="absolute top-4 right-4 bg-white/90 px-3 py-2 rounded-lg shadow-sm text-xs font-medium flex items-center gap-2 z-10">
                        <RefreshCw className="animate-spin text-emerald-600" size={14} />
                        Processing...
                    </div>
                )}
                
                {/* Offline Banner */}
                {isOffline && (
                    <div className="absolute inset-0 bg-white/50 flex items-center justify-center backdrop-blur-[1px] z-10">
                        <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 text-center max-w-xs">
                            <Zap size={24} className="mx-auto text-amber-500 mb-2" />
                            <p className="text-sm font-bold text-gray-900">Offline Mode</p>
                            <p className="text-xs text-gray-500 mt-1">Connect backend to view satellite layers.</p>
                        </div>
                    </div>
                )}

                {/* LEGEND OVERLAY */}
                {!loadingLayer && !isOffline && (
                    <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow border border-gray-200 text-xs z-10 pointer-events-none select-none">
                        <div className="font-bold mb-1.5 text-gray-800 uppercase tracking-wide text-[10px]">
                            {activeLayer} Scale
                        </div>
                        <div className="flex items-center gap-3">
                            {/* NDVI Scale */}
                            {activeLayer === 'ndvi' && (
                                <>
                                    <div className="flex flex-col items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#a1662f]"></span><span className="text-[9px]">0.0</span></div>
                                    <div className="flex flex-col items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#eab308]"></span><span className="text-[9px]">0.2</span></div>
                                    <div className="flex flex-col items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#84cc16]"></span><span className="text-[9px]">0.5</span></div>
                                    <div className="flex flex-col items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#22c55e]"></span><span className="text-[9px]">0.8</span></div>
                                </>
                            )}
                            
                            {/* NDRE Scale */}
                            {activeLayer === 'ndre' && (
                                <>
                                    <div className="flex flex-col items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#a1662f]"></span><span className="text-[9px]">0.0</span></div>
                                    <div className="flex flex-col items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#facc15]"></span><span className="text-[9px]">0.3</span></div>
                                    <div className="flex flex-col items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#4ade80]"></span><span className="text-[9px]">0.5</span></div>
                                    <div className="flex flex-col items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#15803d]"></span><span className="text-[9px]">0.6+</span></div>
                                </>
                            )}

                            {/* NDMI Scale */}
                            {activeLayer === 'ndmi' && (
                                <>
                                    <div className="flex flex-col items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#caf0f8]"></span><span className="text-[9px]">-0.2</span></div>
                                    <div className="flex flex-col items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#90e0ef]"></span><span className="text-[9px]">0.0</span></div>
                                    <div className="flex flex-col items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#0077b6]"></span><span className="text-[9px]">0.2</span></div>
                                    <div className="flex flex-col items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#03045e]"></span><span className="text-[9px]">0.4</span></div>
                                </>
                            )}

                            {/* LAI Scale */}
                            {activeLayer === 'lai' && (
                                <>
                                    <div className="flex flex-col items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#f7fcf5]"></span><span className="text-[9px]">0</span></div>
                                    <div className="flex flex-col items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#caeac3]"></span><span className="text-[9px]">1</span></div>
                                    <div className="flex flex-col items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#2a924a]"></span><span className="text-[9px]">3</span></div>
                                    <div className="flex flex-col items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#00441b]"></span><span className="text-[9px]">5+</span></div>
                                </>
                            )}

                            {/* LST Scale */}
                            {activeLayer === 'lst' && (
                                <>
                                    <div className="flex flex-col items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500"></span><span className="text-[9px]">15°C</span></div>
                                    <div className="flex flex-col items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400"></span><span className="text-[9px]">25°C</span></div>
                                    <div className="flex flex-col items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span><span className="text-[9px]">35°C</span></div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const FieldDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { parcels, updateParcel } = useParcels();
  const { profile } = useAuth();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  
  // Soil State
  const [soil, setSoil] = useState<SoilData | null>(null);
  const [loadingSoil, setLoadingSoil] = useState(true);

  const [loading, setLoading] = useState(true);
  
  // Data State
  const [ndviHistory, setNdviHistory] = useState<NdviPoint[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [dataSource, setDataSource] = useState<'gee' | 'saved' | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'management'>('overview');

  // Check Offline Mode
  const isOffline = localStorage.getItem('gee_simulation_mode') === 'true';

  // Find the parcel
  const parcel = parcels.find(p => p.id === id);

  // Helper to safely parse dates
  const isValidDate = (d: Date) => d instanceof Date && !isNaN(d.getTime());

  // Helper to fetch GEE data and save it
  const fetchAndSaveStats = async (currentParcel: Parcel) => {
      if (!currentParcel.boundary) return;
      
      setLoadingStats(true);
      setBackendError(null); // Reset error
      
      try {
          const backendUrl = getBackendUrl();
          
          // Calculate Date Range:
          // Start = Planting Date - 10 days (to capture one overpass before)
          // End = Today
          
          // Validate Planting Date
          let pDate = currentParcel.date ? new Date(currentParcel.date) : new Date();
          if (!isValidDate(pDate)) {
             console.warn("Invalid parcel date detected, defaulting to today.");
             pDate = new Date();
          }

          const startDateObj = new Date(pDate);
          startDateObj.setDate(startDateObj.getDate() - 10);
          
          // Ensure startDateObj didn't become invalid (e.g. overflow)
          if (!isValidDate(startDateObj)) {
              startDateObj.setTime(Date.now());
          }

          const startDate = startDateObj.toISOString().split('T')[0];
          const endDate = new Date().toISOString().split('T')[0];

          const realData = await fetchGeeTimeSeries(currentParcel.boundary, startDate, endDate, backendUrl);
          
          if (realData && realData.length > 0) {
              setNdviHistory(realData);
              setDataSource('gee');
              
              // CRITICAL FIX: Stop loading immediately so user sees the chart.
              // We do the saving in the background.
              setLoadingStats(false);

              // Cache REAL data in background
              updateParcel(currentParcel.id, { 
                  ndviHistory: realData,
                  lastAgroSync: Date.now() 
              }).catch(err => console.warn("Background save failed:", err));

          } else {
              // Backend returned empty data or was skipped
              if (currentParcel.ndviHistory && currentParcel.ndviHistory.length > 0) {
                  setNdviHistory(currentParcel.ndviHistory);
                  setDataSource('saved');
              } else {
                  setNdviHistory([]);
                  setDataSource(null);
              }
              setLoadingStats(false);
          }
      } catch(e: any) {
          console.error("GEE Connection Failed:", e);
          setBackendError(e.message || "Failed to connect to backend server.");
          
          // Fallback logic to saved data only
          if (currentParcel.ndviHistory && currentParcel.ndviHistory.length > 0) {
               setNdviHistory(currentParcel.ndviHistory);
               setDataSource('saved');
          } else {
               setNdviHistory([]);
               setDataSource(null);
          }
          setLoadingStats(false);
      }
  };

  useEffect(() => {
    const initData = async () => {
        if (!parcel) return;

        const { lat, lng } = getCoordinates(parcel.location);

        // 1. Load Weather
        if (parcel.weatherCache && (Date.now() - parcel.weatherCache.timestamp < 12 * 60 * 60 * 1000) && !isOffline) {
            setWeather(parcel.weatherCache.data);
            setLoading(false);
        } else {
            fetchFieldWeather(lat, lng)
                .then(data => {
                    setWeather(data);
                    setLoading(false);
                    updateParcel(parcel.id, { weatherCache: { data, timestamp: Date.now() } }).catch(e => console.warn(e));
                })
                .catch((err) => {
                    console.warn("Weather load failed:", err);
                    setLoading(false);
                });
        }
            
        // 2. Load Soil Data
        setLoadingSoil(true);
        if (parcel.soilCache && (Date.now() - parcel.soilCache.timestamp < 30 * 24 * 60 * 60 * 1000) && !isOffline) {
            setSoil(parcel.soilCache.data);
            setLoadingSoil(false);
        } else {
            fetchSoilData(lat, lng)
                .then(data => {
                    setSoil(data);
                    updateParcel(parcel.id, { soilCache: { data, timestamp: Date.now() } }).catch(e => console.warn(e));
                })
                .catch((err) => console.warn("Soil load failed:", err))
                .finally(() => setLoadingSoil(false));
        }

        // 3. Load Stats
        // Check if we have saved data first (Fast Load)
        if (parcel.ndviHistory && parcel.ndviHistory.length > 0 && !isOffline) {
            setNdviHistory(parcel.ndviHistory);
            setDataSource('saved');
            
            // Optional: Background refresh if data is old (> 24 hours)
            const oneDay = 24 * 60 * 60 * 1000;
            if (parcel.lastAgroSync && (Date.now() - parcel.lastAgroSync > oneDay)) {
                fetchAndSaveStats(parcel);
            }
        } else {
            fetchAndSaveStats(parcel);
        }
    };

    initData();
  }, [parcel?.id]); 

  if (!parcel) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <h2 className="text-xl font-bold text-gray-800">Field Not Found</h2>
        <button onClick={() => navigate('/dashboard')} className="text-emerald-600 hover:underline">Return to Dashboard</button>
      </div>
    );
  }

  const getWeatherIcon = (code: number, size = 32) => {
    if (code === 0 || code === 1) return <Sun className="text-amber-500" size={size} />;
    if (code === 2 || code === 3) return <Cloud className="text-gray-500" size={size} />;
    if (code >= 51 && code <= 67) return <CloudRain className="text-blue-400" size={size} />;
    if (code >= 71 && code <= 77) return <Snowflake className="text-cyan-400" size={size} />;
    if (code >= 95) return <CloudLightning className="text-purple-500" size={size} />;
    return <Cloud className="text-gray-400" size={size} />;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (!isValidDate(date)) return dateStr;
    try {
        return new Intl.DateTimeFormat('en-DK', { weekday: 'short', day: 'numeric' }).format(date);
    } catch (e) { return dateStr; }
  };
  
  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (!isValidDate(date)) return '';
    try {
        return new Intl.DateTimeFormat('en-DK', { weekday: 'short' }).format(date);
    } catch (e) { return ''; }
  };

  const getCardinalDirection = (deg: number) => {
    const val = Math.floor((deg / 22.5) + 0.5);
    const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return arr[val % 16];
  };

  const currentNdvi = ndviHistory.length > 0 ? ndviHistory[ndviHistory.length - 1].value : 0;

  // Helper to format Soil Values or return N/A
  const formatSoilValue = (val: number | null, unit: string = '') => {
      if (val === null || val === undefined) return 'N/A';
      return `${val}${unit}`;
  };

  const getBarWidth = (val: number | null) => val === null ? 0 : val;

  // Farm Phenology & Scientific Calculations
  const getParcelCenter = (boundary: any) => {
      if (!boundary) return { lat: 50, lng: 10 };
      let sumLat = 0, sumLng = 0, count = 0;
      const rings = Array.isArray(boundary[0]) && Array.isArray(boundary[0][0]) ? boundary : [boundary];
      rings.forEach((ring: any) => {
          if (Array.isArray(ring)) {
              ring.forEach((pt: any) => {
                  if (typeof pt.lat === 'number') { sumLat += pt.lat; sumLng += pt.lng; count++; }
              });
          }
      });
      return count > 0 ? { lat: sumLat/count, lng: sumLng/count } : { lat: 50, lng: 10 };
  };

  const centerLat = getParcelCenter(parcel.boundary).lat;
  const dap = parcel.date ? Math.floor(Math.abs(new Date().getTime() - new Date(parcel.date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  
  // Use real weather average based on available weather or default
  const avgTMax = weather && weather.daily.length > 0 ? weather.daily[0].maxTemp : 20;
  const avgTMin = weather && weather.daily.length > 0 ? weather.daily[0].minTemp : 10;
  
  const phenology = getPhenologyEstimate(parcel.crop, dap, centerLat, avgTMax, avgTMin);
  
  const previousNdvi = ndviHistory.length > 1 ? ndviHistory[1].ndvi : 0.4;
  const health = getFieldHealth(currentNdvi, previousNdvi, phenology.progress);
  
  const yieldEst = getYieldEstimate(parcel.crop, currentNdvi, parcel.size, health.score, phenology.progress);
  
  const diseaseRisk = getDiseaseRisk(weather && weather.daily.length > 0 ? { tMax: weather.daily[0].maxTemp, tMin: weather.daily[0].minTemp, rainfall: weather.daily[0].rainSum, humidity: weather.current.humidity } : { tMax: 20, tMin: 10, rainfall: 0, humidity: 50 }, phenology.bbch);
  
  const recommendedActions = getRecommendations(phenology, health, diseaseRisk);

  const cropIntelligence = {
      dap,
      centerLat,
      ...phenology,
      yieldEst,
      climateFactor: Math.max(0.7, Math.min(1.5, 1 + ((Math.abs(centerLat) - 40) * 0.025))) // Kept for UI display compatibility
  };


  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
        >
            <ArrowLeft size={20} />
        </button>
        <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                {parcel.name} 
                <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                    {parcel.size} ha
                </span>
            </h1>
            <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-1">
                <MapPin size={14} /> {parcel.location}
            </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mt-2 mb-6 gap-6">
          <button 
             onClick={() => setActiveTab('overview')}
             className={`pb-3 border-b-2 font-bold text-sm transition-colors ${activeTab === 'overview' ? 'border-emerald-600 text-emerald-800' : 'text-gray-500 hover:text-gray-800 border-transparent'}`}
          >
             Environmental Overview
          </button>
          <button 
             onClick={() => setActiveTab('management')}
             className={`pb-3 border-b-2 font-bold text-sm transition-colors ${activeTab === 'management' ? 'border-emerald-600 text-emerald-800' : 'text-gray-500 hover:text-gray-800 border-transparent'}`}
          >
             Crop Management
          </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Field Overview & Map */}
        <div className="space-y-6">
            
            {/* Field Monitor Map */}
            <FieldMonitorMap parcel={parcel} isOffline={isOffline} updateParcel={updateParcel} />
        </div>

        {/* Right Column: Dynamic Tab Content */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* -------------------- CROP MANAGEMENT TAB -------------------- */}
            {activeTab === 'management' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Sprout className="text-emerald-600" size={20}/> Crop Intelligence
                </h3>
                
                {/* Growth Stage Progress */}
                <div className="mb-6">
                    <div className="flex justify-between items-end mb-1">
                        <span className="text-xs font-bold text-gray-500 uppercase">BBCH {cropIntelligence.bbch}</span>
                        <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">{cropIntelligence.stage}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden my-2">
                        <div 
                            className="bg-emerald-500 h-2.5 rounded-full transition-all duration-1000 relative" 
                            style={{ width: `${cropIntelligence.progress}%` }}
                        >
                            <div className="absolute top-0 right-0 bottom-0 w-8 bg-white/20 animate-pulse"></div>
                        </div>
                    </div>
                    <div className="flex justify-between items-start mt-2">
                        <p className="text-[10px] text-gray-400 max-w-[60%]">{cropIntelligence.desc}</p>
                        <div className="text-right">
                           <p className="text-[10px] font-bold text-gray-500">{Math.abs(cropIntelligence.centerLat).toFixed(1)}° {cropIntelligence.centerLat >= 0 ? 'N' : 'S'} Adjusted</p>
                           <p className="text-[10px] text-emerald-600 font-medium">Est {cropIntelligence.estimatedGDD} GDD</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-t border-gray-50">
                        <span className="text-gray-500 text-sm flex items-center gap-2">
                            <Layers size={14} className="text-emerald-600" /> Crop Type
                        </span>
                        <span className="font-bold text-gray-900">{parcel.crop}</span>
                    </div>
                    
                    <div className="flex justify-between items-center py-2 border-t border-gray-50">
                        <span className="text-gray-500 text-sm flex items-center gap-2">
                            <Calendar size={14} className="text-emerald-600" /> Sowing Date
                        </span>
                        <span className="font-bold text-gray-900">{parcel.date}</span>
                    </div>

                    <div className="flex justify-between items-center py-2 border-t border-gray-50">
                        <span className="text-gray-500 text-sm flex items-center gap-2">
                            <Sun size={14} className="text-amber-500" /> Climate Mod.
                        </span>
                        <span className="font-bold text-gray-900 text-sm">
                            {cropIntelligence.climateFactor > 1 
                               ? `Cooler (x${cropIntelligence.climateFactor.toFixed(2)})` 
                               : `Warmer (x${cropIntelligence.climateFactor.toFixed(2)})`}
                        </span>
                    </div>
                    
                    <div className="flex justify-between items-center py-2 border-t border-gray-50">
                        <span className="text-gray-500 text-sm flex items-center gap-2">
                            <Stethoscope size={14} className="text-indigo-500" /> Plant Health Risk
                        </span>
                        <div className="text-right">
                           <span className={`font-bold text-sm ${health.status === 'Critical' ? 'text-red-600' : health.status === 'Warning' ? 'text-amber-600' : health.status === 'Watch' ? 'text-blue-600' : 'text-emerald-600'}`}>
                               {health.status} ({health.score}/100)
                           </span>
                           {health.anomalies.length > 0 && <p className="text-[10px] text-gray-500 max-w-[140px] truncate">{health.anomalies[0]}</p>}
                        </div>
                    </div>

                    <div className="flex justify-between items-center py-2 border-t border-gray-50">
                        <span className="text-gray-500 text-sm flex items-center gap-2">
                            <Activity size={14} className="text-emerald-600" /> Latest NDVI
                        </span>
                        {currentNdvi > 0 ? (
                            <span className="font-bold text-gray-900 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: getNdviColor(currentNdvi) }}></span>
                                {currentNdvi.toFixed(2)}
                            </span>
                        ) : (
                            <span className="text-gray-400 text-sm italic">N/A</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Farm Management Tasks based on BBCH */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Calendar className="text-indigo-600" size={20}/> Agronomic Tasks
                </h3>
                <div className="space-y-3">
                    {recommendedActions.length > 0 ? (
                        recommendedActions.map(action => (
                            <div key={action.id} className={`flex items-start gap-3 p-3 rounded-lg border ${
                                action.severity === 'Critical' ? 'border-red-100 bg-red-50/50' :
                                action.severity === 'Warning' ? 'border-amber-100 bg-amber-50/50' :
                                'border-indigo-100 bg-indigo-50/50'
                            }`}>
                                <div className={`p-1.5 bg-white rounded-md shadow-sm ${
                                   action.severity === 'Critical' ? 'text-red-600' :
                                   action.severity === 'Warning' ? 'text-amber-600' :
                                   'text-indigo-600'
                                }`}>
                                    {action.severity === 'Info' ? <Search size={14}/> : <AlertTriangle size={14} />}
                                </div>
                                <div>
                                    <p className={`text-sm font-bold ${
                                        action.severity === 'Critical' ? 'text-red-900' :
                                        action.severity === 'Warning' ? 'text-amber-900' :
                                        'text-indigo-900'
                                    }`}>{action.title}</p>
                                    <p className={`text-xs mt-0.5 ${
                                        action.severity === 'Critical' ? 'text-red-700' :
                                        action.severity === 'Warning' ? 'text-amber-800' :
                                        'text-indigo-700'
                                    }`}>{action.description}</p>
                                    <p className="text-[10px] mt-1 text-gray-500 italic border-t border-black/5 pt-1 mt-1.5">
                                      Why: {action.reason}
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center p-4">
                            <span className="text-gray-400 text-sm italic">No specific actions required at this stage.</span>
                        </div>
                    )}
                </div>
            </div>
            {/* Field Inputs Section */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 col-span-1 md:col-span-2">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <FlaskConical className="text-blue-600" size={20}/> Manual Interventions
                    </h3>
                    <button className="text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 transition">
                        + Add Input
                    </button>
                </div>
                <div className="border border-gray-100 rounded-lg bg-gray-50 p-6 flex flex-col items-center justify-center text-center text-gray-500">
                    <Database size={32} className="text-gray-300 mb-2" />
                    <p className="text-sm font-medium">No prior interventions recorded.</p>
                    <p className="text-xs mt-1">Log fertilizers, pesticides, or other chemical applications here for accurate growth tracking.</p>
                </div>
            </div>
                </div>
            )}

            {/* -------------------- ENVIRONMENTAL OVERVIEW TAB -------------------- */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* NDVI Chart Section */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 relative">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Activity className="text-emerald-600" size={20} /> Vegetation Index Trend
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 border transition-colors ${
                                dataSource === 'gee' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 
                                dataSource === 'saved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                'bg-gray-100 text-gray-600 border-gray-200'
                            }`}>
                                {dataSource === 'gee' && <Server size={10} />}
                                {dataSource === 'saved' && <Database size={10} />}
                                
                                {dataSource === 'gee' && 'Live from Earth Engine'}
                                {dataSource === 'saved' && 'Saved to Cloud'}
                                {!dataSource && 'No Data Source'}
                            </span>
                            {dataSource === 'saved' && parcel.lastAgroSync && (
                                <span className="text-[10px] text-gray-400">
                                    Last update: {new Date(parcel.lastAgroSync).toLocaleDateString()}
                                </span>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => fetchAndSaveStats(parcel)}
                            disabled={loadingStats}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Force Refresh Data"
                        >
                            <RefreshCw size={16} className={loadingStats ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>
                
                {/* Connection Error Banner */}
                {backendError && !isOffline && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
                        <XCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-red-800">Connection Failed</h4>
                            <p className="text-xs text-red-600 mt-0.5">{backendError}</p>
                            <div className="mt-2 flex gap-2">
                                <button 
                                    onClick={() => navigate('/settings')}
                                    className="text-xs font-medium text-red-700 underline hover:text-red-800"
                                >
                                    Check Settings
                                </button>
                                <button 
                                    onClick={() => fetchAndSaveStats(parcel)}
                                    className="text-xs font-medium text-red-700 underline hover:text-red-800"
                                >
                                    Retry
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {loadingStats && dataSource !== 'saved' ? (
                     <div className="h-64 w-full flex flex-col items-center justify-center text-gray-400">
                        <RefreshCw className="animate-spin mb-2" size={24} />
                        <span className="text-sm">Processing...</span>
                     </div>
                ) : ndviHistory.length > 0 ? (
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={ndviHistory} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis 
                                    dataKey="date" 
                                    tickFormatter={formatShortDate} 
                                    tick={{fill: '#9ca3af', fontSize: 10}} 
                                    axisLine={false} 
                                    tickLine={false} 
                                    minTickGap={30}
                                />
                                <YAxis 
                                    yAxisId="left"
                                    domain={[0, 1]} 
                                    tick={{fill: '#9ca3af', fontSize: 10}} 
                                    axisLine={false} 
                                    tickLine={false} 
                                />
                                <Tooltip 
                                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                    labelFormatter={(label) => formatDate(label as string)}
                                />
                                <Legend verticalAlign="top" height={36} iconType="circle" />
                                <ReferenceLine yAxisId="left" y={0.2} stroke="#a1662f" strokeDasharray="3 3" label={{ value: 'Soil', position: 'insideLeft', fill: '#a1662f', fontSize: 10 }} />
                                <ReferenceLine yAxisId="left" y={0.8} stroke="#22c55e" strokeDasharray="3 3" label={{ value: 'Dense', position: 'insideLeft', fill: '#22c55e', fontSize: 10 }} />
                                <Line 
                                    yAxisId="left"
                                    type="monotone" 
                                    dataKey="value" 
                                    name="NDVI Index"
                                    stroke="#10b981" 
                                    strokeWidth={3} 
                                    dot={{r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff'}} 
                                    activeDot={{r: 6}} 
                                    connectNulls={true}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-64 w-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-lg">
                        <Ban size={32} className="mb-2 opacity-20" />
                        <p className="text-sm font-medium">No Data Available</p>
                        <p className="text-xs text-gray-400 mt-1">Connect backend to view satellite analytics</p>
                    </div>
                )}
            </div>

            {/* Current Weather Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Current Conditions</h2>
                        <p className="text-sm text-gray-500">Source: DMI / Open-Meteo</p>
                    </div>
                    <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                        Live Data
                    </div>
                </div>

                {loading ? (
                    <div className="h-40 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                    </div>
                ) : weather ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {/* Weather items ... */}
                         <div className="col-span-2 md:col-span-1 flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl">
                            {getWeatherIcon(weather.current.weatherCode)}
                            <span className="mt-2 text-3xl font-bold text-gray-900">{weather.current.temperature}°</span>
                            <span className="text-sm text-gray-500 text-center">{getWeatherLabel(weather.current.weatherCode)}</span>
                        </div>

                        <div className="col-span-1 flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl relative overflow-hidden">
                           <div className="absolute top-2 left-3 text-xs font-bold text-gray-400 uppercase">Wind</div>
                           <div className="relative w-20 h-20 border-2 border-gray-200 rounded-full flex items-center justify-center mt-2">
                              <span className="absolute -top-1.5 text-[8px] font-bold text-gray-400 bg-gray-50 px-1">N</span>
                              <span className="absolute -right-1.5 text-[8px] font-bold text-gray-400 bg-gray-50 px-1">E</span>
                              <span className="absolute -bottom-1.5 text-[8px] font-bold text-gray-400 bg-gray-50 px-1">S</span>
                              <span className="absolute -left-1.5 text-[8px] font-bold text-gray-400 bg-gray-50 px-1">W</span>
                              <div 
                                style={{ transform: `rotate(${weather.current.windDirection}deg)` }}
                                className="w-full h-full flex items-center justify-center transition-transform duration-1000 ease-out"
                              >
                                  <Navigation size={24} className="text-emerald-600 fill-emerald-600 mb-6" />
                              </div>
                           </div>
                           <div className="text-center mt-2">
                               <div className="text-lg font-bold text-gray-900">{weather.current.windSpeed} <span className="text-xs font-normal text-gray-500">km/h</span></div>
                               <div className="text-xs text-emerald-700 font-medium">{getCardinalDirection(weather.current.windDirection)}</div>
                           </div>
                        </div>

                        <div className="col-span-1 flex flex-col justify-between p-4 bg-gray-50 rounded-xl space-y-1">
                             <div className="flex items-center gap-2 text-gray-500 text-sm uppercase font-bold"><Droplets size={14}/> Humidity</div>
                             <div className="flex-1 flex flex-col justify-center gap-2">
                                <span className="text-2xl font-bold text-gray-900">{weather.current.humidity}%</span>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                        className="bg-blue-500 h-2 rounded-full transition-all duration-1000" 
                                        style={{ width: `${weather.current.humidity}%` }}
                                    ></div>
                                </div>
                                <span className="text-xs text-gray-400">Dew Point: {(weather.current.temperature - ((100 - weather.current.humidity)/5)).toFixed(1)}°</span>
                             </div>
                        </div>

                         <div className="flex flex-col justify-center p-4 bg-gray-50 rounded-xl space-y-1">
                             <div className="flex items-center gap-2 text-gray-500 text-sm uppercase font-bold"><Thermometer size={14}/> Soil Temp</div>
                             <div className="flex-1 flex flex-col justify-center">
                                <span className="text-2xl font-bold text-gray-900">{(weather.current.temperature - 2).toFixed(1)}°</span>
                                <span className="text-xs text-gray-400">Est. Topsoil (5cm)</span>
                             </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-red-500">Failed to load weather data.</div>
                )}
            </div>
            
            {/* 7-Day Forecast */}
            {weather && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 overflow-hidden">
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <Calendar size={16} /> 7-Day Forecast
                    </h3>
                    <div className="flex overflow-x-auto pb-2 gap-4 no-scrollbar">
                        {weather.daily.map((day, idx) => (
                            <div key={idx} className="flex-shrink-0 w-28 flex flex-col items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <span className="text-xs font-semibold text-gray-500 mb-2">{formatShortDate(day.date)}</span>
                                <div className="mb-2">{getWeatherIcon(day.weatherCode, 28)}</div>
                                <div className="flex items-end gap-1 mb-1">
                                    <span className="text-lg font-bold text-gray-900">{Math.round(day.maxTemp)}°</span>
                                    <span className="text-xs text-gray-500 mb-1">{Math.round(day.minTemp)}°</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                                    <Droplets size={10} />
                                    {day.rainSum}mm
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Weather Analytics Charts */}
            {weather && !loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Temp + Rain Chart */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                            <Thermometer size={16} /> Temperature & Rainfall
                        </h3>
                        <div className="h-64 w-full text-xs">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={weather.daily}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                                    <YAxis yAxisId="left" orientation="left" tick={{fill: '#9ca3af'}} axisLine={false} tickLine={false} unit="°" />
                                    <YAxis yAxisId="right" orientation="right" tick={{fill: '#9ca3af'}} axisLine={false} tickLine={false} unit="mm" />
                                    <Tooltip 
                                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                        labelFormatter={(label) => formatDate(label as string)}
                                    />
                                    <Bar yAxisId="right" dataKey="rainSum" name="Rain" fill="#93c5fd" radius={[4, 4, 0, 0]} barSize={20} />
                                    <Line yAxisId="left" type="monotone" dataKey="maxTemp" name="Max Temp" stroke="#f59e0b" strokeWidth={2} dot={{r: 3}} />
                                    <Line yAxisId="left" type="monotone" dataKey="minTemp" name="Min Temp" stroke="#60a5fa" strokeWidth={2} dot={{r: 3}} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Wind & Evapotranspiration */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                            <Wind size={16} /> Wind Speed & Evapotranspiration
                        </h3>
                        <div className="h-64 w-full text-xs">
                             <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={weather.daily}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                                    <YAxis tick={{fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                                    <Tooltip 
                                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                        labelFormatter={(label) => formatDate(label as string)}
                                    />
                                    <Area type="monotone" dataKey="maxWind" name="Max Wind (km/h)" stackId="1" stroke="#10b981" fill="#d1fae5" />
                                    <Area type="monotone" dataKey="evapotranspiration" name="Evapotranspiration (mm)" stackId="2" stroke="#8b5cf6" fill="#ede9fe" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* SOIL PROPERTIES SECTION */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 min-h-[300px]">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Pickaxe size={20} className="text-emerald-700" /> 
                            Soil Properties <span className="text-sm font-normal text-gray-500">(0-30cm Topsoil)</span>
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                           <p className="text-sm text-gray-500">Source: OpenLandMap</p>
                        </div>
                    </div>
                </div>

                {loadingSoil ? (
                    <div className="h-40 flex flex-col items-center justify-center text-gray-400">
                        <Loader2 className="animate-spin mb-2 text-emerald-600" size={32} />
                        <span className="text-sm font-medium">Analyzing soil composition...</span>
                    </div>
                ) : soil ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Texture Column */}
                        <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Texture Class</span>
                                    <h3 className="text-xl font-bold text-gray-900 mt-1">{soil.texture.label}</h3>
                                </div>
                                <Layers className="text-emerald-600 opacity-50" size={24} />
                            </div>

                            {/* Simple Visual Bar for Texture */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs font-medium">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400"></span> Sand</span>
                                    <span>{formatSoilValue(soil.texture.sand, '%')}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                    <div className="bg-yellow-400 h-2 rounded-full" style={{ width: `${getBarWidth(soil.texture.sand)}%` }}></div>
                                </div>

                                <div className="flex items-center justify-between text-xs font-medium">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400"></span> Silt</span>
                                    <span>{formatSoilValue(soil.texture.silt, '%')}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                    <div className="bg-gray-400 h-2 rounded-full" style={{ width: `${getBarWidth(soil.texture.silt)}%` }}></div>
                                </div>

                                <div className="flex items-center justify-between text-xs font-medium">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-700"></span> Clay</span>
                                    <span>{formatSoilValue(soil.texture.clay, '%')}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                    <div className="bg-amber-700 h-2 rounded-full" style={{ width: `${getBarWidth(soil.texture.clay)}%` }}></div>
                                </div>
                            </div>
                        </div>

                        {/* Chemical & Physical Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col">
                                <div className="flex items-center gap-2 mb-2 text-blue-800">
                                    <FlaskConical size={16} />
                                    <span className="text-xs font-bold uppercase">pH (H2O)</span>
                                </div>
                                <span className="text-2xl font-bold text-gray-900">{formatSoilValue(soil.chemistry.ph)}</span>
                                <span className="text-xs text-gray-500 mt-1">
                                    {soil.chemistry.ph !== null ? (soil.chemistry.ph < 5.5 ? 'Acidic' : soil.chemistry.ph > 7.5 ? 'Alkaline' : 'Neutral') : 'N/A'}
                                </span>
                            </div>

                            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 flex flex-col">
                                <div className="flex items-center gap-2 mb-2 text-amber-800">
                                    <Sprout size={16} />
                                    <span className="text-xs font-bold uppercase">Organic Matter</span>
                                </div>
                                <span className="text-2xl font-bold text-gray-900">{formatSoilValue(soil.organic.som, '%')}</span>
                                <span className="text-xs text-gray-500 mt-1">
                                    SOC: {formatSoilValue(soil.organic.soc, '%')}
                                </span>
                            </div>

                            <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 flex flex-col">
                                <div className="flex items-center gap-2 mb-2 text-purple-800">
                                    <Zap size={16} />
                                    <span className="text-xs font-bold uppercase">CEC</span>
                                </div>
                                <span className="text-2xl font-bold text-gray-900">{formatSoilValue(soil.chemistry.cec)}</span>
                                <span className="text-xs text-gray-500 mt-1">cmol(+)/kg</span>
                            </div>

                            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex flex-col">
                                <div className="flex items-center gap-2 mb-2 text-stone-700">
                                    <Scale size={16} />
                                    <span className="text-xs font-bold uppercase">Bulk Density</span>
                                </div>
                                <span className="text-2xl font-bold text-gray-900">{formatSoilValue(soil.physical.bulkDensity)}</span>
                                <span className="text-xs text-gray-500 mt-1">g/cm³</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-40 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                        <AlertTriangle className="mb-2 text-amber-500" size={32} />
                        <span className="text-sm font-medium text-gray-900">Soil Data Unavailable</span>
                        <p className="text-xs text-gray-500 mt-1">Could not retrieve soil properties for this location.</p>
                        <button 
                            onClick={() => window.location.reload()}
                            className="mt-3 text-xs text-emerald-600 font-medium hover:underline"
                        >
                            Retry
                        </button>
                    </div>
                )}
            </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
