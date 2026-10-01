import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './index.css';
import i18n, { initI18n, loadStoredLanguage } from './i18n';
import { ThemeProvider } from './theme/ThemeProvider';
import { AppRoutes } from './router';

declare global {
  interface Window {
    /** Set when app bootstrap fails (dev debugging aid — see bootstrap()). */
    __lastError?: string;
  }
}

async function bootstrap() {
  try {
    await initI18n();
    const storedLanguage = loadStoredLanguage();
    await i18n.changeLanguage(storedLanguage);

    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <ThemeProvider>
          <HashRouter>
            <AppRoutes />
          </HashRouter>
        </ThemeProvider>
      </StrictMode>,
    );
  } catch (err) {
    window.__lastError = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    console.error('[MedAI web] bootstrap failed:', err);
    if (import.meta.env.DEV) {
      const el = document.getElementById('root');
      if (el) {
        el.innerHTML = `<pre style="color:#9E1B19">Bootstrap failed:\n${window.__lastError.replace(/</g, '&lt;')}</pre>`;
      }
    }
  }
}

void bootstrap();
