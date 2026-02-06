import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser } from '../api/auth';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [userToken, setUserToken] = useState(null);
    const [userInfo, setUserInfo] = useState(null);

    // Helper to get full user data (ID is critical)
    const fetchMe = async (token) => {
        try {
            const { default: client } = await import('../api/client');
            // We can't rely on client interceptor seamlessly yet because token might not be in storage
            // when we call this immediately after login. So we pass headers explicitly if needed,
            // or ensure storage is set.
            const response = await client.get('/sk/v1/member/me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.log('fetchMe error:', error);
            return null;
        }
    };

    const login = async (username, password) => {
        setIsLoading(true);
        try {
            const data = await loginUser(username, password);
            console.log('Login response:', JSON.stringify(data, null, 2));

            const token = data.token;
            console.log('Token received:', token);

            // Fetch correct ID from WordPress
            const meData = await fetchMe(token);
            const userId = meData?.id || data.user_id;

            const user = {
                email: data.user_email,
                nicename: data.user_nicename,
                displayName: data.user_display_name,
                id: userId,
                avatar_urls: meData?.avatar_urls,
                onboardingComplete: meData?.onboarding_complete ?? false,
            };

            setUserToken(token);
            setUserInfo(user);
            await AsyncStorage.setItem('userToken', token);
            await AsyncStorage.setItem('userInfo', JSON.stringify(user));

            console.log('Token saved to AsyncStorage. UserID:', userId);

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
            let token = await AsyncStorage.getItem('userToken');
            let info = await AsyncStorage.getItem('userInfo');

            if (info) {
                info = JSON.parse(info);
            }

            if (token) {
                // Always try to refresh critical data from backend on startup
                const meData = await fetchMe(token);
                if (meData) {
                    const updatedInfo = {
                        ...info,
                        id: meData.id,
                        avatar_urls: meData.avatar_urls,
                        onboardingComplete: meData.onboarding_complete ?? false,
                    };
                    info = updatedInfo;
                    await AsyncStorage.setItem('userInfo', JSON.stringify(updatedInfo));
                    console.log('User data synced from server. Onboarding:', info.onboardingComplete);
                }

                setUserToken(token);
                setUserInfo(info);
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

    const updateUserInfo = async (updates) => {
        const newUserInfo = { ...userInfo, ...updates };
        setUserInfo(newUserInfo);
        await AsyncStorage.setItem('userInfo', JSON.stringify(newUserInfo));
        console.log('AsyncStorage updated with:', JSON.stringify(updates));
    };

    return (
        <AuthContext.Provider value={{ login, logout, isLoading, userToken, userInfo, setUserInfo, updateUserInfo }}>
            {children}
        </AuthContext.Provider>
    );
};
