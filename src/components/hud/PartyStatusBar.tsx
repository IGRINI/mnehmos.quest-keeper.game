import React, { useMemo } from 'react';
import { useGameStateStore, CharacterStats } from '../../stores/gameStateStore';
import { usePartyStore } from '../../stores/partyStore';
import { ConditionList } from '../common/ConditionBadge';

/**
 * Displays status of party members.
 * Uses theme-aware styling.
 * Only shows characters from the active adventure party - not test NPCs.
 */
export const PartyStatusBar: React.FC = () => {
  const party = useGameStateStore(s => s.party) || [];
  const activeCharacterId = useGameStateStore(s => s.activeCharacterId);
  const setActiveCharacterId = useGameStateStore(s => s.setActiveCharacterId);
  
  // Get active adventure party to check persistence
  // Fix: Select the party object first (stable) then derive members to avoid infinite loop
  const activeParty = usePartyStore(s => s.getActiveParty());
  const activePartyMembers = useMemo(() => activeParty?.members || [], [activeParty]);
  
  const activePartyCharacterIds = useMemo(() => 
    new Set(
      activePartyMembers
        .map(m => m.character?.id)
        .filter((id): id is string => !!id)
    ), 
    [activePartyMembers]
  );

  // CHANGED: Only show characters that are in the active adventure party
  // This filters out test NPCs, enemies, and other non-party characters
  const partyMembers = React.useMemo(() => {
    return party.filter((char: CharacterStats) => 
      char.id && activePartyCharacterIds.has(char.id)
    );
  }, [party, activePartyCharacterIds]);

  if (!partyMembers || partyMembers.length === 0) return null;

  const handleSelectCharacter = (char: CharacterStats) => {
    // All displayed characters are party members, so always allow selection
    if (char.id) {
      setActiveCharacterId(char.id, true);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 animate-fade-in-up">
       {/* Header */}
       <div className="text-[10px] text-terminal-green-dim font-mono font-bold tracking-widest uppercase mb-2 pl-1">Состав группы</div>
       
       {partyMembers.map((char: CharacterStats) => {
         const isActive = char.id === activeCharacterId;
         const hpPercent = char.hp.max > 0 ? (char.hp.current / char.hp.max) * 100 : 0;
         
         return (
           <div 
             key={char.id}
             onClick={() => handleSelectCharacter(char)}
             className={`
               p-3 border-2 transition-colors w-56 font-mono rounded-sm relative overflow-hidden group cursor-pointer
               ${isActive 
                 ? 'bg-terminal-dim border-terminal-green-bright ring-2 ring-terminal-green-bright/50' 
                 : 'bg-terminal-dim/90 border-terminal-green-dim hover:border-terminal-green/50 hover:bg-terminal-dim'}
             `}
           >
             {/* Scanline effect overlay - only visible in terminal theme */}
             <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 pointer-events-none opacity-20 data-[theme=light]:opacity-0 data-[theme=fantasy]:opacity-0" />

             <div className="relative z-10">
                <div className="flex justify-between items-center mb-2 border-b border-terminal-green-dim pb-1">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <span className={`font-bold text-sm truncate uppercase ${isActive ? 'text-terminal-green-bright' : 'text-terminal-green'}`}>
                            {char.name}
                        </span>
                    </div>
                    <span className="text-[10px] text-terminal-green-dim flex-shrink-0">УР {char.level}</span>
                </div>
                
                {/* HP Bar */}
                <div className="w-full bg-terminal-green-dim/20 h-1.5 border border-terminal-green-dim mb-1.5">
                    <div 
                    className={`h-full transition-all duration-500 ${hpPercent < 30 ? 'bg-terminal-red' : 'bg-terminal-green'}`}
                    style={{ width: `${hpPercent}%` }}
                    />
                </div>
                <div className="flex justify-between text-[10px] uppercase tracking-wider">
                    <span className="text-terminal-green">ОЗ {char.hp.current}/{char.hp.max}</span>
                    <span className="text-terminal-green-dim">КД {char.armorClass || 10}</span>
                </div>
                {char.conditions && char.conditions.length > 0 && (
                  <div className="mt-2 text-left">
                    <ConditionList conditions={char.conditions} size="sm" limit={3} />
                  </div>
                )}
             </div>
           </div>
         );
       })}
    </div>
  );
};
