import React, { useState, useEffect } from 'react';
import { ChatHistory } from '../terminal/ChatHistory';
import { ChatInput } from '../terminal/ChatInput';
import { useGameStateStore } from '../../stores/gameStateStore';
import { usePartyStore } from '../../stores/partyStore';
import { CharacterCreationModal } from './CharacterCreationModal';
import { PartySelector, PartyPanel, PartyCreatorModal, CharacterPickerModal } from '../party';
import { getClassLabel, getRaceLabel } from '../character/displayLabels';
import { ConfirmModal } from '../common/ConfirmModal';
import { extractMcpJsonPayload } from '../../utils/mcpUtils';

interface QuickStatsProps {
    isOpen: boolean;
    onToggle: () => void;
}

const QuickStats: React.FC<QuickStatsProps> = ({ isOpen, onToggle }) => {
    const worlds = useGameStateStore((state) => state.worlds || []);
    const world = useGameStateStore((state) => state.world);
    const activeWorldId = useGameStateStore((state) => state.activeWorldId);
    const setActiveWorldId = useGameStateStore((state) => state.setActiveWorldId);
    // *** UNIFIED SOURCE OF TRUTH: Use gameStateStore for active character ***
    const activeCharacterId = useGameStateStore((state) => state.activeCharacterId);

    // Party store state
    const activePartyId = usePartyStore((state) => state.activePartyId);
    const partyDetails = usePartyStore((state) => state.partyDetails);
    const isInitialized = usePartyStore((state) => state.isInitialized);
    const syncPartyDetails = usePartyStore((state) => state.syncPartyDetails);

    // Modal states
    const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
    const [isCreatingParty, setIsCreatingParty] = useState(false);
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [worldDeleteCandidate, setWorldDeleteCandidate] = useState<{ id: string; name: string } | null>(null);
    const [isDeletingWorld, setIsDeletingWorld] = useState(false);
    const [worldDeleteError, setWorldDeleteError] = useState<string | null>(null);

    // Sync party details when initialized and we have an active party but no details
    useEffect(() => {
        if (isInitialized && activePartyId && !partyDetails[activePartyId]) {
            console.log('[QuickStats] Fetching missing party details for:', activePartyId);
            syncPartyDetails(activePartyId);
        }
    }, [isInitialized, activePartyId, partyDetails, syncPartyDetails]);

    const activeParty = activePartyId ? partyDetails[activePartyId] : null;
    // *** Use unified activeCharacterId instead of member.isActive ***
    const activeChar = activeParty?.members?.find((m) => m.characterId === activeCharacterId);

    const handleDeleteWorld = async () => {
        if (!worldDeleteCandidate) return;

        setIsDeletingWorld(true);
        setWorldDeleteError(null);

        try {
            const { mcpManager } = await import('../../services/mcpClient');
            const result = await mcpManager.gameStateClient.callTool('world_manage', {
                action: 'delete',
                id: worldDeleteCandidate.id,
            });
            const payload = extractMcpJsonPayload<{ success?: boolean; error?: boolean; message?: string }>(
                result,
                'WORLD_MANAGE_JSON'
            );
            if (payload?.error || payload?.success === false) {
                throw new Error(payload.message || 'Не удалось удалить мир');
            }
            await useGameStateStore.getState().syncState(true);
            setWorldDeleteCandidate(null);
        } catch (error) {
            console.error('Failed to delete world:', error);
            setWorldDeleteError(error instanceof Error ? error.message : 'Не удалось удалить мир');
        } finally {
            setIsDeletingWorld(false);
        }
    };

    return (
        <>
            <div
                className={`relative h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-out ${
                    isOpen ? 'w-64 lg:w-80' : 'w-10 lg:w-12'
                }`}
            >
                <div
                    className={`absolute inset-y-0 right-0 w-64 lg:w-80 min-w-0 border-l border-terminal-green-dim bg-terminal-black/50 flex flex-col p-3 lg:p-4 gap-4 lg:gap-6 overflow-y-auto transition-transform duration-300 ease-out ${
                        isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
                >
                    {/* Party Selector Header */}
                    <div>
                        <div className="flex items-center justify-between mb-3 gap-2">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-terminal-green/60">
                                Группа
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsCreatingCharacter(true)}
                                    className="px-2 py-1 bg-terminal-green/10 border border-terminal-green text-terminal-green text-xs rounded hover:bg-terminal-green/20 transition-colors"
                                    title="Создать персонажа"
                                >
                                    + Перс.
                                </button>
                                <button
                                    onClick={onToggle}
                                    className="w-7 h-7 flex items-center justify-center bg-terminal-green/10 border border-terminal-green-dim text-terminal-green rounded hover:bg-terminal-green/20 hover:text-terminal-green-bright transition-colors"
                                    title="Скрыть правую панель"
                                    aria-label="Скрыть правую панель"
                                >
                                    <span className="text-lg leading-none">›</span>
                                </button>
                            </div>
                        </div>
                        <PartySelector
                            onCreateParty={() => setIsCreatingParty(true)}
                        />
                    </div>

                    {/* Active Character (Playing) Display */}
                    {activeChar && (
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-terminal-green/60 mb-3 border-b border-terminal-green-dim pb-1">
                                Сейчас играет
                            </h3>
                            <div className="bg-terminal-green/10 p-3 rounded border border-terminal-green/40 shadow-[0_0_10px_rgba(0,255,0,0.1)]">
                                <div className="font-bold text-lg text-terminal-green-bright truncate" title={activeChar.character.name}>
                                    {activeChar.character.name}
                                </div>
                                <div className="text-xs text-terminal-green/70 mb-2">
                                    Ур. {activeChar.character.level} {activeChar.character.race ? `${getRaceLabel(activeChar.character.race)} ` : ''}{getClassLabel(activeChar.character.class)}
                                    {activeChar.role === 'leader' && (
                                        <span className="ml-2 text-yellow-400">★ Лидер</span>
                                    )}
                                </div>

                                {/* HP Bar */}
                                <div className="mb-2">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span>ОЗ</span>
                                        <span>{activeChar.character.hp}/{activeChar.character.maxHp}</span>
                                    </div>
                                    <div className="h-2 bg-terminal-green/20 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-500 ${
                                                activeChar.character.hp / activeChar.character.maxHp > 0.5
                                                    ? 'bg-green-500'
                                                    : activeChar.character.hp / activeChar.character.maxHp > 0.25
                                                    ? 'bg-yellow-500'
                                                    : 'bg-red-500'
                                            }`}
                                            style={{ width: `${Math.min(100, (activeChar.character.hp / activeChar.character.maxHp) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Party Members Panel */}
                    <div>
                        <PartyPanel
                            onAddMember={() => setIsAddingMember(true)}
                            onCreateParty={() => setIsCreatingParty(true)}
                        />
                    </div>

                    {/* Location Info */}
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-terminal-green/60 mb-3 border-b border-terminal-green-dim pb-1">
                            Локация
                        </h3>
                        <div className="text-sm space-y-2">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-terminal-green/60 mb-1">
                                    Выбор мира
                                </label>
                                {worlds.length > 0 ? (
                                    <div className="flex gap-2 min-w-0">
                                        <select
                                            value={activeWorldId || ''}
                                            onChange={(e) => {
                                                setActiveWorldId(e.target.value || null);
                                                useGameStateStore.getState().syncState(true);
                                            }}
                                            className="flex-1 min-w-0 bg-terminal-dim border border-terminal-green-dim text-terminal-green text-xs px-2 py-1 rounded focus:outline-none focus:border-terminal-green-bright truncate"
                                        >
                                            {worlds.map((w: any) => (
                                                <option key={w.id} value={w.id}>
                                                    {w.name}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => {
                                                const selectedWorld = worlds.find((w: any) => w.id === activeWorldId);
                                                if (selectedWorld && activeWorldId) {
                                                    setWorldDeleteError(null);
                                                    setWorldDeleteCandidate({
                                                        id: activeWorldId,
                                                        name: selectedWorld.name || 'Безымянный мир',
                                                    });
                                                }
                                            }}
                                            className="shrink-0 px-2 py-1 bg-red-900/30 border border-red-500/50 text-red-400 text-xs rounded hover:bg-red-900/50 transition-colors"
                                            title="Удалить выбранный мир"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-terminal-green/70 text-xs space-y-1">
                                        <div>Миры недоступны.</div>
                                        <div className="text-terminal-green/50">
                                            Введи <code className="bg-terminal-green/20 px-1 rounded">/new</code> в чате, чтобы создать кампанию с новым миром.
                                        </div>
                                    </div>
                                )}
                                {worldDeleteError && (
                                    <div className="mt-2 text-xs text-red-400">
                                        {worldDeleteError}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 text-terminal-green-bright mb-1">
                                <span className="shrink-0">Мир</span>
                                <span className="font-bold truncate" title={world.location || 'Неизвестная локация'}>{world.location || 'Неизвестная локация'}</span>
                            </div>
                            <div className="text-xs text-terminal-green/70 pl-6 space-y-1">
                                <div>Время: {world.time || 'неизвестно'}</div>
                                <div>Погода: {world.weather || 'неизвестно'}</div>
                                <div>Дата: {world.date || 'неизвестно'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {!isOpen && (
                    <button
                        onClick={onToggle}
                        className="absolute inset-y-0 right-0 w-10 lg:w-12 border-l border-terminal-green-dim bg-terminal-black/80 text-terminal-green hover:text-terminal-green-bright hover:bg-terminal-green/10 transition-colors flex flex-col items-center justify-center gap-3"
                        title="Показать группу и мир"
                        aria-label="Показать группу и мир"
                    >
                        <span className="text-lg leading-none">‹</span>
                        <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-bold uppercase tracking-widest">
                            Группа / Мир
                        </span>
                    </button>
                )}
            </div>

            {/* Modals */}
            <CharacterCreationModal
                isOpen={isCreatingCharacter}
                onClose={() => setIsCreatingCharacter(false)}
            />
            <PartyCreatorModal
                isOpen={isCreatingParty}
                onClose={() => setIsCreatingParty(false)}
            />
            <CharacterPickerModal
                isOpen={isAddingMember}
                onClose={() => setIsAddingMember(false)}
            />
            <ConfirmModal
                isOpen={worldDeleteCandidate !== null}
                onClose={() => setWorldDeleteCandidate(null)}
                onConfirm={handleDeleteWorld}
                title="Удалить мир"
                message={`Удалить мир "${worldDeleteCandidate?.name || 'Безымянный мир'}"? Это действие нельзя отменить.`}
                confirmText="Удалить мир"
                isDanger={true}
                isLoading={isDeletingWorld}
            />
        </>
    );
};

export const AdventureView: React.FC = () => {
    const [isQuickStatsOpen, setIsQuickStatsOpen] = useState(true);

    return (
        <div className="flex h-full w-full bg-terminal-black overflow-hidden">
            {/* Narrative Panel (Chat) */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <ChatHistory />
                <ChatInput />
            </div>

            {/* Quick Stats Panel */}
            <QuickStats
                isOpen={isQuickStatsOpen}
                onToggle={() => setIsQuickStatsOpen((value) => !value)}
            />
        </div>
    );
};
