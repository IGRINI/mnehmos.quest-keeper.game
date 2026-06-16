import React, { useState } from 'react';
import { useUIStore, ActiveTab } from '../../stores/uiStore';

export const NavBar: React.FC = () => {
    const { activeTab, setActiveTab, setPendingCommand } = useUIStore();
    const [isExpanded, setIsExpanded] = useState(true);

    const navItems: Array<{ tab: ActiveTab; icon: string; label: string }> = [
        { tab: 'adventure', icon: '📜', label: 'Приключение' },
        { tab: 'combat', icon: '⚔️', label: 'Бой' },
        { tab: 'character', icon: '👤', label: 'Персонаж' },
        { tab: 'map', icon: '🗺️', label: 'Карта мира' },
        { tab: 'journal', icon: '📓', label: 'Журнал' },
        { tab: 'skills', icon: '✨', label: 'Навыки' },
        { tab: 'chains', icon: '🔗', label: 'Цепочки' },
        { tab: 'achievements', icon: '🏆', label: 'Достижения' },
        { tab: 'reputation', icon: '🤝', label: 'Репутация' },
        { tab: 'workflows', icon: '🔁', label: 'Сценарии' },
    ];

    const quickCommands: Array<{ command: string; icon: string; label: string }> = [
        { command: '/character', icon: '👤', label: 'Персонаж' },
        { command: '/inventory', icon: '🎒', label: 'Инвентарь' },
        { command: '/roll 1d20', icon: '🎲', label: 'Бросок к20' },
        { command: '/quests', icon: '📋', label: 'Квесты' },
        { command: '/help', icon: '❓', label: 'Помощь' },
    ];

    const NavItem = ({ tab, icon, label }: { tab: ActiveTab; icon: string; label: string }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`
        w-full flex items-center py-2 transition-all duration-200
        ${isExpanded ? 'justify-center gap-3 px-4 md:justify-start' : 'justify-center px-2'}
        ${activeTab === tab
                    ? 'bg-terminal-green/10 text-terminal-green border-r-2 border-terminal-green'
                    : 'text-terminal-green/60 hover:text-terminal-green hover:bg-terminal-green/5 border-r-2 border-transparent'}
      `}
            title={label}
        >
            <span className="text-xl shrink-0">{icon}</span>
            <span className={`font-mono text-sm uppercase tracking-wider ${isExpanded ? 'hidden md:block' : 'hidden'}`}>
                {label}
            </span>
        </button>
    );

    const QuickCommand = ({ command, icon, label }: { command: string; icon: string; label: string }) => (
        <button
            onClick={() => setPendingCommand(command, true)}
            className={`w-full flex items-center py-1.5 text-terminal-green/50 hover:text-terminal-green hover:bg-terminal-green/10 transition-colors text-xs font-mono ${
                isExpanded ? 'justify-center gap-2 px-3 md:justify-start' : 'justify-center px-2'
            }`}
            title={`Выполнить: ${label}`}
        >
            <span className="text-sm shrink-0">{icon}</span>
            <span className={isExpanded ? 'hidden md:block' : 'hidden'}>{label}</span>
        </button>
    );

    return (
        <nav
            className={`h-full bg-terminal-black border-r border-terminal-green-dim flex flex-col shrink-0 z-20 overflow-hidden transition-[width] duration-300 ease-out ${
                isExpanded ? 'w-16 md:w-64' : 'w-16'
            }`}
        >
            {/* Logo Area */}
            <div
                className={`border-b border-terminal-green-dim shrink-0 flex gap-2 ${
                    isExpanded
                        ? 'p-3 flex-col items-center md:p-4 md:flex-row md:justify-between'
                        : 'p-2 flex-col items-center'
                }`}
            >
                <div className="flex min-w-0 items-center justify-center gap-2 md:justify-start">
                    <span className="text-2xl shrink-0">⚔️</span>
                    <h1 className={`font-display font-bold text-terminal-green text-glow tracking-widest ${isExpanded ? 'hidden md:block' : 'hidden'}`}>
                        ХРАНИТЕЛЬ<br />КВЕСТОВ
                    </h1>
                </div>
                <button
                    onClick={() => setIsExpanded((value) => !value)}
                    className="w-8 h-8 flex shrink-0 items-center justify-center bg-terminal-green/10 border border-terminal-green-dim text-terminal-green rounded hover:bg-terminal-green/20 hover:text-terminal-green-bright transition-colors"
                    title={isExpanded ? 'Свернуть левую панель' : 'Развернуть левую панель'}
                    aria-label={isExpanded ? 'Свернуть левую панель' : 'Развернуть левую панель'}
                >
                    <span className="text-lg leading-none">{isExpanded ? '‹' : '›'}</span>
                </button>
            </div>

            {/* Navigation Items */}
            <div className="flex-1 min-h-0 flex flex-col gap-1 py-2 overflow-y-auto overscroll-contain">
                {navItems.map((item) => (
                    <NavItem key={item.tab} {...item} />
                ))}
            </div>

            <div className="shrink-0 border-t border-terminal-green-dim bg-terminal-black">
                {/* Quick Commands Divider */}
                <div className={isExpanded ? 'px-4 py-2' : 'h-2'}>
                    <span className={`text-xs text-terminal-green/40 uppercase tracking-widest ${isExpanded ? 'hidden md:block' : 'hidden'}`}>
                        Быстрые действия
                    </span>
                </div>

                {/* Quick Command Buttons */}
                <div className="flex flex-col gap-0.5 px-1 pb-2">
                    {quickCommands.map((item) => (
                        <QuickCommand key={item.command} {...item} />
                    ))}
                </div>

                {/* Bottom Actions */}
                <div className="p-2 border-t border-terminal-green-dim">
                    <NavItem tab="settings" icon="⚙️" label="Настройки" />
                </div>
            </div>
        </nav>
    );
};
