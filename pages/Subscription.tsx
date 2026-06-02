import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { CreditCard, Wrench } from 'lucide-react';

export const Subscription: React.FC = () => {
  const { t } = useSettings();

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
      <div className="bg-emerald-50 text-emerald-800 p-6 rounded-full border-[6px] border-emerald-100 mb-6">
        <CreditCard size={48} className="text-emerald-700" />
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-3">{t('nav.subscription')}</h1>
      <p className="text-gray-500 mb-8 max-w-sm mx-auto">
        Manage your subscription plans and payment methods to unlock advanced features.
      </p>
      <div className="flex items-center gap-2 px-6 py-3 rounded-full bg-orange-50 border border-orange-200 text-orange-700 font-medium">
        <Wrench size={18} />
        <span>Under Development</span>
      </div>
    </div>
  );
};
