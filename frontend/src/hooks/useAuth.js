import { useState, useEffect, useCallback } from 'react';
import { account } from '../appwrite';

export const useAuth = (addToast) => {
    const [user, setUser] = useState(null);
    const [showLoginModal, setShowLoginModal] = useState(false);

    const loadUser = useCallback(async () => {
        try {
            const currentUser = await account.get();
            setUser(currentUser);
        } catch (error) {
            console.log("No user session found.");
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
