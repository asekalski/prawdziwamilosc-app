import client from './client';

export const getNotifications = async () => {
    try {
        const response = await client.get('/sk/v1/notifications');
        return response.data;
    } catch (error) {
        console.error('Error fetching notifications:', error);
        throw error;
    }
};

export const deleteNotification = async (id) => {
    try {
        const response = await client.delete(`/sk/v1/notifications/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting notification:', error);
        throw error;
    }
};
export const markNotificationRead = async (id = null) => {
    try {
        const response = await client.post('/sk/v1/notifications/mark-read', { id });
        return response.data;
    } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
};
