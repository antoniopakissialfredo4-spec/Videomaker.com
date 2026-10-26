import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Film,
  Camera,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';
import { createStoriesBatch, uploadMediaFileDetailed } from '../lib/api';
import { isVideoSource, normalizeMediaUrl, parseVideoSource } from '../lib/videoUtils';
import { StoryCreateInput } from '../types';

export interface QueuedStoryItem {
  id: string;
  sourceType: 'file' | 'url';
  file?: File;
  previewUrl?: string;
  remoteUrl?: string;
  thumbnailUrl?: string;
  mediaType: 'photo' | 'video';
  customTitle: string;
  fileName: string;
  fileSizeLabel: string;
  progress: number;
  status: 'queued' | 'uploading' | 'processing' | 'uploaded' | 'published' | 'error';
  errorMessage?: string;
}

interface StoryBatchPublisherProps {
  token: string;
  onPublished: (publishedCount: number) => void;
  isLight?: boolean;
  compact?: boolean;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function detectFileMediaType(file: File): 'photo' | 'video' {
  if (file.type.startsWith('video/')) return 'video';
  if (/\.(mp4|mov|webm|m4v|mkv|avi|3gp|mts)$/i.test(file.name)) return 'video';
  return 'photo';
}

export const StoryBatchPublisher: React.FC<StoryBatchPublisherProps> = ({
  token,
  onPublished,
  isLight = false,
  compact = false
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const itemsRef = useRef<QueuedStoryItem[]>([]);

  const [items, setItems] = useState<QueuedStoryItem[]>([]);
  const [defaultTitle, setDefaultTitle] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [showUrlBox, setShowUrlBox] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const [summaryBanner, setSummaryBanner] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Revoke object URLs on unmount to keep mobile memory clean
  useEffect(() => {
    return () => {
      itemsRef.current.forEach(item => {
        if (item.previewUrl && item.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);

  const appendFiles = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList).filter(
      f =>
        f.type.startsWith('image/') ||
        f.type.startsWith('video/') ||
        /\.(jpg|jpeg|png|webp|gif|heic|heif|avif|mp4|mov|webm|m4v|mkv|avi|3gp|mts)$/i.test(f.name)
    );

    if (incoming.length === 0) {
      setSummaryBanner({
        type: 'error',
        text: 'Selecione fotografias (JPG, PNG, WebP) ou vídeos (MP4, MOV, WebM).'
      });
      return;
    }

    setSummaryBanner(null);

    const newEntries: QueuedStoryItem[] = incoming.map((file, idx) => {
      const mediaType = detectFileMediaType(file);
      // Only create blob previews for images so 20+ videos never exhaust mobile RAM
      const previewUrl = mediaType === 'photo' ? URL.createObjectURL(file) : undefined;
      return {
        id: `q-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
        sourceType: 'file',
        file,
        previewUrl,
        mediaType,
        customTitle: '',
        fileName: file.name,
        fileSizeLabel: formatBytes(file.size),
        progress: 0,
        status: 'queued'
      };
    });

    setItems(prev => [...prev, ...newEntries]);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      appendFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleAddUrlItem = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    const normalized = normalizeMediaUrl(trimmed);
    const isVid = isVideoSource(normalized);
    const parsed = isVid ? parseVideoSource(normalized) : null;

    const newItem: QueuedStoryItem = {
      id: `q-url-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sourceType: 'url',
      remoteUrl: normalized,
      thumbnailUrl: parsed?.thumbnailUrl,
      previewUrl: isVid ? parsed?.thumbnailUrl : normalized,
      mediaType: isVid ? 'video' : 'photo',
      customTitle: '',
      fileName: trimmed.split('/').pop() || 'Link externo',
      fileSizeLabel: isVid ? 'Vídeo Link' : 'Foto Link',
      progress: 100,
      status: 'uploaded'
    };

    setItems(prev => [...prev, newItem]);
    setUrlInput('');
    setSummaryBanner(null);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => {
      const target = prev.find(i => i.id === id);
      if (target?.previewUrl && target.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter(i => i.id !== id);
    });
  };

  const handleClearCompleted = () => {
    setItems(prev => {
      prev.forEach(i => {
        if (i.status === 'published' && i.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(i.previewUrl);
        }
      });
      return prev.filter(i => i.status !== 'published');
    });
  };

  const updateItem = (id: string, patch: Partial<QueuedStoryItem>) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));
  };

  // Upload and publish all pending or failed items (unlimited count, sequential/controlled concurrency for mobile reliability)
  const processAndPublishItems = async (onlyFailed = false) => {
    const candidates = itemsRef.current.filter(item =>
      onlyFailed
        ? item.status === 'error'
        : item.status === 'queued' || item.status === 'uploaded' || item.status === 'error'
    );

    if (candidates.length === 0) {
      setSummaryBanner({
        type: 'error',
        text: 'Selecione pelo menos uma fotografia ou vídeo para publicar nos Stories.'
      });
      return;
    }

    setIsRunningBatch(true);
    setSummaryBanner(null);

    const readyToPublish: Array<{ queueId: string; payload: StoryCreateInput }> = [];
    let failedCount = 0;

    // Upload files one by one (photos & videos report crisp individual progress without saturating mobile upload bandwidth or server FFmpeg)
    for (const candidate of candidates) {
      const latest = itemsRef.current.find(i => i.id === candidate.id) || candidate;
      const finalTitle =
        latest.customTitle.trim() || defaultTitle.trim() || 'Fernando Kibuba';

      if (latest.sourceType === 'url' && latest.remoteUrl) {
        readyToPublish.push({
          queueId: latest.id,
          payload: {
            title: finalTitle,
            type: latest.mediaType,
            mediaUrl: latest.remoteUrl,
            thumbnailUrl: latest.thumbnailUrl
          }
        });
        continue;
      }

      if (latest.remoteUrl && latest.status === 'uploaded') {
        readyToPublish.push({
          queueId: latest.id,
          payload: {
            title: finalTitle,
            type: latest.mediaType,
            mediaUrl: latest.remoteUrl,
            thumbnailUrl: latest.thumbnailUrl
          }
        });
        continue;
      }

      if (!latest.file) {
        failedCount++;
        updateItem(latest.id, {
          status: 'error',
          errorMessage: 'Ficheiro inválido.'
        });
        continue;
      }

      try {
        updateItem(latest.id, {
          status: 'uploading',
          progress: 2,
          errorMessage: undefined
        });

        const uploaded = await uploadMediaFileDetailed(
          latest.file,
          token,
          (percent, phase) => {
            updateItem(latest.id, {
              progress: percent,
              status: phase === 'processing' ? 'processing' : 'uploading'
            });
          },
          { context: 'story' }
        );

        updateItem(latest.id, {
          status: 'uploaded',
          progress: 100,
          remoteUrl: uploaded.url,
          thumbnailUrl: uploaded.thumbnailUrl
        });

        readyToPublish.push({
          queueId: latest.id,
          payload: {
            title: finalTitle,
            type: latest.mediaType,
            mediaUrl: uploaded.url,
            thumbnailUrl: uploaded.thumbnailUrl
          }
        });
      } catch (err: any) {
        failedCount++;
        updateItem(latest.id, {
          status: 'error',
          errorMessage: err?.message || 'Falha no carregamento deste ficheiro.'
        });
      }
    }

    // Save all successfully uploaded Stories in one batch without deleting previous Stories
    let publishedCount = 0;
    if (readyToPublish.length > 0) {
      try {
        const created = await createStoriesBatch(
          readyToPublish.map(r => r.payload),
          token
        );
        publishedCount = created.length || readyToPublish.length;

        const publishedIds = new Set(readyToPublish.map(r => r.queueId));
        setItems(prev =>
          prev.map(item =>
            publishedIds.has(item.id)
              ? { ...item, status: 'published', progress: 100, errorMessage: undefined }
              : item
          )
        );

        onPublished(publishedCount);

        // Automatically clear published items if there were no failures
        if (failedCount === 0) {
          setTimeout(() => {
            handleClearCompleted();
            setDefaultTitle('');
          }, 1100);
        }
      } catch (batchErr: any) {
        failedCount += readyToPublish.length;
        const attemptedIds = new Set(readyToPublish.map(r => r.queueId));
        setItems(prev =>
          prev.map(item =>
            attemptedIds.has(item.id)
              ? {
                  ...item,
                  status: 'error',
                  errorMessage: batchErr?.message || 'Erro ao guardar Story no servidor.'
                }
              : item
          )
        );
      }
    }

    setIsRunningBatch(false);

    if (publishedCount > 0 && failedCount === 0) {
      setSummaryBanner({
        type: 'success',
        text:
          publishedCount === 1
            ? '1 Story publicado com sucesso! Já está visível por 24 horas.'
            : `${publishedCount} Stories publicados com sucesso numa única operação! Todos visíveis por 24 horas.`
      });
    } else if (publishedCount > 0 && failedCount > 0) {
      setSummaryBanner({
        type: 'warning',
        text: `${publishedCount} Stories publicados com sucesso, mas ${failedCount} ficheiro(s) falharam. Pode tentar reenviar apenas os que falharam.`
      });
    } else if (failedCount > 0) {
      setSummaryBanner({
        type: 'error',
        text: `Não foi possível enviar ${failedCount} ficheiro(s). Verifique a ligação e toque em "Tentar novamente".`
      });
    }
  };

  const pendingOrErrorItems = items.filter(i => i.status !== 'published');
  const failedItemsCount = items.filter(i => i.status === 'error').length;
  const completedCount = items.filter(
    i => i.status === 'uploaded' || i.status === 'published'
  ).length;

  return (
    <div className="space-y-4">
      {/* Hidden Unlimited Multi-File Input (Photos + Videos, Mobile & Desktop) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Optional General Caption + Link Toggle */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label
            className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
              isLight ? 'text-neutral-700' : 'text-gray-300'
            }`}
          >
            Legenda Geral dos Stories (Opcional)
          </label>
          <input
            type="text"
            placeholder="Ex: Culto de Domingo • Momentos de Louvor"
            value={defaultTitle}
            onChange={e => setDefaultTitle(e.target.value)}
            disabled={isRunningBatch}
            className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border focus:outline-none transition ${
              isLight
                ? 'bg-white border-neutral-300 text-neutral-900 focus:border-amber-500'
                : 'bg-neutral-900/90 border-white/10 text-white focus:border-[#FFC107] placeholder:text-gray-500'
            }`}
          />
        </div>

        <div className="flex flex-col justify-end">
          <button
            type="button"
            onClick={() => setShowUrlBox(prev => !prev)}
            disabled={isRunningBatch}
            className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              showUrlBox
                ? 'bg-[#FFC107]/20 border-[#FFC107] text-[#FFC107]'
                : isLight
                  ? 'bg-neutral-100 border-neutral-300 text-neutral-700 hover:bg-neutral-200'
                  : 'bg-neutral-900/80 border-white/10 text-gray-300 hover:bg-white/10'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5 text-[#FFC107]" />
            <span>Adicionar por Link</span>
          </button>
        </div>
      </div>

      {/* Optional Direct URL Input */}
      {showUrlBox && (
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-black/40 border border-white/10">
          <input
            type="text"
            placeholder="Cole link direto de foto, vídeo MP4 ou YouTube..."
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddUrlItem();
              }
            }}
            className="flex-1 px-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FFC107]"
          />
          <button
            type="button"
            onClick={handleAddUrlItem}
            disabled={!urlInput.trim()}
            className="px-3.5 py-2 rounded-xl bg-[#FFC107] text-black font-extrabold text-xs hover:brightness-110 transition disabled:opacity-40 cursor-pointer"
          >
            Adicionar
          </button>
        </div>
      )}

      {/* Multi-Select Dropzone / Mobile Picker Trigger (NO 10-Story Limit!) */}
      <div
        onDragOver={e => {
          e.preventDefault();
          if (!isRunningBatch) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragging(false);
          if (!isRunningBatch && e.dataTransfer.files?.length) {
            appendFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => {
          if (!isRunningBatch) fileInputRef.current?.click();
        }}
        className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center ${
          compact ? 'p-5' : 'p-6 sm:p-7'
        } ${
          isDragging
            ? 'border-[#FFC107] bg-[#FFC107]/10 scale-[1.01]'
            : isLight
              ? 'border-neutral-300 bg-white/70 hover:border-amber-500 hover:bg-white'
              : 'border-amber-400/35 bg-gradient-to-b from-white/[0.04] to-black/40 hover:border-[#FFC107] hover:bg-white/[0.06]'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FFC107] via-[#FF6D00] to-[#E50914] p-[2px] mx-auto mb-3 shadow-lg">
          <div className="w-full h-full rounded-[14px] bg-[#0b0b0e] flex items-center justify-center text-[#FFC107]">
            <Upload className="w-5 h-5" />
          </div>
        </div>

        <p className={`text-xs sm:text-sm font-extrabold ${isLight ? 'text-neutral-900' : 'text-white'}`}>
          {items.length > 0
            ? 'Adicionar mais fotografias e vídeos a esta publicação'
            : 'Selecionar várias fotografias e vídeos ao mesmo tempo'}
        </p>
        <p className={`text-[11px] mt-1 ${isLight ? 'text-neutral-600' : 'text-gray-400'}`}>
          Sem limite de 10 Stories — escolha 10, 20, 50 ou quantos conteúdos desejar no telemóvel ou computador
        </p>

        <div className="mt-3 inline-flex flex-wrap items-center justify-center gap-2">
          <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#FFC107]/15 text-[#FFC107] border border-[#FFC107]/35 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" />
            <span>Escolher Ficheiros</span>
          </span>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white/5 text-gray-400 border border-white/10">
            Fotos + Vídeos MP4/MOV/WebM · 24h
          </span>
        </div>
      </div>

      {/* Selected Files Queue with Per-File Upload Progress & Error Retry */}
      {items.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#0b0b0f]/95 p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-[#FFC107] via-[#FF6D00] to-[#E50914] text-black">
                {items.length} {items.length === 1 ? 'Story selecionado' : 'Stories selecionados'}
              </span>
              {isRunningBatch && (
                <span className="text-[11px] font-bold text-[#FFC107]">
                  ({completedCount}/{items.length} concluídos)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isRunningBatch && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[#FFC107] text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Adicionar mais</span>
                </button>
              )}
              {!isRunningBatch && items.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    items.forEach(i => {
                      if (i.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(i.previewUrl);
                    });
                    setItems([]);
                    setSummaryBanner(null);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-semibold transition cursor-pointer"
                >
                  Limpar lista
                </button>
              )}
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={`p-2.5 rounded-xl border transition flex items-center gap-3 ${
                  item.status === 'error'
                    ? 'bg-red-950/30 border-red-500/40'
                    : item.status === 'published'
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-neutral-900/80 border-white/10'
                }`}
              >
                {/* Thumbnail Circle Preview */}
                <div className="w-11 h-11 rounded-full p-[2px] bg-gradient-to-tr from-[#FFC107] via-[#FF6D00] to-[#E50914] shrink-0">
                  <div className="w-full h-full rounded-full overflow-hidden bg-neutral-950 flex items-center justify-center relative">
                    {item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={item.fileName}
                        className="w-full h-full object-cover"
                      />
                    ) : item.mediaType === 'video' ? (
                      <Film className="w-4 h-4 text-[#FFC107]" />
                    ) : (
                      <Camera className="w-4 h-4 text-[#FFC107]" />
                    )}
                    <span className="absolute bottom-0 right-0 px-1 rounded-tl bg-black/80 text-[8px] font-black text-amber-300">
                      #{idx + 1}
                    </span>
                  </div>
                </div>

                {/* File Details + Individual Caption + Progress Bar */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                          item.mediaType === 'video'
                            ? 'bg-[#E50914]/25 text-red-300 border border-[#E50914]/40'
                            : 'bg-[#FFC107]/20 text-[#FFC107] border border-[#FFC107]/30'
                        }`}
                      >
                        {item.mediaType === 'video' ? 'Vídeo' : 'Foto'}
                      </span>
                      <span className="text-xs font-bold text-white truncate">
                        {item.fileName}
                      </span>
                      {item.fileSizeLabel && (
                        <span className="text-[10px] text-gray-400 shrink-0">
                          ({item.fileSizeLabel})
                        </span>
                      )}
                    </div>

                    {/* Status Badge */}
                    <span className="text-[10px] font-bold shrink-0">
                      {item.status === 'queued' && (
                        <span className="text-gray-400">Pronto</span>
                      )}
                      {item.status === 'uploading' && (
                        <span className="text-[#FFC107]">A enviar {item.progress}%</span>
                      )}
                      {item.status === 'processing' && (
                        <span className="text-orange-400">A otimizar vídeo...</span>
                      )}
                      {item.status === 'uploaded' && (
                        <span className="text-amber-300">Carregado 100%</span>
                      )}
                      {item.status === 'published' && (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Publicado</span>
                        </span>
                      )}
                      {item.status === 'error' && (
                        <span className="text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Falhou</span>
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Individual Optional Caption */}
                  {item.status !== 'published' && (
                    <input
                      type="text"
                      placeholder={
                        defaultTitle.trim()
                          ? `Legenda: ${defaultTitle.trim()}`
                          : `Legenda opcional para o Story #${idx + 1}...`
                      }
                      value={item.customTitle}
                      disabled={isRunningBatch}
                      onChange={e => updateItem(item.id, { customTitle: e.target.value })}
                      className="w-full px-2.5 py-1 rounded-lg bg-black/50 border border-white/10 text-[11px] text-gray-200 focus:outline-none focus:border-[#FFC107] placeholder:text-gray-500"
                    />
                  )}

                  {/* Per-File Progress Bar */}
                  {(item.status === 'uploading' ||
                    item.status === 'processing' ||
                    item.status === 'uploaded' ||
                    item.status === 'published') && (
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-200 ${
                          item.status === 'published'
                            ? 'bg-emerald-400'
                            : 'bg-gradient-to-r from-[#FFC107] via-[#FF6D00] to-[#E50914]'
                        }`}
                        style={{ width: `${Math.max(4, item.progress)}%` }}
                      />
                    </div>
                  )}

                  {/* Error Detail for this specific file */}
                  {item.status === 'error' && item.errorMessage && (
                    <p className="text-[11px] text-red-300 font-medium">
                      {item.errorMessage}
                    </p>
                  )}
                </div>

                {/* Remove button */}
                {!isRunningBatch && item.status !== 'published' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition cursor-pointer shrink-0"
                    title="Remover da lista"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback / Warning Banner */}
      {summaryBanner && (
        <div
          className={`p-3 rounded-2xl border text-xs font-semibold flex items-start justify-between gap-3 ${
            summaryBanner.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
              : summaryBanner.type === 'warning'
                ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                : 'bg-red-500/15 border-red-500/35 text-red-300'
          }`}
        >
          <div className="flex items-start gap-2">
            {summaryBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{summaryBanner.text}</span>
          </div>

          {failedItemsCount > 0 && !isRunningBatch && (
            <button
              type="button"
              onClick={() => processAndPublishItems(true)}
              className="px-3 py-1.5 rounded-xl bg-[#FFC107] text-black font-extrabold text-[11px] flex items-center gap-1 shrink-0 hover:brightness-110 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tentar novamente ({failedItemsCount})</span>
            </button>
          )}
        </div>
      )}

      {/* Publish Action Button */}
      <div className="flex flex-wrap items-center gap-2.5">
        {failedItemsCount > 0 && !isRunningBatch && (
          <button
            type="button"
            onClick={() => processAndPublishItems(true)}
            className="px-4 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-[#FFC107]/40 text-[#FFC107] font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reenviar Falhados ({failedItemsCount})</span>
          </button>
        )}

        <button
          type="button"
          disabled={isRunningBatch || pendingOrErrorItems.length === 0}
          onClick={() => processAndPublishItems(false)}
          className="flex-1 py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#FFC107] via-[#FF6D00] to-[#E50914] text-black font-black text-xs sm:text-sm shadow-[0_0_25px_rgba(255,193,7,0.3)] hover:brightness-110 active:scale-[0.99] transition disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
        >
          {isRunningBatch ? (
            <>
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              <span>
                A enviar e publicar Stories ({completedCount}/{items.length})...
              </span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-black" />
              <span>
                {pendingOrErrorItems.length > 1
                  ? `Publicar ${pendingOrErrorItems.length} Stories Agora (24 Horas)`
                  : 'Publicar Story Agora (24 Horas)'}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
