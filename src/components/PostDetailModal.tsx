import React, { useState, useEffect } from 'react';
import {
  X,
  Heart,
  MessageCircle,
  Share2,
  Calendar,
  MapPin,
  Trash2,
  Check,
  Film,
  ArrowLeft
} from 'lucide-react';
import { Post } from '../types';
import { formatLuandaDate, formatRelativeTime } from '../lib/visitor';
import { UniversalVideoPlayer } from './UniversalVideoPlayer';
import { normalizeMediaUrl } from '../lib/videoUtils';

interface PostDetailModalProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
  isLiked: boolean;
  onToggleLike: (postId: string) => void;
  onOpenComments: (post: Post) => void;
  isAdmin: boolean;
  onDeletePost?: (postId: string) => void;
}

export const PostDetailModal: React.FC<PostDetailModalProps> = ({
  post,
  isOpen,
  onClose,
  isLiked,
  onToggleLike,
  onOpenComments,
  isAdmin,
  onDeletePost
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [showConfirmDeletePost, setShowConfirmDeletePost] = useState(false);

  useEffect(() => {
    setShowConfirmDeletePost(false);
  }, [post?.id, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !post) return null;

  const comments = [...(post.comments || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const commentsCount = comments.length;

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: post.title,
        text: `${post.title} — Videomaker Fernando Kibuba`,
        url
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/92 animate-fadeIn">
      {/* Background click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-5xl max-h-[92vh] bg-[#0b0b0f] rounded-3xl border border-white/15 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col md:flex-row">
        {/* Top Navigation: Back Button Left & Close Button Right */}
        <button
          onClick={onClose}
          className="absolute top-3 left-3 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/80 hover:bg-black/95 text-white border border-white/20 transition text-xs font-semibold shadow-lg group cursor-pointer"
          title="Voltar à Galeria"
        >
          <ArrowLeft className="w-4 h-4 text-[#FFC107] group-hover:-translate-x-0.5 transition-transform" />
          <span>Voltar</span>
        </button>

        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-30 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white border border-white/10 transition cursor-pointer"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Media Preview (Left / Top) */}
        <div className="w-full md:w-3/5 bg-black flex items-center justify-center relative min-h-[280px] md:min-h-[500px] max-h-[48vh] md:max-h-full overflow-hidden">
          {post.type === 'video' ? (
            <UniversalVideoPlayer
              url={post.mediaUrl}
              title={post.title}
              poster={post.thumbnailUrl}
              autoPlay={true}
              className="w-full h-full"
            />
          ) : (
            <img
              src={normalizeMediaUrl(post.mediaUrl)}
              alt={post.title}
              className="w-full h-full max-h-[70vh] object-contain"
            />
          )}

          {/* Type Badge */}
          <div className="absolute top-3 left-24 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md text-[11px] font-semibold text-white border border-white/20 shadow-md pointer-events-none">
            {post.type === 'video' ? (
              <>
                <Film className="w-3.5 h-3.5 text-[#E50914]" />
                <span className="font-bold">Vídeo HD 1080p</span>
              </>
            ) : (
              <span>Fotografia HD</span>
            )}
          </div>
        </div>

        {/* Publication Details & Comments Trigger (Right / Bottom) */}
        <div className="w-full md:w-2/5 flex flex-col justify-between max-h-[44vh] md:max-h-full overflow-hidden bg-[#0d0d11] border-t md:border-t-0 md:border-l border-white/10">
          {/* Header Info */}
          <div className="p-4 sm:p-5 overflow-y-auto flex-1">
            <div className="flex items-center gap-2 text-xs text-[#FFC107] mb-2.5">
              <span className="px-2.5 py-0.5 rounded-full bg-[#FFC107]/15 border border-[#FFC107]/35 font-bold">
                {post.category}
              </span>
              {post.activityName && (
                <span className="text-gray-300 truncate">
                  • {post.activityName}
                </span>
              )}
            </div>

            <h2 className="text-base sm:text-lg font-bold text-white leading-snug mb-2 font-heading">
              {post.title}
            </h2>

            {post.description && (
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-4 whitespace-pre-wrap">
                {post.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-gray-400 pb-4 border-b border-white/[0.08]">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#FFC107]" />
                {formatLuandaDate(post.createdAt)}
              </span>
              {post.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#FFC107]" />
                  {post.location}
                </span>
              )}
            </div>

            {/* Clean Profile-Free Comments Preview Card */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => onOpenComments(post)}
                className="w-full text-left rounded-2xl bg-[#14141a] hover:bg-[#191922] border border-white/10 hover:border-[#FFC107]/40 p-3.5 transition group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4 text-[#FFC107]" />
                    <span>Comentários</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#FFC107] text-black leading-none">
                      {commentsCount}
                    </span>
                  </span>
                  <span className="text-[11px] font-bold text-[#FFC107] group-hover:underline">
                    {commentsCount > 0 ? 'Ver todos' : 'Comentar'}
                  </span>
                </div>

                {commentsCount === 0 ? (
                  <p className="text-xs text-neutral-400">
                    Ainda não existem comentários. Toca aqui para aderir à conversa.
                  </p>
                ) : (
                  <div className="divide-y divide-white/[0.07]">
                    {comments.slice(0, 2).map((c) => (
                      <div key={c.id} className="py-2 first:pt-0 last:pb-0 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-white line-clamp-2 leading-relaxed">
                            {c.text}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            {c.authorName && (
                              <span className="text-[11px] font-bold text-amber-400">
                                {c.authorName}
                              </span>
                            )}
                            <span className="text-[10px] text-neutral-400">
                              {formatRelativeTime(c.createdAt)}
                            </span>
                          </div>
                        </div>
                        <span className="flex items-center gap-1 text-[10px] text-[#FFC107] shrink-0 pt-0.5">
                          <Heart className="w-3 h-3 text-[#FFC107]" />
                          <span>{c.likesCount ?? 0}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Bottom Action & Quick Comment Trigger Bar */}
          <div className="p-3.5 bg-[#09090c] border-t border-white/10 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* Heart Like Button */}
                <button
                  onClick={() => onToggleLike(post.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                    isLiked
                      ? 'bg-red-500/20 text-[#E50914] border border-red-500/40'
                      : 'bg-white/[0.06] text-gray-200 hover:bg-white/10'
                  }`}
                  title={isLiked ? 'Remover gosto' : 'Gostar desta publicação'}
                >
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#E50914] text-[#E50914]' : ''}`} />
                  <span>{post.likesCount}</span>
                </button>

                {/* Open Rounded Comments Panel Button */}
                <button
                  onClick={() => onOpenComments(post)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFC107]/15 hover:bg-[#FFC107]/25 text-[#FFC107] border border-[#FFC107]/35 text-xs font-extrabold transition active:scale-95 cursor-pointer"
                  title="Abrir painel de comentários"
                >
                  <MessageCircle className="w-4 h-4 text-[#FFC107]" />
                  <span>{commentsCount}</span>
                </button>

                {/* Share button */}
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/10 text-gray-200 text-xs font-semibold transition cursor-pointer"
                  title="Partilhar"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copiado!' : 'Partilhar'}</span>
                </button>
              </div>

              {/* Admin delete post action */}
              {isAdmin && onDeletePost && (
                <button
                  onClick={() => setShowConfirmDeletePost(true)}
                  className="p-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-200 border border-red-800/40 text-xs flex items-center gap-1 cursor-pointer"
                  title="Apagar esta publicação"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Apagar</span>
                </button>
              )}
            </div>

            {/* Tap-to-open "Adere à conversa…" bar */}
            <button
              type="button"
              onClick={() => onOpenComments(post)}
              className="w-full flex items-center justify-between bg-[#16161c] hover:bg-[#1c1c24] border border-white/12 hover:border-[#FFC107]/60 rounded-full pl-4 pr-2 py-1.5 transition cursor-pointer"
            >
              <span className="text-xs sm:text-sm text-neutral-400">
                Adere à conversa…
              </span>
              <span className="px-3.5 py-1 rounded-full bg-[#FFC107] text-black text-xs font-extrabold">
                Comentar
              </span>
            </button>
          </div>
        </div>

        {/* Delete Post Confirm Overlay */}
        {showConfirmDeletePost && (
          <div className="absolute inset-0 z-50 bg-black/95 flex items-center justify-center p-6 text-center">
            <div className="bg-neutral-900 border border-red-500/40 p-6 rounded-2xl max-w-sm w-full shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Apagar Publicação?</h3>
              <p className="text-xs text-gray-300 mb-6">
                Tem a certeza de que pretende apagar definitivamente &ldquo;{post.title}&rdquo;? Todos os gostos e comentários associados serão removidos.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowConfirmDeletePost(false)}
                  className="px-4 py-2 text-xs rounded-xl bg-neutral-800 text-gray-200 hover:bg-neutral-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (onDeletePost) onDeletePost(post.id);
                    onClose();
                  }}
                  className="px-4 py-2 text-xs rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 cursor-pointer"
                >
                  Confirmar Eliminação
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
