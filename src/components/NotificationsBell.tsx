import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { BellRing, Film, Camera, Sparkles, Calendar, X, CheckCircle2 } from 'lucide-react';
import { Post, Story, Activity } from '../types';
import { formatLuandaDate } from '../lib/visitor';

export interface AdminFeedNotification {
  id: string;
  kind: 'post' | 'story' | 'activity';
  title: string;
  subtitle: string;
  createdAt: string;
  mediaType?: 'photo' | 'video';
  targetId: string;
}

const SEEN_NOTIFS_KEY = 'videomaker_seen_notifications_v1';
const PUSH_PREF_KEY = 'videomaker_browser_notifs_enabled';

function readSeenIds(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_NOTIFS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSeenIds(ids: string[]) {
  try {
    localStorage.setItem(SEEN_NOTIFS_KEY, JSON.stringify(ids.slice(-250)));
  } catch {}
}

export function useAdminNotifications(
  posts: Post[],
  stories: Story[],
  activities: Activity[]
) {
  const [seenIds, setSeenIds] = useState<string[]>(() => readSeenIds());
  const [liveToast, setLiveToast] = useState<AdminFeedNotification | null>(null);
  const [browserAlertsEnabled, setBrowserAlertsEnabled] = useState<boolean>(() => {
    try {
      return (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        localStorage.getItem(PUSH_PREF_KEY) === 'true'
      );
    } catch {
      return false;
    }
  });

  const initializedRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());

  const notifications: AdminFeedNotification[] = useMemo(() => {
    const postItems: AdminFeedNotification[] = posts.slice(0, 10).map(p => ({
      id: `post:${p.id}`,
      kind: 'post',
      title: p.title,
      subtitle: p.type === 'video' ? 'Novo vídeo publicado na Galeria' : 'Nova fotografia publicada na Galeria',
      createdAt: p.createdAt,
      mediaType: p.type,
      targetId: p.id,
    }));

    const storyItems: AdminFeedNotification[] = stories.slice(0, 6).map(s => ({
      id: `story:${s.id}`,
      kind: 'story',
      title: s.title || 'Novo Story da Igreja Metodista',
      subtitle: 'Story disponível por 24 horas',
      createdAt: s.createdAt,
      mediaType: s.type,
      targetId: s.id,
    }));

    const activityItems: AdminFeedNotification[] = activities.slice(0, 5).map(a => ({
      id: `activity:${a.id}`,
      kind: 'activity',
      title: a.title,
      subtitle: `Atividade agendada · ${a.location || 'Igreja Metodista'}`,
      createdAt: a.createdAt || a.date,
      targetId: a.id,
    }));

    return [...postItems, ...storyItems, ...activityItems]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12);
  }, [posts, stories, activities]);

  useEffect(() => {
    if (notifications.length === 0) return;

    if (!initializedRef.current) {
      notifications.forEach(n => knownIdsRef.current.add(n.id));
      initializedRef.current = true;
      return;
    }

    const newlyArrived = notifications.filter(n => !knownIdsRef.current.has(n.id));
    if (newlyArrived.length > 0) {
      newlyArrived.forEach(n => knownIdsRef.current.add(n.id));
      const latest = newlyArrived[0];
      setLiveToast(latest);

      if (browserAlertsEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready
            .then(reg => {
              reg.showNotification('Videomaker — Fernando Kibuba', {
                body: `${latest.subtitle}: ${latest.title}`,
                icon: '/pwa-192x192.png',
                badge: '/pwa-192x192.png',
                tag: latest.id,
              });
            })
            .catch(() => {});
        }
      }

      const timer = window.setTimeout(() => {
        setLiveToast(prev => (prev?.id === latest.id ? null : prev));
      }, 6500);
      return () => window.clearTimeout(timer);
    }
  }, [notifications, browserAlertsEnabled]);

  const unreadCount = useMemo(
    () => notifications.filter(n => !seenIds.includes(n.id)).length,
    [notifications, seenIds]
  );

  const markAllSeen = useCallback(() => {
    setSeenIds(prev => {
      const merged = Array.from(new Set([...prev, ...notifications.map(n => n.id)]));
      saveSeenIds(merged);
      return merged;
    });
  }, [notifications]);

  const enableBrowserAlerts = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        localStorage.setItem(PUSH_PREF_KEY, 'true');
        setBrowserAlertsEnabled(true);
      }
    } catch {}
  }, []);

  const dismissLiveToast = useCallback(() => {
    setLiveToast(null);
  }, []);

  return {
    notifications,
    unreadCount,
    markAllSeen,
    browserAlertsEnabled,
    enableBrowserAlerts,
    liveToast,
    dismissLiveToast,
  };
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AdminFeedNotification[];
  browserAlertsEnabled: boolean;
  onEnableBrowserAlerts: () => void;
  onSelectNotification: (item: AdminFeedNotification) => void;
  theme: 'dark' | 'light';
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  browserAlertsEnabled,
  onEnableBrowserAlerts,
  onSelectNotification,
  theme,
}) => {
  const isLight = theme === 'light';

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="notifications-modal-title"
    >
      <div
        data-testid="notifications-modal"
        onClick={e => e.stopPropagation()}
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[82vh] ${
          isLight
            ? 'bg-white border-neutral-200 text-neutral-900'
            : 'bg-[#0c0c12] border-white/12 text-white'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between gap-3 ${
            isLight ? 'border-neutral-200 bg-neutral-50' : 'border-white/10 bg-white/[0.02]'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400/20 via-orange-500/15 to-[#E50914]/25 border border-amber-400/35 flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2 id="notifications-modal-title" className="text-base font-bold tracking-tight truncate">
                Notificações
              </h2>
              <p className={`text-xs truncate ${isLight ? 'text-neutral-500' : 'text-gray-400'}`}>
                Publicações, Stories e atividades recentes da igreja
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center transition cursor-pointer ${
              isLight ? 'hover:bg-neutral-200 text-neutral-600' : 'hover:bg-white/10 text-gray-400 hover:text-white'
            }`}
            aria-label="Fechar notificações"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Browser Push Alert Banner */}
        {typeof Notification !== 'undefined' && Notification.permission !== 'denied' && (
          <div
            className={`px-5 py-3 border-b flex items-center justify-between gap-3 text-xs ${
              isLight ? 'border-neutral-200 bg-amber-50/70' : 'border-white/10 bg-amber-500/[0.06]'
            }`}
          >
            <span className={isLight ? 'text-neutral-700' : 'text-gray-300'}>
              {browserAlertsEnabled
                ? 'Alertas automáticos ativados neste dispositivo'
                : 'Recebe avisos quando forem publicados novos vídeos ou fotos'}
            </span>
            {browserAlertsEnabled ? (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-500 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Ativo
              </span>
            ) : (
              <button
                type="button"
                onClick={onEnableBrowserAlerts}
                className="px-3 py-1.5 rounded-xl bg-amber-400 text-black font-bold hover:bg-amber-300 transition shrink-0 cursor-pointer"
              >
                Ativar alertas
              </button>
            )}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/5">
          {notifications.length === 0 ? (
            <div className="py-14 px-6 text-center">
              <p className={`text-sm font-medium ${isLight ? 'text-neutral-600' : 'text-gray-300'}`}>
                Ainda não existem notificações recentes.
              </p>
              <p className={`text-xs mt-1 ${isLight ? 'text-neutral-500' : 'text-gray-500'}`}>
                Assim que o Videomaker publicar novas fotografias, vídeos ou Stories, aparecerão aqui.
              </p>
            </div>
          ) : (
            notifications.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectNotification(item)}
                className={`w-full text-left px-5 py-3.5 flex items-start gap-3.5 transition cursor-pointer ${
                  isLight ? 'hover:bg-neutral-100' : 'hover:bg-white/[0.04]'
                }`}
              >
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/15 to-[#E50914]/20 border border-amber-500/25 flex items-center justify-center shrink-0 mt-0.5">
                  {item.kind === 'story' ? (
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  ) : item.kind === 'activity' ? (
                    <Calendar className="w-4 h-4 text-amber-400" />
                  ) : item.mediaType === 'video' ? (
                    <Film className="w-4 h-4 text-[#E50914]" />
                  ) : (
                    <Camera className="w-4 h-4 text-amber-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{item.title}</p>
                  <p className={`text-xs mt-0.5 truncate ${isLight ? 'text-neutral-600' : 'text-gray-400'}`}>
                    {item.subtitle}
                  </p>
                  <p className={`text-[11px] mt-1 font-mono tabular-nums ${isLight ? 'text-neutral-400' : 'text-gray-500'}`}>
                    {formatLuandaDate(item.createdAt)}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

interface LiveAdminToastProps {
  toast: AdminFeedNotification | null;
  onSelect: (item: AdminFeedNotification) => void;
  onDismiss: () => void;
}

export const LiveAdminToast: React.FC<LiveAdminToastProps> = ({
  toast,
  onSelect,
  onDismiss,
}) => {
  if (!toast) return null;

  return (
    <div
      data-testid="live-admin-post-toast"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-[80] rounded-2xl bg-[#111118]/95 backdrop-blur-xl border border-amber-500/35 shadow-[0_16px_45px_rgba(0,0,0,0.75)] p-3.5 text-white flex items-center gap-3"
    >
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-[#E50914] text-black flex items-center justify-center shrink-0">
        <BellRing className="w-5 h-5" />
      </div>
      <button
        type="button"
        onClick={() => onSelect(toast)}
        className="min-w-0 flex-1 text-left cursor-pointer"
      >
        <p className="text-[11px] font-bold text-amber-400">
          {toast.subtitle}
        </p>
        <p className="text-xs sm:text-sm font-bold text-white truncate">
          {toast.title}
        </p>
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
        aria-label="Fechar aviso"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
