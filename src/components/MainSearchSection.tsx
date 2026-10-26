import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, Camera, Film, Calendar, MapPin, ArrowUpRight } from 'lucide-react';
import { Post, Activity } from '../types';
import { formatLuandaDate } from '../lib/visitor';
import { parseVideoSource, getSafePosterUrl, normalizeMediaUrl } from '../lib/videoUtils';

interface MainSearchSectionProps {
  posts: Post[];
  activities: Activity[];
  theme: 'dark' | 'light';
  onSelectPost: (post: Post) => void;
  onSelectActivity: () => void;
  externalFocusTrigger?: number;
}

type SearchScope = 'all' | 'photo' | 'video' | 'activity';

function normalizeSearchText(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export const MainSearchSection: React.FC<MainSearchSectionProps> = ({
  posts,
  activities,
  theme,
  onSelectPost,
  onSelectActivity,
  externalFocusTrigger = 0,
}) => {
  const isLight = theme === 'light';
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (externalFocusTrigger > 0) {
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 220);
    }
  }, [externalFocusTrigger]);

  const normalizedQuery = useMemo(() => normalizeSearchText(query), [query]);
  const tokens = useMemo(
    () => (normalizedQuery ? normalizedQuery.split(/\s+/).filter(Boolean) : []),
    [normalizedQuery]
  );

  const matchedPosts = useMemo(() => {
    if (tokens.length === 0) return [];
    return posts.filter(post => {
      if (scope === 'photo' && post.type !== 'photo') return false;
      if (scope === 'video' && post.type !== 'video') return false;
      if (scope === 'activity') return false;

      const typeAliases =
        post.type === 'video'
          ? 'video videos filmagem hd 1080p culto'
          : 'foto fotos fotografia fotografias imagem';
      const haystack = normalizeSearchText(
        `${post.title} ${post.description || ''} ${post.category || ''} ${post.activityName || ''} ${post.location || ''} ${typeAliases}`
      );
      return tokens.every(token => haystack.includes(token));
    });
  }, [posts, tokens, scope]);

  const matchedActivities = useMemo(() => {
    if (tokens.length === 0) return [];
    if (scope === 'photo' || scope === 'video') return [];

    return activities.filter(act => {
      const haystack = normalizeSearchText(
        `${act.title} ${act.description || ''} ${act.location || ''} ${act.additionalInfo || ''} ${act.date || ''} atividade atividades evento agenda igreja`
      );
      return tokens.every(token => haystack.includes(token));
    });
  }, [activities, tokens, scope]);

  const totalResults = matchedPosts.length + matchedActivities.length;
  const hasActiveSearch = tokens.length > 0;

  return (
    <section
      ref={containerRef}
      id="pesquisa"
      aria-label="Pesquisar publicações, fotografias, vídeos e atividades"
      className="relative pt-8 sm:pt-10 pb-2"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Modern Search Bar */}
          <div
            className={`relative flex items-center rounded-2xl border transition-colors duration-150 ${
              isLight
                ? 'bg-white border-neutral-300 focus-within:border-amber-500 shadow-sm'
                : 'bg-[#0d0d13] border-white/12 focus-within:border-amber-400/60 shadow-[0_10px_30px_rgba(0,0,0,0.45)]'
            }`}
          >
            <div className="pl-4 pr-2.5 flex items-center justify-center pointer-events-none">
              <Search className="w-5 h-5 text-amber-400" />
            </div>

            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              data-testid="main-search-input"
              placeholder="Pesquisar publicações, fotografias, vídeos e atividades da igreja..."
              aria-label="Pesquisar publicações, fotografias, vídeos e atividades da igreja"
              className={`w-full min-h-[50px] sm:min-h-[54px] py-3 pr-3 bg-transparent text-sm sm:text-base focus:outline-none ${
                isLight
                  ? 'text-neutral-900 placeholder:text-neutral-400'
                  : 'text-white placeholder:text-gray-500'
              }`}
            />

            {query.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setScope('all');
                  inputRef.current?.focus();
                }}
                data-testid="main-search-clear"
                className={`mr-2 min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center transition cursor-pointer ${
                  isLight
                    ? 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800'
                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
                aria-label="Limpar pesquisa"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Interactive Scope Tabs + Real-time Results Panel when searching */}
          {hasActiveSearch && (
            <div
              data-testid="main-search-results"
              className={`mt-3 rounded-2xl border overflow-hidden transition-all ${
                isLight
                  ? 'bg-white border-neutral-200 shadow-lg'
                  : 'bg-[#0c0c12]/95 backdrop-blur-xl border-white/12 shadow-2xl'
              }`}
            >
              {/* Filter Tabs */}
              <div
                className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 ${
                  isLight ? 'border-neutral-200 bg-neutral-50' : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {(
                    [
                      { id: 'all', label: 'Tudo' },
                      { id: 'photo', label: 'Fotografias' },
                      { id: 'video', label: 'Vídeos' },
                      { id: 'activity', label: 'Atividades' },
                    ] as const
                  ).map(tab => {
                    const active = scope === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setScope(tab.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                          active
                            ? 'bg-amber-400 text-black'
                            : isLight
                              ? 'text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900'
                              : 'text-gray-400 hover:bg-white/8 hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <span
                  className={`text-xs font-mono tabular-nums ${
                    isLight ? 'text-neutral-500' : 'text-gray-400'
                  }`}
                >
                  {totalResults} {totalResults === 1 ? 'resultado' : 'resultados'}
                </span>
              </div>

              {/* Results Body */}
              {totalResults === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className={`text-sm font-semibold ${isLight ? 'text-neutral-800' : 'text-gray-200'}`}>
                    Nenhum resultado encontrado para «{query.trim()}»
                  </p>
                  <p className={`text-xs mt-1 ${isLight ? 'text-neutral-500' : 'text-gray-400'}`}>
                    Experimenta pesquisar por culto, coro, juventude, batismo, fotografia ou vídeo.
                  </p>
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto divide-y divide-white/5">
                  {/* Matched Publications (Photos & Videos) */}
                  {matchedPosts.map(post => {
                    const videoInfo = post.type === 'video' ? parseVideoSource(post.mediaUrl) : null;
                    const previewImg =
                      post.type === 'video'
                        ? getSafePosterUrl(post.thumbnailUrl, videoInfo?.thumbnailUrl)
                        : normalizeMediaUrl(post.mediaUrl);

                    return (
                      <button
                        key={`search-post-${post.id}`}
                        type="button"
                        onClick={() => onSelectPost(post)}
                        className={`w-full text-left px-4 py-3.5 flex items-center gap-3.5 transition cursor-pointer ${
                          isLight ? 'hover:bg-neutral-100' : 'hover:bg-white/[0.04]'
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="w-16 h-12 rounded-xl overflow-hidden bg-neutral-900 border border-white/10 flex items-center justify-center shrink-0">
                          {previewImg ? (
                            <img
                              src={previewImg}
                              alt={post.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : post.type === 'video' ? (
                            <Film className="w-5 h-5 text-[#E50914]" />
                          ) : (
                            <Camera className="w-5 h-5 text-amber-400" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate">{post.title}</p>
                          <div
                            className={`flex items-center gap-1.5 text-xs mt-0.5 truncate ${
                              isLight ? 'text-neutral-500' : 'text-gray-400'
                            }`}
                          >
                            <span className={post.type === 'video' ? 'text-[#E50914] font-semibold' : 'text-amber-400 font-semibold'}>
                              {post.type === 'video' ? 'Vídeo HD' : 'Fotografia'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{post.category || 'Geral'}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{formatLuandaDate(post.createdAt)}</span>
                          </div>
                        </div>

                        <ArrowUpRight className="w-4 h-4 text-amber-400 shrink-0" />
                      </button>
                    );
                  })}

                  {/* Matched Church Activities */}
                  {matchedActivities.map(act => (
                    <button
                      key={`search-act-${act.id}`}
                      type="button"
                      onClick={() => {
                        onSelectActivity();
                      }}
                      className={`w-full text-left px-4 py-3.5 flex items-center gap-3.5 transition cursor-pointer ${
                        isLight ? 'hover:bg-neutral-100' : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 text-amber-400" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate">{act.title}</p>
                        <div
                          className={`flex flex-wrap items-center gap-1.5 text-xs mt-0.5 ${
                            isLight ? 'text-neutral-500' : 'text-gray-400'
                          }`}
                        >
                          <span className="text-amber-400 font-semibold">Atividade da Igreja</span>
                          {act.date && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">{act.date}</span>
                            </>
                          )}
                          {act.location && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 truncate">
                                <MapPin className="w-3 h-3 text-[#E50914]" />
                                {act.location}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <ArrowUpRight className="w-4 h-4 text-amber-400 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
