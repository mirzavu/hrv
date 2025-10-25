import React from 'react';
import { Activity, Calendar, LogOut, Moon } from 'lucide-react';
import { User } from '@/types';

interface HeaderProps {
  user: User | null;
  handleLogout: () => void;
  handleViewCalendar?: () => void;
  toggleDarkMode: () => void;
  darkMode: boolean;
  onLoginClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, handleLogout, handleViewCalendar, toggleDarkMode, darkMode, onLoginClick }) => {
  return (
    <header className="bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto py-4 flex items-center justify-between">
        <a href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity cursor-pointer">
          <div className="bg-gradient-to-br from-teal-500 to-cyan-600 p-2.5 rounded-xl shadow-lg">
            <Activity className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">HRV Monitor</h1>
        </a>
        <div className="flex items-center space-x-4">
          {user ? (
            <>
              <span className="text-sm text-slate-600">Hello, <span className="font-semibold text-slate-800">{user.name || user.email || 'User'}!</span></span>
              {user.$id !== 'guest' && (
                <>
                  <button
                    onClick={handleViewCalendar}
                    className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm cursor-pointer"
                  >
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Calendar
                  </button>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 inline mr-2" />
                    Logout
                  </button>
                </>
              )}
            </>
          ) : (
            <button
              onClick={onLoginClick || (() => {})}
              className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              Login
            </button>
          )}
          <button onClick={toggleDarkMode} className="p-2 text-slate-400 hover:text-amber-500 transition-colors cursor-pointer">
            <Moon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
