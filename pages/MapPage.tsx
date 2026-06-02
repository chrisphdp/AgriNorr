import React, { useEffect, useRef, useState } from 'react';
import { Map as MapIcon, PenTool, Trash2, Sprout, AlertCircle, Save, Calendar, FileText, Info, Layers, CheckCircle, Eye, Upload, Loader2, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useParcels, NewParcelData } from '../context/ParcelContext';
import { useAuth } from '../context/AuthContext';

// Declaration to satisfy TypeScript that 'google', 'gm_authFailure', 'shp', and 'toGeoJSON' exist on window
declare global {
  interface Window {
    google: any;
    gm_authFailure: () => void;
    shp: (buffer: ArrayBuffer) => Promise<any>;
    toGeoJSON: {
        kml: (doc: Document) => any;
    };
  }
}

export const MapPage: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const drawingManagerRef = useRef<any>(null);
  const currentPolygonRef = useRef<any>(null);
  const existingPolygonsRef = useRef<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Navigation and Context
  const navigate = useNavigate();
  const { addParcel, parcels } = useParcels();
  const { profile } = useAuth();
  
  const canEdit = profile?.role === 'administrator';

  // Map Loading State
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Map Interaction State
  const [mapType, setMapType] = useState<'hybrid' | 'roadmap'>('hybrid');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [area, setArea] = useState<string>('0.00');
  const [preciseLocation, setPreciseLocation] = useState<string>('Denmark');
  
  // Boundary can be single path (simple polygon) or array of paths (multipolygon)
  const [boundary, setBoundary] = useState<any[]>([]);

  // Saving State
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Form Data State
  const [formData, setFormData] = useState({
    name: '',
    crop: '',
    date: new Date().toISOString().split('T')[0]
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSaveField = async () => {
    if (!formData.name) {
      alert("Please enter a field name.");
      return;
    }
    
    setSaveStatus('saving');

    try {
        // Random background image (only visual flair)
        const bgImages = ['bg-emerald-100', 'bg-green-50', 'bg-teal-50', 'bg-lime-50'];
        const randomImage = bgImages[Math.floor(Math.random() * bgImages.length)];

        const newParcelData: NewParcelData = {
            name: formData.name,
            location: preciseLocation,
            size: area,
            crop: formData.crop || 'Unknown',
            ndvi: null,
            moisture: null,
            temperature: null,
            windSpeed: null,
            status: 'Healthy',
            image: randomImage,
            date: formData.date,
            boundary: boundary.length > 0 ? boundary : undefined 
        };

        await addParcel(newParcelData);
        setSaveStatus('saved');
        
        // Redirect after showing success message
        setTimeout(() => {
            navigate('/dashboard');
        }, 1500);

    } catch (error: any) {
        console.error("Failed to save field", error);
        setSaveStatus('idle'); // Allow retrying
        alert("Failed to save field: " + (error.message || "Unknown error"));
    }
  };

  // -------------------------------------------------------------------------
  // FILE UPLOAD LOGIC (Shapefile / KML)
  // -------------------------------------------------------------------------
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    try {
        let geojson = null;

        if (file.name.endsWith('.zip')) {
            // Process Shapefile (requires shpjs)
            if (!window.shp) throw new Error("Shapefile parser not loaded");
            const buffer = await file.arrayBuffer();
            geojson = await window.shp(buffer);
        } 
        else if (file.name.endsWith('.kml')) {
            // Process KML (requires toGeoJSON)
            if (!window.toGeoJSON) throw new Error("KML parser not loaded");
            const text = await file.text();
            const parser = new DOMParser();
            const kmlDoc = parser.parseFromString(text, 'text/xml');
            geojson = window.toGeoJSON.kml(kmlDoc);
        } else {
            throw new Error("Unsupported file format. Please use .zip (Shapefile) or .kml");
        }

        processGeoJson(geojson, file.name);

    } catch (err: any) {
        console.error("Upload Error:", err);
        alert(`Error parsing file: ${err.message}`);
    } finally {
        setIsUploading(false);
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const processGeoJson = (geojson: any, fileName: string) => {
      // Normalize features list
      const features = Array.isArray(geojson) ? geojson[0].features : (geojson.features || [geojson]);
      
      const allPaths: any[] = [];
      let totalAreaSqMeters = 0;
      const bounds = new window.google.maps.LatLngBounds();

      // Iterate through ALL features
      features.forEach((f: any) => {
          if (!f.geometry) return;

          const type = f.geometry.type;
          let coordsLists: any[] = [];

          if (type === 'Polygon') {
              // coords[0] is the outer linear ring
              coordsLists.push(f.geometry.coordinates[0]);
          } else if (type === 'MultiPolygon') {
              // coords[i][0] is the outer linear ring of the i-th polygon
              f.geometry.coordinates.forEach((poly: any) => {
                  coordsLists.push(poly[0]);
              });
          }

          // Convert GeoJSON coords [lng, lat] to Google Maps {lat, lng}
          coordsLists.forEach(coords => {
              const path = coords.map((c: number[]) => ({ lat: c[1], lng: c[0] }));
              
              // Remove redundant closing point
              if (path.length > 0 && 
                  Math.abs(path[0].lat - path[path.length - 1].lat) < 0.00001 && 
                  Math.abs(path[0].lng - path[path.length - 1].lng) < 0.00001) {
                  path.pop();
              }

              if (path.length > 2) { // Need at least 3 points for a polygon
                 allPaths.push(path);
                 
                 // Extend bounds
                 path.forEach((p: any) => bounds.extend(p));
                 
                 // Calculate area for this polygon and add to total
                 if (window.google.maps.geometry) {
                    const polyArea = window.google.maps.geometry.spherical.computeArea(
                        path.map((p:any) => new window.google.maps.LatLng(p.lat, p.lng))
                    );
                    totalAreaSqMeters += polyArea;
                 }
              }
          });
      });

      if (allPaths.length === 0) {
          alert("No valid polygons found in file.");
          return;
      }

      // Draw all paths
      drawPolygonOnMap(allPaths, totalAreaSqMeters, bounds);
      
      // Auto-fill name
      if (!formData.name) {
          setFormData(prev => ({ ...prev, name: fileName.split('.')[0] }));
      }
  };

  const drawPolygonOnMap = (paths: any[], totalArea: number, bounds: any) => {
      if (!mapInstanceRef.current || !window.google) return;

      // Clear existing drawing
      if (currentPolygonRef.current) {
          currentPolygonRef.current.setMap(null);
      }

      // Create new polygon (Google Maps supports array of paths for MultiPolygon)
      const newPolygon = new window.google.maps.Polygon({
          paths: paths,
          fillColor: '#10b981',
          fillOpacity: 0.45,
          strokeWeight: 2,
          strokeColor: '#065f46',
          clickable: true,
          editable: true,
          zIndex: 2,
      });

      newPolygon.setMap(mapInstanceRef.current);
      currentPolygonRef.current = newPolygon;

      // Update State
      setArea((totalArea / 10000).toFixed(2));
      mapInstanceRef.current.fitBounds(bounds);
      
      const center = bounds.getCenter();
      setPreciseLocation(`${center.lat().toFixed(4)}°N, ${center.lng().toFixed(4)}°E`);
      
      // If single path, store as simple array. If multi, store as array of arrays.
      // This matches the Parcel interface update.
      if (paths.length === 1) {
          setBoundary(paths[0]);
      } else {
          setBoundary(paths);
      }

      setIsDrawing(false);
      if (drawingManagerRef.current) {
          drawingManagerRef.current.setDrawingMode(null);
      }
  };

  // -------------------------------------------------------------------------
  // EXISTING MAP EFFECTS
  // -------------------------------------------------------------------------

  // Switch Map Type Effect
  useEffect(() => {
    if (mapInstanceRef.current) {
        mapInstanceRef.current.setMapTypeId(mapType);
    }
  }, [mapType]);

  // Render Existing Parcels on Map
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google || !window.google.maps) return;
    
    // Clear old existing polygons
    existingPolygonsRef.current.forEach(poly => poly.setMap(null));
    existingPolygonsRef.current = [];

    // Add polygons for saved parcels
    parcels.forEach(parcel => {
      if (parcel.boundary) {
        const polygon = new window.google.maps.Polygon({
          paths: parcel.boundary, // Works for both single array and array of arrays
          strokeColor: '#f59e0b',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#fbbf24',
          fillOpacity: 0.2,
          zIndex: 1
        });

        const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="padding: 4px;">
                <h3 style="margin: 0; font-weight: bold; font-family: sans-serif;">${parcel.name}</h3>
                <p style="margin: 4px 0 0; color: #666; font-family: sans-serif; font-size: 12px;">${parcel.crop} • ${parcel.size} ha</p>
              </div>
            `
        });

        polygon.addListener('click', (e: any) => {
            infoWindow.setPosition(e.latLng);
            infoWindow.open(mapInstanceRef.current);
        });

        polygon.setMap(mapInstanceRef.current);
        existingPolygonsRef.current.push(polygon);
      }
    });

  }, [parcels, status]);

  // Initialize Map
  useEffect(() => {
    let intervalId: any;
    let timeoutId: any;

    window.gm_authFailure = () => {
      console.error("Google Maps Authentication Error");
      setStatus('error');
      setErrorMessage("Access Denied: Please check your Google Cloud Console. Ensure 'Billing' is enabled and 'Maps JavaScript API' is active for this API key.");
    };

    const initMap = () => {
      if (!mapRef.current) return;
      if (!window.google || !window.google.maps) return;

      clearInterval(intervalId);
      clearTimeout(timeoutId);

      try {
        if (mapInstanceRef.current) return;

        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat: 56.2639, lng: 9.5018 },
          zoom: 7,
          mapTypeId: mapType,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          disableDefaultUI: true,
          zoomControl: true,
        });

        mapInstanceRef.current = map;

        if (window.google.maps.drawing) {
          const drawingManager = new window.google.maps.drawing.DrawingManager({
            drawingMode: null,
            drawingControl: false,
            polygonOptions: {
              fillColor: '#10b981',
              fillOpacity: 0.45,
              strokeWeight: 2,
              strokeColor: '#065f46',
              clickable: true,
              editable: true,
              zIndex: 2,
            },
          });

          drawingManager.setMap(map);
          drawingManagerRef.current = drawingManager;

          window.google.maps.event.addListener(drawingManager, 'overlaycomplete', (event: any) => {
            if (event.type === window.google.maps.drawing.OverlayType.POLYGON) {
              if (currentPolygonRef.current) {
                currentPolygonRef.current.setMap(null);
              }
              
              const newPolygon = event.overlay;
              currentPolygonRef.current = newPolygon;

              // Calculate Area & Center
              if (window.google.maps.geometry) {
                const areaSqMeters = window.google.maps.geometry.spherical.computeArea(newPolygon.getPath());
                setArea((areaSqMeters / 10000).toFixed(2));
                
                const bounds = new window.google.maps.LatLngBounds();
                const path = newPolygon.getPath();
                const pathArray: {lat: number, lng: number}[] = [];
                
                path.forEach((latLng: any) => {
                    bounds.extend(latLng);
                    pathArray.push({ lat: latLng.lat(), lng: latLng.lng() });
                });

                setBoundary(pathArray); // Single path for manually drawn polygons

                const center = bounds.getCenter();
                setPreciseLocation(`${center.lat().toFixed(4)}°N, ${center.lng().toFixed(4)}°E`);
              }

              drawingManager.setDrawingMode(null);
              setIsDrawing(false);
            }
          });
        }

        setStatus('success');

      } catch (err: any) {
        console.error("Critical Map Error:", err);
        setStatus('error');
        setErrorMessage("An error occurred while initializing the map engine.");
      }
    };

    if (window.google?.maps) {
      initMap();
    } else {
      intervalId = setInterval(initMap, 500);
      
      timeoutId = setTimeout(() => {
        clearInterval(intervalId);
        if (!mapInstanceRef.current) {
           setStatus('error');
           setErrorMessage("Google Maps failed to load. Please check your internet connection or API Key.");
        }
      }, 8000);
    }

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      window.gm_authFailure = () => {}; 
    };
  }, []);

  const toggleDrawing = () => {
    if (!drawingManagerRef.current) return;
    if (isDrawing) {
      drawingManagerRef.current.setDrawingMode(null);
      setIsDrawing(false);
    } else {
      drawingManagerRef.current.setDrawingMode(window.google.maps.drawing.OverlayType.POLYGON);
      setIsDrawing(true);
    }
  };

  const clearMap = () => {
    if (currentPolygonRef.current) {
      currentPolygonRef.current.setMap(null);
      currentPolygonRef.current = null;
    }
    setArea('0.00');
    setPreciseLocation('Denmark');
    setBoundary([]);
    if (isDrawing) toggleDrawing();
  };

  const triggerFileUpload = () => {
      if (fileInputRef.current) {
          fileInputRef.current.click();
      }
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-6">
      
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload}
        accept=".kml,.zip"
        className="hidden" 
      />

      {/* LEFT COLUMN: MAP CONTAINER */}
      <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[500px]">
        {/* Map Toolbar */}
        <div className="h-14 border-b border-gray-100 flex items-center justify-between px-4 bg-gray-50/50">
          
          {/* Map View Toggles */}
          <div className="flex bg-gray-200 p-1 rounded-lg">
            <button
                onClick={() => setMapType('hybrid')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${mapType === 'hybrid' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
                Satellite
            </button>
            <button
                onClick={() => setMapType('roadmap')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${mapType === 'roadmap' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
                Map
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            {canEdit ? (
              <>
                <button 
                  onClick={clearMap}
                  disabled={status !== 'success' || area === '0.00'}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                  title="Clear Map"
                >
                  <Trash2 size={18} />
                </button>
                
                <div className="h-6 w-px bg-gray-300 mx-1"></div>
                
                <button 
                    onClick={triggerFileUpload}
                    disabled={status !== 'success' || isUploading}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    title="Upload Shapefile (.zip) or KML"
                >
                    {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    Upload
                </button>

                <button 
                  onClick={toggleDrawing}
                  disabled={status !== 'success'}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isDrawing 
                      ? 'bg-emerald-600 text-white shadow-sm' 
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <PenTool size={16} />
                  {isDrawing ? 'Cancel Drawing' : 'Draw Field'}
                </button>
              </>
            ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-50 text-gray-400 border border-gray-200">
                  <Lock size={16} />
                  <span>View Only (Administrator access required to draw)</span>
                </div>
            )}
          </div>
        </div>

        {/* Map Viewport */}
        <div className="flex-1 relative bg-gray-100 w-full h-full">
          {/* Loading State */}
          {status === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-gray-50">
              <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-500 font-medium">Connecting to Satellite...</p>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-gray-50 p-6 text-center">
              <div className="bg-red-100 p-3 rounded-full mb-4">
                <AlertCircle size={32} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Map Unavailable</h3>
              <p className="text-gray-500 mt-2 max-w-md mx-auto">{errorMessage}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-6 text-emerald-700 hover:underline text-sm font-medium"
              >
                Reload Page
              </button>
            </div>
          )}

          {/* The Map Div */}
          <div 
            ref={mapRef} 
            className={`w-full h-full absolute inset-0 transition-opacity duration-500 ${status === 'success' ? 'opacity-100' : 'opacity-0'}`} 
          />
          
          {/* Legend for existing fields */}
          {status === 'success' && parcels.length > 0 && (
             <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm p-2 rounded-lg shadow-sm border border-gray-200 text-xs z-10 flex flex-col gap-1 pointer-events-none">
                <div className="flex items-center gap-2">
                   <span className="w-3 h-3 rounded bg-[#fbbf24] border border-[#f59e0b] opacity-80"></span>
                   <span className="text-gray-700 font-medium">Existing Fields</span>
                </div>
                <div className="flex items-center gap-2">
                   <span className="w-3 h-3 rounded bg-[#10b981] border border-[#065f46] opacity-80"></span>
                   <span className="text-gray-700 font-medium">New Drawing</span>
                </div>
             </div>
          )}
          
          {/* Helper overlay when drawing */}
          {isDrawing && status === 'success' && (
             <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600/90 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg backdrop-blur-sm pointer-events-none z-10">
               Click on the map to outline your field boundaries
             </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: SIDEBAR FORM */}
      <div className="w-full md:w-80 lg:w-96 flex flex-col gap-6">
        
        {/* Form Container */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-emerald-800 text-white flex items-center gap-2">
            <Sprout size={20} />
            <h2 className="font-bold tracking-wide">Parcel Details</h2>
          </div>
          
          <div className="p-6 space-y-5">
            {/* Auto-filled Area */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 text-center">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block mb-1">Calculated Area</span>
              <div className="text-3xl font-bold text-emerald-900">
                {area} <span className="text-lg text-emerald-700 font-medium">ha</span>
              </div>
            </div>

            {/* Auto-filled Location (Visual only) */}
             <div className="flex items-center gap-2 text-xs text-gray-500 justify-center">
               <MapIcon size={12} />
               <span>{preciseLocation}</span>
             </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                  <FileText size={14} className="text-gray-400"/> Field Name
                </label>
                <input 
                  type="text" 
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={!canEdit}
                  placeholder="e.g. North Pasture"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                  <Sprout size={14} className="text-gray-400"/> Crop Type
                </label>
                <select 
                  name="crop"
                  value={formData.crop}
                  onChange={handleInputChange}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">Select a crop...</option>
                  <option value="Winter Wheat">Winter Wheat</option>
                  <option value="Spring Barley">Spring Barley</option>
                  <option value="Rapeseed">Rapeseed</option>
                  <option value="Maize">Maize</option>
                  <option value="Grass">Grass / Pasture</option>
                  <option value="Potatoes">Potatoes</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                   <Calendar size={14} className="text-gray-400"/> Planting Date
                </label>
                <input 
                  type="date" 
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>
            </div>

            <button 
              onClick={handleSaveField}
              disabled={saveStatus !== 'idle' || !canEdit}
              className={`w-full mt-2 font-bold py-3 px-4 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 ${
                  !canEdit 
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : saveStatus === 'saved' 
                    ? 'bg-emerald-600 text-white cursor-default'
                    : saveStatus === 'saving'
                    ? 'bg-emerald-700 text-white cursor-wait'
                    : 'bg-emerald-800 hover:bg-emerald-900 text-white hover:shadow-md'
              }`}
            >
              {!canEdit && (
                  <>
                    <Lock size={18} />
                    Only Administrators Can Save
                  </>
              )}
              {canEdit && saveStatus === 'idle' && (
                  <>
                    <Save size={18} />
                    Save Field Data
                  </>
              )}
              {canEdit && saveStatus === 'saving' && (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Saving...
                  </>
              )}
              {canEdit && saveStatus === 'saved' && (
                  <>
                    <CheckCircle size={20} />
                    Field Saved!
                  </>
              )}
            </button>
          </div>
        </div>

        {/* Instructions Box (Helper) */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
          <p className="flex items-start gap-2">
            <Info size={16} className="mt-0.5 flex-shrink-0" />
            <span>
              <strong>Tip:</strong> Draw a field manually, or click <strong>Upload</strong> to import a .zip (Shapefile) or .kml file. 
              Supports multiple fields at once.
            </span>
          </p>
        </div>

      </div>
    </div>
  );
};