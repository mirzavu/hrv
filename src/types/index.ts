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
  // Keeping structure for now with dummy data
  heartRate: HRVMetric;
  dataPoints: HRVMetric;
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
}

export type HrvSummary = SessionSummary;

// Database IDs (from your existing setup)
export const DATABASE_ID = '68d3feeb0010a759c201';
export const USERS_COLLECTION_ID = '68d3feeb001653eb83a6';
export const SESSIONS_COLLECTION_ID = '68d3feeb0014bf0c49a4';
