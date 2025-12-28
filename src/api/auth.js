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

export const registerUser = async (username, email, password) => {
    try {
        // BuddyPress members endpoint for registration
        const response = await client.post('/buddypress/v1/signup', {
            user_login: username,
            user_email: email,
            password: password,
        });

        console.log('Registration response:', response.data);
        return response.data;
    } catch (error) {
        console.error('Registration error:', error.response?.data || error.message);

        // Handle specific error messages
        if (error.response?.data?.message) {
            throw new Error(error.response.data.message);
        } else if (error.response?.data?.code === 'rest_invalid_param') {
            throw new Error('Nieprawidłowe dane rejestracji');
        } else {
            throw new Error('Nie udało się utworzyć konta. Spróbuj ponownie.');
        }
    }
};
