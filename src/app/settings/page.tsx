'use client';

import React, { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { Save, Globe, User as UserIcon, Activity, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// List of common timezones
const COMMON_TIMEZONES = [
    "UTC",
    "Asia/Kolkata",
    "America/New_York",
    "America/Los_Angeles",
    "America/Chicago",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Asia/Tokyo",
    "Asia/Singapore",
    "Australia/Sydney"
];

export default function SettingsPage() {
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        weight: '',
        height: '',
        timezone: '',
        gender: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Check auth and load profile on mount
    useEffect(() => {
        const init = async () => {
            // Check if user is authenticated
            if (pb.authStore.isValid && pb.authStore.model) {
                const uid = pb.authStore.model.id;
                setUserId(uid);

                // Fetch profile data
                try {
                    const res = await fetch(`/api/user/profile?userId=${uid}`);
                    if (res.ok) {
                        const data = await res.json();
                        setFormData({
                            name: data.profile.name || '',
                            weight: data.profile.weight || '',
                            height: data.profile.height || '',
                            timezone: data.profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                            gender: data.profile.gender || ''
                        });
                    }
                } catch (err) {
                    console.error("Failed to load profile", err);
                }
            }
            setLoading(false);
        };

        init();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId) return;

        setIsSaving(true);
        setMessage(null);

        try {
            const res = await fetch('/api/user/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    updates: {
                        name: formData.name,
                        weight: formData.weight ? Number(formData.weight) : undefined,
                        height: formData.height ? Number(formData.height) : undefined,
                        timezone: formData.timezone,
                        gender: formData.gender
                    }
                })
            });

            if (!res.ok) throw new Error('Failed to update');

            setMessage({ type: 'success', text: 'Settings updated successfully!' });
        } catch (err) {
            console.error('Failed to save settings:', err);
            setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                <div className="text-slate-500 dark:text-slate-400">Loading settings...</div>
            </div>
        );
    }

    if (!userId) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                <div className="text-slate-500 dark:text-slate-400">Please log in to view settings.</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                <div className="mb-6 flex items-center gap-4">
                    <Link href="/" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition">
                        <ArrowLeft className="w-6 h-6 dark:text-slate-200" />
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8">

                    {message && (
                        <div className={`mb-6 p-4 rounded-xl ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'} border`}>
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* Section: Profile */}
                        <div>
                            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 dark:text-slate-200">
                                <UserIcon className="w-5 h-5 text-blue-500" />
                                Profile Details
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Display Name</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Gender</label>
                                    <select
                                        value={formData.gender}
                                        onChange={e => setFormData({ ...formData, gender: e.target.value })}
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                                    >
                                        <option value="">Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <hr className="border-slate-100 dark:border-slate-700" />

                        {/* Section: Metrics */}
                        <div>
                            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 dark:text-slate-200">
                                <Activity className="w-5 h-5 text-emerald-500" />
                                Body Metrics
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Weight (kg)</label>
                                    <input
                                        type="number"
                                        value={formData.weight}
                                        onChange={e => setFormData({ ...formData, weight: e.target.value })}
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Height (cm)</label>
                                    <input
                                        type="number"
                                        value={formData.height}
                                        onChange={e => setFormData({ ...formData, height: e.target.value })}
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                    />
                                </div>
                            </div>
                        </div>

                        <hr className="border-slate-100 dark:border-slate-700" />

                        {/* Section: Regional */}
                        <div>
                            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 dark:text-slate-200">
                                <Globe className="w-5 h-5 text-purple-500" />
                                Regional Settings
                            </h2>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Timezone</label>
                                <div className="relative">
                                    <select
                                        value={formData.timezone}
                                        onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none transition appearance-none"
                                    >
                                        {COMMON_TIMEZONES.map(tz => (
                                            <option key={tz} value={tz}>{tz}</option>
                                        ))}
                                        {/* Fallback if user's timezone isn't in common list */}
                                        {!COMMON_TIMEZONES.includes(formData.timezone) && formData.timezone && (
                                            <option value={formData.timezone}>{formData.timezone}</option>
                                        )}
                                    </select>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                        Used to calculate your daily readiness window (4 AM - 11 AM) and streak cutoffs.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full md:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-blue-500/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isSaving ? (
                                    <>Saving...</>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        Save Changes
                                    </>
                                )}
                            </button>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    );
}
