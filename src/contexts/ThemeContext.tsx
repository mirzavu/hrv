'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface ThemeContextType {
    darkMode: boolean;
    toggleDarkMode: () => void;
    setDarkMode: (value: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [darkMode, setDarkMode] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Check local storage or system preference on mount
        const stored = localStorage.getItem('darkMode');
        if (stored) {
            setDarkMode(JSON.parse(stored));
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setDarkMode(true);
        }
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        // Update body class
        if (darkMode) {
            document.body.classList.add('dark');
            document.body.className = 'bg-gray-900'; // Global background for consistency
        } else {
            document.body.classList.remove('dark');
            document.body.className = 'bg-gray-100'; // Global background for consistency
        }

        // Persist to local storage
        localStorage.setItem('darkMode', JSON.stringify(darkMode));
    }, [darkMode, mounted]);

    const toggleDarkMode = () => {
        setDarkMode((prev) => !prev);
    };

    if (!mounted) {
        // Prevent hydration mismatch by not rendering the body class manipulation logic yet,
        // but WE MUST RENDER THE PROVIDER so useTheme doesn't crash during SSR/hydration.
        // We can just render the provider with default values.
    }

    return (
        <ThemeContext.Provider value={{ darkMode, toggleDarkMode, setDarkMode }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
