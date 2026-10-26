import {
  Post,
  Story,
  StoryCreateInput,
  StoryReactionType,
  StoryComment,
  StoryInteractionsPayload,
  Activity,
  Comment,
  AdminStats,
  ContactMessage,
  AdminUser
} from '../types';

function getApiBase(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`;
  }
  return '/api';
}

export type ApiErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'SERVER';

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: ApiErrorCode;

  constructor(message: string, status = 0, code: ApiErrorCode = 'SERVER') {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

// Track last verified JSON response from backend so POST/PUT/DELETE requests
// refresh any 60-second proxy auth-bridge token cache before sending body payloads.
let lastVerifiedApiAt = 0;
let warmupPromise: Promise<boolean> | null = null;
const WARM_TTL_MS = 40_000;

export async function pingAuthServer(timeoutMs = 8000): Promise<boolean> {
  if (warmupPromise) {
    return warmupPromise;
  }

  warmupPromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${getApiBase()}/health?_t=${Date.now()}`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          Accept: 'application/json'
        },
        signal: controller.signal
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        lastVerifiedApiAt = Date.now();
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
      warmupPromise = null;
    }
  })();

  return warmupPromise;
}

async function ensureWarmConnection(force = false): Promise<void> {
  if (force || Date.now() - lastVerifiedApiAt > WARM_TTL_MS) {
    await pingAuthServer();
  }
}

function isNetworkFailureError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const msg = String((err as Error).message || '').toLowerCase();
  const name = String((err as Error).name || '');
  return (
    name === 'TypeError' ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('fetch')
  );
}

function buildNetworkErrorMessage(): string {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'Sem ligação à Internet. Verifique o seu Wi-Fi ou dados móveis e tente novamente.';
  }
  return 'Não foi possível comunicar com o servidor de autenticação. Verifique a sua ligação à Internet e tente novamente.';
}

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string;
  timeoutMs?: number;
  fallbackError?: string;
  isLoginRequest?: boolean;
}

async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    token,
    timeoutMs = 15000,
    fallbackError = 'Ocorreu um erro ao comunicar com o servidor.',
    isLoginRequest = false
  } = options;

  const isMutation = method !== 'GET';
  if (isMutation) {
    await ensureWarmConnection(isLoginRequest && Date.now() - lastVerifiedApiAt > 25_000);
  }

  const executeAttempt = async (): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json'
      };
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      return await fetch(`${getApiBase()}${path}`, {
        method,
        credentials: 'include',
        cache: 'no-store',
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  };

  let res: Response;
  try {
    res = await executeAttempt();
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new ApiClientError(
        'O servidor demorou demasiado tempo a responder. Verifique a sua ligação e tente novamente.',
        0,
        'TIMEOUT'
      );
    }
    // Warm up connection and retry once on transient proxy/network failure
    await pingAuthServer(6000);
    await new Promise(r => setTimeout(r, 450));
    try {
      res = await executeAttempt();
    } catch (retryErr: any) {
      if (retryErr?.name === 'AbortError') {
        throw new ApiClientError(
          'O servidor demorou demasiado tempo a responder. Verifique a sua ligação e tente novamente.',
          0,
          'TIMEOUT'
        );
      }
      if (isNetworkFailureError(retryErr)) {
        throw new ApiClientError(buildNetworkErrorMessage(), 0, 'NETWORK');
      }
      throw new ApiClientError(buildNetworkErrorMessage(), 0, 'NETWORK');
    }
  }

  let contentType = res.headers.get('content-type') || '';
  const shouldRetryProxyConversion =
    (isMutation && res.status === 405) ||
    res.status === 502 ||
    res.status === 503 ||
    res.status === 504 ||
    (res.ok && !contentType.includes('application/json'));

  if (shouldRetryProxyConversion) {
    await pingAuthServer(6000);
    await new Promise(r => setTimeout(r, 500));
    try {
      res = await executeAttempt();
      contentType = res.headers.get('content-type') || '';
    } catch (retryErr: any) {
      if (retryErr?.name === 'AbortError') {
        throw new ApiClientError(
          'O servidor demorou demasiado tempo a responder. Verifique a sua ligação e tente novamente.',
          0,
          'TIMEOUT'
        );
      }
      throw new ApiClientError(buildNetworkErrorMessage(), 0, 'NETWORK');
    }
  }

  const rawText = await res.text();
  let parsedData: any = null;
  if (rawText) {
    try {
      parsedData = JSON.parse(rawText);
      lastVerifiedApiAt = Date.now();
    } catch {
      parsedData = null;
    }
  } else if (res.ok) {
    lastVerifiedApiAt = Date.now();
  }

  if (!res.ok) {
    const serverMsg = typeof parsedData?.error === 'string' ? parsedData.error : '';

    if (res.status === 400) {
      throw new ApiClientError(
        serverMsg || 'Dados inválidos no pedido. Verifique os campos preenchidos.',
        400,
        'VALIDATION'
      );
    }
    if (res.status === 401) {
      if (isLoginRequest) {
        throw new ApiClientError(
          serverMsg || 'E-mail ou palavra-passe incorretos. Verifique as suas credenciais.',
          401,
          'INVALID_CREDENTIALS'
        );
      }
      throw new ApiClientError(
        serverMsg || 'Sessão não autorizada. Por favor, inicie sessão novamente.',
        401,
        'UNAUTHORIZED'
      );
    }
    if (res.status === 403) {
      throw new ApiClientError(
        serverMsg || 'Sessão expirada ou sem permissão. Faça login novamente.',
        403,
        'UNAUTHORIZED'
      );
    }
    if (res.status === 404 || res.status === 410) {
      throw new ApiClientError(
        serverMsg || fallbackError,
        res.status,
        'NOT_FOUND'
      );
    }
    if (res.status === 429) {
      throw new ApiClientError(
        serverMsg || 'Demasiadas tentativas. Por favor, aguarde alguns minutos e tente novamente.',
        429,
        'RATE_LIMITED'
      );
    }
    if (res.status >= 500) {
      throw new ApiClientError(
        serverMsg || 'Erro temporário no servidor. Por favor, tente novamente dentro de instantes.',
        res.status,
        'SERVER'
      );
    }

    throw new ApiClientError(serverMsg || fallbackError, res.status, 'SERVER');
  }

  if (parsedData === null) {
    throw new ApiClientError(
      'O servidor devolveu uma resposta inesperada. Atualize a página e tente novamente.',
      res.status,
      'SERVER'
    );
  }

  return parsedData as T;
}

export async function fetchPosts(): Promise<Post[]> {
  return apiRequest<Post[]>('/posts', {
    fallbackError: 'Falha ao carregar publicações.'
  });
}

export async function fetchPost(id: string): Promise<Post> {
  return apiRequest<Post>(`/posts/${encodeURIComponent(id)}`, {
    fallbackError: 'Publicação não encontrada.'
  });
}

export async function createPost(data: Partial<Post>, token: string): Promise<Post> {
  return apiRequest<Post>('/posts', {
    method: 'POST',
    body: data,
    token,
    fallbackError: 'Falha ao criar publicação.'
  });
}

export async function updatePost(id: string, data: Partial<Post>, token: string): Promise<Post> {
  return apiRequest<Post>(`/posts/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: data,
    token,
    fallbackError: 'Falha ao atualizar publicação.'
  });
}

export async function deletePost(id: string, token: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/posts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token,
    fallbackError: 'Falha ao apagar publicação.'
  });
}

export async function toggleLike(postId: string, visitorId: string): Promise<{ likesCount: number; userLiked: boolean }> {
  return apiRequest<{ likesCount: number; userLiked: boolean }>(`/posts/${encodeURIComponent(postId)}/like`, {
    method: 'POST',
    body: { visitorId },
    fallbackError: 'Falha ao registar gosto.'
  });
}

export async function fetchLikedStatus(visitorId: string): Promise<string[]> {
  try {
    const data = await apiRequest<{ likedPostIds?: string[] }>(
      `/likes/status?visitorId=${encodeURIComponent(visitorId)}`
    );
    return data.likedPostIds || [];
  } catch {
    return [];
  }
}

export async function fetchComments(postId: string): Promise<Comment[]> {
  try {
    return await apiRequest<Comment[]>(`/posts/${encodeURIComponent(postId)}/comments`);
  } catch {
    return [];
  }
}

export async function addComment(
  postId: string,
  text: string,
  options?: { authorName?: string; visitorId?: string; honeypot?: string }
): Promise<Comment> {
  return apiRequest<Comment>(`/posts/${encodeURIComponent(postId)}/comments`, {
    method: 'POST',
    body: {
      text,
      authorName: options?.authorName,
      visitorId: options?.visitorId,
      honeypot: options?.honeypot || ''
    },
    fallbackError: 'Falha ao adicionar comentário.'
  });
}

export async function updateVisitorCommentAuthor(
  visitorId: string,
  authorName: string
): Promise<{ success: boolean; authorName: string; updatedCount: number }> {
  return apiRequest<{ success: boolean; authorName: string; updatedCount: number }>(
    '/visitor/profile',
    {
      method: 'PUT',
      body: { visitorId, authorName },
      fallbackError: 'Falha ao atualizar o nome do visitante.'
    }
  );
}

export async function toggleCommentLike(commentId: string, visitorId: string): Promise<{ likesCount: number; userLiked: boolean }> {
  return apiRequest<{ likesCount: number; userLiked: boolean }>(`/comments/${encodeURIComponent(commentId)}/like`, {
    method: 'POST',
    body: { visitorId },
    fallbackError: 'Falha ao registar gosto no comentário.'
  });
}

export async function fetchLikedCommentIds(visitorId: string): Promise<string[]> {
  try {
    const data = await apiRequest<{ likedCommentIds?: string[] }>(
      `/comments/likes/status?visitorId=${encodeURIComponent(visitorId)}`
    );
    return data.likedCommentIds || [];
  } catch {
    return [];
  }
}

export async function deleteComment(commentId: string, token: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
    token,
    fallbackError: 'Falha ao apagar comentário.'
  });
}

export async function fetchStories(visitorId?: string): Promise<Story[]> {
  try {
    const query = visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : '';
    return await apiRequest<Story[]>(`/stories${query}`);
  } catch {
    return [];
  }
}

export async function createStory(
  data: StoryCreateInput,
  token: string
): Promise<Story> {
  return apiRequest<Story>('/stories', {
    method: 'POST',
    body: data,
    token,
    fallbackError: 'Falha ao criar Story.'
  });
}

export async function createStoriesBatch(
  stories: StoryCreateInput[],
  token: string
): Promise<Story[]> {
  const payload = await apiRequest<{ stories?: Story[] }>('/stories', {
    method: 'POST',
    body: { stories },
    token,
    timeoutMs: 30000,
    fallbackError: 'Falha ao publicar Stories.'
  });
  return Array.isArray(payload?.stories) ? payload.stories : [];
}

export async function deleteStory(storyId: string, token: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/stories/${encodeURIComponent(storyId)}`, {
    method: 'DELETE',
    token,
    fallbackError: 'Falha ao apagar Story.'
  });
}

export async function fetchStoryInteractions(
  storyId: string,
  visitorId?: string
): Promise<StoryInteractionsPayload> {
  const query = visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : '';
  return apiRequest<StoryInteractionsPayload>(`/stories/${encodeURIComponent(storyId)}/interactions${query}`, {
    fallbackError: 'Falha ao carregar interações do Story.'
  });
}

export async function toggleStoryReaction(
  storyId: string,
  visitorId: string,
  type: StoryReactionType
): Promise<{
  success: boolean;
  storyId: string;
  reactionsCount: number;
  reactionBreakdown: Partial<Record<StoryReactionType, number>>;
  userReaction: StoryReactionType | null;
}> {
  return apiRequest(`/stories/${encodeURIComponent(storyId)}/react`, {
    method: 'POST',
    body: { visitorId, type },
    fallbackError: 'Falha ao registar reação no Story.'
  });
}

export async function fetchStoryComments(storyId: string): Promise<StoryComment[]> {
  try {
    return await apiRequest<StoryComment[]>(`/stories/${encodeURIComponent(storyId)}/comments`);
  } catch {
    return [];
  }
}

export async function addStoryComment(
  storyId: string,
  text: string,
  parentId?: string,
  options?: { authorName?: string; visitorId?: string; honeypot?: string }
): Promise<{ comment: StoryComment; commentsCount: number }> {
  return apiRequest<{ comment: StoryComment; commentsCount: number }>(
    `/stories/${encodeURIComponent(storyId)}/comments`,
    {
      method: 'POST',
      body: {
        text,
        parentId,
        authorName: options?.authorName,
        visitorId: options?.visitorId,
        honeypot: options?.honeypot || ''
      },
      fallbackError: 'Falha ao enviar comentário no Story.'
    }
  );
}

export async function deleteStoryComment(
  commentId: string,
  token: string
): Promise<{ success: boolean; storyId: string; deletedIds: string[]; commentsCount: number }> {
  return apiRequest(`/story-comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
    token,
    fallbackError: 'Falha ao eliminar comentário do Story.'
  });
}

export async function fetchActivities(): Promise<Activity[]> {
  try {
    return await apiRequest<Activity[]>('/activities');
  } catch {
    return [];
  }
}

export async function createActivity(data: Partial<Activity>, token: string): Promise<Activity> {
  return apiRequest<Activity>('/activities', {
    method: 'POST',
    body: data,
    token,
    fallbackError: 'Falha ao registar atividade.'
  });
}

export async function updateActivity(id: string, data: Partial<Activity>, token: string): Promise<Activity> {
  return apiRequest<Activity>(`/activities/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: data,
    token,
    fallbackError: 'Falha ao atualizar atividade.'
  });
}

export async function deleteActivity(id: string, token: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/activities/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token,
    fallbackError: 'Falha ao apagar atividade.'
  });
}

export async function sendContactMessage(data: {
  name: string;
  email?: string;
  subject?: string;
  message: string;
  honeypot?: string;
}): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>('/contact', {
    method: 'POST',
    body: data,
    fallbackError: 'Falha ao enviar mensagem.'
  });
}

export async function loginAdmin(
  email: string,
  password: string
): Promise<{ success: boolean; token: string; admin: AdminUser }> {
  return apiRequest<{ success: boolean; token: string; admin: AdminUser }>('/auth/login', {
    method: 'POST',
    body: { email, password },
    isLoginRequest: true,
    timeoutMs: 15000,
    fallbackError: 'Não foi possível concluir a autenticação. Tente novamente.'
  });
}

export async function verifyAdminSession(
  token: string
): Promise<{ authenticated: boolean; admin?: AdminUser }> {
  try {
    return await apiRequest<{ authenticated: boolean; admin?: AdminUser }>('/auth/verify', {
      token,
      timeoutMs: 10000
    });
  } catch (err: any) {
    if (err instanceof ApiClientError && (err.code === 'UNAUTHORIZED' || err.status === 401 || err.status === 403)) {
      return { authenticated: false };
    }
    throw err;
  }
}

export async function logoutAdmin(token: string): Promise<void> {
  try {
    await apiRequest('/auth/logout', {
      method: 'POST',
      token,
      timeoutMs: 8000
    });
  } catch {
    // Ignore network failures on logout cleanup
  }
}

export interface UploadResult {
  url: string;
  thumbnailUrl?: string;
  filename?: string;
  size?: number;
}

export async function uploadMediaFileDetailed(
  file: File,
  token: string,
  onProgress?: (percent: number, phase?: 'uploading' | 'processing' | 'done') => void,
  options?: { context?: 'story' | 'post' }
): Promise<UploadResult> {
  // Warm up connection first so large multipart POST never hits an expired proxy token redirect
  await ensureWarmConnection();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);
    if (options?.context) {
      formData.append('context', options.context);
    }

    const isVideo =
      file.type.startsWith('video/') ||
      /\.(mp4|mov|webm|m4v|mkv|avi|3gp|mts)$/i.test(file.name);

    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) {
        const cap = isVideo ? 90 : 98;
        const percent = Math.min(cap, Math.round((e.loaded / e.total) * cap));
        onProgress(percent, 'uploading');
      }
    };

    xhr.upload.onload = () => {
      if (isVideo && onProgress) {
        onProgress(95, 'processing');
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          lastVerifiedApiAt = Date.now();
          if (onProgress) onProgress(100, 'done');
          resolve({
            url: data.url,
            thumbnailUrl: data.thumbnailUrl,
            filename: data.filename,
            size: data.size
          });
        } catch {
          reject(new Error('Resposta inválida do servidor ao enviar ficheiro.'));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || 'Falha no envio do ficheiro.'));
        } catch {
          reject(new Error(`Erro ao enviar ficheiro (${xhr.status}).`));
        }
      }
    };

    xhr.onerror = () =>
      reject(
        new Error(
          'Erro de ligação ao enviar o ficheiro. Verifique a sua Internet e tente novamente.'
        )
      );

    const query = options?.context ? `?context=${encodeURIComponent(options.context)}` : '';
    xhr.open('POST', `${getApiBase()}/upload${query}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}

export async function uploadMediaFile(file: File, token: string): Promise<string> {
  const result = await uploadMediaFileDetailed(file, token);
  return result.url;
}

export async function fetchAdminStats(token: string): Promise<AdminStats> {
  return apiRequest<AdminStats>('/admin/stats', {
    token,
    fallbackError: 'Falha ao carregar estatísticas.'
  });
}

export async function fetchAdminAllStories(token: string): Promise<Story[]> {
  try {
    return await apiRequest<Story[]>('/admin/stories', { token });
  } catch {
    return [];
  }
}

export async function fetchAdminAllComments(token: string): Promise<Comment[]> {
  try {
    return await apiRequest<Comment[]>('/admin/comments', { token });
  } catch {
    return [];
  }
}

export async function fetchAdminStoryComments(token: string): Promise<StoryComment[]> {
  try {
    return await apiRequest<StoryComment[]>('/admin/story-comments', { token });
  } catch {
    return [];
  }
}

export async function fetchAdminMessages(token: string): Promise<ContactMessage[]> {
  try {
    return await apiRequest<ContactMessage[]>('/admin/messages', { token });
  } catch {
    return [];
  }
}

export async function deleteAdminMessage(messageId: string, token: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/admin/messages/${encodeURIComponent(messageId)}`, {
    method: 'DELETE',
    token,
    fallbackError: 'Falha ao apagar mensagem.'
  });
}

export async function clearAllData(token: string): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>('/admin/clear-all', {
    method: 'POST',
    token,
    timeoutMs: 20000,
    fallbackError: 'Falha ao limpar todas as imagens e dados.'
  });
}


