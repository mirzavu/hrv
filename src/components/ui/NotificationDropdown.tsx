import React from 'react';
import { Heart, TrendingUp, Award, Clock, Check, Trash2, X } from 'lucide-react';

export interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    created: string;
}

interface NotificationDropdownProps {
    notifications: Notification[];
    loading: boolean;
    onMarkAllRead: () => void;
    onDeleteAll: () => void;
    onDeleteOne: (id: string) => void;
    onMarkAsRead: (id: string) => void;
}

// Format relative time
const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
};

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
    notifications,
    loading,
    onMarkAllRead,
    onDeleteAll,
    onDeleteOne,
    onMarkAsRead,
}) => {
    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-100 w-80 sm:w-96">
            <div className="px-4 py-3 border-b border-slate-50 flex justify-between items-center bg-gradient-to-b from-white to-slate-50/50">
                <h3 className="font-semibold text-slate-800 text-sm">Notifications</h3>
                {unreadCount > 0 && (
                    <button
                        onClick={onMarkAllRead}
                        className="text-xs font-medium text-teal-600 hover:text-teal-700 flex items-center space-x-1 transition-colors group cursor-pointer"
                    >
                        <Check size={14} className="group-hover:scale-110 transition-transform" />
                        <span>Mark all read</span>
                    </button>
                )}
            </div>

            <div className={`${notifications.length > 3 ? 'max-h-[21rem] overflow-y-auto' : ''}`}>
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mx-auto"></div>
                        <p className="text-sm text-slate-400 mt-2">Loading...</p>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="p-8 text-center">
                        <div className="text-slate-300 mb-2">
                            <TrendingUp size={32} className="mx-auto" />
                        </div>
                        <p className="text-sm text-slate-400">No notifications yet</p>
                    </div>
                ) : (
                    notifications.map((notification) => (
                        <div
                            key={notification.id}
                            className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer relative group ${!notification.read ? 'bg-slate-50/40' : 'bg-white'}`}
                            onClick={() => !notification.read && onMarkAsRead(notification.id)}
                        >
                            <div className="flex space-x-3">
                                <div className="flex-shrink-0 mt-0.5">
                                    {notification.type === 'alert' && (
                                        <div className="p-2 bg-rose-100 text-rose-600 rounded-xl shadow-sm">
                                            <Heart size={18} />
                                        </div>
                                    )}
                                    {notification.type === 'achievement' && (
                                        <div className="p-2 bg-amber-100 text-amber-600 rounded-xl shadow-sm">
                                            <Award size={18} />
                                        </div>
                                    )}
                                    {notification.type === 'info' && (
                                        <div className="p-2 bg-blue-100 text-blue-600 rounded-xl shadow-sm">
                                            <TrendingUp size={18} />
                                        </div>
                                    )}
                                    {!['alert', 'achievement', 'info'].includes(notification.type) && (
                                        <div className="p-2 bg-slate-100 text-slate-600 rounded-xl shadow-sm">
                                            <TrendingUp size={18} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <p className={`text-sm font-bold truncate pr-2 ${!notification.read ? 'text-slate-800' : 'text-slate-600'}`}>
                                            {notification.title}
                                        </p>
                                        <div className="flex items-center gap-1">
                                            {!notification.read && (
                                                <span className="flex h-2 w-2 relative">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                                                </span>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteOne(notification.id);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-100 rounded-full transition-all"
                                                title="Delete notification"
                                            >
                                                <X size={14} className="text-rose-500" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className={`text-xs mt-1 leading-relaxed line-clamp-2 ${!notification.read ? 'text-slate-600' : 'text-slate-400'}`}>
                                        {notification.message}
                                    </p>
                                    <div className="flex items-center mt-2.5 text-xs text-slate-400 font-medium">
                                        <Clock size={12} className="mr-1" />
                                        {formatRelativeTime(notification.created)}
                                    </div>
                                </div>
                            </div>
                            {/* Hover Indicator */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-r-full"></div>
                        </div>
                    ))
                )}
            </div>

            {notifications.length > 0 && (
                <div className="p-2 border-t border-slate-100 bg-slate-50/50">
                    <button
                        onClick={onDeleteAll}
                        className="w-full py-2.5 text-sm font-semibold text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <Trash2 size={16} />
                        Delete all
                    </button>
                </div>
            )}
        </div>
    );
};
