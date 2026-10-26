import React from 'react';
import { Logo } from './Logo';
import { Shield, ArrowUp, Download, Settings } from 'lucide-react';

interface FooterProps {
  onNavigate: (sectionId: string) => void;
  onOpenAdmin: () => void;
  isAdmin: boolean;
  theme?: 'dark' | 'light';
  showInstallOption?: boolean;
  onOpenInstallModal?: () => void;
  onOpenSettings?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onNavigate,
  onOpenAdmin,
  isAdmin,
  theme = 'dark',
  showInstallOption = false,
  onOpenInstallModal,
  onOpenSettings
}) => {
  const isLight = theme === 'light';
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className={`pt-12 pb-8 border-t transition-colors ${
      isLight
        ? 'bg-neutral-100 border-neutral-300 text-neutral-600'
        : 'bg-neutral-950 border-white/10 text-gray-400'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b ${
          isLight ? 'border-neutral-200' : 'border-white/10'
        }`}>
          {/* Brand & Mission */}
          <div className="md:col-span-6 space-y-4">
            <Logo size="md" showSubtitle={true} theme={theme} />
            <p className={`text-xs sm:text-sm max-w-md leading-relaxed ${
              isLight ? 'text-neutral-700' : 'text-gray-300'
            }`}>
              VIDEOMAKER — Fernando Kibuba. Fotografias, vídeos e atividades da Igreja Metodista de Fernando Kibuba.
            </p>
            <p className={`text-xs max-w-md leading-relaxed ${
              isLight ? 'text-neutral-500' : 'text-gray-400'
            }`}>
              Dedicado a eternizar e proclamar os feitos de Deus através da arte audiovisual, servindo à igreja e à comunidade de Luanda, Angola.
            </p>
          </div>

          {/* Navigation Links */}
          <div className="md:col-span-3 space-y-3">
            <h4 className={`text-xs font-bold uppercase tracking-wider ${
              isLight ? 'text-neutral-900' : 'text-white'
            }`}>
              Navegação Rápida
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('inicio')}
                  className="hover:text-amber-500 transition"
                >
                  Página Inicial
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('galeria')}
                  className="hover:text-amber-500 transition"
                >
                  Galeria de Fotografias & Vídeos
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('atividades')}
                  className="hover:text-amber-500 transition"
                >
                  Agenda de Atividades da Igreja
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('sobre')}
                  className="hover:text-amber-500 transition"
                >
                  Sobre o Videomaker
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('contacto')}
                  className="hover:text-amber-500 transition"
                >
                  Contactar Responsável
                </button>
              </li>
            </ul>
          </div>

          {/* Church Info & Access */}
          <div className="md:col-span-3 space-y-3">
            <h4 className={`text-xs font-bold uppercase tracking-wider ${
              isLight ? 'text-neutral-900' : 'text-white'
            }`}>
              Área Administrativa
            </h4>
            <p className={`text-xs ${isLight ? 'text-neutral-500' : 'text-gray-400'}`}>
              Gestão restrita de publicações, Stories, comentários e atividades.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onOpenAdmin}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  isAdmin
                    ? 'border-amber-400/50 text-amber-500 bg-amber-400/10'
                    : isLight
                      ? 'border-neutral-300 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-200/50'
                      : 'border-white/10 text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-amber-500" />
                <span>{isAdmin ? 'Painel de Controlo Ativo' : 'Acesso de Administrador'}</span>
              </button>

              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  data-testid="footer-settings-btn"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    isLight
                      ? 'border-neutral-300 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-200/50'
                      : 'border-white/10 text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5 text-amber-400" />
                  <span>Definições</span>
                </button>
              )}

              {showInstallOption && onOpenInstallModal && (
                <button
                  type="button"
                  onClick={onOpenInstallModal}
                  data-testid="footer-install-app-btn"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    isLight
                      ? 'border-amber-500/40 text-amber-700 bg-amber-500/10 hover:bg-amber-500/20'
                      : 'border-amber-500/35 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20'
                  }`}
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>📲 Instalar aplicação</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={`pt-6 flex flex-col items-center justify-center gap-4 text-center ${
          isLight ? 'text-neutral-600' : 'text-gray-300'
        }`}>
          <button
            onClick={scrollToTop}
            className={`inline-flex items-center gap-1.5 text-xs transition ${
              isLight ? 'text-neutral-500 hover:text-amber-600' : 'text-gray-400 hover:text-amber-400'
            }`}
            title="Voltar ao Topo"
          >
            <span>Voltar ao topo</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>

          <div className="space-y-1.5">
            <p className="text-xs sm:text-sm font-medium">
              Desenvolvido por{' '}
              <span className={isLight ? 'font-semibold text-amber-600' : 'font-semibold text-amber-400'}>
                António Pakisi Alfredo
              </span>
            </p>
            <p className="text-xs sm:text-sm">
              <a
                href="tel:936066956"
                className={`inline-flex items-center justify-center gap-1.5 transition ${
                  isLight ? 'hover:text-amber-600' : 'hover:text-amber-400'
                }`}
              >
                <span aria-hidden="true">📞</span>
                <span>Contacto: 936 066 956</span>
              </a>
            </p>
            <p className={`text-xs pt-0.5 ${isLight ? 'text-neutral-500' : 'text-gray-400'}`}>
              &copy; 2026 &mdash; Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
