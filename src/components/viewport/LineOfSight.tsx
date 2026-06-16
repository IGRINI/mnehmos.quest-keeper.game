import React, { useMemo } from 'react';
import { Line, Html } from '@react-three/drei';
import { useCombatStore } from '../../stores/combatStore';
import { getElevationAt } from '../../utils/gridHelpers';

export const LineOfSight: React.FC = () => {
  const showLineOfSight = useCombatStore(state => state.showLineOfSight);
  const entities = useCombatStore(state => state.entities);
  const terrain = useCombatStore(state => state.terrain);
  const selectedEntityId = useCombatStore(state => state.selectedEntityId);
  const cursorPosition = useCombatStore(state => state.cursorPosition);
  
  // Determine source entity (selected or first party member)
  const source = useMemo(() => {
    return entities.find(e => e.id === selectedEntityId) || entities.find(e => e.type === 'character');
  }, [entities, selectedEntityId]);

  // Show instruction popup if LOS is enabled but no entity selected
  if (showLineOfSight && !selectedEntityId && entities.length > 0) {
    return (
      <Html center position={[0, 3, 0]} style={{ pointerEvents: 'none' }}>
        <div 
          className="font-mono text-center p-3 rounded animate-pulse"
          style={{
            backgroundColor: 'rgba(0, 20, 0, 0.9)',
            border: '1px solid #00ff41',
            color: '#00ff41',
            boxShadow: '0 0 15px rgba(0, 255, 65, 0.3)',
            minWidth: '220px'
          }}
        >
          <div className="text-sm font-bold mb-1">👁️ ЛИНИЯ ВИДИМОСТИ</div>
          <div className="text-xs opacity-80">Выберите существо,</div>
          <div className="text-xs opacity-80">чтобы увидеть линии обзора</div>
        </div>
      </Html>
    );
  }

  if (!showLineOfSight || !source) return null;

  return (
    <group>
      {/* Entity-to-Entity LOS */}
      {entities.map(target => {
        if (target.id === source.id) return null;
        
        // Color based on type
        const isEnemy = target.type === 'monster';
        const color = isEnemy ? '#ff4444' : '#00ff41';
        
        return (
          <group key={target.id}>
             <Line
                points={[
                   [source.position.x + 0.5, source.position.y, source.position.z + 0.5],
                   [target.position.x + 0.5, target.position.y, target.position.z + 0.5]
                ]}
                color={color}
                lineWidth={1}
                transparent
                opacity={0.4}
             />
          </group>
        );
      })}

      {/* Dynamic Cursor LOS */}
      {cursorPosition && (
        (() => {
           // Calculate cursor elevation
           const mcpX = cursorPosition.x + 10;
           const mcpY = cursorPosition.y + 10;
           const elevation = getElevationAt(mcpX, mcpY, terrain, entities);
           // Assuming eye height is slightly above surface? Or just surface?
           const cursorY = elevation + 0.5;

           return (
            <Line
              points={[
                [source.position.x + 0.5, source.position.y, source.position.z + 0.5],
                [cursorPosition.x + 0.5, cursorY, cursorPosition.y + 0.5]
              ]}
              color="#ffff00" // Yellow for cursor
              lineWidth={2}
              transparent
              opacity={0.6}
              dashed
              dashScale={2}
            />
           );
        })()
      )}
    </group>
  );
};
