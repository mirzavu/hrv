import { useState, useEffect, useCallback } from 'react';
import { account, databases, AppwriteID } from '../appwrite';
import { Query } from 'appwrite';

// Database and Collection IDs
const DATABASE_ID = '68d3feeb0010a759c201';
const USERS_COLLECTION_ID = '68d3feeb001653eb83a6';

// Note: Session cookies are HttpOnly and not accessible via document.cookie
// We'll rely on the API call to check authentication status

export const useAuth = (addToast) => {
    const [user, setUser] = useState(null);
    const [showLoginModal, setShowLoginModal] = useState(false);

    // Function to sync user from auth system to users collection
    const syncUserToDatabase = useCallback(async (authUser) => {
        try {
            // First, check if user already exists in the users collection
            const existingUsers = await databases.listDocuments(
                DATABASE_ID,
                USERS_COLLECTION_ID,
                [Query.equal('authUserId', authUser.$id)]
            );

            if (existingUsers.documents.length === 0) {
                // User doesn't exist in users collection, create them
                await databases.createDocument(
                    DATABASE_ID,
                    USERS_COLLECTION_ID,
                    AppwriteID.unique(),
                    {
                        authUserId: authUser.$id,
                        name: authUser.name || '',
                        email: authUser.email || '',
                        createdAt: new Date().toISOString(),
                        lastLoginAt: new Date().toISOString(),
                    }
                );
                console.log('User synced to database');
            } else {
                // User exists, update last login time
                await databases.updateDocument(
                    DATABASE_ID,
                    USERS_COLLECTION_ID,
                    existingUsers.documents[0].$id,
                    {
                        lastLoginAt: new Date().toISOString(),
                    }
                );
                console.log('User last login updated');
            }
        } catch (error) {
            console.error('Error syncing user to database:', error);
            // Don't throw error - user can still use the app even if sync fails
        }
    }, []);

    const loadUser = useCallback(async () => {
        // Check for temporary user data from auth callback first
        const tempUserData = localStorage.getItem('temp_auth_user');
        if (tempUserData) {
            try {
                const userData = JSON.parse(tempUserData);
                setUser(userData);
                setShowLoginModal(false);
                localStorage.removeItem('temp_auth_user'); // Clean up
                console.log("Loaded user from temporary storage after auth callback");
                return;
            } catch (e) {
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
        } catch (error) {
            // Only show "no session" message for 401 errors (not logged in)
            // Avoid showing for other errors like network issues
            if (error.code === 401) {
                console.log("No active session - user not logged in.");
            } else {
                console.log("Session check failed:", error.message);
            }
            setUser(null);
            setShowLoginModal(true);
        }
    }, [syncUserToDatabase]);

    useEffect(() => {
        loadUser();
    }, [loadUser]);

    const handleLogout = useCallback(async () => {
        try {
            await account.deleteSession('current');
            setUser(null);
            addToast('Logged out successfully');
        } catch (error) {
            console.error('Logout failed:', error);
            addToast('Failed to log out');
        }
    }, [addToast]);
    
    // This will be called by LoginModal and AuthCallback
    const handleLoginSuccess = useCallback(async (userFromCallback = null) => {
        if (userFromCallback) {
            // User data already available from auth callback
            setUser(userFromCallback);
            setShowLoginModal(false);
            addToast(`Welcome back!`);
            
            // Sync user to database
            await syncUserToDatabase(userFromCallback);
        } else {
            // Reload user data (e.g., from guest login)
            loadUser();
            addToast(`Welcome back!`);
        }
    }, [addToast, loadUser, syncUserToDatabase]);

    return { user, showLoginModal, handleLoginSuccess, handleLogout, setShowLoginModal };
};
