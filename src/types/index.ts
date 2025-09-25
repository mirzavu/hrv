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
  duration: HRVMetric;
  totalBeats: HRVMetric;
  meanHR: HRVMetric;
  meanRR: HRVMetric;
  rmssd: HRVMetric;
  sdnn: HRVMetric;
  pnn50: HRVMetric;
  mxdmn: HRVMetric;
  cv: HRVMetric;
  mo: HRVMetric;
  amo50: HRVMetric;
}

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

export interface HrvSession {
  $id: string;
  sessionType: string;
  date: string;
  duration: number;
  totalBeats: number;
  meanHR: number;
  meanRR: number;
  rmssd: number;
  sdnn: number;
  pnn50: number;
  mxdmn: number;
  cv: number;
  mo: number;
  amo50: number;
  user: string;
  createdAt: string;
}

export interface RrInterval {
  timestamp: number;
  interval: number;
}

export type HrvSummary = SessionSummary;

// Database IDs (from your existing setup)
export const DATABASE_ID = '68d3feeb0010a759c201';
export const USERS_COLLECTION_ID = '68d3feeb001653eb83a6';
export const SESSIONS_COLLECTION_ID = '68d3feeb0014bf0c49a4';
