'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { User, UserProfile } from '@/types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  showLoginModal: boolean;
  showOnboardingModal: boolean;
  loading: boolean;
  handleLoginSuccess: (userFromCallback?: User | null) => Promise<void>;
  handleLogout: () => Promise<void>;
  handleOnboardingComplete: (profileData: { name: string; age: string; gender: string; weight: string; height: string; purpose: string; }) => void;
  handleOnboardingSkip: () => void;
  setShowLoginModal: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  addToast: (message: string) => void;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, addToast }) => {
  const authData = useAuth(addToast);

  return (
    <AuthContext.Provider value={authData}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
