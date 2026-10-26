import React, { useState } from 'react';
import { Mail, Send, CheckCircle2, AlertCircle, MapPin, Camera, Sparkles, MessageSquare } from 'lucide-react';
import { sendContactMessage } from '../lib/api';

interface ContactSectionProps {
  theme?: 'dark' | 'light';
}

export const ContactSection: React.FC<ContactSectionProps> = ({ theme = 'dark' }) => {
  const isLight = theme === 'light';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) {
      setErrorMessage('Por favor preencha o seu nome e a mensagem.');
      setStatus('error');
      return;
    }

    try {
      setStatus('loading');
      setErrorMessage('');
      await sendContactMessage({
        name: name.trim(),
        email: email.trim() || undefined,
        subject: subject.trim() || 'Mensagem do Site',
        message: message.trim(),
        honeypot
      });

      setStatus('success');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Falha ao enviar mensagem. Tente novamente.');
    }
  };

  return (
    <section id="contacto" className={`py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t ${
      isLight ? 'border-neutral-200' : 'border-white/5'
    }`}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Information Column */}
        <div className="lg:col-span-5 space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs text-amber-500 font-semibold tracking-wider uppercase mb-1">
              <Mail className="w-3.5 h-3.5 text-[#E50914]" />
              <span>Canal de Contacto Oficial</span>
            </div>
            <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-heading ${
              isLight ? 'text-neutral-900' : 'text-white'
            }`}>
              Fale com o VIDEOMAKER
            </h2>
            <p className={`text-xs sm:text-sm mt-2 leading-relaxed ${
              isLight ? 'text-neutral-600' : 'text-gray-400'
            }`}>
              Deseja solicitar cobertura audiovisual para uma cerimónia especial, culto de ação de graças, batismo, casamento ou obter fotografias originais em alta definição da Igreja Metodista de Fernando Kibuba? Envie-nos uma mensagem.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <div className={`p-4 rounded-2xl flex items-start gap-3.5 border transition ${
              isLight
                ? 'bg-white border-neutral-200 shadow-sm'
                : 'bg-neutral-900/60 border-white/5'
            }`}>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-400/20 text-amber-500 flex items-center justify-center flex-shrink-0">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h4 className={`text-sm font-bold ${isLight ? 'text-neutral-900' : 'text-white'}`}>
                  Produção & Cobertura de Eventos
                </h4>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-neutral-600' : 'text-gray-400'}`}>
                  Captação de imagem e vídeo profissional para celebrações e atividades religiosas.
                </p>
              </div>
            </div>

            <div className={`p-4 rounded-2xl flex items-start gap-3.5 border transition ${
              isLight
                ? 'bg-white border-neutral-200 shadow-sm'
                : 'bg-neutral-900/60 border-white/5'
            }`}>
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-[#E50914] flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h4 className={`text-sm font-bold ${isLight ? 'text-neutral-900' : 'text-white'}`}>
                  Localização
                </h4>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-neutral-600' : 'text-gray-400'}`}>
                  Igreja Metodista de Fernando Kibuba, Luanda — Angola.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Contact Form Column */}
        <div className={`lg:col-span-7 rounded-2xl p-6 sm:p-8 shadow-2xl relative border ${
          isLight
            ? 'bg-white border-neutral-200 shadow-neutral-200/50'
            : 'bg-neutral-900/80 border-white/10'
        }`}>
          <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${
            isLight ? 'text-neutral-900' : 'text-white'
          }`}>
            <MessageSquare className="w-4 h-4 text-amber-500" />
            <span>Enviar Mensagem ao Responsável</span>
          </h3>

          {status === 'success' && (
            <div className="p-4 mb-6 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Mensagem enviada com sucesso!</p>
                <p className="text-emerald-300 text-xs mt-0.5">
                  O responsável pelo VIDEOMAKER Fernando Kibuba recebeu a sua mensagem e responderá com a maior brevidade.
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="p-4 mb-6 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs sm:text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot field (hidden from real users to catch spambots) */}
            <input
              type="text"
              name="company_url"
              value={honeypot}
              onChange={e => setHoneypot(e.target.value)}
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${
                  isLight ? 'text-neutral-700' : 'text-gray-300'
                }`}>
                  Seu Nome Completo <span className="text-[#E50914]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Irmão Manuel João"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={100}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border focus:outline-none transition ${
                    isLight
                      ? 'bg-neutral-50 border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-amber-500'
                      : 'bg-neutral-950 border-white/10 text-white placeholder-gray-500 focus:border-amber-400'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${
                  isLight ? 'text-neutral-700' : 'text-gray-300'
                }`}>
                  E-mail ou Telefone (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: contacto@email.com ou +244 9..."
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  maxLength={120}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border focus:outline-none transition ${
                    isLight
                      ? 'bg-neutral-50 border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-amber-500'
                      : 'bg-neutral-950 border-white/10 text-white placeholder-gray-500 focus:border-amber-400'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${
                isLight ? 'text-neutral-700' : 'text-gray-300'
              }`}>
                Assunto
              </label>
              <input
                type="text"
                placeholder="Ex: Solicitação de cobertura fotográfica para culto especial"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                maxLength={150}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border focus:outline-none transition ${
                  isLight
                    ? 'bg-neutral-50 border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-amber-500'
                    : 'bg-neutral-950 border-white/10 text-white placeholder-gray-500 focus:border-amber-400'
                }`}
              />
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${
                isLight ? 'text-neutral-700' : 'text-gray-300'
              }`}>
                Mensagem <span className="text-[#E50914]">*</span>
              </label>
              <textarea
                required
                rows={4}
                placeholder="Escreva a sua mensagem, detalhes da atividade ou pedido de informação..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={2000}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border focus:outline-none transition resize-none ${
                  isLight
                    ? 'bg-neutral-50 border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-amber-500'
                    : 'bg-neutral-950 border-white/10 text-white placeholder-gray-500 focus:border-amber-400'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-[#E50914] text-black font-bold text-sm shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:brightness-110 active:scale-[0.99] transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4 text-neutral-950" />
              <span>{status === 'loading' ? 'A enviar mensagem...' : 'Enviar Mensagem'}</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};
