import React from 'react';
import {
  CheckCircle,
  AlertTriangle,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

type SignalType = 'good' | 'warning' | 'alert' | 'info';
type TrendType = 'up' | 'down' | 'neutral';

interface Signal {
  type: SignalType;
  message: string;
}

export const getSignalIcon = (type: SignalType): React.ReactNode => {
  const iconProps = { className: 'w-5 h-5' };
  switch (type) {
    case 'good':
      return <CheckCircle {...iconProps} className="w-5 h-5 text-emerald-500" />;
    case 'warning':
      return (
        <AlertTriangle {...iconProps} className="w-5 h-5 text-amber-500" />
      );
    case 'alert':
      return <AlertTriangle {...iconProps} className="w-5 h-5 text-rose-500" />;
    case 'info':
      return <Info {...iconProps} className="w-5 h-5 text-sky-500" />;
  }
};

export const getSignalColor = (type: SignalType): string => {
  switch (type) {
    case 'good':
      return '#86efac';
    case 'warning':
      return '#fde047';
    case 'alert':
      return '#fca5a5';
    case 'info':
      return '#bedbff';
    default:
      return '#e2e8f0';
  }
};

export const getTrendIcon = (trend: TrendType): React.ReactNode => {
  const iconProps = { className: 'w-5 h-5' };
  switch (trend) {
    case 'up':
      return <TrendingUp {...iconProps} className="w-5 h-5 text-emerald-600" />;
    case 'down':
      return <TrendingDown {...iconProps} className="w-5 h-5 text-rose-600" />;
    case 'neutral':
      return <Minus {...iconProps} className="w-5 h-5 text-slate-500" />;
  }
};

export const getMetricSignal = (
  metricName: string,
  value: number | null | undefined
): Signal | undefined => {
  if (value === null || value === undefined) return undefined;

  switch (metricName) {
    case 'Session Duration':
      if (value >= 300)  // 5 minutes = ideal
        return {
          type: 'good',
          message: 'Ideal session duration for comprehensive HRV analysis.',
        };
      if (value >= 180)  // 3 minutes = acceptable but below ideal
        return {
          type: 'warning',
          message: 'Session duration below recommended minimum. For reliable HRV assessment, aim for at least 5 minutes.',
        };
      return {
        type: 'warning',
        message: 'Very short session. Minimum recommended duration is 3 minutes, ideal is 5 minutes.',
      };

    case 'Mean Heart Rate':
      if (value >= 60 && value <= 100)
        return { type: 'good', message: 'Normal resting heart rate range.' };
      if (value < 60)
        return {
          type: 'info',
          message: 'Low heart rate - common in well-trained athletes.',
        };
      return {
        type: 'warning',
        message:
          'Elevated heart rate - ensure you are well-rested during measurement.',
      };

    case 'Beats':
      if (value >= 50)
        return {
          type: 'good',
          message: 'Excellent data quality with sufficient measurement points.',
        };
      if (value >= 20)
        return { type: 'info', message: 'Good data quality for reliable analysis.' };
      return {
        type: 'warning',
        message: 'Limited data points - longer session recommended.',
      };

    case 'Session RMSSD':
      if (value >= 50)
        return {
          type: 'good',
          message: 'Excellent HRV indicating good autonomic function.',
        };
      if (value >= 30)
        return { type: 'info', message: 'Good HRV levels within normal range.' };
      if (value >= 15)
        return {
          type: 'warning',
          message: 'Moderate HRV - consider stress management techniques.',
        };
      return {
        type: 'alert',
        message: 'Low HRV detected - prioritize recovery and stress reduction.',
      };

    case 'RMSSD Change':
      if (Math.abs(value) < 5)
        return {
          type: 'good',
          message: 'Stable HRV throughout session indicates consistency.',
        };
      if (value > 0)
        return {
          type: 'info',
          message: 'HRV improved during session - positive adaptation.',
        };
      return {
        type: 'warning',
        message: 'HRV decreased during session - may indicate fatigue or stress.',
      };

    case 'Stress Index':
      if (value < 50)
        return {
          type: 'good',
          message: 'Low stress levels - excellent autonomic balance.',
        };
      if (value < 150)
        return {
          type: 'info',
          message: 'Moderate stress levels - within normal range.',
        };
      if (value < 300)
        return {
          type: 'warning',
          message: 'Elevated stress detected - consider relaxation techniques.',
        };
      return {
        type: 'alert',
        message:
          'High stress levels - prioritize recovery and stress management.',
      };

    case 'Restoration Index':
      if (value >= 70)
        return {
          type: 'good',
          message: 'Excellent restoration capacity - well-recovered state.',
        };
      if (value >= 50)
        return {
          type: 'info',
          message: 'Good restoration levels indicating adequate recovery.',
        };
      if (value >= 30)
        return {
          type: 'warning',
          message: 'Moderate restoration - ensure adequate sleep and recovery.',
        };
      return {
        type: 'alert',
        message: 'Low restoration score - prioritize rest and recovery activities.',
      };

    default:
      return { type: 'info', message: 'Metric recorded successfully.' };
  }
};

export const getTrend = (
  metricName: string,
  value: number | null | undefined
): TrendType | undefined => {
  if (value === null || value === undefined) return undefined;

  if (metricName === 'RMSSD Change') {
    if (value > 2) return 'up';
    if (value < -2) return 'down';
    return undefined; // No icon when change is minimal (between -2 and 2)
  }

  return undefined;
};