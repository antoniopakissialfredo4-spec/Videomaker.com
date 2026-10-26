import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Film,
  VolumeX
} from 'lucide-react';
import {
  parseVideoSource,
  getSafePosterUrl,
  getVideoMimeType,
  detectInitialVideoQuality,
  DEFAULT_VIDEO_START_SECONDS
} from '../lib/videoUtils';

interface UniversalVideoPlayerProps {
  url: string;
  title?: string;
  autoPlay?: boolean;
  poster?: string;
  startAtSeconds?: number;
  className?: string;
}

const UniversalVideoPlayerInner: React.FC<UniversalVideoPlayerProps> = ({
  url,
  title = 'Vídeo — Videomaker Fernando Kibuba',
  autoPlay = true,
  poster,
  startAtSeconds = DEFAULT_VIDEO_START_SECONDS,
  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ytIframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [hasError, setHasError] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string>(
    'Não foi possível carregar este vídeo. Verifique a sua ligação à Internet e tente novamente.'
  );
  const [retryCount, setRetryCount] = useState(0);
  const [useMobileFallback, setUseMobileFallback] = useState(false);
  const [isPreparing, setIsPreparing] = useState<boolean>(Boolean(autoPlay));
  const [autoMutedByBrowser, setAutoMutedByBrowser] = useState(false);

  // Refs to coordinate metadata, single initial seek, and playback with zero React re-renders during playback
  const initialSeekDoneRef = useRef<boolean>(false);
  const waitingForInitialSeekRef = useRef<boolean>(false);
  const pendingAutoPlayRef = useRef<boolean>(Boolean(autoPlay));
  const resumePositionRef = useRef<number | null>(null);
  const waitingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse video metadata once per URL/autoPlay change
  const videoInfo = useMemo(
    () => parseVideoSource(url, { autoPlay, startSeconds: startAtSeconds }),
    [url, autoPlay, startAtSeconds]
  );

  const normalizedPrimaryUrl = videoInfo.platform === 'direct' ? videoInfo.embedUrl : url;
  const safePoster = useMemo(
    () => getSafePosterUrl(poster, videoInfo.thumbnailUrl),
    [poster, videoInfo.thumbnailUrl]
  );

  // Choose initial stream ONCE synchronously before mount (never swap mid-playback!)
  const initialPrefer480p = useMemo(() => {
    if (!normalizedPrimaryUrl.includes('_1080p.mp4')) return false;
    const netQuality = detectInitialVideoQuality();
    return netQuality === '480p';
  }, [normalizedPrimaryUrl]);

  const baseVideoUrl = useMemo(() => {
    if (normalizedPrimaryUrl.includes('_1080p.mp4') && (useMobileFallback || initialPrefer480p)) {
      return normalizedPrimaryUrl.replace('_1080p.mp4', '_480p.mp4');
    }
    return normalizedPrimaryUrl;
  }, [normalizedPrimaryUrl, useMobileFallback, initialPrefer480p]);

  const stableVideoSrc = useMemo(() => {
    if (retryCount === 0) return baseVideoUrl;
    return `${baseVideoUrl}${baseVideoUrl.includes('?') ? '&' : '?'}retry=${retryCount}`;
  }, [baseVideoUrl, retryCount]);

  const clearTimers = useCallback(() => {
    if (waitingTimerRef.current) {
      clearTimeout(waitingTimerRef.current);
      waitingTimerRef.current = null;
    }
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    if (seekFallbackTimerRef.current) {
      clearTimeout(seekFallbackTimerRef.current);
      seekFallbackTimerRef.current = null;
    }
  }, []);

  // Reset state ONLY when the source video URL itself changes
  useEffect(() => {
    clearTimers();
    setHasError(false);
    setRetryCount(0);
    setUseMobileFallback(false);
    setIsPreparing(Boolean(autoPlay));
    setAutoMutedByBrowser(false);

    initialSeekDoneRef.current = false;
    waitingForInitialSeekRef.current = false;
    pendingAutoPlayRef.current = Boolean(autoPlay);
    resumePositionRef.current = null;

    return clearTimers;
  }, [normalizedPrimaryUrl, autoPlay, clearTimers]);

  // Check browser format compatibility for unusual containers (e.g. unsupported MOV codecs on older browsers)
  useEffect(() => {
    if (videoInfo.platform !== 'direct' || !stableVideoSrc) return;
    const v = videoRef.current;
    if (!v) return;
    const mime = getVideoMimeType(stableVideoSrc);
    if (mime === 'video/quicktime') {
      const canPlayMov = v.canPlayType('video/quicktime') || v.canPlayType('video/mp4');
      if (!canPlayMov) {
        setIsPreparing(false);
        setErrorDetail('Este navegador não suporta diretamente o formato MOV. Utilize um vídeo MP4 (H.264) ou WebM.');
        setHasError(true);
      }
    }
  }, [videoInfo.platform, stableVideoSrc]);

  // Helper to start playback gracefully on Android, iOS, and Desktop
  const startPlaybackSafely = useCallback(async (v: HTMLVideoElement) => {
    try {
      await v.play();
      setIsPreparing(false);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        // Mobile browsers block unmuted autoplay -> fallback to muted playback so video starts immediately
        try {
          v.muted = true;
          setAutoMutedByBrowser(true);
          await v.play();
          setIsPreparing(false);
        } catch {
          // Strict Data Saver / autoplay disabled -> hide spinner so visitor can tap native Play button directly
          setIsPreparing(false);
        }
      } else if (err?.name !== 'AbortError') {
        setIsPreparing(false);
      }
    }
  }, []);

  // Timeout guard ONLY for dead/unreachable initial metadata (never interrupts playing videos!)
  useEffect(() => {
    if (!isPreparing || hasError || videoInfo.platform !== 'direct') return;
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);

    loadTimeoutRef.current = setTimeout(() => {
      const v = videoRef.current;
      if (v && v.readyState >= 2) {
        setIsPreparing(false);
        return;
      }
      setIsPreparing(false);
      if (!v || v.readyState === 0) {
        setErrorDetail(
          'A ligação está muito lenta ou o vídeo demorou a responder. Toque em "Tentar Novamente".'
        );
        setHasError(true);
      }
    }, 15000);

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
  }, [isPreparing, hasError, videoInfo.platform]);

  // Pause HTML5 video automatically when scrolled out of viewport or when browser tab is hidden
  useEffect(() => {
    if (videoInfo.platform !== 'direct') return;
    const container = containerRef.current;
    if (!container) return;

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) {
              const v = videoRef.current;
              if (v && !v.paused) {
                v.pause();
              }
            }
          }
        },
        { threshold: 0.15 }
      );
      observer.observe(container);
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        const v = videoRef.current;
        if (v && !v.paused) {
          v.pause();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      if (observer) observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [videoInfo.platform]);

  // YouTube IFrame API helper: if a YouTube video is shorter than 60s, start at 0:00
  useEffect(() => {
    if (videoInfo.platform !== 'youtube' || startAtSeconds <= 0) return;

    let checkedShortDuration = false;
    const handleYtMessage = (event: MessageEvent) => {
      if (checkedShortDuration) return;
      if (typeof event.origin === 'string' && !event.origin.includes('youtube')) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        const ytDuration = data?.info?.duration;
        if (typeof ytDuration === 'number' && ytDuration > 0) {
          checkedShortDuration = true;
          if (ytDuration < startAtSeconds && ytIframeRef.current?.contentWindow) {
            ytIframeRef.current.contentWindow.postMessage(
              JSON.stringify({ event: 'command', func: 'seekTo', args: [0, true] }),
              '*'
            );
          }
        }
      } catch {
        // Ignore unrelated postMessage events
      }
    };

    window.addEventListener('message', handleYtMessage);
    return () => window.removeEventListener('message', handleYtMessage);
  }, [videoInfo.platform, videoInfo.videoId, startAtSeconds]);

  const computeStartOffset = useCallback(
    (videoDuration: number): number => {
      if (!startAtSeconds || startAtSeconds <= 0) return 0;
      if (!isFinite(videoDuration) || isNaN(videoDuration) || videoDuration < startAtSeconds) {
        return 0;
      }
      if (videoDuration <= startAtSeconds + 0.3) {
        return Math.max(0, videoDuration - 0.5);
      }
      return startAtSeconds;
    },
    [startAtSeconds]
  );

  const handleUnmuteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    if (v.volume === 0) v.volume = 1;
    setAutoMutedByBrowser(false);
  };

  const handleRetry = () => {
    const v = videoRef.current;
    if (v && v.currentTime > 0) {
      resumePositionRef.current = v.currentTime;
    }
    pendingAutoPlayRef.current = true;
    setHasError(false);
    setIsPreparing(true);
    setRetryCount(prev => prev + 1);
  };

  // 1. Official YouTube Embedded Player
  if (videoInfo.platform === 'youtube') {
    return (
      <div className={`relative w-full h-full min-h-[280px] md:min-h-[460px] bg-black flex items-center justify-center overflow-hidden ${className}`}>
        <iframe
          ref={ytIframeRef}
          src={videoInfo.embedUrl}
          title={title}
          onLoad={() => {
            try {
              ytIframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ event: 'listening' }),
                '*'
              );
            } catch {}
          }}
          className="w-full h-full border-0 absolute inset-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
        <a
          href={videoInfo.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-3 right-14 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/80 hover:bg-red-600 text-white text-[11px] font-bold border border-white/20 shadow-lg transition"
          title="Assistir diretamente no YouTube"
        >
          <Film className="w-3.5 h-3.5 text-red-500 fill-current" />
          <span>YouTube</span>
          <ExternalLink className="w-3 h-3 ml-0.5" />
        </a>
      </div>
    );
  }

  // 2. Vimeo Embedded Player
  if (videoInfo.platform === 'vimeo') {
    return (
      <div className={`relative w-full h-full min-h-[280px] md:min-h-[460px] bg-black flex items-center justify-center overflow-hidden ${className}`}>
        <iframe
          src={videoInfo.embedUrl}
          title={title}
          className="w-full h-full border-0 absolute inset-0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  // 3. Google Drive / Dailymotion / Streamable Embedded Players
  if (
    videoInfo.platform === 'drive' ||
    videoInfo.platform === 'dailymotion' ||
    videoInfo.platform === 'streamable'
  ) {
    return (
      <div className={`relative w-full h-full min-h-[280px] md:min-h-[460px] bg-black flex items-center justify-center overflow-hidden ${className}`}>
        <iframe
          src={videoInfo.embedUrl}
          title={title}
          className="w-full h-full border-0 absolute inset-0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  // 4. Native Hardware-Accelerated HTML5 Video Player (MP4, MOV, WebM)
  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[280px] md:min-h-[460px] bg-black flex items-center justify-center overflow-hidden ${className}`}
    >
      {!hasError ? (
        <>
          <video
            ref={videoRef}
            src={stableVideoSrc}
            controls
            playsInline
            preload="metadata"
            poster={safePoster}
            onLoadStart={() => {
              if (pendingAutoPlayRef.current) {
                setIsPreparing(true);
              }
            }}
            onLoadedMetadata={() => {
              const v = videoRef.current;
              if (!v) return;

              // Determine initial position once without double-seeking
              let targetSeek = 0;
              if (resumePositionRef.current !== null) {
                targetSeek =
                  isFinite(v.duration) && v.duration > 0
                    ? Math.min(resumePositionRef.current, Math.max(0, v.duration - 0.3))
                    : resumePositionRef.current;
                resumePositionRef.current = null;
                initialSeekDoneRef.current = true;
              } else if (!initialSeekDoneRef.current) {
                initialSeekDoneRef.current = true;
                targetSeek = computeStartOffset(v.duration);
              }

              if (targetSeek > 0) {
                waitingForInitialSeekRef.current = pendingAutoPlayRef.current;
                try {
                  v.currentTime = targetSeek;
                } catch {
                  waitingForInitialSeekRef.current = false;
                }

                if (waitingForInitialSeekRef.current) {
                  // Safety fallback in case browser already positioned at targetSeek without firing 'seeked'
                  if (seekFallbackTimerRef.current) clearTimeout(seekFallbackTimerRef.current);
                  seekFallbackTimerRef.current = setTimeout(() => {
                    if (waitingForInitialSeekRef.current && videoRef.current) {
                      waitingForInitialSeekRef.current = false;
                      pendingAutoPlayRef.current = false;
                      startPlaybackSafely(videoRef.current);
                    }
                  }, 450);
                } else {
                  setIsPreparing(false);
                }
              } else if (pendingAutoPlayRef.current) {
                pendingAutoPlayRef.current = false;
                startPlaybackSafely(v);
              } else {
                setIsPreparing(false);
              }
            }}
            onLoadedData={() => {
              if (!waitingForInitialSeekRef.current && !pendingAutoPlayRef.current) {
                setIsPreparing(false);
              }
            }}
            onCanPlay={() => {
              if (waitingTimerRef.current) {
                clearTimeout(waitingTimerRef.current);
                waitingTimerRef.current = null;
              }
              if (!waitingForInitialSeekRef.current) {
                setIsPreparing(false);
              }
            }}
            onSeeked={() => {
              if (seekFallbackTimerRef.current) {
                clearTimeout(seekFallbackTimerRef.current);
                seekFallbackTimerRef.current = null;
              }
              if (waitingForInitialSeekRef.current && videoRef.current) {
                waitingForInitialSeekRef.current = false;
                pendingAutoPlayRef.current = false;
                startPlaybackSafely(videoRef.current);
              } else {
                setIsPreparing(false);
              }
            }}
            onPlay={() => {
              // If autoplay was blocked or disabled and metadata wasn't ready until user tapped Play
              const v = videoRef.current;
              if (v && !initialSeekDoneRef.current && isFinite(v.duration) && v.duration > 0) {
                initialSeekDoneRef.current = true;
                const offset = computeStartOffset(v.duration);
                if (offset > 0 && v.currentTime < 1) {
                  try {
                    v.currentTime = offset;
                  } catch {}
                }
              }
            }}
            onPlaying={() => {
              if (waitingTimerRef.current) {
                clearTimeout(waitingTimerRef.current);
                waitingTimerRef.current = null;
              }
              setIsPreparing(false);
            }}
            onVolumeChange={() => {
              const v = videoRef.current;
              if (v && !v.muted && autoMutedByBrowser) {
                setAutoMutedByBrowser(false);
              }
            }}
            onWaiting={() => {
              // Debounce transient mobile network micro-waits so the UI never flickers or interrupts playback
              if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current);
              waitingTimerRef.current = setTimeout(() => {
                const v = videoRef.current;
                if (v && !v.paused && v.readyState < 3) {
                  setIsPreparing(true);
                }
              }, 700);
            }}
            onPause={() => {
              if (waitingTimerRef.current) {
                clearTimeout(waitingTimerRef.current);
                waitingTimerRef.current = null;
              }
              if (!waitingForInitialSeekRef.current) {
                setIsPreparing(false);
              }
            }}
            onEnded={() => {
              if (waitingTimerRef.current) {
                clearTimeout(waitingTimerRef.current);
                waitingTimerRef.current = null;
              }
              setIsPreparing(false);
            }}
            onError={() => {
              clearTimers();
              // If slow mobile connection opted for _480p.mp4 before it existed, seamlessly fall back to primary _1080p.mp4
              if ((initialPrefer480p || useMobileFallback) && baseVideoUrl.includes('_480p.mp4') && retryCount === 0) {
                setUseMobileFallback(false);
                if (videoRef.current) {
                  videoRef.current.src = normalizedPrimaryUrl;
                  videoRef.current.load();
                }
                return;
              }
              // Conversely, if primary _1080p.mp4 had a network failure, try lighter _480p.mp4 once if uploaded
              if (!useMobileFallback && !initialPrefer480p && normalizedPrimaryUrl.includes('_1080p.mp4')) {
                setUseMobileFallback(true);
                return;
              }

              setIsPreparing(false);
              const mediaErr = videoRef.current?.error;
              if (mediaErr?.code === 2) {
                setErrorDetail('Falha de rede durante o carregamento do vídeo. Verifique a sua ligação e tente novamente.');
              } else if (mediaErr?.code === 3) {
                setErrorDetail('Ocorreu um problema ao descodificar o vídeo neste telemóvel ou navegador.');
              } else if (mediaErr?.code === 4) {
                setErrorDetail('O ficheiro de vídeo não está acessível ou o formato não é suportado por este navegador.');
              } else {
                setErrorDetail('Não foi possível reproduzir o vídeo de momento. Toque em "Tentar Novamente".');
              }
              setHasError(true);
            }}
            className="w-full h-full max-h-[75vh] object-contain bg-black"
          />

          {/* Compact Corner Unmute Button when Mobile Autoplay started Muted (never blocks controls) */}
          {autoMutedByBrowser && (
            <button
              type="button"
              onClick={handleUnmuteClick}
              className="absolute top-12 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFC107] text-black text-xs font-extrabold shadow-lg hover:brightness-105 active:scale-95 transition cursor-pointer"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>Ativar som</span>
            </button>
          )}

          {/* Non-blocking Preparing / Buffering Indicator (pointer-events-none so player is never blocked) */}
          {isPreparing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 pointer-events-none z-10">
              <div className="w-10 h-10 border-3 border-[#FFC107] border-t-transparent rounded-full animate-spin" />
              <span className="mt-2 px-2.5 py-0.5 rounded-full bg-black/75 text-[11px] font-semibold text-white/95">
                A preparar vídeo…
              </span>
            </div>
          )}
        </>
      ) : (
        /* Clear Error Screen with Retry Button */
        <div className="text-center p-6 max-w-md mx-auto text-white z-20">
          <div className="w-14 h-14 rounded-full bg-red-500/15 text-[#FFC107] border border-[#FFC107]/40 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h4 className="text-base font-extrabold mb-1.5">Erro ao reproduzir o vídeo</h4>
          <p className="text-xs text-gray-300 mb-5 leading-relaxed">
            {errorDetail}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={handleRetry}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#FFC107] hover:bg-[#ffca2c] text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Tentar Novamente</span>
            </button>
            <a
              href={normalizedPrimaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#FFC107]" />
              <span>Abrir Link Direto</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export const UniversalVideoPlayer = React.memo(UniversalVideoPlayerInner);
