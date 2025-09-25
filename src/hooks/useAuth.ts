'use client';

import { useState, useEffect, useCallback } from 'react';
import { account, databases, AppwriteID } from '@/lib/appwrite';
import { Query } from 'appwrite';
import { User, UserProfile, DATABASE_ID, USERS_COLLECTION_ID } from '@/types';

export const useAuth = (addToast: (message: string) => void) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Function to sync user from auth system to users collection and get profile
  const syncUserToDatabase = useCallback(async (authUser: User): Promise<UserProfile | null> => {
    try {
      // First, check if user already exists in the users collection
      const existingUsers = await databases.listDocuments(
        DATABASE_ID,
        USERS_COLLECTION_ID,
        [Query.equal('authUserId', authUser.$id)]
      );

      let userDoc: UserProfile;
      if (existingUsers.documents.length === 0) {
        // User doesn't exist in users collection, create them
        userDoc = await databases.createDocument(
          DATABASE_ID,
          USERS_COLLECTION_ID,
          AppwriteID.unique(),
          {
            authUserId: authUser.$id,
            name: authUser.name || '',
            email: authUser.email || '',
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            profileCompleted: false,
          }
        ) as UserProfile;
        console.log('User synced to database');
      } else {
        // User exists, update last login time
        userDoc = await databases.updateDocument(
          DATABASE_ID,
          USERS_COLLECTION_ID,
          existingUsers.documents[0].$id,
          {
            lastLoginAt: new Date().toISOString(),
          }
        ) as UserProfile;
        console.log('User last login updated');
      }

      // Set user profile data
      setUserProfile(userDoc);

      // Check if user needs onboarding
      if (!userDoc.profileCompleted && authUser.$id !== 'guest') {
        setShowOnboardingModal(true);
      }

      return userDoc;
    } catch (error) {
      console.error('Error syncing user to database:', error);
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
      } catch (_e) {
        console.log("Failed to parse temporary user data, proceeding with normal flow");
        localStorage.removeItem('temp_auth_user');
      }
    }

    try {
      const currentUser = await account.get();
      setUser(currentUser);
      setShowLoginModal(false);
      
      // Sync user to database
      await syncUserToDatabase(currentUser);
      } catch (error: unknown) {
      // Only show "no session" message for 401 errors (not logged in)
      // Avoid showing for other errors like network issues
      if (error && typeof error === 'object' && 'code' in error && error.code === 401) {
        console.log("No active session - user not logged in.");
      } else {
        console.log("Session check failed:", error instanceof Error ? error.message : 'Unknown error');
      }
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
      await account.deleteSession('current');
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
  const handleOnboardingComplete = useCallback((_profileData: Record<string, unknown>) => {
    setShowOnboardingModal(false);
    addToast('Profile setup completed successfully!');
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
