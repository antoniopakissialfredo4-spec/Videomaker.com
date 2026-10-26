import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { MainSearchSection } from './components/MainSearchSection';
import { GallerySection } from './components/GallerySection';
import { ActivitiesSection } from './components/ActivitiesSection';
import { AboutSection } from './components/AboutSection';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';
import { PostDetailModal } from './components/PostDetailModal';
import { CommentsSheet } from './components/CommentsSheet';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminDashboard } from './components/AdminDashboard';
import { QuickPublishModal } from './components/QuickPublishModal';
import { StoriesSection } from './components/StoriesSection';
import { StoryViewerModal, StoryInteractionPatch } from './components/StoryViewerModal';
import { OpeningSplash } from './components/OpeningSplash';
import { VisitorNamePage } from './components/VisitorNamePage';
import { VisitorSettingsModal } from './components/VisitorSettingsModal';
import { PWAInstallModal } from './components/PWAInstallModal';
import {
  useAdminNotifications,
  NotificationsModal,
  LiveAdminToast,
  AdminFeedNotification,
} from './components/NotificationsBell';
import { SiteInfoModal, SecurityPrivacyModal } from './components/InfoAndSecurityModals';
import { Post, Story, Activity, Comment, AdminUser } from './types';
import {
  fetchPosts,
  fetchStories,
  fetchActivities,
  toggleLike,
  fetchLikedStatus,
  fetchLikedCommentIds,
  verifyAdminSession,
  logoutAdmin,
  deletePost,
  deleteStory,
  updateVisitorCommentAuthor
} from './lib/api';
import {
  getVisitorId,
  getVisitorName,
  setVisitorName,
  VISITOR_NAME_UPDATED_EVENT
} from './lib/visitor';
import { usePWAInstall } from './lib/pwaInstall';

export default function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [seenStoryIds, setSeenStoryIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('videomaker_seen_stories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<string[]>([]);
  const [likedCommentIds, setLikedCommentIds] = useState<string[]>([]);
  const [, setIsLoading] = useState(true);

  // Theme State ('dark' | 'light')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('videomaker_theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  const handleToggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('videomaker_theme', next);
      return next;
    });
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Auth State
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  // Modals & Interactive States
  const [searchFocusTrigger, setSearchFocusTrigger] = useState(0);
  const [isSiteInfoOpen, setIsSiteInfoOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSecurityPrivacyOpen, setIsSecurityPrivacyOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isQuickPublishOpen, setIsQuickPublishOpen] = useState(false);
  const [quickPublishInitialType, setQuickPublishInitialType] = useState<'photo' | 'video' | 'activity' | 'story'>('photo');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [commentsPost, setCommentsPost] = useState<Post | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [, setActiveSection] = useState('inicio');

  // Visitor Identification & Mandatory 4-Step Entry Sequence:
  // 1. Opening Splash -> 2. Visitor Name Page -> 3. PWA Install Invite -> 4. Main Site
  const [visitorName, setVisitorNameState] = useState<string>(() => getVisitorName());
  const [onboardingStep, setOnboardingStep] = useState<'splash' | 'name' | 'install' | 'main'>('splash');
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isVisitorSettingsOpen, setIsVisitorSettingsOpen] = useState(false);

  const {
    isStandalone,
    canPromptNatively,
    platform,
    browserKind,
    shouldAutoShowInvite,
    triggerNativeInstall,
    dismissInvite,
  } = usePWAInstall();

  const {
    notifications,
    unreadCount,
    markAllSeen,
    browserAlertsEnabled,
    enableBrowserAlerts,
    liveToast,
    dismissLiveToast,
  } = useAdminNotifications(posts, stories, activities);

  useEffect(() => {
    const syncName = () => {
      setVisitorNameState(getVisitorName());
    };
    window.addEventListener(VISITOR_NAME_UPDATED_EVENT, syncName);
    return () => window.removeEventListener(VISITOR_NAME_UPDATED_EVENT, syncName);
  }, []);

  // Step 1 -> Step 2 (or skip to Step 3 / Step 4 if visitor name is already stored in localStorage)
  const handleSplashComplete = useCallback(() => {
    const existingName = getVisitorName();
    if (!existingName) {
      setOnboardingStep('name');
      return;
    }
    setVisitorNameState(existingName);
    if (shouldAutoShowInvite) {
      setOnboardingStep('install');
      setIsInstallModalOpen(true);
    } else {
      setOnboardingStep('main');
    }
  }, [shouldAutoShowInvite]);

  // Step 2 -> Step 3 (or Step 4 if already installed / previously chose "Continuar no navegador")
  const handleVisitorNameContinue = useCallback(
    (enteredName: string) => {
      const saved = setVisitorName(enteredName);
      setVisitorNameState(saved);
      if (shouldAutoShowInvite) {
        setOnboardingStep('install');
        setIsInstallModalOpen(true);
      } else {
        setOnboardingStep('main');
      }
    },
    [shouldAutoShowInvite]
  );

  const handleCloseInstallModal = useCallback(() => {
    setIsInstallModalOpen(false);
    setOnboardingStep(prev => (prev === 'install' ? 'main' : prev));
  }, []);

  // Load initial data (including all active 24h Stories without limit)
  const loadData = useCallback(async () => {
    try {
      const visitorId = getVisitorId();
      const [postsData, storiesData, activitiesData] = await Promise.all([
        fetchPosts(),
        fetchStories(visitorId),
        fetchActivities()
      ]);
      const nowMs = Date.now();
      const validStories = storiesData.filter(s => new Date(s.expiresAt).getTime() > nowMs);
      setPosts(postsData);
      setStories(validStories);
      setActivities(activitiesData);
      setSelectedPost(prev => prev ? (postsData.find(p => p.id === prev.id) || null) : null);
      setCommentsPost(prev => prev ? (postsData.find(p => p.id === prev.id) || null) : null);
    } catch (err) {
      console.error('Error loading initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Allow visitor to change their saved name in Definições and update their published comments
  const handleSaveVisitorName = useCallback(
    async (newName: string) => {
      const saved = setVisitorName(newName);
      setVisitorNameState(saved);
      try {
        await updateVisitorCommentAuthor(getVisitorId(), saved);
        await loadData();
      } catch {
        // Local name is already saved in localStorage even if offline
      }
    },
    [loadData]
  );

  // Automatically remove expired Stories and lightly refresh feed for new administrator notifications
  useEffect(() => {
    const expiryInterval = setInterval(() => {
      const nowMs = Date.now();
      setStories(prev => {
        const active = prev.filter(s => new Date(s.expiresAt).getTime() > nowMs);
        return active.length === prev.length ? prev : active;
      });
    }, 30000);

    const feedSyncInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadData();
      }
    }, 35000);

    return () => {
      clearInterval(expiryInterval);
      clearInterval(feedSyncInterval);
    };
  }, [loadData]);

  const handleMarkStorySeen = useCallback((storyId: string) => {
    setSeenStoryIds(prev => {
      if (prev.includes(storyId)) return prev;
      const next = [...prev.slice(-200), storyId];
      try {
        localStorage.setItem('videomaker_seen_stories', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Check stored admin session
  useEffect(() => {
    const savedToken = localStorage.getItem('videomaker_admin_token');
    if (savedToken) {
      verifyAdminSession(savedToken).then(res => {
        if (res.authenticated && res.admin) {
          setAdminToken(savedToken);
          setAdminUser(res.admin);
        } else {
          localStorage.removeItem('videomaker_admin_token');
          setAdminToken(null);
          setAdminUser(null);
        }
      }).catch(() => {
        localStorage.removeItem('videomaker_admin_token');
      });
    }

    // Load visitor liked status for posts and individual comments
    const visitorId = getVisitorId();
    fetchLikedStatus(visitorId).then(ids => setLikedPostIds(ids)).catch(() => {});
    fetchLikedCommentIds(visitorId).then(ids => setLikedCommentIds(ids)).catch(() => {});

    loadData();
  }, [loadData]);

  // Keyboard shortcut Ctrl+K / Cmd+K focuses the main inline search bar above Quadras de Fotos & Vídeos
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchFocusTrigger(c => c + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Smooth navigation
  const handleNavigate = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
    if (sectionId === 'inicio') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const elem = document.getElementById(sectionId);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Notification selection handler
  const handleSelectNotification = useCallback(
    (item: AdminFeedNotification) => {
      setIsNotificationsOpen(false);
      dismissLiveToast();
      if (item.kind === 'post') {
        const targetPost = posts.find(p => p.id === item.targetId);
        if (targetPost) setSelectedPost(targetPost);
      } else if (item.kind === 'story') {
        const idx = stories.findIndex(s => s.id === item.targetId);
        if (idx >= 0) setActiveStoryIndex(idx);
      } else {
        handleNavigate('atividades');
      }
    },
    [posts, stories, dismissLiveToast, handleNavigate]
  );

  // Handle Like Toggle
  const handleToggleLike = async (postId: string) => {
    const visitorId = getVisitorId();
    try {
      const wasLiked = likedPostIds.includes(postId);
      const newLikedIds = wasLiked
        ? likedPostIds.filter(id => id !== postId)
        : [...likedPostIds, postId];
      setLikedPostIds(newLikedIds);

      setPosts(prev =>
        prev.map(p => {
          if (p.id === postId) {
            const count = Math.max(0, p.likesCount + (wasLiked ? -1 : 1));
            return { ...p, likesCount: count };
          }
          return p;
        })
      );

      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost(sp => sp ? {
          ...sp,
          likesCount: Math.max(0, sp.likesCount + (wasLiked ? -1 : 1))
        } : null);
      }

      const res = await toggleLike(postId, visitorId);
      setPosts(prev =>
        prev.map(p => (p.id === postId ? { ...p, likesCount: res.likesCount } : p))
      );
      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost(sp => sp ? { ...sp, likesCount: res.likesCount } : null);
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  // Comments update callbacks
  const handleCommentAdded = (postId: string, newComment: Comment) => {
    const appendComment = (p: Post): Post => {
      if (p.id !== postId) return p;
      const existing = (p.comments || []).filter(c => c.id !== newComment.id);
      return { ...p, comments: [newComment, ...existing] };
    };
    setPosts(prev => prev.map(appendComment));
    setSelectedPost(prev => (prev ? appendComment(prev) : null));
    setCommentsPost(prev => (prev ? appendComment(prev) : null));
  };

  const handleCommentDeleted = (postId: string, commentId: string) => {
    const removeComment = (p: Post): Post => {
      if (p.id !== postId || !p.comments) return p;
      return { ...p, comments: p.comments.filter(c => c.id !== commentId) };
    };
    setPosts(prev => prev.map(removeComment));
    setSelectedPost(prev => (prev ? removeComment(prev) : null));
    setCommentsPost(prev => (prev ? removeComment(prev) : null));
  };

  const handleToggleCommentLikeState = (commentId: string, liked: boolean) => {
    const wasLiked = likedCommentIds.includes(commentId);
    setLikedCommentIds(prev => {
      if (liked) {
        return prev.includes(commentId) ? prev : [...prev, commentId];
      }
      return prev.filter(id => id !== commentId);
    });

    if (wasLiked !== liked) {
      const delta = liked ? 1 : -1;
      const updateCommentLikes = (p: Post): Post => {
        if (!p.comments || !p.comments.some(c => c.id === commentId)) return p;
        return {
          ...p,
          comments: p.comments.map(c =>
            c.id === commentId
              ? { ...c, likesCount: Math.max(0, (c.likesCount ?? 0) + delta) }
              : c
          )
        };
      };
      setPosts(prev => prev.map(updateCommentLikes));
      setSelectedPost(prev => (prev ? updateCommentLikes(prev) : null));
      setCommentsPost(prev => (prev ? updateCommentLikes(prev) : null));
    }
  };

  // Post deleted callback
  const handleDeletePost = async (postId: string) => {
    try {
      if (adminToken) {
        await deletePost(postId, adminToken);
      }
      setPosts(prev => prev.filter(p => p.id !== postId));
      if (selectedPost?.id === postId) {
        setSelectedPost(null);
      }
      if (commentsPost?.id === postId) {
        setCommentsPost(null);
      }
    } catch (err: any) {
      console.error('Failed to delete post:', err);
    }
  };

  // Story deleted callback
  const handleDeleteStoryFromViewer = async (storyId: string) => {
    try {
      if (adminToken) {
        await deleteStory(storyId, adminToken);
      }
      setStories(prev => prev.filter(s => s.id !== storyId));
    } catch (err) {
      console.error('Failed to delete story:', err);
    }
  };

  // Sync Story reactions & comments live in memory
  const handleStoryInteractionChange = useCallback(
    (storyId: string, patch: StoryInteractionPatch) => {
      setStories(prev =>
        prev.map(s => (s.id === storyId ? { ...s, ...patch } : s))
      );
    },
    []
  );

  // Admin Login success
  const handleLoginSuccess = (token: string, user: AdminUser) => {
    localStorage.setItem('videomaker_admin_token', token);
    setAdminToken(token);
    setAdminUser(user);
    setIsAdminDashboardOpen(true);
  };

  // Admin Logout
  const handleLogout = async () => {
    if (adminToken) {
      await logoutAdmin(adminToken);
    }
    localStorage.removeItem('videomaker_admin_token');
    setAdminToken(null);
    setAdminUser(null);
    setIsAdminDashboardOpen(false);
  };

  const photoCount = posts.filter(p => p.type === 'photo').length;
  const videoCount = posts.filter(p => p.type === 'video').length;

  return (
    <div className={`relative min-h-screen flex flex-col font-sans selection:bg-amber-400 selection:text-black transition-colors duration-200 overflow-x-hidden ${
      theme === 'light' ? 'bg-[#f8f9fa] text-neutral-900' : 'bg-[#08080a] text-gray-100'
    }`}>
      {/* Ambient Fluid Liquid Glass Floating Orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-[130px] animate-liquid-float" />
        <div className="absolute top-[35%] right-[-10%] w-[550px] h-[550px] rounded-full bg-[#E50914]/10 blur-[140px] animate-liquid-float-slow" />
        <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] rounded-full bg-amber-600/10 blur-[150px] animate-liquid-float" />
      </div>

      {/* STEP 1: Opening Brand Animation (~2.6s, Respects prefers-reduced-motion) */}
      {onboardingStep === 'splash' && <OpeningSplash onComplete={handleSplashComplete} />}

      {/* STEP 2: Visitor Name Page (Shown after animation if visitor has not saved their name yet) */}
      {onboardingStep === 'name' && (
        <VisitorNamePage onContinue={handleVisitorNameContinue} />
      )}

      {/* STEP 3: PWA Install Invitation Modal (Shown after "Continuar" or manually from menu) */}
      <PWAInstallModal
        isOpen={isInstallModalOpen}
        onClose={handleCloseInstallModal}
        onDismissBrowserContinue={dismissInvite}
        canPromptNatively={canPromptNatively}
        platform={platform}
        browserKind={browserKind}
        onTriggerNativeInstall={triggerNativeInstall}
      />

      {/* Visitor Preferences / Definições Modal */}
      <VisitorSettingsModal
        isOpen={isVisitorSettingsOpen}
        onClose={() => setIsVisitorSettingsOpen(false)}
        visitorName={visitorName}
        onSaveVisitorName={handleSaveVisitorName}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        showInstallOption={!isStandalone}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
      />

      {/* Informações sobre o site Modal */}
      <SiteInfoModal
        isOpen={isSiteInfoOpen}
        onClose={() => setIsSiteInfoOpen(false)}
        theme={theme}
        stats={{
          posts: posts.length,
          photos: photoCount,
          videos: videoCount,
          stories: stories.length,
          activities: activities.length,
        }}
        onNavigate={handleNavigate}
        showInstallOption={!isStandalone}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
      />

      {/* Notificações Modal */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        browserAlertsEnabled={browserAlertsEnabled}
        onEnableBrowserAlerts={enableBrowserAlerts}
        onSelectNotification={handleSelectNotification}
        theme={theme}
      />

      {/* Segurança e privacidade Modal */}
      <SecurityPrivacyModal
        isOpen={isSecurityPrivacyOpen}
        onClose={() => setIsSecurityPrivacyOpen(false)}
        theme={theme}
        visitorName={visitorName}
        isAdmin={Boolean(adminUser)}
        onOpenSettings={() => setIsVisitorSettingsOpen(true)}
      />

      {/* Live Toast Notification when New Content is Published */}
      <LiveAdminToast
        toast={liveToast}
        onSelect={handleSelectNotification}
        onDismiss={dismissLiveToast}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Minimalist Header: Methodist Cross + VIDEOMAKER — IGREJA METODISTA FERNANDO KIBUBA + ⋮ Menu */}
        <Navbar
          onNavigate={handleNavigate}
          onOpenSiteInfo={() => setIsSiteInfoOpen(true)}
          onOpenAdminModal={() => {
            if (adminUser) {
              setIsAdminDashboardOpen(true);
            } else {
              setIsAdminLoginOpen(true);
            }
          }}
          onOpenNotifications={() => {
            markAllSeen();
            setIsNotificationsOpen(true);
          }}
          onOpenSettings={() => setIsVisitorSettingsOpen(true)}
          onToggleTheme={handleToggleTheme}
          onOpenSecurityPrivacy={() => setIsSecurityPrivacyOpen(true)}
          onQuickPublish={() => {
            setQuickPublishInitialType('photo');
            setIsQuickPublishOpen(true);
          }}
          adminUser={adminUser}
          theme={theme}
          visitorName={visitorName}
          unreadNotificationsCount={unreadCount}
        />

        <main className="flex-1">
          {/* Instagram-Style Horizontal Stories Bar (Unlimited Stories, 24h Auto-Expiration) */}
          <StoriesSection
            stories={stories}
            seenStoryIds={seenStoryIds}
            onOpenStoryAtIndex={(idx) => setActiveStoryIndex(idx)}
            isAdmin={Boolean(adminUser)}
            onOpenPublishStories={() => {
              setQuickPublishInitialType('story');
              setIsQuickPublishOpen(true);
            }}
            theme={theme}
          />

          {/* Hero Section with Live Stats & Liquid Glass */}
          <HeroSection
            onExploreGallery={() => handleNavigate('galeria')}
            onExploreActivities={() => handleNavigate('atividades')}
            stats={{
              posts: posts.length,
              videos: videoCount,
              activities: activities.length
            }}
            theme={theme}
          />

          {/* Inline Search Bar Immediately Above «Quadras de Fotos & Vídeos» */}
          <MainSearchSection
            posts={posts}
            activities={activities}
            theme={theme}
            onSelectPost={(post) => setSelectedPost(post)}
            onSelectActivity={() => handleNavigate('atividades')}
            externalFocusTrigger={searchFocusTrigger}
          />

          {/* Quadras de Fotos & Vídeos Gallery Section */}
          <GallerySection
            posts={posts}
            likedPostIds={likedPostIds}
            onToggleLike={handleToggleLike}
            onSelectPost={(post) => setSelectedPost(post)}
            onOpenComments={(post) => setCommentsPost(post)}
            isAdmin={Boolean(adminUser)}
            onOpenCreatePost={() => {
              setQuickPublishInitialType('photo');
              setIsQuickPublishOpen(true);
            }}
            onDeletePost={handleDeletePost}
            theme={theme}
            onCommentAdded={handleCommentAdded}
          />

          {/* Church Activities Section */}
          <ActivitiesSection
            activities={activities}
            isAdmin={Boolean(adminUser)}
            onOpenCreateActivity={() => {
              setQuickPublishInitialType('activity');
              setIsQuickPublishOpen(true);
            }}
            onDeleteActivity={(id) => {
              setActivities(prev => prev.filter(a => a.id !== id));
            }}
            theme={theme}
          />

          {/* About Videomaker Section */}
          <AboutSection theme={theme} />

          {/* Contact & Video Coverage Request Section */}
          <ContactSection theme={theme} />
        </main>

        {/* Footer */}
        <Footer
          onNavigate={handleNavigate}
          onOpenAdmin={() => {
            if (adminUser) {
              setIsAdminDashboardOpen(true);
            } else {
              setIsAdminLoginOpen(true);
            }
          }}
          isAdmin={Boolean(adminUser)}
          theme={theme}
          showInstallOption={!isStandalone}
          onOpenInstallModal={() => setIsInstallModalOpen(true)}
          onOpenSettings={() => setIsVisitorSettingsOpen(true)}
        />

        {/* Publication Detail Modal */}
        <PostDetailModal
          post={selectedPost}
          isOpen={selectedPost !== null}
          onClose={() => setSelectedPost(null)}
          isLiked={selectedPost ? likedPostIds.includes(selectedPost.id) : false}
          onToggleLike={handleToggleLike}
          onOpenComments={(post) => setCommentsPost(post)}
          isAdmin={Boolean(adminUser)}
          onDeletePost={handleDeletePost}
        />

        {/* Fullscreen Individual Story Viewer Modal with Prev/Next Navigation */}
        <StoryViewerModal
          stories={stories}
          initialIndex={activeStoryIndex ?? 0}
          isOpen={activeStoryIndex !== null}
          onClose={() => setActiveStoryIndex(null)}
          onStorySeen={handleMarkStorySeen}
          isAdmin={Boolean(adminUser)}
          adminToken={adminToken || undefined}
          visitorName={visitorName}
          onOpenSettings={() => setIsVisitorSettingsOpen(true)}
          onDeleteStory={handleDeleteStoryFromViewer}
          onStoryInteractionChange={handleStoryInteractionChange}
        />

        {/* Instagram-Inspired Rounded Comments Sheet over Selected Publication */}
        <CommentsSheet
          post={commentsPost}
          isOpen={commentsPost !== null}
          onClose={() => setCommentsPost(null)}
          showPostBackdrop={selectedPost === null}
          likedCommentIds={likedCommentIds}
          onToggleCommentLikeState={handleToggleCommentLikeState}
          isAdmin={Boolean(adminUser)}
          adminToken={adminToken || undefined}
          visitorName={visitorName}
          onOpenSettings={() => setIsVisitorSettingsOpen(true)}
          onCommentAdded={handleCommentAdded}
          onCommentDeleted={handleCommentDeleted}
        />

        {/* Simple Liquid-Glass Quick Publish Modal */}
        {adminToken && (
          <QuickPublishModal
            isOpen={isQuickPublishOpen}
            onClose={() => setIsQuickPublishOpen(false)}
            token={adminToken}
            onPublished={loadData}
            theme={theme}
            initialType={quickPublishInitialType}
          />
        )}

        {/* Admin Login Modal */}
        <AdminLoginModal
          isOpen={isAdminLoginOpen}
          onClose={() => setIsAdminLoginOpen(false)}
          onLoginSuccess={handleLoginSuccess}
        />

        {/* Admin Full Dashboard */}
        {adminToken && adminUser && (
          <AdminDashboard
            isOpen={isAdminDashboardOpen}
            onClose={() => setIsAdminDashboardOpen(false)}
            token={adminToken}
            adminEmail={adminUser.email}
            onLogout={handleLogout}
            onDataChanged={loadData}
            posts={posts}
            activities={activities}
          />
        )}
      </div>
    </div>
  );
}
