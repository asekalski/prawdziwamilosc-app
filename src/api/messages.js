import client from './client';

export const getThreads = async (page = 1, per_page = 20) => {
    try {
        console.log('Fetching threads from Better Messages API');
        const response = await client.get('/better-messages/v1/threads', {
            params: {
                page,
                per_page,
            },
        });
        console.log('Better Messages response:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error fetching Better Messages threads:', error.response?.data || error.message);
        // Fallback to standard BuddyPress if Better Messages fails
        try {
            console.log('Falling back to BuddyPress messages endpoint');
            const fallbackResponse = await client.get('/buddypress/v1/messages', {
                params: {
                    page,
                    per_page,
                    box: 'inbox',
                },
            });
            console.log('BuddyPress fallback response:', fallbackResponse.data);
            return fallbackResponse.data;
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError.message);
            throw error;
        }
    }
};

export const getThread = async (threadId) => {
    try {
        // Try Better Messages first
        const response = await client.get(`/better-messages/v1/thread/${threadId}`);
        return response.data;
    } catch (error) {
        // Fallback to BuddyPress
        try {
            const fallbackResponse = await client.get(`/buddypress/v1/messages/${threadId}`);
            return fallbackResponse.data;
        } catch (fallbackError) {
            throw error;
        }
    }
}

export const sendMessage = async (recipientId, subject, message) => {
    try {
        const response = await client.post('/buddypress/v1/messages', {
            recipients: [recipientId],
            subject,
            message,
        });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const replyToThread = async (threadId, message, recipientId) => {
    try {
        console.log(`Replying to thread ${threadId} via Better Messages`);

        // Try alternative endpoints
        try {
            // Attempt 1: POST /thread/{id}/send with different params
            // 500 error suggests we might be close but sending wrong data type
            console.log('Attempting POST /send with "message" param');
            const response = await client.post(`/better-messages/v1/thread/${threadId}/send`, {
                message: message, // Try 'message' instead of 'content'
                content: message, // Send both just in case
                type: 'text',
                receiver_id: recipientId // Try singular receiver_id
            });
            console.log('Better Messages POST /send success:', response.data);
            return response.data;
        } catch (e1) {
            console.log('Attempt 1 (POST /send) failed:', e1.response?.status, e1.response?.data);

            try {
                // Attempt 2: POST /thread/{id}/message
                console.log('Attempting POST /message endpoint');
                const response = await client.post(`/better-messages/v1/thread/${threadId}/message`, {
                    content: message,
                    type: 'text'
                });
                console.log('Better Messages POST /message success:', response.data);
                return response.data;
            } catch (e2) {
                console.log('Attempt 2 (POST /message) failed:', e2.response?.status);
                throw e2;
            }
        }
    } catch (error) {
        console.error('All Better Messages endpoints failed');

        // Fallback to BuddyPress
        try {
            console.log('Falling back to BuddyPress reply with recipients');
            // Check if we have a mapping or if threadId is actually a BP ID?
            // If threadId is from BM, it might not match BP.

            const params = {
                thread_id: threadId,
                message,
            };

            if (recipientId) {
                params.recipients = [recipientId];
            }

            const response = await client.post('/buddypress/v1/messages', params);
            console.log('BuddyPress fallback success:', response.data);

            if (response.data[0] && response.data[0].id != threadId) {
                console.warn('BuddyPress created a new thread instead of replying!', response.data[0].id);
            }

            return response.data;
        } catch (fallbackError) {
            console.error('BuddyPress fallback failed:', fallbackError.response?.data || fallbackError.message);
            throw error;
        }
    }
}
