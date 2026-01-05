'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Activity, Bell } from 'lucide-react';
import { User } from '@/types';
import { UserDropdown } from './UserDropdown';
import { NotificationDropdown } from './NotificationDropdown';

interface HeaderProps {
  user: User | null;
  handleLogout: () => void;
  handleViewCalendar?: () => void;
  toggleDarkMode: () => void;
  darkMode: boolean;
  onLoginClick?: () => void;
}

interface BaselineProgress {
  uniqueDays: number;
  progress: number;
  phase: 'calibration' | 'early_baseline' | 'full_baseline';
  totalDays: number;
}

const Header: React.FC<HeaderProps> = ({
  user,
  handleLogout,
  toggleDarkMode,
  darkMode,
  onLoginClick
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [baselineProgress, setBaselineProgress] = useState<BaselineProgress | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Determine active tab based on current pathname
  const activeTab = pathname === '/calendar' ? 'calendar' : 'dashboard';

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
    setIsNotificationOpen(false); // Close notification when opening profile
  };

  const toggleNotification = () => {
    setIsNotificationOpen(!isNotificationOpen);
    setIsDropdownOpen(false); // Close profile when opening notification
  };

  // Handle tab navigation with smooth client-side routing
  const handleTabClick = (tab: 'dashboard' | 'calendar') => {
    if (tab === 'dashboard' && pathname !== '/') {
      router.push('/');
    } else if (tab === 'calendar' && pathname !== '/calendar') {
      router.push('/calendar');
    }
  };

  // Fetch baseline progress when user changes
  useEffect(() => {
    const fetchBaselineProgress = async () => {
      if (!user || user.$id === 'guest') {
        setBaselineProgress(null);
        return;
      }

      try {
        const response = await fetch(`/api/user/baseline-progress?userId=${user.$id}`);
        if (response.ok) {
          const data = await response.json();
          setBaselineProgress(data);
        }
      } catch (error) {
        console.error('Failed to fetch baseline progress:', error);
      }
    };

    fetchBaselineProgress();
  }, [user]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdowns on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const getUserInitials = () => {
    if (!user) return 'U';
    const name = user.name || user.email || 'User';
    return name.slice(0, 2).toUpperCase();
  };

  const getUserDisplayName = () => {
    if (!user) return 'User';
    return user.name || user.email?.split('@')[0] || 'User';
  };

  return (
    <header className={`border-b shadow-sm transition-colors duration-300 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}>
      <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 flex items-center justify-between">
        {/* Logo */}
        <a href="/" onClick={(e) => { e.preventDefault(); router.push('/'); }} className="flex items-center space-x-3 hover:opacity-80 transition-opacity cursor-pointer">
          <div className="bg-gradient-to-br from-teal-500 to-cyan-600 p-2.5 rounded-xl shadow-lg">
            <Activity className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <h1 className={`text-2xl font-bold tracking-tight ${darkMode ? 'text-gray-100' : 'text-slate-800'}`}>HRV Monitor</h1>
        </a>

        {/* Right Side: Navigation, Notification & Profile */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {user ? (
            <>
              {/* Desktop Navigation (Segmented Control) */}
              <nav className="hidden md:flex items-center p-1 bg-slate-100/80 rounded-xl border border-slate-200/50">
                <button
                  onClick={() => handleTabClick('dashboard')}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer ${activeTab === 'dashboard'
                    ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => handleTabClick('calendar')}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer ${activeTab === 'calendar'
                    ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  Calendar
                </button>
              </nav>

              <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block"></div>

              {/* Notification Bell with Dropdown */}
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={toggleNotification}
                  className={`p-2 rounded-full transition-colors relative cursor-pointer ${isNotificationOpen
                    ? 'text-slate-700 bg-slate-100'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  <Bell size={20} />
                  <span className="absolute top-2 right-2 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
                </button>

                {isNotificationOpen && (
                  <div className="absolute right-0 top-full mt-3 origin-top-right z-50">
                    <NotificationDropdown />
                  </div>
                )}
              </div>

              <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>

              {/* Profile Dropdown Container */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={toggleDropdown}
                  className={`flex items-center space-x-3 p-1 pr-3 rounded-full transition-all border cursor-pointer ${isDropdownOpen
                    ? 'bg-slate-50 border-teal-500 ring-2 ring-teal-100'
                    : 'hover:bg-slate-50 border-transparent hover:border-slate-200'
                    }`}
                >
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-md">
                    {getUserInitials()}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-semibold text-slate-700 leading-none">{getUserDisplayName()}</p>
                    <p className="text-xs text-slate-500 leading-none mt-1">Pro Member</p>
                  </div>
                </button>

                {/* Dropdown Widget */}
                {isDropdownOpen && (
                  <div className="absolute right-0 top-full mt-3 w-80 origin-top-right z-50">
                    <UserDropdown
                      userName={getUserDisplayName()}
                      userEmail={user.email || 'user@example.com'}
                      currentDay={baselineProgress?.uniqueDays ?? 0}
                      totalDays={baselineProgress?.totalDays ?? 15}
                      onLogout={() => {
                        handleLogout();
                        setIsDropdownOpen(false);
                      }}
                      onSettingsClick={() => {
                        // TODO: Add settings handler
                        setIsDropdownOpen(false);
                      }}
                      onProfileClick={() => {
                        // TODO: Add profile handler
                        setIsDropdownOpen(false);
                      }}
                      darkMode={darkMode}
                      onToggleDarkMode={() => {
                        toggleDarkMode();
                      }}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <button
              onClick={onLoginClick || (() => { })}
              className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
