import client from './client';

export const getThreads = async (page = 1, per_page = 20, extraParams = {}) => {
    try {
        // Use Better Messages API - this is what the web portal uses
        console.log('Fetching threads from Better Messages API');
        const response = await client.get('/better-messages/v1/threads', {
            params: {
                page,
                per_page,
                ...extraParams
            },
        });
        console.log('Better Messages response threads count:', response.data?.threads?.length || 0);
        return response.data;
    } catch (error) {
        if (error.response?.status !== 401) {
            console.error('Error fetching Better Messages threads:', error.response?.data || error.message);
        }
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

    let threadId = null;
    let tryFallback = false;

    try {
        // Step 1: Get or create private thread with this user
        console.log('Attempting to get private thread with user:', recipientId);
        const threadResponse = await client.post('/better-messages/v1/getPrivateThread', {
            user_id: recipientId
        });

        threadId = threadResponse.data?.thread_id || threadResponse.data?.id;

        // Robust extraction
        if (!threadId) {
            if (typeof threadResponse.data === 'number' || typeof threadResponse.data === 'string') {
                threadId = threadResponse.data;
            } else if (threadResponse.data?.thread?.id) {
                threadId = threadResponse.data.thread.id;
            }
        }

        if (!threadId) {
            console.log('getPrivateThread did not return an ID, will try fallback');
            tryFallback = true;
        } else {
            // Step 2: Send message to this thread
            console.log('Sending message to thread:', threadId);
            const sendResponse = await client.post(`/better-messages/v1/thread/${threadId}/send`, {
                message: message,
                content: message,
                tempId: Date.now().toString()
            });
            return sendResponse.data;
        }
    } catch (error) {
        console.log('Initial getPrivateThread/send failed:', error.message);
        tryFallback = true;
    }

    if (tryFallback) {
        // Fallback: try thread/new endpoint
        try {
            console.log('Trying /thread/new endpoint as fallback');
            const newThreadResponse = await client.post('/better-messages/v1/thread/new', {
                recipients: [recipientId],
                message: message,
                content: message,
                subject: subject || 'Nowa wiadomość'
            });
            console.log('thread/new response success');
            return newThreadResponse.data;
        } catch (fallbackError) {
            console.error('All send methods failed:', fallbackError.response?.status, fallbackError.response?.data || fallbackError.message);
            throw fallbackError;
        }
    }
}

export const sendReply = async (threadId, message) => {
    console.log(`sendReply called for thread ${threadId}:`, message);
    try {
        const response = await client.post(`/better-messages/v1/thread/${threadId}/send`, {
            message: message,
            content: message,
            tempId: Date.now().toString()
        });
        return response.data;
    } catch (error) {
        console.error('Better Messages reply error:', error.response?.status, error.response?.data || error.message);
        throw error;
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

export const deleteThread = async (threadId) => {
    try {
        console.log(`Deleting thread ${threadId}`);
        const response = await client.delete(`/sk/v1/thread/${threadId}`);
        console.log('Thread deleted:', response.data);
        return response.data;
    } catch (error) {
        console.error('Delete thread failed:', error.response?.data || error.message);
        throw error;
    }
}

export const markThreadAsRead = async (threadId) => {
    try {
        console.log(`Marking thread ${threadId} as read via custom API`);
        const response = await client.post(`/sk/v1/thread/${threadId}/read`);
        return response.data;
    } catch (error) {
        console.log(`Mark as read failed for /sk/v1/thread/${threadId}/read:`, error.response?.status);
        // Silent fail as this is not critical for UI flow
        return null;
    }
}

export const allowChat = async (userId, action = 'allow') => {
    try {
        const response = await client.post('/sk/v1/allow-chat', {
            user_id: userId,
            action: action
        });
        return response.data;
    } catch (error) {
        console.error('Allow chat failed:', error.response?.data || error.message);
        throw error;
    }
}

export const getUnreadCount = async (clearAll = false) => {
    try {
        const params = { _cb: Date.now() };
        if (clearAll) params.clear_all = 1;

        const response = await client.get('/sk/v1/unread-count', {
            params: params
        });
        return response.data;
    } catch (error) {
        console.error('Get unread count failed:', error.response?.data || error.message);
        return { unread_count: 0 };
    }
}
