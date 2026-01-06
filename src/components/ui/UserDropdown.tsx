import React from 'react';
import { LogOut, Settings, User as UserIcon, Moon } from 'lucide-react';
import { BaselineProgress } from './BaselineProgress';

interface UserDropdownProps {
    userName?: string;
    userEmail?: string;
    currentDay?: number;
    totalDays?: number;
    onLogout?: () => void;
    onSettingsClick?: () => void;
    onProfileClick?: () => void;
    darkMode?: boolean;
    onToggleDarkMode?: () => void;
}

export const UserDropdown: React.FC<UserDropdownProps> = ({
    userName = 'User',
    userEmail = 'user@example.com',
    currentDay = 4,
    totalDays = 15,
    onLogout,
    onSettingsClick,
    onProfileClick,
    darkMode = false,
    onToggleDarkMode,
}) => {
    return (
        <div className={`rounded-2xl shadow-xl border overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200/80'}`}>

            {/* Header Section */}
            <div className={`px-5 py-4 border-b ${darkMode ? 'border-gray-700 bg-gradient-to-b from-gray-800 to-gray-750' : 'border-slate-50 bg-gradient-to-b from-white to-slate-50/50'}`}>
                <div className="flex items-center justify-between">
                    <p className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-slate-400'}`}>My Account</p>
                    <button
                        onClick={onSettingsClick}
                        className={`transition-colors cursor-pointer ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Settings size={16} />
                    </button>
                </div>
                <div className="mt-2 flex items-center space-x-3">
                    <div className={`h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-md border-2 ${darkMode ? 'border-gray-700' : 'border-white'}`}>
                        {userName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <p className={`text-sm font-bold ${darkMode ? 'text-gray-100' : 'text-slate-800'}`}>{userName}</p>
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}>{userEmail}</p>
                    </div>
                </div>
            </div>

            {/* Baseline Progress Widget */}
            <div className="p-4">
                <BaselineProgress currentDay={currentDay} totalDays={totalDays} darkMode={darkMode} />
            </div>

            {/* Menu Items */}
            <div className="px-2 pb-2">
                <div className="space-y-1">
                    <button
                        onClick={onProfileClick}
                        className={`w-full flex items-center space-x-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-colors group cursor-pointer ${darkMode ? 'text-gray-300 hover:bg-gray-700 hover:text-indigo-400' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'}`}
                    >
                        <UserIcon size={18} className={`transition-colors ${darkMode ? 'text-gray-500 group-hover:text-indigo-400' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                        <span>Profile Details</span>
                    </button>

                    <button
                        onClick={onToggleDarkMode}
                        className={`w-full flex items-center space-x-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-colors group cursor-pointer ${darkMode ? 'text-gray-300 hover:bg-gray-700 hover:text-gray-100' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                        <Moon size={18} className={`transition-colors ${darkMode ? 'text-gray-500 group-hover:text-gray-300' : 'text-slate-400 group-hover:text-slate-600'}`} />
                        <span>Dark Mode</span>
                        <div className={`ml-auto w-8 h-4 rounded-full relative transition-colors ${darkMode ? 'bg-teal-500' : 'bg-slate-200 group-hover:bg-slate-300'}`}>
                            <div className={`absolute top-0.5 h-3 w-3 bg-white rounded-full shadow-sm transition-all duration-200 ${darkMode ? 'left-4' : 'left-0.5'}`}></div>
                        </div>
                    </button>
                </div>
            </div>

            {/* Footer / Logout */}
            <div className={`p-2 border-t mt-1 ${darkMode ? 'border-gray-700' : 'border-slate-100'}`}>
                <button
                    onClick={onLogout}
                    className={`w-full flex items-center justify-center space-x-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors cursor-pointer ${darkMode ? 'text-rose-400 bg-rose-900/30 hover:bg-rose-900/50' : 'text-rose-600 bg-rose-50 hover:bg-rose-100'}`}
                >
                    <LogOut size={16} />
                    <span>Log out</span>
                </button>
            </div>
        </div>
    );
};
