import AsyncStorage from '@react-native-async-storage/async-storage';
import client from './client';

const SKIPPED_USERS_KEY = 'pmSkippedUsers';

// Get list of skipped user IDs from local storage
export const getSkippedUserIds = async () => {
    try {
        const data = await AsyncStorage.getItem(SKIPPED_USERS_KEY);
        if (!data) return [];
        return JSON.parse(data);
    } catch {
        return [];
    }
};

// Add a user to the skipped list
export const addSkippedUser = async (userId) => {
    try {
        const skipped = await getSkippedUserIds();
        if (!skipped.includes(userId)) {
            skipped.push(userId);
            await AsyncStorage.setItem(SKIPPED_USERS_KEY, JSON.stringify(skipped));
        }
    } catch (error) {
        console.error('Failed to add skipped user:', error);
    }
};

// Remove a user from the skipped list (restore)
export const removeSkippedUser = async (userId) => {
    try {
        const skipped = await getSkippedUserIds();
        const filtered = skipped.filter(id => id !== userId);
        await AsyncStorage.setItem(SKIPPED_USERS_KEY, JSON.stringify(filtered));
    } catch (error) {
        console.error('Failed to remove skipped user:', error);
    }
};

// Get full user data for skipped users
export const getSkippedUsers = async () => {
    try {
        const ids = await getSkippedUserIds();
        if (ids.length === 0) return [];

        const response = await client.get('/sk/v1/members', {
            params: {
                include: ids.join(','),
            },
        });
        return response.data;
    } catch (error) {
        console.error('Failed to fetch skipped users:', error);
        return [];
    }
};

// Restore user (remove from skipped)
export const restoreUser = async (userId) => {
    await removeSkippedUser(userId);
};

// Like user (API call + remove from skipped)
export const likeSkippedUser = async (userId) => {
    try {
        const response = await client.post('/sk/v1/like', { user_id: userId });
        await removeSkippedUser(userId);
        return response.data;
    } catch (error) {
        console.error('Error liking user:', error);
        throw error;
    }
};
