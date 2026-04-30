import { useContext } from 'react';
import { AppContext } from '@/contexts/AppContext';
import { translations, TranslationKey, Language } from '@/constants/i18n';

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}

export function useTranslation() {
  const { language } = useApp();
  const t = (key: TranslationKey): string => {
    return (translations[language] as any)[key] || (translations['en'] as any)[key] || key;
  };
  return { t, language };
}
