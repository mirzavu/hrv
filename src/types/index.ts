// --- Type Definitions ---

export interface User {
  $id: string;
  name: string;
  email: string;
  [key: string]: any;
}

export interface UserProfile {
  $id: string;
  authUserId: string;
  name: string;
  email: string;
  profileCompleted: boolean;
  createdAt: string;
  lastLoginAt: string;
  [key: string]: any;
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

// Database IDs (from your existing setup)
export const DATABASE_ID = '68d3feeb0010a759c201';
export const USERS_COLLECTION_ID = '68d3feeb001653eb83a6';
export const SESSIONS_COLLECTION_ID = '68d3feeb0014bf0c49a4';
