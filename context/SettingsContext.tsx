import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';
type Language = 'en' | 'da' | 'no' | 'sv';
type Units = 'metric' | 'imperial';

interface SettingsContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  notifications: boolean;
  setNotifications: (notif: boolean) => void;
  units: Units;
  setUnits: (units: Units) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.map': 'Field Map',
    'nav.globe': '3D Earth',
    'nav.ai': 'AI Assistant',
    'nav.yield': 'Yield Prediction',
    'nav.disease': 'Disease Prediction',
    'nav.subscription': 'Subscription',
    'nav.settings': 'Settings',
    'nav.signout': 'Sign Out',
    'welcome.back': 'Welcome Back',
  },
  da: {
    'nav.dashboard': 'Instrumentbræt',
    'nav.map': 'Markkort',
    'nav.globe': '3D Jord',
    'nav.ai': 'AI Assistent',
    'nav.yield': 'Udbytte Forudsigelse',
    'nav.disease': 'Sygdomsprognose',
    'nav.subscription': 'Abonnement',
    'nav.settings': 'Indstillinger',
    'nav.signout': 'Log ud',
    'welcome.back': 'Velkommen tilbage',
  },
  no: {
    'nav.dashboard': 'Dashbord',
    'nav.map': 'Feltkart',
    'nav.globe': '3D Jord',
    'nav.ai': 'AI Assistent',
    'nav.yield': 'Avlingsprognose',
    'nav.disease': 'Sykdomsprognose',
    'nav.subscription': 'Abonnement',
    'nav.settings': 'Innstillinger',
    'nav.signout': 'Logg ut',
    'welcome.back': 'Velkommen tilbake',
  },
  sv: {
    'nav.dashboard': 'Instrumentpanel',
    'nav.map': 'Fältkarta',
    'nav.globe': '3D Jord',
    'nav.ai': 'AI Assistent',
    'nav.yield': 'Skördeprognos',
    'nav.disease': 'Sjukdomsprognos',
    'nav.subscription': 'Prenumeration',
    'nav.settings': 'Inställningar',
    'nav.signout': 'Logga ut',
    'welcome.back': 'Välkommen tillbaka',
  }
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(
    (localStorage.getItem('app_theme') as Theme) || 'light'
  );
  const [language, setLanguageState] = useState<Language>(
    (localStorage.getItem('app_language') as Language) || 'en'
  );
  const [notifications, setNotificationsState] = useState(
    localStorage.getItem('app_notifications') !== 'false'
  );
  const [units, setUnitsState] = useState<Units>(
    (localStorage.getItem('app_units') as Units) || 'metric'
  );

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('app_theme', newTheme);
  };

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
    localStorage.setItem('app_language', newLang);
  };

  const setNotifications = (newNotif: boolean) => {
    setNotificationsState(newNotif);
    localStorage.setItem('app_notifications', String(newNotif));
  };

  const setUnits = (newUnits: Units) => {
    setUnitsState(newUnits);
    localStorage.setItem('app_units', newUnits);
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Provide a translation function
  const t = (key: string): string => {
    return translations[language]?.[key] || translations['en'][key] || key;
  };

  return (
    <SettingsContext.Provider value={{ theme, setTheme, language, setLanguage, notifications, setNotifications, units, setUnits, t }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
