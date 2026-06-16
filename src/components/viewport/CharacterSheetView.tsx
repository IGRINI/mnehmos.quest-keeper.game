import React, { useState } from 'react';
import { useGameStateStore } from '../../stores/gameStateStore';
import { usePartyStore } from '../../stores/partyStore';
import { dnd5eItems } from '../../data/dnd5eItems';
import { ConfirmModal } from '../common/ConfirmModal';
import { SpellBookView } from '../character/SpellBookView';
import { ConditionsDisplay } from '../character/ConditionsDisplay';
import CustomEffectsDisplay from '../character/CustomEffectsDisplay';
import { ConcentrationIndicator } from '../character/ConcentrationIndicator';
import { XPBar } from '../common/XPBar';
import { LevelUpModal } from '../character/LevelUpModal';
import { CharacterEditModal } from './CharacterEditModal';
import { getClassLabel, getItemLabel, getRaceLabel } from '../character/displayLabels';
import { getMemberRoleLabel } from '../party/displayLabels';

// Armor type categories for AC calculation
type ArmorCategory = 'light' | 'medium' | 'heavy' | 'none';

interface ArmorInfo {
  category: ArmorCategory;
  baseAC: number;
  name: string;
}

interface CharacterSelectorOption {
  id: string;
  name: string;
  class?: string;
  role?: string;
  isActive: boolean;
  inActiveParty: boolean;
}

const NO_EQUIPMENT_LABEL = 'Нет';

const ABILITY_LABELS = {
  str: 'СИЛ',
  dex: 'ЛОВ',
  con: 'ТЕЛ',
  int: 'ИНТ',
  wis: 'МДР',
  cha: 'ХАР',
} as const;

const EQUIPMENT_SLOT_LABELS: Record<string, string> = {
  mainhand: 'Основная рука',
  offhand: 'Вторая рука',
  armor: 'Броня',
  head: 'Голова',
  feet: 'Обувь',
  accessory: 'Аксессуар',
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  armor: 'броня',
  shield: 'щит',
  weapon: 'оружие',
  melee: 'ближний бой',
  ranged: 'дальний бой',
  consumable: 'расходник',
  quest: 'квестовый предмет',
  misc: 'прочее',
  scroll: 'свиток',
};

const formatEquipmentName = (name?: string | null): string => {
  if (!name || name === 'None') return NO_EQUIPMENT_LABEL;
  return getItemLabel(name);
};

const formatEquipmentSlot = (slot: string): string => EQUIPMENT_SLOT_LABELS[slot] ?? slot;

const formatItemType = (type?: string | null): string => {
  if (!type) return ITEM_TYPE_LABELS.misc;
  const normalized = type.toLowerCase();
  return ITEM_TYPE_LABELS[normalized] ?? type;
};

// Get armor info from equipped armor name
function getArmorInfo(armorName: string): ArmorInfo {
  if (!armorName || armorName === 'None') {
    return { category: 'none', baseAC: 10, name: 'None' };
  }

  // Look up in dnd5eItems
  const itemKey = Object.keys(dnd5eItems).find(
    k => k.toLowerCase() === armorName.toLowerCase()
  );
  const item = itemKey ? dnd5eItems[itemKey] : null;

  if (!item || !item.armorClass) {
    return { category: 'none', baseAC: 10, name: armorName };
  }

  // Determine armor category from item type or properties
  const typeLower = (item.type || '').toLowerCase();
  const isHeavy = typeLower.includes('heavy') ||
    ['ring mail', 'chain mail', 'splint', 'plate'].some(h => armorName.toLowerCase().includes(h));
  const isMedium = typeLower.includes('medium') ||
    item.properties?.includes('Max Dex +2') ||
    ['hide', 'chain shirt', 'scale mail', 'breastplate', 'half plate'].some(m => armorName.toLowerCase().includes(m));
  const isLight = typeLower.includes('light') ||
    ['padded', 'leather', 'studded leather'].some(l => armorName.toLowerCase() === l);

  let category: ArmorCategory = 'none';
  if (isHeavy) category = 'heavy';
  else if (isMedium) category = 'medium';
  else if (isLight) category = 'light';

  return {
    category,
    baseAC: item.armorClass,
    name: armorName
  };
}

// Calculate AC with breakdown
function calculateAC(
  armorInfo: ArmorInfo,
  dexMod: number,
  hasShield: boolean
): { total: number; breakdown: string } {
  let total = armorInfo.baseAC;
  const parts: string[] = [];

  switch (armorInfo.category) {
    case 'none':
      total = 10 + dexMod;
      parts.push('10');
      if (dexMod !== 0) parts.push(`${dexMod >= 0 ? '+' : ''}${dexMod} ЛОВ`);
      break;
    case 'light':
      total = armorInfo.baseAC + dexMod;
      parts.push(`${armorInfo.baseAC} ${formatEquipmentName(armorInfo.name)}`);
      if (dexMod !== 0) parts.push(`${dexMod >= 0 ? '+' : ''}${dexMod} ЛОВ`);
      break;
    case 'medium':
      const cappedDex = Math.min(dexMod, 2);
      total = armorInfo.baseAC + cappedDex;
      parts.push(`${armorInfo.baseAC} ${formatEquipmentName(armorInfo.name)}`);
      if (cappedDex !== 0) parts.push(`+${cappedDex} ЛОВ (макс. 2)`);
      break;
    case 'heavy':
      parts.push(`${armorInfo.baseAC} ${formatEquipmentName(armorInfo.name)}`);
      break;
  }

  if (hasShield) {
    total += 2;
    parts.push('+2 щит');
  }

  return { total, breakdown: parts.join(' ') };
}

export const CharacterSheetView: React.FC = () => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCharacterDropdown, setShowCharacterDropdown] = useState(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [viewTab, setViewTab] = useState<'stats' | 'spells' | 'effects'>('stats');

  const activeCharacter = useGameStateStore(state => state.activeCharacter);
  const activeCharacterId = useGameStateStore(state => state.activeCharacterId);
  const allCharacters = useGameStateStore(state => state.party);
  const inventory = useGameStateStore(state => state.inventory);
  const setActiveGameCharacterId = useGameStateStore(state => state.setActiveCharacterId);
  const syncState = useGameStateStore(state => state.syncState);

  const deleteCharacter = usePartyStore(state => state.deleteCharacter);
  const isLoading = usePartyStore(state => state.isLoading);
  const updateCharacter = usePartyStore(state => state.updateCharacter);

  // Get party members for character selector
  const activePartyId = usePartyStore(state => state.activePartyId);
  const partyDetails = usePartyStore(state => state.partyDetails);
  const setActivePartyCharacter = usePartyStore(state => state.setActiveCharacter);
  
  const activeParty = activePartyId ? partyDetails[activePartyId] : null;
  const partyMembers = activeParty?.members || [];

  const characterOptions = React.useMemo(() => {
    const options = new Map<string, CharacterSelectorOption>();

    for (const member of partyMembers) {
      options.set(member.characterId, {
        id: member.characterId,
        name: member.character?.name || member.characterId,
        class: member.character?.class,
        role: member.role,
        isActive: member.isActive || member.characterId === activeCharacterId,
        inActiveParty: true,
      });
    }

    for (const character of allCharacters) {
      if (!character.id || options.has(character.id)) continue;
      options.set(character.id, {
        id: character.id,
        name: character.name,
        class: character.class,
        isActive: character.id === activeCharacterId,
        inActiveParty: false,
      });
    }

    const currentId = activeCharacter?.id || activeCharacterId;
    if (currentId && !options.has(currentId)) {
      options.set(currentId, {
        id: currentId,
        name: activeCharacter?.name || currentId,
        class: activeCharacter?.class,
        isActive: true,
        inActiveParty: false,
      });
    }

    return Array.from(options.values()).sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (a.inActiveParty !== b.inActiveParty) return a.inActiveParty ? -1 : 1;
      return a.name.localeCompare(b.name, 'ru');
    });
  }, [activeCharacter, activeCharacterId, allCharacters, partyMembers]);

  // Get character type badge colors
  const getTypeBadge = (type?: string) => {
    switch (type) {
      case 'pc':
        return { label: 'ГЕРОЙ', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' };
      case 'npc':
        return { label: 'НПС', color: 'bg-purple-500/20 text-purple-400 border-purple-500/50' };
      case 'enemy':
        return { label: 'ВРАГ', color: 'bg-red-500/20 text-red-400 border-red-500/50' };
      case 'neutral':
        return { label: 'НЕЙТР.', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' };
      default:
        return { label: 'ГЕРОЙ', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' };
    }
  };

  const handleDeleteCharacter = async () => {
    if (activeCharacterId) {
      const success = await deleteCharacter(activeCharacterId);
      if (success) {
        setShowDeleteConfirm(false);
        await syncState(true);
      }
    }
  };

  const handleSelectCharacter = async (characterId: string) => {
    if (characterId === activeCharacterId) {
      setShowCharacterDropdown(false);
      return;
    }

    const isPartyMember = partyMembers.some((member) => member.characterId === characterId);
    if (activePartyId && isPartyMember) {
      await setActivePartyCharacter(activePartyId, characterId);
    } else {
      setActiveGameCharacterId(characterId, true);
      await syncState(true);
    }

    setShowCharacterDropdown(false);
  };

  React.useEffect(() => {
    // Refresh character data when view mounts or when the active character changes.
    syncState(true);
  }, [activeCharacterId, syncState]);

  if (!activeCharacter) {
    return (
      <div className="h-full w-full flex items-center justify-center p-8 text-terminal-green/60">
        <div className="text-center space-y-4">
          <p className="text-xl">ДАННЫЕ ПЕРСОНАЖА НЕ НАЙДЕНЫ</p>
          <p className="text-sm">Создайте персонажа через терминал, чтобы увидеть характеристики.</p>
        </div>
      </div>
    );
  }

  const { name, level, class: charClass, race, hp, xp, stats, conditions, currencies, savingThrowProficiencies, speed } = activeCharacter;

  const equippedItems = inventory.filter((i) => i.equipped);
  const stowedItems = inventory.filter((i) => !i.equipped);

  // Helper to calculate modifier
  const getMod = (score: number): number => Math.floor((score - 10) / 2);
  const formatMod = (mod: number): string => mod >= 0 ? `+${mod}` : `${mod}`;

  // Calculate proficiency bonus
  const proficiencyBonus = Math.floor((level - 1) / 4) + 2;

  // Get armor info and check for shield
  const armorInfo = getArmorInfo(activeCharacter.equipment?.armor || 'None');
  const hasShield = equippedItems.some(i =>
    i.name.toLowerCase().includes('shield') ||
    i.type?.toLowerCase() === 'shield'
  );
  const dexMod = getMod(stats.dex);
  const acCalc = activeCharacter.armorClass
    ? { total: activeCharacter.armorClass, breakdown: 'Задано вручную' }
    : calculateAC(armorInfo, dexMod, hasShield);
  const characterBehavior = activeCharacter.behavior?.trim();

  // Saving throws calculation
  const savingThrows = [
    { key: 'str', label: ABILITY_LABELS.str, stat: stats.str },
    { key: 'dex', label: ABILITY_LABELS.dex, stat: stats.dex },
    { key: 'con', label: ABILITY_LABELS.con, stat: stats.con },
    { key: 'int', label: ABILITY_LABELS.int, stat: stats.int },
    { key: 'wis', label: ABILITY_LABELS.wis, stat: stats.wis },
    { key: 'cha', label: ABILITY_LABELS.cha, stat: stats.cha },
  ] as const;

  const StatBlock = ({ label, value }: { label: string; value: number }) => (
    <div className="flex flex-col items-center p-4 border border-terminal-green/30 bg-terminal-green/5">
      <span className="text-sm text-terminal-green/60 uppercase tracking-wider mb-1">{label}</span>
      <span className="text-3xl font-bold mb-1">{value}</span>
      <span className="text-sm font-bold bg-terminal-green text-terminal-black px-2 rounded">
        {formatMod(getMod(value))}
      </span>
    </div>
  );

  return (
    <>
    <div className="h-full w-full overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-terminal-green/20 scrollbar-track-transparent">
      {/* Header Section */}
      <div className="border-b-2 border-terminal-green pb-6 mb-6">
        <div className="flex justify-between items-end">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {/* Character Selector Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowCharacterDropdown(!showCharacterDropdown)}
                  className="text-4xl font-bold uppercase hover:text-terminal-green-bright transition-colors flex items-center gap-2"
                  title="Сменить персонажа"
                >
                  {name}
                  <span className="text-lg">▼</span>
                </button>
                {showCharacterDropdown && (
                  <div className="absolute left-0 top-full mt-1 bg-terminal-black border border-terminal-green rounded shadow-lg z-50 min-w-[240px] max-h-[300px] overflow-y-auto">
                    {characterOptions.length > 0 ? characterOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => handleSelectCharacter(option.id)}
                        className={`block w-full px-3 py-2 text-left hover:bg-terminal-green/10 transition-colors ${
                          option.isActive ? 'bg-terminal-green/20 text-terminal-green-bright' : 'text-terminal-green'
                        }`}
                      >
                        <div className="font-semibold">{option.name}</div>
                        <div className="text-xs opacity-60">
                          {getClassLabel(option.class)} • {option.role ? getMemberRoleLabel(option.role) : 'без партии'}
                        </div>
                      </button>
                    )) : (
                      <div className="px-3 py-2 text-terminal-green/60 text-sm">
                        Персонажи не найдены
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Character Type Badge */}
              <span className={`text-xs px-2 py-1 border rounded font-bold ${getTypeBadge(activeCharacter.characterType).color}`}>
                {getTypeBadge(activeCharacter.characterType).label}
              </span>

              <button
                onClick={() => setShowEditModal(true)}
                className="px-2 py-1 text-xs bg-terminal-green/10 border border-terminal-green/50 text-terminal-green rounded hover:bg-terminal-green/20 transition-colors"
                title="Редактировать персонажа"
              >
                ✎
              </button>
              
              {/* Delete Button */}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-2 py-1 text-xs bg-red-500/10 border border-red-500/50 text-red-400 rounded hover:bg-red-500/20 transition-colors"
                title="Удалить персонажа"
              >
                🗑️
              </button>
            </div>
            <div className="flex space-x-4 text-lg text-terminal-green/80">
              <span>УРОВ. {level}</span>
              {race && <span>{getRaceLabel(race)}</span>}
              <span>{getClassLabel(charClass)}</span>
              <span className="text-terminal-green/50">МАСТ. {formatMod(proficiencyBonus)}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="mb-2">
              <span className="text-sm text-terminal-green/60 mr-2">ОЗ</span>
              <span className="text-2xl font-bold">{hp.current}</span>
              <span className="text-terminal-green/60">/{hp.max}</span>
            </div>
            <div>
              <XPBar 
                current={xp.current} 
                max={xp.max} 
                level={level} 
                showLabels={true}
              />
              {xp.current >= xp.max && level < 20 && (
                <button
                  onClick={() => setShowLevelUpModal(true)}
                  className="mt-2 w-full text-xs bg-terminal-green text-terminal-black font-bold py-1 px-2 rounded animate-pulse hover:bg-terminal-green-bright transition-colors"
                >
                  ✨ ДОСТУПЕН НОВЫЙ УРОВЕНЬ
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Concentration Indicator (if active) */}
        {activeCharacter?.concentrationState && (
          <div className="mt-4">
            <ConcentrationIndicator
              characterId={activeCharacter.id || ''}
              concentration={activeCharacter.concentrationState}
            />
          </div>
        )}

        {/* Conditions Display */}
        <div className="mt-4">
          <ConditionsDisplay
            conditions={conditions || []}
            onAddCondition={async (condition) => {
              if (activeCharacter?.id) {
                await updateCharacter(activeCharacter.id, {
                  addConditions: [condition]
                });
                await syncState(true);
              }
            }}
            onRemoveCondition={async (conditionName) => {
              if (activeCharacter?.id) {
                await updateCharacter(activeCharacter.id, {
                  removeConditions: [conditionName]
                });
                await syncState(true);
              }
            }}
          />
        </div>
      </div>

      {/* Ability Scores Grid */}
      {/* Tabs Navigation */}
      <div className="flex border-b border-terminal-green/30 mb-6">
        <button
          className={`px-6 py-2 font-bold transition-colors ${
            viewTab === 'stats' 
              ? 'bg-terminal-green/20 text-terminal-green-bright border-b-2 border-terminal-green' 
              : 'text-terminal-green/60 hover:text-terminal-green hover:bg-terminal-green/5'
          }`}
          onClick={() => setViewTab('stats')}
        >
          ХАРАКТЕРИСТИКИ И СНАРЯЖЕНИЕ
        </button>
        <button
          className={`px-6 py-2 font-bold transition-colors ${
            viewTab === 'spells' 
              ? 'bg-terminal-green/20 text-terminal-green-bright border-b-2 border-terminal-green' 
              : 'text-terminal-green/60 hover:text-terminal-green hover:bg-terminal-green/5'
          }`}
          onClick={() => setViewTab('spells')}
        >
          КНИГА ЗАКЛИНАНИЙ
        </button>
        <button
          className={`px-6 py-2 font-bold transition-colors ${
            viewTab === 'effects' 
              ? 'bg-terminal-green/20 text-terminal-green-bright border-b-2 border-terminal-green' 
              : 'text-terminal-green/60 hover:text-terminal-green hover:bg-terminal-green/5'
          }`}
          onClick={() => setViewTab('effects')}
        >
          ЭФФЕКТЫ
        </button>
      </div>

      {viewTab === 'stats' ? (
        <>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <StatBlock label={ABILITY_LABELS.str} value={stats.str} />
            <StatBlock label={ABILITY_LABELS.dex} value={stats.dex} />
            <StatBlock label={ABILITY_LABELS.con} value={stats.con} />
            <StatBlock label={ABILITY_LABELS.int} value={stats.int} />
            <StatBlock label={ABILITY_LABELS.wis} value={stats.wis} />
            <StatBlock label={ABILITY_LABELS.cha} value={stats.cha} />
          </div>

          {/* Combat Stats + Saving Throws */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="border border-terminal-green/30 p-4">
              <h3 className="text-lg font-bold border-b border-terminal-green/30 pb-2 mb-4">БОЙ</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-terminal-green/60">КЛАСС ДОСПЕХА</span>
                  <div className="text-right">
                    <span className="text-2xl font-bold">{acCalc.total}</span>
                    <div className="text-xs text-terminal-green/50">{acCalc.breakdown}</div>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-terminal-green/60">ИНИЦИАТИВА</span>
                  <span>{formatMod(dexMod)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-terminal-green/60">СКОРОСТЬ</span>
                  <span>{speed || 30} фт.</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-terminal-green/60">МАСТЕРСТВО</span>
                  <span>{formatMod(proficiencyBonus)}</span>
                </div>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => syncState(true)}
                  className="text-xs border border-terminal-green px-2 py-1 text-terminal-green hover:bg-terminal-green/10 transition-colors"
                >
                  Обновить из MCP
                </button>
              </div>
            </div>

            {/* Saving Throws */}
            <div className="border border-terminal-green/30 p-4">
              <h3 className="text-lg font-bold border-b border-terminal-green/30 pb-2 mb-4">СПАСБРОСКИ</h3>
              <div className="grid grid-cols-2 gap-2">
                {savingThrows.map(({ key, label, stat }) => {
                  const isProficient = savingThrowProficiencies?.includes(key) ?? false;
                  const mod = getMod(stat);
                  const totalMod = isProficient ? mod + proficiencyBonus : mod;
                  return (
                    <div
                      key={key}
                      className={`flex justify-between items-center p-2 rounded ${
                        isProficient ? 'bg-terminal-green/20 border border-terminal-green/40' : 'bg-terminal-green/5'
                      }`}
                    >
                      <span className="text-sm">
                        {isProficient && <span className="text-terminal-green mr-1">●</span>}
                        {label}
                      </span>
                      <span className={`font-bold ${isProficient ? 'text-terminal-green' : ''}`}>
                        {formatMod(totalMod)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border border-terminal-green/30 p-4 mb-6">
            <div className="flex items-center justify-between border-b border-terminal-green/30 pb-2 mb-4">
              <h3 className="text-lg font-bold">ПРЕДЫСТОРИЯ И ДЕТАЛИ</h3>
              <button
                onClick={() => setShowEditModal(true)}
                className="text-xs border border-terminal-green px-2 py-1 text-terminal-green hover:bg-terminal-green/10 transition-colors"
              >
                Редактировать
              </button>
            </div>
            {characterBehavior ? (
              <p className="text-terminal-green/80 whitespace-pre-wrap leading-relaxed">{characterBehavior}</p>
            ) : (
              <p className="text-terminal-green/40 italic">Предыстория и детали персонажа не заполнены.</p>
            )}
          </div>

          {/* Currencies + Equipment */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Currencies */}
            <div className="border border-terminal-green/30 p-4">
              <h3 className="text-lg font-bold border-b border-terminal-green/30 pb-2 mb-4">ВАЛЮТА</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-2 bg-yellow-900/20 border border-yellow-600/30 rounded">
                  <div className="text-2xl font-bold text-yellow-500">{currencies?.gold ?? 0}</div>
                  <div className="text-xs text-yellow-600/80 uppercase">Золото</div>
                </div>
                <div className="text-center p-2 bg-gray-500/20 border border-gray-400/30 rounded">
                  <div className="text-2xl font-bold text-gray-300">{currencies?.silver ?? 0}</div>
                  <div className="text-xs text-gray-400/80 uppercase">Серебро</div>
                </div>
                <div className="text-center p-2 bg-orange-900/20 border border-orange-700/30 rounded">
                  <div className="text-2xl font-bold text-orange-400">{currencies?.copper ?? 0}</div>
                  <div className="text-xs text-orange-600/80 uppercase">Медь</div>
                </div>
              </div>
              {(currencies?.platinum !== undefined && currencies.platinum > 0) && (
                <div className="mt-3 text-center p-2 bg-blue-900/20 border border-blue-400/30 rounded">
                  <span className="text-blue-300 font-bold">{currencies.platinum}</span>
                  <span className="text-xs text-blue-400/80 uppercase ml-2">Платина</span>
                </div>
              )}
            </div>

            {/* Equipment */}
            <div className="border border-terminal-green/30 p-4">
              <h3 className="text-lg font-bold border-b border-terminal-green/30 pb-2 mb-4">СНАРЯЖЕНИЕ</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-terminal-green/60 uppercase tracking-wider mb-1">Броня</div>
                  <div className="text-lg">{formatEquipmentName(activeCharacter.equipment?.armor)}</div>
                </div>
                <div>
                  <div className="text-xs text-terminal-green/60 uppercase tracking-wider mb-1">Оружие</div>
                  {activeCharacter.equipment?.weapons && activeCharacter.equipment.weapons.length > 0 ? (
                    <ul className="list-disc list-inside">
                      {activeCharacter.equipment.weapons.map((w, i) => (
                        <li key={i} className="text-lg">{formatEquipmentName(w)}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-lg text-terminal-green/40">{NO_EQUIPMENT_LABEL}</div>
                  )}
                </div>
                {equippedItems.length > 0 && (
                  <div>
                    <div className="text-xs text-terminal-green/60 uppercase tracking-wider mb-1">Надето</div>
                    <ul className="list-none space-y-1 text-terminal-green">
                      {equippedItems.map((item) => (
                        <li key={item.id} className="flex items-center gap-2">
                          {item.slot && (
                            <span className="text-xs bg-terminal-green/20 text-terminal-green px-1.5 py-0.5 rounded uppercase font-bold">
                              {formatEquipmentSlot(item.slot)}
                            </span>
                          )}
                          <span className="font-semibold">{formatEquipmentName(item.name)}</span>
                          {item.type ? <span className="text-terminal-green/60 text-sm">({formatItemType(item.type)})</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Inventory List */}
          <div className="border border-terminal-green/30 p-4">
            <h3 className="text-lg font-bold border-b border-terminal-green/30 pb-2 mb-4">ИНВЕНТАРЬ</h3>
            {inventory.length === 0 ? (
              <div className="text-terminal-green/60">Переносимых предметов нет.</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {stowedItems.map((item) => (
                  <div key={item.id} className="border border-terminal-green/20 p-2 bg-terminal-green/5">
                    <div className="font-semibold">{formatEquipmentName(item.name)}</div>
                    <div className="text-xs text-terminal-green/60">
                      {formatItemType(item.type)} • {item.weight ?? '?'} фунт.
                    </div>
                    {item.description ? (
                      <div className="text-xs text-terminal-green/70 mt-1 line-clamp-3">{item.description}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : viewTab === 'spells' ? (
        <div className="h-full">
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
      ) : (
        <div className="space-y-6">
          <div className="bg-black/40 border border-terminal-green/30 p-4 rounded-lg">
            <h3 className="text-xl font-bold text-terminal-green-bright mb-4 border-b border-terminal-green/30 pb-2">
              АКТИВНЫЕ ЭФФЕКТЫ
            </h3>
            <p className="text-terminal-green/60 text-sm mb-4">
              Подробный учет благословений, проклятий и магических изменений, влияющих на персонажа.
            </p>
            
            {activeCharacter.customEffects && activeCharacter.customEffects.length > 0 ? (
               <CustomEffectsDisplay effects={activeCharacter.customEffects} />
            ) : (
               <div className="text-center py-8 text-terminal-green/40 italic">
                 Активных пользовательских эффектов нет.
               </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-terminal-green/20 text-right">
              <button
                onClick={() => syncState(true)}
                className="text-xs border border-terminal-green px-3 py-1 text-terminal-green hover:bg-terminal-green/10 transition-colors"
              >
                Обновить эффекты
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteCharacter}
        title="Удалить персонажа"
        message={`Точно удалить ${name} без возможности восстановления?`}
        confirmText="Удалить"
        isDanger={true}
        isLoading={isLoading}
      />

      {activeCharacterId && (
        <CharacterEditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          characterId={activeCharacterId}
        />
      )}
      
      {activeCharacterId && (
        <LevelUpModal
          isOpen={showLevelUpModal}
          onClose={() => setShowLevelUpModal(false)}
          characterId={activeCharacterId}
          characterName={name}
          currentLevel={level}
        />
      )}
    </>
  );
};
