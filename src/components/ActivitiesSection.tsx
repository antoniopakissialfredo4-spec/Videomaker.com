import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Info, Plus, Share2, Check, Sparkles, Trash2, Edit } from 'lucide-react';
import { Activity } from '../types';
import { formatLuandaDate } from '../lib/visitor';

interface ActivitiesSectionProps {
  activities: Activity[];
  isAdmin: boolean;
  onOpenCreateActivity?: () => void;
  onEditActivity?: (activity: Activity) => void;
  onDeleteActivity?: (activityId: string) => void;
  theme?: 'dark' | 'light';
}

export const ActivitiesSection: React.FC<ActivitiesSectionProps> = ({
  activities,
  isAdmin,
  onOpenCreateActivity,
  onEditActivity,
  onDeleteActivity,
  theme = 'dark'
}) => {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isLight = theme === 'light';
  const todayStr = new Date().toISOString().split('T')[0];

  const upcomingActivities = activities
    .filter(a => a.date >= todayStr)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const pastActivities = activities
    .filter(a => a.date < todayStr)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const currentList = activeTab === 'upcoming' ? upcomingActivities : pastActivities;

  const handleShare = (activity: Activity) => {
    const text = `Atividade na Igreja Metodista Fernando Kibuba: ${activity.title} em ${formatLuandaDate(activity.date)} às ${activity.time}. Local: ${activity.location}`;
    if (navigator.share) {
      navigator.share({
        title: activity.title,
        text,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      setCopiedId(activity.id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  return (
    <section id="atividades" className={`py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t transition-colors ${
      isLight ? 'border-neutral-200' : 'border-white/5'
    }`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-500 font-semibold tracking-wider uppercase mb-1">
            <Calendar className="w-3.5 h-3.5 text-[#E50914]" />
            <span>Agenda & Programação Eclesiástica</span>
          </div>
          <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-heading ${
            isLight ? 'text-neutral-900' : 'text-white'
          }`}>
            Atividades da Igreja Metodista
          </h2>
          <p className={`text-xs sm:text-sm mt-1 max-w-xl ${
            isLight ? 'text-neutral-600' : 'text-gray-400'
          }`}>
            Fique a par dos cultos especiais, conferências, vigílias, festivais de coros e eventos comunitários de Fernando Kibuba.
          </p>
        </div>

        {/* Admin Create Activity Button */}
        {isAdmin && onOpenCreateActivity && (
          <button
            onClick={onOpenCreateActivity}
            className="self-start md:self-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-[#E50914] text-black font-bold text-xs shadow-lg hover:brightness-110 transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-neutral-950" />
            <span>+ Publicar Atividade</span>
          </button>
        )}
      </div>

      {/* Tabs: Próximas vs Realizadas */}
      <div className={`flex items-center gap-3 border-b pb-4 mb-8 ${
        isLight ? 'border-neutral-200' : 'border-white/10'
      }`}>
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'upcoming'
              ? 'bg-amber-400 text-black shadow-md'
              : isLight
                ? 'bg-neutral-100 text-neutral-600 hover:text-neutral-900'
                : 'bg-neutral-900/80 text-gray-400 hover:text-white border border-white/5'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Próximas Atividades ({upcomingActivities.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('past')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'past'
              ? isLight
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'bg-neutral-800 text-white border border-amber-400/50'
              : isLight
                ? 'bg-neutral-100 text-neutral-600 hover:text-neutral-900'
                : 'bg-neutral-900/80 text-gray-400 hover:text-white border border-white/5'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Atividades Realizadas ({pastActivities.length})</span>
        </button>
      </div>

      {/* Activities Grid */}
      {currentList.length === 0 ? (
        <div className={`text-center py-16 rounded-3xl border p-8 max-w-2xl mx-auto ${
          isLight
            ? 'bg-white border-neutral-200 shadow-sm'
            : 'bg-neutral-950/40 border-white/5'
        }`}>
          <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-7 h-7" />
          </div>
          <h3 className={`text-base font-bold mb-1 ${isLight ? 'text-neutral-900' : 'text-gray-200'}`}>
            {activeTab === 'upcoming' ? 'Sem atividades futuras agendadas de momento' : 'Sem histórico de atividades anteriores'}
          </h3>
          <p className={`text-xs max-w-sm mx-auto mb-5 leading-relaxed ${isLight ? 'text-neutral-600' : 'text-gray-400'}`}>
            {activeTab === 'upcoming'
              ? 'Consulte em breve para novas conferências, vigílias e celebrações especiais.'
              : 'As atividades concluídas serão arquivadas aqui.'}
          </p>

          {isAdmin && onOpenCreateActivity && (
            <button
              onClick={onOpenCreateActivity}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-[#E50914] text-black font-bold text-xs shadow hover:brightness-110 transition inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4 text-neutral-950" />
              <span>+ Agendar Nova Atividade</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {currentList.map(activity => (
            <div
              key={activity.id}
              className={`rounded-3xl overflow-hidden flex flex-col sm:flex-row transition-all duration-300 shadow-xl group ${
                isLight ? 'liquid-glass-card-light' : 'liquid-glass-card'
              }`}
            >
              {/* Event Poster / Image */}
              <div className="sm:w-2/5 aspect-[4/3] sm:aspect-auto relative bg-neutral-950 overflow-hidden">
                <img
                  src={activity.posterUrl}
                  alt={activity.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent sm:hidden" />
                
                {/* Date overlay tag */}
                <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-amber-400/50 text-center shadow-lg">
                  <span className="block text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                    {new Intl.DateTimeFormat('pt-PT', { month: 'short' }).format(new Date(activity.date))}
                  </span>
                  <span className="block text-base font-black text-white font-mono leading-none">
                    {new Date(activity.date).getUTCDate()}
                  </span>
                </div>
              </div>

              {/* Event Content */}
              <div className="p-5 sm:w-3/5 flex flex-col justify-between">
                <div>
                  <h3 className={`text-base font-bold transition-colors leading-snug mb-2 font-heading ${
                    isLight ? 'text-neutral-900 group-hover:text-amber-600' : 'text-white group-hover:text-amber-300'
                  }`}>
                    {activity.title}
                  </h3>

                  <p className={`text-xs line-clamp-3 leading-relaxed mb-4 ${
                    isLight ? 'text-neutral-600' : 'text-gray-300'
                  }`}>
                    {activity.description}
                  </p>

                  <div className={`space-y-1.5 text-xs ${isLight ? 'text-neutral-600' : 'text-gray-400'}`}>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      <span>{activity.time} (Horário de Angola, Luanda)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#E50914] flex-shrink-0" />
                      <span className="truncate">{activity.location}</span>
                    </div>

                    {activity.additionalInfo && (
                      <div className="flex items-start gap-2 pt-1 text-[11px] text-amber-600 dark:text-amber-300/90">
                        <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{activity.additionalInfo}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className={`pt-4 mt-4 border-t flex items-center justify-between ${
                  isLight ? 'border-neutral-100' : 'border-white/5'
                }`}>
                  <button
                    onClick={() => handleShare(activity)}
                    className={`flex items-center gap-1.5 text-xs transition px-2.5 py-1.5 rounded-lg ${
                      isLight
                        ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-gray-300'
                    }`}
                    title="Partilhar detalhes da atividade"
                  >
                    {copiedId === activity.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-500">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5 text-amber-500" />
                        <span>Partilhar</span>
                      </>
                    )}
                  </button>

                  {/* Admin controls */}
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      {onEditActivity && (
                        <button
                          onClick={() => onEditActivity(activity)}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-amber-500/20 text-gray-300 hover:text-amber-300 text-xs transition"
                          title="Editar atividade"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDeleteActivity && (
                        <button
                          onClick={() => {
                            if (confirm(`Deseja apagar a atividade "${activity.title}"?`)) {
                              onDeleteActivity(activity.id);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white text-xs transition"
                          title="Apagar atividade"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
