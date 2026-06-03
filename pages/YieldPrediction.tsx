import React, { useState } from 'react';
import { Sprout, Activity, Database, AreaChart, TrendingUp, AlertCircle, Loader2, CheckCircle2, MapPin } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useParcels } from '../context/ParcelContext';
import { getBackendUrl } from '../utils/geeService';

interface PredictionRequest {
  parcelId: string;
  cropType: string;
  sowingDate: string;
  nitrogenApplied: number;
  soilType: string;
  areaHa: number;
}

interface PredictionResult {
  dssat_baseline_yield: number;
  dssat_biomass_marker: number;
  dssat_lai_marker: number;
  satellite_ndvi_mean: number;
  satellite_fapar_mean: number;
  ml_correction_factor: number;
  final_predicted_yield: number;
  confidence_interval: [number, number];
  lstm_loss: number;
}

export const YieldPrediction: React.FC = () => {
    const { t } = useSettings();
    const { parcels } = useParcels();
    const [loading, setLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<PredictionResult | null>(null);

    // Automatically match first parcel or empty
    const defaultParcel = parcels[0] || null;

    const [formData, setFormData] = useState<PredictionRequest>({
      parcelId: defaultParcel ? defaultParcel.id : '',
      cropType: defaultParcel ? defaultParcel.crop : 'Winter Wheat',
      sowingDate: defaultParcel && defaultParcel.date ? defaultParcel.date : new Date().toISOString().split('T')[0],
      nitrogenApplied: 120, // Manual input
      soilType: 'Loam', // Default
      areaHa: defaultParcel ? parseFloat(defaultParcel.size) : 10,
    });

    const handleParcelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedId = e.target.value;
        const selectedParcel = parcels.find(p => p.id === selectedId);
        
        if (selectedParcel) {
            setFormData({
                ...formData,
                parcelId: selectedId,
                cropType: selectedParcel.crop,
                sowingDate: selectedParcel.date || new Date().toISOString().split('T')[0],
                areaHa: parseFloat(selectedParcel.size) || 10,
            });
            // Reset results when field changes
            setResult(null);
            setError(null);
        }
    };

    const handlePredict = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.parcelId) {
            setError("Please add and select a field first.");
            return;
        }

        setLoading(true);
        setLoadingStep(1);
        setError(null);
        setResult(null);
        
        // Simulate step progression purely for UI effect while waiting for backend
        const stepInterval = setInterval(() => {
            setLoadingStep(prev => prev < 4 ? prev + 1 : prev);
        }, 2800);

        try {
            const backendUrl = getBackendUrl();
            
            const res = await fetch(`${backendUrl}/api/predict-yield`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            clearInterval(stepInterval);

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Server error during prediction');
            }
            
            const data = await res.json();
            setResult(data as PredictionResult);
            
        } catch (err: any) {
             clearInterval(stepInterval);
             setError(err.message || 'Failed to connect to the prediction server. Please ensure the backend is running.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto pb-12 space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-gray-900 border-l-[6px] border-emerald-600 pl-4">{t('nav.yield')}</h1>
                <p className="text-gray-500 pl-5">
                    Estimate your crop yield.
                </p>
            </div>

            <div className="grid lg:grid-cols-12 gap-8">
                {/* Input Form */}
                <div className="lg:col-span-4 space-y-6">
                    <form onSubmit={handlePredict} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                            <MapPin className="text-emerald-600" />
                            Target Field
                        </h2>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select Field</label>
                                {parcels.length === 0 ? (
                                    <div className="text-sm text-red-600 p-2 bg-red-50 rounded-lg">No fields available. Please add a field in the map tab first.</div>
                                ) : (
                                    <select 
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                        value={formData.parcelId}
                                        onChange={handleParcelChange}
                                        required
                                    >
                                        {parcels.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.crop})</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Show extracted features in disabled input to show transparency */}
                            {formData.parcelId && (
                                <div className="space-y-4">
                                    <div className="p-4 bg-emerald-50/50 rounded-lg border border-emerald-100 space-y-3 mt-4">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Crop Type:</span>
                                            <span className="font-medium text-gray-900">{formData.cropType}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Sowing Date:</span>
                                            <span className="font-medium text-gray-900">{formData.sowingDate}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Area (ha):</span>
                                            <span className="font-medium text-gray-900">{formData.areaHa}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Soil Map Base:</span>
                                            <span className="font-medium text-gray-900">{formData.soilType}</span>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-gray-100">
                                        <label className="block text-sm font-bold text-gray-800 mb-2">Nitrogen Applied (kg/ha)</label>
                                        <input 
                                            type="number"
                                            className="w-full bg-white border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                            value={formData.nitrogenApplied}
                                            onChange={(e) => setFormData({...formData, nitrogenApplied: Number(e.target.value)})}
                                            min="0"
                                            max="500"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">Leave at 0 to evaluate yield without fertilizer.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading || parcels.length === 0}
                            className="mt-8 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <Activity size={20} />}
                            {loading ? 'Predicting Yield...' : 'Predict Yield'}
                        </button>
                    </form>
                    
                    {error && (
                        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 flex items-start gap-3">
                            <AlertCircle className="mt-0.5 flex-shrink-0" size={20} />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}
                </div>

                {/* Results Panel */}
                <div className="lg:col-span-8">
                    {loading && (
                        <div className="h-full bg-gray-50 rounded-2xl border border-gray-200 border-dashed flex flex-col items-center justify-center min-h-[400px] text-gray-500 space-y-4">
                            <Loader2 className="animate-spin text-emerald-600 mb-2" size={48} />
                            <div className="font-mono text-sm flex flex-col items-center gap-3 w-80">
                                <div className={`flex items-center gap-3 w-full transition-opacity duration-300 ${loadingStep >= 1 ? 'opacity-100' : 'opacity-30'}`}>
                                    {loadingStep > 1 ? <CheckCircle2 size={16} className="text-emerald-500" /> : (loadingStep === 1 ? <Loader2 size={16} className="animate-spin text-blue-500" /> : <div className="w-4 h-4 rounded-full border border-gray-300" />)}
                                    <span className={loadingStep === 1 ? 'text-blue-600 font-medium' : ''}>[1] Collecting Weather Data...</span>
                                </div>
                                <div className={`flex items-center gap-3 w-full transition-opacity duration-300 ${loadingStep >= 2 ? 'opacity-100' : 'opacity-30'}`}>
                                    {loadingStep > 2 ? <CheckCircle2 size={16} className="text-emerald-500" /> : (loadingStep === 2 ? <Loader2 size={16} className="animate-spin text-blue-500" /> : <div className="w-4 h-4 rounded-full border border-gray-300" />)}
                                    <span className={loadingStep === 2 ? 'text-blue-600 font-medium' : ''}>[2] Analyzing Crop Growth...</span>
                                </div>
                                <div className={`flex items-center gap-3 w-full transition-opacity duration-300 ${loadingStep >= 3 ? 'opacity-100' : 'opacity-30'}`}>
                                    {loadingStep > 3 ? <CheckCircle2 size={16} className="text-emerald-500" /> : (loadingStep === 3 ? <Loader2 size={16} className="animate-spin text-blue-500" /> : <div className="w-4 h-4 rounded-full border border-gray-300" />)}
                                    <span className={loadingStep === 3 ? 'text-blue-600 font-medium' : ''}>[3] Fetching Satellite Imagery...</span>
                                </div>
                                <div className={`flex items-center gap-3 w-full transition-opacity duration-300 ${loadingStep >= 4 ? 'opacity-100' : 'opacity-30'}`}>
                                    {loadingStep > 4 ? <CheckCircle2 size={16} className="text-emerald-500" /> : (loadingStep === 4 ? <Loader2 size={16} className="animate-spin text-blue-500" /> : <div className="w-4 h-4 rounded-full border border-gray-300" />)}
                                    <span className={loadingStep === 4 ? 'text-blue-600 font-medium' : ''}>[4] Calculating Final Prediction...</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {!loading && !result && (
                        <div className="h-full bg-gray-50 rounded-2xl border border-gray-200 border-dashed flex flex-col items-center justify-center min-h-[400px] text-gray-400 p-8 text-center">
                            <Database size={48} className="mb-4 text-emerald-200" />
                            <p>Enter crop parameters to run the Hybrid Prediction.</p>
                        </div>
                    )}

                    {!loading && result && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 fade-in">
                            {/* Final Output Hero */}
                            <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 p-8 rounded-2xl shadow-lg border border-emerald-800 text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-32 opacity-10">
                                    <Sprout size={200} />
                                </div>
                                <h3 className="text-emerald-300 font-medium tracking-wide text-sm mb-2 uppercase">Predicted Final Yield</h3>
                                <div className="flex items-end gap-3 font-mono">
                                    <span className="text-6xl font-bold tracking-tight">{result.final_predicted_yield.toFixed(2)}</span>
                                    <span className="text-2xl text-emerald-200 mb-2">t/ha</span>
                                </div>
                                <div className="mt-4 flex items-center gap-2 text-emerald-200/80 text-sm">
                                    <CheckCircle2 size={16} className="text-emerald-400" />
                                    <span>Confidence Interval: {result.confidence_interval[0].toFixed(2)} — {result.confidence_interval[1].toFixed(2)} t/ha</span>
                                </div>
                            </div>

                            {/* Architecture Breakdown */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                    <div className="flex items-center gap-2 text-gray-700 font-semibold mb-4 border-b border-gray-100 pb-2">
                                        <Database size={18} className="text-blue-600" /> Growth Model
                                    </div>
                                    <div className="space-y-3 font-mono text-sm text-gray-600">
                                        <div className="flex justify-between">
                                            <span>Baseline Yield:</span>
                                            <span className="font-medium text-gray-900">{result.dssat_baseline_yield.toFixed(2)} t/ha</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Simulated LAI:</span>
                                            <span className="font-medium text-gray-900">{result.dssat_lai_marker.toFixed(2)} m²/m²</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Simulated Biomass:</span>
                                            <span className="font-medium text-gray-900">{result.dssat_biomass_marker.toFixed(0)} kg/ha</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                    <div className="flex items-center gap-2 text-gray-700 font-semibold mb-4 border-b border-gray-100 pb-2">
                                        <AreaChart size={18} className="text-indigo-600" /> Satellite Analysis
                                    </div>
                                    <div className="space-y-3 font-mono text-sm text-gray-600">
                                        <div className="flex justify-between">
                                            <span>Satellite NDVI Mean:</span>
                                            <span className="font-medium text-gray-900">{result.satellite_ndvi_mean.toFixed(3)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>FAPAR Integration:</span>
                                            <span className="font-medium text-gray-900">{result.satellite_fapar_mean.toFixed(3)}</span>
                                        </div>
                                        <div className="flex justify-between text-emerald-700">
                                            <span>Adjustment:</span>
                                            <span className="font-medium font-bold">{result.ml_correction_factor > 0 ? '+' : ''}{(result.ml_correction_factor * 100).toFixed(1)}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
