import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  WifiOff,
  ServerCrash,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { Logo } from './Logo';
import { loginAdmin, pingAuthServer, ApiClientError, ApiErrorCode } from '../lib/api';
import { AdminUser } from '../types';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (token: string, user: AdminUser) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ApiErrorCode | null>(null);

  // Synchronous ref lock to guarantee duplicate submits are impossible
  const submittingRef = useRef(false);

  // Pre-warm authentication endpoint as soon as the modal opens and keep connection warm
  useEffect(() => {
    if (!isOpen) {
      setPassword('');
      setShowPassword(false);
      setError(null);
      setErrorCode(null);
      setIsLoading(false);
      submittingRef.current = false;
      return;
    }

    pingAuthServer().catch(() => {});
    const keepWarmInterval = setInterval(() => {
      pingAuthServer().catch(() => {});
    }, 40_000);

    return () => clearInterval(keepWarmInterval);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSafeClose = () => {
    if (isLoading || submittingRef.current) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent duplicate submissions while request is in progress
    if (submittingRef.current || isLoading) {
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorCode('VALIDATION');
      setError('Por favor, preencha o e-mail e a palavra-passe.');
      return;
    }

    submittingRef.current = true;
    setIsLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const res = await loginAdmin(trimmedEmail, password);
      setPassword('');
      onLoginSuccess(res.token, res.admin);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setErrorCode(err.code);
        setError(err.message);
      } else if (err instanceof Error && err.message && !/failed to fetch/i.test(err.message)) {
        setErrorCode('SERVER');
        setError(err.message);
      } else {
        setErrorCode('NETWORK');
        setError(
          'Não foi possível ligar ao servidor de autenticação. Verifique a sua ligação à Internet e tente novamente.'
        );
      }
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  const renderErrorIcon = () => {
    if (errorCode === 'NETWORK' || errorCode === 'TIMEOUT') {
      return <WifiOff className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />;
    }
    if (errorCode === 'SERVER') {
      return <ServerCrash className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />;
    }
    return <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
      {/* Background click */}
      <div className="absolute inset-0" onClick={handleSafeClose} />

      <div className="relative z-10 w-full max-w-md liquid-glass rounded-3xl border border-white/15 p-6 sm:p-8 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.85)]">
        {/* Back and Close Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={handleSafeClose}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-gray-300 hover:text-white border border-white/10 transition text-xs group disabled:opacity-50 disabled:cursor-not-allowed"
            title="Voltar ao Site"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>Voltar ao Site</span>
          </button>

          <button
            type="button"
            onClick={handleSafeClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-neutral-900 text-gray-400 hover:text-white border border-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Header with Logo */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <Logo size="sm" showSubtitle={true} />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/20 text-amber-300 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Acesso Privado — Administrador</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Inicie sessão com a sua conta autorizada para gerir publicações, Stories, comentários e atividades.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className={`p-3.5 mb-4 rounded-xl text-xs flex items-start gap-2.5 leading-relaxed ${
              errorCode === 'NETWORK' || errorCode === 'TIMEOUT'
                ? 'bg-amber-950/60 border border-amber-500/40 text-amber-100'
                : 'bg-red-950/60 border border-red-500/40 text-red-200'
            }`}
          >
            {renderErrorIcon()}
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="admin-login-email"
              className="block text-xs font-semibold text-gray-300 mb-1.5"
            >
              E-mail do Administrador
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="admin-login-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                disabled={isLoading}
                placeholder="exemplo@dominio.com"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-neutral-900 text-white placeholder-gray-500 text-xs sm:text-sm border border-white/10 focus:outline-none focus:border-amber-400 transition disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="admin-login-password"
              className="block text-xs font-semibold text-gray-300 mb-1.5"
            >
              Palavra-passe
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="admin-login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                disabled={isLoading}
                placeholder="••••••••"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-neutral-900 text-white placeholder-gray-500 text-xs sm:text-sm border border-white/10 focus:outline-none focus:border-amber-400 transition disabled:opacity-60"
              />
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1 disabled:opacity-50"
                title={showPassword ? 'Ocultar' : 'Mostrar'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            aria-busy={isLoading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-[#E50914] text-black font-bold text-sm shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:brightness-110 active:scale-[0.99] transition disabled:opacity-70 disabled:cursor-wait flex items-center justify-center gap-2 mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 text-neutral-950 animate-spin" />
                <span>A autenticar...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-neutral-950" />
                <span>Entrar no Painel</span>
              </>
            )}
          </button>
        </form>

        <p className="text-[11px] text-gray-500 text-center mt-4">
          Acesso estritamente restrito. Tentativas de acesso não autorizado são registadas no servidor.
        </p>
      </div>
    </div>
  );
};

