import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showSubtitle?: boolean;
  compactLettersOnly?: boolean;
  headerLockup?: boolean;
  theme?: 'dark' | 'light';
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  showSubtitle = true,
  compactLettersOnly = false,
  headerLockup = false,
  theme = 'dark'
}) => {
  const isLight = theme === 'light';
  const textColor = isLight ? 'text-neutral-900' : 'text-white';
  const subColor = isLight ? 'text-neutral-700' : 'text-gray-200';
  const crossFill = isLight ? '#171717' : '#FFFFFF';
  const crossHighlight = isLight ? '#404040' : '#F8FAFC';

  // Dimension scales
  const dimensions = {
    sm: { height: 36, emblemH: 30, textMain: 'text-sm', subText: 'text-[9px]' },
    md: { height: 52, emblemH: 40, textMain: 'text-lg', subText: 'text-[10px]' },
    lg: { height: 80, emblemH: 60, textMain: 'text-2xl', subText: 'text-xs' },
    hero: { height: 120, emblemH: 90, textMain: 'text-3xl sm:text-4xl', subText: 'text-xs sm:text-sm' }
  }[size];

  if (compactLettersOnly) {
    return (
      <div className={`flex flex-col justify-center select-none transition-all duration-200 ${className}`}>
        <div className="flex items-center font-black tracking-tight leading-none text-xs sm:text-sm">
          <span className={`${textColor} font-sans`}>VIDE</span>
          <span className="relative inline-flex items-center justify-center mx-[1px]">
            <span className={`${textColor} font-sans`}>O</span>
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-0 h-0 border-y-[2.5px] border-y-transparent border-l-[5px] border-l-[#E50914] ml-[1px]"></span>
            </span>
          </span>
          <span className="text-[#E50914] font-sans">MAKER</span>
        </div>
        <span className={`text-[8.5px] font-bold tracking-[0.14em] uppercase leading-none mt-0.5 ${subColor}`}>
          Fernando Kibuba
        </span>
      </div>
    );
  }

  // Dedicated clean top-header lockup: Methodist Cross + «VIDEOMAKER — IGREJA METODISTA FERNANDO KIBUBA»
  if (headerLockup) {
    return (
      <div className={`flex items-center gap-2.5 sm:gap-3 min-w-0 select-none ${className}`}>
        <div className="relative shrink-0 flex items-center justify-center">
          <svg
            viewBox="0 0 200 240"
            className="h-8 sm:h-9 w-auto drop-shadow-[0_2px_10px_rgba(229,9,20,0.35)]"
            aria-hidden="true"
          >
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
              fill="#E50914"
            />
            <path
              d="M 100 45
                 C 80 80 65 120 70 160
                 C 55 135 52 105 65 75
                 C 75 55 90 45 100 45 Z"
              fill="#991B1B"
              opacity="0.75"
            />
            <rect x="25" y="70" width="130" height="18" rx="2" fill={crossFill} />
            <rect x="80" y="20" width="20" height="210" rx="2" fill={crossFill} />
            <rect x="82" y="22" width="6" height="206" fill={crossHighlight} opacity="0.9" />
            <rect x="27" y="72" width="126" height="5" fill={crossHighlight} opacity="0.9" />
          </svg>
        </div>

        <div className="min-w-0 flex flex-col md:flex-row md:items-center md:gap-2.5">
          {/* VIDEOMAKER */}
          <div className="flex items-center font-black tracking-tight leading-none text-sm sm:text-base shrink-0">
            <span className={`${textColor} font-sans`}>VIDE</span>
            <span className="relative inline-flex items-center justify-center mx-[1px]">
              <span className={`${textColor} font-sans`}>O</span>
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="w-0 h-0 border-y-[3px] border-y-transparent border-l-[6px] border-l-[#E50914] ml-[1px]"></span>
              </span>
            </span>
            <span className="text-[#E50914] font-sans">MAKER</span>
          </div>

          <span
            aria-hidden="true"
            className="hidden md:inline text-amber-400 font-bold text-sm select-none shrink-0"
          >
            —
          </span>

          {/* IGREJA METODISTA FERNANDO KIBUBA */}
          <span
            className={`text-[9.5px] sm:text-[11px] md:text-xs font-bold tracking-[0.08em] sm:tracking-[0.12em] uppercase leading-tight truncate mt-0.5 md:mt-0 ${
              isLight ? 'text-neutral-700' : 'text-gray-200'
            }`}
          >
            Igreja Metodista <span className="text-amber-400">Fernando Kibuba</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 sm:gap-3 select-none transition-all duration-200 ${className}`}>
      {/* Methodist Flame and Cross Emblem */}
      <div className="relative flex-shrink-0 flex items-center justify-center">
        <svg
          viewBox="0 0 200 240"
          className="drop-shadow-[0_2px_10px_rgba(229,9,20,0.35)]"
          style={{ height: dimensions.emblemH, width: 'auto' }}
        >
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
            fill="#E50914"
          />
          <path
            d="M 100 45
               C 80 80 65 120 70 160
               C 55 135 52 105 65 75
               C 75 55 90 45 100 45 Z"
            fill="#991B1B"
            opacity="0.75"
          />
          <rect x="25" y="70" width="130" height="18" rx="2" fill={crossFill} />
          <rect x="80" y="20" width="20" height="210" rx="2" fill={crossFill} />
          <rect x="82" y="22" width="6" height="206" fill={crossHighlight} opacity="0.9" />
          <rect x="27" y="72" width="126" height="5" fill={crossHighlight} opacity="0.9" />
        </svg>
      </div>

      {/* Brand Typography */}
      <div className="flex flex-col justify-center">
        <div className={`flex items-center font-black tracking-tight leading-none ${dimensions.textMain}`}>
          <span className={`${textColor} font-sans`}>VIDE</span>
          <span className="relative inline-flex items-center justify-center mx-[1px]">
            <span className={`${textColor} font-sans`}>O</span>
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-0 h-0 border-y-[3px] border-y-transparent border-l-[6px] border-l-[#E50914] ml-[1px]"></span>
            </span>
          </span>
          <span className="text-[#E50914] font-sans">MAKER</span>
        </div>

        {showSubtitle && (
          <>
            <div className="flex items-center gap-1.5 my-0.5">
              <div className="h-[1.5px] w-3.5 bg-[#E50914]"></div>
              <span className={`tracking-[0.2em] font-semibold uppercase ${dimensions.subText} ${subColor}`}>
                Igreja Metodista
              </span>
              <div className="h-[1.5px] w-3.5 bg-[#E50914]"></div>
            </div>

            <span className={`font-bold tracking-[0.15em] uppercase leading-none font-sans ${dimensions.subText} ${textColor}`}>
              Fernando Kibuba
            </span>
          </>
        )}
      </div>
    </div>
  );
};
