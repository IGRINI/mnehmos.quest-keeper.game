import React from 'react';

interface WorldEnvironmentOverlayProps {
  worldState: {
    name?: string;
    time?: string;
    date?: string;
    moonPhase?: string;
    weather?: string;
    temperature?: string;
    season?: string;
    hazards?: string[];
  } | null;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  compact?: boolean;
}

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
  new_moon: 'новолуние',
  waxing_crescent: 'растущий серп',
  first_quarter: 'первая четверть',
  waxing_gibbous: 'растущая луна',
  full_moon: 'полнолуние',
  waning_gibbous: 'убывающая луна',
  third_quarter: 'третья четверть',
  waning_crescent: 'убывающий серп',
};

const formatWorldValue = (value: string): string => WORLD_VALUE_LABELS[value] ?? value;

export const WorldEnvironmentOverlay: React.FC<WorldEnvironmentOverlayProps> = ({
  worldState,
  position = 'top-right',
  compact: _compact = false,
}) => {
  if (!worldState) return null;

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  return (
    <div
      className={`absolute ${positionClasses[position]} z-10 bg-terminal-black/80 backdrop-blur-sm border border-terminal-green p-3 font-mono text-terminal-green text-xs max-w-xs pointer-events-none`}
    >
      {/* World Name */}
      {worldState.name && (
        <div className="font-bold text-terminal-green-bright mb-2 text-sm uppercase tracking-wider">
          🌍 {worldState.name}
        </div>
      )}

      {/* Environment Info */}
      <div className="space-y-1">
        {worldState.time && (
          <div className="flex items-center gap-2">
            <span className="text-terminal-green/60 min-w-16">🕐 Время:</span>
            <span>{formatWorldValue(worldState.time)}</span>
          </div>
        )}

        {worldState.date && (
          <div className="flex items-center gap-2">
            <span className="text-terminal-green/60 min-w-16">📅 Дата:</span>
            <span>{worldState.date}</span>
          </div>
        )}

        {worldState.moonPhase && (
          <div className="flex items-center gap-2">
            <span className="text-terminal-green/60 min-w-16">🌙 Луна:</span>
            <span>{formatWorldValue(worldState.moonPhase)}</span>
          </div>
        )}

        {worldState.weather && (
          <div className="flex items-center gap-2">
            <span className="text-terminal-green/60 min-w-16">☁️ Погода:</span>
            <span>{formatWorldValue(worldState.weather)}</span>
          </div>
        )}

        {worldState.temperature && (
          <div className="flex items-center gap-2">
            <span className="text-terminal-green/60 min-w-16">🌡️ Темп.:</span>
            <span>{formatWorldValue(worldState.temperature)}</span>
          </div>
        )}

        {worldState.season && (
          <div className="flex items-center gap-2">
            <span className="text-terminal-green/60 min-w-16">🍂 Сезон:</span>
            <span>{formatWorldValue(worldState.season)}</span>
          </div>
        )}

        {worldState.hazards && Array.isArray(worldState.hazards) && worldState.hazards.length > 0 && (
          <div className="mt-2 pt-2 border-t border-terminal-green/30">
            <div className="text-red-500 font-bold mb-1">⚠️ Опасности:</div>
            <div className="space-y-0.5">
              {worldState.hazards.map((hazard, i) => (
                <div key={i} className="text-red-400 text-xs">• {hazard}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
