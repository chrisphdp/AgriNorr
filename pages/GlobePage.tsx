
import React, { useEffect, useRef, useState } from 'react';
import { useParcels, Parcel } from '../context/ParcelContext';
import { Compass, Locate, MousePointer2, MapPin, Layers, Loader2, AlertTriangle, RefreshCw, Zap } from 'lucide-react';
import { getBackendUrl, fetchGeeLayer } from '../utils/geeService';

declare global {
  interface Window {
    Cesium: any;
  }
}

type AnalysisLayer = 'none' | 'ndvi' | 'ndre' | 'ndmi' | 'lai' | 'lst';

export const GlobePage: React.FC = () => {
    const cesiumContainer = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<any>(null);
    const activeImageryLayers = useRef<any[]>([]);
    const { parcels } = useParcels();
    
    const [cesiumLoaded, setCesiumLoaded] = useState(false);
    const [isCesiumReady, setIsCesiumReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeLayer, setActiveLayer] = useState<AnalysisLayer>('none');
    const [loadingLayer, setLoadingLayer] = useState(false);

    const isOffline = localStorage.getItem('gee_simulation_mode') === 'true';

    // Initial View (Nadir View of Earth from Space)
    const HOME_VIEW = {
        destination: null,
        orientation: {
            heading: 0.0,
            pitch: -1.570796, // Nadir: straight down (90 degrees down)
            roll: 0.0
        }
    };

    // Helper to calculate the average center of a parcel
    const getParcelCenter = (parcel: Parcel) => {
        if (!parcel.boundary) return null;
        let sumLat = 0;
        let sumLng = 0;
        let count = 0;
        
        const rings: any[][] = Array.isArray(parcel.boundary[0]) && Array.isArray((parcel.boundary[0] as any))
             ? parcel.boundary as any
             : [parcel.boundary];
             
        rings.forEach(ring => {
            if (Array.isArray(ring)) {
                ring.forEach(pt => {
                    if (typeof pt.lat === 'number' && typeof pt.lng === 'number') {
                        sumLat += pt.lat;
                        sumLng += pt.lng;
                        count++;
                    }
                });
            }
        });
        
        if (count === 0) return null;
        return {
            lat: sumLat / count,
            lng: sumLng / count
        };
    };

    // Helper to estimate height based on bounding box
    const getParcelBoundingHeight = (parcel: Parcel) => {
        if (!parcel.boundary) return 1500;
        let minLat = 90;
        let maxLat = -90;
        let minLng = 180;
        let maxLng = -180;
        
        const rings: any[][] = Array.isArray(parcel.boundary[0]) && Array.isArray((parcel.boundary[0] as any))
             ? parcel.boundary as any
             : [parcel.boundary];
             
        let count = 0;
        rings.forEach(ring => {
            if (Array.isArray(ring)) {
                ring.forEach(pt => {
                    if (typeof pt.lat === 'number' && typeof pt.lng === 'number') {
                        if (pt.lat < minLat) minLat = pt.lat;
                        if (pt.lat > maxLat) maxLat = pt.lat;
                        if (pt.lng < minLng) minLng = pt.lng;
                        if (pt.lng > maxLng) maxLng = pt.lng;
                        count++;
                    }
                });
            }
        });
        
        if (count === 0) return 1500;
        
        const latDiff = maxLat - minLat;
        const lngDiff = maxLng - minLng;
        const maxDiff = Math.max(latDiff, lngDiff);
        
        // Return a customized height clamped to zoom nicely on small & large parcels
        const estimatedHeight = Math.max(800, Math.min(15000, maxDiff * 111000 * 2.5));
        return estimatedHeight;
    };

    // 1. Poll for Cesium Script Load
    useEffect(() => {
        if (window.Cesium) {
            setIsCesiumReady(true);
            return;
        }
        const interval = setInterval(() => {
            if (window.Cesium) {
                setIsCesiumReady(true);
                clearInterval(interval);
            }
        }, 100);
        return () => clearInterval(interval);
    }, []);

    // 2. Initialize Cesium Viewer
    useEffect(() => {
        if (!isCesiumReady || !cesiumContainer.current) return;

        let isMounted = true;
        const initCesium = async () => {
            if (viewerRef.current) return;
            window.Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxOTZhN2M5Mi0wMjE0LTQ4NzEtOWJiMC1mNmIzM2MxMDQ3YTYiLCJpZCI6MzY5MTU4LCJpYXQiOjE3NjU1NDE1NTR9.WbGORKlqdnNJOWekIdOZDul1E0bow0viBJR7bPtcsdM";

            try {
                const terrainProvider = await window.Cesium.createWorldTerrainAsync();
                if (!isMounted) return;
                
                const viewer = new window.Cesium.Viewer(cesiumContainer.current, {
                    terrainProvider: terrainProvider,
                    animation: false,
                    timeline: false,
                    baseLayerPicker: true, 
                    geocoder: true, 
                    homeButton: true,
                    sceneModePicker: true,
                    navigationHelpButton: false,
                    fullscreenButton: false,
                    infoBox: false, 
                    selectionIndicator: true,
                    msaaSamples: 4
                });

                const buildingsTileset = await window.Cesium.createOsmBuildingsAsync();
                viewer.scene.primitives.add(buildingsTileset);
                viewer.scene.globe.depthTestAgainstTerrain = true;
                viewer.scene.globe.maximumScreenSpaceError = 1.3; // Refine terrain and imagery sooner to load high-res orthophotos at further distances
                
                // Determine starting center point
                let startLng = 9.5018;
                let startLat = 56.2639;
                let startAlt = 15000000.0; // 15,000 km (Nadir View of Earth from Space)

                if (parcels && parcels.length > 0) {
                    const firstParcelCenter = getParcelCenter(parcels[0]);
                    if (firstParcelCenter) {
                        startLng = firstParcelCenter.lng;
                        startLat = firstParcelCenter.lat;
                    }
                }

                viewer.camera.setView({
                    destination: window.Cesium.Cartesian3.fromDegrees(startLng, startLat, startAlt),
                    orientation: HOME_VIEW.orientation
                });

                viewerRef.current = viewer;
                setCesiumLoaded(true);
            } catch (e: any) {
                if (!isMounted) return;
                setError(e.message || "Failed to initialize 3D Globe.");
            }
        };

        initCesium();
        return () => {
            isMounted = false;
            if (viewerRef.current) {
                viewerRef.current.destroy();
                viewerRef.current = null;
            }
        };
    }, [isCesiumReady]);

    // 3. Render Parcel Outlines & Labels
    useEffect(() => {
        if (!viewerRef.current || !cesiumLoaded) return;
        
        const viewer = viewerRef.current;
        const parcelEntities = viewer.entities.values.filter((e: any) => e.id.startsWith('parcel-'));
        parcelEntities.forEach((e: any) => viewer.entities.remove(e));

        parcels.forEach(p => {
            if(p.boundary) {
                const rings: any[][] = Array.isArray(p.boundary[0]) && Array.isArray((p.boundary[0] as any)) 
                    ? p.boundary as any
                    : [p.boundary];

                rings.forEach((ring: any[], idx: number) => {
                    const positions: number[] = [];
                    ring.forEach(pt => {
                        positions.push(pt.lng);
                        positions.push(pt.lat);
                    });

                    viewer.entities.add({
                        id: `parcel-${p.id}-${idx}`,
                        name: p.name,
                        polygon: {
                            hierarchy: window.Cesium.Cartesian3.fromDegreesArray(positions),
                            material: window.Cesium.Color.fromCssColorString('#10b981').withAlpha(0.2),
                            outline: true,
                            outlineColor: window.Cesium.Color.fromCssColorString('#065f46'),
                            outlineWidth: 2,
                            classificationType: window.Cesium.ClassificationType.TERRAIN
                        },
                        position: window.Cesium.Cartesian3.fromDegrees(ring[0].lng, ring[0].lat),
                        label: {
                            text: p.name,
                            font: 'bold 11px Inter, sans-serif',
                            fillColor: window.Cesium.Color.WHITE,
                            outlineColor: window.Cesium.Color.BLACK,
                            outlineWidth: 2,
                            style: window.Cesium.LabelStyle.FILL_AND_OUTLINE,
                            verticalOrigin: window.Cesium.VerticalOrigin.BOTTOM,
                            pixelOffset: new window.Cesium.Cartesian2(0, -10),
                            heightReference: window.Cesium.HeightReference.CLAMP_TO_GROUND,
                            disableDepthTestDistance: 50000 
                        }
                    });
                });
            }
        });
    }, [parcels, cesiumLoaded]);

    // 4. Handle Thematic Analysis Layers (NDVI, LST, etc.)
    useEffect(() => {
        if (!viewerRef.current || !cesiumLoaded) return;
        
        const viewer = viewerRef.current;

        const applyThematicLayers = async () => {
            activeImageryLayers.current.forEach(layer => viewer.imageryLayers.remove(layer));
            activeImageryLayers.current = [];

            if (activeLayer === 'none' || isOffline) return;

            setLoadingLayer(true);
            try {
                const backendUrl = getBackendUrl();
                
                const layerPromises = parcels.map(async (p) => {
                    if (!p.boundary) return null;
                    try {
                        const result = await fetchGeeLayer(activeLayer, p.boundary, backendUrl);
                        const tileUrl = result?.tile_url || (result as any);
                        
                        if (tileUrl && typeof tileUrl === 'string') {
                            const imageryProvider = new window.Cesium.UrlTemplateImageryProvider({
                                url: tileUrl.replace('{x}', '{x}').replace('{y}', '{y}').replace('{z}', '{z}'),
                                maximumLevel: 20
                            });
                            const layer = viewer.imageryLayers.addImageryProvider(imageryProvider);
                            layer.alpha = 0.8;
                            return layer;
                        }
                    } catch (e) {
                        console.warn(`Failed to fetch ${activeLayer} for parcel ${p.name}`, e);
                    }
                    return null;
                });

                const layers = await Promise.all(layerPromises);
                activeImageryLayers.current = layers.filter(l => l !== null);

            } catch (err) {
                console.error("Global Layer Error:", err);
            } finally {
                setLoadingLayer(false);
            }
        };

        applyThematicLayers();
    }, [activeLayer, parcels, cesiumLoaded, isOffline]);

    const flyToParcel = (parcel: Parcel) => {
        if (!viewerRef.current || !parcel.boundary) return;
        
        const center = getParcelCenter(parcel);
        if (!center) return;
        
        const height = getParcelBoundingHeight(parcel);
        
        viewerRef.current.camera.flyTo({
            destination: window.Cesium.Cartesian3.fromDegrees(center.lng, center.lat, height),
            orientation: {
                heading: 0.0,
                pitch: -0.6, // Slight tilt (approx -34 degrees) for a beautiful 3D perspective
                roll: 0.0
            },
            duration: 2.5 // Smooth flight transition animation
        });
    };

    const analysisLayers: { id: AnalysisLayer; label: string }[] = [
        { id: 'none', label: 'Standard Earth' },
        { id: 'ndvi', label: 'Vegetation (NDVI)' },
        { id: 'ndre', label: 'Chlorophyll (NDRE)' },
        { id: 'ndmi', label: 'Moisture (NDMI)' },
        { id: 'lai', label: 'Leaf Area (LAI)' },
        { id: 'lst', label: 'Temperature (LST)' },
    ];

    return (
        <div className="h-full w-full relative overflow-hidden bg-gray-900">
           <div ref={cesiumContainer} className="absolute inset-0 z-0" />

           {!cesiumLoaded && !error && (
               <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-900 text-white">
                   <Loader2 size={48} className="animate-spin text-emerald-500 mb-4" />
                   <p className="font-medium text-gray-300">Initialising 3D Assets...</p>
               </div>
           )}

           {error && (
               <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gray-100 p-8 text-center">
                   <AlertTriangle size={48} className="text-red-600 mb-4" />
                   <h3 className="text-xl font-bold text-gray-900 mb-2">3D Globe Unavailable</h3>
                   <p className="text-gray-500 max-w-md">{error}</p>
                   <button onClick={() => window.location.reload()} className="mt-6 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                     Reload Application
                   </button>
               </div>
           )}

           {cesiumLoaded && (
               <>
                   {/* Left Panel: Unified GIS Sidebar (Wider) */}
                   <div className="absolute top-4 left-4 z-10 max-h-[calc(100%-8rem)] flex flex-col gap-4 overflow-y-auto no-scrollbar pb-4">
                       
                       {/* My Holdings Box */}
                       <div className="bg-white/90 backdrop-blur p-5 rounded-xl shadow-lg border border-gray-200 w-72 flex-shrink-0">
                           <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                               <MapPin size={16} className="text-emerald-600"/> My Holdings
                           </h3>
                           {parcels.length === 0 ? (
                               <p className="text-xs text-gray-500 italic">No fields defined yet.</p>
                           ) : (
                               <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                                   {parcels.map(p => (
                                       <button 
                                           key={p.id}
                                           onClick={() => flyToParcel(p)}
                                           className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors flex items-center justify-between group"
                                       >
                                           <span className="truncate">{p.name}</span>
                                           <Locate size={14} className="opacity-0 group-hover:opacity-100 transition-opacity"/>
                                       </button>
                                   ))}
                               </div>
                           )}
                       </div>

                       {/* Analysis Layers Box (Wider) */}
                       <div className="bg-white/90 backdrop-blur p-5 rounded-xl shadow-lg border border-gray-200 w-72 flex-shrink-0">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Layers size={16} className="text-emerald-600"/> Analysis Layers
                            </h3>
                            <div className="space-y-1.5">
                                {analysisLayers.map(layer => (
                                    <button
                                        key={layer.id}
                                        onClick={() => setActiveLayer(layer.id)}
                                        disabled={isOffline && layer.id !== 'none'}
                                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-between group ${
                                            activeLayer === layer.id 
                                            ? 'bg-emerald-600 text-white' 
                                            : 'text-gray-600 hover:bg-gray-50'
                                        } ${isOffline && layer.id !== 'none' ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    >
                                        <span>{layer.label}</span>
                                        {activeLayer === layer.id && loadingLayer && <RefreshCw size={14} className="animate-spin" />}
                                    </button>
                                ))}
                            </div>
                            {isOffline && (
                                <div className="mt-4 p-3 bg-amber-50 rounded border border-amber-100 flex items-center gap-3 text-xs text-amber-700 leading-tight">
                                    <Zap size={16} className="flex-shrink-0" />
                                    <span>Analysis requires active backend connection.</span>
                                </div>
                            )}
                        </div>
                   </div>

                   {/* Bottom Right Panel: Interaction Helper */}
                   <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-4">
                        <div className="bg-black/70 backdrop-blur-md p-4 rounded-xl text-white text-[11px] shadow-2xl border border-white/10 w-64 animate-in slide-in-from-right-4 duration-500">
                            <h4 className="font-bold mb-3 flex items-center gap-2 text-emerald-400 uppercase tracking-widest">
                                <MousePointer2 size={14} /> Navigation Guide
                            </h4>
                            <ul className="space-y-2 opacity-90">
                                <li className="flex justify-between border-b border-white/5 pb-1"><span>Orbit Globe</span> <span className="text-emerald-300 font-medium">Left Drag</span></li>
                                <li className="flex justify-between border-b border-white/5 pb-1"><span>Zoom In/Out</span> <span className="text-emerald-300 font-medium">Right Drag</span></li>
                                <li className="flex justify-between"><span>Tilt Perspective</span> <span className="text-emerald-300 font-medium">Ctrl + Drag</span></li>
                            </ul>
                        </div>
                   </div>

                   {/* Legend Overlay (Repositioned to not clash with larger sidebar) */}
                   {activeLayer !== 'none' && !isOffline && (
                        <div className="absolute bottom-6 left-[20rem] z-10 bg-white/90 backdrop-blur px-5 py-4 rounded-xl shadow-2xl border border-gray-200 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Layers size={14} /> {activeLayer} Index Reference
                            </div>
                            <div className="flex items-center gap-6">
                                {activeLayer === 'ndvi' && (
                                    <>
                                        <div className="flex flex-col items-center gap-1.5"><div className="w-4 h-4 rounded-full bg-[#a1662f] shadow-sm"></div><span className="text-[10px] font-bold">0.0</span></div>
                                        <div className="flex flex-col items-center gap-1.5"><div className="w-4 h-4 rounded-full bg-[#eab308] shadow-sm"></div><span className="text-[10px] font-bold">0.3</span></div>
                                        <div className="flex flex-col items-center gap-1.5"><div className="w-4 h-4 rounded-full bg-[#84cc16] shadow-sm"></div><span className="text-[10px] font-bold">0.6</span></div>
                                        <div className="flex flex-col items-center gap-1.5"><div className="w-4 h-4 rounded-full bg-[#22c55e] shadow-sm"></div><span className="text-[10px] font-bold">0.9</span></div>
                                    </>
                                )}
                                {activeLayer === 'ndmi' && (
                                    <>
                                        <div className="flex flex-col items-center gap-1.5"><div className="w-4 h-4 rounded-full bg-[#caf0f8] shadow-sm"></div><span className="text-[10px] font-bold">Dry</span></div>
                                        <div className="flex flex-col items-center gap-1.5"><div className="w-4 h-4 rounded-full bg-[#0077b6] shadow-sm"></div><span className="text-[10px] font-bold">Wet</span></div>
                                        <div className="flex flex-col items-center gap-1.5"><div className="w-4 h-4 rounded-full bg-[#03045e] shadow-sm"></div><span className="text-[10px] font-bold">Water</span></div>
                                    </>
                                )}
                                {activeLayer === 'lst' && (
                                    <>
                                        <div className="flex flex-col items-center gap-1.5"><div className="w-4 h-4 rounded-full bg-blue-500 shadow-sm"></div><span className="text-[10px] font-bold">Cold</span></div>
                                        <div className="flex flex-col items-center gap-1.5"><div className="w-4 h-4 rounded-full bg-yellow-400 shadow-sm"></div><span className="text-[10px] font-bold">Mild</span></div>
                                        <div className="flex flex-col items-center gap-1.5"><div className="w-4 h-4 rounded-full bg-red-500 shadow-sm"></div><span className="text-[10px] font-bold">Hot</span></div>
                                    </>
                                )}
                                {(activeLayer === 'ndre' || activeLayer === 'lai') && (
                                    <div className="flex items-center gap-3">
                                        <div className="h-2.5 w-32 rounded-full bg-gradient-to-r from-[#a1662f] via-[#facc15] to-[#15803d] shadow-inner"></div>
                                        <span className="text-[10px] font-bold text-gray-500">Sparse → Dense Biomass</span>
                                    </div>
                                )}
                            </div>
                        </div>
                   )}
               </>
           )}
        </div>
    );
};
