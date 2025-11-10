/**
 * Autonomic Interpretation Matrix: Multi-Metric HRV Logic
 * 
 * This module implements the autonomic interpretation system that analyzes HRV patterns
 * relative to user baseline and population norms to provide personalized insights.
 */

import type { UserBaseline, SessionSummary } from '@/types';

// Population reference ranges (healthy adults, age-adjusted approximations)
export interface PopulationReference {
  rmssd: { min: number; optimal: number };
  sdnn: { min: number; optimal: number };
  lfPower: { min: number; optimal: number };
  hfPower: { min: number; optimal: number };
  lfhfRatio: { min: number; max: number; optimal: number };
}

// Default population references (can be age/gender adjusted later)
const DEFAULT_POPULATION_REF: PopulationReference = {
  rmssd: { min: 30, optimal: 50 },
  sdnn: { min: 50, optimal: 80 },
  lfPower: { min: 200, optimal: 1000 },
  hfPower: { min: 200, optimal: 1000 },
  lfhfRatio: { min: 0.5, max: 2.0, optimal: 1.0 }
};

// Threshold for relative comparison (20% change)
const RELATIVE_THRESHOLD = 0.20;

// Pattern matching result
export interface InterpretationResult {
  patternId: number;
  physiologicalState: string;
  coreInterpretation: string;
  recommendedAction: string;
  technicalChanges: string[];
  relativeInterpretation: string;
  absoluteInterpretation?: string;
  combinedAdvice: string;
}

// Metric comparison result
interface MetricComparison {
  rmssd: '↑' | '↓' | '≈';
  sdnn: '↑' | '↓' | '≈';
  lf: '↑' | '↓' | '≈';
  hf: '↑' | '↓' | '≈';
  lfhf: '↑' | '↓' | '≈' | '<<' | '>>';
  amo50: '↑' | '↓' | '≈' | '↑↑' | '↓↓';
}

// Pattern definition for weighted scoring
interface PatternDefinition {
  patternId: number;
  rmssd: ('↑' | '↓' | '≈' | '↑↑')[];
  sdnn: ('↑' | '↓' | '≈' | '↑↑')[];
  lf: ('↑' | '↓' | '≈')[];
  hf: ('↑' | '↓' | '≈' | '↑↑')[];
  lfhf: ('↑' | '↓' | '≈' | '<<' | '>>')[];
  amo50: ('↑' | '↓' | '≈' | '↑↑' | '↓↓')[];
  physiologicalState: string;
  coreInterpretation: string;
  recommendedAction: string;
  combinedAdvice: string;
}

/**
 * Compare a metric value to baseline
 */
function compareToBaseline(
  current: number | null | undefined,
  baseline: number | null | undefined,
  threshold: number = RELATIVE_THRESHOLD
): '↑' | '↓' | '≈' {
  if (current === null || current === undefined || baseline === null || baseline === undefined || baseline === 0) {
    return '≈';
  }

  const change = (current - baseline) / baseline;
  
  if (change >= threshold) return '↑';
  if (change <= -threshold) return '↓';
  return '≈';
}

/**
 * Compare LF/HF ratio with special handling for extreme values
 */
function compareLFHF(
  current: number | null | undefined,
  baseline: number | null | undefined,
  threshold: number = RELATIVE_THRESHOLD
): '↑' | '↓' | '≈' | '<<' | '>>' {
  if (current === null || current === undefined || baseline === null || baseline === undefined || baseline === 0) {
    return '≈';
  }

  const change = (current - baseline) / baseline;
  
  // Extreme ratios
  if (current < 0.5 && baseline >= 1.0) return '<<';
  if (current > 3.0 && baseline <= 1.5) return '>>';
  
  if (change >= threshold) return '↑';
  if (change <= -threshold) return '↓';
  return '≈';
}

/**
 * Compare AMo50 with special handling for double arrows
 */
function compareAMo50(
  current: number | null | undefined,
  baseline: number | null | undefined,
  threshold: number = RELATIVE_THRESHOLD
): '↑' | '↓' | '≈' | '↑↑' | '↓↓' {
  if (current === null || current === undefined || baseline === null || baseline === undefined || baseline === 0) {
    return '≈';
  }

  const change = Math.abs((current - baseline) / baseline);
  
  if (change >= threshold * 2) {
    return current > baseline ? '↑↑' : '↓↓';
  }
  if (change >= threshold) {
    return current > baseline ? '↑' : '↓';
  }
  return '≈';
}

/**
 * Compare current session metrics to baseline
 */
function compareMetrics(
  summary: SessionSummary,
  baseline: UserBaseline | null
): MetricComparison | null {
  if (!baseline || !baseline.established) {
    return null;
  }

  const rmssd = compareToBaseline(summary.sessionRMSSD.value, baseline.rmssd_avg);
  const sdnn = compareToBaseline(summary.sdnn?.value ?? null, baseline.sdnn_avg);
  
  // For LF/HF, we'll use the ratio directly from summary if available
  // Since baseline doesn't store LF/HF, we'll compare against population norm (1.0)
  // But we'll be more lenient - only mark as extreme if significantly different
  const currentLFHF = summary.lfhfRatio ?? 
    (summary.lfPower.value && summary.hfPower.value && summary.hfPower.value > 0
      ? summary.lfPower.value / summary.hfPower.value
      : null);
  
  // Use a more lenient comparison - only mark extremes
  let lfhf: '↑' | '↓' | '≈' | '<<' | '>>' = '≈';
  if (currentLFHF !== null) {
    if (currentLFHF > 2.5) {
      lfhf = '>>';
    } else if (currentLFHF > 1.5) {
      lfhf = '↑';
    } else if (currentLFHF < 0.5) {
      lfhf = '<<';
    } else if (currentLFHF < 0.7) {
      lfhf = '↓';
    }
  }
  
  // For LF and HF individually, infer from ratio since baseline doesn't store them
  let lf: '↑' | '↓' | '≈' = '≈';
  let hf: '↑' | '↓' | '≈' = '≈';
  
  if (currentLFHF !== null) {
    if (currentLFHF > 1.5) {
      lf = '↑';
      hf = '↓';
    } else if (currentLFHF < 0.7) {
      lf = '↓';
      hf = '↑';
    } else {
      // Balanced ratio - assume both are normal
      lf = '≈';
      hf = '≈';
    }
  }
  
  // AMo50 comparison - since baseline doesn't store AMo50, we'll use a heuristic
  // Lower AMo50 is generally better (less stress), so we'll compare to a threshold
  // Typical healthy AMo50 is < 30%, so we'll use that as reference
  const currentAMo50 = summary.amode50 ?? null;
  let amo50: '↑' | '↓' | '≈' | '↑↑' | '↓↓' = '≈';
  if (currentAMo50 !== null) {
    // Lower is better for AMo50
    if (currentAMo50 > 50) {
      amo50 = '↑↑';
    } else if (currentAMo50 > 35) {
      amo50 = '↑';
    } else if (currentAMo50 < 15) {
      amo50 = '↓↓';
    } else if (currentAMo50 < 25) {
      amo50 = '↓';
    }
  }

  return { rmssd, sdnn, lf, hf, lfhf, amo50 };
}

/**
 * Score a single metric match
 * Returns: 0 (mismatch), points * 0.5 (partial match), or points (perfect match)
 */
function scoreMetricMatch(
  userValue: string,
  patternValues: string[],
  points: number
): number {
  let bestScore = 0;
  
  // Handle OR logic: check all pattern values and return the best match
  for (const patternValue of patternValues) {
    // Perfect match
    if (userValue === patternValue) {
      return points; // Perfect match - return immediately
    }
    
    // Handle double arrows vs single arrows
    // User ↑↑ vs Pattern ↑ = 100% (specific matches general)
    // User ↑ vs Pattern ↑↑ = 50% (general matches specific)
    if (userValue === '↑↑' && patternValue === '↑') {
      bestScore = Math.max(bestScore, points);
    } else if (userValue === '↑' && patternValue === '↑↑') {
      bestScore = Math.max(bestScore, points * 0.5);
    } else if (userValue === '↓↓' && patternValue === '↓') {
      bestScore = Math.max(bestScore, points);
    } else if (userValue === '↓' && patternValue === '↓↓') {
      bestScore = Math.max(bestScore, points * 0.5);
    }
    
    // ≈ creates 50% partial match against any directional arrow
    if (userValue === '≈' && (patternValue === '↑' || patternValue === '↓' || patternValue === '↑↑' || patternValue === '↓↓')) {
      bestScore = Math.max(bestScore, points * 0.5);
    } else if ((userValue === '↑' || userValue === '↓' || userValue === '↑↑' || userValue === '↓↓') && patternValue === '≈') {
      bestScore = Math.max(bestScore, points * 0.5);
    }
  }
  
  return bestScore;
}

/**
 * Score a pattern against user's metric comparison
 * Returns total score (max 14 points)
 */
function scorePattern(
  comparison: MetricComparison,
  pattern: PatternDefinition
): number {
  let score = 0;
  
  // Tier 1 (High Priority): 3 points each
  score += scoreMetricMatch(comparison.rmssd, pattern.rmssd, 3);
  score += scoreMetricMatch(comparison.sdnn, pattern.sdnn, 3);
  
  // Tier 2 (Medium Priority): 2 points each
  score += scoreMetricMatch(comparison.lf, pattern.lf, 2);
  score += scoreMetricMatch(comparison.hf, pattern.hf, 2);
  score += scoreMetricMatch(comparison.lfhf, pattern.lfhf, 2);
  
  // Tier 3 (Low Priority): 1 point
  score += scoreMetricMatch(comparison.amo50, pattern.amo50, 1);
  
  return score;
}

// All pattern definitions for weighted scoring
const PATTERNS: PatternDefinition[] = [
  {
    patternId: 1,
    rmssd: ['↑'],
    sdnn: ['↑'],
    lf: ['↑'],
    hf: ['↑'],
    lfhf: ['≈', '↑', '↓'],
    amo50: ['↓'],
    physiologicalState: 'Optimal (Ready)',
    coreInterpretation: 'High vagal tone and strong total variability. Sympathetic-parasympathetic balance intact. Indicates full recovery, high adaptability, and baroreflex responsiveness.',
    recommendedAction: 'Maximize performance: This is an ideal day for peak physical performance (e.g., maximum lift, intense interval training, race day) or deep cognitive work (complex problem-solving, creative sprints). You are primed for success.',
    combinedAdvice: 'Proceed with confidence. Ensure high-quality fuel (complex carbs, lean protein) pre-activity. Hydrate optimally. Double down on current successful sleep and nutrition patterns, as they are clearly working. Capture this feeling in a journal.'
  },
  {
    patternId: 2,
    rmssd: ['↑'],
    sdnn: ['≈'],
    lf: ['≈'],
    hf: ['↑'],
    lfhf: ['↓'],
    amo50: ['↓'],
    physiologicalState: 'Recovered (Stable)',
    coreInterpretation: 'Acute recovery high, resilience stable. LF/HF < 1 confirms parasympathetic dominance.',
    recommendedAction: 'Maintain momentum: Your recovery is solid, but not at peak adaptability. This is a great day for consistent progress.',
    combinedAdvice: 'Engage in moderate exercise (steady-state cardio, strength training at 70-80% capacity, yoga). Focus on creative tasks and collaborative work. Be mindful of caffeine intake; you may not need your usual amount. Prioritize a nutritious, anti-inflammatory diet. Maintain your baseline sleep hygiene.'
  },
  {
    patternId: 3,
    rmssd: ['↑'],
    sdnn: ['↓'],
    lf: ['↓'],
    hf: ['↑'],
    lfhf: ['<<'],
    amo50: ['↓'],
    physiologicalState: 'Fragile (Protective Recovery)',
    coreInterpretation: 'High parasympathetic drive but depleted total variability. Body diverting resources to deep recovery or healing.',
    recommendedAction: 'Prioritize rest & nourishment: Your body is actively healing or recovering from a significant stressor (recent illness, heavy training block). Do not add more stress.',
    combinedAdvice: 'This is a rest-oriented day. Focus on gentle mobility (walking, light stretching), not exercise. Emphasize hydration (water, electrolytes) and nutrient-dense, easily digestible meals (soups, stews). Ensure 8+ hours of sleep tonight. Avoid major stressors, intense work, or stimulants entirely.'
  },
  {
    patternId: 4,
    rmssd: ['≈'],
    sdnn: ['↑'],
    lf: ['↑'],
    hf: ['↑'],
    lfhf: ['≈', '↑', '↓'],
    amo50: ['≈'],
    physiologicalState: 'Adaptive (Resilient)',
    coreInterpretation: 'Normal recovery with elevated adaptability. Indicates long-term training effect or strong baroreflex capacity.',
    recommendedAction: 'Continue building resilience: You have a strong reserve capacity. Your current lifestyle is building long-term fitness.',
    combinedAdvice: 'Continue existing healthy habits. You can handle moderate to high intensity exercise today, focusing perhaps on skill acquisition or strength endurance. To optimize further, add a 10-minute mindfulness or breathwork session to enhance vagal tone and mental clarity. Ensure consistent, quality sleep tonight.'
  },
  {
    patternId: 5,
    rmssd: ['≈'],
    sdnn: ['≈'],
    lf: ['≈'],
    hf: ['≈'],
    lfhf: ['≈'],
    amo50: ['≈'],
    physiologicalState: 'Baseline (Homeostasis)',
    coreInterpretation: 'Balanced ANS, neither stressed nor deeply recovered. Maintenance state.',
    recommendedAction: 'Focus on consistency: This is your control state. The goal is maintenance and observation.',
    combinedAdvice: 'Maintain strict consistency in your sleep schedule, meal timing, and daily routine. Exercise at your standard moderate intensity. Log your subjective feelings and compare them to this reading. Avoid introducing new, major stressors or recovery protocols today. Observe trends across several days, not this single reading in isolation.'
  },
  {
    patternId: 6,
    rmssd: ['≈'],
    sdnn: ['↓'],
    lf: ['↓'],
    hf: ['↓'],
    lfhf: ['≈'],
    amo50: ['↑'],
    physiologicalState: 'Fatigued (Warning)',
    coreInterpretation: 'Decreasing resilience with normal recovery level. Both frequency powers suppressed—indicates energy depletion.',
    recommendedAction: 'Conserve energy & refuel: Your resilience is dropping, indicating accumulating fatigue or potential overreaching.',
    combinedAdvice: 'Dial back training intensity significantly; opt for light activity like a walk or take a complete rest day. Focus heavily on micronutrient repletion (fruits, vegetables, quality protein), electrolyte balance, and hydration. Prioritize 7-9 hours of uninterrupted sleep tonight. Avoid late nights or social drinking.'
  },
  {
    patternId: 7,
    rmssd: ['↓'],
    sdnn: ['↑'],
    lf: ['↑'],
    hf: ['↓'],
    lfhf: ['>>', '↑'],
    amo50: ['↑'],
    physiologicalState: 'Stressed but Resilient',
    coreInterpretation: 'Acute sympathetic activation with preserved adaptability. Typically due to short-term stressors (e.g., work, exertion).',
    recommendedAction: 'De-stress proactively: Your body can handle the current stress, but you need to actively manage it to prevent burnout.',
    combinedAdvice: 'Immediately engage the vagus nerve via slow, paced breathing (e.g., 4-7-8 method or box breathing for 5-10 minutes). Avoid caffeine in the afternoon. Take short, restorative walks throughout the day. Rehydrate consciously. Plan for an early night and a relaxing evening routine (e.g., warm bath, reading fiction).'
  },
  {
    patternId: 8,
    rmssd: ['↓'],
    sdnn: ['≈'],
    lf: ['↑'],
    hf: ['↓'],
    lfhf: ['>>', '↑'],
    amo50: ['↑'],
    physiologicalState: 'Strained (Fight-or-Flight)',
    coreInterpretation: 'Parasympathetic withdrawal; resilience baseline but challenged. High sympathetic dominance confirmed by LF/HF >2.',
    recommendedAction: 'Shift to recovery mode: Your nervous system is highly activated and needs active calming.',
    combinedAdvice: 'This is a mandatory light or recovery training day only (walking, gentle stretching). Avoid stimulants (caffeine, high-sugar snacks). Implement stress management techniques: journaling, meditation, or light exposure to nature. Focus on grounding activities. Ensure you are nourished and hydrated to support the nervous system.'
  },
  {
    patternId: 9,
    rmssd: ['↓'],
    sdnn: ['↓'],
    lf: ['↓'],
    hf: ['↓'],
    lfhf: ['≈'],
    amo50: ['↑'],
    physiologicalState: 'Depleted (Autonomic Suppression)',
    coreInterpretation: 'Both branches low → autonomic blunting. Low total and spectral power. Often post-illness, burnout, or deep fatigue.',
    recommendedAction: 'Immediate and total rest: Your battery is critically low. The system is suppressed.',
    combinedAdvice: 'Take a full rest day. Prioritize 8+ hours of high-quality sleep tonight, maybe even a short nap during the day if needed. Focus on hydration, getting sunlight exposure (even gentle walking outdoors helps synchronize circadian rhythm), and minimally processed, whole foods. No intensity or strain. Be kind to yourself.'
  },
  {
    patternId: 10,
    rmssd: ['↓'],
    sdnn: ['↓'],
    lf: ['↑'],
    hf: ['↓'],
    lfhf: ['>>'],
    amo50: ['↑↑'],
    physiologicalState: 'High Sympathetic Drive (Acute Stress)',
    coreInterpretation: 'Very high LF/HF, narrow RR histogram. Acute mental or physical overload.',
    recommendedAction: 'Emergency down-regulation: Your body is in a hyper-aroused state.',
    combinedAdvice: 'Immediate intervention needed. Engage in diaphragmatic breathing for 10-15 minutes in a quiet space. Minimize sensory input (dark room, silence, remove phone). Prioritize hydration and a light, calming meal. Postpone any important decisions or intense physical activity until the metrics normalize. Focus solely on calming the nervous system today.'
  },
  {
    patternId: 11,
    rmssd: ['↑'],
    sdnn: ['↑'],
    lf: ['↑'],
    hf: ['↑'],
    lfhf: ['≈', '↑', '↓'],
    amo50: ['↓↓'],
    physiologicalState: 'High Autonomic Flux',
    coreInterpretation: 'Both branches highly active → excellent responsiveness. Seen in elite fitness or during breath training.',
    recommendedAction: 'Manage the volume: You have elite responsiveness, a sign of high fitness and recovery capacity.',
    combinedAdvice: 'Maintain your current healthy habits. You are highly adaptable. Emphasize post-activity recovery to avoid "overshooting" into a strained state tomorrow. Consider an ice bath or contrast showers today, followed by extra hydration and protein intake. You can train hard, but recover harder.'
  },
  {
    patternId: 12,
    rmssd: ['↓'],
    sdnn: ['↑'],
    lf: ['↓'],
    hf: ['↑'],
    lfhf: ['<<'],
    amo50: ['≈'],
    physiologicalState: 'Parasympathetic Rebound (After Stress)',
    coreInterpretation: 'Rapid vagal recovery following stress or exercise. LF reduced, HF high.',
    recommendedAction: 'Facilitate active recovery: The body is actively recovering from a recent challenge.',
    combinedAdvice: 'Continue active recovery efforts. Focus on hydration, slow, intentional breathing exercises, and gentle, restorative movement (walking, foam rolling, yin yoga). Avoid taxing the system further with intense exercise. Ensure you get quality sleep to lock in the recovery.'
  },
  {
    patternId: 13,
    rmssd: ['↑'],
    sdnn: ['↓'],
    lf: ['↑'],
    hf: ['↑'],
    lfhf: ['≈', '↑', '↓'],
    amo50: ['↓'],
    physiologicalState: 'Recovery Under Load',
    coreInterpretation: 'PNS active but resilience low due to heavy prior stress; ANS working to restore.',
    recommendedAction: 'Structured recovery focus: Your body is trying very hard to recover while under a heavy physiological load.',
    combinedAdvice: 'Sleep 8+ hours tonight without compromise. Maintain optimal nutrition to support cellular repair. Limit all intensity (physical and mental) for the next 24 hours. Your body needs resources directed purely towards restoration to prevent a downward spiral into fatigue.'
  },
  {
    patternId: 14,
    rmssd: ['≈'],
    sdnn: ['↑'],
    lf: ['↑'],
    hf: ['↓'],
    lfhf: ['↑', '>>'],
    amo50: ['↑'],
    physiologicalState: 'High Alert Readiness',
    coreInterpretation: 'Sympathetic activation with high adaptive capacity—"performance arousal" zone.',
    recommendedAction: 'Optimal for competition: This is the "performance arousal" zone. You are alert and ready for competition or a major challenge.',
    combinedAdvice: 'This is a good day for competition, public speaking, or a high-stakes meeting. Use this state to your advantage. Ensure you have a structured cool-down and a deliberate recovery plan in place immediately after the peak event to guide your system back to baseline. Hydration is key.'
  },
  {
    patternId: 15,
    rmssd: ['↑', '↑↑'],
    sdnn: ['↑', '↑↑'],
    lf: ['↓'],
    hf: ['↑', '↑↑'],
    lfhf: ['<<'],
    amo50: ['↓', '↓↓'],
    physiologicalState: 'Deep Recovery State',
    coreInterpretation: 'PNS dominance with total adaptability preserved. Often after excellent sleep or mindfulness.',
    recommendedAction: 'Sustain and use as reference: This is an ideal recovery state. You nailed it.',
    combinedAdvice: 'Sustain your current routine that led to this result. Use this reading as the gold standard baseline reference point for future comparisons. Continue with healthy habits. No changes necessary, simply enjoy the feeling of being deeply recovered and ready for the next day.'
  },
  {
    patternId: 16,
    rmssd: ['↓'],
    sdnn: ['↓'],
    lf: ['↓'],
    hf: ['↑'],
    lfhf: ['<<', '↓'],
    amo50: ['≈'],
    physiologicalState: 'Autonomic Freeze / Suppressed Stress',
    coreInterpretation: 'Reduced variability but paradoxically high HF (vagal overcompensation). Often seen under chronic suppressed emotion.',
    recommendedAction: 'Address underlying stress: This points to a complex state where the body is stuck.',
    combinedAdvice: 'Focus on gentle movement (walking, dancing, cycling). Incorporate expressive therapies like journaling, talking with a friend or professional, or creative expression. Avoid isolation or exposing yourself to overstimulation (loud noise, intense movies). Focus on safety and gentle emotional processing.'
  },
  {
    patternId: 17,
    rmssd: ['↑', '↑↑'],
    sdnn: ['↓'],
    lf: ['↓'],
    hf: ['↑', '↑↑'],
    lfhf: ['<<'],
    amo50: ['↓', '↓↓'],
    physiologicalState: 'Over-Recovered / Maladaptive Parasympathetic Surge',
    coreInterpretation: 'Excess vagal activation without resilience backup—may indicate overtraining recovery edge or vagal overshoot.',
    recommendedAction: 'Rebalance the system: You might be overdoing the recovery techniques (e.g., too much cold exposure, excessive intense breathwork).',
    combinedAdvice: 'Reduce reliance on strong vagal interventions temporarily. Introduce light, stimulating physical activity to gently activate the sympathetic system (e.g., a brisk 20-minute walk or light jog). Ensure adequate protein intake to support muscle maintenance and return to a balanced state.'
  },
  {
    patternId: 18,
    rmssd: ['≈'],
    sdnn: ['↓'],
    lf: ['↑'],
    hf: ['↓'],
    lfhf: ['>>', '↑'],
    amo50: ['↑'],
    physiologicalState: 'Subclinical Stress Accumulation',
    coreInterpretation: 'Declining adaptability, elevated sympathetic tone. Often precedes fatigue or illness.',
    recommendedAction: 'Prevent burnout: You are trending towards fatigue. Detect this early and pivot immediately to recovery strategies.',
    combinedAdvice: 'Prioritize sleep optimization—aim for an extra 30-60 minutes tonight and maintain strict sleep hygiene. Engage in only light movement (walking, stretching); cancel intense workouts. Increase hydration and ensure nutrient-dense meals. Avoid social engagements that add mental stress and focus on self-care.'
  },
  {
    patternId: 19,
    rmssd: ['↓'],
    sdnn: ['↑'],
    lf: ['↑'],
    hf: ['↑'],
    lfhf: ['≈', '↑', '↓'],
    amo50: ['≈'],
    physiologicalState: 'Dynamic Stress Adaptation',
    coreInterpretation: 'Both branches elevated; body dynamically engaging stress response.',
    recommendedAction: 'Manage the wind-down: Your system is highly active and responsive. This might follow an intense physical or mental challenge.',
    combinedAdvice: 'Allow a dedicated post-stress wind-down window immediately after the event. Use calming techniques like paced breathing, meditation, or light stretching. Avoid secondary stimulants (extra coffee, intense media) that would prolong this elevated state. Transition smoothly into a restorative evening.'
  },
  {
    patternId: 20,
    rmssd: ['↑'],
    sdnn: ['↑'],
    lf: ['↓'],
    hf: ['↑'],
    lfhf: ['<<', '↓'],
    amo50: ['↓'],
    physiologicalState: 'High Flow State',
    coreInterpretation: 'Strong vagal tone with low sympathetic modulation; often seen during creative focus.',
    recommendedAction: 'Maximize productivity and protect the state: You are in an ideal state for creativity, deep focus, and sustained work.',
    combinedAdvice: 'Maintain focus and leverage this productive window. Ensure you stay well-hydrated throughout this period. Protect yourself from overstimulation after the session ends to transition smoothly back to a restful state. Plan for a standard recovery evening to maintain this optimal pattern.'
  }
];

/**
 * Match pattern to interpretation matrix using weighted scoring
 */
function matchPattern(comparison: MetricComparison): InterpretationResult | null {
  // Score all patterns
  const scoredPatterns = PATTERNS.map(pattern => ({
    pattern,
    score: scorePattern(comparison, pattern)
  }));

  // Sort by score descending
  scoredPatterns.sort((a, b) => b.score - a.score);

  // Log top 3 matches for debugging
  const top3 = scoredPatterns.slice(0, 3);
  console.log('[AUTONOMIC_INTERP] Top 3 pattern matches:', top3.map(p => ({
    patternId: p.pattern.patternId,
    score: p.score,
    state: p.pattern.physiologicalState
  })));

  // Return the highest scoring pattern
  const bestMatch = scoredPatterns[0];
  if (bestMatch.score === 0) {
    console.log('[AUTONOMIC_INTERP] No pattern scored above 0');
    return null;
  }

  return {
    patternId: bestMatch.pattern.patternId,
    physiologicalState: bestMatch.pattern.physiologicalState,
    coreInterpretation: bestMatch.pattern.coreInterpretation,
    recommendedAction: bestMatch.pattern.recommendedAction,
    technicalChanges: [],
    relativeInterpretation: '',
    combinedAdvice: bestMatch.pattern.combinedAdvice
  };
}

/**
 * Generate technical changes description
 */
function generateTechnicalChanges(
  summary: SessionSummary,
  baseline: UserBaseline | null
): string[] {
  const changes: string[] = [];

  if (!baseline || !baseline.established) {
    return changes;
  }

  if (summary.sessionRMSSD.value !== null && baseline.rmssd_avg !== null) {
    const change = ((summary.sessionRMSSD.value - baseline.rmssd_avg) / baseline.rmssd_avg) * 100;
    if (Math.abs(change) >= 20) {
      changes.push(`RMSSD has ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)}%`);
    }
  }

  if (summary.sdnn?.value !== null && baseline.sdnn_avg !== null) {
    const change = ((summary.sdnn.value - baseline.sdnn_avg) / baseline.sdnn_avg) * 100;
    if (Math.abs(change) >= 20) {
      changes.push(`SDNN has ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)}%`);
    }
  }

  if (summary.lfPower.value !== null && summary.hfPower.value !== null && summary.hfPower.value > 0) {
    const lfhf = summary.lfPower.value / summary.hfPower.value;
    changes.push(`LF/HF ratio is ${lfhf.toFixed(2)}`);
  }

  return changes;
}

/**
 * Generate absolute interpretation based on population norms
 */
function generateAbsoluteInterpretation(
  summary: SessionSummary,
  popRef: PopulationReference = DEFAULT_POPULATION_REF
): string | undefined {
  const parts: string[] = [];

  const rmssdValue = summary.sessionRMSSD.value;
  if (rmssdValue !== null && rmssdValue !== undefined) {
    const value = rmssdValue.toFixed(1);
    if (rmssdValue < popRef.rmssd.min) {
      parts.push(`RMSSD is ${value} ms which is below typical healthy range`);
    } else if (rmssdValue >= popRef.rmssd.optimal) {
      parts.push(`RMSSD is ${value} ms which is in optimal range`);
    }
  }

  const sdnnValue = summary.sdnn?.value;
  if (sdnnValue !== null && sdnnValue !== undefined) {
    const value = sdnnValue.toFixed(1);
    if (sdnnValue < popRef.sdnn.min) {
      parts.push(`SDNN is ${value} ms which is below typical healthy range`);
    } else if (sdnnValue >= popRef.sdnn.optimal) {
      parts.push(`SDNN is ${value} ms which is in optimal range`);
    }
  }

  const lfValue = summary.lfPower.value;
  const hfValue = summary.hfPower.value;
  if (lfValue !== null && lfValue !== undefined && hfValue !== null && hfValue !== undefined && hfValue > 0) {
    const lfhf = lfValue / hfValue;
    const ratio = lfhf.toFixed(2);
    if (lfhf < popRef.lfhfRatio.min || lfhf > popRef.lfhfRatio.max) {
      parts.push(`LF/HF ratio is ${ratio} which is outside typical healthy range`);
    }
  }

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join('. ') + '.';
}

/**
 * Main function to interpret HRV session
 */
export function interpretHRVSession(
  summary: SessionSummary,
  baseline: UserBaseline | null,
  popRef?: PopulationReference
): InterpretationResult | null {
  // If no baseline, cannot provide interpretation
  if (!baseline || !baseline.established) {
    return null;
  }

  // Compare metrics to baseline
  const comparison = compareMetrics(summary, baseline);
  if (!comparison) {
    console.log('[AUTONOMIC_INTERP] compareMetrics returned null');
    return null;
  }

  console.log('[AUTONOMIC_INTERP] Metric comparison:', comparison);
  console.log('[AUTONOMIC_INTERP] Summary values:', {
    rmssd: summary.sessionRMSSD.value,
    sdnn: summary.sdnn?.value,
    lfhfRatio: summary.lfhfRatio,
    amode50: summary.amode50
  });
  console.log('[AUTONOMIC_INTERP] Baseline values:', {
    rmssd_avg: baseline.rmssd_avg,
    sdnn_avg: baseline.sdnn_avg
  });

  // Match pattern
  const interpretation = matchPattern(comparison);
  if (!interpretation) {
    console.log('[AUTONOMIC_INTERP] No pattern matched for comparison:', comparison);
    return null;
  }
  
  console.log('[AUTONOMIC_INTERP] Pattern matched:', interpretation.patternId);

  // Generate technical changes
  interpretation.technicalChanges = generateTechnicalChanges(summary, baseline);

  // Generate relative interpretation
  const relativeParts: string[] = [];
  if (summary.sessionRMSSD.value !== null && baseline.rmssd_avg !== null) {
    const change = ((summary.sessionRMSSD.value - baseline.rmssd_avg) / baseline.rmssd_avg) * 100;
    if (Math.abs(change) >= 5) {
      relativeParts.push(`Your recovery is ${change > 0 ? 'up' : 'down'} by ${Math.abs(change).toFixed(0)}%`);
    }
  }
  interpretation.relativeInterpretation = relativeParts.length > 0
    ? relativeParts.join('. ') + '.'
    : 'Your metrics are close to your baseline.';

  // Generate absolute interpretation
  interpretation.absoluteInterpretation = generateAbsoluteInterpretation(summary, popRef);

  // Combine advice
  const adviceParts: string[] = [interpretation.recommendedAction];
  if (interpretation.absoluteInterpretation) {
    adviceParts.push(interpretation.absoluteInterpretation);
  }
  adviceParts.push(interpretation.combinedAdvice);
  interpretation.combinedAdvice = adviceParts.join(' ');

  return interpretation;
}

