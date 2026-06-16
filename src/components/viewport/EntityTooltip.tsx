import React from 'react';
import { Html } from '@react-three/drei';
import { Entity } from '../../stores/combatStore';

interface EntityTooltipProps {
  entity: Entity;
}

const getHealthStatus = (current: number, max: number): { text: string; color: string } => {
  if (max === 0) return { text: 'Неизвестно', color: 'text-gray-400' };
  const pct = current / max;
  if (pct >= 0.9) return { text: 'Здоров', color: 'text-green-400' };
  if (pct >= 0.5) return { text: 'Ранен', color: 'text-yellow-400' };
  if (pct >= 0.1) return { text: 'При смерти', color: 'text-orange-500' };
  return { text: 'Критично', color: 'text-red-500 font-bold' };
};

export const EntityTooltip: React.FC<EntityTooltipProps> = ({ entity }) => {
  const { name, metadata, type } = entity;
  const { hp, ac, creatureType, conditions, stats } = metadata;
  const isRich = type === 'character';

  const healthStatus = getHealthStatus(hp.current, hp.max);

  return (
    <Html
      position={[0, 0, 0]}
      center
      style={{
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        zIndex: 1000,
      }}
    >
      <div className="bg-terminal-black/95 border border-terminal-green text-terminal-green font-mono text-xs p-2 rounded shadow-[0_0_15px_rgba(0,255,65,0.3)] min-w-[160px] backdrop-blur-sm">
        {/* Header */}
        <div className="border-b border-terminal-green/50 pb-1 mb-2">
          <div className="font-bold text-sm text-glow flex justify-between items-center">
            <span>{name}</span>
            {isRich && <span className="text-[10px] bg-terminal-green/20 px-1 rounded ml-2">УР. ?</span>}
          </div>
          <div className="text-[10px] text-terminal-green/70 uppercase tracking-wider flex justify-between">
            <span>{creatureType}</span>
            <span>{isRich ? 'ИГРОК' : 'НПС'}</span>
          </div>
        </div>

        {/* Core Stats Grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
          {/* Health */}
          <div className="flex justify-between items-center col-span-2">
            <span className="text-terminal-green/70">ОЗ:</span>
            {isRich ? (
              <span className={hp.current < hp.max / 2 ? "text-red-500 font-bold" : ""}>
                {hp.current} <span className="text-xs text-terminal-green/50">/ {hp.max}</span>
              </span>
            ) : (
              <span className={`${healthStatus.color} uppercase text-[10px]`}>
                {healthStatus.text}
              </span>
            )}
          </div>
          
          {/* AC / Speed */}
          <div className="flex justify-between">
            <span className="text-terminal-green/70">КД:</span>
            <span>{isRich || ac < 10 ? ac : '?'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-terminal-green/70">СКР:</span>
            <span>30</span>{/* Placeholder, get from metadata if avail */}
          </div>
        </div>

        {/* Ability Scores (Rich Only) */}
        {isRich && stats && (
          <div className="grid grid-cols-6 gap-0.5 mb-2 text-[9px] text-center border-t border-terminal-green/30 pt-1">
            <div>
              <div className="text-terminal-green/50">СИЛ</div>
              <div>{stats.str}</div>
            </div>
            <div>
              <div className="text-terminal-green/50">ЛОВ</div>
              <div>{stats.dex}</div>
            </div>
            <div>
              <div className="text-terminal-green/50">ТЕЛ</div>
              <div>{stats.con}</div>
            </div>
            <div>
              <div className="text-terminal-green/50">ИНТ</div>
              <div>{stats.int}</div>
            </div>
            <div>
              <div className="text-terminal-green/50">МДР</div>
              <div>{stats.wis}</div>
            </div>
            <div>
              <div className="text-terminal-green/50">ХАР</div>
              <div>{stats.cha}</div>
            </div>
          </div>
        )}

        {/* Conditions */}
        {conditions && conditions.length > 0 && (
          <div className="border-t border-terminal-green/50 pt-1 mt-1">
            <div className="flex flex-wrap gap-1">
              {conditions.map((condition, index) => (
                <span 
                  key={index}
                  className="text-[9px] bg-red-900/40 text-red-200 border border-red-800/50 px-1 rounded"
                >
                  {condition}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Html>
  );
};
