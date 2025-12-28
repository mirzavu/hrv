import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface TrendIndicatorProps {
    trend?: 'up' | 'down' | 'neutral' | string | null; // Allow string for raw values like "+4" if we had them
    className?: string;
}

const TrendIndicator: React.FC<TrendIndicatorProps> = ({ trend, className = '' }) => {
    if (!trend) return null;

    // Map 'up'/'down' (our logic) to true/false for styling
    const isPositive = trend === 'up' || (typeof trend === 'string' && trend.startsWith('+'));
    const isNegative = trend === 'down' || (typeof trend === 'string' && trend.startsWith('-'));

    if (trend === 'neutral') {
        return (
            <div className={`flex items-center text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full ${className}`}>
                <Minus className="w-3 h-3 mr-1" />
                <span>Stable</span>
            </div>
        );
    }

    // Display text: Use "Rising"/"Falling" if strict 'up'/'down', otherwise use the value (if we passed "+4")
    const text = trend === 'up' ? 'Rising' : trend === 'down' ? 'Falling' : trend;

    return (
        <div className={`flex items-center text-xs font-medium ${isPositive ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'} px-2 py-1 rounded-full ${className}`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
            {text}
        </div>
    );
};

export default TrendIndicator;
