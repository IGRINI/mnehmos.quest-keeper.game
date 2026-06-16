/**
 * Format MCP tool responses into beautiful markdown
 * Now also supports returning structured data for rich visualizations
 */

import { getItemLabel } from './itemDisplayLabels';


// Visualization type indicators for components
export type VisualizationType =
    | 'world'
    | 'world_overview'
    | 'nation'
    | 'nation_list'
    | 'region'
    | 'region_detail'
    | 'strategy_state'
    | null;

export interface FormattedResponse {
    markdown: string;
    visualization?: {
        type: VisualizationType;
        data: any;
    };
}

const ABILITY_SHORT_LABELS = {
    str: 'СИЛ',
    dex: 'ЛВК',
    con: 'ТЕЛ',
    int: 'ИНТ',
    wis: 'МДР',
    cha: 'ХАР',
} as const;

const ABILITY_FULL_LABELS = {
    str: 'Сила',
    dex: 'Ловкость',
    con: 'Телосложение',
    int: 'Интеллект',
    wis: 'Мудрость',
    cha: 'Харизма',
} as const;

const ITEM_TYPE_LABELS: Record<string, string> = {
    weapon: 'оружие',
    armor: 'доспехи',
    consumable: 'расходники',
    quest: 'квестовые',
    artifact: 'артефакты',
    tool: 'инструменты',
    misc: 'разное',
};

const SECRET_TYPE_LABELS: Record<string, string> = {
    npc: 'НПС',
    location: 'локация',
    item: 'предмет',
    quest: 'квест',
    plot: 'сюжет',
    mechanic: 'механика',
    custom: 'другое',
    general: 'общее',
};

const WORLD_VALUE_LABELS: Record<string, string> = {
    dawn: 'рассвет',
    morning: 'утро',
    noon: 'полдень',
    afternoon: 'день',
    evening: 'вечер',
    dusk: 'сумерки',
    night: 'ночь',
    midnight: 'полночь',
    clear: 'ясно',
    sunny: 'солнечно',
    cloudy: 'облачно',
    overcast: 'пасмурно',
    rain: 'дождь',
    rainy: 'дождливо',
    storm: 'буря',
    stormy: 'шторм',
    snow: 'снег',
    snowy: 'снежно',
    fog: 'туман',
    foggy: 'туманно',
    windy: 'ветрено',
    spring: 'весна',
    summer: 'лето',
    autumn: 'осень',
    fall: 'осень',
    winter: 'зима',
    freezing: 'мороз',
    cold: 'холодно',
    cool: 'прохладно',
    mild: 'умеренно',
    warm: 'тепло',
    hot: 'жарко',
    scorching: 'зной',
    new: 'новолуние',
    waxing_crescent: 'растущий серп',
    first_quarter: 'первая четверть',
    waxing_gibbous: 'растущая луна',
    full: 'полнолуние',
    waning_gibbous: 'убывающая луна',
    last_quarter: 'последняя четверть',
    waning_crescent: 'убывающий серп',
};

const BIOME_LABELS: Record<string, string> = {
    forest: 'лес',
    plains: 'равнины',
    grassland: 'луга',
    desert: 'пустыня',
    mountain: 'горы',
    mountains: 'горы',
    hills: 'холмы',
    swamp: 'болото',
    tundra: 'тундра',
    ocean: 'океан',
    coast: 'побережье',
    river: 'река',
    lake: 'озеро',
    jungle: 'джунгли',
    taiga: 'тайга',
    savanna: 'саванна',
    wasteland: 'пустошь',
    volcanic: 'вулканическая зона',
    arctic: 'арктика',
    wetland: 'топи',
};

const REGION_TYPE_LABELS: Record<string, string> = {
    region: 'регион',
    province: 'провинция',
    wilderness: 'дикая местность',
    settlement: 'поселение',
    forest: 'лес',
    plains: 'равнины',
    mountain: 'горы',
    coastal: 'побережье',
    desert: 'пустыня',
    swamp: 'болото',
    urban: 'городская зона',
    rural: 'сельская зона',
    frontier: 'пограничье',
    island: 'остров',
    valley: 'долина',
};

const STRUCTURE_TYPE_LABELS: Record<string, string> = {
    city: 'город',
    town: 'городок',
    village: 'деревня',
    castle: 'замок',
    ruins: 'руины',
    dungeon: 'подземелье',
    temple: 'храм',
    fort: 'форт',
    fortress: 'крепость',
    camp: 'лагерь',
    mine: 'рудник',
    farm: 'ферма',
    port: 'порт',
    harbor: 'гавань',
    bridge: 'мост',
    tower: 'башня',
    shrine: 'святилище',
};

const IDEOLOGY_LABELS: Record<string, string> = {
    democracy: 'демократия',
    autocracy: 'автократия',
    theocracy: 'теократия',
    tribal: 'племенной строй',
    monarchy: 'монархия',
    republic: 'республика',
    empire: 'империя',
    oligarchy: 'олигархия',
    feudal: 'феодализм',
    communism: 'коммунизм',
    socialism: 'социализм',
    anarchism: 'анархия',
};

const SEVERITY_LABELS: Record<string, string> = {
    low: 'низкая',
    medium: 'средняя',
    high: 'высокая',
    critical: 'критическая',
};

const REVEAL_CONDITION_LABELS: Record<string, string> = {
    discovery: 'обнаружение',
    location: 'локация',
    conversation: 'разговор',
    quest_complete: 'завершение квеста',
    quest_completed: 'завершение квеста',
    item_acquired: 'получение предмета',
    item_used: 'использование предмета',
    npc_met: 'встреча с НПС',
    combat_won: 'победа в бою',
    time: 'время',
    manual: 'вручную',
};

function formatKnownLabel(value: string | undefined, labels: Record<string, string>): string {
    if (!value) return 'неизвестно';
    return labels[value.toLowerCase()] || value;
}

function formatItemName(item: string | { name?: string } | null | undefined): string {
    const name = typeof item === 'string' ? item : item?.name;
    return getItemLabel(name || 'Предмет');
}

function formatWorldValue(value: any, labels: Record<string, string> = WORLD_VALUE_LABELS): string {
    if (value === null || value === undefined) return 'неизвестно';
    const raw = typeof value === 'string' ? value : value.current;
    if (raw === null || raw === undefined) return 'неизвестно';
    return formatKnownLabel(String(raw), labels);
}

function localizePreformattedCombatText(text: string): string {
    return text
        .replace(/COMBAT ENCOUNTER STARTED!/g, 'БОЕВАЯ СХВАТКА НАЧАЛАСЬ!')
        .replace(/COMBAT STATUS - ROUND/g, 'СТАТУС БОЯ — РАУНД')
        .replace(/COMBAT ENDED/g, 'БОЙ ЗАВЕРШЕН')
        .replace(/Encounter ID:/g, 'ID схватки:')
        .replace(/INITIATIVE ORDER:/g, 'ПОРЯДОК ИНИЦИАТИВЫ:')
        .replace(/CURRENT TURN:/g, 'ТЕКУЩИЙ ХОД:')
        .replace(/ACTION REQUIRED: This is an ENEMY turn!/g, 'ТРЕБУЕТСЯ ДЕЙСТВИЕ: сейчас ход врага!')
        .replace(/PLAYER TURN:/g, 'ХОД ИГРОКА:')
        .replace(/PLAYER TURN/g, 'ХОД ИГРОКА')
        .replace(/ENEMY TURN - ACT NOW!/g, 'ХОД ВРАГА — ДЕЙСТВУЙ СЕЙЧАС!')
        .replace(/TURN ADVANCED/g, 'ХОД ПЕРЕДАН')
        .replace(/ROUND (\d+) BEGINS/g, 'РАУНД $1 НАЧИНАЕТСЯ')
        .replace(/VICTORY!/g, 'ПОБЕДА!')
        .replace(/DEFEAT\.\.\./g, 'ПОРАЖЕНИЕ...')
        .replace(/FLED FROM BATTLE/g, 'ОТСТУПЛЕНИЕ ИЗ БОЯ')
        .replace(/Combat concluded\./g, 'Бой завершен.')
        .replace(/Experience gained:/g, 'Получено опыта:')
        .replace(/Loot found:/g, 'Найдена добыча:')
        .replace(/Continue narrating the aftermath\./g, 'Продолжай описывать последствия.')
        .replace(/DEAD/g, 'МЕРТВ')
        .replace(/Wounded/g, 'Ранен')
        .replace(/\[ENEMY\]/g, '[ВРАГ]')
        .replace(/\[ALLY\]/g, '[СОЮЗНИК]')
        .replace(/\bInit:/g, 'Иниц.:')
        .replace(/\bHP:/g, 'ОЗ:')
        .replace(/\bAC:/g, 'КД:')
        .replace(/HIT!/g, 'ПОПАДАНИЕ!')
        .replace(/strikes/g, 'бьет')
        .replace(/DAMAGE:/g, 'УРОН:')
        .replace(/points/g, 'ед.')
        .replace(/MISS!/g, 'ПРОМАХ!')
        .replace(/attack fails to connect\./g, 'атака не достигает цели.')
        .replace(/HEALED!/g, 'ИСЦЕЛЕНИЕ!')
        .replace(/recovers/g, 'восстанавливает')
        .replace(/uses/g, 'использует')
        .replace(/Effect:/g, 'Эффект:')
        .replace(/Action completed:/g, 'Действие завершено:')
        .replace(/is DEFEATED!/g, 'побежден!')
        .replace(/NEXT STEP: Check whose turn it is using get_encounter_state, then:/g, 'СЛЕДУЮЩИЙ ШАГ: проверь чей ход через get_encounter_state, затем:')
        .replace(/NEXT: Call advance_turn to proceed to next combatant\./g, 'ДАЛЬШЕ: вызови advance_turn, чтобы перейти к следующему участнику.')
        .replace(/If enemy turn: Use execute_combat_action then advance_turn/g, 'Если ход врага: используй execute_combat_action, затем advance_turn')
        .replace(/If player turn: Present options and wait for input/g, 'Если ход игрока: предложи варианты и дождись ввода')
        .replace(/Narrate (.*?)'s action dramatically/g, 'Драматично опиши действие $1')
        .replace(/Roleplay (.*?)'s action with dramatic narration/g, 'Отыграй действие $1 с драматичным описанием')
        .replace(/Call execute_combat_action \(attack\/ability\/move\)/g, 'Вызови execute_combat_action (attack/ability/move)')
        .replace(/Call execute_combat_action/g, 'Вызови execute_combat_action')
        .replace(/Call advance_turn to proceed/g, 'Вызови advance_turn для продолжения')
        .replace(/Call advance_turn/g, 'Вызови advance_turn')
        .replace(/DO NOT ask permission - execute the enemy action NOW!/g, 'Не спрашивай разрешения — выполни действие врага сейчас!')
        .replace(/DO NOT wait for permission!/g, 'Не жди разрешения!')
        .replace(/Present options and wait for player input\./g, 'Предложи варианты и дождись ввода игрока.')
        .replace(/After player chooses: execute_combat_action then advance_turn/g, 'После выбора игрока: execute_combat_action, затем advance_turn')
        .replace(/Present options to the player and wait for their decision\./g, 'Предложи варианты игроку и дождись решения.');
}


/**
 * Process pre-formatted combat response text:
 * - Extract embedded STATE_JSON and update combat store
 * - Strip STATE_JSON block from display text
 */
function processFormattedCombatResponse(text: string): string {
    console.log('[processFormattedCombatResponse] Called with text length:', text.length);
    
    // Extract STATE_JSON if present
    const stateJsonMatch = text.match(/<!-- STATE_JSON\n([\s\S]*?)\nSTATE_JSON -->/);
    
    if (stateJsonMatch && stateJsonMatch[1]) {
        console.log('[processFormattedCombatResponse] Found STATE_JSON block');
        try {
            const stateJson = JSON.parse(stateJsonMatch[1]);
            console.log('[processFormattedCombatResponse] Parsed STATE_JSON:', {
                encounterId: stateJson.encounterId,
                participantCount: stateJson.participants?.length,
                participants: stateJson.participants?.map((p: any) => ({ name: p.name, id: p.id, hp: p.hp }))
            });
            
            // REMOVED: Side-effect state update. 
            // State sync is now handled exclusively by LLMService.handleBatchToolSync()
            // effectively decoupling view formatting from state mutations.
        } catch (e) {
            console.warn('[processFormattedCombatResponse] Failed to parse STATE_JSON:', e);
        }
    } else {
        console.log('[processFormattedCombatResponse] No STATE_JSON block found');
    }
    
    // Strip the STATE_JSON block from display
    return localizePreformattedCombatText(text.replace(/\n*<!-- STATE_JSON[\s\S]*?STATE_JSON -->\n*/g, '').trim());
}

interface Character {
    id: string;
    name: string;
    level: number;
    hp: number;
    maxHp: number;
    ac: number;
    stats?: {
        str: number;
        dex: number;
        con: number;
        int: number;
        wis: number;
        cha: number;
    };
    behavior?: string;
}

interface InventoryItem {
    itemId: string;
    quantity: number;
    equipped: boolean;
}

interface Item {
    id: string;
    name: string;
    type: string;
    description?: string;
    value?: number;
    weight?: number;
    properties?: Record<string, any>;
    createdAt?: string;
    updatedAt?: string;
}

interface DetailedInventoryItem {
    item: Item;
    quantity: number;
    equipped: boolean;
    slot?: string;
}

/**
 * Format a list of characters into a beautiful markdown table
 */
export function formatCharacterList(data: any): string {
    if (!data.characters || data.characters.length === 0) {
        return '> Персонажи в базе не найдены.';
    }

    const characters: Character[] = data.characters;
    
    let markdown = `## 🎭 Персонажи (${data.count})\n\n`;
    
    characters.forEach((char, index) => {
        const statLine = char.stats 
            ? `💪 **${ABILITY_SHORT_LABELS.str}** ${char.stats.str} | 🏃 **${ABILITY_SHORT_LABELS.dex}** ${char.stats.dex} | ❤️ **${ABILITY_SHORT_LABELS.con}** ${char.stats.con} | 🧠 **${ABILITY_SHORT_LABELS.int}** ${char.stats.int} | 🦉 **${ABILITY_SHORT_LABELS.wis}** ${char.stats.wis} | 💬 **${ABILITY_SHORT_LABELS.cha}** ${char.stats.cha}`
            : '';

        markdown += `### ${index + 1}. ${char.name}\n\n`;
        markdown += `**Уровень ${char.level}** | `;
        markdown += `ОЗ: \`${char.hp}/${char.maxHp}\` | `;
        markdown += `КД: \`${char.ac}\`\n\n`;
        
        if (statLine) {
            markdown += `${statLine}\n\n`;
        }
        
        if (char.behavior) {
            markdown += `> *${char.behavior}*\n\n`;
        }
        
        markdown += `---\n\n`;
    });

    return markdown;
}

/**
 * Format a single character into detailed markdown
 */
export function formatCharacter(char: Character): string {
    let markdown = `## 🎭 ${char.name}\n\n`;
    
    markdown += `**Уровень ${char.level}** | `;
    markdown += `ОЗ: \`${char.hp}/${char.maxHp}\` | `;
    markdown += `КД: \`${char.ac}\`\n\n`;
    
    if (char.stats) {
        markdown += `### 📊 Характеристики\n\n`;
        markdown += `| Характеристика | Значение | Модификатор |\n`;
        markdown += `|---------|-------|----------|\n`;
        markdown += `| 💪 ${ABILITY_FULL_LABELS.str} | ${char.stats.str} | ${formatModifier(char.stats.str)} |\n`;
        markdown += `| 🏃 ${ABILITY_FULL_LABELS.dex} | ${char.stats.dex} | ${formatModifier(char.stats.dex)} |\n`;
        markdown += `| ❤️ ${ABILITY_FULL_LABELS.con} | ${char.stats.con} | ${formatModifier(char.stats.con)} |\n`;
        markdown += `| 🧠 ${ABILITY_FULL_LABELS.int} | ${char.stats.int} | ${formatModifier(char.stats.int)} |\n`;
        markdown += `| 🦉 ${ABILITY_FULL_LABELS.wis} | ${char.stats.wis} | ${formatModifier(char.stats.wis)} |\n`;
        markdown += `| 💬 ${ABILITY_FULL_LABELS.cha} | ${char.stats.cha} | ${formatModifier(char.stats.cha)} |\n\n`;
    }
    
    if (char.behavior) {
        markdown += `### 📖 Поведение\n\n`;
        markdown += `> ${char.behavior}\n\n`;
    }

    return markdown;
}

/**
 * Format inventory into beautiful markdown
 * If itemIds are provided, will attempt to look up names from a local cache
 */
export function formatInventory(data: any, itemCache?: Map<string, Item>): string {
    if (!data.items || data.items.length === 0) {
        return '> 🎒 Инвентарь пуст.';
    }

    const items: InventoryItem[] = data.items;
    const capacity = data.capacity || 100;
    const usedSlots = items.reduce((sum, item) => sum + item.quantity, 0);

    let markdown = `## 🎒 Инвентарь (${usedSlots}/${capacity})\n\n`;

    // Group items by equipped status
    const equippedItems = items.filter(item => item.equipped);
    const unequippedItems = items.filter(item => !item.equipped);

    if (equippedItems.length > 0) {
        markdown += `### ⚔️ Надето\n\n`;
        equippedItems.forEach(item => {
            const detail = itemCache?.get(item.itemId);
            const name = formatItemName(detail?.name || guessItemName(item.itemId));
            const icon = getItemIcon(detail?.type || 'misc');
            
            markdown += `- ${icon} **${name}**`;
            if (item.quantity > 1) markdown += ` ×${item.quantity}`;
            if (detail?.description) markdown += `\n  > *${detail.description}*`;
            markdown += `\n`;
        });
        markdown += `\n`;
    }

    if (unequippedItems.length > 0) {
        markdown += `### 📦 В рюкзаке\n\n`;
        unequippedItems.forEach(item => {
            const detail = itemCache?.get(item.itemId);
            const name = formatItemName(detail?.name || guessItemName(item.itemId));
            const icon = getItemIcon(detail?.type || 'misc');
            
            markdown += `- ${icon} **${name}**`;
            if (item.quantity > 1) markdown += ` ×${item.quantity}`;
            if (detail?.description) markdown += `\n  > *${detail.description}*`;
            markdown += `\n`;
        });
        markdown += `\n`;
    }

    // Currency
    if (data.currency) {
        const { gold = 0, silver = 0, copper = 0 } = data.currency;
        if (gold > 0 || silver > 0 || copper > 0) {
            markdown += `### 💰 Монеты\n\n`;
            if (gold > 0) markdown += `- 🟡 **${gold}** золота\n`;
            if (silver > 0) markdown += `- ⚪ **${silver}** серебра\n`;
            if (copper > 0) markdown += `- 🟤 **${copper}** меди\n`;
        }
    }

    return markdown;
}

/**
 * Format quest log into markdown
 */
export function formatQuestLog(data: any): string {
    if (!data.quests || data.quests.length === 0) {
        return '> 📜 Активных квестов нет.';
    }

    let markdown = `## 📜 Журнал квестов\n\n`;

    data.quests.forEach((quest: any, _index: number) => {
        const statusIcon = quest.status === 'completed' ? '✅' : quest.status === 'failed' ? '❌' : '🔄';
        
        markdown += `### ${statusIcon} ${quest.title || 'Безымянный квест'}\n\n`;
        
        if (quest.description) {
            markdown += `${quest.description}\n\n`;
        }

        if (quest.objectives && quest.objectives.length > 0) {
            markdown += `**Цели:**\n\n`;
            quest.objectives.forEach((obj: any) => {
                const done = obj.completed || obj.current >= obj.required;
                const checkbox = done ? '[x]' : '[ ]';
                const progress = obj.required ? ` (${obj.current}/${obj.required})` : '';
                markdown += `- ${checkbox} ${obj.description}${progress}\n`;
            });
            markdown += `\n`;
        }

        if (quest.rewards) {
            markdown += `**Награды:**\n`;
            if (quest.rewards.experience) markdown += `- 🌟 ${quest.rewards.experience} опыта\n`;
            if (quest.rewards.gold) markdown += `- 💰 ${quest.rewards.gold} золота\n`;
            if (quest.rewards.items && quest.rewards.items.length > 0) {
                markdown += `- 🎁 Предметы: ${quest.rewards.items.map(formatItemName).join(', ')}\n`;
            }
            markdown += `\n`;
        }

        markdown += `---\n\n`;
    });

    return markdown;
}

/**
 * Format encounter/combat state
 */
export function formatEncounter(data: any): string {
    if (!data) {
        return '> ⚔️ Активной схватки нет.';
    }

    let markdown = `## ⚔️ Боевая схватка\n\n`;
    
    markdown += `**Раунд:** ${data.round || 1}\n\n`;

    if (data.participants && data.participants.length > 0) {
        markdown += `### 🎯 Порядок инициативы\n\n`;
        
        const sorted = [...data.participants].sort((a, b) => (b.initiative || 0) - (a.initiative || 0));
        
        sorted.forEach((p: any, index: number) => {
            const isCurrent = p.id === data.currentTurn;
            const marker = isCurrent ? '👉 ' : '　 ';
            const statusIcon = p.hp <= 0 ? '💀' : p.hp < p.maxHp / 2 ? '🩹' : '💚';
            
            markdown += `${marker}**${index + 1}.** ${p.name} ${statusIcon}\n`;
            markdown += `　　Инициатива: \`${p.initiative || 0}\` | ОЗ: \`${p.hp}/${p.maxHp}\``;
            
            if (p.conditions && p.conditions.length > 0) {
                markdown += ` | 🎭 ${p.conditions.join(', ')}`;
            }
            
            markdown += `\n\n`;
        });
    }

    return markdown;
}

/**
 * Format a single item into detailed markdown
 */
export function formatItem(data: any): string {
    const item: Item = data.item || data;

    if (!item || !item.name) {
        return '> Предмет не найден.';
    }

    const icon = getItemIcon(item.type);
    let markdown = `## ${icon} ${formatItemName(item)}\n\n`;

    markdown += `| Свойство | Значение |\n`;
    markdown += `|----------|-------|\n`;
    markdown += `| **Тип** | ${formatKnownLabel(item.type, ITEM_TYPE_LABELS)} |\n`;
    if (item.value !== undefined) markdown += `| **Стоимость** | ${item.value} золота |\n`;
    if (item.weight !== undefined) markdown += `| **Вес** | ${item.weight} фунт. |\n`;
    markdown += `\n`;

    if (item.description) {
        markdown += `### 📖 Описание\n\n`;
        markdown += `> ${item.description}\n\n`;
    }

    if (item.properties && Object.keys(item.properties).length > 0) {
        markdown += `### ✨ Свойства\n\n`;
        for (const [key, value] of Object.entries(item.properties)) {
            const formattedValue = typeof value === 'object' ? JSON.stringify(value) : value;
            markdown += `- **${key}:** ${formattedValue}\n`;
        }
        markdown += `\n`;
    }

    markdown += `---\n\n`;
    markdown += `*ID: \`${item.id}\`*\n`;

    return markdown;
}

/**
 * Format a list of items into markdown
 */
export function formatItemList(data: any): string {
    const items: Item[] = data.items || [];
    const count = data.count ?? items.length;
    const query = data.query;

    if (items.length === 0) {
        return '> Предметы не найдены.';
    }

    let markdown = `## 📦 Предметы (${count})\n\n`;

    if (query && Object.keys(query).length > 0) {
        const filters = Object.entries(query)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
        if (filters) {
            markdown += `*Фильтр: ${filters}*\n\n`;
        }
    }

    // Group by type
    const byType: Record<string, Item[]> = {};
    items.forEach(item => {
        const type = item.type || 'misc';
        if (!byType[type]) byType[type] = [];
        byType[type].push(item);
    });

    const typeOrder = ['weapon', 'armor', 'consumable', 'quest', 'misc'];
    const sortedTypes = Object.keys(byType).sort((a, b) => {
        const aIdx = typeOrder.indexOf(a);
        const bIdx = typeOrder.indexOf(b);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });

    sortedTypes.forEach(type => {
        const typeItems = byType[type];
        const icon = getItemIcon(type);
        markdown += `### ${icon} ${formatKnownLabel(type, ITEM_TYPE_LABELS)} (${typeItems.length})\n\n`;

        typeItems.forEach(item => {
            markdown += `- **${formatItemName(item)}**`;
            if (item.value !== undefined) markdown += ` • ${item.value} зм`;
            if (item.weight !== undefined) markdown += ` • ${item.weight} фн`;
            if (item.description) markdown += `\n  > *${item.description.substring(0, 80)}${item.description.length > 80 ? '...' : ''}*`;
            markdown += `\n`;
        });
        markdown += `\n`;
    });

    return markdown;
}

/**
 * Format detailed inventory with full item info
 */
export function formatInventoryDetailed(data: any): string {
    const items: DetailedInventoryItem[] = data.items || [];
    const totalWeight = data.totalWeight || 0;
    const capacity = data.capacity || 100;

    if (items.length === 0) {
        return '> 🎒 Инвентарь пуст.';
    }

    let markdown = `## 🎒 Инвентарь\n\n`;
    markdown += `**Вес:** ${totalWeight.toFixed(1)} / ${capacity} фунт.\n\n`;

    // Group by equipped status
    const equippedItems = items.filter(i => i.equipped);
    const unequippedItems = items.filter(i => !i.equipped);

    if (equippedItems.length > 0) {
        markdown += `### ⚔️ Надето\n\n`;
        equippedItems.forEach(inv => {
            const icon = getItemIcon(inv.item.type);
            const slot = inv.slot ? ` [${inv.slot}]` : '';
            markdown += `- ${icon} **${formatItemName(inv.item)}**${slot}`;
            if (inv.quantity > 1) markdown += ` ×${inv.quantity}`;
            if (inv.item.description) markdown += `\n  > *${inv.item.description}*`;
            markdown += `\n`;
        });
        markdown += `\n`;
    }

    if (unequippedItems.length > 0) {
        // Group unequipped by type
        const byType: Record<string, DetailedInventoryItem[]> = {};
        unequippedItems.forEach(inv => {
            const type = inv.item.type || 'misc';
            if (!byType[type]) byType[type] = [];
            byType[type].push(inv);
        });

        for (const [type, typeItems] of Object.entries(byType)) {
            const icon = getItemIcon(type);
            markdown += `### ${icon} ${formatKnownLabel(type, ITEM_TYPE_LABELS)}\n\n`;

            typeItems.forEach(inv => {
                markdown += `- **${formatItemName(inv.item)}**`;
                if (inv.quantity > 1) markdown += ` ×${inv.quantity}`;
                if (inv.item.value) markdown += ` • ${inv.item.value} зм`;
                if (inv.item.description) markdown += `\n  > *${inv.item.description}*`;
                markdown += `\n`;
            });
            markdown += `\n`;
        }
    }

    // Currency
    if (data.currency) {
        const { gold = 0, silver = 0, copper = 0 } = data.currency;
        if (gold > 0 || silver > 0 || copper > 0) {
            markdown += `### 💰 Монеты\n\n`;
            if (gold > 0) markdown += `- 🟡 **${gold}** золота\n`;
            if (silver > 0) markdown += `- ⚪ **${silver}** серебра\n`;
            if (copper > 0) markdown += `- 🟤 **${copper}** меди\n`;
        }
    }

    return markdown;
}

/**
 * Format item transfer result
 */
export function formatTransfer(data: any): string {
    let markdown = `## 🔄 Предмет передан\n\n`;
    markdown += `**${formatItemName(data.item)}** ×${data.quantity || 1}\n\n`;
    markdown += `От: \`${data.from?.substring(0, 8) || 'неизвестно'}...\`\n`;
    markdown += `Кому: \`${data.to?.substring(0, 8) || 'неизвестно'}...\`\n\n`;
    markdown += `> ${data.message || 'Передача завершена.'}\n`;
    return markdown;
}

/**
 * Format item use result
 */
export function formatUseItem(data: any): string {
    let markdown = `## 🧪 Предмет использован\n\n`;

    if (data.item) {
        markdown += `**${formatItemName(data.item)}** израсходован.\n\n`;
        if (data.item.description) {
            markdown += `> *${data.item.description}*\n\n`;
        }
    }

    if (data.effect) {
        markdown += `### ✨ Эффект\n\n`;
        if (typeof data.effect === 'object') {
            for (const [key, value] of Object.entries(data.effect)) {
                markdown += `- **${key}:** ${value}\n`;
            }
        } else {
            markdown += `${data.effect}\n`;
        }
        markdown += `\n`;
    }

    markdown += `Цель: \`${data.target?.substring(0, 8) || 'себя'}...\`\n`;

    return markdown;
}

// ============================================================================
// WORLD VISUALIZATION FORMATTERS
// ============================================================================

/**
 * Format world data (from get_world, create_world, list_worlds)
 */
export function formatWorld(data: any): FormattedResponse {
    const world = data.world || data;

    let markdown = `## 🌍 ${world.name || 'Мир'}\n\n`;

    if (world.seed) markdown += `**Сид:** \`${world.seed}\`\n`;
    if (world.width && world.height) markdown += `**Размер:** ${world.width}×${world.height}\n`;
    if (world.id) markdown += `**ID:** \`${world.id.substring(0, 12)}...\`\n`;

    markdown += `\n`;

    // Environment info
    if (world.environment) {
        const env = world.environment;
        markdown += `### 🌤️ Окружение\n\n`;
        if (env.timeOfDay || env.time_of_day) markdown += `- **Время:** ${formatWorldValue(env.timeOfDay || env.time_of_day)}\n`;
        if (env.weather || env.weatherConditions) markdown += `- **Погода:** ${formatWorldValue(env.weather || env.weatherConditions)}\n`;
        if (env.season) markdown += `- **Сезон:** ${formatWorldValue(env.season)}\n`;
        if (env.temperature) markdown += `- **Температура:** ${formatWorldValue(env.temperature)}\n`;
        if (env.moonPhase || env.moon_phase) markdown += `- **Луна:** ${formatWorldValue(env.moonPhase || env.moon_phase)}\n`;
        markdown += `\n`;
    }

    return {
        markdown,
        visualization: {
            type: 'world',
            data: world
        }
    };
}

/**
 * Format world list (from list_worlds)
 */
export function formatWorldList(data: any): FormattedResponse {
    const worlds = data.worlds || [];
    const count = data.count ?? worlds.length;

    let markdown = `## 🌍 Миры (${count})\n\n`;

    if (worlds.length === 0) {
        markdown += `> Миры не найдены. Создай мир через \`generate_world\` или \`create_world\`.\n`;
        return { markdown };
    }

    markdown += `| Название | Размер | Сид | ID |\n`;
    markdown += `|------|------|------|----|\n`;

    worlds.forEach((world: any) => {
        const name = world.name || 'Без названия';
        const size = world.width && world.height ? `${world.width}×${world.height}` : 'нет';
        const seed = world.seed || 'нет';
        const id = world.id?.substring(0, 8) || 'нет';
        markdown += `| ${name} | ${size} | \`${seed}\` | \`${id}...\` |\n`;
    });

    markdown += `\n`;

    return {
        markdown,
        visualization: worlds.length === 1 ? { type: 'world', data: worlds[0] } : undefined
    };
}

/**
 * Format world map overview (from get_world_map_overview)
 */
export function formatWorldMapOverview(data: any): FormattedResponse {
    let markdown = `## 🗺️ Обзор карты мира\n\n`;

    if (data.seed) markdown += `**Сид:** \`${data.seed}\`\n`;
    if (data.dimensions) {
        markdown += `**Размеры:** ${data.dimensions.width}×${data.dimensions.height}\n`;
    }
    markdown += `\n`;

    // Biome distribution. The value may arrive as raw tile COUNTS
    // (world_manage generate) or already as PERCENTAGES (world_map overview).
    // Normalize to percentages so the bars/card are correct either way and the
    // repeat count can never go negative.
    let normalizedBiomes: Record<string, number> | undefined;
    if (data.biomeDistribution && typeof data.biomeDistribution === 'object') {
        const entries = Object.entries(data.biomeDistribution) as [string, any][];
        const total = entries.reduce((sum, [, v]) => sum + (Number(v) || 0), 0);
        normalizedBiomes = {};
        for (const [biome, v] of entries) {
            normalizedBiomes[biome] = total > 0 ? (Number(v) / total) * 100 : 0;
        }

        markdown += `### 🌿 Распределение биомов\n\n`;
        markdown += `| Биом | Покрытие |\n`;
        markdown += `|-------|----------|\n`;
        Object.entries(normalizedBiomes)
            .sort(([, a], [, b]) => b - a)
            .forEach(([biome, pct]) => {
                const filled = Math.max(0, Math.min(20, Math.round(pct / 5)));
                const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
                markdown += `| ${formatKnownLabel(biome, BIOME_LABELS)} | ${bar} ${pct.toFixed(1)}% |\n`;
            });
        markdown += `\n`;
    }

    // Stats
    markdown += `### 📊 Статистика\n\n`;
    if (data.regionCount !== undefined) markdown += `- **Регионов:** ${data.regionCount}\n`;
    if (data.structureCount !== undefined) markdown += `- **Построек:** ${data.structureCount}\n`;
    if (data.riverTileCount !== undefined) markdown += `- **Клеток реки:** ${data.riverTileCount}\n`;

    return {
        markdown,
        visualization: {
            type: 'world_overview',
            data: normalizedBiomes ? { ...data, biomeDistribution: normalizedBiomes } : data
        }
    };
}

/**
 * Format region data (from get_region_map)
 */
export function formatRegion(data: any): FormattedResponse {
    const region = data.region || data;

    let markdown = `## 📍 ${region.name}\n\n`;

    markdown += `**Тип:** ${formatKnownLabel(region.type, REGION_TYPE_LABELS)}\n`;
    if (region.dominantBiome) markdown += `**Биом:** ${formatKnownLabel(region.dominantBiome, BIOME_LABELS)}\n`;
    if (region.capitalX !== undefined && region.capitalY !== undefined) {
        markdown += `**Столица:** (${region.capitalX}, ${region.capitalY})\n`;
    }
    markdown += `\n`;

    // Structures in region
    if (data.structures && data.structures.length > 0) {
        markdown += `### 🏗️ Постройки (${data.structures.length})\n\n`;
        data.structures.forEach((s: any) => {
            const icon = getStructureIcon(s.type);
            const x = s.x ?? s.location?.x;
            const y = s.y ?? s.location?.y;
            markdown += `- ${icon} **${s.name}** (${formatKnownLabel(s.type, STRUCTURE_TYPE_LABELS)}) на (${x}, ${y})`;
            if (s.population) markdown += ` - Население: ${s.population.toLocaleString()}`;
            markdown += `\n`;
        });
        markdown += `\n`;
    }

    if (data.tileCount) {
        markdown += `**Площадь:** ${data.tileCount} клеток\n`;
    }

    return {
        markdown,
        visualization: {
            type: 'region_detail',
            data
        }
    };
}

/**
 * Format nation data (from get_nation_state, create_nation)
 */
export function formatNation(data: any): FormattedResponse {
    const nation = data.nation || data;

    const ideologyIcons: Record<string, string> = {
        democracy: '🗳️',
        autocracy: '👑',
        theocracy: '⛪',
        tribal: '🏕️'
    };

    let markdown = `## ${ideologyIcons[nation.ideology] || '🏴'} ${nation.name}\n\n`;

    markdown += `**Лидер:** ${nation.leader}\n`;
    markdown += `**Идеология:** ${formatKnownLabel(nation.ideology, IDEOLOGY_LABELS)}\n`;
    markdown += `**ВВП:** $${nation.gdp?.toLocaleString() || 0}\n\n`;

    // Personality traits
    markdown += `### 🧠 Характер\n\n`;
    markdown += `| Черта | Значение |\n`;
    markdown += `|-------|-------|\n`;
    markdown += `| ⚔️ Агрессия | ${nation.aggression}/100 |\n`;
    markdown += `| 🤝 Доверие | ${nation.trust}/100 |\n`;
    markdown += `| 👁️ Паранойя | ${nation.paranoia}/100 |\n`;
    markdown += `\n`;

    // Resources
    if (nation.resources) {
        markdown += `### 📦 Ресурсы\n\n`;
        markdown += `- 🌾 Еда: **${nation.resources.food}**\n`;
        markdown += `- ⚙️ Металл: **${nation.resources.metal}**\n`;
        markdown += `- 🛢️ Нефть: **${nation.resources.oil}**\n`;
        markdown += `\n`;
    }

    // Public intent
    if (nation.publicIntent) {
        markdown += `### 📢 Декларация\n\n`;
        markdown += `> *"${nation.publicIntent}"*\n\n`;
    }

    // Relations
    if (nation.relations && Object.keys(nation.relations).length > 0) {
        markdown += `### 🤝 Отношения\n\n`;
        for (const [id, rel] of Object.entries(nation.relations) as [string, any][]) {
            const status = rel.alliance ? '🤝 союз' : rel.truceUntil ? '⚖️ перемирие' : '—';
            const opinion = rel.opinion > 0 ? `+${rel.opinion}` : rel.opinion;
            markdown += `- **${id.substring(0, 8)}...**: ${opinion} (${status})\n`;
        }
        markdown += `\n`;
    }

    return {
        markdown,
        visualization: {
            type: 'nation',
            data: nation
        }
    };
}

/**
 * Format strategy state (from get_strategy_state - with Fog of War)
 */
export function formatStrategyState(data: any): FormattedResponse {
    let markdown = `## ⚔️ Большая стратегия\n\n`;

    const nations = data.nations || [];
    const regions = data.regions || [];

    if (nations.length > 0) {
        markdown += `### 🏴 Государства (${nations.length})\n\n`;
        nations.forEach((n: any) => {
            const ideologyIcons: Record<string, string> = {
                democracy: '🗳️',
                autocracy: '👑',
                theocracy: '⛪',
                tribal: '🏕️'
            };
            markdown += `- ${ideologyIcons[n.ideology] || '🏴'} **${n.name}** (${n.leader}) - ВВП: $${n.gdp?.toLocaleString() || '???'}\n`;
        });
        markdown += `\n`;
    }

    if (regions.length > 0) {
        markdown += `### 📍 Регионы (${regions.length})\n\n`;
        const byOwner: Record<string, any[]> = {};
        regions.forEach((r: any) => {
            const owner = r.ownerNationId || 'Unclaimed';
            if (!byOwner[owner]) byOwner[owner] = [];
            byOwner[owner].push(r);
        });

        for (const [owner, regs] of Object.entries(byOwner)) {
            const ownerLabel = owner === 'Unclaimed' ? '🏳️ ничейные' : `🏴 ${owner.substring(0, 8)}...`;
            markdown += `**${ownerLabel}** (${regs.length} регионов)\n`;
            regs.slice(0, 5).forEach((r: any) => {
                markdown += `  - ${r.name} (${formatKnownLabel(r.type, REGION_TYPE_LABELS)})\n`;
            });
            if (regs.length > 5) markdown += `  - ...и еще ${regs.length - 5}\n`;
            markdown += `\n`;
        }
    }

    return {
        markdown,
        visualization: {
            type: 'strategy_state',
            data
        }
    };
}

/**
 * Helper: Get structure icon
 */
function getStructureIcon(type: string): string {
    const icons: Record<string, string> = {
        city: '🏙️',
        town: '🏘️',
        village: '🏠',
        castle: '🏰',
        ruins: '🏚️',
        dungeon: '⚔️',
        temple: '⛪',
    };
    return icons[type?.toLowerCase()] || '🏛️';
}

/**
 * Auto-detect response type and format accordingly
 * Returns FormattedResponse with both markdown and optional visualization data
 */
/**
 * Consolidated tools (world_manage, world_map, strategy_manage, …) return rich
 * markdown with an embedded `<!-- TAG_JSON … TAG_JSON -->` block instead of raw
 * JSON. Pull the structured payload out of any such envelope so the existing
 * shape-based routing can build a visualization for the new tools too.
 */
function extractEnvelopeJson(text: string): any | null {
    const m = text.match(/<!--\s*([A-Z0-9_]+_JSON)\s*([\s\S]*?)\s*\1\s*-->/);
    if (!m) return null;
    try {
        return JSON.parse(m[2]);
    } catch {
        return null;
    }
}

/** Remove the embedded `<!-- TAG_JSON … TAG_JSON -->` envelope from display text. */
function stripEnvelope(text: string): string {
    return text
        .replace(/<!--\s*([A-Z0-9_]+_JSON)\s*[\s\S]*?\1\s*-->/g, '')
        .replace(/�/g, '=')
        .trim();
}

export function formatToolResponseWithVisualization(toolName: string, response: any): FormattedResponse {
    try {
        // Parse if string
        const data = typeof response === 'string' ? JSON.parse(response) : response;

        // Extract from MCP wrapper if present
        let actualData = data;
        // Markdown to show when no rich card matches (kept localized / envelope-free).
        let fallbackMarkdown: string | undefined;
        if (data.content?.[0]?.text) {
            const textContent = data.content[0].text;
            // Old tools: pure JSON payload.
            try {
                actualData = JSON.parse(textContent);
            } catch {
                // Consolidated tools: rich markdown + embedded TAG_JSON envelope.
                const embedded = extractEnvelopeJson(textContent);
                if (embedded && typeof embedded === 'object') {
                    actualData = embedded;
                    fallbackMarkdown = stripEnvelope(textContent);
                } else {
                    // Genuinely pre-formatted text (e.g. combat responses with emojis).
                    const cleanedText = processFormattedCombatResponse(textContent);
                    return { markdown: cleanedText };
                }
            }
        }

        // World tools - return rich visualization data
        if (toolName === 'list_worlds' || actualData.worlds) {
            return formatWorldList(actualData);
        }

        if (toolName === 'get_world' || toolName === 'create_world' ||
            (actualData.name && actualData.seed && actualData.width)) {
            return formatWorld(actualData);
        }

        if (toolName === 'get_world_map_overview' || actualData.biomeDistribution) {
            return formatWorldMapOverview(actualData);
        }

        if (toolName === 'get_region_map' || (actualData.region && (actualData.tiles || actualData.structures))) {
            return formatRegion(actualData);
        }

        // Nation/Strategy tools
        if (toolName === 'create_nation' || toolName === 'get_nation_state' ||
            (actualData.name && actualData.ideology && actualData.gdp !== undefined)) {
            return formatNation(actualData);
        }

        if (toolName === 'get_strategy_state' || (actualData.nations && actualData.regions)) {
            return formatStrategyState(actualData);
        }

        // No rich card matched: show the envelope-stripped engine markdown if we had
        // one (so the raw <!-- …_JSON --> comment is gone), else the text formatters.
        if (fallbackMarkdown !== undefined) {
            return { markdown: fallbackMarkdown };
        }
        const markdown = formatToolResponse(toolName, response);
        return { markdown };

    } catch (e) {
        const markdown = typeof response === 'string' ? response : JSON.stringify(response, null, 2);
        return { markdown };
    }
}

/**
 * Auto-detect response type and format accordingly
 */
export function formatToolResponse(toolName: string, response: any): string {
    try {
        // Parse if string
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        
        // Extract from MCP wrapper if present
        let actualData = data;
        if (data.content?.[0]?.text) {
            const textContent = data.content[0].text;
            // Try to parse as JSON, but if it fails, treat as pre-formatted text
            try {
                actualData = JSON.parse(textContent);
            } catch {
                // Text is already formatted (e.g., combat responses with emojis)
                // Process any embedded STATE_JSON and strip it from display
                return processFormattedCombatResponse(textContent);
            }
        }

        // Detect and format based on tool name or data structure
        if (toolName === 'list_characters' || actualData.characters) {
            return formatCharacterList(actualData);
        }

        if (toolName === 'get_character' && actualData.name) {
            return formatCharacter(actualData);
        }

        // Item tools
        if (toolName === 'get_item' || (actualData.item && !actualData.items)) {
            return formatItem(actualData);
        }

        if (toolName === 'list_items' || toolName === 'search_items') {
            return formatItemList(actualData);
        }

        if (toolName === 'transfer_item' && actualData.from && actualData.to) {
            return formatTransfer(actualData);
        }

        if (toolName === 'use_item' && actualData.consumed) {
            return formatUseItem(actualData);
        }

        if (toolName === 'get_inventory_detailed' && actualData.totalWeight !== undefined) {
            return formatInventoryDetailed(actualData);
        }

        // Standard inventory (items array with itemId fields, not full item objects)
        if (toolName === 'get_inventory' || (actualData.items && actualData.items[0]?.itemId)) {
            return formatInventory(actualData);
        }

        // Detailed inventory (items array with full item objects)
        if (actualData.items && actualData.items[0]?.item) {
            return formatInventoryDetailed(actualData);
        }

        if (toolName === 'get_quest_log' || actualData.quests) {
            return formatQuestLog(actualData);
        }

        if (toolName === 'get_encounter_state' || actualData.participants) {
            return formatEncounter(actualData);
        }

        // Secret Keeper tools - redact sensitive information
        if (toolName === 'create_secret' || (actualData.secret && actualData.warning)) {
            return formatCreateSecret(actualData);
        }

        if (toolName === 'get_secret' || (actualData.secretDescription && !actualData.secrets)) {
            return formatGetSecret(actualData);
        }

        if (toolName === 'list_secrets' || actualData.secretsByType) {
            return formatListSecrets(actualData);
        }

        if (toolName === 'get_secrets_for_context' || actualData.context?.includes('DO NOT REVEAL')) {
            return formatSecretsForContext(actualData);
        }

        if (toolName === 'check_for_leaks' || actualData.leaks !== undefined) {
            return formatCheckForLeaks(actualData);
        }

        if (toolName === 'check_reveal_conditions' || actualData.secretsToReveal) {
            return formatCheckRevealConditions(actualData);
        }

        if (toolName === 'reveal_secret' || actualData.spoilerMarkdown || actualData.message?.includes('revealed')) {
            return formatRevealSecret(actualData);
        }

        if (toolName === 'update_secret' && actualData.secret) {
            return formatUpdateSecret(actualData);
        }

        if (toolName === 'delete_secret') {
            return formatDeleteSecret(actualData);
        }

        // Fallback: pretty-print JSON
        return `\`\`\`json\n${JSON.stringify(actualData, null, 2)}\n\`\`\``;

    } catch (e) {
        // If parsing fails, return as-is
        return typeof response === 'string' ? response : JSON.stringify(response, null, 2);
    }
}

/**
 * Helper: Calculate D&D ability modifier
 */
function formatModifier(score: number): string {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Helper: Get emoji icon for item type
 */
function getItemIcon(type: string): string {
    const icons: Record<string, string> = {
        weapon: '⚔️',
        armor: '🛡️',
        consumable: '🧪',
        quest: '📜',
        artifact: '💎',
        tool: '🔧',
        misc: '📦',
    };
    return icons[type.toLowerCase()] || '📦';
}

/**
 * Helper: Guess item name from UUID (used when item details aren't available)
 */
function guessItemName(itemId: string): string {
    // Known LOTR items by UUID prefix (from the Fellowship setup)
    const knownItems: Record<string, string> = {
        '46575824': '💍 Единое Кольцо',
        '6d0b75e2': '🗡️ Жало',
        '7d83ac9a': '🛡️ Мифрильная кольчуга',
    };

    const prefix = itemId.substring(0, 8);
    if (knownItems[prefix]) {
        return knownItems[prefix];
    }

    return `Предмет ${prefix}`;
}

// ============================================================================
// SECRET KEEPER FORMATTERS - Redact sensitive information from tool responses
// ============================================================================

/**
 * Format create_secret response - hide the actual secret content
 */
export function formatCreateSecret(data: any): string {
    const secret = data.secret || data;

    let markdown = `## 🔒 Секрет создан\n\n`;
    markdown += `**Название:** ${secret.name}\n`;
    markdown += `**Тип:** ${formatKnownLabel(secret.type, SECRET_TYPE_LABELS)} (${formatKnownLabel(secret.category || 'general', SECRET_TYPE_LABELS)})\n`;
    markdown += `**Чувствительность:** ${secret.sensitivity?.toUpperCase() || 'СРЕДНЯЯ'}\n\n`;

    markdown += `> Секрет успешно зарегистрирован и скрыт от игрока.\n\n`;

    // Censor the actual secret content
    markdown += `[censor]`;
    markdown += `ID: ${secret.id}\n`;
    markdown += `Секрет: ${secret.secretDescription}\n`;
    if (secret.leakPatterns?.length) {
        markdown += `Паттерны утечек: ${secret.leakPatterns.join(', ')}\n`;
    }
    markdown += `[/censor]`;

    if (data.warning) {
        markdown += `\n\n⚠️ *${data.warning}*`;
    }

    return markdown;
}

/**
 * Format get_secret response - fully censor for player safety
 */
export function formatGetSecret(data: any): string {
    const secret = data.secret || data;

    let markdown = `## 🔒 Детали секрета\n\n`;
    markdown += `**Название:** ${secret.name}\n`;
    markdown += `**Тип:** ${formatKnownLabel(secret.type, SECRET_TYPE_LABELS)}\n`;
    markdown += `**Статус:** ${secret.revealed ? '🔓 раскрыт' : '🔒 скрыт'}\n\n`;

    // Everything sensitive goes in censor block
    markdown += `[censor]`;
    markdown += `ID: ${secret.id}\n`;
    markdown += `Публичное описание: ${secret.publicDescription}\n`;
    markdown += `Секрет: ${secret.secretDescription}\n`;
    markdown += `Чувствительность: ${secret.sensitivity}\n`;
    if (secret.leakPatterns?.length) {
        markdown += `Паттерны утечек: ${secret.leakPatterns.join(', ')}\n`;
    }
    if (secret.revealConditions?.length) {
        markdown += `Условия раскрытия: ${JSON.stringify(secret.revealConditions)}\n`;
    }
    if (secret.revealed) {
        markdown += `Раскрыт в: ${secret.revealedAt}\n`;
        markdown += `Раскрыл: ${secret.revealedBy}\n`;
    }
    markdown += `[/censor]`;

    return markdown;
}

/**
 * Format list_secrets response - show summary, hide details
 */
export function formatListSecrets(data: any): string {
    const secrets = data.secrets || [];
    const count = data.count || secrets.length;

    let markdown = `## 🔒 Реестр секретов (${count})\n\n`;

    if (secrets.length === 0) {
        return markdown + `> Для этого мира секреты не найдены.`;
    }

    // Group by type if available
    const byType = data.secretsByType || {};

    if (Object.keys(byType).length > 0) {
        for (const [type, typeSecrets] of Object.entries(byType)) {
            const items = typeSecrets as any[];
            markdown += `### ${getSecretTypeIcon(type)} ${formatKnownLabel(type, SECRET_TYPE_LABELS)} (${items.length})\n\n`;

            items.forEach((s: any) => {
                const status = s.revealed ? '🔓' : '🔒';
                markdown += `- ${status} **${s.name}** [censor](${s.id?.substring(0, 8)})[/censor]\n`;
            });
            markdown += `\n`;
        }
    } else {
        secrets.forEach((s: any) => {
            const status = s.revealed ? '🔓' : '🔒';
            const icon = getSecretTypeIcon(s.type);
            markdown += `- ${status} ${icon} **${s.name}** - ${formatKnownLabel(s.type, SECRET_TYPE_LABELS)} [censor](${s.id?.substring(0, 8)})[/censor]\n`;
        });
    }

    // Stats summary
    const revealed = secrets.filter((s: any) => s.revealed).length;
    const hidden = count - revealed;
    markdown += `\n---\n`;
    markdown += `**Статистика:** скрыто ${hidden}, раскрыто ${revealed}\n`;

    return markdown;
}

/**
 * Format get_secrets_for_context - FULLY CENSOR (this is LLM-only context)
 */
export function formatSecretsForContext(data: any): string {
    let markdown = `## 🔒 Контекст секретов загружен\n\n`;
    markdown += `**Загружено секретов:** ${data.secretCount || 0}\n`;
    markdown += `**Мир:** [censor]${data.worldId}[/censor]\n\n`;

    markdown += `> Контекст добавлен в системную подсказку модели.\n\n`;

    // The entire context is DM-only
    markdown += `[censor]`;
    markdown += `--- ПОЛНЫЙ КОНТЕКСТ СЕКРЕТОВ (ТОЛЬКО ДЛЯ МАСТЕРА) ---\n`;
    markdown += data.context || 'Контекст недоступен';
    markdown += `\n--- КОНЕЦ КОНТЕКСТА СЕКРЕТОВ ---`;
    markdown += `[/censor]`;

    return markdown;
}

/**
 * Format check_for_leaks response - show leak detection results
 */
export function formatCheckForLeaks(data: any): string {
    let markdown = `## 🔍 Проверка утечек\n\n`;

    if (data.clean) {
        markdown += `✅ **Утечки не обнаружены**\n\n`;
        markdown += `> Текст безопасно показывать игроку.`;
        return markdown;
    }

    markdown += `⚠️ **Найдены возможные утечки: ${data.leaks?.length || 0}**\n\n`;

    if (data.leaks?.length) {
        markdown += `| Секрет | Паттерн | Критичность |\n`;
        markdown += `|--------|---------|----------|\n`;

        data.leaks.forEach((leak: any) => {
            markdown += `| [censor]${leak.secretName}[/censor] | \`${leak.pattern}\` | ${formatKnownLabel(leak.severity, SEVERITY_LABELS)} |\n`;
        });
        markdown += `\n`;
    }

    if (data.recommendation) {
        markdown += `> 💡 ${data.recommendation}`;
    }

    return markdown;
}

/**
 * Format check_reveal_conditions response
 */
export function formatCheckRevealConditions(data: any): string {
    let markdown = `## 🎯 Проверка условий раскрытия\n\n`;

    const toReveal = data.secretsToReveal || [];

    if (toReveal.length === 0) {
        markdown += `> Это событие не раскрывает секреты.\n`;
        return markdown;
    }

    markdown += `**Готово к раскрытию секретов:** ${toReveal.length}\n\n`;

    toReveal.forEach((s: any) => {
        markdown += `### 🔓 ${s.name}\n`;
        markdown += `- Тип: ${formatKnownLabel(s.type, SECRET_TYPE_LABELS)}\n`;
        markdown += `- [censor]Секрет: ${s.secretDescription}[/censor]\n`;

        if (s.matchedConditions?.length) {
            markdown += `- Сработало: ${s.matchedConditions.map((c: any) => formatKnownLabel(c.type, REVEAL_CONDITION_LABELS)).join(', ')}\n`;
        }
        markdown += `\n`;
    });

    if (data.instruction) {
        markdown += `> 💡 ${data.instruction}`;
    }

    return markdown;
}

/**
 * Format reveal_secret response - show the spoiler markdown for player
 */
export function formatRevealSecret(data: any): string {
    // If already revealed, show that message
    if (data.message?.includes('already revealed')) {
        let markdown = `## 🔓 Секрет уже раскрыт\n\n`;
        markdown += `> Этот секрет уже был раскрыт.\n\n`;
        markdown += `[censor]`;
        markdown += `Раскрыт в: ${data.revealedAt}\n`;
        markdown += `Раскрыл: ${data.revealedBy}`;
        markdown += `[/censor]`;
        return markdown;
    }

    let markdown = `## 🔮 Секрет раскрыт!\n\n`;

    if (data.partial) {
        markdown += `*Частичное раскрытие — только намек*\n\n`;
    }

    markdown += `**Сработало от:** ${data.triggeredBy}\n\n`;

    // The spoilerMarkdown is safe to show - it's designed for player viewing
    if (data.spoilerMarkdown) {
        markdown += `---\n\n`;
        markdown += data.spoilerMarkdown;
        markdown += `\n\n---\n`;
    }

    // Narration is also safe
    if (data.narration && !data.spoilerMarkdown) {
        markdown += `> ${data.narration}\n\n`;
    }

    // DM-only details
    markdown += `\n[censor]`;
    markdown += `ID секрета: ${data.secret?.id}\n`;
    markdown += `Полный секрет: ${data.secret?.secretDescription}`;
    markdown += `[/censor]`;

    return markdown;
}

/**
 * Format update_secret response
 */
export function formatUpdateSecret(data: any): string {
    let markdown = `## 🔒 Секрет обновлен\n\n`;
    markdown += `✅ ${data.message || 'Секрет успешно обновлен'}\n\n`;

    if (data.secret) {
        markdown += `**Название:** ${data.secret.name}\n`;
        markdown += `**Тип:** ${formatKnownLabel(data.secret.type, SECRET_TYPE_LABELS)}\n\n`;

        markdown += `[censor]`;
        markdown += `ID: ${data.secret.id}\n`;
        markdown += `Обновленные поля сохранены в базе`;
        markdown += `[/censor]`;
    }

    return markdown;
}

/**
 * Format delete_secret response
 */
export function formatDeleteSecret(data: any): string {
    let markdown = `## 🗑️ Секрет удален\n\n`;
    markdown += `✅ ${data.message || 'Секрет удален из базы'}\n\n`;

    markdown += `[censor]ID секрета: ${data.secretId || 'неизвестно'}[/censor]`;

    return markdown;
}

/**
 * Helper: Get icon for secret type
 */
function getSecretTypeIcon(type: string): string {
    const icons: Record<string, string> = {
        npc: '👤',
        location: '📍',
        item: '📦',
        quest: '📜',
        plot: '🎭',
        mechanic: '⚙️',
        custom: '✨',
    };
    return icons[type?.toLowerCase()] || '🔒';
}

// ============================================================================
// COMBAT TOOL FORMATTERS - Rich output for LLM action guidance
// These formatters provide clear, actionable context to help the LLM
// understand combat state and what actions to take next.
// ============================================================================

/**
 * Format create_encounter response with clear next steps
 */
export function formatCreateEncounter(data: any): string {
    const encounterId = data.encounterId || data.encounter?.id;
    const participants = data.participants || data.encounter?.participants || [];

    let output = `⚔️ БОЕВАЯ СХВАТКА НАЧАЛАСЬ!\n`;
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    output += `ID схватки: ${encounterId}\n\n`;

    if (participants.length > 0) {
        output += `📋 ПОРЯДОК ИНИЦИАТИВЫ:\n`;
        const sorted = [...participants].sort((a: any, b: any) => (b.initiative || 0) - (a.initiative || 0));
        sorted.forEach((p: any, i: number) => {
            const hpStatus = p.hp <= 0 ? '💀' : p.hp < (p.maxHp || p.hp) / 2 ? '🩹' : '💚';
            const turnMarker = i === 0 ? '👉 ' : '   ';
            output += `${turnMarker}${i + 1}. ${p.name} ${hpStatus} (Иниц.: ${p.initiative || 0}, ОЗ: ${p.hp}/${p.maxHp || p.hp})\n`;
        });
        output += `\n`;
    }

    output += `⚡ СЛЕДУЮЩИЙ ШАГ: проверь чей ход через get_encounter_state, затем:\n`;
    output += `   - Если ход врага: используй execute_combat_action, затем advance_turn\n`;
    output += `   - Если ход игрока: предложи варианты и дождись ввода\n`;

    return output;
}

/**
 * Format get_encounter_state response with clear turn indicator
 */
export function formatGetEncounterState(data: any): string {
    const round = data.round || 1;
    const currentTurn = data.currentTurn || {};
    const participants = data.participants || [];
    const currentIndex = data.currentTurnIndex ?? 0;

    // Find current participant
    const currentParticipant = participants[currentIndex] ||
        participants.find((p: any) => p.id === currentTurn.participantId) ||
        participants[0];

    const isEnemy = currentParticipant?.isEnemy ??
        currentParticipant?.type === 'enemy' ??
        !currentParticipant?.name?.toLowerCase().includes('player');

    let output = `⚔️ СТАТУС БОЯ — РАУНД ${round}\n`;
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Current turn indicator - very prominent
    if (currentParticipant) {
        const icon = isEnemy ? '👹' : '🧙';
        output += `${icon} ТЕКУЩИЙ ХОД: ${currentParticipant.name?.toUpperCase()}\n`;
        output += `   ОЗ: ${currentParticipant.hp}/${currentParticipant.maxHp || currentParticipant.hp}`;
        if (currentParticipant.ac) output += ` | КД: ${currentParticipant.ac}`;
        output += `\n\n`;
    }

    // Initiative order
    output += `📋 ПОРЯДОК ИНИЦИАТИВЫ:\n`;
    participants.forEach((p: any, i: number) => {
        const isCurrent = i === currentIndex || p.id === currentTurn.participantId;
        const hpStatus = p.hp <= 0 ? '💀 МЕРТВ' : p.hp < (p.maxHp || p.hp) / 2 ? '🩹 Ранен' : '💚';
        const marker = isCurrent ? '👉 ' : '   ';
        const enemyTag = (p.isEnemy || p.type === 'enemy') ? '[ВРАГ]' : '[СОЮЗНИК]';
        output += `${marker}${i + 1}. ${p.name} ${hpStatus} ${enemyTag}\n`;
    });
    output += `\n`;

    // Clear action guidance
    if (isEnemy && currentParticipant) {
        output += `⚡ ТРЕБУЕТСЯ ДЕЙСТВИЕ: сейчас ход врага!\n`;
        output += `   1. Драматично опиши действие ${currentParticipant.name}\n`;
        output += `   2. Вызови execute_combat_action (attack/ability/move)\n`;
        output += `   3. Вызови advance_turn для продолжения\n`;
        output += `   Не спрашивай разрешения — выполни действие врага сейчас!\n`;
    } else {
        output += `⏳ ХОД ИГРОКА: предложи варианты и дождись ввода игрока.\n`;
        output += `   После выбора игрока: execute_combat_action, затем advance_turn\n`;
    }

    return output;
}

/**
 * Format execute_combat_action response with damage results
 */
export function formatExecuteCombatAction(data: any): string {
    let output = `\n`;

    // Determine action type and result
    const actionType = data.actionType || data.action?.type || 'action';
    const success = data.success ?? data.hit ?? true;
    const damage = data.damage ?? data.totalDamage ?? 0;
    const targetName = data.targetName || data.target?.name || 'цель';
    const attackerName = data.attackerName || data.attacker?.name || 'атакующий';

    if (actionType === 'attack' || data.hit !== undefined) {
        if (success || data.hit) {
            output += `🎯 ПОПАДАНИЕ! ${attackerName} бьет ${targetName}!\n`;
            if (damage > 0) {
                output += `💥 УРОН: ${damage} ед.\n`;
            }
        } else {
            output += `❌ ПРОМАХ! Атака ${attackerName} не достигает цели.\n`;
        }
    } else if (actionType === 'heal' || data.healing) {
        const healing = data.healing || damage;
        output += `✨ ИСЦЕЛЕНИЕ! ${targetName} восстанавливает ${healing} ОЗ!\n`;
    } else if (actionType === 'ability' || actionType === 'spell') {
        output += `🔮 ${attackerName} использует ${data.abilityName || 'умение'}!\n`;
        if (data.effect) output += `   Эффект: ${data.effect}\n`;
    } else {
        output += `✅ Действие завершено: ${data.message || actionType}\n`;
    }

    // Show updated HP if available
    if (data.target?.hp !== undefined || data.targetHp !== undefined) {
        const hp = data.target?.hp ?? data.targetHp;
        const maxHp = data.target?.maxHp ?? data.targetMaxHp ?? hp;
        const hpPercent = Math.round((hp / maxHp) * 100);
        output += `   ${targetName} ОЗ: ${hp}/${maxHp} (${hpPercent}%)\n`;

        if (hp <= 0) {
            output += `💀 ${targetName} побежден!\n`;
        }
    }

    output += `\n⚡ ДАЛЬШЕ: вызови advance_turn, чтобы перейти к следующему участнику.\n`;

    return output;
}

/**
 * Format advance_turn response with next turn guidance
 */
export function formatAdvanceTurn(data: any): string {
    const nextParticipant = data.nextParticipant || data.currentParticipant || {};
    const nextName = nextParticipant.name || data.nextParticipantName || 'Неизвестно';
    const isEnemy = nextParticipant.isEnemy ?? nextParticipant.type === 'enemy' ?? false;
    const round = data.round || data.currentRound || 1;
    const newRound = data.newRound || data.roundAdvanced || false;

    let output = `\n`;

    if (newRound) {
        output += `🔄 ═══ РАУНД ${round} НАЧИНАЕТСЯ ═══\n\n`;
    }

    const icon = isEnemy ? '👹' : '🧙';
    output += `${icon} ХОД ПЕРЕДАН → ${nextName.toUpperCase()}\n`;

    if (nextParticipant.hp !== undefined) {
        output += `   ОЗ: ${nextParticipant.hp}/${nextParticipant.maxHp || nextParticipant.hp}`;
        if (nextParticipant.ac) output += ` | КД: ${nextParticipant.ac}`;
        output += `\n`;
    }

    output += `\n`;

    if (isEnemy) {
        output += `⚡ ХОД ВРАГА — ДЕЙСТВУЙ СЕЙЧАС!\n`;
        output += `   1. Отыграй действие ${nextName} с драматичным описанием\n`;
        output += `   2. Вызови execute_combat_action\n`;
        output += `   3. Вызови advance_turn\n`;
        output += `   Не жди разрешения!\n`;
    } else {
        output += `⏳ ХОД ИГРОКА\n`;
        output += `   Предложи варианты игроку и дождись решения.\n`;
    }

    return output;
}

/**
 * Format end_encounter response
 */
export function formatEndEncounter(data: any): string {
    let output = `\n`;
    output += `⚔️ ═══ БОЙ ЗАВЕРШЕН ═══\n`;
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (data.victory || data.outcome === 'victory') {
        output += `🏆 ПОБЕДА!\n`;
    } else if (data.defeat || data.outcome === 'defeat') {
        output += `💀 ПОРАЖЕНИЕ...\n`;
    } else if (data.fled || data.outcome === 'fled') {
        output += `🏃 ОТСТУПЛЕНИЕ ИЗ БОЯ\n`;
    } else {
        output += `✅ Бой завершен.\n`;
    }

    if (data.xpAwarded || data.experienceGained) {
        output += `\n🌟 Получено опыта: ${data.xpAwarded || data.experienceGained}\n`;
    }

    if (data.loot && data.loot.length > 0) {
        output += `\n📦 Найдена добыча:\n`;
        data.loot.forEach((item: any) => {
            output += `   - ${formatItemName(item)}\n`;
        });
    }

    output += `\n🎭 Продолжай описывать последствия.\n`;

    return output;
}

/**
 * Format combat tool responses for LLM consumption
 * Returns formatted string for combat tools, null for non-combat tools
 *
 * IMPORTANT: If the MCP server already returns rich formatted text,
 * we pass it through directly. We only apply frontend formatting if
 * the response is raw JSON data.
 */
export function formatCombatToolResponse(toolName: string, response: any): string | null {
    try {
        // Guard against null/undefined response
        if (response === null || response === undefined) {
            console.warn(`[formatCombatToolResponse] Received null/undefined response for ${toolName}`);
            return null;
        }

        // Parse response if string
        const data = typeof response === 'string' ? JSON.parse(response) : response;

        // Check if this is an MCP response wrapper with text content
        if (data.content?.[0]?.type === 'text' && data.content[0].text) {
            const textContent = data.content[0].text;

            // If the MCP server already returned formatted text (contains emoji/formatting),
            // pass it through directly - don't try to reformat it
            if (textContent.includes('═══') || textContent.includes('⚔️') ||
                textContent.includes('COMBAT') || textContent.includes('TURN')) {
                return processFormattedCombatResponse(textContent);
            }

            // Try to parse as JSON for further processing
            try {
                const innerData = JSON.parse(textContent);
                // Continue with formatting below using innerData
                return formatCombatData(toolName, innerData);
            } catch {
                // Not JSON, but also not our formatted text - return as-is
                return textContent;
            }
        }

        // Direct data (not in MCP wrapper)
        return formatCombatData(toolName, data);

    } catch (e) {
        console.warn('[formatCombatToolResponse] Failed to format:', e);
        return null;
    }
}

/**
 * Internal helper to format combat data
 */
function formatCombatData(toolName: string, data: any): string | null {
    // Match tool names (handle both snake_case and various naming conventions)
    const normalizedName = toolName.toLowerCase().replace(/-/g, '_');

    if (normalizedName === 'create_encounter' || normalizedName === 'start_combat') {
        return formatCreateEncounter(data);
    }

    if (normalizedName === 'get_encounter_state' || normalizedName === 'get_combat_state') {
        return formatGetEncounterState(data);
    }

    if (normalizedName === 'execute_combat_action' || normalizedName === 'combat_action') {
        return formatExecuteCombatAction(data);
    }

    if (normalizedName === 'advance_turn' || normalizedName === 'next_turn') {
        return formatAdvanceTurn(data);
    }

    if (normalizedName === 'end_encounter' || normalizedName === 'end_combat') {
        return formatEndEncounter(data);
    }

    // Not a combat tool
    return null;
}
