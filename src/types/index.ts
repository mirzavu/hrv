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
