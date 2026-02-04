import client from './client';

export const getThreads = async (page = 1, per_page = 20) => {
    try {
        // Use Better Messages API - this is what the web portal uses
        console.log('Fetching threads from Better Messages API');
        const response = await client.get('/better-messages/v1/threads', {
            params: {
                page,
                per_page,
            },
        });
        console.log('Better Messages response threads count:', response.data?.threads?.length || 0);
        return response.data;
    } catch (error) {
        console.error('Error fetching Better Messages threads:', error.response?.data || error.message);
        throw error;
    }
};

export const getThread = async (threadId) => {
    try {
        const response = await client.get(`/better-messages/v1/thread/${threadId}`);
        return response.data;
    } catch (error) {
        try {
            const fallbackResponse = await client.get(`/buddypress/v1/messages/${threadId}`);
            return fallbackResponse.data;
        } catch (fallbackError) {
            throw error;
        }
    }
}

export const sendMessage = async (recipientId, subject, message) => {
    console.log('sendMessage called with:', { recipientId, subject, message });

    try {
        // Step 1: Get or create private thread with this user
        console.log('Getting private thread with user:', recipientId);
        const threadResponse = await client.post('/better-messages/v1/getPrivateThread', {
            user_id: recipientId
        });
        console.log('getPrivateThread response:', threadResponse.data);

        const threadId = threadResponse.data?.thread_id || threadResponse.data?.id || threadResponse.data;

        if (!threadId) {
            throw new Error('Could not get thread ID');
        }

        // Step 2: Send message to this thread
        console.log('Sending message to thread:', threadId);
        const sendResponse = await client.post(`/better-messages/v1/thread/${threadId}/send`, {
            message: message,
            content: message,
            tempId: Date.now().toString()
        });
        console.log('Send message response:', sendResponse.data);

        return sendResponse.data;
    } catch (error) {
        console.error('Better Messages send error:', error.response?.status, error.response?.data || error.message);

        // Fallback: try thread/new endpoint
        try {
            console.log('Trying /thread/new endpoint');
            const newThreadResponse = await client.post('/better-messages/v1/thread/new', {
                recipients: [recipientId],
                message: message,
                content: message,
                subject: subject || 'Nowa wiadomość'
            });
            console.log('thread/new response:', newThreadResponse.data);
            return newThreadResponse.data;
        } catch (fallbackError) {
            console.error('thread/new also failed:', fallbackError.response?.status, fallbackError.response?.data);
            throw fallbackError;
        }
    }
}

export const replyToThread = async (threadId, message, recipientId) => {
    try {
        console.log(`Replying to thread ${threadId}`);

        // Use BuddyPress to reply
        const params = {
            thread_id: threadId,
            message,
        };

        if (recipientId) {
            params.recipients = [recipientId];
        }

        const response = await client.post('/buddypress/v1/messages', params);
        console.log('Reply success:', response.data);
        return response.data;
    } catch (error) {
        console.error('Reply failed:', error.response?.data || error.message);
        throw error;
    }
}
