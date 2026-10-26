import React, { useState, useEffect, useRef } from 'react';
import {
  MoreVertical,
  X,
  Info,
  Film,
  ShieldCheck,
  Lock,
  Bell,
  Settings,
  Sun,
  Moon,
  Shield,
  Plus,
  ChevronRight,
} from 'lucide-react';
import { Logo } from './Logo';
import { AdminUser } from '../types';

interface NavbarProps {
  onNavigate: (sectionId: string) => void;
  onOpenSiteInfo: () => void;
  onOpenAdminModal: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onOpenSecurityPrivacy: () => void;
  onQuickPublish?: () => void;
  adminUser: AdminUser | null;
  theme: 'dark' | 'light';
  visitorName?: string;
  unreadNotificationsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onNavigate,
  onOpenSiteInfo,
  onOpenAdminModal,
  onOpenNotifications,
  onOpenSettings,
  onToggleTheme,
  onOpenSecurityPrivacy,
  onQuickPublish,
  adminUser,
  theme,
  visitorName,
  unreadNotificationsCount = 0,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 24);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [menuOpen]);

  const isLight = theme === 'light';

  const runAction = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  return (
    <header
      className={`sticky top-0 z-40 w-full transition-colors duration-200 ${
        isLight
          ? isScrolled
            ? 'liquid-glass-light border-b border-neutral-200/80 shadow-sm'
            : 'bg-white/90 backdrop-blur-xl border-b border-neutral-200/70'
          : isScrolled
            ? 'bg-[#050507]/92 backdrop-blur-xl border-b border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.65)]'
            : 'bg-[#000000]/90 backdrop-blur-xl border-b border-white/10'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-15 sm:h-16 flex items-center justify-between gap-3">
        {/* Left: Methodist Cross Logo + VIDEOMAKER — IGREJA METODISTA FERNANDO KIBUBA */}
        <button
          type="button"
          onClick={() => runAction(() => onNavigate('inicio'))}
          className="min-w-0 flex items-center text-left py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-lg cursor-pointer"
          title="VIDEOMAKER — Igreja Metodista Fernando Kibuba"
        >
          <Logo headerLockup={true} theme={theme} />
        </button>

        {/* Right: Single Three-Dots Menu Button (⋮) */}
        <div ref={menuContainerRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen(prev => !prev)}
            data-testid="header-three-dots-btn"
            aria-label={menuOpen ? 'Fechar menu de opções' : 'Abrir menu de opções'}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className={`relative min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center transition-colors duration-150 cursor-pointer ${
              menuOpen
                ? isLight
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'bg-amber-400/15 text-amber-300 border-amber-400/50'
                : isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-neutral-300'
                  : 'bg-white/[0.04] hover:bg-white/[0.09] text-white border-white/12'
            }`}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <MoreVertical className="w-5 h-5" />}
          </button>

          {/* Organized Three-Dots Menu Dropdown */}
          {menuOpen && (
            <>
              {/* Subtle mobile backdrop */}
              <div
                className="fixed inset-0 top-15 sm:hidden bg-black/50 backdrop-blur-[1px] z-40"
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />

              <div
                role="menu"
                data-testid="header-three-dots-menu"
                className={`absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border shadow-2xl z-50 overflow-hidden animate-fade-in ${
                  isLight
                    ? 'bg-white border-neutral-200 text-neutral-900'
                    : 'bg-[#0b0b10]/98 backdrop-blur-2xl border-white/12 text-white'
                }`}
              >
                {/* Admin Quick Publish Shortcut (Visible strictly to authenticated administrator) */}
                {adminUser && onQuickPublish && (
                  <div
                    className={`p-3 border-b ${
                      isLight ? 'border-neutral-200 bg-amber-50/60' : 'border-white/10 bg-white/[0.02]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => runAction(onQuickPublish)}
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-[#E50914] text-black font-extrabold text-xs flex items-center justify-center gap-2 hover:brightness-110 transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                      <span>Nova publicação rápida (ADM)</span>
                    </button>
                  </div>
                )}

                <div className="py-1.5 divide-y divide-white/[0.06]">
                  {/* 1. Informações sobre o site */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runAction(onOpenSiteInfo)}
                    className={`w-full min-h-[50px] px-4 py-2.5 flex items-center justify-between gap-3 text-left transition cursor-pointer ${
                      isLight ? 'hover:bg-neutral-100' : 'hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <Info className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-sm font-medium truncate">Informações sobre o site</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                  </button>

                  {/* 2. Sobre o Videomaker */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runAction(() => onNavigate('sobre'))}
                    className={`w-full min-h-[50px] px-4 py-2.5 flex items-center justify-between gap-3 text-left transition cursor-pointer ${
                      isLight ? 'hover:bg-neutral-100' : 'hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <Film className="w-4 h-4 text-[#E50914] shrink-0" />
                      <span className="text-sm font-medium truncate">Sobre o Videomaker</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                  </button>

                  {/* 3. Acesso ao painel administrativo (ADM) */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runAction(onOpenAdminModal)}
                    data-testid="menu-adm-btn"
                    className={`w-full min-h-[54px] px-4 py-2.5 flex items-center justify-between gap-3 text-left transition cursor-pointer ${
                      isLight ? 'hover:bg-neutral-100' : 'hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      {adminUser ? (
                        <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <span className="min-w-0 flex flex-col">
                        <span className="text-sm font-semibold truncate">
                          Acesso ao painel administrativo (ADM)
                        </span>
                        <span className={`text-[11px] truncate ${isLight ? 'text-neutral-500' : 'text-gray-400'}`}>
                          {adminUser
                            ? 'Sessão de administrador ativa'
                            : 'Área protegida · Apenas administrador autorizado'}
                        </span>
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
                  </button>

                  {/* 4. Notificações */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runAction(onOpenNotifications)}
                    data-testid="menu-notifications-btn"
                    className={`w-full min-h-[50px] px-4 py-2.5 flex items-center justify-between gap-3 text-left transition cursor-pointer ${
                      isLight ? 'hover:bg-neutral-100' : 'hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <Bell className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-sm font-medium truncate">Notificações</span>
                    </span>
                    {unreadNotificationsCount > 0 ? (
                      <span className="text-xs font-bold tabular-nums text-[#E50914] shrink-0">
                        {unreadNotificationsCount} {unreadNotificationsCount === 1 ? 'nova' : 'novas'}
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                    )}
                  </button>

                  {/* 5. Definições */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runAction(onOpenSettings)}
                    data-testid="menu-settings-btn"
                    className={`w-full min-h-[50px] px-4 py-2.5 flex items-center justify-between gap-3 text-left transition cursor-pointer ${
                      isLight ? 'hover:bg-neutral-100' : 'hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <Settings className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-sm font-medium truncate">Definições</span>
                    </span>
                    {visitorName ? (
                      <span className="text-xs font-semibold text-amber-400 truncate max-w-[110px]">
                        {visitorName}
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                    )}
                  </button>

                  {/* 6. Alteração entre modo claro e modo escuro */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onToggleTheme();
                    }}
                    data-testid="menu-theme-toggle-btn"
                    className={`w-full min-h-[50px] px-4 py-2.5 flex items-center justify-between gap-3 text-left transition cursor-pointer ${
                      isLight ? 'hover:bg-neutral-100' : 'hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      {isLight ? (
                        <Moon className="w-4 h-4 text-neutral-800 shrink-0" />
                      ) : (
                        <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <span className="text-sm font-medium truncate">
                        {isLight ? 'Mudar para modo escuro' : 'Mudar para modo claro'}
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-amber-400 shrink-0">
                      {isLight ? 'Claro' : 'Escuro'}
                    </span>
                  </button>

                  {/* 7. Segurança e privacidade */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runAction(onOpenSecurityPrivacy)}
                    data-testid="menu-security-btn"
                    className={`w-full min-h-[50px] px-4 py-2.5 flex items-center justify-between gap-3 text-left transition cursor-pointer ${
                      isLight ? 'hover:bg-neutral-100' : 'hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <Shield className="w-4 h-4 text-[#E50914] shrink-0" />
                      <span className="text-sm font-medium truncate">Segurança e privacidade</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
