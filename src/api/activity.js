import client from './client';

export const getActivity = async (page = 1, per_page = 20) => {
    try {
        const response = await client.get('/buddypress/v1/activity', {
            params: {
                page,
                per_page,
            },
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};
