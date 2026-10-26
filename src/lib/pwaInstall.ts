import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    __videomakerDeferredPrompt?: BeforeInstallPromptEvent | null;
  }
}

export type DevicePlatform = 'ios' | 'android' | 'desktop';

const STORAGE_DISMISSED_KEY = 'videomaker_pwa_dismissed';
const STORAGE_INSTALLED_KEY = 'videomaker_pwa_installed';

let deferredPromptGlobal: BeforeInstallPromptEvent | null =
  typeof window !== 'undefined' && window.__videomakerDeferredPrompt
    ? window.__videomakerDeferredPrompt
    : null;

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(fn => fn());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPromptGlobal = e as BeforeInstallPromptEvent;
    window.__videomakerDeferredPrompt = deferredPromptGlobal;
    notifyListeners();
  });

  window.addEventListener('videomaker:install-ready', () => {
    if (window.__videomakerDeferredPrompt) {
      deferredPromptGlobal = window.__videomakerDeferredPrompt;
      notifyListeners();
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredPromptGlobal = null;
    window.__videomakerDeferredPrompt = null;
    try {
      localStorage.setItem(STORAGE_INSTALLED_KEY, 'true');
    } catch {}
    notifyListeners();
  });
}

export function detectStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const standaloneMedia =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches;
    const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const twaReferrer =
      typeof document !== 'undefined' && document.referrer.includes('android-app://');
    return Boolean(standaloneMedia || iosStandalone || twaReferrer);
  } catch {
    return false;
  }
}

export function detectDevicePlatform(): DevicePlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function detectBrowserKind(): 'safari' | 'firefox' | 'chromium' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/Firefox|FxiOS/i.test(ua)) return 'firefox';
  if (/Edg|Chrome|CriOS|SamsungBrowser/i.test(ua)) return 'chromium';
  if (/Safari/i.test(ua) && !/Chrome|CriOS|Edg/i.test(ua)) return 'safari';
  return 'other';
}

function readStorageFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function usePWAInstall() {
  const [isStandalone, setIsStandalone] = useState<boolean>(() => detectStandaloneMode());
  const [isInstalled, setIsInstalled] = useState<boolean>(
    () => detectStandaloneMode() || readStorageFlag(STORAGE_INSTALLED_KEY)
  );
  const [hasDismissedInvite, setHasDismissedInvite] = useState<boolean>(() =>
    readStorageFlag(STORAGE_DISMISSED_KEY)
  );
  const [canPromptNatively, setCanPromptNatively] = useState<boolean>(() =>
    Boolean(deferredPromptGlobal || (typeof window !== 'undefined' && window.__videomakerDeferredPrompt))
  );
  const [platform] = useState<DevicePlatform>(() => detectDevicePlatform());
  const [browserKind] = useState<'safari' | 'firefox' | 'chromium' | 'other'>(() =>
    detectBrowserKind()
  );

  useEffect(() => {
    const syncState = () => {
      const standaloneNow = detectStandaloneMode();
      const promptAvailable = Boolean(
        deferredPromptGlobal || window.__videomakerDeferredPrompt
      );
      setIsStandalone(standaloneNow);
      setIsInstalled(standaloneNow || readStorageFlag(STORAGE_INSTALLED_KEY));
      setHasDismissedInvite(readStorageFlag(STORAGE_DISMISSED_KEY));
      setCanPromptNatively(promptAvailable);
    };

    syncState();
    listeners.add(syncState);

    let mql: MediaQueryList | null = null;
    try {
      mql = window.matchMedia('(display-mode: standalone)');
      mql.addEventListener('change', syncState);
    } catch {}

    return () => {
      listeners.delete(syncState);
      if (mql) {
        try {
          mql.removeEventListener('change', syncState);
        } catch {}
      }
    };
  }, []);

  const triggerNativeInstall = useCallback(async (): Promise<
    'accepted' | 'dismissed' | 'unavailable'
  > => {
    const promptEvent =
      deferredPromptGlobal ||
      (typeof window !== 'undefined' ? window.__videomakerDeferredPrompt : null);

    if (!promptEvent || typeof promptEvent.prompt !== 'function') {
      return 'unavailable';
    }

    try {
      await promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      deferredPromptGlobal = null;
      if (typeof window !== 'undefined') {
        window.__videomakerDeferredPrompt = null;
      }

      if (choiceResult.outcome === 'accepted') {
        try {
          localStorage.setItem(STORAGE_INSTALLED_KEY, 'true');
        } catch {}
        setIsInstalled(true);
        notifyListeners();
        return 'accepted';
      }

      notifyListeners();
      return 'dismissed';
    } catch {
      deferredPromptGlobal = null;
      if (typeof window !== 'undefined') {
        window.__videomakerDeferredPrompt = null;
      }
      notifyListeners();
      return 'unavailable';
    }
  }, []);

  const dismissInvite = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_DISMISSED_KEY, 'true');
    } catch {}
    setHasDismissedInvite(true);
    notifyListeners();
  }, []);

  const shouldAutoShowInvite = !isStandalone && !isInstalled && !hasDismissedInvite;

  return {
    isStandalone,
    isInstalled,
    hasDismissedInvite,
    canPromptNatively,
    platform,
    browserKind,
    shouldAutoShowInvite,
    triggerNativeInstall,
    dismissInvite,
  };
}
