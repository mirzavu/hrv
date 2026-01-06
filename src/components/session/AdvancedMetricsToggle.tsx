import React from 'react';

export type ToggleVariant = 'pro' | 'refined' | 'technical';

interface AdvancedMetricsToggleProps {
    isOpen: boolean;
    onClick: () => void;
    variant?: ToggleVariant;
    darkMode?: boolean;
}

const AdvancedMetricsToggle: React.FC<AdvancedMetricsToggleProps> = ({ isOpen, onClick, variant = 'refined', darkMode = false }) => {
    // Variant 1: Pro Console (Clean, Professional, High Contrast)
    if (variant === 'pro') {
        return (
            <div className="w-full mt-8">
                <button
                    onClick={onClick}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-300 shadow-sm
            ${isOpen
                            ? (darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-slate-900 border-slate-800 text-white')
                            : (darkMode ? 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300')
                        }
          `}
                >
                    <div className="flex items-center gap-4 text-left">
                        <div className={`p-2 rounded-lg ${isOpen ? 'bg-indigo-500 text-white' : (darkMode ? 'bg-gray-700 text-gray-400' : 'bg-slate-100 text-slate-500')}`}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
                        </div>
                        <div>
                            <p className={`text-[10px] font-bold uppercase tracking-tight ${isOpen ? 'text-indigo-300' : 'text-slate-400'}`}>System Protocol</p>
                            <p className="font-mono text-sm leading-none mt-1">CORE_ANALYTICS_V2.0</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`px-2 py-1 rounded text-[10px] font-bold font-mono ${isOpen ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-50 text-emerald-600'}`}>
                            {isOpen ? 'ACCESS:ACTIVE' : 'STATUS:READY'}
                        </div>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isOpen ? 'bg-white/10 rotate-180' : (darkMode ? 'bg-gray-700' : 'bg-slate-50')}`}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m6 9 6 6 6-6" /></svg>
                        </div>
                    </div>
                </button>
            </div>
        );
    }

    // Variant 2: Refined (Modern Enterprise / SaaS Style)
    if (variant === 'refined') {
        return (
            <div className="w-full mt-8">
                <button
                    onClick={onClick}
                    className={`group w-full flex items-center justify-between p-5 rounded-2xl border transition-all duration-300 cursor-pointer
            ${isOpen
                            ? (darkMode ? 'bg-gray-800 border-indigo-900/50 shadow-sm' : 'bg-white border-indigo-200 shadow-sm')
                            : (darkMode ? 'bg-gray-800 border-gray-700 hover:border-gray-500 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm')
                        }
          `}
                >
                    <div className="flex items-center gap-5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300
              ${isOpen
                                ? 'bg-indigo-600 text-white shadow-indigo-500/30 shadow-lg'
                                : (darkMode ? 'bg-gray-700 text-gray-400 group-hover:bg-indigo-900/30 group-hover:text-indigo-400' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600')
                            }
            `}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20v-6M6 20V10M18 20V4" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <h4 className={`text-base font-bold transition-colors ${isOpen ? (darkMode ? 'text-gray-100' : 'text-slate-900') : (darkMode ? 'text-gray-300' : 'text-slate-700')}`}>Advanced Metrics</h4>
                            <p className={`text-xs font-medium mt-0.5 ${darkMode ? 'text-gray-500' : 'text-slate-400'}`}>HRV Variability, Stress Index Correlation & Neural Metrics</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex flex-col items-end">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isOpen ? 'text-indigo-600' : (darkMode ? 'text-gray-500' : 'text-slate-300')}`}>
                                {isOpen ? 'Minimize' : 'Expand Details'}
                            </span>
                            <span className={`text-xs font-semibold ${darkMode ? 'text-gray-500' : 'text-slate-500'}`}>Click here to view</span>
                        </div>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300
              ${isOpen
                                ? (darkMode ? 'bg-indigo-900/20 border-indigo-500/30 text-indigo-400 rotate-180' : 'bg-indigo-50 border-indigo-100 text-indigo-600 rotate-180')
                                : (darkMode ? 'bg-gray-700 border-gray-600 text-gray-400 group-hover:text-gray-300' : 'bg-slate-50 border-slate-100 text-slate-300 group-hover:text-slate-500')
                            }
            `}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
                        </div>
                    </div>
                </button>
            </div>
        );
    }

    // Variant 3: Technical (High-Density Structured Readout)
    return (
        <div className="w-full mt-8">
            <button
                onClick={onClick}
                className={`w-full flex items-center justify-between px-6 py-4 rounded-lg border-2 border-dashed transition-all duration-300
          ${isOpen ? 'bg-indigo-50/30 border-indigo-300' : 'bg-transparent border-slate-200 hover:border-slate-300 hover:bg-slate-50'}
        `}
            >
                <div className="flex items-center gap-8">
                    <div className="flex flex-col text-left">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Module // 04</span>
                        <div className="flex items-center gap-3">
                            <h4 className="text-sm font-black text-slate-800 tracking-tight">DATA_VISUALIZATION_ENGINE</h4>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                        </div>
                    </div>

                    <div className="hidden md:flex gap-6 border-l border-slate-200 pl-8">
                        <div className="flex flex-col text-left">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Input:</span>
                            <span className="text-[11px] font-bold text-slate-600">PCM_STREAM</span>
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Buffer:</span>
                            <span className="text-[11px] font-bold text-slate-600">1024_SAMPLES</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className={`font-bold text-[11px] px-3 py-1 rounded border transition-colors
            ${isOpen ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-500 border-slate-200'}
          `}>
                        {isOpen ? 'TERMINATE_VIEW' : 'INITIALIZE_VIEW'}
                    </div>
                    <div className={`transition-transform duration-500 ${isOpen ? 'rotate-180 text-indigo-600' : 'text-slate-300'}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m6 9 6 6 6-6" /></svg>
                    </div>
                </div>
            </button>
        </div>
    );
};

export default AdvancedMetricsToggle;
