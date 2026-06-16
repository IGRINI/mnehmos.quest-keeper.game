import React from 'react';

interface PartyPosition {
  x: number;
  y: number;
  locationName: string;
  poiId?: string;
}

interface POIDetailPanelProps {
  poi: {
    type: string;
    name: string;
    x: number;
    y: number;
  };
  biome?: string;
  region?: string;
  partyPosition?: PartyPosition;
  isMoving?: boolean;
  onClose: () => void;
  onEnter?: () => void;
}

const STRUCTURE_ICONS: Record<string, string> = {
  city: '🏙️',
  town: '🏘️',
  village: '🏠',
  castle: '🏰',
  ruins: '🏛️',
  dungeon: '⚔️',
  temple: '⛪',
  camp: '⛺',
  landmark: '🗿',
  shrine: '⛩️',
  fortress: '🏰',
};

const STRUCTURE_LABELS: Record<string, string> = {
  city: 'город',
  town: 'малый город',
  village: 'деревня',
  castle: 'замок',
  ruins: 'руины',
  dungeon: 'подземелье',
  temple: 'храм',
  camp: 'лагерь',
  landmark: 'ориентир',
  shrine: 'святилище',
  fortress: 'крепость',
};

const BIOME_LABELS: Record<string, string> = {
  ocean: 'океан',
  deep_ocean: 'глубокий океан',
  lake: 'озеро',
  hot_desert: 'жаркая пустыня',
  desert: 'пустыня',
  savanna: 'саванна',
  tropical_rainforest: 'тропический лес',
  grassland: 'луг',
  temperate_deciduous_forest: 'лиственный лес',
  wetland: 'болото',
  taiga: 'тайга',
  tundra: 'тундра',
  glacier: 'ледник',
  mountain: 'горы',
  forest: 'лес',
  plains: 'равнины',
  swamp: 'топь',
  beach: 'пляж',
  snow: 'снег',
};

const POI_DESCRIPTIONS: Record<string, string> = {
  city: 'Оживленный город с каменными стенами, рынками, гильдиями и тысячами жителей.',
  town: 'Крупное поселение с лавками, трактиром и стражей. Центр местной торговли.',
  village: 'Небольшая сельская община с фермами, домами и таверной.',
  castle: 'Укрепленная твердыня с башнями, зубцами и гарнизоном. Символ власти.',
  ruins: 'Осыпающиеся остатки древнего строения. Здесь могут скрываться тайны или опасность.',
  dungeon: 'Мрачный вход, ведущий под землю. Испытание для смелых.',
  temple: 'Священное место поклонения. Жрецы даруют благословения и исцеление.',
  camp: 'Временный лагерь. Это могут быть торговцы, кочевники или менее дружелюбные путники.',
  landmark: 'Примечательный объект или памятник, заметный издалека.',
  shrine: 'Небольшое святилище, посвященное божеству или духу.',
  fortress: 'Военное укрепление с толстыми стенами и вооруженной охраной. Подходите осторожно.',
};

const formatStructureType = (type: string): string => STRUCTURE_LABELS[type] ?? type.replace(/_/g, ' ');
const formatBiomeName = (value: string): string => BIOME_LABELS[value] ?? value.replace(/_/g, ' ');

export const POIDetailPanel: React.FC<POIDetailPanelProps> = ({
  poi,
  biome,
  region,
  partyPosition,
  isMoving,
  onClose,
  onEnter,
}) => {
  const icon = STRUCTURE_ICONS[poi.type] || '📍';
  const description = POI_DESCRIPTIONS[poi.type] || 'Интересное место, которое стоит изучить.';

  // Calculate distance from party
  const distance = partyPosition
    ? Math.round(Math.sqrt(
        Math.pow(poi.x - partyPosition.x, 2) +
        Math.pow(poi.y - partyPosition.y, 2)
      ))
    : null;

  // Party is already at this location
  const isAtLocation = partyPosition && partyPosition.x === poi.x && partyPosition.y === poi.y;

  return (
    <div className="absolute bottom-4 right-4 w-80 bg-terminal-black/95 backdrop-blur-sm border-2 border-terminal-green font-mono text-terminal-green z-20">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-terminal-green/50 bg-terminal-green/10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <div className="font-bold text-terminal-green-bright uppercase tracking-wider">
              {poi.name}
            </div>
            <div className="text-xs text-terminal-green/60 capitalize">
              {formatStructureType(poi.type)}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-terminal-green hover:text-red-500 transition-colors text-lg font-bold"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Description */}
        <div className="text-xs text-terminal-green/80 leading-relaxed">
          {description}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-terminal-green/5 p-2 border border-terminal-green/30">
            <div className="text-terminal-green/60 mb-1">Координаты</div>
            <div className="font-bold">({poi.x}, {poi.y})</div>
          </div>
          {region && (
            <div className="bg-terminal-green/5 p-2 border border-terminal-green/30">
              <div className="text-terminal-green/60 mb-1">Регион</div>
              <div className="font-bold">{region}</div>
            </div>
          )}
          {biome && (
            <div className="bg-terminal-green/5 p-2 border border-terminal-green/30 col-span-2">
              <div className="text-terminal-green/60 mb-1">Биом</div>
              <div className="font-bold">{formatBiomeName(biome)}</div>
            </div>
          )}
        </div>

        {/* Distance Info */}
        {distance !== null && !isAtLocation && (
          <div className="bg-orange-500/10 border border-orange-500/30 p-2 text-xs">
            <span className="text-orange-400">📏 Расстояние:</span>{' '}
            <span className="font-bold">{distance} тайл.</span>
            <span className="text-terminal-green/60 ml-2">от текущей позиции</span>
          </div>
        )}

        {/* Party is here indicator */}
        {isAtLocation && (
          <div className="bg-green-500/10 border border-green-500/30 p-2 text-xs">
            <span className="text-green-400">⚔️ Группа уже здесь!</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onEnter}
            disabled={isMoving || isAtLocation}
            className={`flex-1 px-3 py-2 font-bold uppercase text-xs tracking-wider transition-colors ${
              isMoving
                ? 'bg-yellow-600 text-terminal-black cursor-wait'
                : isAtLocation
                ? 'bg-terminal-green/30 text-terminal-green/50 cursor-not-allowed'
                : 'bg-terminal-green text-terminal-black hover:bg-terminal-green-bright'
            }`}
          >
            {isMoving ? (
              <>{'⏳'} Перемещение...</>
            ) : isAtLocation ? (
              <>{'✓'} Уже здесь</>
            ) : (
              <>{'🚪'} Перейти сюда</>
            )}
          </button>
        </div>
      </div>

      {/* Footer Hint */}
      <div className="px-3 py-2 border-t border-terminal-green/30 bg-terminal-green/5 text-xs text-terminal-green/50 text-center">
        Нажмите ESC, чтобы закрыть
      </div>
    </div>
  );
};
