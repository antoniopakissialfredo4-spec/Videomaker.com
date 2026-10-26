export const VISITOR_NAME_STORAGE_KEY = 'videomaker_visitor_name';
export const VISITOR_NAME_UPDATED_EVENT = 'videomaker:visitor-name-updated';

export function getVisitorId(): string {
  if (typeof window === 'undefined') return 'server';
  
  const STORAGE_KEY = 'videomaker_kibuba_visitor_id';
  let visitorId = localStorage.getItem(STORAGE_KEY);
  
  if (!visitorId) {
    visitorId = 'vis_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
    localStorage.setItem(STORAGE_KEY, visitorId);
  }
  
  return visitorId;
}

export function sanitizeVisitorNameInput(raw: string): string {
  return raw.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
}

export function getVisitorName(): string {
  if (typeof window === 'undefined') return '';
  try {
    const saved = localStorage.getItem(VISITOR_NAME_STORAGE_KEY);
    return saved ? sanitizeVisitorNameInput(saved) : '';
  } catch {
    return '';
  }
}

export function setVisitorName(rawName: string): string {
  const cleaned = sanitizeVisitorNameInput(rawName);
  if (typeof window !== 'undefined' && cleaned) {
    try {
      localStorage.setItem(VISITOR_NAME_STORAGE_KEY, cleaned);
      window.dispatchEvent(
        new CustomEvent(VISITOR_NAME_UPDATED_EVENT, { detail: { name: cleaned } })
      );
    } catch {
      // Ignore storage quota errors
    }
  }
  return cleaned;
}

export function formatLuandaDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('pt-PT', {
      timeZone: 'Africa/Luanda',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatLuandaDateTime(dateString: string): string {
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('pt-PT', {
      timeZone: 'Africa/Luanda',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatRelativeTime(dateString: string): string {
  try {
    const now = Date.now();
    const then = new Date(dateString).getTime();
    const diffSec = Math.max(0, Math.floor((now - then) / 1000));

    if (diffSec < 60) return 'agora mesmo';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return diffMin === 1 ? 'há 1 minuto' : `há ${diffMin} minutos`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return diffHours === 1 ? 'há 1 hora' : `há ${diffHours} horas`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return diffDays === 1 ? 'há 1 dia' : `há ${diffDays} dias`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return diffWeeks === 1 ? 'há 1 semana' : `há ${diffWeeks} semanas`;

    return formatLuandaDate(dateString);
  } catch {
    return dateString;
  }
}

export function formatRemainingTime(expiresAtString: string): string {
  try {
    const now = Date.now();
    const expires = new Date(expiresAtString).getTime();
    const diffMs = expires - now;

    if (diffMs <= 0) return 'Expirado';

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m restantes`;
    }
    return `${diffMinutes}m restantes`;
  } catch {
    return '24h';
  }
}
