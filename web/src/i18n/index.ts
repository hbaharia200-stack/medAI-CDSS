import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import sw from './sw.json';

export const STORAGE_KEY_LANGUAGE = 'medai.web.language';
export type AppLanguage = 'en' | 'sw';

export const resources = {
  en: { translation: en },
  sw: { translation: sw },
} as const;

export function loadStoredLanguage(): AppLanguage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_LANGUAGE);
    if (stored === 'en' || stored === 'sw') {
      return stored;
    }
  } catch {
    // localStorage may be unavailable in restricted contexts.
  }
  return 'en';
}

export function setLanguage(lng: AppLanguage) {
  void i18n.changeLanguage(lng);
  try {
    localStorage.setItem(STORAGE_KEY_LANGUAGE, lng);
  } catch {
    // Ignore localStorage failures.
  }
}

export function initI18n() {
  return new Promise<typeof i18n>((resolve) => {
    i18n.use(initReactI18next).init(
      {
        resources,
        lng: loadStoredLanguage(),
        fallbackLng: 'en',
        interpolation: { escapeValue: false },
      },
      () => resolve(i18n),
    );
  });
}

export default i18n;
