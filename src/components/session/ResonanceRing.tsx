import React from 'react';

interface ResonanceRingProps {
    score: number;
    color?: string; // Allow color override to support our semantic logic
    size?: number; // Keep size prop for flexibility, default to 96 (w-24)
    darkMode?: boolean;
}

// 1. RESONANCE RING (The "Calm" Halo)
// Logic: A single contained ring that breathes.
const ResonanceRing: React.FC<ResonanceRingProps> = ({
    score,
    // Default logic from user snippet if color not provided (though we usually provide it)
    color = score > 70 ? '#10b981' : score < 40 ? '#f43f5e' : '#f59e0b',
    size = 96,
    darkMode = false
}) => {
    const normalized = Math.min(100, Math.max(0, score));
    // User's duration logic
    const duration = 1 + (normalized / 100) * 4;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            {/* Fixed outer ring */}
            <div className={`absolute inset-0 rounded-full border-4 ${darkMode ? 'border-gray-700' : 'border-slate-100'}`} />

            {/* Animated breathing ring */}
            <div
                className="absolute inset-0 rounded-full border-4 opacity-80"
                style={{
                    borderColor: color,
                    animation: `breathe ${duration}s ease-in-out infinite alternate`,
                }}
            />

            {/* Inner fill */}
            <div
                className="absolute inset-[8px] rounded-full opacity-10"
                style={{ backgroundColor: color }}
            />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center">
                <span className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-slate-800'}`}>{Math.round(score)}</span>
            </div>

            <style>{`@keyframes breathe { from { transform: scale(0.95); opacity: 0.6; } to { transform: scale(1.05); opacity: 1; } }`}</style>
        </div>
    );
};

export default ResonanceRing;
