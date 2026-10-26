import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Share, PlusSquare, MoreVertical, Download, CheckCircle2, Smartphone, Monitor } from 'lucide-react';
import { DevicePlatform } from '../lib/pwaInstall';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDismissBrowserContinue: () => void;
  canPromptNatively: boolean;
  platform: DevicePlatform;
  browserKind: 'safari' | 'firefox' | 'chromium' | 'other';
  onTriggerNativeInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  onDismissBrowserContinue,
  canPromptNatively,
  platform,
  browserKind,
  onTriggerNativeInstall,
}) => {
  const [showManualSteps, setShowManualSteps] = useState(false);
  const [selectedGuideTab, setSelectedGuideTab] = useState<DevicePlatform>(platform);
  const [isPrompting, setIsPrompting] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowManualSteps(false);
      setSelectedGuideTab(platform);
      setInstalledSuccess(false);
    }
  }, [isOpen, platform]);

  const handleInstallClick = async () => {
    if (canPromptNatively) {
      setIsPrompting(true);
      try {
        const outcome = await onTriggerNativeInstall();
        if (outcome === 'accepted') {
          setInstalledSuccess(true);
          window.setTimeout(() => {
            onClose();
          }, 1200);
          return;
        }
        if (outcome === 'unavailable') {
          setShowManualSteps(true);
        }
      } finally {
        setIsPrompting(false);
      }
      return;
    }

    // Browser does not expose beforeinstallprompt (e.g. iOS Safari / Firefox): show clear manual instructions
    setShowManualSteps(true);
  };

  const handleContinueInBrowser = () => {
    onDismissBrowserContinue();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
          data-testid="pwa-install-modal"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={handleContinueInBrowser}
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
          />

          {/* Modal Sheet / Card */}
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md rounded-3xl bg-[#0e0e13] border border-white/12 shadow-[0_24px_70px_rgba(0,0,0,0.85)] overflow-hidden text-white"
          >
            {/* Top Yellow -> Orange -> Red Accent Line */}
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-orange-500 to-[#E50914]" />

            {/* Close button */}
            <button
              type="button"
              onClick={handleContinueInBrowser}
              className="absolute top-4 right-4 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              aria-label="Fechar convite de instalação"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 sm:p-7">
              {/* App Icon + Brand Header */}
              <div className="flex items-center gap-4 mb-5 pr-8">
                <div className="p-[2px] rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-[#E50914] shadow-[0_0_24px_rgba(229,9,20,0.35)] flex-shrink-0">
                  <img
                    src="/pwa-192x192.png"
                    alt="Ícone Videomaker — Fernando Kibuba"
                    className="w-16 h-16 rounded-[14px] object-cover bg-[#08080a]"
                  />
                </div>
                <div>
                  <span className="inline-block text-[11px] font-bold uppercase tracking-[0.18em] text-amber-400 mb-0.5">
                    Aplicação Oficial
                  </span>
                  <p className="text-sm font-extrabold text-white leading-tight">
                    Videomaker — Fernando Kibuba
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Igreja Metodista • Acesso rápido no ecrã principal
                  </p>
                </div>
              </div>

              {installedSuccess ? (
                <div className="py-6 text-center space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                  <h3 className="text-lg font-bold text-white">
                    Aplicação instalada com sucesso!
                  </h3>
                  <p className="text-sm text-gray-300">
                    O Videomaker já está disponível no ecrã principal do teu dispositivo.
                  </p>
                </div>
              ) : (
                <>
                  {/* Exact Required Title & Description */}
                  <h2
                    id="pwa-install-title"
                    className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-snug"
                  >
                    Instala o Videomaker no teu telemóvel! 📲
                  </h2>

                  <p className="mt-2.5 text-sm text-gray-300 leading-relaxed">
                    Instala a aplicação para acederes rapidamente às publicações, aos vídeos, aos Stories e às atividades da igreja.
                  </p>

                  {/* Manual Browser-Specific Install Instructions (when beforeinstallprompt is unavailable) */}
                  {showManualSteps && (
                    <div
                      data-testid="pwa-manual-instructions"
                      className="mt-5 rounded-2xl bg-white/[0.04] border border-amber-500/25 p-4 space-y-3.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                          Como instalar no teu dispositivo
                        </p>
                        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                          <button
                            type="button"
                            onClick={() => setSelectedGuideTab('android')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                              selectedGuideTab === 'android'
                                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-black font-bold'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            Android
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedGuideTab('ios')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                              selectedGuideTab === 'ios'
                                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-black font-bold'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            iPhone
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedGuideTab('desktop')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                              selectedGuideTab === 'desktop'
                                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-black font-bold'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            PC
                          </button>
                        </div>
                      </div>

                      {selectedGuideTab === 'ios' && (
                        <ol className="space-y-2.5 text-xs sm:text-sm text-gray-200">
                          <li className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                              1
                            </span>
                            <span>
                              No Safari, toca no botão <strong className="text-white">Partilhar</strong>{' '}
                              <Share className="inline w-3.5 h-3.5 text-amber-400 mx-0.5 -mt-0.5" /> na barra inferior ou superior.
                            </span>
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-300 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                              2
                            </span>
                            <span>
                              Desliza para baixo e toca em{' '}
                              <strong className="text-white">“Adicionar ao Ecrã Principal”</strong>{' '}
                              <PlusSquare className="inline w-3.5 h-3.5 text-orange-400 mx-0.5 -mt-0.5" />.
                            </span>
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-[#E50914]/25 text-red-300 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                              3
                            </span>
                            <span>
                              Confirma tocando em <strong className="text-white">“Adicionar”</strong> no canto superior direito.
                            </span>
                          </li>
                        </ol>
                      )}

                      {selectedGuideTab === 'android' && (
                        <ol className="space-y-2.5 text-xs sm:text-sm text-gray-200">
                          <li className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                              1
                            </span>
                            <span>
                              Toca no menu do navegador{' '}
                              <MoreVertical className="inline w-3.5 h-3.5 text-amber-400 mx-0.5 -mt-0.5" />{' '}
                              {browserKind === 'firefox' ? '(três pontos no canto do Firefox)' : '(três pontos no canto superior direito)'}.
                            </span>
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-300 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                              2
                            </span>
                            <span>
                              Seleciona <strong className="text-white">“Instalar aplicação”</strong> ou{' '}
                              <strong className="text-white">“Adicionar ao ecrã principal”</strong>{' '}
                              <Smartphone className="inline w-3.5 h-3.5 text-orange-400 mx-0.5 -mt-0.5" />.
                            </span>
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-[#E50914]/25 text-red-300 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                              3
                            </span>
                            <span>
                              Confirma tocando em <strong className="text-white">“Instalar”</strong>.
                            </span>
                          </li>
                        </ol>
                      )}

                      {selectedGuideTab === 'desktop' && (
                        <ol className="space-y-2.5 text-xs sm:text-sm text-gray-200">
                          <li className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                              1
                            </span>
                            <span>
                              Na barra de endereços do Chrome ou Edge, clica no ícone{' '}
                              <strong className="text-white">Instalar Videomaker</strong>{' '}
                              <Download className="inline w-3.5 h-3.5 text-amber-400 mx-0.5 -mt-0.5" /> no lado direito.
                            </span>
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-300 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                              2
                            </span>
                            <span>
                              Ou abre o menu <strong className="text-white">⋮ → Guardar e partilhar → Instalar página como aplicação</strong>{' '}
                              <Monitor className="inline w-3.5 h-3.5 text-orange-400 mx-0.5 -mt-0.5" />.
                            </span>
                          </li>
                        </ol>
                      )}
                    </div>
                  )}

                  {/* Two Action Buttons Required */}
                  <div className="mt-6 flex flex-col gap-2.5">
                    {!showManualSteps && (
                      <button
                        type="button"
                        onClick={handleInstallClick}
                        disabled={isPrompting}
                        data-testid="pwa-install-btn"
                        className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-[#E50914] text-black font-extrabold text-sm sm:text-base shadow-[0_8px_28px_-4px_rgba(229,9,20,0.5)] hover:brightness-110 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                      >
                        <Download className="w-4 h-4 stroke-[2.75]" aria-hidden="true" />
                        <span>{isPrompting ? 'A abrir instalação...' : 'Instalar aplicação'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleContinueInBrowser}
                      data-testid="pwa-continue-browser-btn"
                      className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.11] border border-white/12 text-gray-200 hover:text-white font-semibold text-sm transition flex items-center justify-center cursor-pointer"
                    >
                      Continuar no navegador
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
