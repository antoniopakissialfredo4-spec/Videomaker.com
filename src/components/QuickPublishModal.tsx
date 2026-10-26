import React, { useState, useRef } from 'react';
import {
  X, ArrowLeft, Camera, Film, Calendar, Upload,
  CheckCircle2, AlertCircle, Sparkles, Image as ImageIcon,
  Tag, MapPin, Clock, Eye, Trash2, Link as LinkIcon
} from 'lucide-react';
import { Post, CATEGORIES } from '../types';
import { createPost, createActivity, uploadMediaFile, uploadMediaFileDetailed } from '../lib/api';
import { UniversalVideoPlayer } from './UniversalVideoPlayer';
import { StoryBatchPublisher } from './StoryBatchPublisher';
import { parseVideoSource, isVideoSource, normalizeMediaUrl } from '../lib/videoUtils';

interface QuickPublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onPublished: () => void;
  theme?: 'dark' | 'light';
  initialType?: 'photo' | 'video' | 'activity' | 'story';
}

export const QuickPublishModal: React.FC<QuickPublishModalProps> = ({
  isOpen,
  onClose,
  token,
  onPublished,
  theme = 'dark',
  initialType = 'photo'
}) => {
  const isLight = theme === 'light';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Publish type
  const [publishType, setPublishType] = useState<'photo' | 'video' | 'activity' | 'story'>(initialType);

  React.useEffect(() => {
    if (isOpen) {
      setPublishType(initialType);
      setStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen, initialType]);

  // Input mode: 'file' | 'url'
  const [inputMode, setInputMode] = useState<'file' | 'url'>('file');

  // Media File / Preview
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>('');
  const [mediaUrlInput, setMediaUrlInput] = useState<string>('');
  const [mediaBase64, setMediaBase64] = useState<string>('');

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('Cultos');
  const [location, setLocation] = useState('Igreja Metodista Fernando Kibuba, Luanda');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('10:00');

  // Status
  const [status, setStatus] = useState<'idle' | 'uploading' | 'publishing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  // Handle direct file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('video/')) {
      setPublishType('video');
    } else if (file.type.startsWith('image/')) {
      if (publishType === 'video') {
        setPublishType('photo');
      }
    }

    setMediaFile(file);
    setStatus('idle');
    setErrorMessage('');

    const objectUrl = URL.createObjectURL(file);
    setMediaPreview(objectUrl);

    // Only read small images as Base64 fallback; never load heavy video files into Base64 RAM!
    if (!file.type.startsWith('video/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setMediaBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setMediaBase64('');
    }
  };

  const handleClearMedia = () => {
    setMediaFile(null);
    setMediaPreview('');
    setMediaBase64('');
    setMediaUrlInput('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setErrorMessage('Por favor insira um título para a publicação.');
      setStatus('error');
      return;
    }

    const finalMediaSource = inputMode === 'url' ? mediaUrlInput.trim() : (mediaFile ? 'has-file' : mediaBase64);

    if (!finalMediaSource && publishType !== 'activity') {
      setErrorMessage('Por favor selecione um ficheiro ou insira o link de um vídeo/fotografia.');
      setStatus('error');
      return;
    }

    try {
      setStatus('uploading');
      setErrorMessage('');

      let finalUrl = '';
      let generatedThumb: string | undefined = undefined;

      if (inputMode === 'url') {
        finalUrl = normalizeMediaUrl(mediaUrlInput.trim());
      } else if (mediaFile) {
        const uploadRes = await uploadMediaFileDetailed(mediaFile, token);
        finalUrl = uploadRes.url;
        generatedThumb = uploadRes.thumbnailUrl;
      } else {
        finalUrl = mediaBase64;
      }

      setStatus('publishing');

      if (publishType === 'activity') {
        await createActivity({
          title: title.trim(),
          description: description.trim(),
          posterUrl: finalUrl || undefined,
          date: eventDate || new Date().toISOString().split('T')[0],
          time: eventTime || '10:00',
          location: location.trim() || 'Igreja Metodista Fernando Kibuba, Luanda',
          additionalInfo: ''
        }, token);
      } else {
        // Photo or Video
        const detectedIsVideo = publishType === 'video' || isVideoSource(finalUrl);
        const videoInfo = detectedIsVideo ? parseVideoSource(finalUrl) : null;

        await createPost({
          title: title.trim(),
          description: description.trim(),
          type: detectedIsVideo ? 'video' : 'photo',
          mediaUrl: finalUrl,
          thumbnailUrl: generatedThumb || videoInfo?.thumbnailUrl || undefined,
          category,
          location: location.trim() || 'Igreja Metodista Fernando Kibuba, Luanda',
          featured: false
        }, token);
      }

      setStatus('success');
      onPublished();

      setTimeout(() => {
        handleClearMedia();
        setTitle('');
        setDescription('');
        setStatus('idle');
        onClose();
      }, 1200);

    } catch (err: any) {
      console.error('Publication failed:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Falha ao publicar conteúdo. Tente novamente.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      {/* Liquid Glass Modal Card */}
      <div className={`relative w-full max-w-2xl rounded-3xl overflow-hidden my-auto border shadow-2xl transition-all ${
        isLight
          ? 'liquid-glass-light border-white/60 text-neutral-900 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)]'
          : 'liquid-glass border-white/15 text-white shadow-[0_25px_70px_-15px_rgba(0,0,0,0.8)]'
      }`}>

        {/* Ambient Top Glow Banner */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-[#E50914] to-amber-400" />

        {/* Header with Back Arrow */}
        <div className={`px-5 sm:px-7 py-4 border-b flex items-center justify-between ${
          isLight ? 'border-neutral-200/60 bg-white/40' : 'border-white/10 bg-neutral-950/40'
        }`}>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className={`p-2 rounded-xl border transition flex items-center gap-1.5 text-xs font-semibold ${
                isLight
                  ? 'border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700'
                  : 'border-white/10 bg-white/5 hover:bg-white/10 text-gray-200'
              }`}
              title="Voltar ao Site"
            >
              <ArrowLeft className="w-4 h-4 text-amber-500" />
              <span className="hidden sm:inline">Voltar</span>
            </button>

            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-500 tracking-wider uppercase">
                <Sparkles className="w-3 h-3 text-[#E50914]" />
                <span>Publicação Rápida — Administrador</span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                Nova Quadra no Ar
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition ${
              isLight ? 'text-neutral-500 hover:bg-neutral-200' : 'text-gray-400 hover:bg-white/10'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* Step 1: Type Selection */}
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2.5 ${
              isLight ? 'text-neutral-700' : 'text-gray-300'
            }`}>
              1. Selecione a Quadra de Publicação:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Stories 24h (Multi-upload without limit) */}
              <button
                type="button"
                onClick={() => setPublishType('story')}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                  publishType === 'story'
                    ? isLight
                      ? 'bg-amber-500/20 border-orange-500 text-orange-800 shadow-md font-bold'
                      : 'bg-gradient-to-br from-[#FFC107]/20 via-[#FF6D00]/20 to-[#E50914]/20 border-[#FFC107] text-[#FFC107] shadow-[0_0_20px_rgba(255,193,7,0.25)] font-bold'
                    : isLight
                      ? 'bg-white/70 border-neutral-200 text-neutral-600 hover:bg-white'
                      : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  publishType === 'story'
                    ? 'bg-gradient-to-tr from-[#FFC107] via-[#FF6D00] to-[#E50914] text-black'
                    : 'bg-white/10'
                }`}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-xs">Stories (24h)</span>
              </button>

              {/* Photo */}
              <button
                type="button"
                onClick={() => setPublishType('photo')}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                  publishType === 'photo'
                    ? isLight
                      ? 'bg-amber-400/20 border-amber-500 text-amber-700 shadow-md font-bold'
                      : 'bg-amber-400/15 border-amber-400 text-amber-300 shadow-[0_0_20px_rgba(212,175,55,0.25)] font-bold'
                    : isLight
                      ? 'bg-white/70 border-neutral-200 text-neutral-600 hover:bg-white'
                      : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  publishType === 'photo' ? 'bg-amber-400 text-black' : 'bg-white/10'
                }`}>
                  <Camera className="w-4 h-4" />
                </div>
                <span className="text-xs">Foto HD</span>
              </button>

              {/* Video */}
              <button
                type="button"
                onClick={() => setPublishType('video')}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                  publishType === 'video'
                    ? isLight
                      ? 'bg-red-500/20 border-[#E50914] text-red-700 shadow-md font-bold'
                      : 'bg-red-500/20 border-[#E50914] text-red-300 shadow-[0_0_20px_rgba(229,9,20,0.3)] font-bold'
                    : isLight
                      ? 'bg-white/70 border-neutral-200 text-neutral-600 hover:bg-white'
                      : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  publishType === 'video' ? 'bg-[#E50914] text-white' : 'bg-white/10'
                }`}>
                  <Film className="w-4 h-4" />
                </div>
                <span className="text-xs">Vídeo HD 1080p</span>
              </button>

              {/* Activity */}
              <button
                type="button"
                onClick={() => setPublishType('activity')}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                  publishType === 'activity'
                    ? isLight
                      ? 'bg-blue-500/15 border-blue-500 text-blue-700 shadow-md font-bold'
                      : 'bg-blue-500/20 border-blue-400 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.3)] font-bold'
                    : isLight
                      ? 'bg-white/70 border-neutral-200 text-neutral-600 hover:bg-white'
                      : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  publishType === 'activity' ? 'bg-blue-500 text-white' : 'bg-white/10'
                }`}>
                  <Calendar className="w-4 h-4" />
                </div>
                <span className="text-xs">Atividade</span>
              </button>
            </div>
          </div>

          {publishType === 'story' ? (
            <div className="pt-1">
              <StoryBatchPublisher
                token={token}
                isLight={isLight}
                compact
                onPublished={() => {
                  onPublished();
                }}
              />
            </div>
          ) : (
            <>

          {/* Step 2: Media Source (Upload vs Link) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`block text-xs font-bold uppercase tracking-wider ${
                isLight ? 'text-neutral-700' : 'text-gray-300'
              }`}>
                2. Ficheiro ou Link de Vídeo:
              </label>

              {/* Switch between file upload and link */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/30 border border-white/10 text-[11px]">
                <button
                  type="button"
                  onClick={() => setInputMode('file')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    inputMode === 'file' ? 'bg-amber-400 text-black shadow' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Ficheiro Local
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('url')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    inputMode === 'url' ? 'bg-amber-400 text-black shadow' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Link / YouTube / Vimeo
                </button>
              </div>
            </div>

            {inputMode === 'file' ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={publishType === 'video' ? 'video/*' : 'image/*,video/*'}
                  onChange={handleFileChange}
                  className="hidden"
                  id="quick-publish-file-input"
                />

                {!mediaPreview ? (
                  <label
                    htmlFor="quick-publish-file-input"
                    className={`flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all group ${
                      isLight
                        ? 'border-neutral-300 bg-white/60 hover:bg-white hover:border-amber-500'
                        : 'border-white/15 bg-white/5 hover:bg-white/10 hover:border-amber-400/60'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-400/30 text-amber-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Upload className="w-7 h-7" />
                    </div>
                    <p className={`text-sm font-bold ${isLight ? 'text-neutral-800' : 'text-white'}`}>
                      Escolher Vídeo ou Foto do seu Telemóvel ou PC
                    </p>
                    <span className="mt-2 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-400/30">
                      Suporta MP4, MOV, WebM, JPG, PNG
                    </span>
                  </label>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden border border-white/20 bg-black/60 shadow-lg">
                    {mediaFile?.type.startsWith('video/') ? (
                      <UniversalVideoPlayer
                        url={mediaPreview}
                        title={mediaFile?.name || 'Pré-visualização do Vídeo'}
                        autoPlay={false}
                        className="w-full aspect-video max-h-56"
                      />
                    ) : (
                      <img
                        src={mediaPreview}
                        alt="Pré-visualização"
                        className="w-full max-h-56 object-contain bg-black/40"
                      />
                    )}

                    <div className="p-3 bg-black/80 backdrop-blur-md flex items-center justify-between text-xs text-white">
                      <span className="truncate max-w-xs font-medium">
                        {mediaFile?.name || 'Ficheiro selecionado'}
                      </span>
                      <button
                        type="button"
                        onClick={handleClearMedia}
                        className="px-2.5 py-1 rounded-lg bg-red-600/80 hover:bg-red-600 text-white flex items-center gap-1 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Trocar</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Ex: https://www.youtube.com/watch?v=... ou uploads/video.mp4 ou link direto"
                  value={mediaUrlInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMediaUrlInput(val);
                    if (isVideoSource(val)) {
                      setPublishType('video');
                    }
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border focus:outline-none transition ${
                    isLight
                      ? 'bg-white border-neutral-300 text-neutral-900 focus:border-amber-500'
                      : 'bg-black/40 border-white/10 text-white focus:border-amber-400'
                  }`}
                />

                <div className="text-[11px] text-amber-500 font-medium">
                  ✨ Cole qualquer link do YouTube, Vimeo, Google Drive ou link direto de vídeo.
                </div>

                {mediaUrlInput.trim() && (
                  <div className="rounded-2xl overflow-hidden border border-white/10 bg-black">
                    <UniversalVideoPlayer
                      url={mediaUrlInput.trim()}
                      title={title || 'Pré-visualização'}
                      autoPlay={false}
                      className="w-full aspect-video max-h-56"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 3: Fast Details (Title, Category) */}
          <div className="space-y-3.5">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${
                isLight ? 'text-neutral-700' : 'text-gray-300'
              }`}>
                Título da Publicação *
              </label>
              <input
                type="text"
                placeholder="Ex: Culto de Ação de Graças e Santa Ceia • Luanda"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border focus:outline-none transition ${
                  isLight
                    ? 'bg-white border-neutral-300 text-neutral-900 focus:border-amber-500'
                    : 'bg-black/40 border-white/10 text-white focus:border-amber-400'
                }`}
                required
              />
            </div>

            {/* Category selection */}
            {(publishType === 'photo' || publishType === 'video') && (
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${
                  isLight ? 'text-neutral-700' : 'text-gray-300'
                }`}>
                  Categoria:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.filter(c => c !== 'Todos').map(cat => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`px-3 py-1 rounded-lg text-xs transition ${
                        category === cat
                          ? 'bg-amber-400 text-black font-bold shadow-sm'
                          : isLight
                            ? 'bg-white/80 border border-neutral-300 text-neutral-700 hover:bg-white'
                            : 'bg-white/5 border border-white/5 text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Specific Fields */}
            {publishType === 'activity' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${
                    isLight ? 'text-neutral-700' : 'text-gray-300'
                  }`}>
                    Data do Evento:
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
                      isLight ? 'bg-white border-neutral-300' : 'bg-black/40 border-white/10 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${
                    isLight ? 'text-neutral-700' : 'text-gray-300'
                  }`}>
                    Horário:
                  </label>
                  <input
                    type="time"
                    value={eventTime}
                    onChange={e => setEventTime(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
                      isLight ? 'bg-white border-neutral-300' : 'bg-black/40 border-white/10 text-white'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Description (Optional) */}
            <div>
              <label className={`block text-xs font-semibold mb-1 ${
                isLight ? 'text-neutral-700' : 'text-gray-300'
              }`}>
                Descrição ou Versículo (Opcional):
              </label>
              <textarea
                rows={2}
                placeholder="Detalhes sobre a celebração, mensagem de louvor ou nota pastoral..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className={`w-full px-3.5 py-2 rounded-xl text-xs sm:text-sm border focus:outline-none transition ${
                  isLight
                    ? 'bg-white border-neutral-300 text-neutral-900 focus:border-amber-500'
                    : 'bg-black/40 border-white/10 text-white focus:border-amber-400'
                }`}
              />
            </div>
          </div>

          {/* Feedback Messages */}
          {status === 'error' && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {status === 'success' && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Publicação concluída com sucesso! A entrar no ar...</span>
            </div>
          )}

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={status === 'uploading' || status === 'publishing'}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
                isLight ? 'bg-neutral-200 hover:bg-neutral-300 text-neutral-800' : 'bg-white/10 hover:bg-white/15 text-white'
              }`}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={status === 'uploading' || status === 'publishing'}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-[#E50914] text-black font-extrabold text-xs shadow-lg hover:brightness-110 active:scale-95 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {status === 'uploading' ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>A enviar ficheiro...</span>
                </>
              ) : status === 'publishing' ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>A publicar...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-black" />
                  <span>Publicar Agora</span>
                </>
              )}
            </button>
          </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
