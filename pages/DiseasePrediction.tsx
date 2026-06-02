import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export const DiseasePrediction: React.FC = () => {
    const { t } = useSettings();

    return (
        <div className="max-w-6xl mx-auto pb-12 space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-gray-900 border-l-[6px] border-emerald-600 pl-4">
                    {t('nav.disease')}
                </h1>
                <p className="text-gray-500 pl-5">
                    Early-warning system for crop diseases.
                </p>
            </div>

            <div className="h-full bg-gray-50 rounded-2xl border border-gray-200 border-dashed flex flex-col items-center justify-center min-h-[400px] text-gray-400 p-8 text-center">
                <ShieldAlert size={48} className="mb-4 text-emerald-200" />
                <p className="text-lg font-medium text-gray-600 mb-2">Disease Prediction Module</p>
                <p>This module is currently under development. It will use satellite imagery and weather data to predict disease risks.</p>
            </div>
        </div>
    );
};
