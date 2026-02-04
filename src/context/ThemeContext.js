import React, { createContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const scheme = useColorScheme();
    const [isDark, setIsDark] = useState(scheme === 'dark');

    useEffect(() => {
        setIsDark(scheme === 'dark');
    }, [scheme]);

    const toggleTheme = () => {
        setIsDark(!isDark);
    };

    const theme = isDark ? DarkTheme : DefaultTheme;

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme, theme }}>
            {children}
        </ThemeContext.Provider>
    );
};
