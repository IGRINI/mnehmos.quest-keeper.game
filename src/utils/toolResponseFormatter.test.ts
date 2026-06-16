/**
 * Tests for toolResponseFormatter.ts
 */

import { describe, it, expect, vi } from 'vitest';
import {
  formatCharacterList,
  formatCharacter,
  formatInventory,
  formatItem,
  formatQuestLog,
  formatEncounter,
  formatWorld,
  formatListSecrets,
  formatToolResponse,
  formatCreateEncounter,
} from './toolResponseFormatter';

// Mock the combat store to avoid side effects
vi.mock('../stores/combatStore', () => ({
  useCombatStore: {
    getState: () => ({
      updateFromStateJson: vi.fn(),
    }),
  },
}));

describe('Character Formatters', () => {
  describe('formatCharacterList', () => {
    it('returns empty message for no characters', () => {
      const result = formatCharacterList({ characters: [], count: 0 });
      expect(result).toContain('Персонажи в базе не найдены');
    });

    it('formats a list of characters', () => {
      const data = {
        count: 2,
        characters: [
          { id: '1', name: 'Gandalf', level: 20, hp: 100, maxHp: 100, ac: 15 },
          { id: '2', name: 'Frodo', level: 5, hp: 30, maxHp: 30, ac: 12 },
        ],
      };
      const result = formatCharacterList(data);
      expect(result).toContain('Персонажи (2)');
      expect(result).toContain('Gandalf');
    });
  });

  describe('formatCharacter', () => {
    it('formats a single character with all fields', () => {
      const char = {
        id: 'char-1',
        name: 'Aragorn',
        level: 10,
        hp: 85,
        maxHp: 100,
        ac: 17,
        stats: { str: 18, dex: 16, con: 16, int: 14, wis: 16, cha: 18 },
        behavior: 'Heir of Isildur, ranger of the North',
      };
      const result = formatCharacter(char);
      expect(result).toContain('Aragorn');
      expect(result).toContain('Уровень 10');
    });
  });
});

describe('Inventory Formatters', () => {
  describe('formatInventory', () => {
    it('returns empty message for no items', () => {
      const result = formatInventory({ items: [] });
      expect(result).toContain('Инвентарь пуст');
    });
  });

  describe('formatItem', () => {
    it('returns not found for missing item', () => {
      const result = formatItem({});
      expect(result).toContain('Предмет не найден');
    });
  });
});

describe('Quest Formatters', () => {
  describe('formatQuestLog', () => {
    it('returns empty message for no quests', () => {
      const result = formatQuestLog({ quests: [] });
      expect(result).toContain('Активных квестов нет');
    });
  });
});

describe('Encounter Formatters', () => {
  describe('formatEncounter', () => {
    it('returns no encounter message for null data', () => {
      const result = formatEncounter(null);
      expect(result).toContain('Активной схватки нет');
    });
  });

  describe('formatCreateEncounter', () => {
    it('formats new encounter creation', () => {
      const data = {
        encounterId: 'enc-123',
        participants: [
          { name: 'Hero', initiative: 18, hp: 50, maxHp: 50 },
          { name: 'Goblin', initiative: 12, hp: 7, maxHp: 7 },
        ],
      };
      const result = formatCreateEncounter(data);
      expect(result).toContain('БОЕВАЯ СХВАТКА НАЧАЛАСЬ');
    });
  });
});

describe('World Visualization Formatters', () => {
  describe('formatWorld', () => {
    it('returns formatted response with visualization data', () => {
      const data = {
        name: 'Middle Earth',
        seed: 'lotr-3018',
        width: 200,
        height: 150,
      };
      const result = formatWorld(data);
      expect(result.markdown).toContain('Middle Earth');
      expect(result.visualization?.type).toBe('world');
    });
  });
});

describe('Secret Keeper Formatters', () => {
  describe('formatListSecrets', () => {
    it('returns empty message for no secrets', () => {
      const result = formatListSecrets({ secrets: [], count: 0 });
      expect(result).toContain('секреты не найдены');
    });
  });
});

describe('Main Dispatcher Functions', () => {
  describe('formatToolResponse', () => {
    it('routes to correct formatter based on tool name', () => {
      const charData = {
        characters: [{ id: '1', name: 'Test', level: 1, hp: 10, maxHp: 10, ac: 10 }],
        count: 1,
      };
      const result = formatToolResponse('list_characters', charData);
      expect(result).toContain('Персонажи');
    });

    it('returns string as-is if not parseable', () => {
      const result = formatToolResponse('any_tool', 'plain text response');
      expect(result).toBe('plain text response');
    });
  });
});

describe('Edge Cases', () => {
  it('handles null characters gracefully', () => {
    const result = formatCharacterList({ characters: null, count: 0 });
    expect(result).toContain('Персонажи');
  });

  it('handles null items gracefully', () => {
    const result = formatInventory({ items: null });
    expect(result).toContain('Инвентарь пуст');
  });
});
