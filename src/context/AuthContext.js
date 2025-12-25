import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser } from '../api/auth';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [userToken, setUserToken] = useState(null);
    const [userInfo, setUserInfo] = useState(null);

    const login = async (username, password) => {
        setIsLoading(true);
        try {
            const data = await loginUser(username, password);
            console.log('Login response:', JSON.stringify(data, null, 2));

            const token = data.token;
            console.log('Token received:', token);

            const user = {
                email: data.user_email,
                nicename: data.user_nicename,
                displayName: data.user_display_name,
                id: data.user_id, // Sometimes returned, useful for profile
            };

            setUserToken(token);
            setUserInfo(user);
            await AsyncStorage.setItem('userToken', token);
            await AsyncStorage.setItem('userInfo', JSON.stringify(user));

            console.log('Token saved to AsyncStorage');

            setIsLoading(false);
            return { success: true };
        } catch (error) {
            setIsLoading(false);
            console.log(error);
            return { success: false, error: error.response?.data?.message || 'Login failed' };
        }
    };

    const logout = async () => {
        setIsLoading(true);
        setUserToken(null);
        setUserInfo(null);
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('userInfo');
        setIsLoading(false);
    };

    const isLoggedIn = async () => {
        try {
            setIsLoading(true);
            let userToken = await AsyncStorage.getItem('userToken');
            let userInfo = await AsyncStorage.getItem('userInfo');

            if (userInfo) {
                userInfo = JSON.parse(userInfo);
            }

            if (userToken) {
                setUserToken(userToken);
                setUserInfo(userInfo);
            }
            setIsLoading(false);
        } catch (e) {
            console.log(`isLoggedIn error ${e}`);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        isLoggedIn();

        // Check token validity periodically
        const interval = setInterval(async () => {
            const token = await AsyncStorage.getItem('userToken');
            if (!token && userToken) {
                // Token was cleared externally (e.g., by interceptor)
                console.log('Token cleared externally, logging out...');
                setUserToken(null);
                setUserInfo(null);
            }
        }, 1000); // Check every second

        return () => clearInterval(interval);
    }, [userToken]);

    return (
        <AuthContext.Provider value={{ login, logout, isLoading, userToken, userInfo }}>
            {children}
        </AuthContext.Provider>
    );
};
