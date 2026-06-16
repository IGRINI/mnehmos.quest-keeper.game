import React from 'react';
import { useHudStore } from '../../stores/hudStore';
import { useGameStateStore } from '../../stores/gameStateStore';
import { SpellBookView } from '../character/SpellBookView';

/**
 * Slide-out Spellbook Drawer.
 * Terminal-styled spellbook access from the HUD.
 */
export const SpellbookDrawer: React.FC = () => {
  const isOpen = useHudStore(s => s.isSpellbookOpen);
  const toggleSpellbook = useHudStore(s => s.toggleSpellbook);
  
  const activeCharacter = useGameStateStore(s => s.activeCharacter);

  if (!isOpen) return null;

  return (
    <div className="w-96 h-full bg-terminal-black/95 border-l border-terminal-green/30 pointer-events-auto animate-slide-in-right overflow-hidden font-mono z-40 shadow-2xl flex flex-col">
      <div className="flex justify-between items-center p-4 border-b border-terminal-green/30">
         <div>
            <h2 className="text-lg font-bold text-terminal-green-bright tracking-wider uppercase">Книга заклинаний</h2>
            {activeCharacter && <div className="text-[10px] text-terminal-green uppercase font-bold tracking-widest">{activeCharacter.name}</div>}
         </div>
         <button 
           onClick={toggleSpellbook}
           className="text-terminal-green/60 hover:text-terminal-green uppercase text-xs tracking-widest border border-terminal-green/30 px-2 py-1 hover:border-terminal-green transition-colors"
         >
           Закрыть
         </button>
      </div>
      
      {!activeCharacter ? (
        <div className="text-terminal-green/50 italic text-center py-10">Нет данных персонажа.</div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <SpellBookView
            characterId={activeCharacter.id || ''}
            spellSlots={activeCharacter.spellSlots as any}
            pactMagicSlots={activeCharacter.pactMagicSlots as any}
            knownSpells={activeCharacter.knownSpells}
            preparedSpells={activeCharacter.preparedSpells}
            cantripsKnown={activeCharacter.cantripsKnown}
            spellSaveDC={activeCharacter.spellSaveDC}
            spellAttackBonus={activeCharacter.spellAttackBonus}
            spellcastingAbility={activeCharacter.spellcastingAbility}
          />
        </div>
      )}
    </div>
  );
};
