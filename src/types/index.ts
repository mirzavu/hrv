// --- Type Definitions ---

export interface User {
  $id: string;
  name: string;
  email: string;
  prefs?: Record<string, unknown>;
  registration?: string;
  status?: boolean;
  labels?: string[];
  passwordUpdate?: string;
  emailVerification?: boolean;
  phoneVerification?: boolean;
  timezone?: string;

  // For Push Notifications
  fcm_token?: string;
}

export interface UserProfile {
  $id: string;
  authUserId: string;
  name: string;
  email: string;
  age?: number;
  gender?: string;
  weight?: number;
  height?: number;
  purpose?: string;
  profileCompleted: boolean;
  createdAt: string;
  lastLoginAt: string;
  onboardingCompletedAt?: string;
  updatedAt?: string;
  usage_phase?: 'calibration' | 'early_baseline' | 'full_baseline' | null;
  timezone?: string; // IANA timezone e.g., "Asia/Kolkata", "America/New_York"
}

export interface PhaseData {
  name: 'calibration' | 'early_baseline' | 'full_baseline';
  progress: number; // 0-100
  uniqueDays: number;
  isFirstSession?: boolean;
}

export interface UserBaseline {
  $id: string;
  user_id: string;
  rmssd_avg: number | null;
  rmssd_stdev: number | null;
  sdnn_avg: number | null;
  sdnn_stdev: number | null;
  hr_avg: number | null;
  hr_stdev: number | null;
  sd1_sd2_ratio_avg: number | null;
  sd1_sd2_ratio_stdev: number | null;
  lf_power_avg?: number | null;
  hf_power_avg?: number | null;
  lf_hf_avg?: number | null;
  amo50_avg?: number | null;
  energy_score_avg?: number | null;
  energy_score_stdev?: number | null;
  stress_score_avg?: number | null;
  stress_score_stdev?: number | null;
  health_score_avg?: number | null;
  health_score_stdev?: number | null;
  focus_score_avg?: number | null;
  focus_score_stdev?: number | null;
  hrv_score_avg?: number | null;
  hrv_score_stdev?: number | null;
  sessions_count: number | null;
  established: boolean;
  unique_morning_sessions_count?: number; // Count of unique days with valid morning sessions (0, 1, 2...)
  calibration_progress?: number; // 0-100 percentage
  last_updated: string | null;
  createdAt: string;
}

export interface BaselineHistory {
  $id: string;
  user_id: string;
  snapshot_date: string;
  rmssd_avg: number | null;
  rmssd_stdev: number | null;
  sdnn_avg: number | null;
  sdnn_stdev: number | null;
  hr_avg: number | null;
  hr_stdev: number | null;
  sd1_sd2_ratio_avg: number | null;
  sd1_sd2_ratio_stdev: number | null;
  energy_score_avg?: number | null;
  energy_score_stdev?: number | null;
  stress_score_avg?: number | null;
  stress_score_stdev?: number | null;
  health_score_avg?: number | null;
  health_score_stdev?: number | null;
  focus_score_avg?: number | null;
  focus_score_stdev?: number | null;
  hrv_score_avg?: number | null;
  hrv_score_stdev?: number | null;
  sessions_count: number | null;
  established: boolean;
  createdAt: string;
}

export interface HRVMetric {
  label: string;
  value: number | null | undefined;
  unit: string;
}

export interface SessionSummary {
  // Core session metrics
  duration: HRVMetric;
  meanHR: HRVMetric;

  // HRV metrics
  sessionRMSSD: HRVMetric;
  startRMSSD: HRVMetric;
  endRMSSD: HRVMetric;
  rmssdDelta: HRVMetric;
  hrvStability: HRVMetric;

  // Performance metrics
  timeToStabilize: HRVMetric;
  respCoherence: HRVMetric;
  restorationIndex: HRVMetric;
  sessionStressIndex: HRVMetric;

  // New 4-score metrics
  energyScore: HRVMetric;
  stressScore: HRVMetric;
  healthScore: HRVMetric;
  focusScore: HRVMetric;

  // HRV Score (0-100)
  hrvScore: HRVMetric;

  // Readiness Score (Personalized 0-100)
  readinessScore: HRVMetric;

  // Frequency domain metrics
  lfPower: HRVMetric;
  hfPower: HRVMetric;
  totalPower?: number | null | undefined;
  sd2_sd1_ratio?: number | null | undefined;
  lfhfRatio?: number | null | undefined;

  // Additional HRV metrics
  sdnn?: HRVMetric;
  amode50?: number | null | undefined;

  // === NEW SD2/SD1-based Balance Percentages ===
  sd1_sd2_balance_score_nbs?: number | null | undefined;
  sd1_sd2_parasympathetic_percent?: number | null | undefined;
  sd1_sd2_sympathetic_percent?: number | null | undefined;
  // === END NEW ===

  // Data quality
  dataPoints: HRVMetric;

  // Crash & Phase
  is_crash?: boolean;
  // usage_phase is now stored in users table, not in session_summary

  // AI Insight
  ai_title?: string | null;
  ai_interpretation?: string | null;

  // Session ID for database operations
  session_id?: string | null;

  // Phase data from analyze API (for progress bar)
  phaseData?: PhaseData | null;

  // Raw data for visualization
  rrIntervals: Array<{ timestamp: number; value: number }>;
}

export interface SessionSummaryRecord {
  $id: string;
  session_id: string;
  user_id: string;

  // Existing time-domain metrics
  rmssd_session_ms: number | null;
  rmssd_cv_percent?: number | null;
  sdnn_session_ms: number | null;
  pnn50_percent: number | null;
  session_mean_hr: number | null;
  amode_50: number | null;
  AMo50_count: number | null;
  rr_max_ms: number | null;
  rr_min_ms: number | null;
  mxdmn_ms: number | null;
  rmssd_start_ms: number | null;
  rmssd_end_ms: number | null;
  time_to_stabilize_seconds: number | null;
  resp_coherence_score: number | null;
  restoration_index: number | null;
  session_stress_index: number | null;

  // New time-domain metrics
  mean_rr_ms?: number | null;

  // Frequency-domain metrics
  lf_power_ms2?: number | null;
  hf_power_ms2?: number | null;
  lfhf_ratio?: number | null;
  total_power_ms2?: number | null;

  // Nonlinear/Poincaré plot metrics
  sd1_ms?: number | null;
  sd2_ms?: number | null;
  sd2_sd1_ratio?: number | null;

  // Full Baevsky Stress Index components
  baevsky_mo?: number | null;
  baevsky_amo?: number | null;
  baevsky_mxdmn_ms?: number | null;
  baevsky_stress_index?: number | null;

  // === NEW SD2/SD1-based Balance Percentages ===
  sd1_sd2_balance_score_nbs?: number | null; // Normalized Balance Score (0-100)
  sd1_sd2_parasympathetic_percent?: number | null;
  sd1_sd2_sympathetic_percent?: number | null;
  // === END NEW ===

  // New 4-Score metrics
  energy_score?: number | null;
  stress_score?: number | null;
  health_score?: number | null;
  focus_score?: number | null;

  // HRV Score (0-100)
  hrv_score?: number | null;

  // Readiness Score (Personalized 0-100)
  readiness_score?: number | null;

  // Session date (stores session startTime for temporal distribution checks)
  session_date?: string | null;

  // Crash Protection & Onboarding Phase
  is_crash?: boolean;
  // usage_phase is now stored in users table, not in session_summary

  // AI Insight
  ai_title?: string | null;
  ai_interpretation?: string | null;

  createdAt: string;
}

export type SessionSummaryPayload = Omit<SessionSummaryRecord, '$id' | 'createdAt'>;

export interface SessionMilestone {
  label: string;
  value: number;
}

export interface Toast {
  id: number;
  message: string;
}

export interface BluetoothDevice {
  id: string;
  name: string;
  connected: boolean;
}

export interface Session {
  $id: string;
  userId: string; // reference to users collection
  startTime: string; // ISO datetime string
  endTime: string; // ISO datetime string
  rawFile?: string | string[]; // PocketBase file field (filename)
  createdAt: string;
}

export interface RawHeartData {
  timestamp: number;
  heartRate?: number; // BPM
  rrInterval?: number; // milliseconds
  rawValue?: number; // raw sensor value
  flags?: number;
  rawBytes?: number[];
  allRrIntervals?: number[];
  calculatedFromHR?: boolean; // true if RR was calculated from HR instead of real RR data
}

export type HrvSummary = SessionSummary;

// Appwrite-specific envs removed
