export interface Post {
  id: string;
  title: string;
  description: string;
  type: 'photo' | 'video';
  mediaUrl: string;
  thumbnailUrl?: string;
  category: string;
  activityName?: string;
  location?: string;
  createdAt: string;
  likesCount: number;
  featured?: boolean;
  comments?: Comment[];
}

export type StoryReactionType = 'heart' | 'haha' | 'wow' | 'sad' | 'fire' | 'like';

export const STORY_REACTIONS: ReadonlyArray<{
  type: StoryReactionType;
  emoji: string;
  label: string;
}> = [
  { type: 'heart', emoji: '❤️', label: 'Adoro' },
  { type: 'haha', emoji: '😂', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Uau' },
  { type: 'sad', emoji: '😢', label: 'Triste' },
  { type: 'fire', emoji: '🔥', label: 'Fogo' },
  { type: 'like', emoji: '👍', label: 'Gosto' }
] as const;

export interface StoryComment {
  id: string;
  storyId: string;
  parentId?: string;
  authorName?: string;
  text: string;
  createdAt: string;
  storyTitle?: string;
}

export interface Story {
  id: string;
  title: string;
  type: 'photo' | 'video';
  mediaUrl: string;
  thumbnailUrl?: string;
  createdAt: string;
  expiresAt: string;
  isActive?: boolean;
  remainingMs?: number;
  reactionsCount?: number;
  reactionBreakdown?: Partial<Record<StoryReactionType, number>>;
  userReaction?: StoryReactionType | null;
  commentsCount?: number;
  comments?: StoryComment[];
}

export interface StoryCreateInput {
  title?: string;
  type: 'photo' | 'video';
  mediaUrl: string;
  thumbnailUrl?: string;
}

export interface StoryInteractionsPayload {
  storyId: string;
  reactionsCount: number;
  reactionBreakdown: Partial<Record<StoryReactionType, number>>;
  userReaction: StoryReactionType | null;
  commentsCount: number;
  comments: StoryComment[];
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  posterUrl: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  location: string;
  additionalInfo?: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorName?: string;
  text: string;
  createdAt: string;
  likesCount?: number;
  postTitle?: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface AdminUser {
  email: string;
  name: string;
  role: string;
}

export interface AdminStats {
  totalPosts: number;
  totalPhotos: number;
  totalVideos: number;
  totalLikes: number;
  totalComments: number;
  activeStories: number;
  totalStoryReactions?: number;
  totalStoryComments?: number;
  totalActivities: number;
  unreadMessages: number;
  totalViews: number;
}

export const CATEGORIES = [
  'Todos',
  'Cultos',
  'Louvor',
  'Juventude',
  'Batismos',
  'Conferências',
  'Casamentos',
  'Escola Dominical',
  'Ação Social',
  'Especial'
] as const;

export type CategoryType = (typeof CATEGORIES)[number];
