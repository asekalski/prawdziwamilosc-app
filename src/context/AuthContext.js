import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser } from '../api/auth';
import { registerForPushNotificationsAsync } from '../services/NotificationService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [userToken, setUserToken] = useState(null);
    const [userInfo, setUserInfo] = useState(null);

    const updatePushTokenOnServer = async (token, userToken) => {
        try {
            const { default: client } = await import('../api/client');
            await client.post('/sk/v1/update-push-token', {
                push_token: token
            }, {
                headers: { Authorization: `Bearer ${userToken}` }
            });
            console.log('Push token successfully registered/updated on server');
        } catch (error) {
            console.log('Error updating push token on server:', error);
        }
    };

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

            // Extract gender (ID 129)
            let gender = null;
            if (meData?.xprofile?.groups) {
                for (const group of meData.xprofile.groups) {
                    if (group.fields) {
                        for (const field of group.fields) {
                            if (field.id == 129) {
                                gender = field.value?.raw || field.value?.rendered || field.value;
                                break;
                            }
                        }
                    }
                    if (gender) break;
                }
            }

            const user = {
                email: data.user_email,
                nicename: data.user_nicename,
                displayName: data.user_display_name,
                id: userId,
                avatar_urls: meData?.avatar_urls,
                roles: meData?.roles || [],
                onboardingComplete: meData?.onboarding_complete ?? false,
                gender: gender,
            };

            setUserToken(token);
            setUserInfo(user);
            await AsyncStorage.setItem('userToken', token);
            await AsyncStorage.setItem('userInfo', JSON.stringify(user));

            console.log('Token saved to AsyncStorage. UserID:', userId);

            // Handle Push Notifications
            const pushToken = await registerForPushNotificationsAsync();
            if (pushToken) {
                await updatePushTokenOnServer(pushToken, token);
            }

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
                    // Extract gender (ID 129)
                    let gender = null;
                    if (meData?.xprofile?.groups) {
                        for (const group of meData.xprofile.groups) {
                            if (group.fields) {
                                for (const field of group.fields) {
                                    if (field.id == 129) {
                                        gender = field.value?.raw || field.value?.rendered || field.value;
                                        break;
                                    }
                                }
                            }
                            if (gender) break;
                        }
                    }

                    const updatedInfo = {
                        ...info,
                        id: meData.id,
                        avatar_urls: meData.avatar_urls,
                        roles: meData.roles || [],
                        onboardingComplete: meData.onboarding_complete ?? false,
                        gender: gender || info.gender,
                    };
                    info = updatedInfo;
                    await AsyncStorage.setItem('userInfo', JSON.stringify(updatedInfo));
                    console.log('User data synced from server. Onboarding:', info.onboardingComplete, 'Gender:', info.gender);

                    setUserToken(token);
                    setUserInfo(info);

                    // Check/Update push token on startup
                    const pushToken = await registerForPushNotificationsAsync();
                    if (pushToken) {
                        await updatePushTokenOnServer(pushToken, token);
                    }
                } else {
                    // Token is invalid/issuer mismatch, clear it
                    console.log('fetchMe failed on startup, clearing session...');
                    await logout();
                }
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

    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

    const refreshUnreadCount = async (providedThreads = null) => {
        if (!userToken) return;
        try {
            let threadsArray = providedThreads;
            if (!threadsArray) {
                // Small delay to ensure server persistence and cache clearing is complete
                await new Promise(resolve => setTimeout(resolve, 800));

                const { getThreads } = await import('../api/messages');
                const data = await getThreads(1, 50);
                threadsArray = data.threads || data || [];
            }

            // De-duplicate threads (same logic as MessagesScreen.js)
            const uniqueThreads = [];
            const seenRecipients = new Set();

            threadsArray.forEach(thread => {
                if (!thread) return;
                const participants = thread.participants || [];
                const otherParticipants = participants
                    .map(p => p.user_id || p)
                    .filter(id => userInfo?.id && id != userInfo.id);

                if (otherParticipants.length === 1 && otherParticipants[0]) {
                    const recipientId = otherParticipants[0].toString();
                    if (seenRecipients.has(recipientId)) {
                        return; // Skip duplicate
                    }
                    seenRecipients.add(recipientId);
                }
                uniqueThreads.push(thread);
            });

            const unreadThreads = uniqueThreads.filter(t => t.unread > 0 && (t.thread_id || t.id));
            const count = unreadThreads.length;
            setUnreadMessagesCount(count);

            if (count > 0) {
                const unreadDetails = unreadThreads
                    .map(t => {
                        const tid = t.thread_id || t.id;
                        if (!tid) {
                            console.log('DEBUG: Ghost thread detected:', JSON.stringify(t));
                            return `Ghost(Title: ${t.title || t.subject || 'N/A'}): ${t.unread}`;
                        }
                        return `Thread ${tid}: ${t.unread} unread`;
                    })
                    .join(', ');
                console.log(`Unread count refreshed: ${count} (${unreadDetails})`);
            } else {
                console.log('Unread count refreshed: 0');
            }
        } catch (error) {
            console.log('Error refreshing unread count:', error);
        }
    };

    useEffect(() => {
        let interval;
        if (userToken) {
            refreshUnreadCount();
            interval = setInterval(refreshUnreadCount, 30000); // 30s refresh
        } else {
            setUnreadMessagesCount(0);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [userToken]);

    const updateUserInfo = async (updates) => {
        const newUserInfo = { ...userInfo, ...updates };
        setUserInfo(newUserInfo);
        await AsyncStorage.setItem('userInfo', JSON.stringify(newUserInfo));
        console.log('AsyncStorage updated with:', JSON.stringify(updates));
    };

    return (
        <AuthContext.Provider value={{ login, logout, isLoading, userToken, userInfo, setUserInfo, updateUserInfo, unreadMessagesCount, refreshUnreadCount }}>
            {children}
        </AuthContext.Provider>
    );
};
