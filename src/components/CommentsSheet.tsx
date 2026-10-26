import React, { useState, useEffect, useRef } from 'react';
import { X, Heart, MessageCircle, Send, Trash2, AlertCircle, ChevronUp, ChevronDown, User } from 'lucide-react';
import { Post, Comment } from '../types';
import { formatRelativeTime, getVisitorId, getVisitorName } from '../lib/visitor';
import {
  fetchComments,
  addComment,
  deleteComment,
  toggleCommentLike
} from '../lib/api';
import { parseVideoSource, getSafePosterUrl, normalizeMediaUrl } from '../lib/videoUtils';

interface CommentsSheetProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
  showPostBackdrop?: boolean;
  likedCommentIds: string[];
  onToggleCommentLikeState: (commentId: string, liked: boolean) => void;
  isAdmin: boolean;
  adminToken?: string;
  visitorName?: string;
  onOpenSettings?: () => void;
  onCommentAdded: (postId: string, comment: Comment) => void;
  onCommentDeleted: (postId: string, commentId: string) => void;
}

export const CommentsSheet: React.FC<CommentsSheetProps> = ({
  post,
  isOpen,
  onClose,
  showPostBackdrop = true,
  likedCommentIds,
  onToggleCommentLikeState,
  isAdmin,
  adminToken,
  visitorName,
  onOpenSettings,
  onCommentAdded,
  onCommentDeleted
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sheet expand / swipe gesture state
  const [isExpanded, setIsExpanded] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef<number | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sync initial comments from post and fetch freshest from DB
  useEffect(() => {
    if (!isOpen || !post) return;

    const sortedInitial = [...(post.comments || [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    setComments(sortedInitial);
    setValidationError(null);
    setConfirmDeleteId(null);
    setDragOffsetY(0);
    setIsExpanded(false);

    let cancelled = false;
    setIsLoadingComments(true);
    fetchComments(post.id)
      .then(fresh => {
        if (!cancelled) {
          const sorted = [...fresh].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setComments(sorted);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingComments(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, post?.id]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background body scroll when open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !post) return null;

  // Drag / Swipe handlers on sheet top handle & header
  const handleDragStart = (clientY: number) => {
    dragStartYRef.current = clientY;
    setIsDragging(true);
  };

  const handleDragMove = (clientY: number) => {
    if (dragStartYRef.current === null) return;
    const delta = clientY - dragStartYRef.current;
    // Allow slight upward pull and full downward pull
    if (delta < -120) {
      setDragOffsetY(-120);
    } else {
      setDragOffsetY(delta);
    }
  };

  const handleDragEnd = () => {
    if (dragStartYRef.current === null) return;
    const delta = dragOffsetY;
    dragStartYRef.current = null;
    setIsDragging(false);

    if (delta < -45) {
      // Swiped up -> expand panel
      setIsExpanded(true);
      setDragOffsetY(0);
      return;
    }

    if (delta > 105) {
      if (isExpanded) {
        // Swiped down from expanded -> snap to regular size
        setIsExpanded(false);
        setDragOffsetY(0);
      } else {
        // Swiped down from regular -> close panel
        setDragOffsetY(0);
        onClose();
      }
      return;
    }

    if (delta > 45 && isExpanded) {
      setIsExpanded(false);
    }

    setDragOffsetY(0);
  };

  // Toggle like on an individual comment
  const handleLikeComment = async (comment: Comment) => {
    const visitorId = getVisitorId();
    const currentlyLiked = likedCommentIds.includes(comment.id);
    const nextLiked = !currentlyLiked;
    const currentLikes = comment.likesCount ?? 0;
    const optimisticCount = Math.max(0, currentLikes + (nextLiked ? 1 : -1));

    // Optimistic UI update
    onToggleCommentLikeState(comment.id, nextLiked);
    setComments(prev =>
      prev.map(c => (c.id === comment.id ? { ...c, likesCount: optimisticCount } : c))
    );

    try {
      const res = await toggleCommentLike(comment.id, visitorId);
      onToggleCommentLikeState(comment.id, res.userLiked);
      setComments(prev =>
        prev.map(c => (c.id === comment.id ? { ...c, likesCount: res.likesCount } : c))
      );
    } catch {
      // Revert on network error
      onToggleCommentLikeState(comment.id, currentlyLiked);
      setComments(prev =>
        prev.map(c => (c.id === comment.id ? { ...c, likesCount: currentLikes } : c))
      );
    }
  };

  // Submit new comment associated with visitor's saved name
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commentText.trim();

    if (!trimmed) {
      setValidationError('Escreve um comentário antes de enviar.');
      inputRef.current?.focus();
      return;
    }

    const activeAuthor = (visitorName || getVisitorName() || '').trim();

    try {
      setIsSubmitting(true);
      setValidationError(null);

      const created = await addComment(post.id, trimmed, {
        authorName: activeAuthor || undefined,
        visitorId: getVisitorId(),
        honeypot
      });
      const hydrated: Comment = {
        ...created,
        ...(activeAuthor && !created.authorName ? { authorName: activeAuthor } : {}),
        likesCount: created.likesCount ?? 0
      };

      setComments(prev => [hydrated, ...prev]);
      setCommentText('');
      onCommentAdded(post.id, hydrated);

      // Scroll list smoothly to the top so user sees the new comment immediately
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } catch (err: any) {
      setValidationError(err.message || 'Não foi possível publicar o comentário.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Admin-only comment deletion
  const handleAdminDelete = async (commentId: string) => {
    if (!isAdmin || !adminToken) return;
    try {
      setDeletingId(commentId);
      await deleteComment(commentId, adminToken);
      setComments(prev => prev.filter(c => c.id !== commentId));
      setConfirmDeleteId(null);
      onCommentDeleted(post.id, commentId);
    } catch (err: any) {
      setValidationError(err.message || 'Erro ao eliminar comentário.');
    } finally {
      setDeletingId(null);
    }
  };

  const backdropThumb =
    post.type === 'video'
      ? getSafePosterUrl(post.thumbnailUrl, parseVideoSource(post.mediaUrl).thumbnailUrl)
      : normalizeMediaUrl(post.mediaUrl);

  return (
    <div
      className={`fixed inset-0 z-[65] flex flex-col justify-end sm:items-center sm:justify-end ${
        showPostBackdrop ? 'md:justify-center' : 'md:items-end md:justify-end md:pr-6 md:pb-6'
      } p-0 sm:p-4 animate-fadeIn`}
      role="dialog"
      aria-modal="true"
      aria-label={`Comentários em ${post.title}`}
    >
      {/* Lightweight Backdrop (no heavy GPU blur when video is actively playing in PostDetailModal) */}
      <div
        className={`absolute inset-0 transition-opacity ${
          showPostBackdrop ? 'bg-black/80 backdrop-blur-sm' : 'bg-black/45'
        }`}
        onClick={onClose}
      >
        {showPostBackdrop && (
          <div className="max-w-lg mx-auto pt-4 sm:pt-8 px-4 pointer-events-none select-none opacity-45">
            <div className="rounded-3xl overflow-hidden border border-white/10 bg-[#111115] shadow-2xl">
              <div className="aspect-[16/9] w-full bg-black relative overflow-hidden flex items-center justify-center">
                {backdropThumb ? (
                  <img
                    src={backdropThumb}
                    alt={post.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-neutral-950" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4">
                  <span className="inline-block px-2 py-0.5 rounded-md bg-[#FFC107] text-black text-[10px] font-black uppercase tracking-wider mb-1">
                    {post.category || 'Publicação'}
                  </span>
                  <p className="text-sm font-bold text-white truncate">{post.title}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Instagram-Inspired Dark Rounded Comments Panel */}
      <div
        style={{
          transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : dragOffsetY < 0 ? `translateY(${dragOffsetY * 0.25}px)` : undefined
        }}
        className={`relative z-10 w-full sm:max-w-lg bg-[#0d0d11] text-white rounded-t-[28px] sm:rounded-[28px] border-t sm:border border-white/12 shadow-[0_-16px_60px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden ${
          isDragging ? '' : 'transition-all duration-300 ease-out'
        } ${
          isExpanded
            ? 'h-[88dvh] sm:h-[85vh] max-h-[820px]'
            : 'h-[72dvh] sm:h-[70vh] max-h-[660px]'
        }`}
      >
        {/* Top Golden Subtle Hairline Glow */}
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#FFC107]/50 to-transparent shrink-0" />

        {/* Touch / Drag Handle & Header */}
        <div
          onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
          onTouchEnd={handleDragEnd}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            handleDragStart(e.clientY);
          }}
          onMouseMove={(e) => {
            if (isDragging) handleDragMove(e.clientY);
          }}
          onMouseUp={handleDragEnd}
          onMouseLeave={() => {
            if (isDragging) handleDragEnd();
          }}
          className="pt-2.5 pb-3 px-4 border-b border-white/[0.08] bg-[#111116] select-none cursor-grab active:cursor-grabbing shrink-0"
        >
          {/* Pill Drag Indicator */}
          <div
            onClick={() => setIsExpanded(prev => !prev)}
            className="w-11 h-1.5 rounded-full bg-[#FFC107]/55 hover:bg-[#FFC107] mx-auto mb-3 transition-colors cursor-pointer"
            title={isExpanded ? 'Reduzir painel' : 'Expandir painel'}
          />

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIsExpanded(prev => !prev)}
              className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-[#FFC107]/15 text-[#FFC107] flex items-center justify-center transition cursor-pointer"
              title={isExpanded ? 'Deslizar para baixo' : 'Expandir comentários'}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            <div className="flex flex-col items-center min-w-0">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[#FFC107]" />
                <h3 className="text-sm sm:text-base font-extrabold tracking-tight text-white">
                  Comentários
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-[#FFC107] text-black leading-none">
                  {comments.length}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 truncate max-w-[220px] sm:max-w-[280px] mt-0.5">
                {post.title}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-[#FFC107]/20 text-[#FFC107] flex items-center justify-center transition cursor-pointer"
              aria-label="Fechar comentários"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Profile-Free Comments List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto overscroll-contain touch-pan-y px-4 sm:px-5"
        >
          {isLoadingComments && comments.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-neutral-400">
              <div className="w-6 h-6 rounded-full border-2 border-[#FFC107]/30 border-t-[#FFC107] animate-spin" />
              <span className="text-xs">A carregar comentários…</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="py-16 px-4 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full bg-[#FFC107]/10 border border-[#FFC107]/30 flex items-center justify-center mb-3 text-[#FFC107]">
                <MessageCircle className="w-6 h-6" />
              </div>
              <p className="text-sm sm:text-base font-bold text-white">
                Ainda não existem comentários
              </p>
              <p className="text-xs text-neutral-400 mt-1 max-w-xs leading-relaxed">
                Sê o primeiro a partilhar a tua mensagem nesta publicação do Videomaker — Fernando Kibuba.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.08]">
              {comments.map((comment) => {
                const isCommentLiked = likedCommentIds.includes(comment.id);
                const likesCount = comment.likesCount ?? 0;
                const isConfirmingDelete = confirmDeleteId === comment.id;

                return (
                  <div
                    key={comment.id}
                    className="py-3.5 flex items-start justify-between gap-3.5 group"
                  >
                    {/* Comment Text + Chosen Visitor Name Underneath + Relative Time */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] sm:text-[15px] text-white leading-relaxed break-words whitespace-pre-wrap">
                        {comment.text}
                      </p>
                      {comment.authorName && (
                        <p
                          data-testid="comment-author-name"
                          className="mt-1 text-xs font-bold bg-gradient-to-r from-amber-300 via-orange-400 to-amber-400 bg-clip-text text-transparent inline-flex items-center gap-1"
                        >
                          <User className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>{comment.authorName}</span>
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-3">
                        <span className="text-[11px] sm:text-xs text-neutral-400 font-medium">
                          {formatRelativeTime(comment.createdAt)}
                        </span>

                        {likesCount > 0 && (
                          <span className="text-[11px] text-[#FFC107]/90 font-semibold">
                            {likesCount === 1 ? '1 gosto' : `${likesCount} gostos`}
                          </span>
                        )}

                        {/* Admin-Only Moderation Controls */}
                        {isAdmin && adminToken && (
                          <div className="flex items-center gap-1.5">
                            {isConfirmingDelete ? (
                              <>
                                <button
                                  type="button"
                                  disabled={deletingId === comment.id}
                                  onClick={() => handleAdminDelete(comment.id)}
                                  className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold transition cursor-pointer disabled:opacity-50"
                                >
                                  {deletingId === comment.id ? 'A apagar…' : 'Confirmar'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-neutral-300 text-[10px] font-semibold transition cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(comment.id)}
                                className="inline-flex items-center gap-1 text-[11px] text-red-400/80 hover:text-red-300 transition cursor-pointer"
                                title="Eliminar comentário inadequado (Administrador)"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Eliminar</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Heart Like Button + Count */}
                    <button
                      type="button"
                      onClick={() => handleLikeComment(comment)}
                      aria-label={isCommentLiked ? 'Retirar gosto do comentário' : 'Gostar do comentário'}
                      className="flex flex-col items-center justify-center min-w-[36px] py-1 px-1.5 rounded-xl hover:bg-white/[0.04] active:scale-90 transition cursor-pointer shrink-0"
                    >
                      <Heart
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isCommentLiked
                            ? 'fill-[#FFC107] text-[#FFC107] scale-110'
                            : 'text-[#FFC107]/75 hover:text-[#FFC107]'
                        }`}
                      />
                      <span
                        className={`text-[11px] mt-1 font-mono leading-none ${
                          isCommentLiked ? 'text-[#FFC107] font-bold' : 'text-neutral-400'
                        }`}
                      >
                        {likesCount}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Composer Bar: "Adere à conversa…" + Golden-Yellow (#FFC107) Send Button */}
        <form
          onSubmit={handleSubmit}
          className="px-3.5 sm:px-4 pt-2.5 pb-[max(0.85rem,env(safe-area-inset-bottom))] bg-[#09090c] border-t border-white/[0.09] shrink-0"
        >
          {/* Hidden anti-spam honeypot */}
          <input
            type="text"
            name="company_website"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
          />

          {validationError && (
            <div className="mb-2 px-3 py-1.5 rounded-xl bg-[#FFC107]/10 border border-[#FFC107]/30 text-[#FFC107] text-xs flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {(visitorName || getVisitorName()) && (
            <div className="mb-2 px-1 flex items-center justify-between text-[11px] text-neutral-400">
              <span className="truncate">
                A comentar como{' '}
                <strong className="text-amber-400 font-bold">
                  {visitorName || getVisitorName()}
                </strong>
              </span>
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 cursor-pointer shrink-0 ml-2"
                >
                  Alterar nas definições
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 bg-[#16161c] border border-white/12 focus-within:border-[#FFC107] rounded-full pl-4 pr-1.5 py-1.5 transition-colors">
            <input
              ref={inputRef}
              type="text"
              value={commentText}
              onChange={(e) => {
                setCommentText(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="Adere à conversa…"
              maxLength={1500}
              disabled={isSubmitting}
              className="flex-1 min-w-0 bg-transparent text-white placeholder-neutral-400 text-[16px] sm:text-sm focus:outline-none"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              aria-label="Enviar comentário"
              className={`h-9 px-4 rounded-full bg-[#FFC107] hover:bg-[#ffca2c] active:scale-95 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 transition shadow-[0_0_16px_rgba(255,193,7,0.28)] cursor-pointer shrink-0 disabled:opacity-50 ${
                commentText.trim().length === 0 ? 'opacity-85' : 'opacity-100'
              }`}
            >
              <Send className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isSubmitting ? 'A enviar…' : 'Enviar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
