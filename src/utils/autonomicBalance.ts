const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
};

export const AUTONOMIC_BALANCE_DOMAIN: readonly [number, number] = [0, 200] as const;
export const AUTONOMIC_ACTIVITY_DOMAIN: readonly [number, number] = [0, 120] as const;

const BALANCE_CENTER = 100;
const BALANCE_DIVISOR = Math.log10(10); // ratio 10 -> +1 decade
const BALANCE_SCALE = 35; // decades * scale → index spread around center

const ACTIVITY_OFFSET = Math.log10(200); // baseline total power
const ACTIVITY_SCALE = 30; // decades * scale

export const computeAutonomicBalance = (ratio: number | null | undefined): number | null => {
  if (ratio === null || ratio === undefined || ratio <= 0 || Number.isNaN(ratio)) {
    return null;
  }

  const logRatio = Math.log10(ratio);
  const normalized = BALANCE_CENTER + (logRatio / BALANCE_DIVISOR) * BALANCE_SCALE;
  return Number(clamp(normalized, AUTONOMIC_BALANCE_DOMAIN[0], AUTONOMIC_BALANCE_DOMAIN[1]).toFixed(1));
};

export const computeAutonomicActivity = (totalPower: number | null | undefined): number | null => {
  if (totalPower === null || totalPower === undefined || totalPower <= 0 || Number.isNaN(totalPower)) {
    return null;
  }

  const logPower = Math.log10(totalPower);
  const normalized = (logPower - ACTIVITY_OFFSET) * ACTIVITY_SCALE + 80;
  return Number(clamp(normalized, AUTONOMIC_ACTIVITY_DOMAIN[0], AUTONOMIC_ACTIVITY_DOMAIN[1]).toFixed(1));
};

export const classifyAutonomicZone = (balance: number | null, activity: number | null) => {
  if (balance === null || activity === null) {
    return {
      key: 'unknown',
      name: 'Insufficient Data',
      color: '#94a3b8',
      description: 'Not enough information to estimate autonomic balance.',
    } as const;
  }

  // --- Visual Z5 Box (from your coordinates) ---
  if (balance >= 75 && balance <= 125 && activity >= 80 && activity <= 112) {
    return {
      key: 'zone5',
      name: 'Zone 5: Optimal',
      color: '#22c55e',
      description: 'Balanced autonomic tone with strong activity – resilient state.',
    } as const;
  }

  // --- Visual Quadrants (divided by 100 and 68) ---

  // Z1: Top-Left (Stressed / Sympathetic High)
  if (balance < 100 && activity > 68) {
    return {
      key: 'zone1',
      name: 'Zone 1: Stressed',
      color: '#fb923c', // Stress color
      description: 'Sympathetic dominant with elevated activity – active stress response.',
    } as const;
  }

  // Z2: Top-Right (High Activity / Parasympathetic Leaning)
  // Your dot at (128, 120) will now fall here.
  if (balance > 100 && activity > 68) {
    return {
      key: 'zone2',
      name: 'Zone 2: High Activity',
      color: '#0ea5e9', // Transitional color
      description: 'Parasympathetic leaning but with very high activity. A transitional or mixed state.',
    } as const;
  }

  // Z3: Bottom-Left (Exhausted / Sympathetic Low)
  if (balance < 100 && activity <= 68) {
    return {
      key: 'zone3',
      name: 'Zone 3: Exhausted',
      color: '#facc15', // Exhausted color
      description: 'Sympathetic leaning with low activity – depleted energy reserves.',
    } as const;
  }
  
  // Z4: Bottom-Right (Depleted / Parasympathetic Low)
  if (balance > 100 && activity <= 68) {
    return {
      key: 'zone4',
      name: 'Zone 4: Depleted',
      color: '#b91c1c', // Depleted color
      description: 'Minimal autonomic activity – severe depletion and poor adaptability.',
    } as const;
  }

  // Fallback (shouldn't be hit, but good practice)
  return {
    key: 'transitional',
    name: 'Transitional Zone',
    color: '#0ea5e9',
    description: 'Adaptive shift between sympathetic and parasympathetic states.',
  } as const;
};

