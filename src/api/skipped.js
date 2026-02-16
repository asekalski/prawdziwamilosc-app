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

// Add a user to the skipped list (Block)
export const addSkippedUser = async (userId) => {
    try {
        // 1. Call Backend
        await client.post('/sk/v1/block', {
            user_id: userId,
            action: 'block'
        });

        // 2. Update Local Storage
        const skipped = await getSkippedUserIds();
        if (!skipped.includes(userId)) {
            skipped.push(userId);
            await AsyncStorage.setItem(SKIPPED_USERS_KEY, JSON.stringify(skipped));
        }
    } catch (error) {
        console.error('Failed to add skipped user:', error);
        // Fallback: still add to local storage if API fails? 
        // For now, let's allow "offline blocking" (optimistic) or just fail silent.
        // Better option: Force Local Block even if API fails (Optimistic UI)
        try {
            const skipped = await getSkippedUserIds();
            if (!skipped.includes(userId)) {
                skipped.push(userId);
                await AsyncStorage.setItem(SKIPPED_USERS_KEY, JSON.stringify(skipped));
            }
        } catch (e) { }
    }
};

// Remove a user from the skipped list (Unblock)
export const removeSkippedUser = async (userId) => {
    try {
        // 1. Call Backend
        await client.post('/sk/v1/block', {
            user_id: userId,
            action: 'unblock'
        });

        // 2. Update Local Storage
        const skipped = await getSkippedUserIds();
        const filtered = skipped.filter(id => id !== userId);
        await AsyncStorage.setItem(SKIPPED_USERS_KEY, JSON.stringify(filtered));
    } catch (error) {
        console.error('Failed to remove skipped user:', error);
        // Optimistic Unblock
        try {
            const skipped = await getSkippedUserIds();
            const filtered = skipped.filter(id => id !== userId);
            await AsyncStorage.setItem(SKIPPED_USERS_KEY, JSON.stringify(filtered));
        } catch (e) { }
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

// Sync local skipped list with server's blocked list
export const syncSkippedWithServer = async () => {
    try {
        const response = await client.get('/sk/v1/blocked');
        const serverBlocked = (response.data || []).map(id => Number(id));

        if (serverBlocked.length === 0) return;

        // Merge server blocked IDs into local storage
        const localSkipped = await getSkippedUserIds();
        const merged = [...new Set([...localSkipped.map(Number), ...serverBlocked])];

        await AsyncStorage.setItem(SKIPPED_USERS_KEY, JSON.stringify(merged));
    } catch (error) {
        console.error('Failed to sync skipped users with server:', error);
        // Not critical — local list will still work
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

// Add to local storage ONLY (for cases where backend update is handled elsewhere, e.g., thread deletion)
export const addLocalSkippedUser = async (userId) => {
    try {
        const skipped = await getSkippedUserIds();
        if (!skipped.includes(userId)) {
            skipped.push(userId);
            await AsyncStorage.setItem(SKIPPED_USERS_KEY, JSON.stringify(skipped));
        }
    } catch (e) {
        console.error('Failed to add local skipped user:', e);
    }
};
