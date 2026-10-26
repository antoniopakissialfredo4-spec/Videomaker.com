import React, { useState, useEffect, useRef } from 'react';
import {
  Camera, Film, Play, Heart, MessageCircle, Share2,
  Plus, Trash2, Calendar, Check
} from 'lucide-react';
import { Post, Comment, CATEGORIES } from '../types';
import { formatLuandaDate } from '../lib/visitor';
import { parseVideoSource, getSafePosterUrl, normalizeMediaUrl } from '../lib/videoUtils';

const LazyVideoFrame: React.FC<{ src: string; poster?: string; alt: string }> = ({ src, poster, alt }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const vidRef = useRef<HTMLVideoElement | null>(null);
  const [inView, setInView] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    if (poster && !imgFailed) return;
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
          } else if (vidRef.current && !vidRef.current.paused) {
            vidRef.current.pause();
          }
        }
      },
      { rootMargin: '150px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [poster, imgFailed]);

  if (poster && !imgFailed) {
    return (
      <img
        src={poster}
        alt={alt}
        onError={() => setImgFailed(true)}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div ref={hostRef} className="w-full h-full bg-neutral-950 flex items-center justify-center">
      {inView ? (
        <video
          ref={vidRef}
          src={normalizeMediaUrl(src)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none"
          preload="metadata"
          muted
          playsInline
        />
      ) : (
        <Film className="w-8 h-8 text-white/20" />
      )}
    </div>
  );
};

interface GallerySectionProps {
  posts: Post[];
  likedPostIds: string[];
  onToggleLike: (postId: string) => void;
  onSelectPost: (post: Post) => void;
  onOpenComments: (post: Post) => void;
  isAdmin: boolean;
  onOpenCreatePost?: () => void;
  onDeletePost?: (postId: string) => void;
  theme?: 'dark' | 'light';
  onCommentAdded?: (postId: string, comment: Comment) => void;
}

export const GallerySection: React.FC<GallerySectionProps> = ({
  posts,
  likedPostIds,
  onToggleLike,
  onSelectPost,
  onOpenComments,
  isAdmin,
  onOpenCreatePost,
  onDeletePost,
  theme = 'dark'
}) => {
  const isLight = theme === 'light';

  // Publication format filter: 'all' | 'photo' | 'video'
  const [formatFilter, setFormatFilter] = useState<'all' | 'photo' | 'video'>('all');
  // Category filter
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  // Copied share state for feedback
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  // Inline admin post delete confirmation
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<string | null>(null);

  const photoCount = posts.filter(p => p.type === 'photo').length;
  const videoCount = posts.filter(p => p.type === 'video').length;

  // Filter posts based on format and category
  const filteredPosts = posts.filter(post => {
    if (formatFilter === 'photo' && post.type !== 'photo') return false;
    if (formatFilter === 'video' && post.type !== 'video') return false;
    if (selectedCategory !== 'Todos' && post.category !== selectedCategory) return false;
    return true;
  });

  const handleShare = async (e: React.MouseEvent, post: Post) => {
    e.stopPropagation();
    try {
      if (navigator.share) {
        await navigator.share({
          title: post.title,
          text: `${post.title} — Igreja Metodista Fernando Kibuba`,
          url: window.location.href
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setCopiedPostId(post.id);
        setTimeout(() => setCopiedPostId(null), 2500);
      }
    } catch {
      // User cancelled share
    }
  };

  return (
    <section id="galeria" className="relative py-12 md:py-20 border-b transition-colors overflow-hidden">
      {/* Liquid background accent */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <p className={`text-xs font-bold tracking-wider uppercase mb-2 tabular-nums ${
              isLight ? 'text-amber-700' : 'text-amber-400'
            }`}>
              Galeria Oficial · {posts.length} {posts.length === 1 ? 'publicação disponível' : 'publicações disponíveis'}
            </p>

            <h2 className={`text-2xl sm:text-4xl font-black tracking-tight ${
              isLight ? 'text-neutral-900' : 'text-white'
            }`}>
              Quadras de{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-amber-400 to-[#E50914]">
                Fotos & Vídeos
              </span>
            </h2>
            <p className={`mt-2 text-sm sm:text-base max-w-2xl ${
              isLight ? 'text-neutral-600' : 'text-gray-400'
            }`}>
              Cobertura audiovisual em alta definição (HD 1080p) de cultos, momentos de louvor, ordenações e atividades da Igreja Metodista Fernando Kibuba.
            </p>
          </div>

          {/* Quick Publish Action Button for Admins */}
          {isAdmin && onOpenCreatePost && (
            <button
              onClick={onOpenCreatePost}
              className="self-start md:self-auto inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-[#E50914] text-black font-extrabold text-sm shadow-[0_0_20px_rgba(212,175,55,0.4)] hover:shadow-[0_0_30px_rgba(212,175,55,0.6)] hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Nova Publicação</span>
            </button>
          )}
        </div>

        {/* Filter Controls: Format Selector + Category Chips */}
        <div className={`p-4 rounded-3xl border mb-10 backdrop-blur-xl ${
          isLight ? 'liquid-glass-light border-neutral-200/90' : 'liquid-glass border-white/10'
        }`}>
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Format Tabs (Todas, Fotografias, Vídeos) */}
            <div className={`inline-flex p-1 rounded-2xl border ${
              isLight ? 'bg-neutral-100/90 border-neutral-300' : 'bg-black/50 border-white/10'
            }`}>
              <button
                onClick={() => setFormatFilter('all')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  formatFilter === 'all'
                    ? 'bg-amber-400 text-black shadow-md'
                    : isLight
                      ? 'text-neutral-600 hover:text-neutral-900'
                      : 'text-gray-400 hover:text-white'
                }`}
              >
                Todas as Quadras ({posts.length})
              </button>

              <button
                onClick={() => setFormatFilter('photo')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  formatFilter === 'photo'
                    ? 'bg-amber-400 text-black shadow-md'
                    : isLight
                      ? 'text-neutral-600 hover:text-neutral-900'
                      : 'text-gray-400 hover:text-white'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Fotografias ({photoCount})</span>
              </button>

              <button
                onClick={() => setFormatFilter('video')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  formatFilter === 'video'
                    ? 'bg-amber-400 text-black shadow-md'
                    : isLight
                      ? 'text-neutral-600 hover:text-neutral-900'
                      : 'text-gray-400 hover:text-white'
                }`}
              >
                <Film className="w-3.5 h-3.5 text-[#E50914]" />
                <span>Vídeos HD 1080p ({videoCount})</span>
              </button>
            </div>

            {/* Category horizontal scrolling bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {CATEGORIES.map(cat => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-400 text-black font-extrabold shadow-sm'
                        : isLight
                          ? 'bg-white hover:bg-neutral-200 text-neutral-700 border border-neutral-200'
                          : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Empty State */}
        {filteredPosts.length === 0 && (
          <div className={`text-center py-20 px-6 rounded-3xl border ${
            isLight
              ? 'liquid-glass-light border-neutral-200/80 shadow-sm'
              : 'liquid-glass border-white/10 shadow-2xl'
          }`}>
            <div className="w-20 h-20 rounded-full bg-amber-500/10 border-2 border-dashed border-amber-400/50 flex items-center justify-center mx-auto mb-4 text-amber-500">
              <Camera className="w-10 h-10" />
            </div>
            <h3 className={`text-xl font-bold mb-2 ${isLight ? 'text-neutral-900' : 'text-white'}`}>
              {posts.length === 0
                ? 'Galeria pronta para as tuas publicações'
                : 'Nenhuma publicação encontrada para este filtro'}
            </h3>
            <p className={`text-sm max-w-md mx-auto mb-6 ${isLight ? 'text-neutral-600' : 'text-gray-400'}`}>
              {posts.length === 0
                ? 'Todas as imagens de demonstração foram limpas. Agora podes publicar as tuas fotografias e vídeos em cada quadra com simplicidade.'
                : 'Tenta escolher "Todas as Quadras" ou selecionar "Todos" nas categorias acima.'}
            </p>
            {onOpenCreatePost && (
              <button
                onClick={onOpenCreatePost}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-[#E50914] text-black font-extrabold text-sm shadow-[0_0_20px_rgba(212,175,55,0.4)] hover:brightness-110 active:scale-95 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Publicar Foto ou Vídeo</span>
              </button>
            )}
          </div>
        )}

        {/* Quadras Grid */}
        {filteredPosts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredPosts.map(post => {
              const isLiked = likedPostIds.includes(post.id);
              const commentsCount = post.comments ? post.comments.length : 0;
              const isCopied = copiedPostId === post.id;

              return (
                <article
                  key={post.id}
                  onClick={() => onSelectPost(post)}
                  className={`group rounded-3xl overflow-hidden cursor-pointer flex flex-col transition-all duration-300 ${
                    isLight ? 'liquid-glass-card-light' : 'liquid-glass-card'
                  }`}
                >
                  {/* Media Frame (Aspect 16:9 or 4:3) */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-950">
                    {post.type === 'video' ? (() => {
                      const videoInfo = parseVideoSource(post.mediaUrl);
                      const thumb = getSafePosterUrl(post.thumbnailUrl, videoInfo.thumbnailUrl);

                      return (
                        <div className="w-full h-full relative group/frame">
                          <LazyVideoFrame src={post.mediaUrl} poster={thumb} alt={post.title} />

                          {/* Play Overlay with glowing 1080p HD button */}
                          <div className="absolute inset-0 bg-black/45 group-hover:bg-black/25 transition-colors flex flex-col items-center justify-center gap-2">
                            <div className="w-14 h-14 rounded-full bg-[#E50914] text-white flex items-center justify-center shadow-[0_0_25px_rgba(229,9,20,0.6)] group-hover:scale-110 group-hover:shadow-[0_0_35px_rgba(229,9,20,0.9)] transition-all">
                              <Play className="w-6 h-6 fill-white ml-0.5" />
                            </div>
                            <span className="text-[11px] font-bold text-white bg-black/75 px-3 py-1 rounded-full backdrop-blur-md border border-white/20 shadow-md">
                              {videoInfo.platform === 'youtube'
                                ? 'Assistir em 1080p no YouTube'
                                : videoInfo.platform === 'vimeo'
                                  ? 'Assistir em 1080p no Vimeo'
                                  : 'Reproduzir em HD 1080p'}
                            </span>
                          </div>
                        </div>
                      );
                    })() : (
                      <img
                        src={normalizeMediaUrl(post.mediaUrl)}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        decoding="async"
                      />
                    )}

                    {/* Top Badges: Type & Category */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-black tracking-wider uppercase backdrop-blur-md shadow-md flex items-center gap-1.5 ${
                        post.type === 'video'
                          ? 'bg-[#E50914]/90 text-white border border-[#E50914]/40'
                          : 'bg-amber-500/90 text-black border border-amber-300/50'
                      }`}>
                        {post.type === 'video' ? (
                          <>
                            <Film className="w-3 h-3 text-white" />
                            <span>VÍDEO 1080p HD</span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-3 h-3 text-black" />
                            <span>FOTO HD</span>
                          </>
                        )}
                      </span>

                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-black/70 text-white border border-white/20 backdrop-blur-md">
                        {post.category || 'Geral'}
                      </span>
                    </div>

                    {/* Admin Delete Action */}
                    {isAdmin && onDeletePost && (
                      confirmDeletePostId === post.id ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/90 border border-red-500/40 rounded-full px-2.5 py-1 shadow-xl z-10"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeletePostId(null);
                              onDeletePost(post.id);
                            }}
                            className="text-[11px] font-bold text-red-400 hover:text-red-300 cursor-pointer"
                          >
                            Eliminar
                          </button>
                          <span className="text-white/20">|</span>
                          <button
                            type="button"
                            onClick={() => setConfirmDeletePostId(null)}
                            className="text-[11px] font-semibold text-gray-300 hover:text-white cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeletePostId(post.id);
                          }}
                          className="absolute top-3 right-3 p-2 rounded-full bg-red-600/90 text-white hover:bg-red-700 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg cursor-pointer z-10"
                          title="Eliminar como Administrador"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>

                  {/* Quadra Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Date in Luanda */}
                      <div className={`flex items-center gap-1.5 text-xs font-mono mb-2 ${
                        isLight ? 'text-neutral-500' : 'text-gray-400'
                      }`}>
                        <Calendar className="w-3.5 h-3.5 text-amber-500" />
                        <span>{formatLuandaDate(post.createdAt)}</span>
                      </div>

                      {/* Title */}
                      <h3 className={`text-base sm:text-lg font-bold leading-snug line-clamp-1 group-hover:text-amber-500 transition-colors ${
                        isLight ? 'text-neutral-900' : 'text-white'
                      }`}>
                        {post.title}
                      </h3>

                      {/* Description */}
                      {post.description && (
                        <p className={`mt-1.5 text-xs sm:text-sm line-clamp-2 leading-relaxed ${
                          isLight ? 'text-neutral-600' : 'text-gray-400'
                        }`}>
                          {post.description}
                        </p>
                      )}
                    </div>

                    {/* Bottom Interaction Bar */}
                    <div className={`mt-5 pt-3.5 border-t flex items-center justify-between text-xs font-semibold ${
                      isLight ? 'border-neutral-200/80 text-neutral-600' : 'border-white/10 text-gray-300'
                    }`}>
                      <div className="flex items-center gap-2 sm:gap-3">
                        {/* Like Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleLike(post.id);
                          }}
                          className={`flex items-center gap-1.5 py-1 px-2 rounded-lg transition cursor-pointer ${
                            isLiked
                              ? 'text-[#ED4956] bg-red-500/10'
                              : isLight
                                ? 'hover:bg-neutral-100 hover:text-neutral-900'
                                : 'hover:bg-white/10 hover:text-white'
                          }`}
                          title={isLiked ? 'Remover louvor/gosto' : 'Dar louvor/gosto'}
                        >
                          <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#ED4956]' : ''}`} />
                          <span className="font-mono text-xs">{post.likesCount}</span>
                        </button>

                        {/* Comments Count Button -> Opens Rounded Comments Panel */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenComments(post);
                          }}
                          className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg transition cursor-pointer ${
                            isLight
                              ? 'hover:bg-amber-500/15 text-neutral-700 hover:text-neutral-900'
                              : 'hover:bg-[#FFC107]/15 text-gray-200 hover:text-[#FFC107]'
                          }`}
                          title="Abrir comentários desta publicação"
                        >
                          <MessageCircle className="w-4 h-4 text-[#FFC107]" />
                          <span className="font-mono text-xs">{commentsCount}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Direct Play Action for Videos */}
                        {post.type === 'video' && (
                          <button
                            onClick={() => onSelectPost(post)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-[#E50914] text-white font-extrabold text-xs shadow-md hover:brightness-110 active:scale-95 transition cursor-pointer"
                            title="Abrir e reproduzir este vídeo"
                          >
                            <Play className="w-3.5 h-3.5 fill-white" />
                            <span>Abrir Vídeo</span>
                          </button>
                        )}

                        {/* Share Button */}
                        <button
                          onClick={(e) => handleShare(e, post)}
                          className={`flex items-center gap-1.5 py-1 px-2 rounded-lg transition cursor-pointer ${
                            isCopied
                              ? 'text-emerald-500 bg-emerald-500/10'
                              : isLight
                                ? 'hover:bg-neutral-100 hover:text-neutral-900'
                                : 'hover:bg-white/10 hover:text-white'
                          }`}
                          title="Partilhar link da publicação"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-[11px] text-emerald-500 font-bold hidden sm:inline">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="w-3.5 h-3.5" />
                              <span className="text-[11px] hidden sm:inline">Partilhar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
