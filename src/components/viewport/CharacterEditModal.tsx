import React, { useState, useEffect } from 'react';
import { useGameStateStore } from '../../stores/gameStateStore';
import { usePartyStore, CharacterUpdates } from '../../stores/partyStore';
import { getClassLabel, getRaceLabel } from '../character/displayLabels';

interface CharacterEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterId: string;
}

const RACE_OPTIONS = [
  'Human',
  'Elf',
  'Dwarf',
  'Halfling',
  'Half-Elf',
  'Half-Orc',
  'Gnome',
  'Tiefling',
  'Dragonborn',
  'Goliath',
  'Aasimar',
  'Tabaxi',
  'Kenku',
  'Hobbit',
  'Other',
];

const CLASS_OPTIONS = [
  'Fighter',
  'Wizard',
  'Rogue',
  'Cleric',
  'Ranger',
  'Paladin',
  'Barbarian',
  'Bard',
  'Druid',
  'Monk',
  'Sorcerer',
  'Warlock',
  'Artificer',
  'Other',
];

const normalizeOptionValue = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

export const CharacterEditModal: React.FC<CharacterEditModalProps> = ({
  isOpen,
  onClose,
  characterId,
}) => {
  const activeCharacter = useGameStateStore((state) => state.activeCharacter);
  const updateCharacter = usePartyStore((state) => state.updateCharacter);
  const isLoading = usePartyStore((state) => state.isLoading);

  const [formData, setFormData] = useState({
    name: '',
    race: '',
    class: '',
    level: 1,
    hp: 1,
    maxHp: 1,
    ac: 10,
    stats: {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
    },
  });

  // Initialize form data when modal opens or character changes
  useEffect(() => {
    if (isOpen && activeCharacter) {
      setFormData({
        name: activeCharacter.name || '',
        race: activeCharacter.race || '',
        class: activeCharacter.class || '',
        level: activeCharacter.level || 1,
        hp: activeCharacter.hp?.current || 1,
        maxHp: activeCharacter.hp?.max || 1,
        ac: activeCharacter.armorClass || 10,
        stats: {
          str: activeCharacter.stats?.str || 10,
          dex: activeCharacter.stats?.dex || 10,
          con: activeCharacter.stats?.con || 10,
          int: activeCharacter.stats?.int || 10,
          wis: activeCharacter.stats?.wis || 10,
          cha: activeCharacter.stats?.cha || 10,
        },
      });
    }
  }, [isOpen, activeCharacter]);

  if (!isOpen) return null;

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleStatChange = (stat: keyof typeof formData.stats, value: number) => {
    setFormData((prev) => ({
      ...prev,
      stats: { ...prev.stats, [stat]: value },
    }));
  };

  const selectedRaceOption = RACE_OPTIONS.find((race) => normalizeOptionValue(race) === normalizeOptionValue(formData.race));
  const selectedClassOption = CLASS_OPTIONS.find((characterClass) => normalizeOptionValue(characterClass) === normalizeOptionValue(formData.class));
  const isKnownRace = Boolean(selectedRaceOption);
  const isKnownClass = Boolean(selectedClassOption);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const updates: CharacterUpdates = {
      name: formData.name,
      race: formData.race,
      class: formData.class,
      level: formData.level,
      hp: formData.hp,
      maxHp: formData.maxHp,
      ac: formData.ac,
      stats: formData.stats,
    };

    const success = await updateCharacter(characterId, updates);
    if (success) {
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const StatInput = ({
    label,
    stat,
  }: {
    label: string;
    stat: keyof typeof formData.stats;
  }) => (
    <div className="flex flex-col items-center p-2 border border-terminal-green/30 bg-terminal-green/5 rounded">
      <label className="text-xs text-terminal-green/60 uppercase mb-1">{label}</label>
      <input
        type="number"
        min={1}
        max={30}
        value={formData.stats[stat]}
        onChange={(e) => handleStatChange(stat, parseInt(e.target.value) || 1)}
        className="w-14 text-center bg-terminal-black border border-terminal-green/40 text-terminal-green rounded py-1 text-lg font-bold focus:outline-none focus:border-terminal-green"
      />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-4"
      onClick={handleBackdropClick}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-terminal-black border-2 border-terminal-green rounded-lg shadow-2xl shadow-terminal-green/20 max-w-lg w-full mx-4 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-terminal-green/30">
          <h2 className="text-xl font-bold uppercase tracking-wide text-terminal-green">
            Редактировать персонажа
          </h2>
        </div>

        {/* Form Body */}
        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-terminal-green/60 uppercase mb-1">Имя</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full bg-terminal-black border border-terminal-green/40 text-terminal-green rounded px-3 py-2 focus:outline-none focus:border-terminal-green"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-terminal-green/60 uppercase mb-1">Раса</label>
              <select
                value={selectedRaceOption ?? '__custom'}
                onChange={(e) => handleInputChange('race', e.target.value === '__custom' ? '' : e.target.value)}
                className="w-full bg-terminal-black border border-terminal-green/40 text-terminal-green rounded px-3 py-2 focus:outline-none focus:border-terminal-green"
              >
                {RACE_OPTIONS.map((race) => (
                  <option key={race} value={race}>{getRaceLabel(race)}</option>
                ))}
                <option value="__custom">Своя раса</option>
              </select>
              {!isKnownRace && (
                <input
                  type="text"
                  value={formData.race}
                  onChange={(e) => handleInputChange('race', e.target.value)}
                  placeholder="Введите расу..."
                  className="w-full mt-2 bg-terminal-black border border-terminal-green/40 text-terminal-green rounded px-3 py-2 focus:outline-none focus:border-terminal-green"
                />
              )}
            </div>
            <div>
              <label className="block text-xs text-terminal-green/60 uppercase mb-1">Класс</label>
              <select
                value={selectedClassOption ?? '__custom'}
                onChange={(e) => handleInputChange('class', e.target.value === '__custom' ? '' : e.target.value)}
                className="w-full bg-terminal-black border border-terminal-green/40 text-terminal-green rounded px-3 py-2 focus:outline-none focus:border-terminal-green"
              >
                {CLASS_OPTIONS.map((characterClass) => (
                  <option key={characterClass} value={characterClass}>{getClassLabel(characterClass)}</option>
                ))}
                <option value="__custom">Свой класс</option>
              </select>
              {!isKnownClass && (
                <input
                  type="text"
                  value={formData.class}
                  onChange={(e) => handleInputChange('class', e.target.value)}
                  placeholder="Введите класс..."
                  className="w-full mt-2 bg-terminal-black border border-terminal-green/40 text-terminal-green rounded px-3 py-2 focus:outline-none focus:border-terminal-green"
                />
              )}
            </div>
          </div>

          {/* Combat Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-terminal-green/60 uppercase mb-1">Уровень</label>
              <input
                type="number"
                min={1}
                max={20}
                value={formData.level}
                onChange={(e) => handleInputChange('level', parseInt(e.target.value) || 1)}
                className="w-full bg-terminal-black border border-terminal-green/40 text-terminal-green rounded px-3 py-2 focus:outline-none focus:border-terminal-green"
              />
            </div>
            <div>
              <label className="block text-xs text-terminal-green/60 uppercase mb-1">ОЗ</label>
              <input
                type="number"
                min={0}
                value={formData.hp}
                onChange={(e) => handleInputChange('hp', parseInt(e.target.value) || 0)}
                className="w-full bg-terminal-black border border-terminal-green/40 text-terminal-green rounded px-3 py-2 focus:outline-none focus:border-terminal-green"
              />
            </div>
            <div>
              <label className="block text-xs text-terminal-green/60 uppercase mb-1">Макс. ОЗ</label>
              <input
                type="number"
                min={1}
                value={formData.maxHp}
                onChange={(e) => handleInputChange('maxHp', parseInt(e.target.value) || 1)}
                className="w-full bg-terminal-black border border-terminal-green/40 text-terminal-green rounded px-3 py-2 focus:outline-none focus:border-terminal-green"
              />
            </div>
            <div>
              <label className="block text-xs text-terminal-green/60 uppercase mb-1">КД</label>
              <input
                type="number"
                min={0}
                value={formData.ac}
                onChange={(e) => handleInputChange('ac', parseInt(e.target.value) || 0)}
                className="w-full bg-terminal-black border border-terminal-green/40 text-terminal-green rounded px-3 py-2 focus:outline-none focus:border-terminal-green"
              />
            </div>
          </div>

          {/* Ability Scores */}
          <div>
            <label className="block text-xs text-terminal-green/60 uppercase mb-2">
              Характеристики
            </label>
            <div className="grid grid-cols-6 gap-2">
              <StatInput label="СИЛ" stat="str" />
              <StatInput label="ЛОВ" stat="dex" />
              <StatInput label="ТЕЛ" stat="con" />
              <StatInput label="ИНТ" stat="int" />
              <StatInput label="МДР" stat="wis" />
              <StatInput label="ХАР" stat="cha" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-terminal-green/20 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm border border-terminal-green/50 text-terminal-green/70 rounded hover:bg-terminal-green/10 hover:text-terminal-green transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium bg-terminal-green hover:bg-terminal-green-bright text-terminal-black border border-terminal-green rounded transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Сохраняю...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CharacterEditModal;
