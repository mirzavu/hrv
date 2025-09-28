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
  mfa?: boolean;
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
}

export interface HRVMetric {
  label: string;
  value: number | null;
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
  
  // Data quality
  dataPoints: HRVMetric;
  
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
  
  // Full Baevsky Stress Index components
  baevsky_mo?: number | null;
  baevsky_amo?: number | null;
  baevsky_mxdmn_ms?: number | null;
  baevsky_stress_index?: number | null;
  
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
  rawFileId: string; // Appwrite Storage file ID for raw data
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
}

export type HrvSummary = SessionSummary;

const requireEnv = (value: string | undefined, key: string) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const DATABASE_ID = requireEnv(process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID, 'NEXT_PUBLIC_APPWRITE_DATABASE_ID');
export const USERS_COLLECTION_ID = requireEnv(process.env.NEXT_PUBLIC_APPWRITE_USERS_COLLECTION_ID, 'NEXT_PUBLIC_APPWRITE_USERS_COLLECTION_ID');
export const SESSIONS_COLLECTION_ID = requireEnv(process.env.NEXT_PUBLIC_APPWRITE_SESSIONS_COLLECTION_ID, 'NEXT_PUBLIC_APPWRITE_SESSIONS_COLLECTION_ID');
export const SESSION_SUMMARY_COLLECTION_ID = requireEnv(process.env.NEXT_PUBLIC_APPWRITE_SESSION_SUMMARY_COLLECTION_ID, 'NEXT_PUBLIC_APPWRITE_SESSION_SUMMARY_COLLECTION_ID');
