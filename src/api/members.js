import client from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const getMembers = async (page = 1, per_page = 20, search = '') => {
    try {
        // Sprawdź czy user jest zalogowany
        const token = await AsyncStorage.getItem('userToken');
        if (!token) {
            throw new Error('Nie jesteś zalogowany');
        }

        const response = await client.get('/buddypress/v1/members', {
            params: {
                page,
                per_page,
                search,
                populate_extras: true,
            },
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getMember = async (id) => {
    try {
        const response = await client.get(`/buddypress/v1/members/${id}`, {
            params: {
                populate_extras: true,
            },
        });
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
        const response = await client.get('/sk/v1/matches');
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
