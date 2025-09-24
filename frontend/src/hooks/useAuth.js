import { useState, useEffect, useCallback } from 'react';
import { account } from '../appwrite';

// Note: Session cookies are HttpOnly and not accessible via document.cookie
// We'll rely on the API call to check authentication status

export const useAuth = (addToast) => {
    const [user, setUser] = useState(null);
    const [showLoginModal, setShowLoginModal] = useState(false);

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
    }, []);

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
    const handleLoginSuccess = useCallback((userFromCallback = null) => {
        if (userFromCallback) {
            // User data already available from auth callback
            setUser(userFromCallback);
            setShowLoginModal(false);
            addToast(`Welcome back!`);
        } else {
            // Reload user data (e.g., from guest login)
            loadUser();
            addToast(`Welcome back!`);
        }
    }, [addToast, loadUser]);

    return { user, showLoginModal, handleLoginSuccess, handleLogout, setShowLoginModal };
};
