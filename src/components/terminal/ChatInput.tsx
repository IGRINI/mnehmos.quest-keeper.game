import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { mcpManager } from '../../services/mcpClient';
import { useGameStateStore } from '../../stores/gameStateStore';
import { useCombatStore } from '../../stores/combatStore';
import { useUIStore, ActiveTab, ALL_TABS } from '../../stores/uiStore';
import { setPlaytestMode, isPlaytestModeEnabled } from '../../services/llm/contextBuilder';
import { extractEmbeddedJson, extractMcpJsonPayload } from '../../utils/mcpUtils';
import type { CampaignSession } from '../../stores/sessionStore';
import { getClassLabel, getConditionLabel, getItemLabel, getRaceLabel } from '../character/displayLabels';

// Slash command result interface
interface CommandResult {
  content: string;
  type?: 'text' | 'info' | 'error' | 'success';
}

const SKILL_LABELS: Record<string, string> = {
  perception: 'Восприятия',
  stealth: 'Скрытности',
  athletics: 'Атлетики',
  acrobatics: 'Акробатики',
  arcana: 'Магии',
  history: 'Истории',
  investigation: 'Анализа',
  nature: 'Природы',
  religion: 'Религии',
  insight: 'Проницательности',
  medicine: 'Медицины',
  survival: 'Выживания',
  deception: 'Обмана',
  intimidation: 'Запугивания',
  performance: 'Выступления',
  persuasion: 'Убеждения',
  animal_handling: 'Обращения с животными',
  sleight_of_hand: 'Ловкости рук',
};

const ABILITY_LABELS: Record<string, string> = {
  str: 'Сила',
  dex: 'Ловкость',
  con: 'Телосложение',
  int: 'Интеллект',
  wis: 'Мудрость',
  cha: 'Харизма',
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  weapon: 'оружие',
  armor: 'доспех',
  consumable: 'расходник',
  quest: 'квестовый',
  artifact: 'артефакт',
  tool: 'инструмент',
  misc: 'разное',
};

function formatItemType(type: string): string {
  return ITEM_TYPE_LABELS[type.toLowerCase()] || type;
}

// Helper to categorize tools
function categorizeTools(tools: any[]): Record<string, any[]> {
  const categories: Record<string, any[]> = {
    'События': [],
    'Генерация мира': [],
    'Бой': [],
    'Персонажи': [],
    'Инвентарь': [],
    'Квесты': [],
    'Кости и математика': [],
    'Большая стратегия': [],
    'Управление ходами': [],
    'Другое': []
  };

  for (const tool of tools) {
    const name = tool.name;
    if (name.includes('subscribe') || name.includes('event')) {
      categories['События'].push(tool);
    } else if (name.includes('world') || name.includes('map') || name.includes('region')) {
      categories['Генерация мира'].push(tool);
    } else if (name.includes('encounter') || name.includes('combat') || name.includes('advance_turn') && !name.includes('nation')) {
      categories['Бой'].push(tool);
    } else if (name.includes('character')) {
      categories['Персонажи'].push(tool);
    } else if (name.includes('item') || name.includes('inventory') || name.includes('equip')) {
      categories['Инвентарь'].push(tool);
    } else if (name.includes('quest') || name.includes('objective')) {
      categories['Квесты'].push(tool);
    } else if (name.includes('dice') || name.includes('probability') || name.includes('algebra') || name.includes('physics')) {
      categories['Кости и математика'].push(tool);
    } else if (name.includes('nation') || name.includes('alliance') || name.includes('claim') || name.includes('strategy')) {
      categories['Большая стратегия'].push(tool);
    } else if (name.includes('turn') || name.includes('ready') || name.includes('poll')) {
      categories['Управление ходами'].push(tool);
    } else {
      categories['Другое'].push(tool);
    }
  }

  // Remove empty categories
  for (const key of Object.keys(categories)) {
    if (categories[key].length === 0) {
      delete categories[key];
    }
  }

  return categories;
}

// Format tools into readable output
function formatToolsOutput(tools: any[]): string {
  const categories = categorizeTools(tools);
  let output = `## MCP-сервер подключен ✓\n\n`;
  output += `**Всего инструментов:** ${tools.length}\n\n`;

  for (const [category, categoryTools] of Object.entries(categories)) {
    output += `### ${category} (${categoryTools.length})\n`;
    for (const tool of categoryTools) {
      output += `- \`${tool.name}\`\n`;
    }
    output += '\n';
  }

  output += `---\n*Сервер: rpg-mcp | Протокол: MCP v2024-11-05*`;
  return output;
}

function isPlayableCampaignSession(session: CampaignSession): boolean {
  const snapshot = session.snapshot;
  const hasLinkedGameState = Boolean(
    session.worldId || session.partyId || session.activeCharacterId
  );
  const hasSnapshotState = Boolean(
    snapshot.memberCount > 0 ||
    (snapshot.partyName && snapshot.partyName !== 'No Party') ||
    (snapshot.locationName && snapshot.locationName !== 'Unknown')
  );

  return hasLinkedGameState || hasSnapshotState;
}

function selectMostRecentPlayableSession(sessions: CampaignSession[]): CampaignSession | null {
  return sessions
    .filter(isPlayableCampaignSession)
    .reduce<CampaignSession | null>((latest, session) => {
      if (!latest || session.lastPlayedAt > latest.lastPlayedAt) {
        return session;
      }
      return latest;
    }, null);
}

export const ChatInput: React.FC = () => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const addMessage = useChatStore((state) => state.addMessage);
  const getMessages = useChatStore((state) => state.getMessages);
  const startStreamingMessage = useChatStore((state) => state.startStreamingMessage);
  const updateStreamingMessage = useChatStore((state) => state.updateStreamingMessage);
  const updateToolStatus = useChatStore((state) => state.updateToolStatus);
  const finalizeStreamingMessage = useChatStore((state) => state.finalizeStreamingMessage);
  
  // HUD Prefill integration
  const prefillInput = useChatStore((state) => state.prefillInput);
  const setPrefillInput = useChatStore((state) => state.setPrefillInput);
  
  // Consume prefill input when set by HUD components
  useEffect(() => {
    if (prefillInput) {
      setInput(prefillInput);
      setPrefillInput(null); // Clear after consuming
    }
  }, [prefillInput, setPrefillInput]);

  // Quick Command Dispatch - consume commands from sidebar buttons
  const pendingCommand = useUIStore((state) => state.pendingCommand);
  const executeCommandImmediately = useUIStore((state) => state.executeCommandImmediately);
  const clearPendingCommand = useUIStore((state) => state.clearPendingCommand);
  
  useEffect(() => {
    if (pendingCommand) {
      if (executeCommandImmediately) {
        // Auto-execute the command immediately by setting input and submitting
        setInput(pendingCommand);
        // Use setTimeout to ensure input state is set before submitting
        setTimeout(() => {
          const form = document.querySelector('form');
          if (form) {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          }
        }, 0);
      } else {
        // Just fill the input
        setInput(pendingCommand);
      }
      clearPendingCommand();
    }
  }, [pendingCommand, executeCommandImmediately, clearPendingCommand]);

  // Command Hints Rotation
  const COMMAND_HINTS = [
    "ВВЕДИ_КОМАНДУ... (⇧+Ввод для новой строки)",
    "Напиши /new, чтобы начать новую кампанию",
    "Напиши /start, чтобы продолжить последнюю сессию",
    "Напиши /help, чтобы увидеть список команд",
    "Напиши /roll 1d20+5, чтобы бросить кости",
    "Напиши /inventory, чтобы проверить снаряжение",
    "Опиши действие: «Я осматриваю комнату...»"
  ];

  const [hintIndex, setHintIndex] = useState(0);

  const focusChatInput = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    // Only rotate if input is empty
    if (input.trim() !== '') return;

    const interval = setInterval(() => {
      setHintIndex((prev) => (prev + 1) % COMMAND_HINTS.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [input]);

  // Calculate placeholder text
  const placeholderText = isLoading
    ? "ОБРАБОТКА..."
    : (input.trim() === '' ? COMMAND_HINTS[hintIndex] : "ВВЕДИ_КОМАНДУ... (⇧+Ввод для новой строки)");

  // Reusable LLM Submission function
  const submitToLLM = useCallback(async (injectedPrompt?: string) => {
    setIsLoading(true);

    try {
      const { useSettingsStore } = await import('../../stores/settingsStore');
      const { llmService } = await import('../../services/llm/LLMService');

      const systemPrompt = useSettingsStore.getState().systemPrompt;
      const currentMessages = getMessages();

      const history: any[] = currentMessages
        .filter(msg => !msg.partial && (msg.sender === 'user' || msg.sender === 'ai'))
        .flatMap(msg => {
          const messages = [];

          const mainMsg: any = {
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.content
          };

          if (msg.isToolCall) {
            mainMsg.toolCalls = [{
              id: msg.toolCallId || msg.toolName,
              type: 'function',
              function: {
                name: msg.toolName,
                arguments: JSON.stringify(msg.toolArguments)
              }
            }];
          }

          messages.push(mainMsg);

          if (msg.isToolCall && msg.toolResponse) {
            messages.push({
              role: 'tool',
              toolCallId: msg.toolCallId || msg.toolName,
              content: msg.toolResponse
            });
          }

          return messages;
        });

      if (systemPrompt) {
        history.unshift({ role: 'system', content: systemPrompt });
      }

      // Inject dynamic narrative context via backend tool
      try {
        const { useGameStateStore } = await import('../../stores/gameStateStore');
        const { useCombatStore } = await import('../../stores/combatStore');
        
        const gameState = useGameStateStore.getState();
        const combatState = useCombatStore.getState();

        // Only fetch context if we have at least a world or character
        if (gameState.activeWorldId || gameState.activeCharacter) {
            const contextResult = await mcpManager.gameStateClient.callTool('session_manage', {
                action: 'get_context',
                worldId: gameState.activeWorldId || 'unknown',
                characterId: gameState.activeCharacter?.id,
                encounterId: combatState.activeEncounterId || undefined,
                maxEvents: 5
            });

            const contextText = contextResult?.content?.[0]?.text;
            if (contextText) {
                history.unshift({ role: 'system', content: contextText });
            }
        }
      } catch (err) {
        console.warn('[ChatInput] Failed to inject narrative context:', err);
      }

      // Inject extra prompt if provided (e.g. for initialization)
      if (injectedPrompt) {
        history.push({ role: 'user', content: injectedPrompt });
      }

      let currentStreamId = Date.now().toString() + '-ai';
      startStreamingMessage(currentStreamId, 'ai');
      let accumulatedContent = '';

      await llmService.streamMessage(
        history,
        {
          onChunk: (chunk: string) => {
            accumulatedContent += chunk;
            updateStreamingMessage(currentStreamId, accumulatedContent);
          },
          onToolCall: (toolCall: any) => {
            updateStreamingMessage(currentStreamId, undefined, toolCall);
          },
          onToolResult: (_: string, result: any) => {
             updateToolStatus(currentStreamId, 'completed', JSON.stringify(result));
          },
          onStreamStart: () => {
             finalizeStreamingMessage(currentStreamId);
             currentStreamId = Date.now().toString() + '-ai';
             accumulatedContent = '';
             startStreamingMessage(currentStreamId, 'ai');
          },
          onComplete: () => {
            finalizeStreamingMessage(currentStreamId);
            setIsLoading(false);
            focusChatInput();
          },
          onError: (error: string) => {
            addMessage({
              id: Date.now().toString() + '-err',
              sender: 'system',
              content: `Ошибка: ${error}`,
              timestamp: Date.now(),
              type: 'error',
            });
            finalizeStreamingMessage(currentStreamId);
            setIsLoading(false);
            focusChatInput();
          }
        }
      );

    } catch (error: any) {
      addMessage({
        id: Date.now().toString() + '-err',
        sender: 'system',
      content: `Ошибка модели: ${error.message}`,
        timestamp: Date.now(),
        type: 'error',
      });
      setIsLoading(false);
      focusChatInput();
    }
  }, [addMessage, focusChatInput, getMessages, startStreamingMessage, updateStreamingMessage, updateToolStatus, finalizeStreamingMessage]);

  // Integrated Slash Command Handler (can now access submitToLLM)
  const handleSlashCommand = async (command: string, args: string): Promise<CommandResult | null> => {
    const gameState = useGameStateStore.getState();
    const combatState = useCombatStore.getState();
    const uiStore = useUIStore.getState();
  
    switch (command) {
      // === SYSTEM COMMANDS ===
      case 'test': {
        const result = await mcpManager.gameStateClient.listTools();
        const tools = result?.tools || [];
        return { content: formatToolsOutput(tools) };
      }
      
      // === SESSION MANAGEMENT COMMANDS ===
      case 'new': {
        // Launch the Campaign Setup Wizard
        // Don't use Promise - just open wizard and return immediately
        // The wizard handles its own completion flow
        uiStore.openCampaignWizard((_sessionId, initialPrompt) => {
          // After wizard completes, trigger the LLM with the initial prompt
          setTimeout(() => {
            submitToLLM(initialPrompt);
          }, 100);
        });
        return { content: `🎭 Открываю мастер настройки кампании...` };
      }
      
      case 'start': {
        // Resume last session or launch wizard if no sessions exist
        const sessionStore = (await import('../../stores/sessionStore')).useSessionStore.getState();
        const sessions = sessionStore.sessions;
        
        const lastSession = selectMostRecentPlayableSession(sessions);

        if (lastSession) {
          // Resume the most recently played session
          await sessionStore.switchSession(lastSession.id);
          return { 
            content: `🎮 **Продолжаем кампанию:** ${lastSession.name}\n\n📍 ${lastSession.snapshot.locationName}\n👥 ${lastSession.snapshot.partyName} (ур. ${lastSession.snapshot.level})\n\nНапиши любое действие, чтобы продолжить приключение.`
          };
        } else {
          // No sessions exist - launch wizard (don't use Promise to avoid hanging)
          uiStore.openCampaignWizard((_sessionId, initialPrompt) => {
            setTimeout(() => {
              submitToLLM(initialPrompt);
            }, 100);
          });
          return {
            content: sessions.length > 0
              ? `🎭 Найден только пустой черновик кампании. Открываю мастер настройки...`
              : `🎭 Кампаний пока нет. Открываю мастер настройки...`
          };
        }
      }
      
      case 'session': {
        uiStore.openSessionManager();
        return { content: `📂 **Менеджер сессий открыт.** Выбери кампанию, чтобы переключиться или управлять ей.` };
      }

      case 'resume': {
        // Trigger "Previously on..." narrative using Seven-Layer Context
        const worldId = gameState.activeWorldId;
        const charId = gameState.activeCharacter?.id;
        
        if (!worldId || !charId) {
          return { content: `⚠️ **Нет активной сессии для продолжения.**\n\nИспользуй \`/start\`, чтобы начать или продолжить кампанию.`, type: 'error' };
        }
        
        try {
          const { buildSessionResumePrompt } = await import('../../services/llm/contextBuilder');
          const resumePrompt = await buildSessionResumePrompt(worldId, charId);
          
          if (!resumePrompt) {
            return { content: `📖 **История сессии не найдена.** Похоже, это новая кампания. Можно сразу играть.` };
          }
          
          // Submit to LLM with the resume prompt
          setTimeout(() => {
            submitToLLM(resumePrompt);
          }, 100);
          
          return { content: `📖 **Готовлю краткое содержание...**\n\n*Мастер вспоминает, что было раньше.*` };
        } catch (error: any) {
          return { content: `Ошибка при создании резюме: ${error.message}`, type: 'error' };
        }
      }
  
      case 'help': {
        return {
          content: `## Команды ИИ-Хранителя квестов:
  
  ### 📂 Сессии и кампании
  | Команда | Описание |
  |---------|-------------|
  | \`/start\` | Продолжить последнюю сессию или создать кампанию |
  | \`/new\` | Создать кампанию через мастер настройки |
  | \`/session\` | Открыть менеджер сессий |
  | \`/resume\` | Попросить Мастера кратко напомнить прошлые события |
  
  ### 📡 Система
  | Команда | Описание |
  |---------|-------------|
  | \`/test\` | Проверить подключение MCP-сервера |
  | \`/status\` | Показать краткое состояние игры |
  | \`/sync\` | Принудительно синхронизировать состояние |
  | \`/debug\` | Показать отладочную информацию |
  | \`/clear\` | Очистить историю чата |

  ### 🎭 Персонажи
  | Команда | Описание |
  |---------|-------------|
  | \`/characters\` | Список персонажей |
  | \`/character [id]\` | Детали персонажа |
  | \`/party\` | Сводка группы |

  ### 🎒 Инвентарь и предметы
  | Команда | Описание |
  |---------|-------------|
  | \`/inventory\` | Инвентарь текущего персонажа |
  | \`/items\` | Список шаблонов предметов |
  
  ### 📜 Квесты
  | Команда | Описание |
  |---------|-------------|
  | \`/quests\` | Активные квесты |
  | \`/questlog\` | Полный журнал квестов |
  
  ### ⚔️ Бой
  | Команда | Описание |
  |---------|-------------|
  | \`/combat\` | Текущее состояние боя |
  | \`/initiative\` | Порядок инициативы |
  
  ### 🌍 Мир
  | Команда | Описание |
  |---------|-------------|
  | \`/worlds\` | Список миров |
  | \`/world [id]\` | Детали мира |
  
  ### 🎲 Кости и математика
  | Команда | Описание |
  |---------|-------------|
  | \`/roll <expr>\` | Быстрый бросок, например \`/roll 2d6+3\` |
  | \`/adv <expr>\` | Бросок с преимуществом |
  | \`/dis <expr>\` | Бросок с помехой |
  
  ### 📊 Проверки
  | Команда | Описание |
  |---------|-------------|
  | \`/perception\` | Проверка Восприятия активного персонажа |
  | \`/stealth\` | Проверка Скрытности |
  | \`/athletics\` | Проверка Атлетики |
  | \`/str\`, \`/dex\` и т.д. | Проверка характеристики |
  | \`/save dex\` | Спасбросок, например ЛВК |
  | Добавь \`adv\` или \`dis\` | Преимущество или помеха |

  ### 🔒 Секреты
  | Команда | Описание |
  |---------|-------------|
  | \`/secrets\` | Показать скрытые от игрока секреты текущего мира |

  ---
  *Можно писать обычным языком: Мастер поймет действие.*`
        };
      }
  
      case 'status': {
        const activeChar = gameState.activeCharacter;
        const party = gameState.party;
        const inventory = gameState.inventory;
        const encounterId = combatState.activeEncounterId;
        const combatants = combatState.entities;
  
        let status = `## Состояние игры\n\n`;
  
        // Character
        if (activeChar) {
          status += `### Активный персонаж\n`;
          status += `**${activeChar.name}** - ур. ${activeChar.level} ${activeChar.race ? `${activeChar.race} ` : ''}${activeChar.class || ''}\n`;
          status += `ОЗ: ${activeChar.hp?.current || 0}/${activeChar.hp?.max || 0}\n\n`;
        } else {
          status += `### Активный персонаж\n*Персонаж не выбран*\n\n`;
        }
  
        // Party
        status += `### Группа\n`;
        status += party.length > 0 ? `${party.length} участник(ов)\n\n` : `*В группе никого нет*\n\n`;
  
        // Inventory
        status += `### Инвентарь\n`;
        status += `${inventory.length} предмет(ов)\n\n`;
  
        // Combat
        status += `### Бой\n`;
        if (encounterId) {
          status += `**Активная сцена боя:** ${encounterId}\n`;
          status += `Участников боя: ${combatants.length}\n\n`;
        } else {
          status += `*Активного боя нет*\n\n`;
        }
  
        // Connection
        status += `### Подключение MCP\n`;
        status += mcpManager.gameStateClient.isConnected() ? `✓ Подключено` : `✗ Отключено`;
  
        return { content: status };
      }
  
      case 'sync': {
        try {
          await gameState.syncState();
          await combatState.syncCombatState();
          return { content: `✓ Состояние синхронизировано`, type: 'success' };
        } catch (error: any) {
          return { content: `✗ Синхронизация не удалась: ${error.message}`, type: 'error' };
        }
      }
  
      case 'debug': {
        const activeChar = gameState.activeCharacter;
        const encounterId = combatState.activeEncounterId;
  
        let debug = `## Отладочная информация\n\n`;
        debug += `### Идентификаторы\n`;
        debug += `- ID активного персонажа: \`${activeChar?.id || 'нет'}\`\n`;
        debug += `- ID активной сцены боя: \`${encounterId || 'нет'}\`\n\n`;
  
        debug += `### Статус MCP\n`;
        debug += `- Клиент состояния игры: ${mcpManager.gameStateClient.isConnected() ? '✓ Подключено' : '✗ Отключено'}\n`;
        debug += `- Клиент боя: ${mcpManager.combatClient.isConnected() ? '✓ Подключено' : '✗ Отключено'}\n\n`;
  
        debug += `### Размеры хранилищ\n`;
        debug += `- Группа: ${gameState.party.length}\n`;
        debug += `- Инвентарь: ${gameState.inventory.length}\n`;
        debug += `- Заметки: ${gameState.notes.length}\n`;
        debug += `- Участники боя: ${combatState.entities.length}\n`;
        debug += `- Рельеф: ${combatState.terrain.length}\n`;
  
        return { content: debug };
      }
  
      case 'clear': {
        useChatStore.getState().clearHistory();
        return { content: `✓ Чат очищен`, type: 'success' };
      }

      case 'playtest': {
        // Toggle playtest mode for systematic testing
        const currentlyEnabled = isPlaytestModeEnabled();
        const newState = !currentlyEnabled;
        setPlaytestMode(newState);
        
        if (newState) {
          return { 
            content: `🧪 **Режим тестирования включен**\n\nИИ-Мастер теперь проверяет механики. Попробуй:\n- «проверь бой» — полный тест боя\n- «проверь зону урона» — тест зонального урона\n- «проверь ходы» — тест порядка ходов\n\nВведи \`/playtest\` еще раз, чтобы выключить режим.`,
            type: 'success'
          };
        } else {
          return { 
            content: `🎭 **Режим тестирования выключен**\n\nВозвращаю обычный режим Мастера.`,
            type: 'success'
          };
        }
      }
  
      // === CHARACTER COMMANDS ===
      case 'characters': {
        try {
          let result: any;
          try {
            result = await mcpManager.gameStateClient.callTool('character_manage', { action: 'list' });
          } catch {
            result = await mcpManager.gameStateClient.callTool('list_characters', {});
          }

          // Newer character_manage embeds JSON; current legacy MCP returns plain JSON text.
          let parsed = extractMcpJsonPayload<any>(result, 'CHARACTER_MANAGE_JSON');
          let text = result?.content?.[0]?.text || '';
          if (!parsed && text.includes('Tool character_manage not found')) {
            result = await mcpManager.gameStateClient.callTool('list_characters', {});
            parsed = extractMcpJsonPayload<any>(result);
            text = result?.content?.[0]?.text || '';
          }
          if (!parsed) {
            return { content: text || `*Персонажи не найдены*` };
          }
          const chars = parsed.characters;

          if (!Array.isArray(chars) || chars.length === 0) {
            return { content: `*Персонажи не найдены*\n\nПопроси ИИ создать персонажа, например: "Создай воина по имени Валерос"` };
          }
  
          let output = `## Персонажи (${chars.length})\n\n`;
          for (const char of chars) {
            output += `### ${char.name}\n`;
            output += `- **ID:** \`${char.id}\`\n`;
            output += `- **Уровень:** ${char.level || 1}\n`;
            output += `- **ОЗ:** ${char.hp || 0}/${char.maxHp || 0}\n`;
            output += `- **КД:** ${char.ac || 10}\n\n`;
          }
          return { content: output };
        } catch (error: any) {
          return { content: `Ошибка при получении списка персонажей: ${error.message}`, type: 'error' };
        }
      }
  
      case 'character': {
        try {
          const charId = args.trim() || gameState.activeCharacter?.id;
          if (!charId) {
            return { content: `Не указан ID персонажа и нет активного персонажа.\n\nИспользование: \`/character <id>\` или сначала выбери активного персонажа.`, type: 'error' };
          }
  
          let result: any;
          try {
            result = await mcpManager.gameStateClient.callTool('character_manage', { action: 'get', characterId: charId });
          } catch {
            result = await mcpManager.gameStateClient.callTool('get_character', { id: charId });
          }
          
          // Newer character_manage embeds the character; legacy get_character returns it flat.
          let charData = extractMcpJsonPayload<any>(result, 'CHARACTER_MANAGE_JSON');
          const text = result?.content?.[0]?.text || '';
          if (!charData && text.includes('Tool character_manage not found')) {
            const legacyResult = await mcpManager.gameStateClient.callTool('get_character', { id: charId });
            charData = extractMcpJsonPayload<any>(legacyResult);
          }
          const char = charData?.character ?? charData;

          if (!char || char.error) {
            return { content: `Персонаж не найден: ${charId}`, type: 'error' };
          }
  
          let output = `## ${char.name}\n\n`;
          output += `**ID:** \`${char.id}\`\n`;
          output += `**Раса:** ${getRaceLabel(char.race) || 'неизвестно'}\n`;
          output += `**Класс:** ${getClassLabel(char.class || char.characterClass) || 'Искатель приключений'}\n`;
          output += `**Уровень:** ${char.level || 1}\n`;
          output += `**ОЗ:** ${char.hp || 0}/${char.maxHp || 0}\n`;
          output += `**КД:** ${char.ac || 10}\n\n`;
  
          if (char.stats) {
            output += `### Характеристики\n`;
            output += `| СИЛ | ЛВК | ТЕЛ | ИНТ | МДР | ХАР |\n`;
            output += `|-----|-----|-----|-----|-----|-----|\n`;
            output += `| ${char.stats.str || 10} | ${char.stats.dex || 10} | ${char.stats.con || 10} | ${char.stats.int || 10} | ${char.stats.wis || 10} | ${char.stats.cha || 10} |\n`;
          }
  
          if (char.inventory && char.inventory.length > 0) {
            output += `\n### Инвентарь\n`;
            for (const item of char.inventory) {
              output += `- ${getItemLabel(item.name)}${item.quantity > 1 ? ` (x${item.quantity})` : ''}${item.equipped ? ' [надето]' : ''}\n`;
            }
          }
  
          if (char.conditions && char.conditions.length > 0) {
            output += `\n### Состояния\n`;
            for (const cond of char.conditions) {
              output += `- ${getConditionLabel(cond)}\n`;
            }
          }
  
          return { content: output };
        } catch (error: any) {
          return { content: `Ошибка при получении персонажа: ${error.message}`, type: 'error' };
        }
      }
  
      case 'party': {
        // Use partyStore for accurate party membership data
        try {
          const { usePartyStore } = await import('../../stores/partyStore');
          const partyState = usePartyStore.getState();
          const activeParty = partyState.getActiveParty();
          
          if (!activeParty || activeParty.members.length === 0) {
            return { content: `*В группе никого нет*\n\nСоздай персонажей через ИИ.` };
          }
  
          let output = `## ${activeParty.name} (${activeParty.members.length} участник(ов))\n\n`;
          for (const member of activeParty.members) {
            const char = member.character;
            const isActive = member.characterId === gameState.activeCharacter?.id;
            const roleIcon = member.role === 'leader' ? '★ ' : member.isActive ? '▶ ' : '';
            output += `### ${roleIcon}${char.name} ${isActive ? '(активный)' : ''}\n`;
            output += `**${getRaceLabel(char.race) || 'неизвестно'}** ${getClassLabel(char.class) || 'Искатель приключений'}, ур. ${char.level || 1}\n`;
            output += `ОЗ: ${char.hp || 0}/${char.maxHp || 0} | КД: ${char.ac || 10}\n\n`;
          }
          return { content: output };
        } catch (error: any) {
          // Fallback to gameState.party if partyStore fails
          const party = gameState.party;
          if (party.length === 0) {
            return { content: `*В группе никого нет*\n\nСоздай персонажей через ИИ.` };
          }
  
          let output = `## Группа (${party.length})\n\n`;
          for (const member of party) {
            const isActive = member.id === gameState.activeCharacter?.id;
            output += `### ${member.name} ${isActive ? '(активный)' : ''}\n`;
            output += `**${getRaceLabel(member.race) || 'неизвестно'}** ${getClassLabel(member.class) || 'Искатель приключений'}, ур. ${member.level || 1}\n`;
            output += `ОЗ: ${member.hp?.current || 0}/${member.hp?.max || 0}\n\n`;
          }
          return { content: output };
        }
      }
  
      case 'inventory': {
        try {
          const charId = gameState.activeCharacter?.id;
          if (!charId) {
            return { content: `Нет активного персонажа. Сначала выбери персонажа.`, type: 'error' };
          }
  
          let result: any;
          try {
            result = await mcpManager.gameStateClient.callTool('inventory_manage', { action: 'get_detailed', characterId: charId });
          } catch {
            result = await mcpManager.gameStateClient.callTool('get_inventory_detailed', { characterId: charId });
          }

          // Newer inventory_manage embeds JSON; legacy get_inventory_detailed returns plain JSON.
          let data = extractMcpJsonPayload<any>(result, 'INVENTORY_MANAGE_JSON');
          let text = result?.content?.[0]?.text || '';
          if (!data && text.includes('Tool inventory_manage not found')) {
            result = await mcpManager.gameStateClient.callTool('get_inventory_detailed', { characterId: charId });
            data = extractMcpJsonPayload<any>(result);
            text = result?.content?.[0]?.text || '';
          }
          if (!data) {
            return { content: text || `*Инвентарь пуст*` };
          }

          // Consolidated tool returns items under `inventory` (legacy was `items`)
          const items = data.inventory || data.items || [];
          
          if (!Array.isArray(items) || items.length === 0) {
            return { content: `*Инвентарь пуст*` };
          }
  
          let output = `## 🎒 Инвентарь (${items.length} предмет(ов))\n`;
          output += `**Вес:** ${data.totalWeight?.toFixed(1) || 0} / ${data.capacity || 100} фунт.\n\n`;
          output += `| Предмет | Тип | Кол-во | Вес | Надето |\n`;
          output += `|------|------|-----|--------|----------|\n`;
          for (const entry of items) {
            const item = entry.item || entry;
            const name = getItemLabel(item.name || entry.itemId || 'неизвестно');
            const type = item.type ? formatItemType(item.type) : '-';
            const qty = entry.quantity || 1;
            const weight = item.weight ? `${(item.weight * qty).toFixed(1)}` : '-';
            const equipped = entry.equipped ? '✓' : '-';
            output += `| ${name} | ${type} | ${qty} | ${weight} | ${equipped} |\n`;
          }
          return { content: output };
        } catch (error: any) {
          return { content: `Ошибка при получении инвентаря: ${error.message}`, type: 'error' };
        }
      }
  
      case 'items': {
        return { content: `Шаблоны предметов создаются инструментом \`create_item_template\`.\n\nПопроси ИИ: "Создай шаблон длинного меча"` };
      }
  
      case 'quests':
      case 'questlog': {
        try {
          const charId = gameState.activeCharacter?.id;
          if (!charId) {
            return { content: `Нет активного персонажа. Сначала выбери персонажа.`, type: 'error' };
          }
  
          let result: any;
          try {
            result = await mcpManager.gameStateClient.callTool('quest_manage', { action: 'get_log', characterId: charId });
          } catch {
            result = await mcpManager.gameStateClient.callTool('get_quest_log', { characterId: charId });
          }

          // Newer quest_manage embeds JSON; legacy get_quest_log returns plain JSON.
          let logData = extractMcpJsonPayload<any>(result, 'QUEST_MANAGE_JSON');
          let text = result?.content?.[0]?.text || '';
          if (!logData && text.includes('Tool quest_manage not found')) {
            result = await mcpManager.gameStateClient.callTool('get_quest_log', { characterId: charId });
            logData = extractMcpJsonPayload<any>(result);
            text = result?.content?.[0]?.text || '';
          }
          if (!logData || logData.error) {
            return { content: text || `*Активных квестов нет*` };
          }
          const quests = logData.quests;

          if (!Array.isArray(quests) || quests.length === 0) {
            return { content: `*Активных квестов нет*\n\nПопроси ИИ создать квест.` };
          }
  
          let output = `## Журнал квестов (${quests.length})\n\n`;
          for (const quest of quests) {
            output += `### ${quest.name}\n`;
            output += `**Статус:** ${quest.status || 'активен'}\n`;
            output += `${quest.description || ''}\n\n`;
  
            if (quest.objectives && quest.objectives.length > 0) {
              output += `**Цели:**\n`;
              for (const obj of quest.objectives) {
                const done = obj.completed ? '✓' : '○';
                output += `- ${done} ${obj.description} (${obj.current || 0}/${obj.required})\n`;
              }
              output += '\n';
            }
          }
          return { content: output };
        } catch (error: any) {
          return { content: `Ошибка при получении квестов: ${error.message}`, type: 'error' };
        }
      }
  
      case 'combat': {
        const encounterId = combatState.activeEncounterId;
        if (!encounterId) {
          return { content: `*Активного боя нет*\n\nЧтобы начать бой, попроси ИИ: "Начни бой с двумя гоблинами"` };
        }
  
        try {
          const result = await mcpManager.gameStateClient.callTool('combat_manage', { action: 'get', encounterId });
          const text = result?.content?.[0]?.text || '';

          // combat_manage/get embeds encounter state (round, participants, currentTurn) under COMBAT_MANAGE_JSON
          const encounter = extractEmbeddedJson<any>(text, 'COMBAT_MANAGE_JSON');

          if (!encounter || encounter.error) {
            return { content: `Не удалось получить состояние боя`, type: 'error' };
          }
  
          let output = `## Бой - раунд ${encounter.round || 1}\n\n`;
          output += `**ID сцены боя:** \`${encounterId}\`\n\n`;
  
          output += `### Порядок инициативы\n`;
          output += `| # | Имя | ОЗ | Состояния |\n`;
          output += `|---|------|----|-----------|\n`;
  
          const participants = encounter.participants || [];
          for (let i = 0; i < participants.length; i++) {
            const p = participants[i];
            const isCurrent = i === encounter.currentTurn;
            const marker = isCurrent ? '→' : (i + 1).toString();
            output += `| ${marker} | ${p.name} | ${p.hp}/${p.maxHp} | ${(p.conditions || []).join(', ') || '-'} |\n`;
          }
  
          return { content: output };
        } catch (error: any) {
          return { content: `Ошибка при получении боя: ${error.message}`, type: 'error' };
        }
      }
  
      case 'initiative': {
        const combatants = combatState.entities;
        if (combatants.length === 0) {
          return { content: `*Участников боя нет*` };
        }
  
        let output = `## Порядок инициативы\n\n`;
        const turnOrder = combatState.turnOrder || [];
        if (turnOrder.length > 0) {
          for (let i = 0; i < turnOrder.length; i++) {
            const name = turnOrder[i];
            const entity = combatants.find(c => c.name === name);
            const hp = entity?.metadata?.hp;
            output += `${i + 1}. **${name}** - ${hp?.current || 0}/${hp?.max || 0} ОЗ\n`;
          }
        } else {
          for (let i = 0; i < combatants.length; i++) {
            const c = combatants[i];
            output += `${i + 1}. **${c.name}** - ${c.metadata?.hp?.current || 0}/${c.metadata?.hp?.max || 0} ОЗ\n`;
          }
        }
        return { content: output };
      }
  
      case 'worlds': {
        try {
          let result: any;
          try {
            result = await mcpManager.gameStateClient.callTool('world_manage', { action: 'list' });
          } catch {
            result = await mcpManager.gameStateClient.callTool('list_worlds', {});
          }
          const text = result?.content?.[0]?.text || '';

          // world_manage/list embeds JSON; legacy list_worlds returns plain JSON text.
          let listData = extractEmbeddedJson<any>(text, 'WORLD_MANAGE_JSON');
          if (!listData) {
            try { listData = JSON.parse(text); } catch { /* keep null */ }
          }
          if (!listData && text.includes('Tool world_manage not found')) {
            const legacyResult = await mcpManager.gameStateClient.callTool('list_worlds', {});
            try { listData = JSON.parse(legacyResult?.content?.[0]?.text || ''); } catch { /* keep null */ }
          }
          if (!listData || listData.error) {
            return { content: text || `*Миры еще не созданы*` };
          }
          const worlds = listData.worlds;

          if (!Array.isArray(worlds) || worlds.length === 0) {
            return { content: `*Миры еще не созданы*\n\nПопроси ИИ: "Создай новый мир Эльдория"` };
          }

          let output = `## Миры (${worlds.length})\n\n`;
          for (const world of worlds) {
            const width = world.dimensions?.width ?? world.width;
            const height = world.dimensions?.height ?? world.height;
            output += `### ${world.name}\n`;
            output += `- **ID:** \`${world.id}\`\n`;
            output += `- **Размер:** ${width}x${height}\n`;
            output += `- **Сид:** ${world.seed}\n\n`;
          }
          return { content: output };
        } catch (error: any) {
          return { content: `Ошибка при получении списка миров: ${error.message}`, type: 'error' };
        }
      }
  
      case 'world': {
        const worldId = args.trim();
        if (!worldId) {
          return { content: `Использование: \`/world <id>\`\n\nКоманда \`/worlds\` покажет доступные миры.`, type: 'error' };
        }
  
        try {
          let result: any;
          try {
            result = await mcpManager.gameStateClient.callTool('world_manage', { action: 'get', id: worldId });
          } catch {
            result = await mcpManager.gameStateClient.callTool('get_world', { id: worldId });
          }
          const text = result?.content?.[0]?.text || '';

          // world_manage/get embeds { world }; legacy get_world returns the world flat.
          let getData = extractEmbeddedJson<any>(text, 'WORLD_MANAGE_JSON');
          if (!getData) {
            try {
              const legacyWorld = JSON.parse(text);
              getData = legacyWorld?.id ? { world: legacyWorld } : legacyWorld;
            } catch { /* keep null */ }
          }
          if (!getData && text.includes('Tool world_manage not found')) {
            const legacyResult = await mcpManager.gameStateClient.callTool('get_world', { id: worldId });
            try {
              const legacyWorld = JSON.parse(legacyResult?.content?.[0]?.text || '');
              getData = legacyWorld?.id ? { world: legacyWorld } : legacyWorld;
            } catch { /* keep null */ }
          }
          const world = getData?.world;

          if (!getData || getData.error || !world) {
            return { content: `Мир не найден: ${worldId}`, type: 'error' };
          }
  
          let output = `## ${world.name}\n\n`;
          output += `**ID:** \`${world.id}\`\n`;
          output += `**Размер:** ${world.width}x${world.height}\n`;
          output += `**Сид:** ${world.seed}\n`;
  
          return { content: output };
        } catch (error: any) {
          return { content: `Ошибка при получении мира: ${error.message}`, type: 'error' };
        }
      }
  
      case 'roll':
      case 'adv':
      case 'dis': {
        if (!args.trim()) {
           // Basic usage return
           return { content: `Использование: \`/${command} <выражение>\``, type: 'error' };
        }
        try {
          // Parse dice expression
          let expression = args.trim();
          if (command === 'adv') expression = expression.replace(/(\d*)d20/i, '2d20kh1');
          if (command === 'dis') expression = expression.replace(/(\d*)d20/i, '2d20kl1');
  
          const result = await mcpManager.gameStateClient.callTool('math_manage', {
            action: 'roll',
            expression,
            exportFormat: 'steps'
          });
          const text = result?.content?.[0]?.text || '';

          // math_manage/roll embeds { total, rolls, seed, formatted } under MATH_MANAGE_JSON
          // (legacy renames: total = sum, rolls = per-die steps)
          const rollData = extractEmbeddedJson<any>(text, 'MATH_MANAGE_JSON');

          let output = `## 🎲 ${args.trim()} ${command !== 'roll' ? `(${command})` : ''}\n\n`;
          if (rollData && !rollData.error) {
            const rolls = Array.isArray(rollData.rolls) ? rollData.rolls.join('\n') : (rollData.rolls ?? '');
            output += `**Результат:** ${rollData.total}\n\n`;
            output += '```\n' + rolls + '\n```';
          } else {
            // Fallback: render the raw formatted text
            output += '```\n' + text + '\n```';
          }
          return { content: output };
        } catch (error: any) {
          return { content: `Ошибка броска костей: ${error.message}`, type: 'error' };
        }
      }
  
      case 'secrets': {
        try {
          const worldId = gameState.activeWorldId;
          if (!worldId) return { content: `Нет активного мира. Сначала выбери мир.`, type: 'error' };
  
          // secret_manage/get_context returns RAW JSON (no embedded envelope), so JSON.parse stays.
          const result = await mcpManager.gameStateClient.callTool('secret_manage', { action: 'get_context', worldId });
          const text = result?.content?.[0]?.text || '{}';

          let secrets;
          try { secrets = JSON.parse(text); } catch { return { content: text }; }
  
          if (!secrets || Object.keys(secrets).length === 0) {
            return { content: `*Для этого мира секреты не сохранены*` };
          }
  
          return { content: `## 🔒 Секреты\n\n${JSON.stringify(secrets, null, 2)}` };
        } catch (error: any) {
          return { content: `Ошибка: ${error.message}`, type: 'error' };
        }
      }
  
      case 'tab': {
        // Derived from the single ALL_TABS source so the `/tab` whitelist can
        // never drift behind newly-added tabs (skills/chains/achievements/reputation).
        const validTabs: readonly ActiveTab[] = ALL_TABS;
        const tab = args.trim().toLowerCase() as ActiveTab;
        if (!validTabs.includes(tab)) return { content: `Доступные вкладки: ${validTabs.join(', ')}`, type: 'error' };
        uiStore.setActiveTab(tab);
        return { content: `Открыта вкладка **${tab}**`, type: 'success' };
      }
  
      // === SKILL CHECK COMMANDS ===
      case 'perception':
      case 'stealth':
      case 'athletics':
      case 'acrobatics':
      case 'arcana':
      case 'history':
      case 'investigation':
      case 'nature':
      case 'religion':
      case 'insight':
      case 'medicine':
      case 'survival':
      case 'deception':
      case 'intimidation':
      case 'performance':
      case 'persuasion':
      case 'animal_handling':
      case 'sleight_of_hand': {
        const charId = gameState.activeCharacter?.id;
        if (!charId) return { content: `Нет активного персонажа. Сначала выбери персонажа.`, type: 'error' };
        
        // Parse optional advantage/disadvantage from args
        const argLower = args.trim().toLowerCase();
        const advantage = argLower.includes('adv') || argLower.includes('advantage');
        const disadvantage = argLower.includes('dis') || argLower.includes('disadvantage');
        
        try {
          // No dedicated auto-proficiency skill-check tool exists anymore; roll a raw
          // d20 via math_manage/roll. The engine does NOT auto-apply ability/proficiency
          // modifiers, so the result is the unmodified d20 (add bonuses manually).
          const expression = advantage ? '2d20kh1' : disadvantage ? '2d20kl1' : '1d20';
          const result = await mcpManager.gameStateClient.callTool('math_manage', {
            action: 'roll',
            expression
          });
          const text = result?.content?.[0]?.text || '';
          const data = extractEmbeddedJson<any>(text, 'MATH_MANAGE_JSON');
          if (!data || data.error) {
            return { content: `Ошибка проверки навыка: не удалось разобрать результат броска`, type: 'error' };
          }

          const skillName = SKILL_LABELS[command] || command.replace(/_/g, ' ');
          let output = `## 🎲 Проверка ${skillName}\n\n`;
          output += `Чистый d20: **${data.total}**\n\n`;
          output += `*Добавь модификатор характеристики и бонус мастерства вручную: авто-бонус сейчас недоступен.*\n`;
          if (advantage) output += `⬆️ Преимущество\n`;
          if (disadvantage) output += `⬇️ Помеха\n`;

          return { content: output };
        } catch (error: any) {
          return { content: `Ошибка проверки навыка: ${error.message}`, type: 'error' };
        }
      }

      // Ability check shortcuts
      case 'str':
      case 'dex':
      case 'con':
      case 'int':
      case 'wis':
      case 'cha': {
        const charId = gameState.activeCharacter?.id;
        if (!charId) return { content: `Нет активного персонажа. Сначала выбери персонажа.`, type: 'error' };
        
        const argLower = args.trim().toLowerCase();
        const advantage = argLower.includes('adv');
        const disadvantage = argLower.includes('dis');
        
        try {
          // No dedicated auto-modifier ability-check tool exists anymore; roll a raw
          // d20 via math_manage/roll (modifier must be added manually).
          const expression = advantage ? '2d20kh1' : disadvantage ? '2d20kl1' : '1d20';
          const result = await mcpManager.gameStateClient.callTool('math_manage', {
            action: 'roll',
            expression
          });
          const text = result?.content?.[0]?.text || '';
          const data = extractEmbeddedJson<any>(text, 'MATH_MANAGE_JSON');
          if (!data || data.error) {
            return { content: `Ошибка проверки характеристики: не удалось разобрать результат броска`, type: 'error' };
          }

          const abilityName = ABILITY_LABELS[command] || command.toUpperCase();
          let output = `## 🎲 Проверка: ${abilityName}\n\n`;
          output += `Чистый d20: **${data.total}**\n`;
          output += `\n*Добавь модификатор характеристики вручную: авто-бонус сейчас недоступен.*\n`;
          if (advantage) output += `⬆️ Преимущество\n`;
          if (disadvantage) output += `⬇️ Помеха\n`;

          return { content: output };
        } catch (error: any) {
          return { content: `Ошибка проверки характеристики: ${error.message}`, type: 'error' };
        }
      }

      // Saving throw command
      case 'save': {
        const charId = gameState.activeCharacter?.id;
        if (!charId) return { content: `Нет активного персонажа. Сначала выбери персонажа.`, type: 'error' };
        
        const parts = args.trim().toLowerCase().split(/\s+/);
        const ability = parts[0];
        if (!['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(ability)) {
          return { content: `Использование: \`/save <характеристика>\` (например, \`/save dex\`)`, type: 'error' };
        }
        
        const advantage = parts.includes('adv');
        const disadvantage = parts.includes('dis');
        
        try {
          // No dedicated auto-proficiency saving-throw tool exists anymore; roll a raw
          // d20 via math_manage/roll (save bonus must be added manually).
          const expression = advantage ? '2d20kh1' : disadvantage ? '2d20kl1' : '1d20';
          const result = await mcpManager.gameStateClient.callTool('math_manage', {
            action: 'roll',
            expression
          });
          const text = result?.content?.[0]?.text || '';
          const data = extractEmbeddedJson<any>(text, 'MATH_MANAGE_JSON');
          if (!data || data.error) {
            return { content: `Ошибка спасброска: не удалось разобрать результат броска`, type: 'error' };
          }

          const abilityName = ABILITY_LABELS[ability] || ability.toUpperCase();
          let output = `## 🛡️ Спасбросок: ${abilityName}\n\n`;
          output += `Чистый d20: **${data.total}**\n`;
          output += `\n*Добавь бонус спасброска вручную: авто-бонус сейчас недоступен.*\n`;
          if (advantage) output += `⬆️ Преимущество\n`;
          if (disadvantage) output += `⬇️ Помеха\n`;

          return { content: output };
        } catch (error: any) {
          return { content: `Ошибка спасброска: ${error.message}`, type: 'error' };
        }
      }

      // Rest commands - open Rest Panel
      case 'rest':
      case 'camp': {
        (await import('../../stores/hudStore')).useHudStore.getState().toggleRestPanel();
        return { content: `⛺ **Меню отдыха открыто.** Выбери короткий или долгий отдых.` };
      }

      case 'shortrest': {
        const charId = gameState.activeCharacter?.id;
        if (!charId) return { content: `Нет активного персонажа.`, type: 'error' };
        try {
          // rest_manage returns RAW JSON (no embedded envelope); field names preserved.
          const result = await mcpManager.gameStateClient.callTool('rest_manage', {
            action: 'short',
            characterId: charId,
            hitDiceToSpend: 1
          });
          const text = result?.content?.[0]?.text || '{}';
          const data = JSON.parse(text);
          await gameState.syncState();
          return { content: `⛺ **${data.character}** устраивает короткий отдых. HP: ${data.previousHp} → ${data.newHp} (+${data.hpRestored})` };
        } catch (error: any) {
          return { content: `Отдых не удался: ${error.message}`, type: 'error' };
        }
      }

      case 'longrest': {
        const charId = gameState.activeCharacter?.id;
        if (!charId) return { content: `Нет активного персонажа.`, type: 'error' };
        try {
          // rest_manage returns RAW JSON (no embedded envelope); field names preserved.
          const result = await mcpManager.gameStateClient.callTool('rest_manage', {
            action: 'long',
            characterId: charId
          });
          const text = result?.content?.[0]?.text || '{}';
          const data = JSON.parse(text);
          await gameState.syncState();
          let msg = `🌙 **${data.character}** завершает долгий отдых. HP: ${data.previousHp} → ${data.newHp} (полностью)`;
          if (data.spellSlotsRestored) msg += `\n**Ячейки заклинаний:** восстановлены`;
          return { content: msg };
        } catch (error: any) {
          return { content: `Отдых не удался: ${error.message}`, type: 'error' };
        }
      }

      // Loot commands
      case 'loot':
      case 'corpses': {
        (await import('../../stores/hudStore')).useHudStore.getState().toggleLootPanel();
        return { content: `💀 **Панель добычи открыта.** Нажми на тело, чтобы посмотреть инвентарь.` };
      }

      default:
        return null; // Not a recognized command
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const currentInput = input;
    setInput('');
    setIsLoading(true);
    focusChatInput();

    addMessage({
      id: Date.now().toString(),
      sender: 'user',
      content: currentInput,
      timestamp: Date.now(),
      type: 'text',
    });

    if (currentInput.startsWith('/')) {
      const spaceIndex = currentInput.indexOf(' ');
      const command = spaceIndex === -1 
        ? currentInput.slice(1).toLowerCase() 
        : currentInput.slice(1, spaceIndex).toLowerCase();
      const args = spaceIndex === -1 ? '' : currentInput.slice(spaceIndex + 1);

      try {
        const result = await handleSlashCommand(command, args);

        if (result) {
          addMessage({
            id: Date.now().toString() + '-ai',
            sender: result.type === 'error' ? 'system' : 'ai',
            content: result.content,
            timestamp: Date.now(),
            type: result.type || 'text',
          });
        } else {
          addMessage({
            id: Date.now().toString() + '-err',
            sender: 'system',
            content: `Неизвестная команда: \`/${command}\``,
            timestamp: Date.now(),
            type: 'error',
          });
        }
      } catch (error: any) {
        addMessage({
          id: Date.now().toString() + '-err',
          sender: 'system',
          content: `Ошибка команды: ${error.message}`,
          timestamp: Date.now(),
          type: 'error',
        });
      }

      setIsLoading(false);
      focusChatInput();
      return;
    }

    // Standard LLM submission
    await submitToLLM();
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-terminal-green-dim bg-terminal-black">
      <div className="flex gap-2 items-end">
        <div className="flex-grow flex items-start bg-terminal-black border border-terminal-green-dim p-2">
          <span className="text-terminal-green mr-2 font-bold mt-1">{'>'}</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter submits, Shift+Enter adds newline
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (isLoading) return;
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            placeholder={placeholderText}
            className="flex-grow bg-transparent focus:outline-none text-terminal-green placeholder-terminal-green/30 font-mono resize-none min-h-[24px] max-h-[200px]"
            rows={1}
            style={{ height: 'auto', overflow: 'hidden' }}
            onInput={(e) => {
              // Auto-resize textarea
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 200) + 'px';
            }}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-terminal-black transition-all duration-200 uppercase tracking-wider font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '...' : 'Выполнить'}
        </button>
      </div>
    </form>
  );
};
