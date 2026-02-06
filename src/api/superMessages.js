import client from './client';

/**
 * Get Super Message status (remaining messages, premium status, cooldowns)
 */
export const getSuperMessageStatus = async () => {
    try {
        const response = await client.get('/sk/v1/super-message/status');
        return response.data;
    } catch (error) {
        console.error('Failed to get super message status:', error);
        throw error;
    }
};

/**
 * Send a Super Message to a recipient
 */
export const sendSuperMessage = async (recipientId, message) => {
    try {
        const response = await client.post('/sk/v1/super-message/send', {
            to_user_id: recipientId,
            message: message,
        });
        return response.data;
    } catch (error) {
        // Only log to console if it's a real error (not 400 validation)
        if (!error.response || error.response.status !== 400) {
            console.error('Failed to send super message:', error);
        }
        throw error;
    }
};
