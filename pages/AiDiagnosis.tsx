import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Camera, Image as ImageIcon, Loader2, RefreshCw, AlertCircle, Scan } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useSettings } from '../context/SettingsContext';

export const AiDiagnosis: React.FC = () => {
    const { t } = useSettings();
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setError(null);
            setImageSrc(null);
            setResult(null);
            
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    setImageSrc(event.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
        // Reset the input value so the same file could be selected again if needed
        e.target.value = '';
    };

    const handleAnalyze = async () => {
        if (!imageSrc) return;
        setIsAnalyzing(true);
        setError(null);
        setResult(null);

        try {
            // Remove data URI prefix (e.g. data:image/jpeg;base64,)
            const base64Data = imageSrc.split(',')[1];
            const mimeTypeMatch = imageSrc.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
            const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';

            // Fallbacks
            // Use ts-ignore to bypass the process not defined error if vite didn't replace it
            // @ts-ignore
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY) || '';
            
            if (!apiKey) {
                throw new Error("Gemini API key is not configured.");
            }

            const ai = new GoogleGenAI({ apiKey });
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: 'Analyze this plant image for diseases, pests, or nutritional stress. Provide a brief diagnosis and a recommendation for the farmer.' },
                            { inlineData: { data: base64Data, mimeType: mimeType } }
                        ]
                    }
                ]
            });
            
            setResult(response.text || "No insights could be generated.");
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'An error occurred during analysis.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-12 space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t('nav.ai')}</h1>
                <p className="text-gray-500 dark:text-gray-400">Upload or take a picture of a crop to identify diseases and stress.</p>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-start gap-3">
                    <AlertCircle className="mt-0.5 flex-shrink-0" size={20} />
                    <div className="text-sm">{error}</div>
                </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden">
                        
                        {/* Image Preview */}
                        {imageSrc && (
                            <div className="absolute inset-0 bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
                                <img src={imageSrc} alt="Captured crop" className="max-w-full max-h-full object-contain rounded-lg shadow-sm" />
                            </div>
                        )}

                        {/* Initial State Options */}
                        {!imageSrc && (
                            <div className="flex flex-col items-center space-y-6">
                                <div className="flex justify-center items-center w-20 h-20 bg-emerald-100 dark:bg-emerald-900/50 rounded-full text-emerald-600 dark:text-emerald-400 mb-2">
                                    <Scan size={36} />
                                </div>
                                <div className="flex gap-4">
                                    <label className="flex flex-col items-center justify-center gap-2 w-32 py-4 px-2 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl transition-colors text-gray-700 dark:text-gray-300 font-medium text-sm shadow-sm active:bg-gray-100 dark:active:bg-gray-600 cursor-pointer">
                                        <Camera size={24} className="text-gray-500 dark:text-gray-400" />
                                        Take Photo
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            capture="environment" 
                                            className="hidden" 
                                            onChange={handleFileUpload} 
                                        />
                                    </label>
                                    <label className="flex flex-col items-center justify-center gap-2 w-32 py-4 px-2 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl transition-colors text-gray-700 dark:text-gray-300 font-medium text-sm shadow-sm active:bg-gray-100 dark:active:bg-gray-600 cursor-pointer">
                                        <ImageIcon size={24} className="text-gray-500 dark:text-gray-400" />
                                        Upload Image
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            className="hidden" 
                                            onChange={handleFileUpload} 
                                        />
                                    </label>
                                </div>
                            </div>
                        )}
                        

                    </div>

                    {imageSrc && (
                        <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-xl">
                            <button 
                                onClick={() => { setImageSrc(null); setResult(null); }}
                                className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors"
                            >
                                <RefreshCw size={16} /> New Image
                            </button>
                            <button 
                                onClick={handleAnalyze}
                                disabled={isAnalyzing}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {isAnalyzing && <Loader2 size={16} className="animate-spin" />}
                                {isAnalyzing ? 'Analyzing...' : 'Analyze Image'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Results Section */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6 overflow-y-auto max-h-[500px]">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700 pb-3 mb-4">Diagnosis Results</h3>
                    
                    {!result && !isAnalyzing && (
                        <div className="flex items-center justify-center h-[200px] text-gray-400 dark:text-gray-500 text-sm">
                            Submit an image to see analysis
                        </div>
                    )}

                    {isAnalyzing && (
                        <div className="flex flex-col items-center justify-center p-8 text-emerald-600 dark:text-emerald-400 gap-4">
                            <Loader2 size={40} className="animate-spin" />
                            <p className="font-medium animate-pulse">Consulting Gemini AI...</p>
                        </div>
                    )}

                    {result && !isAnalyzing && (
                        <div className="prose prose-emerald prose-sm max-w-none text-gray-700 dark:text-gray-300 
                            prose-headings:text-gray-900 dark:prose-headings:text-gray-100 
                            prose-strong:text-gray-900 dark:prose-strong:text-gray-100">
                            <ReactMarkdown>{result}</ReactMarkdown>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
