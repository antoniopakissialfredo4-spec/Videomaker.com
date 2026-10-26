import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Camera, Film, Calendar, MapPin, ArrowRight, ArrowLeft } from 'lucide-react';
import { Post, Activity } from '../types';
import { formatLuandaDate } from '../lib/visitor';
import { parseVideoSource, getSafePosterUrl, normalizeMediaUrl } from '../lib/videoUtils';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  posts: Post[];
  activities: Activity[];
  onSelectPost: (post: Post) => void;
  onSelectActivity: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  posts,
  activities,
  onSelectPost,
  onSelectActivity
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const query = searchTerm.toLowerCase().trim();

  const matchingPosts = query
    ? posts.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        (p.activityName && p.activityName.toLowerCase().includes(query)) ||
        (p.location && p.location.toLowerCase().includes(query))
      )
    : [];

  const matchingActivities = query
    ? activities.filter(a =>
        a.title.toLowerCase().includes(query) ||
        a.description.toLowerCase().includes(query) ||
        a.location.toLowerCase().includes(query) ||
        (a.additionalInfo && a.additionalInfo.toLowerCase().includes(query))
      )
    : [];

  const totalResults = matchingPosts.length + matchingActivities.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      {/* Background click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Search Container */}
      <div className="relative z-10 w-full max-w-2xl liquid-glass rounded-3xl border border-white/15 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="p-3.5 sm:p-4 border-b border-white/10 flex items-center gap-3 bg-neutral-900/60">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white transition flex items-center gap-1 text-xs"
            title="Voltar"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Voltar</span>
          </button>
          <Search className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Pesquisar fotografias, vídeos, cultos, atividades..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent text-white placeholder-gray-400 text-xs sm:text-sm focus:outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-gray-400 hover:text-white p-1 text-xs"
            >
              Limpar
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-neutral-800 text-gray-300 hover:text-white"
            title="Fechar pesquisa"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {!query ? (
            <div className="py-12 text-center text-gray-400">
              <Search className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-300">O que pretende encontrar?</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                Digite termos como &ldquo;Culto&rdquo;, &ldquo;Coral&rdquo;, &ldquo;Batismo&rdquo;, &ldquo;Juventude&rdquo;, ou o nome de uma atividade.
              </p>
            </div>
          ) : totalResults === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <p className="text-sm font-medium text-gray-300">Nenhum resultado para &ldquo;{searchTerm}&rdquo;</p>
              <p className="text-xs text-gray-400 mt-1">Verifique a ortografia ou tente outras palavras-chave.</p>
            </div>
          ) : (
            <>
              {/* Matching Posts */}
              {matchingPosts.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Publicações ({matchingPosts.length})</span>
                  </h4>
                  <div className="space-y-2">
                    {matchingPosts.map(post => (
                      <div
                        key={post.id}
                        onClick={() => {
                          onSelectPost(post);
                          onClose();
                        }}
                        className="p-2.5 rounded-xl bg-neutral-900/70 hover:bg-neutral-800/90 border border-white/5 hover:border-amber-400/30 cursor-pointer transition flex items-center gap-3 group"
                      >
                        <div className="w-14 h-14 rounded-lg bg-black overflow-hidden flex-shrink-0 relative flex items-center justify-center">
                          {(() => {
                            if (post.type === 'video') {
                              const vInfo = parseVideoSource(post.mediaUrl);
                              const thumb = getSafePosterUrl(post.thumbnailUrl, vInfo.thumbnailUrl);
                              if (thumb) {
                                return <img src={thumb} alt={post.title} className="w-full h-full object-cover" loading="lazy" />;
                              }
                              return <div className="w-full h-full bg-neutral-900" />;
                            }
                            return <img src={normalizeMediaUrl(post.mediaUrl)} alt={post.title} className="w-full h-full object-cover" loading="lazy" />;
                          })()}
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            {post.type === 'video' ? (
                              <Film className="w-4 h-4 text-[#E50914]" />
                            ) : (
                              <Camera className="w-3.5 h-3.5 text-white" />
                            )}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-semibold text-amber-300 px-1.5 py-0.5 rounded bg-amber-400/10">
                              {post.category}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {formatLuandaDate(post.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-300 truncate">
                            {post.title}
                          </p>
                          {post.activityName && (
                            <p className="text-[11px] text-gray-400 truncate mt-0.5">
                              {post.activityName}
                            </p>
                          )}
                        </div>

                        <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-amber-400 group-hover:translate-x-1 transition flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matching Activities */}
              {matchingActivities.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Atividades da Igreja ({matchingActivities.length})</span>
                  </h4>
                  <div className="space-y-2">
                    {matchingActivities.map(activity => (
                      <div
                        key={activity.id}
                        onClick={() => {
                          onSelectActivity();
                          onClose();
                        }}
                        className="p-2.5 rounded-xl bg-neutral-900/70 hover:bg-neutral-800/90 border border-white/5 hover:border-amber-400/30 cursor-pointer transition flex items-center gap-3 group"
                      >
                        <div className="w-14 h-14 rounded-lg bg-black overflow-hidden flex-shrink-0 relative">
                          <img
                            src={activity.posterUrl}
                            alt={activity.title}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-semibold text-white px-1.5 py-0.5 rounded bg-red-600/30 border border-red-500/30">
                              {activity.date}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {activity.time}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-300 truncate">
                            {activity.title}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-[#E50914]" />
                            {activity.location}
                          </p>
                        </div>

                        <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-amber-400 group-hover:translate-x-1 transition flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-neutral-950 border-t border-white/10 text-center text-[11px] text-gray-400 flex items-center justify-between">
          <span>Pesquisa instantânea em tempo real</span>
          <span>Pressione ESC para fechar</span>
        </div>
      </div>
    </div>
  );
};
