import { useState, useEffect, useCallback } from 'react';

export const useAuth = (addToast) => {
    const [user, setUser] = useState(null);
    const [authToken, setAuthToken] = useState(null);
    const [showLoginModal, setShowLoginModal] = useState(false);

    useEffect(() => {
        const savedUser = localStorage.getItem('hrv_user');
        if (savedUser) {
            setUser(JSON.parse(savedUser));
        } else {
            setShowLoginModal(true);
        }
    }, []);

    const handleLoginSuccess = useCallback((userData, token) => {
        setUser(userData);
        setAuthToken(token);
        if (userData && userData.id !== 'guest') {
            localStorage.setItem('hrv_user', JSON.stringify(userData));
        }
        setShowLoginModal(false);
        addToast(`Welcome ${userData.name || userData.email || 'User'}!`);
    }, [addToast]);

    const handleLogout = useCallback(() => {
        setUser(null);
        setAuthToken(null);
        localStorage.removeItem('hrv_user');
        addToast('Logged out successfully');
    }, [addToast]);
    
    // Effect to handle guest session transfer
    useEffect(() => {
        const transferGuestSession = async () => {
            const guestSessionJSON = localStorage.getItem('hrv_guest_session');

            if (guestSessionJSON && authToken && user && user.id !== 'guest') {
                try {
                    const sessionData = JSON.parse(guestSessionJSON);
                    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/hrv/session`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`,
                        },
                        body: JSON.stringify(sessionData),
                    });

                    if (response.ok) {
                        addToast('Your guest session has been saved to your new account!');
                    } else {
                        addToast('Could not save your previous guest session.');
                    }
                } catch (error) {
                    console.error('Error processing guest session:', error);
                } finally {
                    localStorage.removeItem('hrv_guest_session');
                }
            }
        };

        transferGuestSession();
    }, [authToken, user, addToast]);

    return { user, authToken, showLoginModal, handleLoginSuccess, handleLogout, setShowLoginModal };
};
