import React from 'react';
import { useCombatStore } from '../../stores/combatStore';

/**
 * Get health status description based on HP percentage
 */
function getHealthStatus(current: number, max: number): { label: string; color: string; bgColor: string } {
    if (max <= 0) return { label: 'Неизвестно', color: 'text-terminal-green-dim', bgColor: 'bg-terminal-green/5' };
    
    const percent = (current / max) * 100;
    
    if (current <= 0) {
        return { label: 'Побежден', color: 'text-gray-500', bgColor: 'bg-gray-500/10' };
    } else if (percent >= 75) {
        return { label: 'Здоров', color: 'text-green-400', bgColor: 'bg-green-500/10' };
    } else if (percent >= 50) {
        return { label: 'Ранен', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' };
    } else if (percent >= 25) {
        return { label: 'Тяжело ранен', color: 'text-orange-400', bgColor: 'bg-orange-500/10' };
    } else {
        return { label: 'Критическое', color: 'text-red-400', bgColor: 'bg-red-500/10' };
    }
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
    character: 'Персонаж',
    monster: 'Монстр',
    npc: 'НПС',
};

const SIZE_LABELS: Record<string, string> = {
    tiny: 'крошечный',
    small: 'маленький',
    medium: 'средний',
    large: 'большой',
    huge: 'огромный',
    gargantuan: 'исполинский',
};

const CONDITION_LABELS: Record<string, string> = {
    blinded: 'ослеплен',
    charmed: 'очарован',
    deafened: 'оглох',
    frightened: 'испуган',
    grappled: 'схвачен',
    incapacitated: 'выведен из строя',
    invisible: 'невидим',
    paralyzed: 'парализован',
    petrified: 'окаменел',
    poisoned: 'отравлен',
    prone: 'сбит с ног',
    restrained: 'опутан',
    stunned: 'оглушен',
    unconscious: 'без сознания',
    exhausted: 'истощен',
};

function getDisplayLabel(value: string | undefined, labels: Record<string, string>): string {
    if (!value) return '';
    return labels[value.toLowerCase()] || value;
}

/**
 * Displays details for the currently Selected Entity (Target).
 * Shows exact HP for PCs, health status descriptions for enemies.
 * Theme-aware HUD element.
 */
export const CharacterQuickView: React.FC = () => {
    const selectedEntityId = useCombatStore(s => s.selectedEntityId);
    const entities = useCombatStore(s => s.entities);
    
    // Find the selected entity
    const entity = selectedEntityId ? entities.find(e => e.id === selectedEntityId) : null;
    
    if (!entity) return null;

    const meta = entity.metadata;
    const isEnemy = entity.type === 'monster';
    const hpPercent = meta.hp.max > 0 ? (meta.hp.current / meta.hp.max) * 100 : 0;
    const healthStatus = getHealthStatus(meta.hp.current, meta.hp.max);
    
    return (
        <div className="bg-terminal-dim/95 border border-terminal-green-dim rounded-sm p-4 w-72 shadow-2xl animate-fade-in-up font-mono">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 border-b border-terminal-green-dim pb-2">
                <h3 className={`font-bold text-lg truncate ${isEnemy ? 'text-terminal-red' : 'text-terminal-green-bright'}`}>
                    {entity.name}
                </h3>
                <span className={`text-[10px] uppercase px-1.5 py-0.5 border rounded-sm ${
                   isEnemy 
                    ? 'bg-terminal-red/10 text-terminal-red border-terminal-red/30' 
                    : 'bg-terminal-green/10 text-terminal-green border-terminal-green-dim'
                }`}>
                   {getDisplayLabel(entity.type, ENTITY_TYPE_LABELS)}
                </span>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-3">
                {/* HP Display - Different for enemies vs PCs */}
                <div className={`border border-terminal-green-dim rounded-sm p-2 text-center ${isEnemy ? healthStatus.bgColor : 'bg-terminal-green/10'}`}>
                    <div className="text-[10px] text-terminal-green-dim uppercase tracking-wider mb-1">
                        {isEnemy ? 'Состояние' : 'ОЗ'}
                    </div>
                    {isEnemy ? (
                        // Enemies: Show status description only
                        <div className={`text-lg font-bold ${healthStatus.color}`}>
                            {healthStatus.label}
                        </div>
                    ) : (
                        // PCs: Show exact HP
                        <div className="text-xl text-terminal-green-bright">
                            {meta.hp.current} <span className="text-sm text-terminal-green-dim">/ {meta.hp.max}</span>
                        </div>
                    )}
                </div>
                
                <div className="bg-terminal-green/10 border border-terminal-green-dim rounded-sm p-2 text-center">
                    <div className="text-[10px] text-terminal-green-dim uppercase tracking-wider mb-1">КД</div>
                    <div className="text-xl text-terminal-green-bright">
                        {meta.ac}
                    </div>
                </div>
            </div>
            
            {/* HP Bar - Visual indicator for both */}
            <div className="mb-3">
                <div className="w-full bg-terminal-green-dim/20 h-2 rounded-sm border border-terminal-green-dim overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-500 ${
                            hpPercent >= 75 ? 'bg-green-500' :
                            hpPercent >= 50 ? 'bg-yellow-500' :
                            hpPercent >= 25 ? 'bg-orange-500' :
                            'bg-red-500'
                        }`}
                        style={{ width: `${Math.max(0, hpPercent)}%` }}
                    />
                </div>
            </div>
            
            {/* Additional Info for Enemies */}
            {isEnemy && meta.speed && (
                <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                    <div className="bg-terminal-green/5 border border-terminal-green-dim/50 rounded-sm p-1.5">
                        <div className="text-[9px] text-terminal-green-dim uppercase">Скор.</div>
                        <div className="text-sm text-terminal-green">{meta.speed} фт.</div>
                    </div>
                    {meta.initiative !== undefined && (
                        <div className="bg-terminal-green/5 border border-terminal-green-dim/50 rounded-sm p-1.5">
                            <div className="text-[9px] text-terminal-green-dim uppercase">Иниц.</div>
                            <div className="text-sm text-terminal-green">{meta.initiative}</div>
                        </div>
                    )}
                    {meta.size && (
                        <div className="bg-terminal-green/5 border border-terminal-green-dim/50 rounded-sm p-1.5">
                            <div className="text-[9px] text-terminal-green-dim uppercase">Размер</div>
                            <div className="text-sm text-terminal-green capitalize">{getDisplayLabel(meta.size, SIZE_LABELS)}</div>
                        </div>
                    )}
                </div>
            )}
            
            {/* Conditions */}
            {meta.conditions && meta.conditions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-terminal-green-dim/30">
                    {meta.conditions.map(c => (
                        <span 
                            key={c} 
                            title={getDisplayLabel(c, CONDITION_LABELS)}
                            className="text-[10px] bg-terminal-amber/10 text-terminal-amber border border-terminal-amber/30 px-2 py-0.5 rounded-sm cursor-help"
                        >
                           {getDisplayLabel(c, CONDITION_LABELS)}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};
