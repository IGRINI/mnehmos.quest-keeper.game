import React from 'react';
import { useHudStore } from '../../stores/hudStore';
import { useCombatStore } from '../../stores/combatStore';
import { mcpManager } from '../../services/mcpClient';
import { extractEmbeddedJson } from '../../utils/mcpUtils';

/**
 * Bottom action bar for map visualization tools.
 * Theme-aware styling.
 */
export const QuickActionBar: React.FC = () => {
    const toggleInventory = useHudStore(s => s.toggleInventory);
    const toggleSpellbook = useHudStore(s => s.toggleSpellbook);
    const toggleCombatLog = useHudStore(s => s.toggleCombatLog);
    const isCombatLogOpen = useHudStore(s => s.isCombatLogOpen);
    
    // Visualization tools from combat store
    const showLineOfSight = useCombatStore(s => s.showLineOfSight);
    const measureMode = useCombatStore(s => s.measureMode);
    const setShowLineOfSight = useCombatStore(s => s.setShowLineOfSight);
    const setMeasureMode = useCombatStore(s => s.setMeasureMode);
    const activeEncounterId = useCombatStore(s => s.activeEncounterId);

    // Clear scene handler
    const clearCombat = useCombatStore(s => s.clearCombat);
    
    const handleClearScene = () => {
        if (window.confirm('Полностью очистить сцену? Это сбросит все боевые визуализации и активную схватку.')) {
            clearCombat(false); // Full reset including encounter ID
        }
    };

    // End encounter handler - calls backend and clears local state
    const handleEndEncounter = async () => {
        if (!activeEncounterId) {
            alert('Нет активной схватки для завершения.');
            return;
        }
        
        if (window.confirm('Завершить эту схватку? Бой будет закрыт, а поле боя очищено.')) {
            try {
                const result = await mcpManager.gameStateClient.callTool('combat_manage', {
                    action: 'end',
                    encounterId: activeEncounterId
                });

                // A resolved callTool is NOT success: the response may be a plain-text /
                // error / malformed payload. Parse the COMBAT_MANAGE_JSON envelope and only
                // clear local combat state on EXPLICIT success (envelope present + no error).
                // A null parse means the call failed — preserve the encounter intact.
                const text = typeof result === 'string'
                    ? result
                    : (result?.content?.find((c: any) => c?.type === 'text')?.text ?? '');
                const parsed = extractEmbeddedJson<any>(text, 'COMBAT_MANAGE_JSON');

                if (!parsed || parsed.error) {
                    console.error('[QuickActionBar] Failed to end encounter (no success envelope):', parsed?.error ?? result);
                    alert('Не удалось завершить схватку. Бой все еще активен. Подробности в консоли.');
                    return; // Preserve the encounter — do NOT clear local combat state.
                }

                clearCombat(false); // Full clear including encounter ID — only after explicit success.
                console.log('[QuickActionBar] Encounter ended:', activeEncounterId);
            } catch (e) {
                console.error('[QuickActionBar] Failed to end encounter:', e);
                alert('Не удалось завершить схватку. Подробности в консоли.');
            }
        }
    };

    return (
        <div className="flex gap-2 p-2 bg-terminal-dim/95 rounded-sm border border-terminal-green-dim shadow-2xl animate-fade-in-up">
            <ActionButton
                label="Инвентарь"
                icon="🎒"
                onClick={toggleInventory}
            />
            <ActionButton
                label="Заклинания"
                icon="📖"
                onClick={toggleSpellbook}
            />
            <ActionButton
                label="Журнал боя"
                icon="📜"
                onClick={toggleCombatLog}
                active={isCombatLogOpen}
            />
            <ActionButton
                label="Обзор"
                icon="👁️"
                onClick={() => setShowLineOfSight(!showLineOfSight)}
                active={showLineOfSight}
            />
            <ActionButton
                label="Дистанция"
                icon="📏"
                onClick={() => setMeasureMode(!measureMode)}
                active={measureMode}
            />
            <ActionButton
                label="Очистить"
                icon="🗑️"
                onClick={handleClearScene}
            />
            <ActionButton
                label="Завершить"
                icon="⚔️"
                onClick={handleEndEncounter}
                disabled={!activeEncounterId}
            />
        </div>
    );
};

interface ActionButtonProps {
    label: string;
    icon: string;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({ label, icon, onClick, active, disabled }) => (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`
        flex flex-col items-center justify-center
        w-20 h-14 rounded-sm transition-all border font-mono
        ${disabled 
            ? 'opacity-30 cursor-not-allowed bg-terminal-dim border-terminal-green-dim text-terminal-green-dim' 
            : active
                ? 'bg-terminal-green/20 border-terminal-green text-terminal-green-bright shadow-[0_0_10px_rgba(0,255,65,0.2)]'
                : 'bg-terminal-green/10 hover:bg-terminal-green/20 border-terminal-green-dim text-terminal-green hover:text-terminal-green-bright'
        }
        active:scale-95
      `}
    >
        <span className="text-xl mb-1 filter drop-shadow-md">{icon}</span>
        <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </button>
);
