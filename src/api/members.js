import client from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const getMembers = async (page = 1, per_page = 20, search = '', min_age = null, max_age = null, faith = '', politics = '', work = '', diet = '') => {
    try {
        // Sprawdź czy user jest zalogowany
        const token = await AsyncStorage.getItem('userToken');
        if (!token) {
            throw new Error('Nie jesteś zalogowany');
        }

        const params = {
            page,
            per_page,
            search,
            populate_extras: true,
            type: 'active', // Ensure we get active members
        };

        if (min_age) params.min_age = min_age;
        if (max_age) params.max_age = max_age;
        if (faith) params.faith = faith;
        if (politics) params.politics = politics;
        if (work) params.work = work;
        if (diet) params.diet = diet;

        const response = await client.get('/sk/v1/members', {
            params
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getMember = async (id) => {
    try {
        const response = await client.get(`/sk/v1/member/${id}`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getXProfileGroups = async (userId) => {
    try {
        const response = await client.get(`/buddypress/v1/xprofile/groups`, {
            params: {
                user_id: userId === 'me' ? undefined : userId, // BuddyPress uses current user if user_id is not specified
                fetch_fields: true,
                fetch_field_data: true,
            },
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getMatches = async () => {
    try {
        const response = await client.get('/sk/v1/matches', {
            params: { populate_extras: true }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getLikedUsers = async () => {
    try {
        const response = await client.get('/sk/v1/liked', {
            params: { populate_extras: true }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getLikesMeUsers = async () => {
    try {
        const response = await client.get('/sk/v1/likes-me', {
            params: { populate_extras: true }
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const toggleLike = async (userId) => {
    try {
        const response = await client.post('/sk/v1/like', {
            user_id: userId
        });

        return response.data;
    } catch (error) {
        throw error;
    }
};

export const updateXProfileField = async (fieldId, value) => {
    try {
        // Use our custom REST API endpoint for xprofile updates
        const response = await client.post(`/sk/v1/xprofile/update`, {
            field_id: fieldId,
            value: value
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const updateMemberName = async (userId, name) => {
    try {
        const response = await client.post(`/buddypress/v1/members/${userId}`, {
            name: name
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

// Delete user account - required by Apple App Store
export const deleteAccount = async () => {
    try {
        const response = await client.delete('/sk/v1/delete-account');
        return response.data;
    } catch (error) {
        throw error;
    }
};
