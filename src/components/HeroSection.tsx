import React from 'react';
import { Camera, Film, Calendar, Sparkles, ArrowRight, Flame } from 'lucide-react';
import { Logo } from './Logo';

interface HeroSectionProps {
  onExploreGallery: () => void;
  onExploreActivities: () => void;
  stats: {
    posts: number;
    videos: number;
    activities: number;
  };
  theme?: 'dark' | 'light';
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onExploreGallery,
  onExploreActivities,
  stats,
  theme = 'dark'
}) => {
  const isLight = theme === 'light';

  return (
    <section className={`relative overflow-hidden pt-8 pb-16 md:py-24 border-b transition-colors ${
      isLight ? 'border-neutral-200' : 'border-white/5'
    }`}>
      {/* Background Liquid Ambient Orbs */}
      <div className={`absolute inset-0 z-0 pointer-events-none transition-colors ${
        isLight ? 'bg-gradient-to-b from-neutral-50 via-white to-neutral-100' : 'bg-[#08080a]'
      }`} />
      
      {/* Floating Liquid Glass Glows */}
      <div className="absolute top-12 left-1/4 w-80 h-80 rounded-full bg-amber-500/15 blur-[100px] animate-liquid-float pointer-events-none" />
      <div className="absolute top-28 right-1/4 w-96 h-96 rounded-full bg-red-600/15 blur-[110px] animate-liquid-float-slow pointer-events-none" />

      {/* Subtle Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, ${isLight ? 'black' : 'white'} 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Live No Ar Status Tag */}
        <div className={`inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border text-xs mb-6 shadow-md backdrop-blur-xl ${
          isLight
            ? 'liquid-glass-light border-emerald-500/30 text-emerald-800'
            : 'liquid-glass border-emerald-500/30 text-emerald-400'
        }`}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-extrabold tracking-wider uppercase text-[11px]">
            {stats.posts > 0 ? `${stats.posts} PUBLICAÇÕES NO AR` : 'SISTEMA NO AR • AGUARDANDO PUBLICAÇÕES'}
          </span>
          <span className="opacity-30">|</span>
          <span className={isLight ? 'text-neutral-700 font-medium' : 'text-gray-300 font-medium'}>
            Igreja Metodista Fernando Kibuba
          </span>
        </div>

        {/* Centered Large Emblem & Brand Title */}
        <div className="flex justify-center mb-6">
          <Logo size="hero" showSubtitle={true} theme={theme} />
        </div>

        {/* Main Heading Text */}
        <h1 className={`max-w-3xl mx-auto text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight mb-4 ${
          isLight ? 'text-neutral-900' : 'text-white'
        }`}>
          Registo de Fé, Memória & Louvor na{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-amber-400 to-[#E50914]">
            Igreja Metodista
          </span>
        </h1>

        <p className={`max-w-2xl mx-auto text-sm sm:text-base leading-relaxed mb-8 ${
          isLight ? 'text-neutral-600' : 'text-gray-400'
        }`}>
          Divulgação audiovisual completa de cultos, momentos solenes de batismo, coros, conferências da juventude e atividades da congregação de Fernando Kibuba, Luanda.
        </p>

        {/* Call To Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-12">
          <button
            onClick={onExploreGallery}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-[#E50914] text-black font-extrabold text-sm shadow-[0_0_25px_rgba(212,175,55,0.4)] hover:shadow-[0_0_35px_rgba(212,175,55,0.6)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
          >
            <Camera className="w-4 h-4 text-black" />
            <span>Ver Quadras de Fotos & Vídeos</span>
            <ArrowRight className="w-4 h-4 text-black" />
          </button>

          <button
            onClick={onExploreActivities}
            className={`px-6 py-3.5 rounded-2xl font-bold text-sm border transition-all flex items-center gap-2 cursor-pointer ${
              isLight
                ? 'liquid-glass-light hover:bg-white text-neutral-800 border-neutral-300 shadow-sm'
                : 'liquid-glass hover:bg-white/10 text-white border-white/10 hover:border-amber-400/50'
            }`}
          >
            <Calendar className="w-4 h-4 text-amber-500" />
            <span>Próximas Atividades da Igreja</span>
          </button>
        </div>

        {/* Quick Highlights Counters (Liquid Glass Box) */}
        <div className={`grid grid-cols-3 max-w-lg mx-auto divide-x rounded-3xl p-5 shadow-2xl backdrop-blur-xl border ${
          isLight
            ? 'liquid-glass-light border-neutral-200 divide-neutral-200 text-neutral-800'
            : 'liquid-glass border-white/10 divide-white/10 text-white'
        }`}>
          <div className="px-3 text-center">
            <div className={`text-2xl sm:text-3xl font-black font-mono ${isLight ? 'text-neutral-900' : 'text-white'}`}>
              {stats.posts}
            </div>
            <div className={`text-[11px] font-bold flex items-center justify-center gap-1 mt-1 ${isLight ? 'text-neutral-600' : 'text-gray-400'}`}>
              <Camera className="w-3.5 h-3.5 text-amber-500" />
              <span>No Ar</span>
            </div>
          </div>

          <div className="px-3 text-center">
            <div className="text-2xl sm:text-3xl font-black text-[#E50914] font-mono">
              {stats.videos}
            </div>
            <div className={`text-[11px] font-bold flex items-center justify-center gap-1 mt-1 ${isLight ? 'text-neutral-600' : 'text-gray-400'}`}>
              <Film className="w-3.5 h-3.5 text-[#E50914]" />
              <span>Vídeos</span>
            </div>
          </div>

          <div className="px-3 text-center">
            <div className={`text-2xl sm:text-3xl font-black font-mono text-amber-500`}>
              {stats.activities}
            </div>
            <div className={`text-[11px] font-bold flex items-center justify-center gap-1 mt-1 ${isLight ? 'text-neutral-600' : 'text-gray-400'}`}>
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              <span>Atividades</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
