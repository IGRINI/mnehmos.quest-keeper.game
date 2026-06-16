import React from 'react';
import { useCombatStore } from '../../stores/combatStore';

/**
 * Displays the initiative order for the active combat.
 * Theme-aware initiative tracker.
 */
export const TurnOrderBar: React.FC = () => {
  const turnOrder = useCombatStore(s => s.turnOrder);
  const entities = useCombatStore(s => s.entities);
  const currentTurnName = useCombatStore(s => s.currentTurnName);

  if (!turnOrder || turnOrder.length === 0) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-terminal-dim/95 border border-terminal-green-dim rounded-sm px-4 py-2 flex items-center gap-4 pointer-events-auto shadow-lg backdrop-blur-sm z-30">
      <div className="text-[10px] text-terminal-green-dim font-mono font-bold tracking-widest uppercase">Порядок хода</div>
      <div className="h-4 w-px bg-terminal-green-dim"></div>
      
      <div className="flex items-center gap-2">
        {turnOrder.map((name, idx) => {
          // Find entity to get details (HP, etc)
          const entity = entities.find(e => e.name === name);
          const isCurrent = name === currentTurnName;
          
          return (
             <div 
               key={`${name}-${idx}`}
               className={`
                 relative px-3 py-1.5 border transition-all duration-300 font-mono rounded-sm min-w-[80px] text-center
                 ${isCurrent 
                    ? 'bg-terminal-green/20 border-terminal-green text-terminal-green-bright scale-105 z-10 shadow-[0_0_10px_rgba(0,255,65,0.2)]' 
                    : 'bg-terminal-dim/50 border-terminal-green-dim text-terminal-green-dim'}
               `}
             >
               <span className="text-xs font-bold block truncate max-w-[100px]">{name}</span>
               
               {/* HP Bar (Mini) */}
               {entity && entity.metadata?.hp && (
                 <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-terminal-green-dim/30">
                    <div 
                      className={`h-full ${entity.type === 'monster' ? 'bg-terminal-red/70' : 'bg-terminal-green/70'}`}
                      style={{ width: `${(entity.metadata.hp.current / entity.metadata.hp.max) * 100}%` }}
                    />
                 </div>
               )}
             </div>
          );
        })}
      </div>
    </div>
  );
};
