import React, { createContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser } from '../api/auth';
import { Alert } from 'react-native';
import { registerForPushNotificationsAsync, setNotificationSuppressionState } from '../services/NotificationService';
import { getSkippedUserIds } from '../api/skipped';
import * as Notifications from 'expo-notifications';


export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [userToken, setUserToken] = useState(null);
    const [userInfo, setUserInfo] = useState(null);

    // Use Ref to track current token in intervals/async closures
    const userTokenRef = useRef(userToken);
    useEffect(() => {
        userTokenRef.current = userToken;
    }, [userToken]);

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
            console.log('Token received:', token ? `${token.substring(0, 10)}...` : 'NONE');

            // 1. Validate Token
            if (!token) {
                console.error('Login successful but no token returned!');
                setIsLoading(false);
                return { success: false, error: 'Błąd serwera: brak tokenu autoryzacji' };
            }

            // Fetch correct ID from WordPress
            const meData = await fetchMe(token);

            // 2. Validate Profile Fetch
            if (!meData) {
                console.error('Failed to fetch user profile after login!');
                setIsLoading(false);
                // We should probably logout/clear token here just in case
                return { success: false, error: 'Nie udało się pobrać profilu użytkownika. Spróbuj ponownie.' };
            }

            const userId = meData.id || data.user_id;

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
            try {
                const pushToken = await registerForPushNotificationsAsync();
                if (pushToken) {
                    await updatePushTokenOnServer(pushToken, token);
                }
            } catch (err) {
                Alert.alert("Push Error", err.message);
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
        userTokenRef.current = null; // Immediate ref update to stop intervals
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('userInfo');
        setIsLoading(false);
    };

    const deleteAccount = async () => {
        setIsLoading(true);
        try {
            const { default: client } = await import('../api/client');
            // 1. Call API to delete account
            await client.delete('/sk/v1/delete-account');

            // 2. Clear local state immediately to stop polling
            setUserToken(null);
            setUserInfo(null);
            userTokenRef.current = null;
            await AsyncStorage.removeItem('userToken');
            await AsyncStorage.removeItem('userInfo');

            return { success: true };
        } catch (error) {
            console.error('Delete account error:', error);
            // Even if server error, we might want to logout locally? 
            // For now, return error to let user retry or contact support.
            return { success: false, error: error.response?.data?.message || 'Failed to delete account' };
        } finally {
            setIsLoading(false);
        }
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
                    try {
                        const pushToken = await registerForPushNotificationsAsync();
                        if (pushToken) {
                            await updatePushTokenOnServer(pushToken, token);
                        } else {
                            // Alert.alert("Debug", "Notification Token is null");
                        }
                    } catch (err) {
                        Alert.alert("Push Error (Startup)", err.message);
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

    useEffect(() => {
        setNotificationSuppressionState({
            activeThreadId: activeThreadId,
            currentUserId: userInfo?.id
        });
    }, [activeThreadId, userInfo?.id]);

    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
    const [activeThreadId, setActiveThreadId] = useState(null);
    const locallyReadThreadIds = useRef(new Set());

    const markThreadReadLocally = (threadId) => {
        if (!threadId) return;
        locallyReadThreadIds.current.add(threadId.toString());
        // Trigger refresh immediately
        refreshUnreadCount();
    };

    const resetUnreadCount = async () => {
        if (!userTokenRef.current) return;
        try {
            const { getUnreadCount } = await import('../api/messages');
            // Force clear on server
            await getUnreadCount(true);
            // Clear local masks
            locallyReadThreadIds.current.clear();
            // Full refresh
            await refreshUnreadCount();
        } catch (error) {
            console.log('Error resetting unread count:', error);
        }
    };

    const refreshUnreadCount = async (forceThreads = null, recentlyReadThreadId = null) => {
        // Use Ref to ensure we have the LATEST token status, not a stale closure one
        if (!userTokenRef.current) {
            setUnreadMessagesCount(0);
            return;
        }
        try {
            const { getThreads, getUnreadCount } = await import('../api/messages');
            const { getSkippedUserIds } = await import('../api/skipped');

            // Double check after async import
            if (!userTokenRef.current) return;

            // 1. Fetch unread IDs and total from our fast endpoint
            const unreadData = await getUnreadCount();
            const serverUnreadIds = unreadData?.unread_thread_ids ?? [];
            const serverTotalCount = unreadData?.unread_count ?? 0;

            console.log(`[Badge] Poll Result: count=${serverTotalCount}, ids=${JSON.stringify(serverUnreadIds)}`);
            console.log(`[Badge] Current Mask: ${JSON.stringify(Array.from(locallyReadThreadIds.current))}`);

            // Sync: If server says 0, clear local masks to keep things clean
            if (serverTotalCount === 0 && locallyReadThreadIds.current.size > 0) {
                locallyReadThreadIds.current.clear();
            }

            // Filter server unread IDs against our local recently-read mask
            const filteredServerIds = serverUnreadIds.filter(id => !locallyReadThreadIds.current.has(id.toString()));

            // Get blocked users to filter them out (matched with MessagesScreen.js)
            let blockedIds = [];
            try {
                blockedIds = await getSkippedUserIds();
                blockedIds = blockedIds.map(id => id.toString());
            } catch (err) {
                console.log('Failed to fetch blocked IDs for unread filtering:', err);
            }

            // 2. Fetch the current message list if needed
            let threadsArray = forceThreads || [];
            if (!forceThreads) {
                const data = await getThreads(1, 20);
                threadsArray = data?.threads || [];
            }

            // 3. Filter list threads against our mask and blocked list
            const unreadThreadsFromList = threadsArray.filter(t => {
                const isUnread = String(t.unread) === '1' || t.unread_count > 0 || t.is_new === '1';
                const id = (t.thread_id || t.id)?.toString();

                // Mask if locally read
                if (locallyReadThreadIds.current.has(id)) return false;

                // Filter out blocked users
                const participants = t.participants || [];
                const otherParticipants = participants
                    .map(p => (p.user_id || p).toString())
                    .filter(pid => userInfo?.id && pid != userInfo.id.toString());
                const isBlocked = otherParticipants.some(pid => blockedIds.includes(pid));
                if (isBlocked) return false;

                return isUnread;
            });

            // 4. Calculate Final Badge Count
            // CRITICAL FIX: We prioritize the count of verified thread IDs.
            // If the server provides IDs, we use the filtered length.
            // If the server provides NO IDs, we set the count to 0 to prevent "ghost badges".
            let finalBadgeCount = (serverUnreadIds.length > 0) ? filteredServerIds.length : 0;

            // If we have local masks, and the server still thinks those threads are unread, subtract them.
            // (This is mostly redundant if we use filteredServerIds.length, but kept for safety if logic changes)
            if (serverUnreadIds.length > 0) {
                locallyReadThreadIds.current.forEach(maskedId => {
                    if (serverUnreadIds.includes(parseInt(maskedId)) || serverUnreadIds.includes(maskedId.toString())) {
                        // Already handled by filteredServerIds.length above if used
                    }
                });
            }

            // --- VERBOSE LOGGING FOR FLICKER DEBUG ---
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${timestamp}] BADGE REFRESH:`, {
                serverTotal: serverTotalCount,
                serverIds: serverUnreadIds,
                localMask: Array.from(locallyReadThreadIds.current),
                finalBadge: finalBadgeCount
            });

            setUnreadMessagesCount(finalBadgeCount);
            Notifications.setBadgeCountAsync(finalBadgeCount);
        } catch (error) {
            console.log('Error refreshing unread count:', error);
        }
    };

    useEffect(() => {
        let interval;
        if (userToken) {
            refreshUnreadCount();
            interval = setInterval(refreshUnreadCount, 5000); // 5s refresh for quick updates
        } else {
            setUnreadMessagesCount(0);
            Notifications.setBadgeCountAsync(0).catch(err => console.log('Error clearing badge on logout:', err));
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [userToken]);

    // Handle AppState foreground refresh
    useEffect(() => {
        const { AppState } = require('react-native');
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active' && userToken) {
                console.log('App in foreground: refreshing unread count...');
                refreshUnreadCount();
            }
        });
        return () => subscription.remove();
    }, [userToken]);

    // Handle Incoming Notifications (Foreground)
    useEffect(() => {
        const subscription = Notifications.addNotificationReceivedListener(notification => {
            const data = notification.request.content.data;
            console.log('Notification received in foreground:', notification);

            // Immediate UI update if unread_count is provided in push data
            if (data?.unread_count !== undefined) {
                const count = parseInt(data.unread_count);
                if (!isNaN(count)) {
                    console.log('Setting unread count from push data:', count);

                    // CRITICAL: If data contains thread_id, clear it from local read masks 
                    // before refreshUnreadCount() runs so the count doesn't flicker/reset.
                    if (data?.thread_id) {
                        const tId = data.thread_id.toString();
                        if (locallyReadThreadIds.current.has(tId)) {
                            locallyReadThreadIds.current.delete(tId);
                        }
                    }

                    setUnreadMessagesCount(count);
                    Notifications.setBadgeCountAsync(count).catch(() => { });
                }
            }

            // Still refresh to sync full state/masks
            if (userTokenRef.current) {
                refreshUnreadCount();
            }
        });
        return () => subscription.remove();
    }, [userToken]);

    const updateUserInfo = async (updates) => {
        const newUserInfo = { ...userInfo, ...updates };
        setUserInfo(newUserInfo);
        await AsyncStorage.setItem('userInfo', JSON.stringify(newUserInfo));
        console.log('AsyncStorage updated with:', JSON.stringify(updates));
    };

    return (
        <AuthContext.Provider value={{
            login, logout, deleteAccount, isLoading,
            userToken, userInfo, setUserInfo, updateUserInfo,
            unreadMessagesCount, refreshUnreadCount, resetUnreadCount, markThreadReadLocally,
            activeThreadId, setActiveThreadId
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => React.useContext(AuthContext);
