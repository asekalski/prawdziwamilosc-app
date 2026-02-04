import client from './client';

export const getActivity = async (page = 1, per_page = 20) => {
    try {
        const response = await client.get('/sk/v1/activity', {
            params: {
                page,
                per_page,
                display_comments: 'stream'
            },
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const createPost = async (content) => {
    try {
        const response = await client.post('/sk/v1/activity', {
            content,
            type: 'activity_update',
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const deletePost = async (activityId) => {
    try {
        const response = await client.delete(`/sk/v1/activity/${activityId}`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const favoritePost = async (activityId) => {
    try {
        const response = await client.post(`/sk/v1/activity/${activityId}/favorite`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const unfavoritePost = async (activityId) => {
    try {
        const response = await client.delete(`/sk/v1/activity/${activityId}/favorite`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const addComment = async (activityId, content) => {
    try {
        const response = await client.post('/sk/v1/activity', {
            content,
            type: 'activity_comment',
            parent: activityId
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

