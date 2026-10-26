import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Play,
  Sparkles,
  Camera
} from 'lucide-react';
import { Story } from '../types';
import { formatRelativeTime } from '../lib/visitor';
import { getSafePosterUrl, normalizeMediaUrl, parseVideoSource } from '../lib/videoUtils';

interface StoriesSectionProps {
  stories: Story[];
  seenStoryIds: string[];
  onOpenStoryAtIndex: (index: number) => void;
  isAdmin: boolean;
  onOpenPublishStories?: () => void;
  theme?: 'dark' | 'light';
}

const StoryCircleThumb: React.FC<{ story: Story }> = ({ story }) => {
  const [imgFailed, setImgFailed] = useState(false);

  const thumbSrc =
    story.type === 'video'
      ? getSafePosterUrl(story.thumbnailUrl, parseVideoSource(story.mediaUrl).thumbnailUrl)
      : normalizeMediaUrl(story.mediaUrl);

  if (thumbSrc && !imgFailed) {
    return (
      <img
        src={thumbSrc}
        alt={story.title || 'Story'}
        onError={() => setImgFailed(true)}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 select-none"
      />
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-neutral-900 via-[#16120c] to-[#1f0a0a] flex items-center justify-center">
      {story.type === 'video' ? (
        <Play className="w-6 h-6 text-[#FFC107] fill-[#FFC107]" />
      ) : (
        <Camera className="w-6 h-6 text-[#FFC107]" />
      )}
    </div>
  );
};

export const StoriesSection: React.FC<StoriesSectionProps> = ({
  stories,
  seenStoryIds,
  onOpenStoryAtIndex,
  isAdmin,
  onOpenPublishStories,
  theme = 'dark'
}) => {
  const isLight = theme === 'light';
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Mouse drag support on desktop alongside native touch swipe on mobile
  const isDraggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);

  const updateScrollArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateScrollArrows();
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener('scroll', updateScrollArrows, { passive: true });
    window.addEventListener('resize', updateScrollArrows);
    const t = setTimeout(updateScrollArrows, 120);
    return () => {
      clearTimeout(t);
      el.removeEventListener('scroll', updateScrollArrows);
      window.removeEventListener('resize', updateScrollArrows);
    };
  }, [stories.length, updateScrollArrows]);

  const scrollHorizontal = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = Math.max(260, Math.round(el.clientWidth * 0.72));
    el.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth'
    });
  };

  const hasActiveStories = stories.length > 0;

  return (
    <section
      id="stories"
      className={`relative border-b transition-colors ${
        isLight
          ? 'bg-white/90 border-neutral-200'
          : 'bg-[#09090c]/95 border-white/[0.08]'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        {/* Compact Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gradient-to-r from-[#FFC107] to-[#E50914] animate-pulse" />
            <h2
              className={`text-xs sm:text-sm font-black uppercase tracking-wider ${
                isLight ? 'text-neutral-900' : 'text-white'
              }`}
            >
              Stories • 24 Horas
            </h2>
            {stories.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-[#FFC107] via-[#FF6D00] to-[#E50914] text-black shadow-sm">
                {stories.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && onOpenPublishStories && (
              <button
                type="button"
                onClick={onOpenPublishStories}
                className="px-3 py-1 rounded-full bg-[#FFC107]/15 hover:bg-[#FFC107]/25 border border-[#FFC107]/40 text-[#FFC107] text-[11px] font-extrabold flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Publicar Vários Stories</span>
              </button>
            )}
            {stories.length > 4 && (
              <span className={`hidden sm:inline text-[11px] ${isLight ? 'text-neutral-500' : 'text-gray-400'}`}>
                Deslize para o lado para ver todos
              </span>
            )}
          </div>
        </div>

        {/* Horizontal Scrollable Instagram-Style Circles Row */}
        <div className="relative group/bar">
          {/* Left Scroll Arrow */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollHorizontal('left')}
              className="flex absolute left-0 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/85 hover:bg-[#FFC107] text-[#FFC107] hover:text-black border border-[#FFC107]/40 items-center justify-center shadow-xl transition cursor-pointer"
              aria-label="Deslizar Stories para a esquerda"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Right Scroll Arrow */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollHorizontal('right')}
              className="flex absolute right-0 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/85 hover:bg-[#FFC107] text-[#FFC107] hover:text-black border border-[#FFC107]/40 items-center justify-center shadow-xl transition cursor-pointer"
              aria-label="Deslizar Stories para a direita"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          <div
            ref={scrollRef}
            onMouseDown={e => {
              const el = scrollRef.current;
              if (!el) return;
              isDraggingRef.current = true;
              dragMovedRef.current = false;
              startXRef.current = e.pageX - el.offsetLeft;
              startScrollLeftRef.current = el.scrollLeft;
            }}
            onMouseMove={e => {
              const el = scrollRef.current;
              if (!isDraggingRef.current || !el) return;
              const x = e.pageX - el.offsetLeft;
              const walk = x - startXRef.current;
              if (Math.abs(walk) > 6) {
                dragMovedRef.current = true;
                el.scrollLeft = startScrollLeftRef.current - walk;
              }
            }}
            onMouseUp={() => {
              isDraggingRef.current = false;
            }}
            onMouseLeave={() => {
              isDraggingRef.current = false;
            }}
            className="flex items-start gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x py-1 px-0.5"
          >
            {/* Admin "+ Novo Story" Circle */}
            {isAdmin && onOpenPublishStories && (
              <button
                type="button"
                onClick={() => {
                  if (dragMovedRef.current) return;
                  onOpenPublishStories();
                }}
                className="flex flex-col items-center gap-1.5 shrink-0 w-[74px] sm:w-[82px] group cursor-pointer focus:outline-none"
              >
                <div className="relative p-[3px] rounded-full bg-gradient-to-tr from-[#FFC107] via-[#FF6D00] to-[#E50914] shadow-[0_0_16px_rgba(255,193,7,0.28)] group-hover:scale-105 transition-transform">
                  <div
                    className={`w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full p-[2.5px] ${
                      isLight ? 'bg-white' : 'bg-[#09090c]'
                    }`}
                  >
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-[#19150b] to-[#1d0c0c] border border-[#FFC107]/30 flex items-center justify-center text-[#FFC107]">
                      <Plus className="w-7 h-7 stroke-[2.5]" />
                    </div>
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-[#FFC107] text-black flex items-center justify-center border-2 border-[#09090c] shadow">
                    <Sparkles className="w-3 h-3" />
                  </span>
                </div>
                <span
                  className={`text-[11px] font-extrabold truncate w-full text-center ${
                    isLight ? 'text-neutral-800' : 'text-[#FFC107]'
                  }`}
                >
                  Adicionar
                </span>
              </button>
            )}

            {/* All Active Stories Circles (Unlimited — 10, 20, 50+) */}
            {stories.map((story, idx) => {
              const isSeen = seenStoryIds.includes(story.id);
              const label =
                story.title && story.title !== 'Story' && story.title !== 'Story da Igreja'
                  ? story.title
                  : formatRelativeTime(story.createdAt);

              return (
                <button
                  key={story.id}
                  type="button"
                  onClick={() => {
                    if (dragMovedRef.current) return;
                    onOpenStoryAtIndex(idx);
                  }}
                  className="flex flex-col items-center gap-1.5 shrink-0 w-[74px] sm:w-[82px] group cursor-pointer focus:outline-none"
                  title={`${story.title || 'Story'} (${formatRelativeTime(story.createdAt)})`}
                >
                  {/* Instagram-Style Gradient Ring (Yellow -> Orange -> Red) */}
                  <div
                    className={`relative p-[3px] rounded-full transition-transform duration-200 group-hover:scale-105 ${
                      isSeen
                        ? isLight
                          ? 'bg-neutral-300'
                          : 'bg-gradient-to-tr from-amber-500/40 via-orange-500/35 to-red-500/35'
                        : 'bg-gradient-to-tr from-[#FFC107] via-[#FF6D00] to-[#E50914] shadow-[0_0_18px_rgba(255,109,0,0.35)]'
                    }`}
                  >
                    <div
                      className={`w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full p-[2.5px] ${
                        isLight ? 'bg-white' : 'bg-[#09090c]'
                      }`}
                    >
                      <div className="w-full h-full rounded-full overflow-hidden bg-neutral-950 relative">
                        <StoryCircleThumb story={story} />
                      </div>
                    </div>

                    {/* Video Story Indicator Badge */}
                    {story.type === 'video' && (
                      <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-gradient-to-tr from-[#FF6D00] to-[#E50914] text-white flex items-center justify-center border-2 border-[#09090c] shadow">
                        <Play className="w-2.5 h-2.5 fill-white ml-0.5" />
                      </span>
                    )}
                  </div>

                  {/* Circle Caption / Time */}
                  <span
                    className={`text-[11px] font-semibold truncate w-full text-center ${
                      isSeen
                        ? isLight
                          ? 'text-neutral-500'
                          : 'text-gray-400'
                        : isLight
                          ? 'text-neutral-900 font-bold'
                          : 'text-white font-bold'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}

            {/* Helpful message when there are 0 active Stories in the last 24h */}
            {!hasActiveStories && (
              <div className="flex items-center gap-3 min-h-[72px] pl-1 text-xs text-gray-400">
                {!isAdmin && (
                  <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-[#FFC107]/40 via-[#FF6D00]/30 to-[#E50914]/30 shrink-0">
                    <div
                      className={`w-full h-full rounded-full flex items-center justify-center ${
                        isLight ? 'bg-neutral-100 text-amber-600' : 'bg-[#111116] text-[#FFC107]/70'
                      }`}
                    >
                      <Sparkles className="w-5 h-5" />
                    </div>
                  </div>
                )}
                <span>
                  {isAdmin ? (
                    <>
                      Toque em <strong className="text-[#FFC107] mx-0.5">Adicionar</strong> para publicar várias fotos e vídeos nos Stories (24h), sem limite de quantidade.
                    </>
                  ) : (
                    'Sem Stories ativos nas últimas 24 horas.'
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
