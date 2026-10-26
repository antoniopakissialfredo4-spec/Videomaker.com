import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import './lib/pwaInstall';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    registerSW({
      immediate: true,
      onRegisterError(error) {
        console.warn('Falha ao registar Service Worker PWA:', error);
      },
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          regs.forEach((reg) => {
            if (reg.active?.scriptURL.includes('dev-sw.js?dev-sw')) {
              reg.unregister().catch(() => {});
            }
          });
        })
        .catch(() => {});

      navigator.serviceWorker.register('/dev-sw.js', {scope: '/'}).catch(() => {});
    });
  }
}

createRoot(document.getElementById('root')!).render(<App />);
