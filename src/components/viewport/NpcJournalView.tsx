import React, { useEffect } from 'react';
import { useNpcStore, FAMILIARITY_CONFIG, DISPOSITION_CONFIG } from '../../stores/npcStore';
import { useGameStateStore } from '../../stores/gameStateStore';
import { NpcRelationshipList } from '../npc/NpcRelationshipCard';
import { NpcMemoryTimeline } from '../npc/NpcMemoryTimeline';

const FAMILIARITY_LABELS: Record<string, string> = {
  stranger: 'Незнакомец',
  acquaintance: 'Знакомый',
  friend: 'Друг',
  close_friend: 'Близкий друг',
  rival: 'Соперник',
  enemy: 'Враг',
};

const DISPOSITION_LABELS: Record<string, string> = {
  hostile: 'Враждебен',
  unfriendly: 'Недружелюбен',
  neutral: 'Нейтрален',
  friendly: 'Дружелюбен',
  helpful: 'Готов помочь',
};

/**
 * NPC Journal View - Shows relationships and conversation history
 */
export const NpcJournalView: React.FC = () => {
  const activeCharacter = useGameStateStore(s => s.activeCharacter);
  const relationships = useNpcStore(s => s.relationships);
  const selectedNpcId = useNpcStore(s => s.selectedNpcId);
  const fetchRecentMemories = useNpcStore(s => s.fetchRecentMemories);
  const fetchNpcHistory = useNpcStore(s => s.fetchNpcHistory);
  const isLoading = useNpcStore(s => s.isLoading);
  
  // Load recent memories when character changes
  useEffect(() => {
    if (activeCharacter?.id) {
      fetchRecentMemories(activeCharacter.id);
    }
  }, [activeCharacter?.id, fetchRecentMemories]);
  
  // Load NPC history when selected
  useEffect(() => {
    if (activeCharacter?.id && selectedNpcId) {
      fetchNpcHistory(activeCharacter.id, selectedNpcId);
    }
  }, [activeCharacter?.id, selectedNpcId, fetchNpcHistory]);
  
  const selectedRelationship = relationships.find(r => r.npcId === selectedNpcId);
  
  if (!activeCharacter) {
    return (
      <div className="h-full flex items-center justify-center text-terminal-green-dim">
        Выберите персонажа, чтобы открыть его журнал
      </div>
    );
  }
  
  return (
    <div className="h-full flex bg-terminal-black">
      {/* Left Sidebar - NPC List */}
      <div className="w-64 border-r border-terminal-green-dim/30 flex flex-col">
        <div className="p-3 border-b border-terminal-green-dim/30">
          <h2 className="text-terminal-green font-bold uppercase tracking-wider text-sm">
            Известные НПС
          </h2>
          <p className="text-terminal-green-dim text-xs mt-1">
            Контактов: {relationships.length}
          </p>
        </div>
        
        <div className="flex-grow overflow-y-auto p-2">
          <NpcRelationshipList />
        </div>
      </div>
      
      {/* Main Panel - Selected NPC Details */}
      <div className="flex-grow flex flex-col overflow-hidden">
        {selectedRelationship ? (
          <>
            {/* NPC Header */}
            <div className="p-4 border-b border-terminal-green-dim/30">
              <div className="flex items-center gap-3">
                <span className="text-3xl">
                  {FAMILIARITY_CONFIG[selectedRelationship.familiarity].icon}
                </span>
                <div>
                  <h1 className="text-terminal-green-bright text-xl font-bold">
                    {selectedRelationship.npcName || selectedRelationship.npcId.slice(0, 8)}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span 
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ 
                        backgroundColor: FAMILIARITY_CONFIG[selectedRelationship.familiarity].color + '30',
                        color: FAMILIARITY_CONFIG[selectedRelationship.familiarity].color
                      }}
                    >
                      {FAMILIARITY_LABELS[selectedRelationship.familiarity] ?? FAMILIARITY_CONFIG[selectedRelationship.familiarity].label}
                    </span>
                    <span className="text-terminal-green-dim text-sm">
                      {DISPOSITION_CONFIG[selectedRelationship.disposition].icon} {DISPOSITION_LABELS[selectedRelationship.disposition] ?? DISPOSITION_CONFIG[selectedRelationship.disposition].label}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Notes */}
              {selectedRelationship.notes && (
                <div className="mt-3 p-2 bg-terminal-green/10 rounded text-terminal-green text-sm">
                  📝 {selectedRelationship.notes}
                </div>
              )}
            </div>
            
            {/* Conversation Timeline */}
            <div className="flex-grow overflow-y-auto p-4">
              <h3 className="text-terminal-green font-bold uppercase tracking-wider text-sm mb-3">
                История разговоров
              </h3>
              <NpcMemoryTimeline />
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-terminal-green-dim">
            <div className="text-center">
              <div className="text-4xl mb-2">📖</div>
              <p>Выберите НПС, чтобы увидеть историю общения</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-terminal-black/50 flex items-center justify-center">
          <div className="text-terminal-green animate-pulse">Загрузка...</div>
        </div>
      )}
    </div>
  );
};
