import { useState, useEffect, useCallback } from 'react';
import { account } from '../appwrite';

// Utility function to check if session cookie exists
const hasSessionCookie = () => {
    return document.cookie.includes('a_session_hrv-app_legacy');
};

export const useAuth = (addToast) => {
    const [user, setUser] = useState(null);
    const [showLoginModal, setShowLoginModal] = useState(false);

    const loadUser = useCallback(async () => {
        // Check if session cookie exists before making API call
        if (!hasSessionCookie()) {
            console.log("No session cookie found - user not logged in.");
            setUser(null);
            setShowLoginModal(true);
            return;
        }

        try {
            const currentUser = await account.get();
            setUser(currentUser);
        } catch (error) {
            console.log("Session expired or invalid.");
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
    
    // This will be called by LoginModal now
    const handleLoginSuccess = useCallback(() => {
        loadUser();
        setShowLoginModal(false);
        addToast(`Welcome back!`);
    }, [addToast, loadUser]);

    return { user, showLoginModal, handleLoginSuccess, handleLogout, setShowLoginModal };
};
