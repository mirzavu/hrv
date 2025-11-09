/**
 * Autonomic Interpretation Matrix: Multi-Metric HRV Logic
 * 
 * This module implements pattern matching against user baseline and population
 * references to provide personalized autonomic state interpretations.
 */

import type { UserBaseline, SessionSummary } from '@/types';

// Population reference ranges (healthy adults, age-adjusted)
export interface PopulationReference {
  rmssd: { min: number; optimal: number };
  sdnn: { min: number; optimal: number };
  lfPower: { min: number; optimal: number };
  hfPower: { min: number; optimal: number };
  lfhfRatio: { min: number; max: number; optimal: number };
  amode50: { max: number; optimal: number };
}

// Default population references (can be age/gender adjusted)
const DEFAULT_POPULATION_REF: PopulationReference = {
  rmssd: { min: 30, optimal: 50 },
  sdnn: { min: 50, optimal: 80 },
  lfPower: { min: 200, optimal: 1000 },
  hfPower: { min: 200, optimal: 1000 },
  lfhfRatio: { min: 0.5, max: 2.0, optimal: 1.0 },
  amode50: { max: 50, optimal: 20 }
};

// Threshold for "significant" change (20% by default, customizable)
const CHANGE_THRESHOLD = 0.20;

export interface MetricChange {
  metric: 'RMSSD' | 'SDNN' | 'LF' | 'HF' | 'LFHF' | 'AMo50';
  direction: '↑' | '↓' | '≈';
  percentChange: number | null;
  technicalDescription: string;
}

export interface AutonomicInterpretation {
  patternId: number;
  physiologicalState: string;
  coreInterpretation: string;
  recommendedAction: string;
  technicalChanges: MetricChange[];
  relativeToBaseline: boolean;
  relativeToPopulation: string | null;
}

/**
 * Compare a value to baseline and determine direction
 */
function compareToBaseline(
  current: number | null,
  baseline: number | null,
  threshold: number = CHANGE_THRESHOLD
): '↑' | '↓' | '≈' | null {
  if (current === null || baseline === null || baseline === 0) {
    return null;
  }

  const percentChange = (current - baseline) / baseline;
  
  if (percentChange >= threshold) return '↑';
  if (percentChange <= -threshold) return '↓';
  return '≈';
}

/**
 * Calculate percent change from baseline
 */
function calculatePercentChange(
  current: number | null,
  baseline: number | null
): number | null {
  if (current === null || baseline === null || baseline === 0) {
    return null;
  }
  return ((current - baseline) / baseline) * 100;
}

/**
 * Convert log(LF/HF) back to raw LF/HF ratio
 */
function logToRatio(logValue: number | null): number | null {
  if (logValue === null) return null;
  return Math.exp(logValue);
}

/**
 * Match pattern against interpretation matrix
 */
function matchPattern(
  rmssdDir: '↑' | '↓' | '≈' | null,
  sdnnDir: '↑' | '↓' | '≈' | null,
  lfDir: '↑' | '↓' | '≈' | null,
  hfDir: '↑' | '↓' | '≈' | null,
  lfhfDir: '↑' | '↓' | '≈' | null,
  amode50Dir: '↑' | '↓' | '≈' | null,
  lfhfRatio: number | null
): number | null {
  // Pattern matching logic based on the interpretation matrix
  // Order matters - more specific patterns first

  // Pattern 1: RMSSD↑, SDNN↑, LF↑, HF↑, LF/HF≈1, AMo50↓
  if (rmssdDir === '↑' && sdnnDir === '↑' && lfDir === '↑' && hfDir === '↑' && 
      lfhfDir === '≈' && amode50Dir === '↓' && lfhfRatio !== null && 
      lfhfRatio >= 0.8 && lfhfRatio <= 1.2) {
    return 1;
  }

  // Pattern 11: RMSSD↑↑, SDNN↑↑, LF↑, HF↑, LF/HF≈1, AMo50↓ (high flux)
  if (rmssdDir === '↑' && sdnnDir === '↑' && lfDir === '↑' && hfDir === '↑' && 
      lfhfDir === '≈' && amode50Dir === '↓') {
    return 11;
  }

  // Pattern 15: RMSSD↑↑, SDNN↑↑, LF↓, HF↑↑, LF/HF<0.5, AMo50↓↓
  if (rmssdDir === '↑' && sdnnDir === '↑' && lfDir === '↓' && hfDir === '↑' && 
      lfhfDir === '↓' && amode50Dir === '↓' && lfhfRatio !== null && lfhfRatio < 0.5) {
    return 15;
  }

  // Pattern 20: RMSSD↑, SDNN↑, LF↓, HF↑, LF/HF<1, AMo50↓
  if (rmssdDir === '↑' && sdnnDir === '↑' && lfDir === '↓' && hfDir === '↑' && 
      lfhfDir === '↓' && amode50Dir === '↓') {
    return 20;
  }

  // Pattern 2: RMSSD↑, SDNN≈, LF≈, HF↑, LF/HF↓, AMo50↓
  if (rmssdDir === '↑' && sdnnDir === '≈' && lfDir === '≈' && hfDir === '↑' && 
      lfhfDir === '↓' && amode50Dir === '↓') {
    return 2;
  }

  // Pattern 3: RMSSD↑, SDNN↓, HF↑, LF↓, LF/HF<<1, AMo50↓
  if (rmssdDir === '↑' && sdnnDir === '↓' && hfDir === '↑' && lfDir === '↓' && 
      lfhfDir === '↓' && amode50Dir === '↓' && lfhfRatio !== null && lfhfRatio < 0.5) {
    return 3;
  }

  // Pattern 4: RMSSD≈, SDNN↑, LF↑, HF↑, LF/HF≈1, AMo50≈
  if (rmssdDir === '≈' && sdnnDir === '↑' && lfDir === '↑' && hfDir === '↑' && 
      lfhfDir === '≈' && amode50Dir === '≈' && lfhfRatio !== null && 
      lfhfRatio >= 0.8 && lfhfRatio <= 1.2) {
    return 4;
  }

  // Pattern 5: RMSSD≈, SDNN≈, LF≈, HF≈, LF/HF≈1, AMo50≈
  if (rmssdDir === '≈' && sdnnDir === '≈' && lfDir === '≈' && hfDir === '≈' && 
      lfhfDir === '≈' && amode50Dir === '≈') {
    return 5;
  }

  // Pattern 6: RMSSD≈, SDNN↓, LF↓, HF↓, LF/HF≈1, AMo50↑
  if (rmssdDir === '≈' && sdnnDir === '↓' && lfDir === '↓' && hfDir === '↓' && 
      lfhfDir === '≈' && amode50Dir === '↑') {
    return 6;
  }

  // Pattern 7: RMSSD↓, SDNN↑, LF↑, HF↓, LF/HF>2, AMo50↑
  if (rmssdDir === '↓' && sdnnDir === '↑' && lfDir === '↑' && hfDir === '↓' && 
      lfhfDir === '↑' && amode50Dir === '↑' && lfhfRatio !== null && lfhfRatio > 2.0) {
    return 7;
  }

  // Pattern 8: RMSSD↓, SDNN≈, LF↑, HF↓, LF/HF>2, AMo50↑
  if (rmssdDir === '↓' && sdnnDir === '≈' && lfDir === '↑' && hfDir === '↓' && 
      lfhfDir === '↑' && amode50Dir === '↑' && lfhfRatio !== null && lfhfRatio > 2.0) {
    return 8;
  }

  // Pattern 9: RMSSD↓, SDNN↓, LF↓, HF↓, LF/HF≈1, AMo50↑
  if (rmssdDir === '↓' && sdnnDir === '↓' && lfDir === '↓' && hfDir === '↓' && 
      lfhfDir === '≈' && amode50Dir === '↑') {
    return 9;
  }

  // Pattern 10: RMSSD↓, SDNN↓, LF↑, HF↓, LF/HF>3, AMo50↑↑
  if (rmssdDir === '↓' && sdnnDir === '↓' && lfDir === '↑' && hfDir === '↓' && 
      lfhfDir === '↑' && amode50Dir === '↑' && lfhfRatio !== null && lfhfRatio > 3.0) {
    return 10;
  }

  // Pattern 12: RMSSD↓, SDNN↑, LF↓, HF↑, LF/HF<0.5, AMo50≈
  if (rmssdDir === '↓' && sdnnDir === '↑' && lfDir === '↓' && hfDir === '↑' && 
      lfhfDir === '↓' && amode50Dir === '≈' && lfhfRatio !== null && lfhfRatio < 0.5) {
    return 12;
  }

  // Pattern 13: RMSSD↑, SDNN↓, LF↑, HF↑, LF/HF≈1, AMo50↓
  if (rmssdDir === '↑' && sdnnDir === '↓' && lfDir === '↑' && hfDir === '↑' && 
      lfhfDir === '≈' && amode50Dir === '↓' && lfhfRatio !== null && 
      lfhfRatio >= 0.8 && lfhfRatio <= 1.2) {
    return 13;
  }

  // Pattern 14: RMSSD≈, SDNN↑, LF↑, HF↓, LF/HF>1.5, AMo50↑
  if (rmssdDir === '≈' && sdnnDir === '↑' && lfDir === '↑' && hfDir === '↓' && 
      lfhfDir === '↑' && amode50Dir === '↑' && lfhfRatio !== null && lfhfRatio > 1.5) {
    return 14;
  }

  // Pattern 16: RMSSD↓, SDNN↓, LF↓, HF↑, LF/HF<0.7, AMo50≈
  if (rmssdDir === '↓' && sdnnDir === '↓' && lfDir === '↓' && hfDir === '↑' && 
      lfhfDir === '↓' && amode50Dir === '≈' && lfhfRatio !== null && lfhfRatio < 0.7) {
    return 16;
  }

  // Pattern 17: RMSSD↑↑, SDNN↓, LF↓, HF↑↑, LF/HF<<1, AMo50↓↓
  if (rmssdDir === '↑' && sdnnDir === '↓' && lfDir === '↓' && hfDir === '↑' && 
      lfhfDir === '↓' && amode50Dir === '↓' && lfhfRatio !== null && lfhfRatio < 0.3) {
    return 17;
  }

  // Pattern 18: RMSSD≈, SDNN↓, LF↑, HF↓, LF/HF>2, AMo50↑
  if (rmssdDir === '≈' && sdnnDir === '↓' && lfDir === '↑' && hfDir === '↓' && 
      lfhfDir === '↑' && amode50Dir === '↑' && lfhfRatio !== null && lfhfRatio > 2.0) {
    return 18;
  }

  // Pattern 19: RMSSD↓, SDNN↑, LF↑, HF↑, LF/HF≈1, AMo50≈
  if (rmssdDir === '↓' && sdnnDir === '↑' && lfDir === '↑' && hfDir === '↑' && 
      lfhfDir === '≈' && amode50Dir === '≈' && lfhfRatio !== null && 
      lfhfRatio >= 0.8 && lfhfRatio <= 1.2) {
    return 19;
  }

  return null; // No pattern matched
}

/**
 * Get interpretation details for a pattern ID
 */
function getInterpretationDetails(patternId: number): {
  physiologicalState: string;
  coreInterpretation: string;
  recommendedAction: string;
} {
  const interpretations: Record<number, {
    physiologicalState: string;
    coreInterpretation: string;
    recommendedAction: string;
  }> = {
    1: {
      physiologicalState: 'Optimal (Ready)',
      coreInterpretation: 'High vagal tone and strong total variability. Sympathetic-parasympathetic balance intact. Indicates full recovery, high adaptability, and baroreflex responsiveness.',
      recommendedAction: 'Maximize performance: This is an ideal day for peak physical performance (e.g., maximum lift, intense interval training, race day) or deep cognitive work (complex problem-solving, creative sprints). You are primed for success. Action: Proceed with confidence. Ensure high-quality fuel (complex carbs, lean protein) pre-activity. Hydrate optimally. Double down on current successful sleep and nutrition patterns, as they are clearly working. Capture this feeling in a journal.'
    },
    2: {
      physiologicalState: 'Recovered (Stable)',
      coreInterpretation: 'Acute recovery high, resilience stable. LF/HF < 1 confirms parasympathetic dominance.',
      recommendedAction: 'Maintain momentum: Your recovery is solid, but not at peak adaptability. This is a great day for consistent progress. Action: Engage in moderate exercise (steady-state cardio, strength training at 70-80% capacity, yoga). Focus on creative tasks and collaborative work. Be mindful of caffeine intake; you may not need your usual amount. Prioritize a nutritious, anti-inflammatory diet. Maintain your baseline sleep hygiene.'
    },
    3: {
      physiologicalState: 'Fragile (Protective Recovery)',
      coreInterpretation: 'High parasympathetic drive but depleted total variability. Body diverting resources to deep recovery or healing.',
      recommendedAction: 'Prioritize rest & nourishment: Your body is actively healing or recovering from a significant stressor (recent illness, heavy training block). Do not add more stress. Action: This is a rest-oriented day. Focus on gentle mobility (walking, light stretching), not exercise. Emphasize hydration (water, electrolytes) and nutrient-dense, easily digestible meals (soups, stews). Ensure 8+ hours of sleep tonight. Avoid major stressors, intense work, or stimulants entirely.'
    },
    4: {
      physiologicalState: 'Adaptive (Resilient)',
      coreInterpretation: 'Normal recovery with elevated adaptability. Indicates long-term training effect or strong baroreflex capacity.',
      recommendedAction: 'Continue building resilience: You have a strong reserve capacity. Your current lifestyle is building long-term fitness. Action: Continue existing healthy habits. You can handle moderate to high intensity exercise today, focusing perhaps on skill acquisition or strength endurance. To optimize further, add a 10-minute mindfulness or breathwork session to enhance vagal tone and mental clarity. Ensure consistent, quality sleep tonight.'
    },
    5: {
      physiologicalState: 'Baseline (Homeostasis)',
      coreInterpretation: 'Balanced ANS, neither stressed nor deeply recovered. Maintenance state.',
      recommendedAction: 'Focus on consistency: This is your control state. The goal is maintenance and observation. Action: Maintain strict consistency in your sleep schedule, meal timing, and daily routine. Exercise at your standard moderate intensity. Log your subjective feelings and compare them to this reading. Avoid introducing new, major stressors or recovery protocols today. Observe trends across several days, not this single reading in isolation.'
    },
    6: {
      physiologicalState: 'Fatigued (Warning)',
      coreInterpretation: 'Decreasing resilience with normal recovery level. Both frequency powers suppressed—indicates energy depletion.',
      recommendedAction: 'Conserve energy & refuel: Your resilience is dropping, indicating accumulating fatigue or potential overreaching. Action: Dial back training intensity significantly; opt for light activity like a walk or take a complete rest day. Focus heavily on micronutrient repletion (fruits, vegetables, quality protein), electrolyte balance, and hydration. Prioritize 7-9 hours of uninterrupted sleep tonight. Avoid late nights or social drinking.'
    },
    7: {
      physiologicalState: 'Stressed but Resilient',
      coreInterpretation: 'Acute sympathetic activation with preserved adaptability. Typically due to short-term stressors (e.g., work, exertion).',
      recommendedAction: 'De-stress proactively: Your body can handle the current stress, but you need to actively manage it to prevent burnout. Action: Immediately engage the vagus nerve via slow, paced breathing (e.g., 4-7-8 method or box breathing for 5-10 minutes). Avoid caffeine in the afternoon. Take short, restorative walks throughout the day. Rehydrate consciously. Plan for an early night and a relaxing evening routine (e.g., warm bath, reading fiction).'
    },
    8: {
      physiologicalState: 'Strained (Fight-or-Flight)',
      coreInterpretation: 'Parasympathetic withdrawal; resilience baseline but challenged. High sympathetic dominance confirmed by LF/HF >2.',
      recommendedAction: 'Shift to recovery mode: Your nervous system is highly activated and needs active calming. Action: This is a mandatory light or recovery training day only (walking, gentle stretching). Avoid stimulants (caffeine, high-sugar snacks). Implement stress management techniques: journaling, meditation, or light exposure to nature. Focus on grounding activities. Ensure you are nourished and hydrated to support the nervous system.'
    },
    9: {
      physiologicalState: 'Depleted (Autonomic Suppression)',
      coreInterpretation: 'Both branches low → autonomic blunting. Low total and spectral power. Often post-illness, burnout, or deep fatigue.',
      recommendedAction: 'Immediate and total rest: Your battery is critically low. The system is suppressed. Action: Take a full rest day. Prioritize 8+ hours of high-quality sleep tonight, maybe even a short nap during the day if needed. Focus on hydration, getting sunlight exposure (even gentle walking outdoors helps synchronize circadian rhythm), and minimally processed, whole foods. No intensity or strain. Be kind to yourself.'
    },
    10: {
      physiologicalState: 'High Sympathetic Drive (Acute Stress)',
      coreInterpretation: 'Very high LF/HF, narrow RR histogram. Acute mental or physical overload.',
      recommendedAction: 'Emergency down-regulation: Your body is in a hyper-aroused state. Action: Immediate intervention needed. Engage in diaphragmatic breathing for 10-15 minutes in a quiet space. Minimize sensory input (dark room, silence, remove phone). Prioritize hydration and a light, calming meal. Postpone any important decisions or intense physical activity until the metrics normalize. Focus solely on calming the nervous system today.'
    },
    11: {
      physiologicalState: 'High Autonomic Flux',
      coreInterpretation: 'Both branches highly active → excellent responsiveness. Seen in elite fitness or during breath training.',
      recommendedAction: 'Manage the volume: You have elite responsiveness, a sign of high fitness and recovery capacity. Action: Maintain your current healthy habits. You are highly adaptable. Emphasize post-activity recovery to avoid "overshooting" into a strained state tomorrow. Consider an ice bath or contrast showers today, followed by extra hydration and protein intake. You can train hard, but recover harder.'
    },
    12: {
      physiologicalState: 'Parasympathetic Rebound (After Stress)',
      coreInterpretation: 'Rapid vagal recovery following stress or exercise. LF reduced, HF high.',
      recommendedAction: 'Facilitate active recovery: The body is actively recovering from a recent challenge. Action: Continue active recovery efforts. Focus on hydration, slow, intentional breathing exercises, and gentle, restorative movement (walking, foam rolling, yin yoga). Avoid taxing the system further with intense exercise. Ensure you get quality sleep to lock in the recovery.'
    },
    13: {
      physiologicalState: 'Recovery Under Load',
      coreInterpretation: 'PNS active but resilience low due to heavy prior stress; ANS working to restore.',
      recommendedAction: 'Structured recovery focus: Your body is trying very hard to recover while under a heavy physiological load. Action: Sleep 8+ hours tonight without compromise. Maintain optimal nutrition to support cellular repair. Limit all intensity (physical and mental) for the next 24 hours. Your body needs resources directed purely towards restoration to prevent a downward spiral into fatigue.'
    },
    14: {
      physiologicalState: 'High Alert Readiness',
      coreInterpretation: 'Sympathetic activation with high adaptive capacity—"performance arousal" zone.',
      recommendedAction: 'Optimal for competition: This is the "performance arousal" zone. You are alert and ready for competition or a major challenge. Action: This is a good day for competition, public speaking, or a high-stakes meeting. Use this state to your advantage. Ensure you have a structured cool-down and a deliberate recovery plan in place immediately after the peak event to guide your system back to baseline. Hydration is key.'
    },
    15: {
      physiologicalState: 'Deep Recovery State',
      coreInterpretation: 'PNS dominance with total adaptability preserved. Often after excellent sleep or mindfulness.',
      recommendedAction: 'Sustain and use as reference: This is an ideal recovery state. You nailed it. Action: Sustain your current routine that led to this result. Use this reading as the gold standard baseline reference point for future comparisons. Continue with healthy habits. No changes necessary, simply enjoy the feeling of being deeply recovered and ready for the next day.'
    },
    16: {
      physiologicalState: 'Autonomic Freeze / Suppressed Stress',
      coreInterpretation: 'Reduced variability but paradoxically high HF (vagal overcompensation). Often seen under chronic suppressed emotion.',
      recommendedAction: 'Address underlying stress: This points to a complex state where the body is stuck. Action: Focus on gentle movement (walking, dancing, cycling). Incorporate expressive therapies like journaling, talking with a friend or professional, or creative expression. Avoid isolation or exposing yourself to overstimulation (loud noise, intense movies). Focus on safety and gentle emotional processing.'
    },
    17: {
      physiologicalState: 'Over-Recovered / Maladaptive Parasympathetic Surge',
      coreInterpretation: 'Excess vagal activation without resilience backup—may indicate overtraining recovery edge or vagal overshoot.',
      recommendedAction: 'Rebalance the system: You might be overdoing the recovery techniques (e.g., too much cold exposure, excessive intense breathwork). Action: Reduce reliance on strong vagal interventions temporarily. Introduce light, stimulating physical activity to gently activate the sympathetic system (e.g., a brisk 20-minute walk or light jog). Ensure adequate protein intake to support muscle maintenance and return to a balanced state.'
    },
    18: {
      physiologicalState: 'Subclinical Stress Accumulation',
      coreInterpretation: 'Declining adaptability, elevated sympathetic tone. Often precedes fatigue or illness.',
      recommendedAction: 'Prevent burnout: You are trending towards fatigue. Detect this early and pivot immediately to recovery strategies. Action: Prioritize sleep optimization—aim for an extra 30-60 minutes tonight and maintain strict sleep hygiene. Engage in only light movement (walking, stretching); cancel intense workouts. Increase hydration and ensure nutrient-dense meals. Avoid social engagements that add mental stress and focus on self-care.'
    },
    19: {
      physiologicalState: 'Dynamic Stress Adaptation',
      coreInterpretation: 'Both branches elevated; body dynamically engaging stress response.',
      recommendedAction: 'Manage the wind-down: Your system is highly active and responsive. This might follow an intense physical or mental challenge. Action: Allow a dedicated post-stress wind-down window immediately after the event. Use calming techniques like paced breathing, meditation, or light stretching. Avoid secondary stimulants (extra coffee, intense media) that would prolong this elevated state. Transition smoothly into a restorative evening.'
    },
    20: {
      physiologicalState: 'High Flow State',
      coreInterpretation: 'Strong vagal tone with low sympathetic modulation; often seen during creative focus.',
      recommendedAction: 'Maximize productivity and protect the state: You are in an ideal state for creativity, deep focus, and sustained work. Action: Maintain focus and leverage this productive window. Ensure you stay well-hydrated throughout this period. Protect yourself from overstimulation after the session ends to transition smoothly back to a restful state. Plan for a standard recovery evening to maintain this optimal pattern.'
    }
  };

  return interpretations[patternId] || {
    physiologicalState: 'Unknown Pattern',
    coreInterpretation: 'Pattern not recognized in interpretation matrix.',
    recommendedAction: 'Continue monitoring and maintain healthy habits.'
  };
}

/**
 * Compare metrics to population reference ranges
 */
function compareToPopulation(
  current: number | null,
  ref: { min: number; optimal: number; max?: number },
  metricName: string
): string | null {
  if (current === null) return null;

  if (ref.max !== undefined) {
    // For ratios with min/max ranges
    if (current < ref.min) {
      return `${metricName} is below healthy range (${ref.min.toFixed(1)}-${ref.max.toFixed(1)}).`;
    } else if (current > ref.max) {
      return `${metricName} is above healthy range (${ref.min.toFixed(1)}-${ref.max.toFixed(1)}).`;
    } else if (current >= ref.min && current <= ref.max) {
      return `${metricName} is within healthy range.`;
    }
  } else {
    // For metrics with min/optimal
    if (current < ref.min) {
      return `${metricName} is below healthy minimum (${ref.min.toFixed(1)}).`;
    } else if (current >= ref.optimal) {
      return `${metricName} is in optimal range.`;
    } else {
      return `${metricName} is improving but below optimal (${ref.optimal.toFixed(1)}).`;
    }
  }

  return null;
}

/**
 * Main function to interpret autonomic state from session summary
 */
export function interpretAutonomicState(
  summary: SessionSummary,
  baseline: UserBaseline | null,
  populationRef: PopulationReference = DEFAULT_POPULATION_REF
): AutonomicInterpretation | null {
  // Check if we have required metrics
  const rmssd = summary.sessionRMSSD.value;
  const sdnn = summary.sessionSDNN?.value ?? null;
  const lfPower = summary.lfPower.value;
  const hfPower = summary.hfPower.value;
  const lfhfRatioLog = summary.lfhfRatio?.value ?? null;
  const amode50 = summary.amode50?.value ?? null;

  // Convert log(LF/HF) back to raw ratio
  const lfhfRatio = logToRatio(lfhfRatioLog);

  // If no baseline, we can't do relative interpretation
  if (!baseline || !baseline.established) {
    // Still provide population-based feedback
    const populationFeedback: string[] = [];
    
    if (rmssd !== null) {
      const feedback = compareToPopulation(rmssd, populationRef.rmssd, 'RMSSD');
      if (feedback) populationFeedback.push(feedback);
    }
    if (sdnn !== null) {
      const feedback = compareToPopulation(sdnn, populationRef.sdnn, 'SDNN');
      if (feedback) populationFeedback.push(feedback);
    }
    if (lfhfRatio !== null) {
      const feedback = compareToPopulation(lfhfRatio, populationRef.lfhfRatio, 'LF/HF ratio');
      if (feedback) populationFeedback.push(feedback);
    }

    return {
      patternId: 0,
      physiologicalState: 'Baseline Not Established',
      coreInterpretation: 'Complete 7-14 consistent resting sessions to establish your personal baseline for personalized interpretations.',
      recommendedAction: populationFeedback.length > 0 
        ? `Population reference: ${populationFeedback.join(' ')} Continue collecting sessions to establish your baseline.`
        : 'Continue collecting sessions to establish your baseline.',
      technicalChanges: [],
      relativeToBaseline: false,
      relativeToPopulation: populationFeedback.join(' ')
    };
  }

  // Calculate directions relative to baseline
  const rmssdDir = compareToBaseline(rmssd, baseline.rmssd_avg);
  const sdnnDir = compareToBaseline(sdnn, baseline.sdnn_avg);
  
  // For LF/HF ratio, use absolute value comparison since we don't have baseline
  // Compare to optimal range (0.8-1.2) for "≈", outside for ↑ or ↓
  let lfhfDir: '↑' | '↓' | '≈' | null = null;
  if (lfhfRatio !== null) {
    if (lfhfRatio >= 0.8 && lfhfRatio <= 1.2) {
      lfhfDir = '≈';
    } else if (lfhfRatio > 1.2) {
      lfhfDir = '↑';
    } else {
      lfhfDir = '↓';
    }
  }

  // For LF and HF, we don't have baselines, so use absolute population references
  // This is a simplified approach - ideally we'd track LF/HF baselines
  let lfDir: '↑' | '↓' | '≈' | null = null;
  let hfDir: '↑' | '↓' | '≈' | null = null;
  
  if (lfPower !== null) {
    if (lfPower >= populationRef.lfPower.optimal) lfDir = '↑';
    else if (lfPower >= populationRef.lfPower.min) lfDir = '≈';
    else lfDir = '↓';
  }
  
  if (hfPower !== null) {
    if (hfPower >= populationRef.hfPower.optimal) hfDir = '↑';
    else if (hfPower >= populationRef.hfPower.min) hfDir = '≈';
    else hfDir = '↓';
  }

  // AMo50 - compare to population (lower is better)
  const amode50Dir = amode50 !== null && amode50 > populationRef.amode50.max 
    ? '↑' 
    : amode50 !== null && amode50 < populationRef.amode50.optimal 
    ? '↓' 
    : '≈';

  // Match pattern
  const patternId = matchPattern(
    rmssdDir,
    sdnnDir,
    lfDir,
    hfDir,
    lfhfDir,
    amode50Dir,
    lfhfRatio
  );

  if (!patternId) {
    // No pattern matched - provide generic feedback
    return {
      patternId: 0,
      physiologicalState: 'Pattern Not Recognized',
      coreInterpretation: 'Your current metrics do not match a known pattern in the interpretation matrix. This may indicate a transitional state or unique individual response.',
      recommendedAction: 'Continue monitoring and maintain healthy habits. Consider consulting with a healthcare provider if patterns persist.',
      technicalChanges: [],
      relativeToBaseline: true,
      relativeToPopulation: null
    };
  }

  // Get interpretation details
  const details = getInterpretationDetails(patternId);

  // Build technical changes array
  const technicalChanges: MetricChange[] = [];

  if (rmssd !== null && baseline.rmssd_avg) {
    const change = calculatePercentChange(rmssd, baseline.rmssd_avg);
    technicalChanges.push({
      metric: 'RMSSD',
      direction: rmssdDir || '≈',
      percentChange: change,
      technicalDescription: `RMSSD ${rmssdDir === '↑' ? 'increased' : rmssdDir === '↓' ? 'decreased' : 'remained stable'} ${change !== null ? `by ${Math.abs(change).toFixed(1)}%` : ''} relative to your baseline.`
    });
  }

  if (sdnn !== null && baseline.sdnn_avg) {
    const change = calculatePercentChange(sdnn, baseline.sdnn_avg);
    technicalChanges.push({
      metric: 'SDNN',
      direction: sdnnDir || '≈',
      percentChange: change,
      technicalDescription: `SDNN ${sdnnDir === '↑' ? 'increased' : sdnnDir === '↓' ? 'decreased' : 'remained stable'} ${change !== null ? `by ${Math.abs(change).toFixed(1)}%` : ''} relative to your baseline.`
    });
  }

  // Population comparison
  const populationFeedback: string[] = [];
  if (rmssd !== null) {
    const feedback = compareToPopulation(rmssd, populationRef.rmssd, 'RMSSD');
    if (feedback) populationFeedback.push(feedback);
  }
  if (lfhfRatio !== null) {
    const feedback = compareToPopulation(lfhfRatio, populationRef.lfhfRatio, 'LF/HF ratio');
    if (feedback) populationFeedback.push(feedback);
  }

  return {
    patternId,
    ...details,
    technicalChanges,
    relativeToBaseline: true,
    relativeToPopulation: populationFeedback.length > 0 ? populationFeedback.join(' ') : null
  };
}

