import client from './client';

export const loginUser = async (username, password) => {
    try {
        const response = await client.post('/jwt-auth/v1/token', {
            username,
            password,
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};
