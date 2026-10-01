import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './en.json';
import sw from './sw.json';

export const STORAGE_KEY_LANGUAGE = '@medai_language';
export type AppLanguage = 'sw' | 'en';

export const resources = {
  en: { translation: en },
  sw: { translation: sw },
} as const;

export async function loadStoredLanguage(): Promise<AppLanguage> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY_LANGUAGE);
    return stored === 'en' || stored === 'sw' ? stored : 'sw'; // default Swahili
  } catch {
    return 'sw';
  }
}

export function setLanguage(lng: AppLanguage) {
  void i18n.changeLanguage(lng);
  void AsyncStorage.setItem(STORAGE_KEY_LANGUAGE, lng).catch(() => {});
}

export function initI18n() {
  return new Promise<typeof i18n>((resolve) => {
    i18n.use(initReactI18next).init(
      {
        resources,
        lng: 'sw', // default Swahili with a toggle; swapped to stored value by App bootstrap
        fallbackLng: 'en',
        interpolation: { escapeValue: false },
      },
      () => resolve(i18n),
    );
  });
}

export default i18n;