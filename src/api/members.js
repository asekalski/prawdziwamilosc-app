import client from './client';

export const getMembers = async (page = 1, per_page = 20, search = '') => {
    try {
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

