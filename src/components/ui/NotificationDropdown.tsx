import React from 'react';
import { Heart, TrendingUp, Award, Clock, Check } from 'lucide-react';

export const NotificationDropdown: React.FC = () => {
    const notifications = [
        {
            id: 1,
            type: 'alert',
            title: 'HRV dropped significantly',
            message: 'Your HRV is 15% lower than your baseline. Consider a rest day or light recovery.',
            time: '2 hours ago',
            read: false,
        },
        {
            id: 2,
            type: 'achievement',
            title: '7-Day Tracking Streak!',
            message: 'Consistency is key! You have tracked your HRV for 7 consecutive days.',
            time: '5 hours ago',
            read: false,
        },
        {
            id: 3,
            type: 'info',
            title: 'Baseline Updated',
            message: 'Your 30-day baseline has been recalculated based on your recent sleep data.',
            time: '1 day ago',
            read: true,
        },
    ];

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-100 w-80 sm:w-96">
            <div className="px-4 py-3 border-b border-slate-50 flex justify-between items-center bg-gradient-to-b from-white to-slate-50/50">
                <h3 className="font-semibold text-slate-800 text-sm">Notifications</h3>
                <button className="text-xs font-medium text-teal-600 hover:text-teal-700 flex items-center space-x-1 transition-colors group cursor-pointer">
                    <Check size={14} className="group-hover:scale-110 transition-transform" />
                    <span>Mark all read</span>
                </button>
            </div>

            <div className="max-h-[28rem] overflow-y-auto">
                {notifications.map((notification) => (
                    <div
                        key={notification.id}
                        className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer relative group ${!notification.read ? 'bg-slate-50/40' : 'bg-white'}`}
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
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <p className={`text-sm font-bold ${!notification.read ? 'text-slate-800' : 'text-slate-600'}`}>
                                        {notification.title}
                                    </p>
                                    {!notification.read && (
                                        <span className="flex h-2 w-2 relative">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                                        </span>
                                    )}
                                </div>
                                <p className={`text-xs mt-1 leading-relaxed ${!notification.read ? 'text-slate-600' : 'text-slate-400'}`}>
                                    {notification.message}
                                </p>
                                <div className="flex items-center mt-2.5 text-xs text-slate-400 font-medium">
                                    <Clock size={12} className="mr-1" />
                                    {notification.time}
                                </div>
                            </div>
                        </div>
                        {/* Hover Indicator */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-r-full"></div>
                    </div>
                ))}
            </div>

            <div className="p-2 border-t border-slate-100 bg-slate-50/50">
                <button className="w-full py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-white rounded-xl transition-all shadow-sm hover:shadow border border-transparent hover:border-slate-200 cursor-pointer">
                    View all notifications
                </button>
            </div>
        </div>
    );
};
