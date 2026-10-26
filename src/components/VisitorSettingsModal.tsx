import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Settings, User, CheckCircle2, AlertCircle, Sun, Moon, Download } from 'lucide-react';
import { sanitizeVisitorNameInput } from '../lib/visitor';

interface VisitorSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitorName: string;
  onSaveVisitorName: (newName: string) => Promise<void> | void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  showInstallOption?: boolean;
  onOpenInstallModal?: () => void;
}

export const VisitorSettingsModal: React.FC<VisitorSettingsModalProps> = ({
  isOpen,
  onClose,
  visitorName,
  onSaveVisitorName,
  theme,
  onToggleTheme,
  showInstallOption = false,
  onOpenInstallModal,
}) => {
  const [draftName, setDraftName] = useState(visitorName);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraftName(visitorName);
      setErrorMsg(null);
      setSavedSuccess(false);
    }
  }, [isOpen, visitorName]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeVisitorNameInput(draftName);
    if (!cleaned) {
      setErrorMsg('Por favor, escreve um nome válido.');
      inputRef.current?.focus();
      return;
    }

    setErrorMsg(null);
    setIsSaving(true);
    try {
      await onSaveVisitorName(cleaned);
      setSavedSuccess(true);
      window.setTimeout(() => {
        setSavedSuccess(false);
      }, 2500);
    } catch {
      setErrorMsg('Não foi possível guardar o nome. Tenta novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="visitor-settings-title"
          data-testid="visitor-settings-modal"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
          />

          {/* Settings Card */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.97 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md rounded-3xl bg-[#0e0e14] border border-white/12 shadow-[0_24px_70px_rgba(0,0,0,0.9)] overflow-hidden text-white"
          >
            {/* Top Yellow -> Orange -> Red Accent Line */}
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-orange-500 to-[#E50914]" />

            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400/20 via-orange-500/20 to-[#E50914]/20 border border-amber-400/35 flex items-center justify-center text-amber-400">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h2 id="visitor-settings-title" className="text-base font-extrabold text-white">
                    Definições
                  </h2>
                  <p className="text-[11px] text-gray-400">
                    Preferências de visitante no navegador
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                aria-label="Fechar definições"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Visitor Name Section */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label
                    htmlFor="settings-visitor-name"
                    className="block text-xs font-bold uppercase tracking-wider text-amber-400 mb-1"
                  >
                    O teu nome nos comentários
                  </label>
                  <p className="text-xs text-gray-400 mb-2.5">
                    Este nome aparece por baixo dos comentários que publicares nas publicações e nos Stories.
                  </p>
                  <div className="relative flex items-center">
                    <User className="w-4 h-4 text-amber-400/85 absolute left-3.5 pointer-events-none" />
                    <input
                      id="settings-visitor-name"
                      ref={inputRef}
                      type="text"
                      maxLength={60}
                      value={draftName}
                      onChange={(e) => {
                        setDraftName(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                        if (savedSuccess) setSavedSuccess(false);
                      }}
                      placeholder="Escreve o teu nome"
                      data-testid="settings-visitor-name-input"
                      className="w-full min-h-[48px] pl-10 pr-4 py-2.5 rounded-2xl bg-[#16161f] border border-white/15 focus:border-amber-400 text-white placeholder-gray-500 text-base sm:text-sm font-medium focus:outline-none transition"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="px-3 py-2 rounded-xl bg-[#E50914]/15 border border-[#E50914]/35 text-amber-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-[#E50914] shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {savedSuccess && (
                  <div className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Nome atualizado com sucesso!</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSaving}
                  data-testid="settings-save-name-btn"
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-[#E50914] text-black font-extrabold text-sm shadow-[0_8px_24px_-4px_rgba(229,9,20,0.45)] hover:brightness-110 active:scale-[0.99] transition cursor-pointer disabled:opacity-60"
                >
                  {isSaving ? 'A guardar...' : 'Guardar nome'}
                </button>
              </form>

              {/* Additional Visitor Preferences */}
              <div className="pt-4 border-t border-white/10 space-y-2.5">
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 flex items-center justify-between text-xs sm:text-sm font-medium text-gray-200 transition cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    {theme === 'light' ? (
                      <Moon className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Sun className="w-4 h-4 text-amber-400" />
                    )}
                    <span>Aparência do site</span>
                  </span>
                  <span className="text-xs font-bold uppercase text-amber-400">
                    {theme === 'light' ? 'Modo Claro' : 'Modo Escuro'}
                  </span>
                </button>

                {showInstallOption && onOpenInstallModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenInstallModal();
                    }}
                    className="w-full min-h-[46px] px-4 py-2.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 flex items-center justify-between text-xs sm:text-sm font-bold text-amber-300 transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Download className="w-4 h-4 text-amber-400" />
                      <span>Instalar aplicação no telemóvel</span>
                    </span>
                    <span aria-hidden="true">📲</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
