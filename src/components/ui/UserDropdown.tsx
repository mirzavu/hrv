import React from 'react';
import { Calendar, LogOut, Settings, User as UserIcon, Moon } from 'lucide-react';
import { BaselineProgress } from './BaselineProgress';

interface UserDropdownProps {
    userName?: string;
    userEmail?: string;
    currentDay?: number;
    totalDays?: number;
    onCalendarClick?: () => void;
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
    onCalendarClick,
    onLogout,
    onSettingsClick,
    onProfileClick,
    darkMode = false,
    onToggleDarkMode,
}) => {
    return (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-100">

            {/* Header Section */}
            <div className="px-5 py-4 border-b border-slate-50 bg-gradient-to-b from-white to-slate-50/50">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">My Account</p>
                    <button
                        onClick={onSettingsClick}
                        className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                        <Settings size={16} />
                    </button>
                </div>
                <div className="mt-2 flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-md border-2 border-white">
                        {userName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-800">{userName}</p>
                        <p className="text-xs text-slate-500">{userEmail}</p>
                    </div>
                </div>
            </div>

            {/* Baseline Progress Widget */}
            <div className="p-4">
                <BaselineProgress currentDay={currentDay} totalDays={totalDays} />
            </div>

            {/* Menu Items */}
            <div className="px-2 pb-2">
                <div className="space-y-1">
                    <button
                        onClick={onCalendarClick}
                        className="w-full flex items-center space-x-3 px-3 py-2.5 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-50 hover:text-teal-600 transition-colors group cursor-pointer"
                    >
                        <Calendar size={18} className="text-slate-400 group-hover:text-teal-500 transition-colors" />
                        <span>Calendar</span>
                    </button>

                    <button
                        onClick={onProfileClick}
                        className="w-full flex items-center space-x-3 px-3 py-2.5 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-50 hover:text-indigo-600 transition-colors group cursor-pointer"
                    >
                        <UserIcon size={18} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                        <span>Profile Details</span>
                    </button>

                    <button
                        onClick={onToggleDarkMode}
                        className="w-full flex items-center space-x-3 px-3 py-2.5 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors group cursor-pointer"
                    >
                        <Moon size={18} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                        <span>Dark Mode</span>
                        <div className={`ml-auto w-8 h-4 rounded-full relative transition-colors ${darkMode ? 'bg-teal-500' : 'bg-slate-200 group-hover:bg-slate-300'}`}>
                            <div className={`absolute top-0.5 h-3 w-3 bg-white rounded-full shadow-sm transition-all duration-200 ${darkMode ? 'left-4' : 'left-0.5'}`}></div>
                        </div>
                    </button>
                </div>
            </div>

            {/* Footer / Logout */}
            <div className="p-2 border-t border-slate-100 mt-1">
                <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                >
                    <LogOut size={16} />
                    <span>Log out</span>
                </button>
            </div>
        </div>
    );
};
