import React from 'react';
import { useCombatStore } from '../../stores/combatStore';
import { ConfirmModal } from '../common/ConfirmModal';

export const VisualizationControls: React.FC = () => {
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);

  const showLineOfSight = useCombatStore(state => state.showLineOfSight);
  const measureMode = useCombatStore(state => state.measureMode);
  const setShowLineOfSight = useCombatStore(state => state.setShowLineOfSight);
  const setMeasureMode = useCombatStore(state => state.setMeasureMode);

  return (
    <>
    <div className="absolute top-24 right-4 flex flex-col gap-2 z-30 pointer-events-auto">
       {/* Tool Label */}
       <div className="text-[10px] uppercase text-green-500/50 font-mono tracking-widest text-right mb-1">
          Инструменты карты
       </div>

      <div className="flex flex-col gap-1 bg-black/90 border border-green-900/50 p-2 rounded-sm shadow-lg backdrop-blur-sm">
        <button
          onClick={() => setShowLineOfSight(!showLineOfSight)}
          className={`
            flex items-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-wider transition-colors border rounded-sm
            ${showLineOfSight 
               ? 'bg-green-900/30 border-green-500/50 text-green-300' 
               : 'bg-transparent border-transparent text-green-700 hover:text-green-500 hover:bg-green-900/10'}
          `}
        >
          <span>👁️</span> Линия видимости
        </button>
        
        <button
          onClick={() => setMeasureMode(!measureMode)}
          className={`
            flex items-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-wider transition-colors border rounded-sm
            ${measureMode 
               ? 'bg-green-900/30 border-green-500/50 text-green-300' 
               : 'bg-transparent border-transparent text-green-700 hover:text-green-500 hover:bg-green-900/10'}
          `}
        >
          <span>📏</span> Измерить расстояние
        </button>
        
        <div className="h-px bg-green-900/30 my-1" />

        <button
          onClick={() => setShowClearConfirm(true)}
          className="flex items-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-wider transition-colors border border-transparent text-red-700 hover:text-red-500 hover:bg-red-900/10 rounded-sm"
          title="Очистить локальную визуализацию"
        >
          <span>🗑️</span> Очистить сцену
        </button>

        {measureMode && (
          <div className="text-[10px] text-green-600/70 italic px-2 pt-1 border-t border-green-900/30">
            Выберите две точки...
          </div>
        )}
      </div>
    </div>
    <ConfirmModal
      isOpen={showClearConfirm}
      onClose={() => setShowClearConfirm(false)}
      onConfirm={() => {
        useCombatStore.getState().clearCombat(true);
        setShowClearConfirm(false);
      }}
      title="Очистить сцену"
      message="Очистить локальную сцену? Визуализация будет сброшена, затем приложение попробует синхронизироваться с активной сценой при следующем обновлении."
      confirmText="Очистить сцену"
      isDanger={true}
    />
    </>
  );
};
