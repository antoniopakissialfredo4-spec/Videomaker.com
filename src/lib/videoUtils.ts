/**
 * Universal Video Parsing, Streaming & Adaptive Quality Utility for VIDEOMAKER Fernando Kibuba
 * Supports YouTube, Vimeo, Google Drive, Dailymotion, Streamable, and HTML5 H.264/AAC MP4 streaming.
 */

export type VideoPlatform =
  | 'youtube'
  | 'vimeo'
  | 'drive'
  | 'dailymotion'
  | 'facebook'
  | 'twitch'
  | 'streamable'
  | 'direct';

export interface ParsedVideoInfo {
  isValidVideo: boolean;
  platform: VideoPlatform;
  embedUrl: string;
  originalUrl: string;
  thumbnailUrl?: string;
  videoId?: string;
  formatLabel: string;
}

/**
 * Extracts YouTube video ID from various link formats
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const cleanUrl = url.trim();

  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/|live\/)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = cleanUrl.match(regExp);
  return match && match[1] ? match[1] : null;
}

/**
 * Extracts Vimeo video ID
 */
export function extractVimeoId(url: string): string | null {
  if (!url) return null;
  const match = url.trim().match(/(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+))/i);
  return match && match[1] ? match[1] : null;
}

/**
 * Extracts Google Drive File ID
 */
export function extractGoogleDriveId(url: string): string | null {
  if (!url) return null;
  const match = url.trim().match(/\/d\/([a-zA-Z0-9_-]+)/i) || url.trim().match(/[?&]id=([a-zA-Z0-9_-]+)/i);
  return match && match[1] ? match[1] : null;
}

/**
 * Extracts Dailymotion video ID
 */
export function extractDailymotionId(url: string): string | null {
  if (!url) return null;
  const match = url.trim().match(/(?:dailymotion\.com\/(?:video|hub)\/([^_]+))|(?:dai\.ly\/([a-zA-Z0-9]+))/i);
  return match ? (match[1] || match[2]) : null;
}

/**
 * Extracts Streamable video ID
 */
export function extractStreamableId(url: string): string | null {
  if (!url) return null;
  const match = url.trim().match(/streamable\.com\/(?:[a-z]\/)?([a-zA-Z0-9]+)/i);
  return match && match[1] ? match[1] : null;
}

/**
 * Checks if a URL or path is a video source
 */
export function isVideoSource(url: string, declaredType?: string): boolean {
  if (declaredType === 'video') return true;
  if (!url) return false;

  const lower = url.trim().toLowerCase();

  // Platform domains
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return true;
  if (lower.includes('vimeo.com')) return true;
  if (lower.includes('drive.google.com')) return true;
  if (lower.includes('dailymotion.com') || lower.includes('dai.ly')) return true;
  if (lower.includes('facebook.com') || lower.includes('fb.watch')) return true;
  if (lower.includes('twitch.tv')) return true;
  if (lower.includes('streamable.com')) return true;

  // Video file extensions
  if (/\.(mp4|webm|mov|m4v|ogg|ogv|avi|mkv|flv|wmv|mts|m2ts|ts|3gp|asf|rm|rmvb)(\?.*)?$/i.test(lower)) return true;

  // Data URLs or blobs
  if (lower.startsWith('data:video/') || lower.startsWith('blob:')) return true;

  // Local uploads that are videos
  if (lower.includes('/uploads/') && /\.(mp4|webm|mov|m4v|avi|mkv|flv|wmv|mts)(\?.*)?$/i.test(lower)) return true;

  return false;
}

/**
 * Ensures a thumbnail URL is an actual image and NOT a .mp4/.mov video URL
 * (prevents <img src="video.mp4"> or <video poster="video.mp4"> double-downloading!)
 */
export function getSafePosterUrl(thumbnailUrl?: string, fallbackUrl?: string): string | undefined {
  const candidates = [thumbnailUrl, fallbackUrl];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    if (isVideoSource(trimmed)) continue;
    return normalizeMediaUrl(trimmed);
  }
  return undefined;
}

/**
 * Normalizes any media path (including relative "uploads/..." or cross-environment Cloud Run URLs)
 * into a reachable same-origin URL when referencing "/uploads/...", preventing CORS/cookie/mixed-content hangs.
 */
export function normalizeMediaUrl(url: string | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // Rewrite any URL pointing to this app's /uploads/<filename> to use the visitor's active origin
  const uploadMatch = trimmed.match(/(?:^https?:\/\/[^\/]+)?\/?(uploads\/[^\s?#]+)(?:\?.*)?$/i);
  if (uploadMatch && uploadMatch[1]) {
    // Only rewrite if it was relative OR hosted on localhost / run.app / same host
    const isExternalCdn =
      trimmed.startsWith('http') &&
      !trimmed.includes('localhost') &&
      !trimmed.includes('.run.app') &&
      (origin ? !trimmed.startsWith(origin) : false);

    if (!isExternalCdn) {
      return origin ? `${origin}/${uploadMatch[1]}` : `/${uploadMatch[1]}`;
    }
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // Upgrade insecure http:// on same host to https:// if page is https://
    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      trimmed.startsWith('http://') &&
      trimmed.includes(window.location.host)
    ) {
      return trimmed.replace(/^http:\/\//i, 'https://');
    }
    return trimmed;
  }

  if (trimmed.startsWith('/')) {
    return origin ? `${origin}${trimmed}` : trimmed;
  }

  return origin ? `${origin}/${trimmed}` : trimmed;
}

/**
 * Detects recommended initial video quality based on visitor's network connection speed
 */
export function detectInitialVideoQuality(): '1080p' | '720p' | '480p' {
  if (typeof navigator === 'undefined') return '1080p';
  const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  if (!conn) return '1080p';

  if (conn.saveData) return '480p';

  const effectiveType = String(conn.effectiveType || '').toLowerCase();
  if (effectiveType === 'slow-2g' || effectiveType === '2g') {
    return '480p';
  }
  if (effectiveType === '3g') {
    return '720p';
  }

  if (typeof conn.downlink === 'number' && conn.downlink > 0) {
    if (conn.downlink < 1.2) return '480p';
    if (conn.downlink < 3.5) return '720p';
  }

  return '1080p';
}

/**
 * Default start position for all videos on Videomaker — Fernando Kibuba (00:01:00 = 60 seconds)
 */
export const DEFAULT_VIDEO_START_SECONDS = 60;

export interface ParseVideoOptions {
  autoPlay?: boolean;
  startSeconds?: number;
}

/**
 * Returns standard MIME type for HTML5 direct video formats (MP4, WebM, MOV)
 */
export function getVideoMimeType(url: string): string | undefined {
  if (!url) return undefined;
  const clean = url.split('?')[0].split('#')[0].trim().toLowerCase();
  if (clean.endsWith('.mp4') || clean.endsWith('.m4v')) return 'video/mp4';
  if (clean.endsWith('.webm')) return 'video/webm';
  if (clean.endsWith('.mov')) return 'video/quicktime';
  if (clean.endsWith('.ogv') || clean.endsWith('.ogg')) return 'video/ogg';
  return undefined;
}

/**
 * Parses any video source into standard playback information
 */
export function parseVideoSource(url: string, options?: ParseVideoOptions): ParsedVideoInfo {
  const autoPlay = options?.autoPlay ?? true;
  const startSeconds =
    typeof options?.startSeconds === 'number' && options.startSeconds >= 0
      ? Math.floor(options.startSeconds)
      : DEFAULT_VIDEO_START_SECONDS;

  if (!url) {
    return {
      isValidVideo: false,
      platform: 'direct',
      embedUrl: '',
      originalUrl: '',
      formatLabel: 'Vídeo'
    };
  }

  const cleanUrl = url.trim();

  // 1. YouTube (Official YouTube Embedded Player)
  const ytId = extractYouTubeId(cleanUrl);
  if (ytId) {
    const startParam = startSeconds > 0 ? `&start=${startSeconds}` : '';
    const watchStartParam = startSeconds > 0 ? `&t=${startSeconds}s` : '';
    return {
      isValidVideo: true,
      platform: 'youtube',
      videoId: ytId,
      embedUrl: `https://www.youtube.com/embed/${ytId}?autoplay=${autoPlay ? 1 : 0}${startParam}&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`,
      originalUrl: `https://www.youtube.com/watch?v=${ytId}${watchStartParam}`,
      thumbnailUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
      formatLabel: 'YouTube HD'
    };
  }

  // 2. Vimeo
  const vimeoId = extractVimeoId(cleanUrl);
  if (vimeoId) {
    return {
      isValidVideo: true,
      platform: 'vimeo',
      videoId: vimeoId,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}?autoplay=${autoPlay ? 1 : 0}&quality=1080p&title=0&byline=0&portrait=0`,
      originalUrl: `https://vimeo.com/${vimeoId}`,
      thumbnailUrl: undefined,
      formatLabel: 'Vimeo 1080p HD'
    };
  }

  // 3. Google Drive
  const driveId = extractGoogleDriveId(cleanUrl);
  if (driveId && cleanUrl.includes('drive.google.com')) {
    return {
      isValidVideo: true,
      platform: 'drive',
      videoId: driveId,
      embedUrl: `https://drive.google.com/file/d/${driveId}/preview?vq=hd1080`,
      originalUrl: `https://drive.google.com/file/d/${driveId}/view`,
      thumbnailUrl: undefined,
      formatLabel: 'Google Drive HD'
    };
  }

  // 4. Dailymotion
  const dailyId = extractDailymotionId(cleanUrl);
  if (dailyId) {
    const dailyStart = startSeconds > 0 ? `&start=${startSeconds}` : '';
    return {
      isValidVideo: true,
      platform: 'dailymotion',
      videoId: dailyId,
      embedUrl: `https://www.dailymotion.com/embed/video/${dailyId}?autoplay=${autoPlay ? 1 : 0}${dailyStart}&quality=1080`,
      originalUrl: cleanUrl,
      thumbnailUrl: `https://www.dailymotion.com/thumbnail/video/${dailyId}`,
      formatLabel: 'Dailymotion 1080p'
    };
  }

  // 5. Streamable
  const streamableId = extractStreamableId(cleanUrl);
  if (streamableId) {
    return {
      isValidVideo: true,
      platform: 'streamable',
      videoId: streamableId,
      embedUrl: `https://streamable.com/e/${streamableId}?autoplay=${autoPlay ? 1 : 0}&quality=1080p`,
      originalUrl: `https://streamable.com/${streamableId}`,
      thumbnailUrl: undefined,
      formatLabel: 'Streamable HD'
    };
  }

  // 6. Direct video files (MP4 H.264/AAC, WebM, MOV)
  const normalizedDirectUrl = normalizeMediaUrl(cleanUrl);

  // Derive automatic _thumb.jpg if this is an uploaded video on /uploads/
  let derivedThumb: string | undefined = undefined;
  if (normalizedDirectUrl.includes('/uploads/')) {
    const thumbCandidate = normalizedDirectUrl.replace(
      /_(?:1080p|720p|480p|sd|web|raw)\.(mp4|mov|webm|mkv|avi)$/i,
      '_thumb.jpg'
    );
    if (thumbCandidate !== normalizedDirectUrl) {
      derivedThumb = thumbCandidate;
    }
  }

  return {
    isValidVideo: isVideoSource(normalizedDirectUrl),
    platform: 'direct',
    embedUrl: normalizedDirectUrl,
    originalUrl: normalizedDirectUrl,
    thumbnailUrl: derivedThumb,
    formatLabel: 'Full HD 1080p'
  };
}
