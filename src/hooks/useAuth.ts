'use client';

import { useState, useEffect, useCallback } from 'react';
import { pb } from '@/lib/pocketbase';
import { User, UserProfile } from '@/types';

export const useAuth = (addToast: (message: string) => void) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Helper to map PocketBase user to User format
  const pbUserToAppUser = useCallback((pbUser: any): User | null => {
    if (!pbUser) return null;
    return {
      $id: pbUser.id,
      name: pbUser.name || '',
      email: pbUser.email || '',
    };
  }, []);

  // Function to sync user profile and ensure it's up to date
  const syncUserToDatabase = useCallback(async (authUser: User): Promise<UserProfile | null> => {
    try {
      // For PocketBase, the user record IS the profile (they're the same)
      // We just need to ensure the profile fields are up to date
      const currentTime = new Date().toISOString();
      
      // Update the user record with login time and ensure authUserId is set
      const updatedUser = await pb.collection('users').update(authUser.$id, {
        authUserId: authUser.$id, // For compatibility with existing code
        lastLoginAt: currentTime,
        name: authUser.name || '',
        email: authUser.email || '',
      });

      // Map to UserProfile format expected by the app
      const userProfile: UserProfile = {
        $id: updatedUser.id,
        authUserId: updatedUser.authUserId || updatedUser.id,
        name: updatedUser.name || '',
        email: updatedUser.email || '',
        age: updatedUser.age,
        gender: updatedUser.gender,
        weight: updatedUser.weight,
        height: updatedUser.height,
        purpose: updatedUser.purpose,
        profileCompleted: updatedUser.profileCompleted || false,
        createdAt: updatedUser.createdAt || updatedUser.created,
        lastLoginAt: updatedUser.lastLoginAt || currentTime,
        onboardingCompletedAt: updatedUser.onboardingCompletedAt,
      };

      setUserProfile(userProfile);

      // Check if user needs onboarding
      if (!userProfile.profileCompleted && authUser.$id !== 'guest') {
        setShowOnboardingModal(true);
      }

      console.log('User profile synced');
      return userProfile;
    } catch (error) {
      console.error('Error syncing user profile:', error);
      // Don't throw error - user can still use the app even if sync fails
      return null;
    }
  }, []);

  const loadUser = useCallback(async () => {
    setLoading(true);
    
    // Check for temporary user data from auth callback first
    const tempUserData = localStorage.getItem('temp_auth_user');
    if (tempUserData) {
      try {
        const userData = JSON.parse(tempUserData);
        setUser(userData);
        setShowLoginModal(false);
        localStorage.removeItem('temp_auth_user'); // Clean up
        console.log("Loaded user from temporary storage after auth callback");
        await syncUserToDatabase(userData);
        setLoading(false);
        return;
      } catch {
        console.log("Failed to parse temporary user data, proceeding with normal flow");
        localStorage.removeItem('temp_auth_user');
      }
    }

    try {
      // Check if user is authenticated with PocketBase
      if (pb.authStore.isValid && pb.authStore.model) {
        const currentUser = pbUserToAppUser(pb.authStore.model);
        if (currentUser) {
          setUser(currentUser);
          setShowLoginModal(false);
          
          // Sync user profile
          await syncUserToDatabase(currentUser);
        } else {
          throw new Error('Invalid user data');
        }
      } else {
        throw new Error('No active session');
      }
    } catch (error: unknown) {
      console.log("No active session - user not logged in.");
      setUser(null);
      setShowLoginModal(true);
    } finally {
      setLoading(false);
    }
  }, [syncUserToDatabase]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const handleLogout = useCallback(async () => {
    try {
      // Clear PocketBase auth store
      pb.authStore.clear();
      setUser(null);
      setUserProfile(null);
      setShowOnboardingModal(false);
      addToast('Logged out successfully');
    } catch (error) {
      console.error('Logout failed:', error);
      addToast('Failed to log out');
    }
  }, [addToast]);
  
  // This will be called by LoginModal and AuthCallback
  const handleLoginSuccess = useCallback(async (userFromCallback: User | null = null) => {
    if (userFromCallback) {
      // User data already available from auth callback
      setUser(userFromCallback);
      setShowLoginModal(false);
      addToast(`Welcome back!`);
      
      // Sync user to database
      await syncUserToDatabase(userFromCallback);
    } else {
      // Reload user data (e.g., from guest login)
      await loadUser();
      addToast(`Welcome back!`);
    }
  }, [addToast, loadUser, syncUserToDatabase]);

  // Handle onboarding completion
  const handleOnboardingComplete = useCallback((
    profileData: {
      name: string;
      age: string;
      gender: string;
      weight: string;
      height: string;
      purpose: string;
    }
  ) => {
    setShowOnboardingModal(false);
    addToast('Profile setup completed successfully!');
    setUserProfile(prev => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        name: profileData.name.trim() || prev.name,
        age: Number.parseInt(profileData.age, 10) || prev.age,
        gender: profileData.gender || prev.gender,
        weight: Number.parseFloat(profileData.weight) || prev.weight,
        height: Number.parseFloat(profileData.height) || prev.height,
        purpose: profileData.purpose || prev.purpose,
        profileCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
      };
    });
    // Refresh user profile data
    if (user) {
      syncUserToDatabase(user);
    }
  }, [addToast, user, syncUserToDatabase]);

  const handleOnboardingSkip = useCallback(() => {
    setShowOnboardingModal(false);
    addToast('You can complete your profile later in settings');
  }, [addToast]);

  return { 
    user, 
    userProfile,
    showLoginModal, 
    showOnboardingModal,
    loading,
    handleLoginSuccess, 
    handleLogout, 
    handleOnboardingComplete,
    handleOnboardingSkip,
    setShowLoginModal 
  };
};
