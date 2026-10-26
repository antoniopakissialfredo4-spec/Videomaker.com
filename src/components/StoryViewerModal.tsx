import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Trash2,
  AlertCircle,
  RefreshCw,
  Clock,
  MessageCircle,
  Send,
  CornerDownRight,
  Reply,
  User
} from 'lucide-react';
import {
  Story,
  StoryComment,
  StoryReactionType,
  STORY_REACTIONS
} from '../types';
import {
  formatLuandaDateTime,
  formatRelativeTime,
  formatRemainingTime,
  getVisitorId,
  getVisitorName
} from '../lib/visitor';
import {
  addStoryComment,
  deleteStoryComment,
  fetchStoryInteractions,
  toggleStoryReaction
} from '../lib/api';
import {
  getSafePosterUrl,
  getVideoMimeType,
  normalizeMediaUrl,
  parseVideoSource
} from '../lib/videoUtils';

export interface StoryInteractionPatch {
  reactionsCount?: number;
  reactionBreakdown?: Partial<Record<StoryReactionType, number>>;
  userReaction?: StoryReactionType | null;
  commentsCount?: number;
  comments?: StoryComment[];
}

interface FloatingParticle {
  id: string;
  emoji: string;
  leftPct: number;
  sizeClass: string;
  driftMidX: number;
  driftX: number;
  driftEndX: number;
  durationMs: number;
  delayMs: number;
}

interface StoryViewerModalProps {
  stories: Story[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onStorySeen?: (storyId: string) => void;
  isAdmin?: boolean;
  adminToken?: string;
  visitorName?: string;
  onOpenSettings?: () => void;
  onDeleteStory?: (storyId: string) => Promise<void> | void;
  onStoryInteractionChange?: (storyId: string, patch: StoryInteractionPatch) => void;
}

const PHOTO_DURATION_MS = 6500;
const YOUTUBE_FALLBACK_DURATION_MS = 18000;

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  stories,
  initialIndex,
  isOpen,
  onClose,
  onStorySeen,
  isAdmin = false,
  adminToken,
  visitorName,
  onOpenSettings,
  onDeleteStory,
  onStoryInteractionChange
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isMediaLoading, setIsMediaLoading] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // Story Reactions State
  const [reactionsCount, setReactionsCount] = useState<number>(0);
  const [reactionBreakdown, setReactionBreakdown] = useState<Partial<Record<StoryReactionType, number>>>({});
  const [userReaction, setUserReaction] = useState<StoryReactionType | null>(null);
  const [poppingReaction, setPoppingReaction] = useState<{ type: StoryReactionType; nonce: number } | null>(null);
  const [particles, setParticles] = useState<FloatingParticle[]>([]);

  // Story Comments & Replies State
  const [comments, setComments] = useState<StoryComment[]>([]);
  const [commentsCount, setCommentsCount] = useState<number>(0);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [quickCommentText, setQuickCommentText] = useState('');
  const [drawerCommentText, setDrawerCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<StoryComment | null>(null);
  const [honeypot, setHoneypot] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentFeedback, setCommentFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeBarRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const photoElapsedMsRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const waitingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartedInInteractiveZoneRef = useRef<boolean>(false);
  const drawerInputRef = useRef<HTMLInputElement | null>(null);
  const commentsScrollRef = useRef<HTMLDivElement | null>(null);
  const particleTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  // Effective pause includes manual pause, typing in input, or reading/writing in the comments drawer
  const effectivePaused = isPaused || isInputFocused || isCommentsOpen;

  // Clean up particle timers on unmount
  useEffect(() => {
    return () => {
      particleTimersRef.current.forEach(t => clearTimeout(t));
      particleTimersRef.current = [];
    };
  }, []);

  // Clamp index safely if stories array shrinks (e.g. deletion or 24h expiry)
  useEffect(() => {
    if (!isOpen) return;
    if (stories.length === 0) {
      onClose();
      return;
    }
    if (currentIndex >= stories.length) {
      setCurrentIndex(Math.max(0, stories.length - 1));
    }
  }, [stories.length, currentIndex, isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      const clamped = Math.max(0, Math.min(initialIndex, Math.max(0, stories.length - 1)));
      setCurrentIndex(clamped);
      setIsPaused(false);
      setIsCommentsOpen(false);
      setIsInputFocused(false);
      setMediaError(null);
      setRetryNonce(0);
    }
  }, [isOpen, initialIndex]);

  const currentStory = stories[currentIndex] || null;

  // Hydrate & refresh interactions from DB whenever currentStory changes
  useEffect(() => {
    if (!isOpen || !currentStory) return;

    setReactionsCount(currentStory.reactionsCount ?? 0);
    setReactionBreakdown(currentStory.reactionBreakdown ?? {});
    setUserReaction(currentStory.userReaction ?? null);
    setComments(currentStory.comments ?? []);
    setCommentsCount(currentStory.commentsCount ?? (currentStory.comments?.length ?? 0));
    setQuickCommentText('');
    setDrawerCommentText('');
    setReplyingTo(null);
    setConfirmDeleteCommentId(null);
    setCommentFeedback(null);
    setParticles([]);

    let cancelled = false;
    const visitorId = getVisitorId();

    fetchStoryInteractions(currentStory.id, visitorId)
      .then(fresh => {
        if (cancelled) return;
        setReactionsCount(fresh.reactionsCount);
        setReactionBreakdown(fresh.reactionBreakdown);
        setUserReaction(fresh.userReaction);
        setComments(fresh.comments);
        setCommentsCount(fresh.commentsCount);
        onStoryInteractionChange?.(currentStory.id, {
          reactionsCount: fresh.reactionsCount,
          reactionBreakdown: fresh.reactionBreakdown,
          userReaction: fresh.userReaction,
          commentsCount: fresh.commentsCount,
          comments: fresh.comments
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isOpen, currentStory?.id]);

  const parsedVideo = useMemo(() => {
    if (!currentStory || currentStory.type !== 'video') return null;
    return parseVideoSource(currentStory.mediaUrl, { autoPlay: true, startSeconds: 0 });
  }, [currentStory]);

  const safePoster = useMemo(() => {
    if (!currentStory) return undefined;
    if (currentStory.type === 'video') {
      return getSafePosterUrl(currentStory.thumbnailUrl, parsedVideo?.thumbnailUrl);
    }
    return normalizeMediaUrl(currentStory.mediaUrl);
  }, [currentStory, parsedVideo]);

  const directVideoUrl = useMemo(() => {
    if (!currentStory || currentStory.type !== 'video' || !parsedVideo) return '';
    if (parsedVideo.platform !== 'direct') return '';
    const base = parsedVideo.embedUrl;
    return retryNonce > 0 ? `${base}${base.includes('?') ? '&' : '?'}r=${retryNonce}` : base;
  }, [currentStory, parsedVideo, retryNonce]);

  const stopTimerLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastFrameTimeRef.current = null;
    if (waitingTimerRef.current) {
      clearTimeout(waitingTimerRef.current);
      waitingTimerRef.current = null;
    }
  }, []);

  const goNext = useCallback(() => {
    stopTimerLoop();
    setIsCommentsOpen(false);
    setIsInputFocused(false);
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, onClose, stopTimerLoop]);

  const goPrev = useCallback(() => {
    stopTimerLoop();
    setIsCommentsOpen(false);
    setIsInputFocused(false);
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else {
      photoElapsedMsRef.current = 0;
      if (activeBarRef.current) {
        activeBarRef.current.style.width = '0%';
      }
      if (videoRef.current) {
        try {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(() => {});
        } catch {}
      }
    }
  }, [currentIndex, stopTimerLoop]);

  // Mark Story as seen & preload the next Story's image/poster for instant transitions
  useEffect(() => {
    if (!isOpen || !currentStory) return;
    onStorySeen?.(currentStory.id);

    const nextStory = stories[currentIndex + 1];
    if (nextStory) {
      const preloadSrc =
        nextStory.type === 'photo'
          ? normalizeMediaUrl(nextStory.mediaUrl)
          : getSafePosterUrl(nextStory.thumbnailUrl);
      if (preloadSrc) {
        const img = new Image();
        img.src = preloadSrc;
      }
    }
  }, [isOpen, currentStory?.id, currentIndex, stories, onStorySeen]);

  // Reset progress bar & media state when switching Stories
  useEffect(() => {
    if (!isOpen || !currentStory) return;
    stopTimerLoop();
    photoElapsedMsRef.current = 0;
    setIsPaused(false);
    setMediaError(null);
    setIsMediaLoading(true);
    if (activeBarRef.current) {
      activeBarRef.current.style.width = '0%';
    }
    return stopTimerLoop;
  }, [isOpen, currentStory?.id, retryNonce, stopTimerLoop]);

  // Smooth RAF progress bar for Photo Stories & embedded YouTube Stories (zero React re-renders!)
  useEffect(() => {
    if (!isOpen || !currentStory) return;
    const isPhoto = currentStory.type === 'photo';
    const isEmbeddedVideo =
      currentStory.type === 'video' && parsedVideo && parsedVideo.platform !== 'direct';

    if (!isPhoto && !isEmbeddedVideo) return;
    if (isMediaLoading || mediaError || effectivePaused) {
      lastFrameTimeRef.current = null;
      return;
    }

    const targetDuration = isPhoto ? PHOTO_DURATION_MS : YOUTUBE_FALLBACK_DURATION_MS;

    const tick = (now: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = now;
      }
      const delta = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;
      photoElapsedMsRef.current += delta;

      const pct = Math.min(100, (photoElapsedMsRef.current / targetDuration) * 100);
      if (activeBarRef.current) {
        activeBarRef.current.style.width = `${pct}%`;
      }

      if (photoElapsedMsRef.current >= targetDuration) {
        goNext();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastFrameTimeRef.current = null;
    };
  }, [isOpen, currentStory, parsedVideo, isMediaLoading, mediaError, effectivePaused, goNext]);

  // Sync Play/Pause & Mute on HTML5 direct video
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !isOpen || currentStory?.type !== 'video') return;
    vid.muted = isMuted;
    if (effectivePaused) {
      if (!vid.paused) vid.pause();
    } else if (!mediaError && vid.paused && vid.readyState >= 2) {
      vid.play().catch(() => {});
    }
  }, [effectivePaused, isMuted, isOpen, currentStory?.type, mediaError]);

  // Keyboard navigation (Left, Right, Space, Escape) — ignores typing inside comment inputs!
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingTarget =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        e.preventDefault();
        if (isCommentsOpen) {
          setIsCommentsOpen(false);
          setReplyingTo(null);
        } else if (isTypingTarget) {
          (target as HTMLElement).blur();
        } else {
          onClose();
        }
        return;
      }

      if (isTypingTarget || isCommentsOpen) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPaused(p => !p);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, isCommentsOpen, onClose, goNext, goPrev]);

  // Spawn lightweight GPU-composited floating hearts/emojis
  const spawnFloatingEmojiBurst = useCallback((type: StoryReactionType, emoji: string) => {
    const count = type === 'heart' ? 12 : 7;
    const sizePool =
      type === 'heart'
        ? ['text-xl', 'text-2xl', 'text-3xl', 'text-4xl']
        : ['text-xl', 'text-2xl', 'text-3xl'];

    const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newItems: FloatingParticle[] = Array.from({ length: count }).map((_, i) => {
      const spread = type === 'heart' ? 14 + Math.random() * 72 : 20 + Math.random() * 60;
      const driftMid = Math.round((Math.random() - 0.5) * 44);
      const driftMain = Math.round((Math.random() - 0.5) * 68);
      const driftEnd = Math.round((Math.random() - 0.5) * 56);
      return {
        id: `${batchId}-${i}`,
        emoji,
        leftPct: spread,
        sizeClass: sizePool[i % sizePool.length],
        driftMidX: driftMid,
        driftX: driftMain,
        driftEndX: driftEnd,
        durationMs: 1150 + Math.round(Math.random() * 480),
        delayMs: i * (type === 'heart' ? 42 : 50)
      };
    });

    setParticles(prev => [...prev.slice(-16), ...newItems]);

    const cleanupTimer = setTimeout(() => {
      const idsToRemove = new Set(newItems.map(item => item.id));
      setParticles(prev => prev.filter(p => !idsToRemove.has(p.id)));
    }, 2100);
    particleTimersRef.current.push(cleanupTimer);
  }, []);

  // Handle tapping one of the 6 reaction emojis (❤️, 😂, 😮, 😢, 🔥, 👍)
  const handleSelectReaction = async (type: StoryReactionType, emoji: string) => {
    if (!currentStory) return;
    const visitorId = getVisitorId();

    const prevReaction = userReaction;
    const prevCount = reactionsCount;
    const prevBreakdown = { ...reactionBreakdown };

    const isRemoving = prevReaction === type;
    const nextReaction: StoryReactionType | null = isRemoving ? null : type;
    const nextBreakdown: Partial<Record<StoryReactionType, number>> = { ...prevBreakdown };

    if (prevReaction) {
      const dec = Math.max(0, (nextBreakdown[prevReaction] || 1) - 1);
      if (dec === 0) {
        delete nextBreakdown[prevReaction];
      } else {
        nextBreakdown[prevReaction] = dec;
      }
    }

    if (nextReaction) {
      nextBreakdown[nextReaction] = (nextBreakdown[nextReaction] || 0) + 1;
    }

    const nextCount = Object.values(nextBreakdown).reduce((sum, n) => sum + (n || 0), 0);

    // Optimistic UI update + smooth GPU animation
    setUserReaction(nextReaction);
    setReactionBreakdown(nextBreakdown);
    setReactionsCount(nextCount);
    onStoryInteractionChange?.(currentStory.id, {
      userReaction: nextReaction,
      reactionBreakdown: nextBreakdown,
      reactionsCount: nextCount
    });

    if (!isRemoving) {
      setPoppingReaction({ type, nonce: Date.now() });
      spawnFloatingEmojiBurst(type, emoji);
    }

    try {
      const res = await toggleStoryReaction(currentStory.id, visitorId, type);
      setUserReaction(res.userReaction);
      setReactionBreakdown(res.reactionBreakdown);
      setReactionsCount(res.reactionsCount);
      onStoryInteractionChange?.(currentStory.id, {
        userReaction: res.userReaction,
        reactionBreakdown: res.reactionBreakdown,
        reactionsCount: res.reactionsCount
      });
    } catch {
      // Revert on failure
      setUserReaction(prevReaction);
      setReactionBreakdown(prevBreakdown);
      setReactionsCount(prevCount);
      onStoryInteractionChange?.(currentStory.id, {
        userReaction: prevReaction,
        reactionBreakdown: prevBreakdown,
        reactionsCount: prevCount
      });
    }
  };

  // Submit a comment or reply (from either bottom quick input or slide-up drawer)
  const submitStoryComment = async (source: 'quick' | 'drawer', e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentStory || isSubmittingComment) return;

    const rawText = source === 'quick' ? quickCommentText : drawerCommentText;
    const trimmed = rawText.trim();

    if (!trimmed) {
      setCommentFeedback({ type: 'error', text: 'Escreve um comentário antes de enviar.' });
      return;
    }

    const activeAuthor = (visitorName || getVisitorName() || '').trim();

    try {
      setIsSubmittingComment(true);
      setCommentFeedback(null);

      const parentId = source === 'drawer' && replyingTo ? replyingTo.id : undefined;
      const res = await addStoryComment(currentStory.id, trimmed, parentId, {
        authorName: activeAuthor || undefined,
        visitorId: getVisitorId(),
        honeypot
      });

      const createdComment: StoryComment = {
        ...res.comment,
        ...(activeAuthor && !res.comment.authorName ? { authorName: activeAuthor } : {})
      };
      const updatedComments = [...comments, createdComment];
      setComments(updatedComments);
      setCommentsCount(res.commentsCount);

      if (source === 'quick') {
        setQuickCommentText('');
        setIsInputFocused(false);
        setIsCommentsOpen(true);
      } else {
        setDrawerCommentText('');
        setReplyingTo(null);
      }

      onStoryInteractionChange?.(currentStory.id, {
        comments: updatedComments,
        commentsCount: res.commentsCount
      });

      setCommentFeedback({ type: 'success', text: 'Comentário publicado!' });
      setTimeout(() => {
        setCommentFeedback(prev => (prev?.type === 'success' ? null : prev));
      }, 2200);

      if (!parentId) {
        requestAnimationFrame(() => {
          commentsScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
    } catch (err: any) {
      setCommentFeedback({
        type: 'error',
        text: err?.message || 'Não foi possível enviar o comentário.'
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Admin delete comment (cascades to child replies)
  const handleAdminDeleteStoryComment = async (commentId: string) => {
    if (!currentStory || !isAdmin || !adminToken || deletingCommentId) return;
    try {
      setDeletingCommentId(commentId);
      const res = await deleteStoryComment(commentId, adminToken);
      const deletedSet = new Set(res.deletedIds || [commentId]);
      const remaining = comments.filter(c => !deletedSet.has(c.id));
      setComments(remaining);
      setCommentsCount(res.commentsCount);
      setConfirmDeleteCommentId(null);
      if (replyingTo && deletedSet.has(replyingTo.id)) {
        setReplyingTo(null);
      }
      onStoryInteractionChange?.(currentStory.id, {
        comments: remaining,
        commentsCount: res.commentsCount
      });
    } catch (err: any) {
      setCommentFeedback({
        type: 'error',
        text: err?.message || 'Erro ao eliminar comentário.'
      });
    } finally {
      setDeletingCommentId(null);
    }
  };

  // Group comments into top-level threads (newest first) + chronological replies underneath each thread
  const threadedComments = useMemo(() => {
    if (comments.length === 0) return [];
    const byId = new Map<string, StoryComment>();
    comments.forEach(c => byId.set(c.id, c));

    const resolveRootId = (c: StoryComment): string => {
      let curr: StoryComment | undefined = c;
      const visited = new Set<string>();
      while (curr?.parentId && byId.has(curr.parentId) && !visited.has(curr.id)) {
        visited.add(curr.id);
        curr = byId.get(curr.parentId);
      }
      return curr ? curr.id : c.id;
    };

    const topLevel = comments
      .filter(c => !c.parentId || !byId.has(c.parentId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const repliesByRoot = new Map<string, StoryComment[]>();
    comments.forEach(c => {
      if (c.parentId && byId.has(c.parentId)) {
        const rootId = resolveRootId(c);
        const arr = repliesByRoot.get(rootId) || [];
        arr.push(c);
        repliesByRoot.set(rootId, arr);
      }
    });

    repliesByRoot.forEach(arr => {
      arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

    return topLevel.map(root => ({
      root,
      replies: repliesByRoot.get(root.id) || []
    }));
  }, [comments]);

  // Top active reaction emojis used on this Story
  const activeSummaryEmojis = useMemo(() => {
    return STORY_REACTIONS.filter(r => (reactionBreakdown[r.type] || 0) > 0)
      .sort((a, b) => (reactionBreakdown[b.type] || 0) - (reactionBreakdown[a.type] || 0))
      .slice(0, 4);
  }, [reactionBreakdown]);

  if (!isOpen || !currentStory) return null;

  const startDirectVideoPlayback = () => {
    const vid = videoRef.current;
    if (!vid || effectivePaused) return;
    vid.muted = isMuted;
    const p = vid.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        if (!vid.muted) {
          vid.muted = true;
          setIsMuted(true);
          vid.play().catch(() => {});
        }
      });
    }
  };

  const handleDeleteCurrent = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDeleteStory || isDeleting) return;
    try {
      setIsDeleting(true);
      await onDeleteStory(currentStory.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStartReply = (targetComment: StoryComment) => {
    setReplyingTo(targetComment);
    setIsCommentsOpen(true);
    setTimeout(() => {
      drawerInputRef.current?.focus();
    }, 60);
  };

  const mimeType = directVideoUrl ? getVideoMimeType(directVideoUrl) : undefined;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center select-none"
      onClick={onClose}
    >
      {/* Desktop Left Navigation Button */}
      {currentIndex > 0 && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            goPrev();
          }}
          className="hidden md:flex fixed left-6 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-neutral-900/90 hover:bg-[#FFC107] text-[#FFC107] hover:text-black border border-[#FFC107]/40 items-center justify-center shadow-2xl transition cursor-pointer"
          aria-label="Story anterior"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Desktop Right Navigation Button */}
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          goNext();
        }}
        className="hidden md:flex fixed right-6 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-neutral-900/90 hover:bg-[#FFC107] text-[#FFC107] hover:text-black border border-[#FFC107]/40 items-center justify-center shadow-2xl transition cursor-pointer"
        aria-label="Próximo Story"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Main 9:16 Story Frame */}
      <div
        onClick={e => e.stopPropagation()}
        onTouchStart={e => {
          const targetEl = e.target as HTMLElement | null;
          if (targetEl?.closest('[data-story-interactive="true"]') || isCommentsOpen) {
            touchStartedInInteractiveZoneRef.current = true;
            touchStartXRef.current = null;
            touchStartYRef.current = null;
            return;
          }
          touchStartedInInteractiveZoneRef.current = false;
          touchStartXRef.current = e.touches[0].clientX;
          touchStartYRef.current = e.touches[0].clientY;
        }}
        onTouchEnd={e => {
          if (
            touchStartedInInteractiveZoneRef.current ||
            isCommentsOpen ||
            touchStartXRef.current === null ||
            touchStartYRef.current === null
          ) {
            touchStartXRef.current = null;
            touchStartYRef.current = null;
            return;
          }
          const dx = e.changedTouches[0].clientX - touchStartXRef.current;
          const dy = e.changedTouches[0].clientY - touchStartYRef.current;
          touchStartXRef.current = null;
          touchStartYRef.current = null;

          // Horizontal swipe left/right between Stories
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
            if (dx < 0) {
              goNext();
            } else {
              goPrev();
            }
          } else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) {
            onClose();
          }
        }}
        className="relative w-full h-full sm:h-[93vh] sm:max-w-[440px] sm:rounded-3xl overflow-hidden bg-[#060608] sm:border sm:border-white/15 shadow-[0_25px_80px_rgba(0,0,0,0.95)] flex flex-col justify-between"
      >
        {/* Top Overlay: Segmented Progress Bars + Header Info */}
        <div className="absolute top-0 left-0 right-0 z-20 pt-3 px-3 pb-6 bg-gradient-to-b from-black/85 via-black/45 to-transparent">
          {/* Unlimited Segmented Progress Bars */}
          <div className="flex items-center gap-1 mb-3">
            {stories.map((st, idx) => {
              const isPast = idx < currentIndex;
              const isCurrent = idx === currentIndex;
              return (
                <div
                  key={st.id}
                  className="h-[3px] flex-1 min-w-[3px] rounded-full bg-white/25 overflow-hidden"
                >
                  {isPast ? (
                    <div className="h-full w-full bg-gradient-to-r from-[#FFC107] via-[#FF8F00] to-[#E50914]" />
                  ) : isCurrent ? (
                    <div
                      ref={activeBarRef}
                      className="h-full bg-gradient-to-r from-[#FFC107] via-[#FF8F00] to-[#E50914] w-0"
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Author / Title / Time / Controls Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-[#FFC107] via-[#FF6D00] to-[#E50914] shrink-0">
                <div className="w-full h-full rounded-full bg-[#0b0b0e] flex items-center justify-center text-[11px] font-black text-[#FFC107]">
                  FK
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-extrabold text-white truncate">
                    {currentStory.title || 'Videomaker — Fernando Kibuba'}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-[#FFC107] shrink-0">
                    {currentIndex + 1}/{stories.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-300">
                  <span>{formatRelativeTime(currentStory.createdAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-0.5 text-amber-300">
                    <Clock className="w-2.5 h-2.5" />
                    {formatRemainingTime(currentStory.expiresAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Icons */}
            <div className="flex items-center gap-1.5 shrink-0" data-story-interactive="true">
              {currentStory.type === 'video' && parsedVideo?.platform === 'direct' && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setIsMuted(m => !m);
                  }}
                  className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-[#FFC107] border border-white/15 transition cursor-pointer"
                  title={isMuted ? 'Ativar som' : 'Silenciar'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              )}

              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setIsPaused(p => !p);
                }}
                className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/15 transition cursor-pointer"
                title={effectivePaused ? 'Continuar' : 'Pausar'}
              >
                {effectivePaused ? <Play className="w-4 h-4 fill-white" /> : <Pause className="w-4 h-4" />}
              </button>

              {isAdmin && onDeleteStory && (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeleteCurrent}
                  className="p-2 rounded-full bg-red-600/80 hover:bg-red-600 text-white border border-red-400/30 transition cursor-pointer disabled:opacity-50"
                  title="Eliminar este Story"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/15 transition cursor-pointer"
                title="Fechar Stories"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Center Media Stage */}
        <div className="relative flex-1 w-full h-full flex items-center justify-center bg-black overflow-hidden">
          {currentStory.type === 'photo' ? (
            <img
              key={`${currentStory.id}-${retryNonce}`}
              src={`${normalizeMediaUrl(currentStory.mediaUrl)}${
                retryNonce > 0
                  ? `${currentStory.mediaUrl.includes('?') ? '&' : '?'}r=${retryNonce}`
                  : ''
              }`}
              alt={currentStory.title || 'Story'}
              onLoad={() => {
                setIsMediaLoading(false);
                setMediaError(null);
              }}
              onError={() => {
                setIsMediaLoading(false);
                setMediaError('Não foi possível carregar esta fotografia.');
              }}
              className="w-full h-full object-contain select-none"
              draggable={false}
            />
          ) : parsedVideo && parsedVideo.platform !== 'direct' ? (
            <iframe
              key={`${currentStory.id}-${retryNonce}`}
              src={parsedVideo.embedUrl}
              title={currentStory.title || 'Story Vídeo'}
              className="w-full h-full border-0 z-10"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={() => {
                setIsMediaLoading(false);
                setMediaError(null);
              }}
            />
          ) : (
            <video
              key={`${currentStory.id}-${retryNonce}`}
              ref={videoRef}
              src={directVideoUrl}
              poster={safePoster}
              playsInline
              // @ts-ignore
              webkit-playsinline="true"
              preload="auto"
              muted={isMuted}
              onLoadedMetadata={() => {
                startDirectVideoPlayback();
              }}
              onCanPlay={() => {
                setIsMediaLoading(false);
                setMediaError(null);
                startDirectVideoPlayback();
              }}
              onPlaying={() => {
                if (waitingTimerRef.current) {
                  clearTimeout(waitingTimerRef.current);
                  waitingTimerRef.current = null;
                }
                setIsMediaLoading(false);
                setMediaError(null);
              }}
              onWaiting={() => {
                if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current);
                waitingTimerRef.current = setTimeout(() => {
                  setIsMediaLoading(true);
                }, 400);
              }}
              onTimeUpdate={e => {
                if (waitingTimerRef.current) {
                  clearTimeout(waitingTimerRef.current);
                  waitingTimerRef.current = null;
                }
                if (isMediaLoading) setIsMediaLoading(false);
                const vid = e.currentTarget;
                if (vid.duration && isFinite(vid.duration) && vid.duration > 0 && activeBarRef.current) {
                  const pct = Math.min(100, (vid.currentTime / vid.duration) * 100);
                  activeBarRef.current.style.width = `${pct}%`;
                }
              }}
              onEnded={() => {
                if (activeBarRef.current) {
                  activeBarRef.current.style.width = '100%';
                }
                goNext();
              }}
              onError={() => {
                if (waitingTimerRef.current) {
                  clearTimeout(waitingTimerRef.current);
                  waitingTimerRef.current = null;
                }
                setIsMediaLoading(false);
                setMediaError('Não foi possível reproduzir este vídeo. Verifique a ligação e tente novamente.');
              }}
              className="w-full h-full object-contain bg-black"
            >
              {mimeType && <source src={directVideoUrl} type={mimeType} />}
            </video>
          )}

          {/* Tap Left / Right Invisible Navigation Zones */}
          {!mediaError &&
            !isCommentsOpen &&
            !(currentStory.type === 'video' && parsedVideo?.platform !== 'direct') && (
              <div className="absolute inset-0 z-10 flex">
                <div
                  onClick={e => {
                    e.stopPropagation();
                    goPrev();
                  }}
                  className="w-[32%] h-full cursor-pointer"
                  aria-label="Story anterior"
                />
                <div
                  onClick={e => {
                    e.stopPropagation();
                    goNext();
                  }}
                  className="w-[68%] h-full cursor-pointer"
                  aria-label="Próximo Story"
                />
              </div>
            )}

          {/* Muted Auto-Unmute Prompt Button */}
          {currentStory.type === 'video' &&
            parsedVideo?.platform === 'direct' &&
            isMuted &&
            !mediaError &&
            !isCommentsOpen && (
              <button
                type="button"
                data-story-interactive="true"
                onClick={e => {
                  e.stopPropagation();
                  setIsMuted(false);
                  if (videoRef.current) {
                    videoRef.current.muted = false;
                  }
                }}
                className="absolute top-20 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-black/80 border border-[#FFC107]/60 text-[#FFC107] text-xs font-extrabold flex items-center gap-2 shadow-xl hover:bg-black transition cursor-pointer"
              >
                <VolumeX className="w-4 h-4" />
                <span>Toque para ativar o som</span>
              </button>
            )}

          {/* Loading Spinner */}
          {isMediaLoading && !mediaError && (
            <div className="absolute inset-0 z-15 pointer-events-none flex flex-col items-center justify-center bg-black/30">
              <div className="w-11 h-11 rounded-full border-3 border-[#FFC107]/30 border-t-[#FFC107] animate-spin" />
            </div>
          )}

          {/* Error Recovery Card */}
          {mediaError && (
            <div className="absolute inset-0 z-25 flex items-center justify-center p-6 bg-black/90">
              <div className="max-w-xs w-full rounded-2xl bg-neutral-900 border border-red-500/40 p-5 text-center space-y-3">
                <AlertCircle className="w-9 h-9 text-red-400 mx-auto" />
                <p className="text-xs text-gray-200 leading-relaxed">{mediaError}</p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setMediaError(null);
                      setIsMediaLoading(true);
                      setRetryNonce(n => n + 1);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#FFC107] text-black font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Tentar novamente</span>
                  </button>
                  {stories.length > 1 && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        goNext();
                      }}
                      className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
                    >
                      Seguinte
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Lightweight GPU Floating Hearts & Emoji Particles Layer */}
          {particles.length > 0 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
            >
              {particles.map(p => (
                <span
                  key={p.id}
                  style={
                    {
                      left: `${p.leftPct}%`,
                      bottom: '18px',
                      '--drift-mid-x': `${p.driftMidX}px`,
                      '--drift-x': `${p.driftX}px`,
                      '--drift-end-x': `${p.driftEndX}px`,
                      '--float-duration': `${p.durationMs}ms`,
                      '--float-delay': `${p.delayMs}ms`
                    } as React.CSSProperties
                  }
                  className={`absolute select-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.65)] animate-story-float-particle ${p.sizeClass}`}
                >
                  {p.emoji}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Interactive Bar: Emoji Reactions + Counter + "Adicionar comentário…" */}
        <div
          data-story-interactive="true"
          className="relative z-20 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black via-black/95 to-black/75 border-t border-white/10 space-y-2"
        >
          {/* Summary Row: Total Reactions + View Comments Button + Mobile Prev/Next */}
          <div className="flex items-center justify-between gap-2 px-0.5 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              {activeSummaryEmojis.length > 0 && (
                <span className="inline-flex items-center -space-x-1 shrink-0">
                  {activeSummaryEmojis.map(r => (
                    <span key={r.type} className="text-sm leading-none">
                      {r.emoji}
                    </span>
                  ))}
                </span>
              )}
              <span className="text-gray-300 font-medium tabular-nums truncate">
                {reactionsCount === 0
                  ? 'Reagir ao Story'
                  : reactionsCount === 1
                    ? '1 reação'
                    : `${reactionsCount} reações`}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsCommentsOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FFC107] hover:text-amber-300 transition cursor-pointer py-1 px-2 rounded-lg hover:bg-white/5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span className="tabular-nums">
                  {commentsCount === 0
                    ? 'Comentários'
                    : commentsCount === 1
                      ? '1 comentário'
                      : `${commentsCount} comentários`}
                </span>
              </button>

              {stories.length > 1 && (
                <div className="flex md:hidden items-center gap-1">
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={currentIndex === 0}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white transition cursor-pointer"
                    aria-label="Story anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-[#FFC107]" />
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                    aria-label="Próximo Story"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-[#FFC107]" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 6 Emoji Reactions Strip (❤️ Adoro, 😂 Haha, 😮 Uau, 😢 Triste, 🔥 Fogo, 👍 Gosto) */}
          <div className="grid grid-cols-6 gap-1.5">
            {STORY_REACTIONS.map(item => {
              const isSelected = userReaction === item.type;
              const itemCount = reactionBreakdown[item.type] || 0;
              const isPopping =
                poppingReaction?.type === item.type &&
                Date.now() - poppingReaction.nonce < 600;

              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => handleSelectReaction(item.type, item.emoji)}
                  title={`${item.label} (${itemCount})`}
                  aria-label={`${item.label}${isSelected ? ' — selecionado' : ''}`}
                  aria-pressed={isSelected}
                  className={`min-h-[42px] py-1 px-1 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC107] ${
                    isSelected
                      ? 'bg-gradient-to-b from-[#FFC107]/25 to-[#FF6D00]/20 border-[#FFC107] shadow-[0_0_14px_rgba(255,193,7,0.28)]'
                      : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/10'
                  }`}
                >
                  <span
                    key={isPopping ? poppingReaction?.nonce : item.type}
                    className={`text-lg sm:text-xl leading-none select-none transition-transform duration-200 ${
                      isPopping
                        ? 'animate-story-emoji-pop'
                        : isSelected
                          ? 'scale-110'
                          : 'hover:scale-115'
                    }`}
                  >
                    {item.emoji}
                  </span>
                  <span
                    className={`text-[10px] mt-0.5 leading-none tabular-nums ${
                      isSelected
                        ? 'text-[#FFC107] font-extrabold'
                        : itemCount > 0
                          ? 'text-gray-200 font-semibold'
                          : 'text-gray-500'
                    }`}
                  >
                    {itemCount > 0 ? itemCount : item.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bottom Comment Input: "Adicionar comentário…" */}
          <form onSubmit={e => submitStoryComment('quick', e)} className="flex items-center gap-2">
            {/* Hidden anti-spam honeypot */}
            <input
              type="text"
              name="story_website_hp"
              value={honeypot}
              onChange={e => setHoneypot(e.target.value)}
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
            />

            <div className="flex-1 flex items-center gap-2 bg-[#14141a] border border-white/15 focus-within:border-[#FFC107] rounded-full pl-3.5 pr-1.5 py-1 transition-colors">
              <input
                type="text"
                value={quickCommentText}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                onChange={e => {
                  setQuickCommentText(e.target.value);
                  if (commentFeedback) setCommentFeedback(null);
                }}
                placeholder="Adicionar comentário…"
                maxLength={1000}
                disabled={isSubmittingComment}
                className="flex-1 min-w-0 bg-transparent text-white placeholder-gray-400 text-[16px] sm:text-xs py-1 focus:outline-none"
              />

              <button
                type="submit"
                disabled={isSubmittingComment || quickCommentText.trim().length === 0}
                aria-label="Enviar comentário"
                className="h-8 px-3.5 rounded-full bg-gradient-to-r from-[#FFC107] via-[#FF8F00] to-[#E50914] text-black font-extrabold text-xs flex items-center justify-center gap-1 transition active:scale-95 disabled:opacity-40 cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Enviar</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsCommentsOpen(true)}
              aria-label="Abrir painel de comentários do Story"
              title="Ver todos os comentários"
              className="relative h-10 w-10 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/15 text-[#FFC107] flex items-center justify-center transition cursor-pointer shrink-0"
            >
              <MessageCircle className="w-4 h-4" />
              {commentsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FFC107] text-black text-[10px] font-black flex items-center justify-center tabular-nums">
                  {commentsCount}
                </span>
              )}
            </button>
          </form>

          {commentFeedback && !isCommentsOpen && (
            <p
              className={`text-[11px] px-2 font-medium ${
                commentFeedback.type === 'error' ? 'text-amber-300' : 'text-emerald-400'
              }`}
            >
              {commentFeedback.text}
            </p>
          )}
        </div>

        {/* Slide-Up Story Comments & Replies Panel */}
        {isCommentsOpen && (
          <div
            data-story-interactive="true"
            className="absolute inset-0 z-40 flex flex-col justify-end bg-black/60 animate-fade-in"
            onClick={() => {
              setIsCommentsOpen(false);
              setReplyingTo(null);
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="w-full h-[76%] bg-[#0c0c10] rounded-t-3xl border-t border-[#FFC107]/35 shadow-[0_-20px_60px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="pt-2.5 pb-3 px-4 border-b border-white/10 bg-[#111117] shrink-0">
                <div
                  onClick={() => {
                    setIsCommentsOpen(false);
                    setReplyingTo(null);
                  }}
                  className="w-10 h-1 rounded-full bg-[#FFC107]/60 mx-auto mb-2.5 cursor-pointer"
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageCircle className="w-4 h-4 text-[#FFC107] shrink-0" />
                    <h3 className="text-sm font-extrabold text-white truncate">
                      Comentários do Story
                    </h3>
                    <span className="text-xs font-mono font-bold text-[#FFC107] tabular-nums">
                      ({commentsCount})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsCommentsOpen(false);
                      setReplyingTo(null);
                    }}
                    className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-gray-200 flex items-center justify-center transition cursor-pointer"
                    aria-label="Fechar comentários do Story"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Threaded Comments List */}
              <div
                ref={commentsScrollRef}
                className="flex-1 overflow-y-auto overscroll-contain touch-pan-y px-4 py-2"
              >
                {threadedComments.length === 0 ? (
                  <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-[#FFC107]/10 border border-[#FFC107]/30 flex items-center justify-center text-[#FFC107] mb-3">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-bold text-white">
                      Ainda não há comentários neste Story
                    </p>
                    <p className="text-xs text-gray-400 mt-1 max-w-xs">
                      Escreve abaixo para deixar uma mensagem ou reagir com emojis antes de expirar em 24 horas.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.08]">
                    {threadedComments.map(({ root, replies }) => {
                      const isConfirmingRootDelete = confirmDeleteCommentId === root.id;

                      return (
                        <div key={root.id} className="py-3">
                          {/* Root Comment */}
                          <div className="space-y-1">
                            <p className="text-sm text-white leading-relaxed break-words whitespace-pre-wrap">
                              {root.text}
                            </p>

                            {root.authorName && (
                              <p
                                data-testid="story-comment-author-name"
                                className="text-xs font-bold text-amber-400 inline-flex items-center gap-1"
                              >
                                <User className="w-3 h-3 text-amber-400 shrink-0" />
                                <span>{root.authorName}</span>
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-gray-400">
                              <span>{formatRelativeTime(root.createdAt)}</span>
                              <span aria-hidden="true">·</span>
                              <span>{formatLuandaDateTime(root.createdAt)}</span>

                              <button
                                type="button"
                                onClick={() => handleStartReply(root)}
                                className="inline-flex items-center gap-1 text-[#FFC107] hover:text-amber-300 font-semibold transition cursor-pointer ml-1"
                              >
                                <Reply className="w-3 h-3" />
                                <span>Responder</span>
                              </button>

                              {isAdmin && adminToken && (
                                <span className="inline-flex items-center gap-1.5 ml-1">
                                  {isConfirmingRootDelete ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={deletingCommentId === root.id}
                                        onClick={() => handleAdminDeleteStoryComment(root.id)}
                                        className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold transition cursor-pointer disabled:opacity-50"
                                      >
                                        {deletingCommentId === root.id ? 'A apagar…' : 'Confirmar'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteCommentId(null)}
                                        className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-gray-300 text-[10px] font-semibold transition cursor-pointer"
                                      >
                                        Cancelar
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteCommentId(root.id)}
                                      className="inline-flex items-center gap-1 text-red-400/85 hover:text-red-300 font-semibold transition cursor-pointer"
                                      title="Eliminar comentário inadequado"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Eliminar</span>
                                    </button>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Replies Thread */}
                          {replies.length > 0 && (
                            <div className="mt-2.5 pl-4 space-y-2.5 border-l border-white/10">
                              {replies.map(reply => {
                                const isConfirmingReplyDelete = confirmDeleteCommentId === reply.id;
                                return (
                                  <div key={reply.id} className="space-y-1">
                                    <div className="flex items-start gap-1.5">
                                      <CornerDownRight className="w-3.5 h-3.5 text-[#FFC107]/70 shrink-0 mt-1" />
                                      <div className="min-w-0 flex-1 space-y-0.5">
                                        <p className="text-[13px] text-gray-100 leading-relaxed break-words whitespace-pre-wrap">
                                          {reply.text}
                                        </p>
                                        {reply.authorName && (
                                          <p className="text-[11px] font-bold text-amber-400 inline-flex items-center gap-1">
                                            <User className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                            <span>{reply.authorName}</span>
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="pl-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-gray-400">
                                      <span>{formatRelativeTime(reply.createdAt)}</span>
                                      <span aria-hidden="true">·</span>
                                      <span>{formatLuandaDateTime(reply.createdAt)}</span>

                                      <button
                                        type="button"
                                        onClick={() => handleStartReply(reply)}
                                        className="inline-flex items-center gap-1 text-[#FFC107] hover:text-amber-300 font-semibold transition cursor-pointer ml-1"
                                      >
                                        <Reply className="w-2.5 h-2.5" />
                                        <span>Responder</span>
                                      </button>

                                      {isAdmin && adminToken && (
                                        <span className="inline-flex items-center gap-1.5 ml-1">
                                          {isConfirmingReplyDelete ? (
                                            <>
                                              <button
                                                type="button"
                                                disabled={deletingCommentId === reply.id}
                                                onClick={() => handleAdminDeleteStoryComment(reply.id)}
                                                className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold transition cursor-pointer disabled:opacity-50"
                                              >
                                                {deletingCommentId === reply.id ? 'A apagar…' : 'Confirmar'}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setConfirmDeleteCommentId(null)}
                                                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-gray-300 text-[10px] font-semibold transition cursor-pointer"
                                              >
                                                Cancelar
                                              </button>
                                            </>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => setConfirmDeleteCommentId(reply.id)}
                                              className="inline-flex items-center gap-1 text-red-400/85 hover:text-red-300 font-semibold transition cursor-pointer"
                                              title="Eliminar resposta inadequada"
                                            >
                                              <Trash2 className="w-2.5 h-2.5" />
                                              <span>Eliminar</span>
                                            </button>
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Drawer Bottom Composer (Supports Replies & Direct Comments) */}
              <form
                onSubmit={e => submitStoryComment('drawer', e)}
                className="px-3.5 pt-2.5 pb-[max(0.85rem,env(safe-area-inset-bottom))] bg-[#08080b] border-t border-white/10 shrink-0 space-y-2"
              >
                {replyingTo && (
                  <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[#FFC107]/10 border border-[#FFC107]/30 text-xs">
                    <span className="text-gray-200 truncate">
                      A responder a:{' '}
                      <span className="text-[#FFC107] font-semibold">
                        “{replyingTo.text.slice(0, 60)}
                        {replyingTo.text.length > 60 ? '…' : ''}”
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="text-gray-400 hover:text-white p-0.5 cursor-pointer shrink-0"
                      aria-label="Cancelar resposta"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {commentFeedback && (
                  <div
                    className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 ${
                      commentFeedback.type === 'error'
                        ? 'bg-red-500/15 border border-red-500/30 text-red-300'
                        : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{commentFeedback.text}</span>
                  </div>
                )}

                {(visitorName || getVisitorName()) && (
                  <div className="px-1 flex items-center justify-between text-[11px] text-gray-400">
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
                        Alterar nome
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 bg-[#15151c] border border-white/15 focus-within:border-[#FFC107] rounded-full pl-4 pr-1.5 py-1.5 transition-colors">
                  <input
                    ref={drawerInputRef}
                    type="text"
                    value={drawerCommentText}
                    onChange={e => {
                      setDrawerCommentText(e.target.value);
                      if (commentFeedback) setCommentFeedback(null);
                    }}
                    placeholder={
                      replyingTo ? 'Escrever resposta ao comentário…' : 'Adicionar comentário…'
                    }
                    maxLength={1000}
                    disabled={isSubmittingComment}
                    className="flex-1 min-w-0 bg-transparent text-white placeholder-gray-400 text-[16px] sm:text-xs focus:outline-none"
                  />

                  <button
                    type="submit"
                    disabled={isSubmittingComment || drawerCommentText.trim().length === 0}
                    className="h-9 px-4 rounded-full bg-gradient-to-r from-[#FFC107] via-[#FF8F00] to-[#E50914] text-black font-extrabold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{isSubmittingComment ? 'A enviar…' : 'Enviar'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
