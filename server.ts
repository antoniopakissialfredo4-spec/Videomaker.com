import express, { type Request, type Response, type NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execSync, exec } from 'child_process';
import multer from 'multer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3000;

// Setup directories
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage for direct mobile/desktop streaming uploads
const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
    const baseId = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `${baseId}_raw${ext}`);
  }
});

const uploadMiddleware = multer({
  storage: uploadStorage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500 MB limit per file for high-def mobile videos
});

// Helper to determine real public HTTPS URL of this deployment
export function getPublicBaseUrl(req: Request): string {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const hostHeader = req.headers['x-forwarded-host'] || req.get('host');
  const host = typeof hostHeader === 'string' ? hostHeader.split(',')[0].trim() : '';
  const defaultProto = host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1') ? 'https' : (req.protocol || 'http');
  const proto = typeof forwardedProto === 'string' ? forwardedProto.split(',')[0].trim() : defaultProto;
  if (host) {
    return `${proto}://${host}`;
  }
  return `http://localhost:${PORT}`;
}

// Convert any local, relative, or cross-env /uploads/ path into a reachable URL on the visitor's active host
export function normalizeToPublicUrl(urlOrPath: string | undefined, baseUrl: string): string {
  if (!urlOrPath) return '';
  const trimmed = urlOrPath.trim();
  if (!trimmed) return '';

  // Rewrite any relative or previous deployment URL referencing /uploads/<file> to current baseUrl
  const uploadMatch = trimmed.match(/(?:^https?:\/\/[^\/]+)?\/?(uploads\/[^\s?#]+)(?:\?.*)?$/i);
  if (uploadMatch && uploadMatch[1]) {
    const isExternalHost =
      trimmed.startsWith('http') &&
      !trimmed.includes('localhost') &&
      !trimmed.includes('127.0.0.1') &&
      !trimmed.includes('.run.app') &&
      !trimmed.startsWith(baseUrl);

    if (!isExternalHost) {
      return `${baseUrl}/${uploadMatch[1]}`;
    }
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return `${baseUrl}${trimmed}`;
  }
  return `${baseUrl}/${trimmed}`;
}

// Helper: Resolve a valid image thumbnail URL for any media item (NEVER return a .mp4/.mov video file as thumbnailUrl!)
function resolveMediaThumbnailUrl(
  mediaUrl: string,
  type: 'photo' | 'video',
  thumbnailUrl: string | undefined,
  baseUrl: string
): string | undefined {
  const isVideoFile = (u?: string) =>
    Boolean(u && /\.(mp4|webm|mov|m4v|mkv|avi|flv|wmv|mts|3gp)(\?.*)?$/i.test(u.trim()));

  if (type !== 'video') {
    const raw = thumbnailUrl || mediaUrl;
    return raw ? normalizeToPublicUrl(raw, baseUrl) : undefined;
  }

  // For video items: only accept thumbnailUrl if it is NOT a video file and NOT equal to mediaUrl
  if (thumbnailUrl && thumbnailUrl !== mediaUrl && !isVideoFile(thumbnailUrl)) {
    return normalizeToPublicUrl(thumbnailUrl, baseUrl);
  }

  // Check if an uploaded _thumb.jpg exists on disk for this video
  const uploadFileMatch = mediaUrl.match(/uploads\/([^/?#]+)$/i);
  if (uploadFileMatch && uploadFileMatch[1]) {
    const videoFilename = uploadFileMatch[1];
    const thumbFilename = videoFilename.replace(
      /_(?:1080p|720p|480p|story|sd|web|raw)\.[^.]+$/i,
      '_thumb.jpg'
    );
    const thumbPath = path.join(UPLOADS_DIR, thumbFilename);
    if (thumbFilename !== videoFilename && fs.existsSync(thumbPath)) {
      return `${baseUrl}/uploads/${thumbFilename}`;
    }

    // Attempt one-time thumbnail extraction if the video exists locally on disk
    const localVideoPath = path.join(UPLOADS_DIR, videoFilename);
    if (fs.existsSync(localVideoPath)) {
      const autoThumbName = `${path.basename(videoFilename, path.extname(videoFilename))}_thumb.jpg`;
      const autoThumbPath = path.join(UPLOADS_DIR, autoThumbName);
      if (fs.existsSync(autoThumbPath)) {
        return `${baseUrl}/uploads/${autoThumbName}`;
      }
      try {
        execSync(
          `ffmpeg -ss 00:00:00.2 -i "${localVideoPath}" -vf "scale='min(1080,iw)':-2" -vframes 1 -q:v 4 "${autoThumbPath}" -y`,
          { timeout: 8000, stdio: 'ignore' }
        );
        if (fs.existsSync(autoThumbPath) && fs.statSync(autoThumbPath).size > 0) {
          return `${baseUrl}/uploads/${autoThumbName}`;
        }
      } catch {
        // Ignore thumbnail generation error
      }
    }
  }

  return undefined;
}

function resolvePostThumbnailUrl(post: Post, baseUrl: string): string | undefined {
  return resolveMediaThumbnailUrl(post.mediaUrl, post.type, post.thumbnailUrl, baseUrl);
}

function resolveStoryThumbnailUrl(story: Story, baseUrl: string): string | undefined {
  return resolveMediaThumbnailUrl(story.mediaUrl, story.type, story.thumbnailUrl, baseUrl);
}

// API CORS, Preflight & Cache-Control Middleware
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');

  if (req.path.startsWith('/auth') || req.path.startsWith('/admin') || req.path === '/health') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Increase payload limit for media uploads
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ limit: '150mb', extended: true }));

// Return clean JSON error if request body contains malformed JSON
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err && err.type === 'entity.parse.failed' && req.path.startsWith('/api')) {
    return res.status(400).json({ error: 'Formato de pedido inválido (JSON malformado).' });
  }
  next(err);
});

// Dedicated HTTP Range (206 Partial Content + ETag + Last-Modified + If-Range) Streaming Handler
app.options('/uploads/:filename', (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, If-Range, If-None-Match, If-Modified-Since, Content-Type, Accept');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Type, ETag, Last-Modified');
  return res.sendStatus(204);
});

app.get('/uploads/:filename', (req: Request, res: Response, next: NextFunction) => {
  const safeName = path.basename(req.params.filename);
  // Never serve temporary in-progress transcode files
  if (safeName.includes('.tmp.')) {
    return res.status(404).end();
  }

  const filePath = path.join(UPLOADS_DIR, safeName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Ficheiro multimédia não encontrado.' });
  }

  const lower = safeName.toLowerCase();
  const videoMimeMap: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.m4v': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.3gp': 'video/3gpp'
  };

  const ext = path.extname(lower);
  const contentType = videoMimeMap[ext];

  if (!contentType) {
    return next();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Type, ETag, Last-Modified');
  res.setHeader('Content-Type', contentType);

  // Express sendFile natively handles HTTP 206 Partial Content, Accept-Ranges: bytes, ETag, Last-Modified, If-Range & 304 caching
  return res.sendFile(
    filePath,
    {
      acceptRanges: true,
      etag: true,
      lastModified: true,
      cacheControl: true,
      maxAge: 7 * 24 * 60 * 60 * 1000
    },
    (err) => {
      if (err && !res.headersSent) {
        const status = (err as any).status || (err as any).statusCode || 500;
        res.status(status).end();
      }
    }
  );
});

// Serve uploaded images/thumbnails statically with caching
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '1d',
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');
  }
}));

// Types
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
}

export interface Story {
  id: string;
  title: string;
  type: 'photo' | 'video';
  mediaUrl: string;
  thumbnailUrl?: string;
  createdAt: string;
  expiresAt: string; // ISO 8601 string: exactly 24 hours after createdAt
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

export interface LikeRecord {
  postId: string;
  visitorId: string;
  createdAt: string;
}

export interface CommentLikeRecord {
  commentId: string;
  visitorId: string;
  createdAt: string;
}

export type StoryReactionType = 'heart' | 'haha' | 'wow' | 'sad' | 'fire' | 'like';

const VALID_STORY_REACTIONS: ReadonlySet<StoryReactionType> = new Set([
  'heart',
  'haha',
  'wow',
  'sad',
  'fire',
  'like'
]);

export interface StoryReactionRecord {
  storyId: string;
  visitorId: string;
  type: StoryReactionType;
  createdAt: string;
  updatedAt?: string;
}

export interface StoryComment {
  id: string;
  storyId: string;
  parentId?: string;
  authorName?: string;
  visitorId?: string;
  text: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorName?: string;
  visitorId?: string;
  text: string;
  createdAt: string;
  likesCount?: number;
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

export interface AdminSession {
  token: string;
  email: string;
  createdAt: number;
  expiresAt: number;
}

export interface DatabaseSchema {
  posts: Post[];
  stories: Story[];
  activities: Activity[];
  likes: LikeRecord[];
  comments: Comment[];
  commentLikes?: CommentLikeRecord[];
  storyReactions?: StoryReactionRecord[];
  storyComments?: StoryComment[];
  contactMessages: ContactMessage[];
  sessions: AdminSession[];
  totalViews?: number;
}

// Server-side authorized admin credentials (never exposed to frontend)
const DEFAULT_ADMIN_EMAILS = [
  'antoniopakissialfredo@gmail.com',
  'antoniopakissialfredo4@gmail.com'
];

function getAuthorizedAdminEmails(): string[] {
  const envEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0 && e !== 'admin@example.com');
  return Array.from(new Set([...DEFAULT_ADMIN_EMAILS.map(e => e.toLowerCase()), ...envEmails]));
}

function getAuthorizedAdminPassword(): string {
  const envPass = (process.env.ADMIN_PASSWORD || '').trim();
  if (envPass && envPass !== 'CHANGE_ME_STRONG_PASSWORD') {
    return envPass;
  }
  return 'stenio21';
}

function verifyPasswordTimingSafe(candidate: string, expected: string): boolean {
  const hashA = crypto.createHash('sha256').update(String(candidate)).digest();
  const hashB = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

// Per-IP brute-force protection for /api/auth/login
interface LoginRateRecord {
  failures: number;
  resetAt: number;
}
const loginRateLimiter = new Map<string, LoginRateRecord>();
const LOGIN_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const LOGIN_MAX_FAILURES = 15;

// Initial empty database schema for VIDEOMAKER Fernando Kibuba
function getSeedData(): DatabaseSchema {
  return {
    posts: [],
    stories: [],
    activities: [],
    likes: [],
    comments: [],
    commentLikes: [],
    storyReactions: [],
    storyComments: [],
    contactMessages: [],
    sessions: [],
    totalViews: 0
  };
}

// In-memory cached database for fast non-blocking reads during video streaming
let dbCache: DatabaseSchema | null = null;
let dbCacheMtimeMs = 0;
let pendingFlushTimer: ReturnType<typeof setTimeout> | null = null;

// Read database
function readDB(): DatabaseSchema {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = getSeedData();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      dbCache = initial;
      dbCacheMtimeMs = fs.statSync(DB_FILE).mtimeMs;
      return initial;
    }

    const stat = fs.statSync(DB_FILE);
    if (dbCache && stat.mtimeMs === dbCacheMtimeMs) {
      return dbCache;
    }

    const data = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(data) as DatabaseSchema;

    if (!parsed.posts) parsed.posts = [];
    if (!parsed.stories) parsed.stories = [];
    if (!parsed.activities) parsed.activities = [];
    if (!parsed.likes) parsed.likes = [];
    if (!parsed.comments) parsed.comments = [];
    if (!parsed.commentLikes) parsed.commentLikes = [];
    if (!parsed.storyReactions) parsed.storyReactions = [];
    if (!parsed.storyComments) parsed.storyComments = [];
    if (!parsed.contactMessages) parsed.contactMessages = [];
    if (!parsed.sessions) parsed.sessions = [];
    if (typeof parsed.totalViews !== 'number') parsed.totalViews = 0;

    dbCache = parsed;
    dbCacheMtimeMs = stat.mtimeMs;
    return parsed;
  } catch (err) {
    console.error('Error reading database, using seed:', err);
    return dbCache || getSeedData();
  }
}

// Helper: Get public comments for a post with authorName and real like counts, newest first
function getPublicCommentsForPost(db: DatabaseSchema, postId: string): Comment[] {
  const commentLikes = db.commentLikes || [];
  return db.comments
    .filter(c => c.postId === postId)
    .map(c => ({
      id: c.id,
      postId: c.postId,
      ...(c.authorName ? { authorName: c.authorName } : {}),
      text: c.text,
      createdAt: c.createdAt,
      likesCount: commentLikes.filter(cl => cl.commentId === c.id).length
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// Write database atomically and update cache
function writeDB(data: DatabaseSchema): void {
  try {
    if (pendingFlushTimer) {
      clearTimeout(pendingFlushTimer);
      pendingFlushTimer = null;
    }
    dbCache = data;
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
    dbCacheMtimeMs = fs.statSync(DB_FILE).mtimeMs;
  } catch (err) {
    console.error('Error writing to database:', err);
  }
}

// Non-blocking debounced write for lightweight counters (e.g., totalViews)
function scheduleWriteDB(data: DatabaseSchema): void {
  dbCache = data;
  if (pendingFlushTimer) return;
  pendingFlushTimer = setTimeout(() => {
    pendingFlushTimer = null;
    if (dbCache) {
      fs.promises
        .writeFile(`${DB_FILE}.tmp.views`, JSON.stringify(dbCache, null, 2), 'utf-8')
        .then(() => fs.promises.rename(`${DB_FILE}.tmp.views`, DB_FILE))
        .then(() => fs.promises.stat(DB_FILE))
        .then(s => {
          dbCacheMtimeMs = s.mtimeMs;
        })
        .catch(() => {});
    }
  }, 2000);
}

// Helper: Sanitize string to prevent XSS
function sanitizeText(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

// Helper: Check if story is active (< 24 hours old)
function isStoryActive(story: Story): boolean {
  const expiresAt = new Date(story.expiresAt).getTime();
  return !isNaN(expiresAt) && expiresAt > Date.now();
}

// Helper: Automatically purge stories older than 24 hours AND their associated reactions/comments
function pruneExpiredStories(db: DatabaseSchema): boolean {
  const beforeStories = db.stories.length;
  db.stories = db.stories.filter(isStoryActive);
  const activeIds = new Set(db.stories.map(s => s.id));

  const prevReactionsLen = (db.storyReactions || []).length;
  db.storyReactions = (db.storyReactions || []).filter(r => activeIds.has(r.storyId));

  const prevCommentsLen = (db.storyComments || []).length;
  db.storyComments = (db.storyComments || []).filter(c => activeIds.has(c.storyId));

  return (
    db.stories.length !== beforeStories ||
    db.storyReactions.length !== prevReactionsLen ||
    db.storyComments.length !== prevCommentsLen
  );
}

// Helper: Compute reaction summary & comments for a single Story
function getStoryInteractionsSummary(db: DatabaseSchema, storyId: string, visitorId?: string) {
  const reactions = (db.storyReactions || []).filter(r => r.storyId === storyId);
  const reactionBreakdown: Partial<Record<StoryReactionType, number>> = {};
  let userReaction: StoryReactionType | null = null;

  for (const r of reactions) {
    reactionBreakdown[r.type] = (reactionBreakdown[r.type] || 0) + 1;
    if (visitorId && r.visitorId === visitorId) {
      userReaction = r.type;
    }
  }

  const comments = (db.storyComments || [])
    .filter(c => c.storyId === storyId)
    .map(c => ({
      id: c.id,
      storyId: c.storyId,
      ...(c.parentId ? { parentId: c.parentId } : {}),
      ...(c.authorName ? { authorName: c.authorName } : {}),
      text: c.text,
      createdAt: c.createdAt
    }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return {
    reactionsCount: reactions.length,
    reactionBreakdown,
    userReaction,
    commentsCount: comments.length,
    comments
  };
}

function hydrateStoryForClient(
  db: DatabaseSchema,
  story: Story,
  baseUrl: string,
  visitorId?: string
) {
  const summary = getStoryInteractionsSummary(db, story.id, visitorId);
  return {
    ...story,
    mediaUrl: normalizeToPublicUrl(story.mediaUrl, baseUrl),
    thumbnailUrl: resolveStoryThumbnailUrl(story, baseUrl),
    reactionsCount: summary.reactionsCount,
    reactionBreakdown: summary.reactionBreakdown,
    userReaction: summary.userReaction,
    commentsCount: summary.commentsCount,
    comments: summary.comments
  };
}

// Admin Authentication Middleware (strict server-side session verification)
function authenticateAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Acesso não autorizado. Inicie sessão como Administrador.' });
    }

    const token = authHeader.slice(7).trim();
    if (!token || token.length < 32) {
      return res.status(401).json({ error: 'Token de sessão inválido. Inicie sessão novamente.' });
    }

    const db = readDB();
    const allowedEmails = getAuthorizedAdminEmails();
    const session = db.sessions.find(
      s => s.token === token && s.expiresAt > Date.now() && allowedEmails.includes(s.email.toLowerCase())
    );

    if (!session) {
      return res.status(403).json({ error: 'Sessão expirada ou inválida. Por favor, faça login novamente.' });
    }

    (req as any).adminEmail = session.email;
    next();
  } catch (err) {
    console.error('Error verifying admin session:', err);
    return res.status(500).json({ error: 'Erro interno ao verificar permissões de administrador.' });
  }
}

// ==========================================
// API ROUTES
// ==========================================

// 0. HEALTH & CONNECTION WARM-UP ENDPOINT
app.get('/api/health', (_req: Request, res: Response) => {
  return res.status(200).json({
    ok: true,
    service: 'videomaker-fernando-kibuba-api',
    timestamp: Date.now()
  });
});

// 1. AUTHENTICATION
app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const clientIp = (req.ip || req.headers['x-forwarded-for'] || 'unknown').toString();
    const now = Date.now();

    // Clean expired rate-limit records
    const rateEntry = loginRateLimiter.get(clientIp);
    if (rateEntry && rateEntry.resetAt <= now) {
      loginRateLimiter.delete(clientIp);
    } else if (rateEntry && rateEntry.failures >= LOGIN_MAX_FAILURES) {
      return res.status(429).json({
        error: 'Demasiadas tentativas de início de sessão falhadas. Por favor, aguarde alguns minutos e tente novamente.'
      });
    }

    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Por favor, preencha o e-mail e a palavra-passe.' });
    }

    const normalizedEmail = email.toLowerCase();
    const allowedEmails = getAuthorizedAdminEmails();
    const expectedPassword = getAuthorizedAdminPassword();

    const isEmailValid = allowedEmails.includes(normalizedEmail);
    const isPasswordValid = verifyPasswordTimingSafe(password, expectedPassword);

    if (!isEmailValid || !isPasswordValid) {
      const current = loginRateLimiter.get(clientIp);
      if (current && current.resetAt > now) {
        current.failures += 1;
      } else {
        loginRateLimiter.set(clientIp, { failures: 1, resetAt: now + LOGIN_WINDOW_MS });
      }
      console.warn(`[AUTH] Tentativa de login recusada para: ${normalizedEmail} (${clientIp})`);
      return res.status(401).json({
        error: 'E-mail ou palavra-passe incorretos. Verifique as suas credenciais de administrador.'
      });
    }

    // Clear failed attempts on successful login
    loginRateLimiter.delete(clientIp);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days session

    const db = readDB();
    // Clean expired sessions & cap active sessions per email to 15 to keep db lean
    const validSessions = (db.sessions || []).filter(s => s && s.expiresAt > now);
    const otherSessions = validSessions.filter(s => s.email !== normalizedEmail);
    const sameAdminSessions = validSessions.filter(s => s.email === normalizedEmail).slice(-14);

    db.sessions = [
      ...otherSessions,
      ...sameAdminSessions,
      {
        token,
        email: normalizedEmail,
        createdAt: now,
        expiresAt
      }
    ];
    writeDB(db);

    return res.status(200).json({
      success: true,
      token,
      admin: {
        email: normalizedEmail,
        name: 'Fernando Kibuba — Videomaker',
        role: 'ADMIN'
      }
    });
  } catch (err) {
    console.error('[AUTH] Erro interno no login do administrador:', err);
    return res.status(500).json({
      error: 'Erro interno no servidor de autenticação. Por favor, tente novamente dentro de instantes.'
    });
  }
});

// Explicit handler if an upstream proxy redirect ever converts POST /api/auth/login into GET
app.get('/api/auth/login', (_req: Request, res: Response) => {
  return res.status(405).json({
    error: 'Método inválido. Utilize POST para iniciar sessão.',
    retryable: true
  });
});

app.get('/api/auth/verify', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ authenticated: false });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ authenticated: false });
    }

    const db = readDB();
    const allowedEmails = getAuthorizedAdminEmails();
    const session = (db.sessions || []).find(
      s => s.token === token && s.expiresAt > Date.now() && allowedEmails.includes(s.email.toLowerCase())
    );

    if (!session) {
      return res.status(401).json({ authenticated: false });
    }

    return res.status(200).json({
      authenticated: true,
      admin: {
        email: session.email,
        name: 'Fernando Kibuba — Videomaker',
        role: 'ADMIN'
      }
    });
  } catch (err) {
    console.error('[AUTH] Erro ao verificar sessão:', err);
    return res.status(500).json({ authenticated: false, error: 'Erro interno ao validar sessão.' });
  }
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const db = readDB();
      db.sessions = (db.sessions || []).filter(s => s.token !== token);
      writeDB(db);
    }
    return res.status(200).json({ success: true, message: 'Sessão encerrada com sucesso.' });
  } catch (err) {
    console.error('[AUTH] Erro ao terminar sessão:', err);
    return res.status(200).json({ success: true });
  }
});

// 2. FILE UPLOADS (Direct mobile/desktop streaming via Multer or Base64 fallback)
app.post('/api/upload', authenticateAdmin, (req: Request, res: Response, next: NextFunction) => {
  uploadMiddleware.single('file')(req, res, (err: any) => {
    if (err) {
      console.error('Multer upload error:', err);
      return res.status(400).json({ error: 'Erro ao receber ficheiro: ' + err.message });
    }
    next();
  });
}, (req: Request, res: Response) => {
  try {
    const baseUrl = getPublicBaseUrl(req);
    let storedFilePath = '';
    let filename = '';
    let mimeType = '';
    let baseId = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    let ext = '.mp4';
    let fileSize = 0;

    // Direct streaming upload from mobile or desktop
    if (req.file) {
      storedFilePath = req.file.path;
      filename = req.file.originalname;
      mimeType = req.file.mimetype;
      ext = path.extname(filename).toLowerCase() || '.mp4';
      fileSize = req.file.size;
      baseId = path.basename(req.file.filename, path.extname(req.file.filename)).replace('_raw', '');
    }
    // Base64 JSON fallback
    else if (req.body && req.body.data) {
      const { data, filename: bodyFilename, mimeType: bodyMimeType } = req.body;
      filename = bodyFilename || `file-${Date.now()}.mp4`;
      mimeType = bodyMimeType || 'video/mp4';
      ext = path.extname(filename).toLowerCase() || '.jpg';
      const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      const buffer = (matches && matches.length === 3) ? Buffer.from(matches[2], 'base64') : Buffer.from(data, 'base64');
      const storedFileName = `${baseId}_raw${ext}`;
      storedFilePath = path.join(UPLOADS_DIR, storedFileName);
      fs.writeFileSync(storedFilePath, buffer);
      fileSize = buffer.length;
    } else {
      return res.status(400).json({ error: 'Nenhum ficheiro recebido.' });
    }

    const isVideo = (mimeType && mimeType.startsWith('video/')) ||
      /\.(mp4|mov|mkv|avi|webm|flv|wmv|mts|m2ts|3gp|m4v|ts)$/i.test(filename);

    let finalStoredName = path.basename(storedFilePath);
    let thumbStoredName: string | undefined = undefined;

    let hd720StoredName: string | undefined = undefined;

    if (isVideo) {
      const isStoryUpload =
        req.query.context === 'story' || (req.body && req.body.context === 'story');
      const mp4PrimaryName = `${baseId}_1080p.mp4`;
      const mp4PrimaryTmpPath = path.join(UPLOADS_DIR, `${baseId}_1080p.tmp.mp4`);
      const mp4PrimaryPath = path.join(UPLOADS_DIR, mp4PrimaryName);
      const mp4MobileName = `${baseId}_480p.mp4`;
      const mp4MobileTmpPath = path.join(UPLOADS_DIR, `${baseId}_480p.tmp.mp4`);
      const mp4MobilePath = path.join(UPLOADS_DIR, mp4MobileName);

      try {
        // Probe source bitrate so phone videos are never bloated to higher bitrates than necessary
        let sourceBitrateKbps = 1200;
        try {
          const probeOut = execSync(
            `ffprobe -v error -show_entries format=bit_rate -of default=noprint_wrappers=1:nokey=1 "${storedFilePath}"`,
            { timeout: 8000, encoding: 'utf-8' }
          ).trim();
          const parsedBps = parseInt(probeOut, 10);
          if (!isNaN(parsedBps) && parsedBps > 0) {
            sourceBitrateKbps = Math.round(parsedBps / 1000);
          }
        } catch {
          // Fallback to default cap
        }

        const maxCapKbps = isStoryUpload ? 1200 : 1400;
        const targetMaxKbps = Math.min(maxCapKbps, Math.max(550, Math.round(sourceBitrateKbps * 1.05)));
        const targetBufKbps = targetMaxKbps * 2;
        const preset = isStoryUpload ? 'ultrafast' : 'veryfast';
        const scaleFilter = isStoryUpload
          ? "scale='min(1080,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2"
          : "scale='min(1280,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2";

        // Encode to an atomic .tmp.mp4 first with:
        // - H.264 Main L3.1 + yuv420p + <=30fps + 2s keyframes (-g 60) for universal Android/iOS hardware decoding
        // - aresample=async=1:first_pts=0 so both audio & video start at 0.000000s (eliminates Android MediaCodec sync stalls)
        // - +faststart so metadata (moov atom) is at byte 0 for instant HTTP 206 Range streaming
        execSync(
          `ffmpeg -i "${storedFilePath}" -vf "${scaleFilter}" -r 30 -c:v libx264 -profile:v main -level 3.1 -preset ${preset} -crf 25 -maxrate ${targetMaxKbps}k -bufsize ${targetBufKbps}k -g 60 -keyint_min 30 -pix_fmt yuv420p -af "aresample=async=1:first_pts=0" -c:a aac -b:a 96k -ac 2 -ar 44100 -movflags +faststart "${mp4PrimaryTmpPath}" -y`,
          { timeout: 120000, stdio: 'ignore' }
        );

        if (fs.existsSync(mp4PrimaryTmpPath) && fs.statSync(mp4PrimaryTmpPath).size > 0) {
          fs.renameSync(mp4PrimaryTmpPath, mp4PrimaryPath);
          finalStoredName = mp4PrimaryName;
          fileSize = fs.statSync(mp4PrimaryPath).size;

          if (!isStoryUpload) {
            hd720StoredName = mp4MobileName;
            // Generate lightweight 480p mobile variant via atomic .tmp.mp4 + single thread (never exposes incomplete file or starves CPU)
            exec(
              `ffmpeg -threads 1 -i "${storedFilePath}" -vf "scale='min(854,iw)':'min(854,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2" -r 30 -c:v libx264 -profile:v baseline -level 3.0 -preset veryfast -crf 27 -maxrate 500k -bufsize 1000k -g 60 -keyint_min 30 -pix_fmt yuv420p -af "aresample=async=1:first_pts=0" -c:a aac -b:a 64k -ac 2 -ar 44100 -movflags +faststart "${mp4MobileTmpPath}" -y`,
              { timeout: 180000 },
              (bgErr) => {
                try {
                  if (!bgErr && fs.existsSync(mp4MobileTmpPath) && fs.statSync(mp4MobileTmpPath).size > 0) {
                    fs.renameSync(mp4MobileTmpPath, mp4MobilePath);
                  } else if (fs.existsSync(mp4MobileTmpPath)) {
                    fs.unlinkSync(mp4MobileTmpPath);
                  }
                } catch {}
              }
            );
          }
        }
      } catch (transcodeErr) {
        try {
          if (fs.existsSync(mp4PrimaryTmpPath)) fs.unlinkSync(mp4PrimaryTmpPath);
        } catch {}
        console.warn('FFmpeg transcoding fallback to original uploaded video:', transcodeErr);
      }

      // Generate lightweight preview thumbnail image (with fallback to 0.0s for very short clips)
      try {
        const thumbName = `${baseId}_thumb.jpg`;
        const thumbPath = path.join(UPLOADS_DIR, thumbName);
        try {
          execSync(
            `ffmpeg -ss 00:00:00.5 -i "${storedFilePath}" -vf "scale='min(1280,iw)':-2" -vframes 1 -q:v 4 "${thumbPath}" -y`,
            { timeout: 12000, stdio: 'ignore' }
          );
        } catch {
          execSync(
            `ffmpeg -ss 00:00:00 -i "${storedFilePath}" -vf "scale='min(1280,iw)':-2" -vframes 1 -q:v 4 "${thumbPath}" -y`,
            { timeout: 12000, stdio: 'ignore' }
          );
        }

        if (fs.existsSync(thumbPath) && fs.statSync(thumbPath).size > 0) {
          thumbStoredName = thumbName;
        }
      } catch (thumbErr) {
        console.warn('Thumbnail generation skipped:', thumbErr);
      }
    }

    // REAL, FULL PUBLIC HTTPS URLS (accessible to all visitors)
    const realPublicUrl = `${baseUrl}/uploads/${finalStoredName}`;
    const realHd720Url = hd720StoredName ? `${baseUrl}/uploads/${hd720StoredName}` : undefined;
    const realThumbnailUrl = thumbStoredName ? `${baseUrl}/uploads/${thumbStoredName}` : undefined;

    return res.json({
      success: true,
      url: realPublicUrl,
      hdUrl: realHd720Url,
      quality: '1080p',
      thumbnailUrl: realThumbnailUrl,
      filename: finalStoredName,
      size: fileSize
    });
  } catch (err: any) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Falha ao processar o carregamento do ficheiro: ' + err.message });
  }
});

// 3. POSTS (Photos & Videos)
app.get('/api/posts', (req: Request, res: Response) => {
  const db = readDB();
  db.totalViews = (db.totalViews || 0) + 1;
  scheduleWriteDB(db);

  const baseUrl = getPublicBaseUrl(req);
  const sorted = [...db.posts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const normalized = sorted.map(p => ({
    ...p,
    mediaUrl: normalizeToPublicUrl(p.mediaUrl, baseUrl),
    thumbnailUrl: resolvePostThumbnailUrl(p, baseUrl),
    comments: getPublicCommentsForPost(db, p.id)
  }));
  return res.json(normalized);
});

app.get('/api/posts/:id', (req: Request, res: Response) => {
  const db = readDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) {
    return res.status(404).json({ error: 'Publicação não encontrada.' });
  }
  const baseUrl = getPublicBaseUrl(req);
  const comments = getPublicCommentsForPost(db, post.id);

  return res.json({
    ...post,
    mediaUrl: normalizeToPublicUrl(post.mediaUrl, baseUrl),
    thumbnailUrl: resolvePostThumbnailUrl(post, baseUrl),
    comments
  });
});

app.post('/api/posts', authenticateAdmin, (req: Request, res: Response) => {
  let { title, description, type, mediaUrl, thumbnailUrl, category, activityName, location, featured } = req.body;

  if (!title || !mediaUrl || !type) {
    return res.status(400).json({ error: 'Título, tipo e ficheiro multimédia são obrigatórios.' });
  }

  const baseUrl = getPublicBaseUrl(req);
  const postType: 'photo' | 'video' = type === 'video' ? 'video' : 'photo';

  // Normalize relative paths to real public URLs
  mediaUrl = normalizeToPublicUrl(mediaUrl, baseUrl);
  if (thumbnailUrl) {
    thumbnailUrl = normalizeToPublicUrl(thumbnailUrl, baseUrl);
  }

  // Never store a video URL as thumbnailUrl!
  const safeInitialThumb =
    postType === 'video'
      ? (thumbnailUrl && thumbnailUrl !== mediaUrl && !/\.(mp4|webm|mov|m4v|mkv|avi)(\?.*)?$/i.test(thumbnailUrl)
          ? thumbnailUrl
          : undefined)
      : (thumbnailUrl || mediaUrl);

  const db = readDB();
  const newPost: Post = {
    id: `post-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    title: sanitizeText(title),
    description: sanitizeText(description || ''),
    type: postType,
    mediaUrl,
    thumbnailUrl: safeInitialThumb,
    category: category || 'Geral',
    activityName: sanitizeText(activityName || ''),
    location: sanitizeText(location || 'Igreja Metodista de Fernando Kibuba'),
    createdAt: new Date().toISOString(),
    likesCount: 0,
    featured: Boolean(featured)
  };
  newPost.thumbnailUrl = resolvePostThumbnailUrl(newPost, baseUrl);

  db.posts.unshift(newPost);
  writeDB(db);

  return res.status(201).json(newPost);
});

app.put('/api/posts/:id', authenticateAdmin, (req: Request, res: Response) => {
  const { title, description, category, activityName, location, featured, mediaUrl, thumbnailUrl, type } = req.body;
  const db = readDB();
  const postIndex = db.posts.findIndex(p => p.id === req.params.id);

  if (postIndex === -1) {
    return res.status(404).json({ error: 'Publicação não encontrada.' });
  }

  const existing = db.posts[postIndex];
  db.posts[postIndex] = {
    ...existing,
    title: title !== undefined ? sanitizeText(title) : existing.title,
    description: description !== undefined ? sanitizeText(description) : existing.description,
    category: category !== undefined ? category : existing.category,
    activityName: activityName !== undefined ? sanitizeText(activityName) : existing.activityName,
    location: location !== undefined ? sanitizeText(location) : existing.location,
    featured: featured !== undefined ? Boolean(featured) : existing.featured,
    mediaUrl: mediaUrl || existing.mediaUrl,
    thumbnailUrl: thumbnailUrl || existing.thumbnailUrl,
    type: type || existing.type
  };

  writeDB(db);
  return res.json(db.posts[postIndex]);
});

app.delete('/api/posts/:id', authenticateAdmin, (req: Request, res: Response) => {
  const db = readDB();
  const postId = req.params.id;
  const initialLength = db.posts.length;

  db.posts = db.posts.filter(p => p.id !== postId);
  if (db.posts.length === initialLength) {
    return res.status(404).json({ error: 'Publicação não encontrada.' });
  }

  // Also clean associated comments, comment likes, and post likes
  const removedCommentIds = new Set(
    db.comments.filter(c => c.postId === postId).map(c => c.id)
  );
  db.comments = db.comments.filter(c => c.postId !== postId);
  db.commentLikes = (db.commentLikes || []).filter(cl => !removedCommentIds.has(cl.commentId));
  db.likes = db.likes.filter(l => l.postId !== postId);

  writeDB(db);
  return res.json({ success: true, message: 'Publicação e conteúdos associados apagados com sucesso.' });
});

// 4. LIKES SYSTEM (Deduplicated with visitorId)
app.post('/api/posts/:id/like', (req: Request, res: Response) => {
  const postId = req.params.id;
  const { visitorId } = req.body;

  if (!visitorId) {
    return res.status(400).json({ error: 'Identificador de visitante necessário.' });
  }

  const db = readDB();
  const post = db.posts.find(p => p.id === postId);
  if (!post) {
    return res.status(404).json({ error: 'Publicação não encontrada.' });
  }

  // Check if visitor has already liked this post
  const existingLikeIndex = db.likes.findIndex(l => l.postId === postId && l.visitorId === visitorId);

  let userLiked = false;
  if (existingLikeIndex !== -1) {
    // Visitor already liked -> toggle unlike
    db.likes.splice(existingLikeIndex, 1);
    post.likesCount = Math.max(0, (post.likesCount || 1) - 1);
    userLiked = false;
  } else {
    // Register like
    db.likes.push({
      postId,
      visitorId,
      createdAt: new Date().toISOString()
    });
    post.likesCount = (post.likesCount || 0) + 1;
    userLiked = true;
  }

  writeDB(db);
  return res.json({
    success: true,
    likesCount: post.likesCount,
    userLiked
  });
});

// Check like statuses for multiple posts for a visitor
app.get('/api/likes/status', (req: Request, res: Response) => {
  const visitorId = req.query.visitorId as string;
  if (!visitorId) {
    return res.json({ likedPostIds: [] });
  }

  const db = readDB();
  const likedPostIds = db.likes
    .filter(l => l.visitorId === visitorId)
    .map(l => l.postId);

  return res.json({ likedPostIds });
});

// 5. COMMENTS SYSTEM (Profile-free, Instagram-inspired with comment likes)
app.get('/api/posts/:id/comments', (req: Request, res: Response) => {
  const db = readDB();
  const comments = getPublicCommentsForPost(db, req.params.id);
  return res.json(comments);
});

app.post('/api/posts/:id/comments', (req: Request, res: Response) => {
  const postId = req.params.id;
  const { text, authorName, visitorId, honeypot } = req.body || {};

  // Anti-spam honeypot
  if (honeypot) {
    return res.status(400).json({ error: 'Submissão suspeita rejeitada.' });
  }

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'O comentário não pode estar vazio.' });
  }

  const sanitizedText = text.replace(/[<>]/g, '').trim().substring(0, 1500);
  if (!sanitizedText) {
    return res.status(400).json({ error: 'O comentário não pode estar vazio.' });
  }

  const sanitizedAuthor =
    typeof authorName === 'string' && authorName.trim()
      ? authorName.replace(/[<>]/g, '').trim().substring(0, 80)
      : undefined;

  const cleanVisitorId =
    typeof visitorId === 'string' && visitorId.trim()
      ? visitorId.trim().substring(0, 100)
      : undefined;

  const db = readDB();
  const post = db.posts.find(p => p.id === postId);
  if (!post) {
    return res.status(404).json({ error: 'Publicação não encontrada.' });
  }

  const newComment: Comment = {
    id: `comm-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    postId,
    ...(sanitizedAuthor ? { authorName: sanitizedAuthor } : {}),
    ...(cleanVisitorId ? { visitorId: cleanVisitorId } : {}),
    text: sanitizedText,
    createdAt: new Date().toISOString(),
    likesCount: 0
  };

  db.comments.push(newComment);
  writeDB(db);

  const publicComment: Comment = {
    id: newComment.id,
    postId: newComment.postId,
    ...(newComment.authorName ? { authorName: newComment.authorName } : {}),
    text: newComment.text,
    createdAt: newComment.createdAt,
    likesCount: 0
  };

  return res.status(201).json(publicComment);
});

// Update visitor display name on previously published comments from the same browser visitorId
app.put('/api/visitor/profile', (req: Request, res: Response) => {
  const { visitorId, authorName } = req.body || {};
  if (!visitorId || typeof visitorId !== 'string' || !visitorId.trim()) {
    return res.status(400).json({ error: 'Identificador de visitante inválido.' });
  }
  if (!authorName || typeof authorName !== 'string' || !authorName.trim()) {
    return res.status(400).json({ error: 'O nome não pode estar vazio.' });
  }

  const cleanVisitorId = visitorId.trim().substring(0, 100);
  const sanitizedAuthor = authorName.replace(/[<>]/g, '').trim().substring(0, 80);
  if (!sanitizedAuthor) {
    return res.status(400).json({ error: 'O nome introduzido é inválido.' });
  }

  const db = readDB();
  let updatedCount = 0;

  for (const c of db.comments) {
    if (c.visitorId === cleanVisitorId && c.authorName !== sanitizedAuthor) {
      c.authorName = sanitizedAuthor;
      updatedCount++;
    }
  }

  for (const sc of db.storyComments || []) {
    if (sc.visitorId === cleanVisitorId && sc.authorName !== sanitizedAuthor) {
      sc.authorName = sanitizedAuthor;
      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    writeDB(db);
  }

  return res.json({ success: true, authorName: sanitizedAuthor, updatedCount });
});

// Toggle like on an individual comment (deduplicated per visitorId)
app.post('/api/comments/:id/like', (req: Request, res: Response) => {
  const commentId = req.params.id;
  const { visitorId } = req.body;

  if (!visitorId || typeof visitorId !== 'string') {
    return res.status(400).json({ error: 'Identificador de visitante necessário.' });
  }

  const db = readDB();
  const comment = db.comments.find(c => c.id === commentId);
  if (!comment) {
    return res.status(404).json({ error: 'Comentário não encontrado.' });
  }

  if (!db.commentLikes) db.commentLikes = [];

  const existingIndex = db.commentLikes.findIndex(
    cl => cl.commentId === commentId && cl.visitorId === visitorId
  );

  let userLiked = false;
  if (existingIndex !== -1) {
    db.commentLikes.splice(existingIndex, 1);
    userLiked = false;
  } else {
    db.commentLikes.push({
      commentId,
      visitorId,
      createdAt: new Date().toISOString()
    });
    userLiked = true;
  }

  const likesCount = db.commentLikes.filter(cl => cl.commentId === commentId).length;
  comment.likesCount = likesCount;

  writeDB(db);
  return res.json({
    success: true,
    likesCount,
    userLiked
  });
});

// Get liked comment IDs for a visitor
app.get('/api/comments/likes/status', (req: Request, res: Response) => {
  const visitorId = req.query.visitorId as string;
  if (!visitorId) {
    return res.json({ likedCommentIds: [] });
  }

  const db = readDB();
  const likedCommentIds = (db.commentLikes || [])
    .filter(cl => cl.visitorId === visitorId)
    .map(cl => cl.commentId);

  return res.json({ likedCommentIds });
});

app.delete('/api/comments/:id', authenticateAdmin, (req: Request, res: Response) => {
  const db = readDB();
  const commentId = req.params.id;
  const initialLength = db.comments.length;
  db.comments = db.comments.filter(c => c.id !== commentId);

  if (db.comments.length === initialLength) {
    return res.status(404).json({ error: 'Comentário não encontrado.' });
  }

  db.commentLikes = (db.commentLikes || []).filter(cl => cl.commentId !== commentId);

  writeDB(db);
  return res.json({ success: true, message: 'Comentário apagado pelo administrador.' });
});

// Admin get all comments for moderation
app.get('/api/admin/comments', authenticateAdmin, (_req: Request, res: Response) => {
  const db = readDB();
  const commentLikes = db.commentLikes || [];
  const commentsWithPost = db.comments.map(c => {
    const post = db.posts.find(p => p.id === c.postId);
    return {
      id: c.id,
      postId: c.postId,
      ...(c.authorName ? { authorName: c.authorName } : {}),
      text: c.text,
      createdAt: c.createdAt,
      likesCount: commentLikes.filter(cl => cl.commentId === c.id).length,
      postTitle: post ? post.title : 'Publicação Removida'
    };
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json(commentsWithPost);
});

// 6. 24-HOUR STORIES (Unlimited count — NO 10-story cap; auto-expires after 24 hours + Reactions & Comments)
// Public route returns ALL active stories (< 24 hours old) in chronological order with reactions & comments
app.get('/api/stories', (req: Request, res: Response) => {
  const db = readDB();
  if (pruneExpiredStories(db)) {
    scheduleWriteDB(db);
  }
  const baseUrl = getPublicBaseUrl(req);
  const visitorId = typeof req.query.visitorId === 'string' ? req.query.visitorId : undefined;
  const activeStories = db.stories
    .filter(isStoryActive)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map(s => hydrateStoryForClient(db, s, baseUrl, visitorId));

  return res.json(activeStories);
});

// Admin get all active 24h stories (expired stories & interactions auto-pruned)
app.get('/api/admin/stories', authenticateAdmin, (req: Request, res: Response) => {
  const db = readDB();
  if (pruneExpiredStories(db)) {
    scheduleWriteDB(db);
  }
  const baseUrl = getPublicBaseUrl(req);
  const storiesWithStatus = db.stories
    .filter(isStoryActive)
    .map(s => ({
      ...hydrateStoryForClient(db, s, baseUrl),
      isActive: true,
      remainingMs: Math.max(0, new Date(s.expiresAt).getTime() - Date.now())
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json(storiesWithStatus);
});

// Supports BOTH single Story creation AND batch creation of unlimited Stories in a single operation
app.post('/api/stories', authenticateAdmin, (req: Request, res: Response) => {
  const baseUrl = getPublicBaseUrl(req);
  const db = readDB();
  pruneExpiredStories(db);

  const buildStoryObject = (
    raw: { title?: string; type?: string; mediaUrl?: string; thumbnailUrl?: string },
    offsetMs: number
  ): Story | null => {
    if (!raw || typeof raw.mediaUrl !== 'string' || !raw.mediaUrl.trim()) {
      return null;
    }

    const normalizedMedia = normalizeToPublicUrl(raw.mediaUrl.trim(), baseUrl);
    const detectedVideo =
      raw.type === 'video' ||
      /\.(mp4|webm|mov|m4v|mkv|avi|3gp|mts)(\?.*)?$/i.test(normalizedMedia) ||
      /youtube\.com|youtu\.be|vimeo\.com/i.test(normalizedMedia);
    const storyType: 'photo' | 'video' = detectedVideo ? 'video' : 'photo';

    const rawThumb =
      raw.thumbnailUrl && typeof raw.thumbnailUrl === 'string' && raw.thumbnailUrl.trim()
        ? normalizeToPublicUrl(raw.thumbnailUrl.trim(), baseUrl)
        : undefined;

    const safeInitialThumb =
      storyType === 'video'
        ? rawThumb && rawThumb !== normalizedMedia && !/\.(mp4|webm|mov|m4v|mkv|avi)(\?.*)?$/i.test(rawThumb)
          ? rawThumb
          : undefined
        : rawThumb || normalizedMedia;

    const createdMs = Date.now() + offsetMs;
    const createdDate = new Date(createdMs);
    const expiresDate = new Date(createdMs + 24 * 60 * 60 * 1000); // Automatic 24-hour expiration

    const storyObj: Story = {
      id: `story-${createdMs}-${crypto.randomBytes(4).toString('hex')}`,
      title: sanitizeText(raw.title && raw.title.trim() ? raw.title.trim() : 'Story'),
      type: storyType,
      mediaUrl: normalizedMedia,
      thumbnailUrl: safeInitialThumb,
      createdAt: createdDate.toISOString(),
      expiresAt: expiresDate.toISOString()
    };

    storyObj.thumbnailUrl = resolveStoryThumbnailUrl(storyObj, baseUrl);
    return storyObj;
  };

  // Batch mode: { stories: [...] } — NO upper limit on quantity
  if (Array.isArray(req.body?.stories)) {
    const incomingList = req.body.stories;
    if (incomingList.length === 0) {
      return res.status(400).json({ error: 'Selecione pelo menos uma fotografia ou vídeo para publicar nos Stories.' });
    }

    const createdStories: Story[] = [];
    incomingList.forEach((item: any, idx: number) => {
      const built = buildStoryObject(item, idx);
      if (built) {
        createdStories.push(built);
      }
    });

    if (createdStories.length === 0) {
      return res.status(400).json({ error: 'Nenhum ficheiro multimédia válido foi recebido para os Stories.' });
    }

    // Append all new Stories without deleting previous active Stories
    db.stories.push(...createdStories);
    writeDB(db);

    return res.status(201).json({
      success: true,
      count: createdStories.length,
      stories: createdStories.map(s => hydrateStoryForClient(db, s, baseUrl))
    });
  }

  // Single mode: { title, type, mediaUrl, thumbnailUrl }
  const singleStory = buildStoryObject(req.body, 0);
  if (!singleStory) {
    return res.status(400).json({ error: 'Ficheiro multimédia para o Story é obrigatório.' });
  }

  db.stories.push(singleStory);
  writeDB(db);

  return res.status(201).json(hydrateStoryForClient(db, singleStory, baseUrl));
});

app.delete('/api/stories/:id', authenticateAdmin, (req: Request, res: Response) => {
  const db = readDB();
  const storyId = req.params.id;
  const initialLength = db.stories.length;
  db.stories = db.stories.filter(s => s.id !== storyId);

  if (db.stories.length === initialLength) {
    return res.status(404).json({ error: 'Story não encontrado.' });
  }

  // Cascade-delete all reactions and comments associated with this Story
  db.storyReactions = (db.storyReactions || []).filter(r => r.storyId !== storyId);
  db.storyComments = (db.storyComments || []).filter(c => c.storyId !== storyId);

  writeDB(db);
  return res.json({ success: true, message: 'Story e interações associadas apagados com sucesso.' });
});

// Get fresh reactions & comments for a single active Story
app.get('/api/stories/:id/interactions', (req: Request, res: Response) => {
  const db = readDB();
  if (pruneExpiredStories(db)) {
    scheduleWriteDB(db);
  }
  const story = db.stories.find(s => s.id === req.params.id && isStoryActive(s));
  if (!story) {
    return res.status(410).json({ error: 'Este Story já expirou após 24 horas ou foi removido.' });
  }
  const visitorId = typeof req.query.visitorId === 'string' ? req.query.visitorId : undefined;
  const summary = getStoryInteractionsSummary(db, story.id, visitorId);
  return res.json({
    storyId: story.id,
    ...summary
  });
});

// React / change reaction / remove reaction on an active Story
app.post('/api/stories/:id/react', (req: Request, res: Response) => {
  const storyId = req.params.id;
  const { visitorId, type } = req.body || {};

  if (!visitorId || typeof visitorId !== 'string') {
    return res.status(400).json({ error: 'Identificador de visitante necessário.' });
  }
  if (!type || !VALID_STORY_REACTIONS.has(type as StoryReactionType)) {
    return res.status(400).json({ error: 'Tipo de reação inválido.' });
  }

  const reactionType = type as StoryReactionType;
  const db = readDB();
  const pruned = pruneExpiredStories(db);
  const story = db.stories.find(s => s.id === storyId && isStoryActive(s));

  if (!story) {
    if (pruned) writeDB(db);
    return res.status(410).json({ error: 'Este Story já expirou após 24 horas.' });
  }

  if (!db.storyReactions) db.storyReactions = [];

  const existingIndex = db.storyReactions.findIndex(
    r => r.storyId === storyId && r.visitorId === visitorId
  );

  const nowIso = new Date().toISOString();
  if (existingIndex !== -1) {
    if (db.storyReactions[existingIndex].type === reactionType) {
      // Clicking the same emoji removes the reaction
      db.storyReactions.splice(existingIndex, 1);
    } else {
      // Clicking a different emoji switches the reaction
      db.storyReactions[existingIndex].type = reactionType;
      db.storyReactions[existingIndex].updatedAt = nowIso;
    }
  } else {
    db.storyReactions.push({
      storyId,
      visitorId,
      type: reactionType,
      createdAt: nowIso
    });
  }

  writeDB(db);
  const summary = getStoryInteractionsSummary(db, storyId, visitorId);

  return res.json({
    success: true,
    storyId,
    reactionsCount: summary.reactionsCount,
    reactionBreakdown: summary.reactionBreakdown,
    userReaction: summary.userReaction
  });
});

// Get comments & replies for an active Story
app.get('/api/stories/:id/comments', (req: Request, res: Response) => {
  const db = readDB();
  if (pruneExpiredStories(db)) {
    scheduleWriteDB(db);
  }
  const story = db.stories.find(s => s.id === req.params.id && isStoryActive(s));
  if (!story) {
    return res.status(410).json({ error: 'Este Story já expirou após 24 horas.' });
  }
  const summary = getStoryInteractionsSummary(db, story.id);
  return res.json(summary.comments);
});

// Add a comment or reply with visitor name to an active Story
app.post('/api/stories/:id/comments', (req: Request, res: Response) => {
  const storyId = req.params.id;
  const { text, parentId, authorName, visitorId, honeypot } = req.body || {};

  if (honeypot) {
    return res.status(400).json({ error: 'Submissão suspeita rejeitada.' });
  }

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'O comentário não pode estar vazio.' });
  }

  const cleanText = text.replace(/[<>]/g, '').trim().substring(0, 1000);
  if (!cleanText) {
    return res.status(400).json({ error: 'O comentário não pode estar vazio.' });
  }

  const sanitizedAuthor =
    typeof authorName === 'string' && authorName.trim()
      ? authorName.replace(/[<>]/g, '').trim().substring(0, 80)
      : undefined;

  const cleanVisitorId =
    typeof visitorId === 'string' && visitorId.trim()
      ? visitorId.trim().substring(0, 100)
      : undefined;

  const db = readDB();
  const pruned = pruneExpiredStories(db);
  const story = db.stories.find(s => s.id === storyId && isStoryActive(s));

  if (!story) {
    if (pruned) writeDB(db);
    return res.status(410).json({ error: 'Este Story já expirou após 24 horas.' });
  }

  if (!db.storyComments) db.storyComments = [];

  let resolvedParentId: string | undefined = undefined;
  if (parentId && typeof parentId === 'string' && parentId.trim()) {
    const parentComment = db.storyComments.find(
      c => c.id === parentId.trim() && c.storyId === storyId
    );
    if (!parentComment) {
      return res.status(404).json({ error: 'Comentário original não encontrado neste Story.' });
    }
    resolvedParentId = parentComment.id;
  }

  const newComment: StoryComment = {
    id: `scomm-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    storyId,
    ...(resolvedParentId ? { parentId: resolvedParentId } : {}),
    ...(sanitizedAuthor ? { authorName: sanitizedAuthor } : {}),
    ...(cleanVisitorId ? { visitorId: cleanVisitorId } : {}),
    text: cleanText,
    createdAt: new Date().toISOString()
  };

  db.storyComments.push(newComment);
  writeDB(db);

  const publicStoryComment: StoryComment = {
    id: newComment.id,
    storyId: newComment.storyId,
    ...(newComment.parentId ? { parentId: newComment.parentId } : {}),
    ...(newComment.authorName ? { authorName: newComment.authorName } : {}),
    text: newComment.text,
    createdAt: newComment.createdAt
  };

  const commentsCount = db.storyComments.filter(c => c.storyId === storyId).length;
  return res.status(201).json({
    comment: publicStoryComment,
    commentsCount
  });
});

// Admin delete Story comment (also deletes any nested replies to that comment)
app.delete('/api/story-comments/:id', authenticateAdmin, (req: Request, res: Response) => {
  const db = readDB();
  pruneExpiredStories(db);
  if (!db.storyComments) db.storyComments = [];

  const target = db.storyComments.find(c => c.id === req.params.id);
  if (!target) {
    return res.status(404).json({ error: 'Comentário do Story não encontrado.' });
  }

  const toDelete = new Set<string>([target.id]);
  let added = true;
  while (added) {
    added = false;
    for (const c of db.storyComments) {
      if (c.parentId && toDelete.has(c.parentId) && !toDelete.has(c.id)) {
        toDelete.add(c.id);
        added = true;
      }
    }
  }

  db.storyComments = db.storyComments.filter(c => !toDelete.has(c.id));
  writeDB(db);

  const commentsCount = db.storyComments.filter(c => c.storyId === target.storyId).length;
  return res.json({
    success: true,
    storyId: target.storyId,
    deletedIds: Array.from(toDelete),
    commentsCount
  });
});

// Admin list all active Story comments for moderation
app.get('/api/admin/story-comments', authenticateAdmin, (_req: Request, res: Response) => {
  const db = readDB();
  if (pruneExpiredStories(db)) {
    scheduleWriteDB(db);
  }
  const activeMap = new Map(db.stories.filter(isStoryActive).map(s => [s.id, s]));
  const items = (db.storyComments || [])
    .filter(c => activeMap.has(c.storyId))
    .map(c => ({
      ...c,
      storyTitle: activeMap.get(c.storyId)?.title || 'Story'
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json(items);
});

// 7. CHURCH ACTIVITIES
app.get('/api/activities', (_req: Request, res: Response) => {
  const db = readDB();
  const today = new Date().toISOString().split('T')[0];

  const sorted = [...db.activities].sort((a, b) => {
    // Sort upcoming first, then by date
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return res.json(sorted);
});

app.post('/api/activities', authenticateAdmin, (req: Request, res: Response) => {
  const { title, description, posterUrl, date, time, location, additionalInfo } = req.body;

  if (!title || !date) {
    return res.status(400).json({ error: 'Título e data da atividade são obrigatórios.' });
  }

  const db = readDB();
  const newActivity: Activity = {
    id: `act-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    title: sanitizeText(title),
    description: sanitizeText(description || ''),
    posterUrl: posterUrl || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
    date,
    time: time || '10:00',
    location: sanitizeText(location || 'Igreja Metodista Fernando Kibuba, Luanda'),
    additionalInfo: sanitizeText(additionalInfo || ''),
    createdAt: new Date().toISOString()
  };

  db.activities.unshift(newActivity);
  writeDB(db);

  return res.status(201).json(newActivity);
});

app.put('/api/activities/:id', authenticateAdmin, (req: Request, res: Response) => {
  const { title, description, posterUrl, date, time, location, additionalInfo } = req.body;
  const db = readDB();
  const index = db.activities.findIndex(a => a.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Atividade não encontrada.' });
  }

  const existing = db.activities[index];
  db.activities[index] = {
    ...existing,
    title: title !== undefined ? sanitizeText(title) : existing.title,
    description: description !== undefined ? sanitizeText(description) : existing.description,
    posterUrl: posterUrl || existing.posterUrl,
    date: date || existing.date,
    time: time || existing.time,
    location: location !== undefined ? sanitizeText(location) : existing.location,
    additionalInfo: additionalInfo !== undefined ? sanitizeText(additionalInfo) : existing.additionalInfo
  };

  writeDB(db);
  return res.json(db.activities[index]);
});

app.delete('/api/activities/:id', authenticateAdmin, (req: Request, res: Response) => {
  const db = readDB();
  const initialLength = db.activities.length;
  db.activities = db.activities.filter(a => a.id !== req.params.id);

  if (db.activities.length === initialLength) {
    return res.status(404).json({ error: 'Atividade não encontrada.' });
  }

  writeDB(db);
  return res.json({ success: true, message: 'Atividade apagada com sucesso.' });
});

// 8. CONTACT FORM
app.post('/api/contact', (req: Request, res: Response) => {
  const { name, email, subject, message, honeypot } = req.body;

  if (honeypot) {
    return res.status(400).json({ error: 'Mensagem rejeitada por filtro de segurança.' });
  }

  if (!name || !message) {
    return res.status(400).json({ error: 'Nome e mensagem são obrigatórios.' });
  }

  const db = readDB();
  const newMsg: ContactMessage = {
    id: `msg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    name: sanitizeText(name),
    email: sanitizeText(email || ''),
    subject: sanitizeText(subject || 'Mensagem do Site'),
    message: sanitizeText(message),
    createdAt: new Date().toISOString(),
    read: false
  };

  db.contactMessages.unshift(newMsg);
  writeDB(db);

  return res.status(201).json({
    success: true,
    message: 'A sua mensagem foi enviada com sucesso para o VIDEOMAKER Fernando Kibuba. Responderemos com brevidade!'
  });
});

app.get('/api/admin/messages', authenticateAdmin, (_req: Request, res: Response) => {
  const db = readDB();
  return res.json(db.contactMessages);
});

app.delete('/api/admin/messages/:id', authenticateAdmin, (req: Request, res: Response) => {
  const db = readDB();
  db.contactMessages = db.contactMessages.filter(m => m.id !== req.params.id);
  writeDB(db);
  return res.json({ success: true });
});

// Record a visit/view
app.post('/api/stats/view', (_req: Request, res: Response) => {
  const db = readDB();
  db.totalViews = (db.totalViews || 0) + 1;
  writeDB(db);
  return res.json({ success: true, totalViews: db.totalViews });
});

// 9. ADMIN OVERVIEW STATS
app.get('/api/admin/stats', authenticateAdmin, (_req: Request, res: Response) => {
  const db = readDB();
  if (pruneExpiredStories(db)) {
    scheduleWriteDB(db);
  }
  const totalPosts = db.posts.length;
  const totalPhotos = db.posts.filter(p => p.type === 'photo').length;
  const totalVideos = db.posts.filter(p => p.type === 'video').length;
  const totalLikes = db.posts.reduce((sum, p) => sum + (p.likesCount || 0), 0);
  const totalComments = db.comments.length;
  const activeStories = db.stories.filter(isStoryActive).length;
  const totalStoryReactions = (db.storyReactions || []).length;
  const totalStoryComments = (db.storyComments || []).length;
  const totalActivities = db.activities.length;
  const unreadMessages = db.contactMessages.filter(m => !m.read).length;
  const totalViews = typeof db.totalViews === 'number' ? db.totalViews : 0;

  return res.json({
    totalPosts,
    totalPhotos,
    totalVideos,
    totalLikes,
    totalComments,
    activeStories,
    totalStoryReactions,
    totalStoryComments,
    totalActivities,
    unreadMessages,
    totalViews
  });
});

// 10. ADMIN CLEAR ALL (Wipes all images, posts, stories, activities for clean slate)
app.post('/api/admin/clear-all', authenticateAdmin, (_req: Request, res: Response) => {
  const db = readDB();
  db.posts = [];
  db.stories = [];
  db.activities = [];
  db.comments = [];
  db.commentLikes = [];
  db.storyReactions = [];
  db.storyComments = [];
  db.likes = [];
  db.totalViews = 0;
  writeDB(db);
  return res.json({
    success: true,
    message: 'Todas as imagens, publicações, stories e atividades foram eliminadas com sucesso. A plataforma está limpa para novas publicações.'
  });
});

// Ensure unmatched /api/* routes always return JSON and never fall through to index.html
app.use('/api', (req: Request, res: Response) => {
  return res.status(404).json({
    error: `Endpoint da API não encontrado: ${req.method} ${req.originalUrl}`
  });
});

// ==========================================
// VITE DEV SERVER / STATIC PRODUCTION SETUP
// ==========================================
const PWA_MANIFEST_JSON = {
  id: '/',
  name: 'Videomaker — Fernando Kibuba',
  short_name: 'Videomaker',
  description:
    'Plataforma oficial de fotografias, vídeos, Stories e atividades da Igreja Metodista de Fernando Kibuba.',
  lang: 'pt-AO',
  dir: 'ltr',
  theme_color: '#08080a',
  background_color: '#08080a',
  display: 'standalone',
  orientation: 'portrait-primary',
  scope: '/',
  start_url: '/',
  categories: ['photo', 'video', 'social', 'lifestyle'],
  icons: [
    {
      src: '/pwa-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/pwa-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/pwa-maskable-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};

// Enforce HTTPS in remote production behind reverse proxy (never redirect localhost)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production') {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const proto = typeof forwardedProto === 'string' ? forwardedProto.split(',')[0].trim() : '';
    const forwardedHost = req.headers['x-forwarded-host'];
    const rawHost =
      (typeof forwardedHost === 'string' && forwardedHost.trim()
        ? forwardedHost.split(',')[0].trim()
        : req.get('host')) || '';
    const hostLower = rawHost.toLowerCase();
    const isLocal =
      hostLower.startsWith('localhost') ||
      hostLower.startsWith('127.0.0.1') ||
      hostLower.startsWith('[::1]');
    if (proto === 'http' && rawHost && !isLocal) {
      return res.redirect(301, `https://${rawHost}${req.originalUrl}`);
    }
  }
  next();
});

// Guarantee valid application/manifest+json response in both dev and production
app.get('/manifest.webmanifest', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const distManifest = path.join(__dirname, 'dist', 'manifest.webmanifest');
  if (process.env.NODE_ENV === 'production' && fs.existsSync(distManifest)) {
    return res.sendFile(distManifest);
  }
  return res.status(200).send(JSON.stringify(PWA_MANIFEST_JSON, null, 2));
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const httpServer = http.createServer(app);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: { server: httpServer },
        allowedHosts: true,
        ws: { server: httpServer }
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          const base = path.basename(filePath);
          if (base === 'sw.js' || base === 'registerSW.js' || base.startsWith('workbox-')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Service-Worker-Allowed', '/');
          } else if (base.endsWith('.webmanifest')) {
            res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
          }
        }
      })
    );
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[VIDEOMAKER Fernando Kibuba] Servidor a correr na porta ${PORT}`);
  });
}

startServer();
