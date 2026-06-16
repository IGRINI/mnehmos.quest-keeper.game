import React, { useState } from 'react';
import { useGameStateStore } from '../../stores/gameStateStore';
import { WorldEnvironmentForm } from './WorldEnvironmentForm';

const UNKNOWN_LABEL = 'Неизвестно';

const WORLD_VALUE_LABELS: Record<string, string> = {
  dawn: 'рассвет',
  morning: 'утро',
  noon: 'полдень',
  afternoon: 'после полудня',
  dusk: 'закат',
  evening: 'вечер',
  night: 'ночь',
  midnight: 'полночь',
  spring: 'весна',
  summer: 'лето',
  autumn: 'осень',
  fall: 'осень',
  winter: 'зима',
  clear: 'ясно',
  cloudy: 'облачно',
  overcast: 'пасмурно',
  light_rain: 'легкий дождь',
  heavy_rain: 'сильный дождь',
  thunderstorm: 'гроза',
  fog: 'туман',
  snow: 'снег',
  blizzard: 'метель',
  windy: 'ветрено',
  freezing: 'мороз',
  cold: 'холодно',
  cool: 'прохладно',
  mild: 'умеренно',
  warm: 'тепло',
  hot: 'жарко',
  scorching: 'пекло',
  bright_daylight: 'яркий дневной свет',
  dim_golden_light: 'тусклый золотой свет',
  fading_orange_light: 'гаснущий оранжевый свет',
  moonlight: 'лунный свет',
  starlight: 'только звезды',
  pitch_black: 'кромешная тьма',
  torchlight: 'свет факелов',
  candlelight: 'свет свечей',
  magical_glow: 'магическое сияние',
  dark_and_ominous: 'мрачно и зловеще',
  new_moon: 'новолуние',
  waxing_crescent: 'растущий серп',
  first_quarter: 'первая четверть',
  waxing_gibbous: 'растущая луна',
  full_moon: 'полнолуние',
  waning_gibbous: 'убывающая луна',
  third_quarter: 'третья четверть',
  waning_crescent: 'убывающий серп',
};

const formatWorldValue = (value: string): string =>
  WORLD_VALUE_LABELS[value] ?? value;

export const WorldStateView: React.FC = () => {
  const world = useGameStateStore((state) => state.world);
  const syncState = useGameStateStore((state) => state.syncState);
  const [showEnvironmentForm, setShowEnvironmentForm] = useState(false);
  
  // Safety check - return loading state if world is undefined
  if (!world) {
    return (
      <div className="h-full w-full flex items-center justify-center font-mono text-terminal-green">
        <div className="text-center">
          <div className="text-xl mb-2">⚠️ Загружаю состояние мира...</div>
          <button
            onClick={() => syncState?.()}
            className="px-4 py-2 bg-terminal-green text-terminal-black font-bold uppercase"
          >
            Повторить синхронизацию
          </button>
        </div>
      </div>
    );
  }
  
  const env = world.environment || {};

  const InfoRow = ({ label, value, icon }: { label: string; value: string; icon?: string }) => (
    <div className="flex justify-between items-center border-b border-terminal-green-dim/30 py-2">
      <span className="text-terminal-green/70 uppercase tracking-wider text-xs flex items-center gap-2">
        {icon && <span className="text-sm">{icon}</span>}
        {label}
      </span>
      <span className="font-bold text-terminal-green-bright text-sm">{value}</span>
    </div>
  );

  const Section = ({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <h3 className="text-sm font-bold mb-3 border-b border-terminal-green pb-2 uppercase tracking-widest text-terminal-green-bright flex items-center gap-2">
        <span className="text-base">{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  );

  // Get NPC and Event counts
  const npcCount = world.npcs ? Object.keys(world.npcs).length : 0;
  const eventCount = world.events ? Object.keys(world.events).length : 0;

  return (
    <div className="h-full w-full flex flex-col p-4 font-mono text-terminal-green overflow-hidden">
      <div className="flex justify-between items-center mb-4 border-b border-terminal-green-dim pb-2 flex-shrink-0">
        <h2 className="text-xl font-bold uppercase tracking-wider text-glow">
          Матрица состояния мира
        </h2>
        <button
          onClick={() => syncState()}
          className="px-3 py-1 text-xs bg-terminal-green/10 border border-terminal-green hover:bg-terminal-green/20 transition-colors uppercase tracking-wider"
          title="Обновить состояние мира с сервера"
        >
          🔄 Обновить
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-scroll pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0, 255, 65, 0.6) rgba(0, 255, 65, 0.1)' }}>
        {/* Location Banner */}
        <div className="bg-terminal-green/10 border-2 border-terminal-green p-4 mb-6 rounded-sm">
          <div className="text-xs text-terminal-green/60 uppercase tracking-wider mb-1">Текущая локация</div>
          <div className="text-2xl font-bold text-terminal-green-bright text-glow">{world.location}</div>
          {world.lastUpdated && (
            <div className="text-xs text-terminal-green/50 mt-2">
              Обновлено: {new Date(world.lastUpdated).toLocaleString()}
            </div>
          )}
        </div>

        {/* Environment Form Toggle */}
        <div className="mb-6">
          <button
            onClick={() => setShowEnvironmentForm(!showEnvironmentForm)}
            className="w-full flex items-center justify-between px-4 py-2 bg-terminal-green/10 border border-terminal-green hover:bg-terminal-green/20 transition-colors"
          >
            <span className="text-sm font-bold uppercase tracking-wider text-terminal-green-bright flex items-center gap-2">
              <span>🌤️</span>
              Настроить окружение
            </span>
            <span className="text-terminal-green">{showEnvironmentForm ? '▲' : '▼'}</span>
          </button>
          {showEnvironmentForm && (
            <div className="mt-2">
              <WorldEnvironmentForm onClose={() => setShowEnvironmentForm(false)} />
            </div>
          )}
        </div>

        {/* Time & Astronomical Data */}
        <Section title="Время и астрономия" icon="🌙">
          <div className="bg-terminal-black/50 p-3 border border-terminal-green-dim rounded-sm space-y-1">
            <InfoRow
              label="Дата"
              value={env.date?.full_date || env.date || world.date || UNKNOWN_LABEL}
              icon="📅"
            />
            <InfoRow
              label="Время суток"
              value={formatWorldValue(env.specific_time || env.time_of_day || env.battlefield?.time_of_day || world.time || UNKNOWN_LABEL)}
              icon="🕒"
            />
            <InfoRow
              label="Сезон"
              value={formatWorldValue(env.season?.current || (typeof env.season === 'string' ? env.season : null) || UNKNOWN_LABEL)}
              icon="🍂"
            />
            <InfoRow
              label="Фаза луны"
              value={formatWorldValue(env.moon_phase?.phase || (typeof env.moon_phase === 'string' ? env.moon_phase : null) || UNKNOWN_LABEL)}
              icon="🌙"
            />
            {(env.sunrise?.time || env.sunset?.time) && (
              <>
                {env.sunrise?.time && <InfoRow label="Рассвет" value={env.sunrise.time} icon="🌅" />}
                {env.sunset?.time && <InfoRow label="Закат" value={env.sunset.time} icon="🌆" />}
              </>
            )}
          </div>
        </Section>

        {/* Weather & Environment */}
        <Section title="Погода и окружение" icon="☁️">
          <div className="bg-terminal-black/50 p-3 border border-terminal-green-dim rounded-sm space-y-1">
            <InfoRow
              label="Условия"
              value={formatWorldValue(env.weather?.condition || env.battlefield?.weather || (typeof env.weather === 'string' ? env.weather : null) || world.weather || UNKNOWN_LABEL)}
              icon="☁️"
            />
            <InfoRow
              label="Температура"
              value={formatWorldValue(env.temperature?.current || (typeof env.temperature === 'string' ? env.temperature : null) || UNKNOWN_LABEL)}
              icon="🌡️"
            />
            <InfoRow
              label="Освещение"
              value={formatWorldValue(env.lighting?.overall || env.lighting?.ambient || (typeof env.lighting === 'string' ? env.lighting : null) || UNKNOWN_LABEL)}
              icon="💡"
            />
            {env.wind?.speed && (
              <InfoRow
                label="Ветер"
                value={`${env.wind.speed} ${env.wind.direction || ''}`}
                icon="💨"
              />
            )}
            {env.visibility?.current && (
              <InfoRow
                label="Видимость"
                value={env.visibility.current}
                icon="👁️"
              />
            )}
            {env.forecast && (
              <div className="mt-3 pt-3 border-t border-terminal-green-dim/30">
                <div className="text-xs text-terminal-green/60 uppercase mb-1">Прогноз</div>
                <div className="text-sm text-terminal-green-bright italic">
                  {typeof env.forecast === 'string' 
                    ? env.forecast 
                    : env.forecast?.tonight || 'Прогноз недоступен'}
                </div>
              </div>
            )}
            {env.hazards && Array.isArray(env.hazards) && env.hazards.length > 0 && (
              <div className="mt-3 pt-3 border-t border-terminal-green-dim/30">
                <div className="text-xs text-terminal-green/60 uppercase mb-2 flex items-center gap-1">
                  <span>⚠️</span> Опасности
                </div>
                <ul className="space-y-1">
                  {env.hazards.map((hazard: string, idx: number) => (
                    <li key={idx} className="text-sm text-yellow-400 flex items-start gap-2">
                      <span>⚠️</span>
                      <span>{typeof hazard === 'string' ? hazard : String(hazard)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>

        {/* NPCs */}
        {npcCount > 0 && (
          <Section title="НПС рядом" icon="👥">
            <div className="bg-terminal-black/50 p-3 border border-terminal-green-dim rounded-sm">
              <div className="text-sm text-terminal-green/80">
                НПС отслеживается: {npcCount}
              </div>
              <div className="mt-2 space-y-1">
                {Object.keys(world.npcs!).slice(0, 5).map((npcName) => (
                  <div key={npcName} className="text-xs text-terminal-green-bright">
                    • {npcName}
                  </div>
                ))}
                {npcCount > 5 && (
                  <div className="text-xs text-terminal-green/50 italic">
                    ...и еще {npcCount - 5}
                  </div>
                )}
              </div>
            </div>
          </Section>
        )}

        {/* Events */}
        {eventCount > 0 && (
          <Section title="Недавние события" icon="📚">
            <div className="bg-terminal-black/50 p-3 border border-terminal-green-dim rounded-sm">
              <div className="text-sm text-terminal-green/80">
                Событий записано: {eventCount}
              </div>
              <div className="mt-2 space-y-1">
                {Object.keys(world.events!).slice(0, 5).map((eventKey) => (
                  <div key={eventKey} className="text-xs text-terminal-green-bright">
                    • {eventKey}
                  </div>
                ))}
                {eventCount > 5 && (
                  <div className="text-xs text-terminal-green/50 italic">
                    ...и еще {eventCount - 5}
                  </div>
                )}
              </div>
            </div>
          </Section>
        )}

        {/* Placeholder for no data */}
        {npcCount === 0 && eventCount === 0 && (
          <div className="mt-8 border border-terminal-green-dim p-8 text-center opacity-30 uppercase tracking-widest">
            [ДОПОЛНИТЕЛЬНЫЙ МОДУЛЬ ДАННЫХ ОТКЛЮЧЕН]
          </div>
        )}
      </div>
    </div>
  );
};
