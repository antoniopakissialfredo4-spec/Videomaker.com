import React, { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, AlertCircle, User } from 'lucide-react';
import { sanitizeVisitorNameInput } from '../lib/visitor';

interface VisitorNamePageProps {
  onContinue: (name: string) => void;
}

export const VisitorNamePage: React.FC<VisitorNamePageProps> = ({ onContinue }) => {
  const prefersReducedMotion = useReducedMotion();
  const [nameInput, setNameInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 180);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(focusTimer);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isExiting) return;

    const cleaned = sanitizeVisitorNameInput(nameInput);
    if (!cleaned) {
      setErrorMsg('Por favor, introduz o teu nome para continuares.');
      inputRef.current?.focus();
      return;
    }

    setErrorMsg(null);
    setIsExiting(true);

    const delay = prefersReducedMotion ? 120 : 260;
    window.setTimeout(() => {
      onContinue(cleaned);
    }, delay);
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="visitor-welcome-title"
      data-testid="visitor-name-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: prefersReducedMotion ? 0.18 : 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[95] flex flex-col items-center justify-center bg-[#08080a] px-4 py-8 overflow-y-auto select-none"
    >
      {/* Ambient Dark Background with Yellow, Orange & Red Details */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#E50914]/80 to-transparent" />
        <div className="absolute top-[-12%] left-1/2 -translate-x-1/2 w-[380px] h-[380px] sm:w-[520px] sm:h-[520px] rounded-full bg-gradient-to-tr from-[#E50914]/20 via-orange-500/15 to-amber-400/20 blur-[110px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[320px] h-[320px] rounded-full bg-orange-500/10 blur-[100px]" />
      </div>

      {/* Identification Card */}
      <motion.div
        initial={{
          opacity: 0,
          y: prefersReducedMotion ? 0 : 20,
          scale: prefersReducedMotion ? 1 : 0.97,
        }}
        animate={{
          opacity: isExiting ? 0 : 1,
          y: isExiting && !prefersReducedMotion ? -12 : 0,
          scale: 1,
        }}
        transition={{ duration: prefersReducedMotion ? 0.2 : 0.42, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md rounded-3xl bg-[#0e0e14]/95 border border-white/12 shadow-[0_28px_80px_rgba(0,0,0,0.9)] overflow-hidden"
      >
        {/* Top Accent Strip (Yellow -> Orange -> Red) */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-orange-500 to-[#E50914]" />

        <div className="p-6 sm:p-8">
          {/* Compact Brand Emblem */}
          <div className="flex items-center gap-3.5 mb-6">
            <div className="p-[2px] rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-[#E50914] shadow-[0_0_24px_rgba(229,9,20,0.35)] shrink-0">
              <div className="w-12 h-12 rounded-[14px] bg-[#09090d] flex items-center justify-center">
                <svg viewBox="0 0 200 240" className="h-8 w-auto" aria-hidden="true">
                  <defs>
                    <linearGradient id="welcomeFlameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#fbbf24" />
                      <stop offset="35%" stopColor="#f97316" />
                      <stop offset="80%" stopColor="#E50914" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 105 15 C 105 15 50 45 25 95 C -5 150 0 205 35 235 C 50 215 45 190 40 165 C 32 125 48 85 70 55 C 55 65 30 95 28 135 C 45 150 75 160 85 145 C 92 130 85 105 78 80 C 85 55 98 30 105 15 Z"
                    fill="url(#welcomeFlameGrad)"
                  />
                  <rect x="25" y="70" width="130" height="18" rx="2.5" fill="#FFFFFF" />
                  <rect x="80" y="20" width="20" height="210" rx="2.5" fill="#FFFFFF" />
                </svg>
              </div>
            </div>

            <div className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400">
                Igreja Metodista
              </span>
              <p className="text-sm font-extrabold text-white truncate">
                Videomaker — Fernando Kibuba
              </p>
            </div>
          </div>

          {/* Exact Required Title & Description */}
          <h1
            id="visitor-welcome-title"
            className="text-2xl sm:text-[26px] font-black tracking-tight text-white leading-snug"
          >
            Bem-vindo ao Videomaker! 👋
          </h1>

          <p className="mt-2.5 text-sm sm:text-[15px] text-gray-300 leading-relaxed">
            Como te chamas? Introduz o teu nome para continuares.
          </p>

          {/* Identification Form (Name Only — No Email, Password, or Account Creation) */}
          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <div>
              <label htmlFor="visitor-name-input" className="sr-only">
                O teu nome
              </label>
              <div className="relative flex items-center">
                <User className="w-5 h-5 text-amber-400/85 absolute left-4 pointer-events-none" />
                <input
                  id="visitor-name-input"
                  ref={inputRef}
                  type="text"
                  name="visitorName"
                  autoComplete="given-name"
                  maxLength={60}
                  value={nameInput}
                  onChange={(e) => {
                    setNameInput(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Escreve o teu nome"
                  data-testid="visitor-name-input"
                  className="w-full min-h-[52px] pl-12 pr-4 py-3 rounded-2xl bg-[#15151d] border border-white/15 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/25 text-white placeholder-gray-400 text-base font-medium transition focus:outline-none select-text"
                />
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="px-3.5 py-2.5 rounded-xl bg-[#E50914]/15 border border-[#E50914]/40 text-amber-200 text-xs font-medium flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-[#E50914] shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              data-testid="visitor-name-continue-btn"
              className="w-full min-h-[52px] px-5 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-[#E50914] text-black font-extrabold text-base shadow-[0_10px_30px_-6px_rgba(229,9,20,0.55)] hover:brightness-110 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continuar</span>
              <ArrowRight className="w-4 h-4 stroke-[2.75]" />
            </button>
          </form>

          <p className="mt-4 text-[11px] text-gray-400 text-center leading-relaxed">
            O teu nome será guardado neste navegador e mostrado nos comentários que publicares. Podes alterá-lo a qualquer momento nas definições.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};
