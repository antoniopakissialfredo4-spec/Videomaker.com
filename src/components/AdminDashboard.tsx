import React, { useState, useEffect, useRef } from 'react';
import {
  X, LogOut, Plus, Trash2, Camera, Film, Calendar,
  MessageSquare, Mail, CheckCircle2, AlertCircle, Upload,
  Clock, Sparkles, RefreshCw, Layers, Shield, AlertTriangle, Eye,
  BarChart3, Settings, Heart, TrendingUp, HardDrive,
  ArrowRight, ArrowLeft, ChevronRight, Play
} from 'lucide-react';
import { Post, Story, StoryComment, Activity, Comment, ContactMessage, CATEGORIES, AdminStats } from '../types';
import {
  createPost, deletePost,
  createStory, deleteStory, fetchAdminAllStories,
  createActivity, deleteActivity,
  fetchAdminAllComments, deleteComment,
  fetchAdminStoryComments, deleteStoryComment,
  fetchAdminMessages, deleteAdminMessage,
  fetchAdminStats,
  clearAllData, uploadMediaFile, uploadMediaFileDetailed,
  ApiClientError
} from '../lib/api';
import { formatLuandaDate, formatLuandaDateTime, formatRemainingTime, formatRelativeTime } from '../lib/visitor';
import { UniversalVideoPlayer } from './UniversalVideoPlayer';
import { StoryBatchPublisher } from './StoryBatchPublisher';
import { StoryViewerModal } from './StoryViewerModal';
import { parseVideoSource, isVideoSource, normalizeMediaUrl, getSafePosterUrl } from '../lib/videoUtils';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  adminEmail: string;
  onLogout: () => void;
  onDataChanged: () => void;
  posts: Post[];
  activities: Activity[];
}

type BoardType = 'all' | 'posts' | 'stories' | 'activities' | 'comments' | 'stats' | 'settings' | 'others';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isOpen,
  onClose,
  token,
  adminEmail,
  onLogout,
  onDataChanged,
  posts,
  activities
}) => {
  // Current active board view
  const [selectedBoard, setSelectedBoard] = useState<BoardType>('all');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const boardTitles: Record<string, string> = {
    all: 'Todos os Quadros',
    posts: 'Publicações (Fotos & Vídeos)',
    stories: 'Stories (24 Horas)',
    activities: 'Atividades & Agenda da Igreja',
    comments: 'Comentários dos Fiéis',
    stats: 'Estatísticas & Métricas',
    settings: 'Definições & Gestão do Sistema',
    others: 'Comentários & Limpeza'
  };

  const handleEnterBoard = (board: BoardType) => {
    setSelectedBoard(board);
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 40);
  };

  // Stories, comments, messages, stats loaded via admin routes
  const [adminStories, setAdminStories] = useState<Story[]>([]);
  const [adminComments, setAdminComments] = useState<Comment[]>([]);
  const [adminStoryComments, setAdminStoryComments] = useState<StoryComment[]>([]);
  const [adminMessages, setAdminMessages] = useState<ContactMessage[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Clear all confirmation modal
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Admin Video Viewer Modal (starts at 01:00 if video >= 1m, else 00:00)
  const [adminVideoPreview, setAdminVideoPreview] = useState<{
    title: string;
    url: string;
    poster?: string;
  } | null>(null);

  // Admin Individual Story Viewer Modal index
  const [adminStoryViewerIndex, setAdminStoryViewerIndex] = useState<number | null>(null);

  // ==========================================
  // QUADRO 1: PUBLICAÇÕES (Fotos & Vídeos) Form
  // ==========================================
  const [postType, setPostType] = useState<'photo' | 'video'>('photo');
  const [postTitle, setPostTitle] = useState('');
  const [postDescription, setPostDescription] = useState('');
  const [postMediaUrl, setPostMediaUrl] = useState('');
  const [postThumbnailUrl, setPostThumbnailUrl] = useState('');
  const [postCategory, setPostCategory] = useState<string>('Cultos');
  const [postIsUploading, setPostIsUploading] = useState(false);
  const postFileRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // QUADRO 2: STORIES (24 Horas) Form
  // ==========================================
  const [storyTitle, setStoryTitle] = useState('');
  const [storyType, setStoryType] = useState<'photo' | 'video'>('photo');
  const [storyMediaUrl, setStoryMediaUrl] = useState('');
  const [storyIsUploading, setStoryIsUploading] = useState(false);
  const storyFileRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // QUADRO 3: ATIVIDADES Form
  // ==========================================
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDate, setActivityDate] = useState('');
  const [activityTime, setActivityTime] = useState('10:00');
  const [activityLocation, setActivityLocation] = useState('Igreja Metodista Fernando Kibuba, Luanda');
  const [activityPosterUrl, setActivityPosterUrl] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [activityIsUploading, setActivityIsUploading] = useState(false);
  const activityFileRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [storiesData, commentsData, storyCommentsData, messagesData, statsData] = await Promise.all([
        fetchAdminAllStories(token),
        fetchAdminAllComments(token),
        fetchAdminStoryComments(token),
        fetchAdminMessages(token),
        fetchAdminStats(token)
      ]);
      setAdminStories(storiesData);
      setAdminComments(commentsData);
      setAdminStoryComments(storyCommentsData);
      setAdminMessages(messagesData);
      if (statsData) {
        setStats(statsData);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError && (err.status === 401 || err.status === 403)) {
        onLogout();
        return;
      }
      console.error('Failed to load admin dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, token, posts]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Upload helper
  const handleFileUpload = async (
    file: File,
    type: 'post' | 'story' | 'activity'
  ) => {
    try {
      if (type === 'post') setPostIsUploading(true);
      if (type === 'story') setStoryIsUploading(true);
      if (type === 'activity') setActivityIsUploading(true);

      const res = await uploadMediaFileDetailed(file, token);

      if (type === 'post') {
        setPostMediaUrl(res.url);
        if (res.thumbnailUrl) {
          setPostThumbnailUrl(res.thumbnailUrl);
        }
        setPostType(file.type.startsWith('video/') ? 'video' : 'photo');
      } else if (type === 'story') {
        setStoryMediaUrl(res.url);
        setStoryType(file.type.startsWith('video/') ? 'video' : 'photo');
      } else if (type === 'activity') {
        setActivityPosterUrl(res.url);
      }

      showNotification('success', 'Ficheiro processado e otimizado com sucesso!');
    } catch (err: any) {
      showNotification('error', err.message || 'Erro ao carregar ficheiro.');
    } finally {
      setPostIsUploading(false);
      setStoryIsUploading(false);
      setActivityIsUploading(false);
    }
  };

  // Submit Quadro 1: Publicação
  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim() || !postMediaUrl.trim()) {
      showNotification('error', 'Por favor indique o título e adicione uma foto ou vídeo.');
      return;
    }

    try {
      setIsLoading(true);
      const cleanUrl = normalizeMediaUrl(postMediaUrl.trim());
      const detectedIsVideo = postType === 'video' || isVideoSource(cleanUrl);
      const videoInfo = detectedIsVideo ? parseVideoSource(cleanUrl) : null;

      await createPost({
        title: postTitle.trim(),
        description: postDescription.trim(),
        type: detectedIsVideo ? 'video' : 'photo',
        mediaUrl: cleanUrl,
        thumbnailUrl: postThumbnailUrl ? normalizeMediaUrl(postThumbnailUrl) : (videoInfo?.thumbnailUrl || undefined),
        category: postCategory,
        location: 'Igreja Metodista Fernando Kibuba, Luanda'
      }, token);

      // Reset
      setPostTitle('');
      setPostDescription('');
      setPostMediaUrl('');
      setPostThumbnailUrl('');
      if (postFileRef.current) postFileRef.current.value = '';

      showNotification('success', 'Publicação com vídeo/fotografia colocada no ar com sucesso!');
      onDataChanged();
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Erro ao criar publicação.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Quadro 2: Story
  const handlePublishStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storyMediaUrl.trim()) {
      showNotification('error', 'Por favor escolha uma foto ou vídeo para o Story.');
      return;
    }

    try {
      setIsLoading(true);
      await createStory({
        title: storyTitle.trim() || 'Story da Igreja',
        type: storyType,
        mediaUrl: normalizeMediaUrl(storyMediaUrl.trim())
      }, token);

      // Reset
      setStoryTitle('');
      setStoryMediaUrl('');
      if (storyFileRef.current) storyFileRef.current.value = '';

      showNotification('success', 'Story de 24 horas publicado com sucesso!');
      onDataChanged();
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Erro ao criar story.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Quadro 3: Atividade
  const handlePublishActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityTitle.trim() || !activityDate) {
      showNotification('error', 'Por favor indique o nome do evento e a data.');
      return;
    }

    try {
      setIsLoading(true);
      await createActivity({
        title: activityTitle.trim(),
        description: activityDescription.trim(),
        date: activityDate,
        time: activityTime || '10:00',
        location: activityLocation.trim() || 'Igreja Metodista Fernando Kibuba, Luanda',
        posterUrl: activityPosterUrl.trim()
          ? normalizeMediaUrl(activityPosterUrl.trim())
          : 'https://images.unsplash.com/photo-1548625361-195fe57871b6?auto=format&fit=crop&w=800&q=80'
      }, token);

      // Reset
      setActivityTitle('');
      setActivityDate('');
      setActivityDescription('');
      setActivityPosterUrl('');
      if (activityFileRef.current) activityFileRef.current.value = '';

      showNotification('success', 'Atividade agendada com sucesso!');
      onDataChanged();
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Erro ao criar atividade.');
    } finally {
      setIsLoading(false);
    }
  };

  // Deletions
  const handleDeletePost = async (postId: string) => {
    if (!confirm('Tem a certeza que deseja eliminar esta publicação?')) return;
    try {
      await deletePost(postId, token);
      showNotification('success', 'Publicação eliminada com sucesso!');
      onDataChanged();
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Erro ao eliminar publicação.');
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    try {
      await deleteStory(storyId, token);
      setAdminStories(prev => prev.filter(s => s.id !== storyId));
      showNotification('success', 'Story eliminado com sucesso!');
      onDataChanged();
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Erro ao eliminar story.');
    }
  };

  const handleDeleteActivity = async (actId: string) => {
    if (!confirm('Eliminar esta atividade?')) return;
    try {
      await deleteActivity(actId, token);
      showNotification('success', 'Atividade eliminada com sucesso!');
      onDataChanged();
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Erro ao eliminar atividade.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(commentId, token);
      setAdminComments(prev => prev.filter(c => c.id !== commentId));
      setStats(prev => prev ? { ...prev, totalComments: Math.max(0, prev.totalComments - 1) } : prev);
      showNotification('success', 'Comentário removido com sucesso.');
      onDataChanged();
    } catch (err: any) {
      showNotification('error', err.message || 'Erro ao eliminar comentário.');
    }
  };

  const handleDeleteStoryCommentAdmin = async (commentId: string) => {
    try {
      const res = await deleteStoryComment(commentId, token);
      const deletedSet = new Set(res.deletedIds || [commentId]);
      setAdminStoryComments(prev => prev.filter(c => !deletedSet.has(c.id)));
      setAdminStories(prev =>
        prev.map(s =>
          s.id === res.storyId
            ? {
                ...s,
                commentsCount: res.commentsCount,
                comments: (s.comments || []).filter(c => !deletedSet.has(c.id))
              }
            : s
        )
      );
      showNotification('success', 'Comentário do Story removido com sucesso.');
      onDataChanged();
    } catch (err: any) {
      showNotification('error', err.message || 'Erro ao eliminar comentário do Story.');
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    try {
      await deleteAdminMessage(msgId, token);
      setAdminMessages(prev => prev.filter(m => m.id !== msgId));
      showNotification('success', 'Mensagem removida.');
    } catch (err: any) {
      showNotification('error', err.message || 'Erro ao apagar mensagem.');
    }
  };

  // Clear all images & posts (clean slate)
  const handleClearAllData = async () => {
    try {
      setIsClearingAll(true);
      const res = await clearAllData(token);
      showNotification('success', res.message || 'Todas as imagens foram eliminadas. O site está pronto para novas publicações!');
      setIsClearAllModalOpen(false);
      onDataChanged();
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Erro ao limpar dados.');
    } finally {
      setIsClearingAll(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0f0f12] text-white border border-white/10 shadow-2xl overflow-hidden my-auto animate-scale-up">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-[#E50914] flex items-center justify-center shadow-md">
              <Shield className="w-5 h-5 text-black font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  Painel de Administração — Fernando Kibuba
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-black uppercase">
                  ADM
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Postagem simples dividida em quadros · {adminEmail}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition cursor-pointer"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onLogout}
              className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Terminar Sessão"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition cursor-pointer"
              title="Fechar painel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Board Selection Navigation Tabs */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-6 py-3 border-b border-white/5 bg-neutral-900/60 overflow-x-auto no-scrollbar">
          <button
            onClick={() => handleEnterBoard('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              selectedBoard === 'all'
                ? 'bg-amber-400 text-black shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Todos os Quadros</span>
          </button>

          <button
            onClick={() => handleEnterBoard('posts')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              selectedBoard === 'posts'
                ? 'bg-amber-400 text-black shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Publicações ({posts.length})</span>
          </button>

          <button
            onClick={() => handleEnterBoard('stories')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              selectedBoard === 'stories'
                ? 'bg-amber-400 text-black shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span>Stories ({adminStories.length})</span>
          </button>

          <button
            onClick={() => handleEnterBoard('activities')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              selectedBoard === 'activities'
                ? 'bg-amber-400 text-black shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span>Atividades ({activities.length})</span>
          </button>

          <button
            onClick={() => handleEnterBoard('comments')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              selectedBoard === 'comments'
                ? 'bg-amber-400 text-black shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>Comentários ({adminComments.length + adminStoryComments.length})</span>
          </button>

          <button
            onClick={() => handleEnterBoard('stats')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              selectedBoard === 'stats'
                ? 'bg-amber-400 text-black shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span>Estatísticas ({stats?.totalViews ?? 0})</span>
          </button>

          <button
            onClick={() => handleEnterBoard('settings')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              selectedBoard === 'settings'
                ? 'bg-amber-400 text-black shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-gray-300'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-gray-300" />
            <span>Definições</span>
          </button>
        </div>

        {/* Global Feedback Banner */}
        {feedback && (
          <div className={`mx-6 mt-4 p-3 rounded-2xl flex items-center gap-2.5 text-xs font-semibold animate-scale-up ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/15 border border-red-500/30 text-red-400'
          }`}>
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Main Content Area with "Vários Quadros" Layout */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 scroll-smooth">

          {/* ========================================================
              CARTÕES DO PAINEL ADM COM ETIQUETAS AMARELAS NO CANTO SUPERIOR DIREITO
              ======================================================== */}
          {selectedBoard === 'all' ? (
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-amber-400 tracking-wider uppercase flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span>Cartões de Gestão — Fernando Kibuba</span>
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Tu apertas no cartão e entras diretamente no respetivo quadro de gestão.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Cartão 1: Publicações */}
                <button
                  type="button"
                  onClick={() => handleEnterBoard('posts')}
                  className="relative text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer group flex flex-col justify-between bg-[#121215] hover:bg-[#1a1a20] border-white/10 hover:border-amber-400 shadow-md hover:shadow-amber-400/10 hover:-translate-y-0.5"
                >
                  {/* Etiqueta Amarela no Canto Superior Direito */}
                  <span className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400 text-black shadow-md tracking-tight leading-none">
                    {posts.length}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-110 group-hover:bg-amber-400 group-hover:text-black transition-all">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-white group-hover:text-amber-400 transition-colors">
                      Publicações
                    </h4>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">
                      Total no Feed
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-black text-amber-400 group-hover:text-black group-hover:bg-amber-400 rounded-lg px-2 py-1 transition-all mt-3 pt-1 border-t border-white/10">
                    <span>Aperte e entra</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* Cartão 2: Stories */}
                <button
                  type="button"
                  onClick={() => handleEnterBoard('stories')}
                  className="relative text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer group flex flex-col justify-between bg-[#121215] hover:bg-[#1a1a20] border-white/10 hover:border-amber-400 shadow-md hover:shadow-amber-400/10 hover:-translate-y-0.5"
                >
                  {/* Etiqueta Amarela no Canto Superior Direito */}
                  <span className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400 text-black shadow-md tracking-tight leading-none">
                    {adminStories.length}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400 mb-3 group-hover:scale-110 group-hover:bg-amber-400 group-hover:text-black transition-all">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-white group-hover:text-amber-400 transition-colors">
                      Stories
                    </h4>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">
                      Ativos 24 Horas
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-black text-amber-400 group-hover:text-black group-hover:bg-amber-400 rounded-lg px-2 py-1 transition-all mt-3 pt-1 border-t border-white/10">
                    <span>Aperte e entra</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* Cartão 3: Atividades */}
                <button
                  type="button"
                  onClick={() => handleEnterBoard('activities')}
                  className="relative text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer group flex flex-col justify-between bg-[#121215] hover:bg-[#1a1a20] border-white/10 hover:border-amber-400 shadow-md hover:shadow-amber-400/10 hover:-translate-y-0.5"
                >
                  {/* Etiqueta Amarela no Canto Superior Direito */}
                  <span className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400 text-black shadow-md tracking-tight leading-none">
                    {activities.length}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3 group-hover:scale-110 group-hover:bg-amber-400 group-hover:text-black transition-all">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-white group-hover:text-amber-400 transition-colors">
                      Atividades
                    </h4>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">
                      Cultos e Agenda
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-black text-amber-400 group-hover:text-black group-hover:bg-amber-400 rounded-lg px-2 py-1 transition-all mt-3 pt-1 border-t border-white/10">
                    <span>Aperte e entra</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* Cartão 4: Comentários */}
                <button
                  type="button"
                  onClick={() => handleEnterBoard('comments')}
                  className="relative text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer group flex flex-col justify-between bg-[#121215] hover:bg-[#1a1a20] border-white/10 hover:border-amber-400 shadow-md hover:shadow-amber-400/10 hover:-translate-y-0.5"
                >
                  {/* Etiqueta Amarela no Canto Superior Direito */}
                  <span className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400 text-black shadow-md tracking-tight leading-none">
                    {adminComments.length + adminStoryComments.length}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-110 group-hover:bg-amber-400 group-hover:text-black transition-all">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-white group-hover:text-amber-400 transition-colors">
                      Comentários
                    </h4>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">
                      Recebidos no site
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-black text-amber-400 group-hover:text-black group-hover:bg-amber-400 rounded-lg px-2 py-1 transition-all mt-3 pt-1 border-t border-white/10">
                    <span>Aperte e entra</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* Cartão 5: Estatísticas */}
                <button
                  type="button"
                  onClick={() => handleEnterBoard('stats')}
                  className="relative text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer group flex flex-col justify-between bg-[#121215] hover:bg-[#1a1a20] border-white/10 hover:border-amber-400 shadow-md hover:shadow-amber-400/10 hover:-translate-y-0.5"
                >
                  {/* Etiqueta Amarela no Canto Superior Direito */}
                  <span className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400 text-black shadow-md tracking-tight leading-none">
                    {stats?.totalViews ?? 0}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-110 group-hover:bg-amber-400 group-hover:text-black transition-all">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-white group-hover:text-amber-400 transition-colors">
                      Estatísticas
                    </h4>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">
                      Visualizações totais
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-black text-amber-400 group-hover:text-black group-hover:bg-amber-400 rounded-lg px-2 py-1 transition-all mt-3 pt-1 border-t border-white/10">
                    <span>Aperte e entra</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* Cartão 6: Definições (SEM CONTADOR conforme instrução) */}
                <button
                  type="button"
                  onClick={() => handleEnterBoard('settings')}
                  className="relative text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer group flex flex-col justify-between bg-[#121215] hover:bg-[#1a1a20] border-white/10 hover:border-amber-400 shadow-md hover:shadow-amber-400/10 hover:-translate-y-0.5"
                >
                  {/* O cartão Definições NÃO precisa de contador */}
                  <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-white/10 flex items-center justify-center text-gray-300 mb-3 group-hover:scale-110 group-hover:bg-amber-400 group-hover:text-black transition-all">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-white group-hover:text-amber-400 transition-colors">
                      Definições
                    </h4>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">
                      Ajustes e Reset
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-black text-amber-400 group-hover:text-black group-hover:bg-amber-400 rounded-lg px-2 py-1 transition-all mt-3 pt-1 border-t border-white/10">
                    <span>Aperte e entra</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              </div>
            </div>
          ) : (
            /* Entered Dedicated Board Header Banner with Instant Switcher */
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-neutral-900/90 border border-amber-400/30 shadow-xl backdrop-blur-md animate-scale-up">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleEnterBoard('all')}
                  className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
                  title="Voltar a todos os cartões do painel"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar aos Cartões</span>
                </button>
                <ChevronRight className="w-4 h-4 text-gray-500" />
                <span className="text-xs sm:text-sm font-black text-amber-400 uppercase tracking-wider">
                  {boardTitles[selectedBoard]}
                </span>
              </div>

              {/* Quick Jump Switcher */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => handleEnterBoard('posts')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    selectedBoard === 'posts' ? 'bg-amber-400 text-black font-black shadow-md' : 'bg-white/5 hover:bg-white/10 text-gray-300'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Publicações ({posts.length})</span>
                </button>
                <button
                  onClick={() => handleEnterBoard('stories')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    selectedBoard === 'stories' ? 'bg-amber-400 text-black font-black shadow-md' : 'bg-white/5 hover:bg-white/10 text-gray-300'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Stories ({adminStories.length})</span>
                </button>
                <button
                  onClick={() => handleEnterBoard('activities')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    selectedBoard === 'activities' ? 'bg-amber-400 text-black font-black shadow-md' : 'bg-white/5 hover:bg-white/10 text-gray-300'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Atividades ({activities.length})</span>
                </button>
                <button
                  onClick={() => handleEnterBoard('comments')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    selectedBoard === 'comments' ? 'bg-amber-400 text-black font-black shadow-md' : 'bg-white/5 hover:bg-white/10 text-gray-300'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Comentários ({adminComments.length})</span>
                </button>
                <button
                  onClick={() => handleEnterBoard('stats')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    selectedBoard === 'stats' ? 'bg-amber-400 text-black font-black shadow-md' : 'bg-white/5 hover:bg-white/10 text-gray-300'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Estatísticas ({stats?.totalViews ?? 0})</span>
                </button>
                <button
                  onClick={() => handleEnterBoard('settings')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    selectedBoard === 'settings' ? 'bg-amber-400 text-black font-black shadow-md' : 'bg-white/5 hover:bg-white/10 text-gray-300'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Definições</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              QUADRO 1: PUBLICAÇÕES (Fotos & Vídeos para o Feed / Grelha)
              ======================================================== */}
          {(selectedBoard === 'all' || selectedBoard === 'posts') && (
            <div className="rounded-3xl border border-white/10 bg-neutral-900/40 p-5 sm:p-6 backdrop-blur-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-5 border-b border-white/10">
                <div>
                  <h3 className="text-base sm:text-lg font-black flex items-center gap-2 text-white">
                    <span className="p-1.5 rounded-lg bg-amber-400 text-black">
                      <Camera className="w-4 h-4" />
                    </span>
                    <span>Quadro 1: Publicações (Fotos & Vídeos)</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Posta fotografias e vídeos em alta resolução diretamente na Grelha e no Feed.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-400/10 border border-amber-400/30 text-amber-300">
                    {posts.length} no ar
                  </span>
                </div>
              </div>

              {/* Form de Postagem Simples de Publicação */}
              <form onSubmit={handlePublishPost} className="mb-6 p-4 rounded-2xl bg-black/40 border border-white/5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tipo: Foto ou Vídeo */}
                  <div>
                    <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                      Tipo de Conteúdo
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPostType('photo')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          postType === 'photo'
                            ? 'bg-amber-400 text-black shadow-md'
                            : 'bg-neutral-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Fotografia</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPostType('video')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          postType === 'video'
                            ? 'bg-amber-400 text-black shadow-md'
                            : 'bg-neutral-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        <Film className="w-3.5 h-3.5" />
                        <span>Vídeo HD 1080p</span>
                      </button>
                    </div>
                  </div>

                  {/* Categoria */}
                  <div>
                    <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                      Categoria
                    </label>
                    <select
                      value={postCategory}
                      onChange={(e) => setPostCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Título da Publicação */}
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                    Título da Publicação *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Culto de Celebração de Domingo • Luanda"
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-white/10 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Ficheiro Multimédia (Upload ou URL) */}
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                    Ficheiro de Imagem ou Vídeo *
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={postFileRef}
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'post');
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => postFileRef.current?.click()}
                        disabled={postIsUploading}
                        className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white flex items-center gap-1.5 transition border border-white/10 cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-amber-400" />
                        <span>{postIsUploading ? 'A Carregar...' : 'Carregar do Computador / Telemóvel'}</span>
                      </button>
                      <span className="text-xs text-gray-500">ou insere o link abaixo:</span>
                    </div>

                    <input
                      type="text"
                      placeholder="Ex: https://www.youtube.com/watch?v=... ou uploads/video.mp4 ou link direto"
                      value={postMediaUrl}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPostMediaUrl(val);
                        if (isVideoSource(val)) {
                          setPostType('video');
                        }
                      }}
                      onBlur={() => setPostMediaUrl(prev => normalizeMediaUrl(prev))}
                      className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400 placeholder:text-gray-500"
                    />

                    <div className="flex items-center gap-1.5 text-[11px] text-amber-400/90 font-medium pt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span>Suporta qualquer vídeo: YouTube, Vimeo, Google Drive, MP4, MOV, WebM ou upload direto.</span>
                    </div>

                    {postMediaUrl && (
                      <div className="mt-3 p-3 rounded-2xl bg-neutral-900/80 border border-white/10">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Pré-visualização do Conteúdo ({postType === 'video' ? 'Vídeo HD 1080p' : 'Fotografia'})</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setPostMediaUrl('')}
                            className="px-2 py-0.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-semibold flex items-center gap-1 transition"
                          >
                            <X className="w-3 h-3" />
                            <span>Remover</span>
                          </button>
                        </div>

                        {postType === 'video' ? (
                          <div className="w-full rounded-xl overflow-hidden border border-white/10 bg-black aspect-video max-h-60">
                            <UniversalVideoPlayer
                              url={postMediaUrl}
                              title={postTitle || 'Pré-visualização do Vídeo'}
                              autoPlay={false}
                              className="w-full h-full"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center bg-black/40 rounded-xl p-2 max-h-60 overflow-hidden">
                            <img src={postMediaUrl} alt="Pré-visualização" className="max-h-48 object-contain rounded-lg" />
                          </div>
                        )}
                        <span className="text-[11px] text-gray-400 truncate block mt-2 font-mono">{postMediaUrl}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Legenda / Descrição */}
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                    Legenda / Descrição (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Escreve uma reflexão, versículo ou detalhe da celebração..."
                    value={postDescription}
                    onChange={(e) => setPostDescription(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-neutral-900 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Botão de Publicação */}
                <button
                  type="submit"
                  disabled={isLoading || postIsUploading || !postTitle || !postMediaUrl}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-[#E50914] text-black font-extrabold text-xs sm:text-sm shadow-xl hover:brightness-110 active:scale-95 transition disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Publicar Foto ou Vídeo no Feed</span>
                </button>
              </form>

              {/* Lista de Publicações do Quadro 1 */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Publicações Atualmente no Ar ({posts.length})
                </h4>

                {posts.length === 0 ? (
                  <div className="text-center py-8 rounded-2xl border border-dashed border-white/10 bg-black/20">
                    <Camera className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-400 font-medium">Nenhuma foto ou vídeo publicado ainda.</p>
                    <p className="text-[11px] text-gray-500">Usa o formulário acima para publicar a tua primeira foto!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {posts.map(post => {
                      const videoThumb =
                        post.type === 'video'
                          ? getSafePosterUrl(post.thumbnailUrl, parseVideoSource(post.mediaUrl).thumbnailUrl)
                          : undefined;

                      return (
                        <div key={post.id} className="group relative rounded-2xl bg-black/50 border border-white/10 overflow-hidden flex flex-col">
                          <div
                            onClick={() => {
                              if (post.type === 'video') {
                                setAdminVideoPreview({
                                  title: post.title,
                                  url: post.mediaUrl,
                                  poster: videoThumb
                                });
                              }
                            }}
                            className={`relative aspect-video bg-neutral-950 ${post.type === 'video' ? 'cursor-pointer' : ''}`}
                          >
                            {post.type === 'video' ? (
                              <>
                                {videoThumb ? (
                                  <img src={videoThumb} alt={post.title} className="w-full h-full object-cover" loading="lazy" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-neutral-950">
                                    <Film className="w-8 h-8 text-white/25" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/35 group-hover:bg-black/20 transition flex items-center justify-center">
                                  <div className="w-10 h-10 rounded-full bg-[#E50914] text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                    <Play className="w-4 h-4 fill-white ml-0.5" />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <img src={normalizeMediaUrl(post.mediaUrl)} alt={post.title} className="w-full h-full object-cover" loading="lazy" />
                            )}
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/70 text-amber-400">
                              {post.category}
                            </span>
                          </div>
                          <div className="p-3 flex-1 flex flex-col justify-between">
                            <div>
                              <h5 className="text-xs font-bold text-white line-clamp-1">{post.title}</h5>
                              <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">{post.description || 'Sem legenda'}</p>
                            </div>
                            <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                              <span className="text-[10px] text-gray-500 truncate">{formatLuandaDate(post.createdAt)}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {post.type === 'video' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAdminVideoPreview({
                                        title: post.title,
                                        url: post.mediaUrl,
                                        poster: videoThumb
                                      })
                                    }
                                    className="px-2 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/30 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                                    title="Ver vídeo no painel"
                                  >
                                    <Play className="w-3 h-3 fill-current" />
                                    <span>Ver</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeletePost(post.id)}
                                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs flex items-center gap-1 transition cursor-pointer"
                                  title="Eliminar esta publicação"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Eliminar</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              QUADRO 2: STORIES (24 Horas — Publicação Múltipla Sem Limite)
              ======================================================== */}
          {(selectedBoard === 'all' || selectedBoard === 'stories') && (
            <div className="rounded-3xl border border-white/10 bg-neutral-900/40 p-5 sm:p-6 backdrop-blur-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-5 border-b border-white/10">
                <div>
                  <h3 className="text-base sm:text-lg font-black flex items-center gap-2 text-white">
                    <span className="p-1.5 rounded-lg bg-gradient-to-tr from-[#FFC107] via-[#FF6D00] to-[#E50914] text-black">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <span>Quadro 2: Stories (24 Horas — Múltiplas Publicações)</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Publica várias fotografias e vídeos ao mesmo tempo, sem limite de 10 Stories. Desaparecem automaticamente após 24 horas.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-gradient-to-r from-[#FFC107] via-[#FF6D00] to-[#E50914] text-black shadow-sm">
                    {adminStories.length} {adminStories.length === 1 ? 'ativo' : 'ativos'}
                  </span>
                </div>
              </div>

              {/* Publicador Múltiplo de Stories (Sem limite de quantidade + Progresso individual por ficheiro) */}
              <div className="mb-6 p-4 rounded-2xl bg-black/40 border border-white/5">
                <StoryBatchPublisher
                  token={token}
                  onPublished={(count) => {
                    showNotification(
                      'success',
                      count === 1
                        ? 'Story publicado com sucesso!'
                        : `${count} Stories publicados com sucesso!`
                    );
                    onDataChanged();
                    loadData();
                  }}
                />
              </div>

              {/* Lista de Stories Ativos (Círculos horizontais estilo Instagram + Gestão Individual) */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                    Stories Ativos nas Últimas 24 Horas ({adminStories.length})
                  </h4>
                  {adminStories.length > 0 && (
                    <span className="text-[11px] text-[#FFC107] font-semibold">
                      Toque num Story para abrir e navegar
                    </span>
                  )}
                </div>

                {adminStories.length === 0 ? (
                  <div className="text-center py-8 rounded-2xl border border-dashed border-white/10 bg-black/20">
                    <Sparkles className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-400 font-medium">Nenhum story ativo nas últimas 24 horas.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Horizontal Instagram-style circles preview inside Admin */}
                    <div className="flex items-start gap-3.5 overflow-x-auto no-scrollbar scroll-smooth py-2 px-1">
                      {adminStories.map((story, idx) => {
                        const circleThumb =
                          story.type === 'video'
                            ? getSafePosterUrl(story.thumbnailUrl, parseVideoSource(story.mediaUrl).thumbnailUrl)
                            : normalizeMediaUrl(story.mediaUrl);

                        return (
                          <button
                            key={`circle-${story.id}`}
                            type="button"
                            onClick={() => setAdminStoryViewerIndex(idx)}
                            className="flex flex-col items-center gap-1 shrink-0 w-18 group cursor-pointer"
                          >
                            <div className="relative p-[2.5px] rounded-full bg-gradient-to-tr from-[#FFC107] via-[#FF6D00] to-[#E50914] group-hover:scale-105 transition-transform">
                              <div className="w-15 h-15 rounded-full p-[2px] bg-[#0f0f12]">
                                <div className="w-full h-full rounded-full overflow-hidden bg-neutral-950 flex items-center justify-center">
                                  {circleThumb ? (
                                    <img
                                      src={circleThumb}
                                      alt={story.title}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <Film className="w-5 h-5 text-[#FFC107]" />
                                  )}
                                </div>
                              </div>
                              {story.type === 'video' && (
                                <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-[#E50914] text-white flex items-center justify-center border border-black">
                                  <Play className="w-2 h-2 fill-white" />
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-gray-300 truncate w-full text-center">
                              {story.title || `#${idx + 1}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Grid cards with remaining 24h time & delete button */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {adminStories.map((story, idx) => {
                        const storyVideoThumb =
                          story.type === 'video'
                            ? getSafePosterUrl(story.thumbnailUrl, parseVideoSource(story.mediaUrl).thumbnailUrl)
                            : undefined;

                        return (
                          <div key={story.id} className="group relative rounded-2xl bg-black/50 border border-white/10 overflow-hidden flex flex-col">
                            <div
                              onClick={() => setAdminStoryViewerIndex(idx)}
                              className="aspect-[9/16] bg-neutral-950 relative cursor-pointer"
                            >
                              {story.type === 'video' ? (
                                <>
                                  {storyVideoThumb ? (
                                    <img src={storyVideoThumb} alt={story.title} className="w-full h-full object-cover" loading="lazy" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-neutral-950">
                                      <Film className="w-8 h-8 text-white/25" />
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/15 transition flex items-center justify-center">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#FF6D00] to-[#E50914] text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                      <Play className="w-4 h-4 fill-white ml-0.5" />
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <img src={normalizeMediaUrl(story.mediaUrl)} alt={story.title} className="w-full h-full object-cover" loading="lazy" />
                              )}
                              <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10">
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/75 text-[#FFC107] border border-[#FFC107]/30">
                                  {formatRemainingTime(story.expiresAt)}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteStory(story.id);
                                  }}
                                  className="p-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 cursor-pointer shadow"
                                  title="Eliminar Story"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <div className="p-2 text-center space-y-1">
                              <span className="text-[11px] font-bold text-white truncate block">{story.title}</span>
                              <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 tabular-nums">
                                <span>❤️ {story.reactionsCount ?? 0}</span>
                                <span aria-hidden="true">·</span>
                                <span>💬 {story.commentsCount ?? 0}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              QUADRO 3: ATIVIDADES DA IGREJA
              ======================================================== */}
          {(selectedBoard === 'all' || selectedBoard === 'activities') && (
            <div className="rounded-3xl border border-white/10 bg-neutral-900/40 p-5 sm:p-6 backdrop-blur-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-5 border-b border-white/10">
                <div>
                  <h3 className="text-base sm:text-lg font-black flex items-center gap-2 text-white">
                    <span className="p-1.5 rounded-lg bg-blue-500 text-white">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <span>Quadro 3: Atividades & Agenda da Igreja</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Cultos especiais, conferências, vigílias e programações comunitárias.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 border border-blue-500/30 text-blue-300">
                    {activities.length} agendadas
                  </span>
                </div>
              </div>

              {/* Form Simples de Atividade */}
              <form onSubmit={handlePublishActivity} className="mb-6 p-4 rounded-2xl bg-black/40 border border-white/5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                      Nome do Evento / Culto *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Grande Vigília da Vitória e Louvor"
                      value={activityTitle}
                      onChange={(e) => setActivityTitle(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-neutral-900 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                      Data *
                    </label>
                    <input
                      type="date"
                      required
                      value={activityDate}
                      onChange={(e) => setActivityDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-neutral-900 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                      Hora
                    </label>
                    <input
                      type="time"
                      value={activityTime}
                      onChange={(e) => setActivityTime(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-neutral-900 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                      Local
                    </label>
                    <input
                      type="text"
                      value={activityLocation}
                      onChange={(e) => setActivityLocation(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-neutral-900 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                    Cartaz / Foto de Divulgação
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={activityFileRef}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, 'activity');
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => activityFileRef.current?.click()}
                      disabled={activityIsUploading}
                      className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white flex items-center gap-1.5 transition border border-white/10 cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-blue-400" />
                      <span>{activityIsUploading ? 'A Carregar...' : 'Carregar Cartaz'}</span>
                    </button>
                    <input
                      type="text"
                      placeholder="Ou link/caminho do cartaz ou uploads/..."
                      value={activityPosterUrl}
                      onChange={(e) => setActivityPosterUrl(e.target.value)}
                      onBlur={() => setActivityPosterUrl(prev => normalizeMediaUrl(prev))}
                      className="flex-1 px-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400 placeholder:text-gray-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                    Descrição do Evento
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Detalhes, pregador convidado, tema bíblico..."
                    value={activityDescription}
                    onChange={(e) => setActivityDescription(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-neutral-900 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || activityIsUploading || !activityTitle || !activityDate}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs sm:text-sm shadow-xl active:scale-95 transition disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Agendar Atividade</span>
                </button>
              </form>

              {/* Lista de Atividades */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Atividades Programadas ({activities.length})
                </h4>

                {activities.length === 0 ? (
                  <div className="text-center py-8 rounded-2xl border border-dashed border-white/10 bg-black/20">
                    <Calendar className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-400 font-medium">Nenhuma atividade agendada de momento.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {activities.map(act => (
                      <div key={act.id} className="rounded-2xl bg-black/50 border border-white/10 p-3 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300">
                              {formatLuandaDate(act.date)} às {act.time}
                            </span>
                            <button
                              onClick={() => handleDeleteActivity(act.id)}
                              className="p-1 rounded-lg hover:bg-red-500/20 text-red-400 transition cursor-pointer"
                              title="Eliminar atividade"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <h5 className="text-xs font-bold text-white line-clamp-1">{act.title}</h5>
                          <p className="text-[11px] text-gray-400 line-clamp-2 mt-1">{act.description}</p>
                          <span className="text-[10px] text-gray-500 block mt-2">📍 {act.location}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              QUADRO 4: COMENTÁRIOS & MENSAGENS DOS FIÉIS
              ======================================================== */}
          {(selectedBoard === 'all' || selectedBoard === 'comments' || selectedBoard === 'others') && (
            <div className="rounded-3xl border border-white/10 bg-neutral-900/40 p-5 sm:p-6 backdrop-blur-md space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/10">
                <div>
                  <h3 className="text-base sm:text-lg font-black flex items-center gap-2 text-white">
                    <span className="p-1.5 rounded-lg bg-emerald-500 text-black">
                      <MessageSquare className="w-4 h-4 font-bold" />
                    </span>
                    <span>Quadro 4: Comentários & Contactos dos Fiéis</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Moderação de testemunhos, comentários nas publicações e mensagens de oração/contacto.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400 text-black shadow-md">
                    {adminComments.length + adminStoryComments.length} comentários
                  </span>
                </div>
              </div>

              {/* Sub-quadro: Comentários nos Stories (24h) */}
              <div>
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#FFC107]" />
                  <span>Comentários nos Stories Ativos — 24h ({adminStoryComments.length})</span>
                </h4>

                {adminStoryComments.length === 0 ? (
                  <div className="p-5 rounded-xl bg-black/30 border border-white/5 text-center text-xs text-gray-500">
                    Nenhum comentário ativo nos Stories de momento.
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.08] rounded-2xl bg-[#0b0b0e] border border-white/10 max-h-80 overflow-y-auto">
                    {adminStoryComments.map(sc => (
                      <div key={sc.id} className="p-3.5 flex items-start justify-between gap-3 text-xs hover:bg-white/[0.02] transition">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5 text-[11px] text-gray-400">
                            <span className="font-bold text-[#FFC107] truncate max-w-[220px]">
                              Story: {sc.storyTitle || 'Story'}
                            </span>
                            {sc.parentId && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-amber-300 font-semibold">Resposta</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span>
                              {formatRelativeTime(sc.createdAt)} · {formatLuandaDateTime(sc.createdAt)}
                            </span>
                          </div>
                          <p className="text-white text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {sc.text}
                          </p>
                          {sc.authorName && (
                            <p className="mt-1 text-[11px] font-bold text-amber-400">
                              — {sc.authorName}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteStoryCommentAdmin(sc.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/25 border border-red-500/25 text-red-400 hover:text-red-300 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer shrink-0"
                          title="Eliminar comentário inadequado do Story"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Eliminar</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sub-quadro: Comentários das Publicações */}
              <div>
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  <span>Comentários das Publicações ({adminComments.length})</span>
                </h4>

                {adminComments.length === 0 ? (
                  <div className="p-5 rounded-xl bg-black/30 border border-white/5 text-center text-xs text-gray-500">
                    Nenhum comentário recebido ainda.
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.08] rounded-2xl bg-[#0b0b0e] border border-white/10 max-h-80 overflow-y-auto">
                    {adminComments.map(c => (
                      <div key={c.id} className="p-3.5 flex items-start justify-between gap-3 text-xs hover:bg-white/[0.02] transition">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="px-2 py-0.5 rounded-full bg-[#FFC107]/15 border border-[#FFC107]/35 text-[#FFC107] text-[10px] font-bold truncate max-w-[240px]">
                              {c.postTitle || 'Publicação'}
                            </span>
                            <span className="text-[11px] text-gray-400">
                              {formatRelativeTime(c.createdAt)} · {formatLuandaDate(c.createdAt)}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#FFC107] font-semibold">
                              <Heart className="w-3 h-3 fill-[#FFC107] text-[#FFC107]" />
                              <span>{c.likesCount ?? 0}</span>
                            </span>
                          </div>
                          <p className="text-white text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {c.text}
                          </p>
                          {c.authorName && (
                            <p className="mt-1 text-[11px] font-bold text-amber-400">
                              — {c.authorName}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/25 border border-red-500/25 text-red-400 hover:text-red-300 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer shrink-0"
                          title="Eliminar comentário inadequado"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Eliminar</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sub-quadro: Mensagens Recebidas */}
              <div>
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-blue-400" />
                  <span>Mensagens do Formulário de Contacto ({adminMessages.length})</span>
                </h4>

                {adminMessages.length === 0 ? (
                  <div className="p-4 rounded-xl bg-black/30 border border-white/5 text-center text-xs text-gray-500">
                    Nenhuma mensagem recebida até ao momento.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {adminMessages.map(msg => (
                      <div key={msg.id} className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-3 text-xs">
                        <div className="flex-1 truncate">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{msg.name}</span>
                            <span className="text-[11px] text-amber-400">({msg.email || 'Sem email'})</span>
                            <span className="text-[10px] text-gray-500">{formatLuandaDate(msg.createdAt)}</span>
                          </div>
                          <p className="text-gray-300 mt-1">{msg.message}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition cursor-pointer"
                          title="Eliminar mensagem"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              QUADRO 5: ESTATÍSTICAS (Métricas Reais da Base de Dados)
              ======================================================== */}
          {(selectedBoard === 'all' || selectedBoard === 'stats') && (
            <div className="rounded-3xl border border-white/10 bg-neutral-900/40 p-5 sm:p-6 backdrop-blur-md space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/10">
                <div>
                  <h3 className="text-base sm:text-lg font-black flex items-center gap-2 text-white">
                    <span className="p-1.5 rounded-lg bg-amber-400 text-black">
                      <BarChart3 className="w-4 h-4" />
                    </span>
                    <span>Quadro 5: Estatísticas & Métricas da Plataforma</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Indicadores numéricos reais calculados diretamente a partir da base de dados sem dados fictícios.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Etiqueta amarela no topo */}
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400 text-black shadow-md">
                    {stats?.totalViews ?? 0} visualizações
                  </span>
                </div>
              </div>

              {/* Grid de Métricas Reais */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {/* 1. Visualizações Totais */}
                <div className="p-4 rounded-2xl bg-black/50 border border-amber-400/20 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-400">Visualizações Totais</span>
                    <Eye className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-amber-400">{stats?.totalViews ?? 0}</div>
                  <span className="text-[10px] text-gray-500 mt-1">Acessos reais na plataforma</span>
                </div>

                {/* 2. Publicações Totais */}
                <div className="p-4 rounded-2xl bg-black/50 border border-white/10 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-400">Total de Publicações</span>
                    <Camera className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-2xl font-black text-white">{posts.length}</div>
                  <span className="text-[10px] text-gray-500 mt-1">
                    {stats?.totalPhotos ?? 0} fotos · {stats?.totalVideos ?? 0} vídeos
                  </span>
                </div>

                {/* 3. Gostos & Reações */}
                <div className="p-4 rounded-2xl bg-black/50 border border-white/10 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-400">Gostos & Reações</span>
                    <Heart className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="text-2xl font-black text-red-400 tabular-nums">
                    {(stats?.totalLikes ?? 0) + (stats?.totalStoryReactions ?? 0)}
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1">
                    {stats?.totalLikes ?? 0} gostos · {stats?.totalStoryReactions ?? 0} reações nos Stories
                  </span>
                </div>

                {/* 4. Comentários Recebidos */}
                <div className="p-4 rounded-2xl bg-black/50 border border-white/10 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-400">Comentários</span>
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-emerald-400 tabular-nums">
                    {adminComments.length + adminStoryComments.length}
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1">
                    {adminComments.length} feed · {adminStoryComments.length} nos Stories
                  </span>
                </div>

                {/* 5. Stories Ativos (24h) */}
                <div className="p-4 rounded-2xl bg-black/50 border border-white/10 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-400">Stories Ativos</span>
                    <Sparkles className="w-4 h-4 text-pink-400" />
                  </div>
                  <div className="text-2xl font-black text-pink-400 tabular-nums">{adminStories.length}</div>
                  <span className="text-[10px] text-gray-500 mt-1">Visíveis nas últimas 24h</span>
                </div>

                {/* 6. Atividades Programadas */}
                <div className="p-4 rounded-2xl bg-black/50 border border-white/10 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-400">Atividades na Agenda</span>
                    <Calendar className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-2xl font-black text-blue-400">{activities.length}</div>
                  <span className="text-[10px] text-gray-500 mt-1">Cultos e eventos agendados</span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              QUADRO 6: DEFINIÇÕES (SEM CONTADOR)
              ======================================================== */}
          {(selectedBoard === 'all' || selectedBoard === 'settings' || selectedBoard === 'others') && (
            <div className="rounded-3xl border border-white/10 bg-neutral-900/40 p-5 sm:p-6 backdrop-blur-md space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/10">
                <div>
                  <h3 className="text-base sm:text-lg font-black flex items-center gap-2 text-white">
                    <span className="p-1.5 rounded-lg bg-neutral-800 text-amber-400 border border-amber-400/30">
                      <Settings className="w-4 h-4" />
                    </span>
                    <span>Quadro 6: Definições & Gestão do Sistema</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Configurações do servidor, autenticação de administrador e manutenção de dados.
                  </p>
                </div>
                {/* O cartão Definições NÃO precisa de contador */}
              </div>

              {/* Informações da Conta e Armazenamento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Conta Administrador</span>
                  </div>
                  <p className="text-xs text-white font-semibold">{adminEmail}</p>
                  <p className="text-[11px] text-gray-400">
                    Sessão autenticada para gestão de vídeos, fotos e moderação de conteúdos da Igreja Metodista Fernando Kibuba.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Armazenamento & Otimização</span>
                  </div>
                  <p className="text-xs text-white font-semibold">Transcodificação Full HD 1080p / HD 720p (H.264 + faststart)</p>
                  <p className="text-[11px] text-gray-400">
                    Os vídeos carregados são otimizados automaticamente em Full HD 1080p e HD 720p com miniaturas nítidas para abertura rápida em telemóveis e computadores.
                  </p>
                </div>
              </div>

              {/* Reset Total e Limpeza de Testes */}
              <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-red-400 font-bold text-sm mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Eliminar Todas as Imagens de Teste / Reset Total</span>
                  </div>
                  <p className="text-xs text-gray-300 max-w-xl">
                    Queres começar do zero com as tuas próprias fotos e vídeos? Este botão apaga todas as publicações, stories e atividades de teste da base de dados e zera as estatísticas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsClearAllModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition active:scale-95 cursor-pointer whitespace-nowrap self-start sm:self-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Limpar Todas as Imagens</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-black/60 flex items-center justify-between text-xs text-gray-400">
          <span>Igreja Metodista Fernando Kibuba · Sistema de Postagem Simplificado</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition cursor-pointer"
          >
            Fechar Painel
          </button>
        </div>
      </div>

      {/* Confirmation Modal to Clear All Images/Data */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-scale-up">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#141418] border border-red-500/40 shadow-2xl text-white space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-black text-white">Eliminar Todas as Imagens?</h3>
              <p className="text-xs text-gray-300 mt-2">
                Esta ação vai limpar todas as fotos, vídeos, stories e atividades de teste da base de dados.
                Ficarás com um site 100% limpo para começares a postar o teu conteúdo oficial.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isClearingAll}
                onClick={handleClearAllData}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition shadow-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isClearingAll ? 'A Limpar...' : 'Sim, Eliminar Tudo'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Video Playback Modal (Automatically starts at 01:00 if video >= 1m, else 00:00) */}
      {adminVideoPreview && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-black/92">
          <div className="absolute inset-0" onClick={() => setAdminVideoPreview(null)} />
          <div className="relative z-10 w-full max-w-4xl rounded-3xl bg-[#0b0b0f] border border-white/15 shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-white/10 bg-black/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Film className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-white truncate">
                  {adminVideoPreview.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAdminVideoPreview(null)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer shrink-0"
                title="Fechar reprodução"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="w-full aspect-video max-h-[75vh] bg-black">
              <UniversalVideoPlayer
                url={adminVideoPreview.url}
                title={adminVideoPreview.title}
                poster={adminVideoPreview.poster}
                autoPlay={true}
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Admin Fullscreen Story Viewer with Prev/Next Navigation, Reactions & Comments Moderation */}
      <StoryViewerModal
        stories={adminStories}
        initialIndex={adminStoryViewerIndex ?? 0}
        isOpen={adminStoryViewerIndex !== null}
        onClose={() => setAdminStoryViewerIndex(null)}
        isAdmin={true}
        adminToken={token}
        onDeleteStory={handleDeleteStory}
        onStoryInteractionChange={(storyId, patch) => {
          setAdminStories(prev =>
            prev.map(s => (s.id === storyId ? { ...s, ...patch } : s))
          );
          if (patch.comments) {
            const storyTitle = adminStories.find(s => s.id === storyId)?.title || 'Story';
            setAdminStoryComments(prev => {
              const others = prev.filter(c => c.storyId !== storyId);
              const mapped = patch.comments!.map(c => ({ ...c, storyTitle }));
              return [...mapped, ...others].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
            });
          }
          onDataChanged();
        }}
      />
    </div>
  );
};
