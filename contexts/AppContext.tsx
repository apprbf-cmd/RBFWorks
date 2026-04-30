import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { I18nManager } from 'react-native';
import { Language } from '@/constants/i18n';
import {
  AuthUser,
  getAuthUser,
  getLanguage,
  saveAuthUser,
  saveLanguage,
  clearAuthUser,
} from '@/services/storage';

interface AppContextType {
  user: AuthUser | null;
  isLoading: boolean;
  language: Language;
  isRTL: boolean;
  login: (user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  setLanguage: (lang: Language) => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [language, setLang] = useState<Language>('en');

  const isRTL = language === 'ar';

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      const [savedUser, savedLang] = await Promise.all([
        getAuthUser(),
        getLanguage(),
      ]);
      if (savedUser) setUser(savedUser);
      if (savedLang) setLang(savedLang as Language);
    } catch (e) {
      console.log('Init error', e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (newUser: AuthUser) => {
    await saveAuthUser(newUser);
    setUser(newUser);
  };

  const logout = async () => {
    await clearAuthUser();
    setUser(null);
  };

  const setLanguage = async (lang: Language) => {
    await saveLanguage(lang);
    setLang(lang);
  };

  return (
    <AppContext.Provider value={{ user, isLoading, language, isRTL, login, logout, setLanguage }}>
      {children}
    </AppContext.Provider>
  );
}
