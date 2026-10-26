import React, { useEffect } from 'react';
import {
  Info,
  ShieldCheck,
  X,
  Camera,
  Film,
  Calendar,
  Sparkles,
  Download,
  Lock,
  Eye,
  Database,
  Settings,
  ArrowRight,
} from 'lucide-react';
import { Logo } from './Logo';

interface SiteInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  stats: {
    posts: number;
    photos: number;
    videos: number;
    stories: number;
    activities: number;
  };
  onNavigate: (sectionId: string) => void;
  showInstallOption?: boolean;
  onOpenInstallModal?: () => void;
}

export const SiteInfoModal: React.FC<SiteInfoModalProps> = ({
  isOpen,
  onClose,
  theme,
  stats,
  onNavigate,
  showInstallOption = false,
  onOpenInstallModal,
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

  const quickLinks = [
    { id: 'stories', label: 'Stories (24 horas)', count: stats.stories, icon: Sparkles },
    { id: 'galeria', label: 'Quadras de Fotos & Vídeos', count: stats.posts, icon: Camera },
    { id: 'atividades', label: 'Atividades da Igreja', count: stats.activities, icon: Calendar },
    { id: 'sobre', label: 'Sobre o Videomaker', count: null, icon: Film },
    { id: 'contacto', label: 'Contacto e Cobertura', count: null, icon: ArrowRight },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="site-info-modal-title"
    >
      <div
        data-testid="site-info-modal"
        onClick={e => e.stopPropagation()}
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden max-h-[86vh] flex flex-col ${
          isLight
            ? 'bg-white border-neutral-200 text-neutral-900'
            : 'bg-[#0c0c12] border-white/12 text-white'
        }`}
      >
        {/* Top Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between gap-3 ${
            isLight ? 'border-neutral-200 bg-neutral-50' : 'border-white/10 bg-white/[0.02]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Info className="w-5 h-5 text-amber-400 shrink-0" />
            <h2 id="site-info-modal-title" className="text-base font-bold tracking-tight">
              Informações sobre o site
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center transition cursor-pointer ${
              isLight ? 'hover:bg-neutral-200 text-neutral-600' : 'hover:bg-white/10 text-gray-400 hover:text-white'
            }`}
            aria-label="Fechar informações sobre o site"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
              isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-white/[0.03] border-white/10'
            }`}
          >
            <Logo size="sm" showSubtitle={true} theme={theme} />
          </div>

          <p className={`text-sm leading-relaxed ${isLight ? 'text-neutral-700' : 'text-gray-300'}`}>
            Plataforma oficial de comunicação visual e memória histórica da{' '}
            <strong className={isLight ? 'text-neutral-900' : 'text-white'}>
              Igreja Metodista de Fernando Kibuba
            </strong>
            , dedicada à partilha de fotografias em alta definição, vídeos HD 1080p, Stories diários e agenda de atividades eclesiásticas.
          </p>

          {/* Summary Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div
              className={`p-3.5 rounded-2xl border text-center ${
                isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-white/[0.03] border-white/10'
              }`}
            >
              <p className="text-xl font-black text-amber-400 tabular-nums">{stats.photos}</p>
              <p className={`text-xs mt-0.5 ${isLight ? 'text-neutral-600' : 'text-gray-400'}`}>Fotografias</p>
            </div>
            <div
              className={`p-3.5 rounded-2xl border text-center ${
                isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-white/[0.03] border-white/10'
              }`}
            >
              <p className="text-xl font-black text-[#E50914] tabular-nums">{stats.videos}</p>
              <p className={`text-xs mt-0.5 ${isLight ? 'text-neutral-600' : 'text-gray-400'}`}>Vídeos HD</p>
            </div>
            <div
              className={`p-3.5 rounded-2xl border text-center ${
                isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-white/[0.03] border-white/10'
              }`}
            >
              <p className="text-xl font-black text-amber-400 tabular-nums">{stats.activities}</p>
              <p className={`text-xs mt-0.5 ${isLight ? 'text-neutral-600' : 'text-gray-400'}`}>Atividades</p>
            </div>
          </div>

          {/* Quick Section Navigation */}
          <div>
            <p className={`text-xs font-semibold mb-2.5 ${isLight ? 'text-neutral-500' : 'text-gray-400'}`}>
              Navegação rápida pelas secções
            </p>
            <div className="space-y-1.5">
              {quickLinks.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigate(item.id);
                    }}
                    className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl border flex items-center justify-between gap-3 text-sm font-medium transition cursor-pointer ${
                      isLight
                        ? 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-800'
                        : 'bg-white/[0.02] hover:bg-white/[0.06] border-white/8 text-gray-200 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {item.count !== null ? (
                      <span className="text-xs font-mono tabular-nums text-amber-400">{item.count}</span>
                    ) : (
                      <ArrowRight className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {showInstallOption && onOpenInstallModal && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenInstallModal();
              }}
              className="w-full min-h-[46px] px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-[#E50914] text-black font-extrabold text-sm flex items-center justify-center gap-2 hover:brightness-110 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Instalar aplicação no telemóvel</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface SecurityPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  visitorName?: string;
  isAdmin: boolean;
  onOpenSettings: () => void;
}

export const SecurityPrivacyModal: React.FC<SecurityPrivacyModalProps> = ({
  isOpen,
  onClose,
  theme,
  visitorName,
  isAdmin,
  onOpenSettings,
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
      aria-labelledby="security-privacy-modal-title"
    >
      <div
        data-testid="security-privacy-modal"
        onClick={e => e.stopPropagation()}
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden max-h-[86vh] flex flex-col ${
          isLight
            ? 'bg-white border-neutral-200 text-neutral-900'
            : 'bg-[#0c0c12] border-white/12 text-white'
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between gap-3 ${
            isLight ? 'border-neutral-200 bg-neutral-50' : 'border-white/10 bg-white/[0.02]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
            <h2 id="security-privacy-modal-title" className="text-base font-bold tracking-tight">
              Segurança e privacidade
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center transition cursor-pointer ${
              isLight ? 'hover:bg-neutral-200 text-neutral-600' : 'hover:bg-white/10 text-gray-400 hover:text-white'
            }`}
            aria-label="Fechar segurança e privacidade"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div
            className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
              isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-white/[0.03] border-white/10'
            }`}
          >
            <Eye className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold">Navegação sem palavras-passe para visitantes</h3>
              <p className={`text-xs mt-1 leading-relaxed ${isLight ? 'text-neutral-600' : 'text-gray-400'}`}>
                Para visualizar fotografias, vídeos e Stories ou publicar comentários, apenas utilizamos o teu nome de visitante ({visitorName || 'não definido'}) guardado localmente no teu navegador. Não solicitamos e-mail nem palavra-passe aos membros e visitantes.
              </p>
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
              isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-white/[0.03] border-white/10'
            }`}
          >
            <Database className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold">Armazenamento local e Stories temporários</h3>
              <p className={`text-xs mt-1 leading-relaxed ${isLight ? 'text-neutral-600' : 'text-gray-400'}`}>
                A preferência de tema (modo claro ou escuro) e o teu nome ficam guardados no teu próprio dispositivo. Os Stories publicados expiram automaticamente após 24 horas.
              </p>
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
              isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-white/[0.03] border-white/10'
            }`}
          >
            <Lock className="w-5 h-5 text-[#E50914] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold">Proteção exclusiva do Painel Administrativo (ADM)</h3>
              <p className={`text-xs mt-1 leading-relaxed ${isLight ? 'text-neutral-600' : 'text-gray-400'}`}>
                A gestão de publicações, Stories, atividades e moderação de comentários é validada no servidor com sessão autenticada e reservada exclusivamente ao administrador autorizado.
                {isAdmin ? ' (Sessão de administrador atualmente ativa neste dispositivo.)' : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition cursor-pointer ${
              isLight
                ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-900'
                : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/12 text-amber-300'
            }`}
          >
            <Settings className="w-4 h-4 text-amber-400" />
            <span>Gerir o meu nome e preferências em Definições</span>
          </button>
        </div>
      </div>
    </div>
  );
};
