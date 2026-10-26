import React from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { Logo } from './Logo';

interface AboutSectionProps {
  theme?: 'dark' | 'light';
}

export const AboutSection: React.FC<AboutSectionProps> = ({ theme = 'dark' }) => {
  const isLight = theme === 'light';

  return (
    <section id="sobre" className={`py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t transition-colors ${
      isLight ? 'border-neutral-200' : 'border-white/5'
    }`}>
      <div className={`rounded-3xl border p-6 sm:p-10 lg:p-12 shadow-2xl relative overflow-hidden ${
        isLight
          ? 'bg-gradient-to-br from-white via-neutral-50 to-amber-50/30 border-neutral-200'
          : 'bg-gradient-to-br from-neutral-900/90 via-neutral-950 to-neutral-900/70 border-white/10'
      }`}>
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-red-600/10 blur-[100px] pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 text-xs text-amber-500 font-semibold tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5 text-[#E50914]" />
              <span>Vocação & Ministério Audiovisual</span>
            </div>

            <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight font-heading ${
              isLight ? 'text-neutral-900' : 'text-white'
            }`}>
              A Arte de Eternizar os Momentos Sagrados da Igreja Metodista
            </h2>

            <p className={`text-xs sm:text-sm leading-relaxed ${
              isLight ? 'text-neutral-700' : 'text-gray-300'
            }`}>
              O projeto <strong className={isLight ? 'text-neutral-900 font-bold' : 'text-white'}>VIDEOMAKER Fernando Kibuba</strong> nasceu com o propósito de honrar a Deus através da excelência no registo visual e na produção de conteúdos para a Igreja Metodista de Fernando Kibuba.
            </p>

            <p className={`text-xs sm:text-sm leading-relaxed ${
              isLight ? 'text-neutral-600' : 'text-gray-400'
            }`}>
              Com equipamentos modernos de fotografia e gravação em alta definição, cobrimos com sensibilidade e respeito todos os momentos marcantes: da consagração dominical à emoção dos batismos nas águas, passando pelo louvor vibrante dos corais e pela força da juventude metodista.
            </p>

            {/* Feature Bullets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
              <div className={`flex items-center gap-2.5 text-xs ${isLight ? 'text-neutral-800' : 'text-gray-200'}`}>
                <CheckCircle2 className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span>Fotografia de Alta Resolução</span>
              </div>
              <div className={`flex items-center gap-2.5 text-xs ${isLight ? 'text-neutral-800' : 'text-gray-200'}`}>
                <CheckCircle2 className="w-4 h-4 text-[#E50914] flex-shrink-0" />
                <span>Vídeos & Cobertura Cinematográfica</span>
              </div>
              <div className={`flex items-center gap-2.5 text-xs ${isLight ? 'text-neutral-800' : 'text-gray-200'}`}>
                <CheckCircle2 className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span>Stories Dinâmicos em Tempo Real</span>
              </div>
              <div className={`flex items-center gap-2.5 text-xs ${isLight ? 'text-neutral-800' : 'text-gray-200'}`}>
                <CheckCircle2 className="w-4 h-4 text-[#E50914] flex-shrink-0" />
                <span>Divulgação e Arquivo Histórico</span>
              </div>
            </div>
          </div>

          {/* Right Emblem Card */}
          <div className="lg:col-span-5 flex justify-center">
            <div className={`w-full max-w-sm rounded-2xl p-6 sm:p-8 text-center shadow-xl flex flex-col items-center border ${
              isLight
                ? 'bg-white border-neutral-200'
                : 'bg-neutral-950/90 border-amber-400/30'
            }`}>
              <Logo size="lg" showSubtitle={false} className="mb-4" theme={theme} />
              <div className="h-0.5 w-16 bg-gradient-to-r from-amber-400 to-[#E50914] my-3" />
              <h3 className={`text-lg font-black font-sans ${isLight ? 'text-neutral-900' : 'text-white'}`}>
                FERNANDO KIBUBA
              </h3>
              <p className="text-xs text-amber-500 font-semibold tracking-widest uppercase mt-0.5">
                Videomaker Oficial
              </p>
              <p className={`text-[11px] mt-3 leading-relaxed ${isLight ? 'text-neutral-500' : 'text-gray-400'}`}>
                Compromisso com a verdade do Evangelho, a dignidade litúrgica e a beleza estética em cada frame.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
