import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface OpeningSplashProps {
  onComplete: () => void;
}

export const OpeningSplash: React.FC<OpeningSplashProps> = ({ onComplete }) => {
  const prefersReducedMotion = useReducedMotion();
  const [isExiting, setIsExiting] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const completedRef = useRef(false);

  const finishSplash = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsVisible(false);
    onComplete();
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    setIsExiting(true);
    window.setTimeout(() => {
      finishSplash();
    }, 220);
  }, [finishSplash]);

  useEffect(() => {
    // Respect prefers-reduced-motion: short, calm opacity dissolve without movement
    if (prefersReducedMotion) {
      const exitTimer = window.setTimeout(() => setIsExiting(true), 420);
      const doneTimer = window.setTimeout(() => finishSplash(), 720);
      return () => {
        window.clearTimeout(exitTimer);
        window.clearTimeout(doneTimer);
      };
    }

    // Standard opening choreography (~2.6s total, non-blocking during fade-out)
    const exitTimer = window.setTimeout(() => {
      setIsExiting(true);
    }, 2050);

    const doneTimer = window.setTimeout(() => {
      finishSplash();
    }, 2650);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [prefersReducedMotion, finishSplash, handleSkip]);

  if (!isVisible) return null;

  return (
    <motion.div
      role="status"
      aria-label="Abertura Videomaker — Fernando Kibuba"
      data-testid="opening-splash"
      initial={{ opacity: 0 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{
        duration: prefersReducedMotion ? 0.28 : isExiting ? 0.58 : 0.32,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#08080a] overflow-hidden select-none ${
        isExiting ? 'pointer-events-none' : ''
      }`}
    >
      {/* Ambient Yellow, Orange & Red Luminous Accents */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.85 }}
          animate={{ opacity: isExiting ? 0 : 0.85, scale: 1 }}
          transition={{ duration: prefersReducedMotion ? 0.25 : 1.1, ease: 'easeOut' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] sm:w-[460px] sm:h-[460px] rounded-full bg-gradient-to-tr from-[#E50914]/25 via-orange-500/20 to-amber-400/20 blur-[90px]"
        />
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#E50914]/75 to-transparent" />
      </div>

      {/* Discreet Skip Button so visitors are never blocked */}
      {!isExiting && (
        <button
          type="button"
          onClick={handleSkip}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 transition cursor-pointer"
          aria-label="Saltar animação de abertura"
        >
          Saltar
        </button>
      )}

      {/* Main Sequence Container: Logo -> Videomaker -> Fernando Kibuba */}
      <motion.div
        animate={{
          opacity: isExiting ? 0 : 1,
          scale: prefersReducedMotion ? 1 : isExiting ? 1.03 : 1,
        }}
        transition={{ duration: prefersReducedMotion ? 0.25 : 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center px-6 text-center"
      >
        {/* 2. Centered Methodist Church Logo with Yellow, Orange & Red Ring */}
        <motion.div
          initial={{
            opacity: 0,
            scale: prefersReducedMotion ? 1 : 0.82,
            y: prefersReducedMotion ? 0 : 14,
          }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{
            delay: prefersReducedMotion ? 0.04 : 0.18,
            duration: prefersReducedMotion ? 0.25 : 0.62,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="relative flex items-center justify-center mb-6"
        >
          {/* Warm Yellow -> Orange -> Red Halo Ring */}
          <div className="p-[2px] rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-[#E50914] shadow-[0_0_45px_-8px_rgba(229,9,20,0.55)]">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[22px] bg-[#0d0d12] flex items-center justify-center border border-white/5">
              <svg
                viewBox="0 0 200 240"
                className="h-16 sm:h-20 w-auto drop-shadow-[0_4px_14px_rgba(229,9,20,0.45)]"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="splashFlameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="30%" stopColor="#f97316" />
                    <stop offset="70%" stopColor="#E50914" />
                    <stop offset="100%" stopColor="#991B1B" />
                  </linearGradient>
                </defs>
                {/* Methodist Pentecost Flame */}
                <path
                  d="M 105 15
                     C 105 15 50 45 25 95
                     C -5 150 0 205 35 235
                     C 50 215 45 190 40 165
                     C 32 125 48 85 70 55
                     C 55 65 30 95 28 135
                     C 45 150 75 160 85 145
                     C 92 130 85 105 78 80
                     C 85 55 98 30 105 15 Z"
                  fill="url(#splashFlameGrad)"
                />
                <path
                  d="M 100 45
                     C 80 80 65 120 70 160
                     C 55 135 52 105 65 75
                     C 75 55 90 45 100 45 Z"
                  fill="#991B1B"
                  opacity="0.78"
                />
                {/* Crisp White Latin Methodist Cross */}
                <rect x="25" y="70" width="130" height="18" rx="2.5" fill="#FFFFFF" />
                <rect x="80" y="20" width="20" height="210" rx="2.5" fill="#FFFFFF" />
                <rect x="82" y="22" width="6" height="206" fill="#F8FAFC" opacity="0.9" />
                <rect x="27" y="72" width="126" height="5" fill="#F8FAFC" opacity="0.9" />
              </svg>
            </div>
          </div>
        </motion.div>

        {/* 3. Gradual Reveal of "Videomaker" */}
        <motion.div
          initial={{
            opacity: 0,
            y: prefersReducedMotion ? 0 : 12,
          }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: prefersReducedMotion ? 0.08 : 0.62,
            duration: prefersReducedMotion ? 0.25 : 0.58,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="flex flex-col items-center"
        >
          <span className="sr-only">Videomaker</span>
          <div
            aria-hidden="true"
            className="flex items-center font-black tracking-tight leading-none text-3xl sm:text-5xl"
          >
            <span className="text-white">VIDE</span>
            <span className="relative inline-flex items-center justify-center mx-[2px]">
              <span className="text-white">O</span>
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="w-0 h-0 border-y-[4px] sm:border-y-[5.5px] border-y-transparent border-l-[7px] sm:border-l-[10px] border-l-[#E50914] ml-[2px]" />
              </span>
            </span>
            <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-[#E50914] bg-clip-text text-transparent">
              MAKER
            </span>
          </div>
        </motion.div>

        {/* 4. "Fernando Kibuba" Emerging Underneath */}
        <motion.div
          initial={{
            opacity: 0,
            y: prefersReducedMotion ? 0 : 10,
          }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: prefersReducedMotion ? 0.12 : 1.08,
            duration: prefersReducedMotion ? 0.25 : 0.56,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="mt-3.5 flex flex-col items-center gap-2"
        >
          {/* Yellow-Orange-Red Accent Divider + Igreja Metodista */}
          <div className="flex items-center gap-2.5">
            <span className="h-[2px] w-7 sm:w-10 rounded-full bg-gradient-to-r from-transparent via-amber-400 to-orange-500" />
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.26em] text-amber-300/90">
              Igreja Metodista
            </span>
            <span className="h-[2px] w-7 sm:w-10 rounded-full bg-gradient-to-r from-orange-500 via-[#E50914] to-transparent" />
          </div>

          <p className="text-sm sm:text-lg font-extrabold tracking-[0.22em] uppercase text-white">
            Fernando Kibuba
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};
