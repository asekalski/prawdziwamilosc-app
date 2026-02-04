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

export const registerUser = async (username, email, password, profileImage = null) => {
    try {
        // Używamy FormData do wysłania zdjęcia
        const formData = new FormData();
        formData.append('user_login', username);
        formData.append('user_email', email);
        formData.append('password', password);

        if (profileImage) {
            // Dodaj zdjęcie do FormData
            const filename = profileImage.uri.split('/').pop();
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image/jpeg';

            formData.append('avatar', {
                uri: profileImage.uri,
                name: filename,
                type: type,
            });
        }

        // Custom endpoint który obsługuje signup + avatar
        const response = await client.post('/sk/v1/register-with-avatar', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
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

export const activateUser = async (activationKey) => {
    try {
        // BuddyPress activation endpoint
        const response = await client.put(`/buddypress/v1/signup/activate/${activationKey}`);

        console.log('Activation response:', response.data);
        return response.data;
    } catch (error) {
        console.error('Activation error:', error.response?.data || error.message);

        if (error.response?.data?.message) {
            throw new Error(error.response.data.message);
        } else {
            throw new Error('Nie udało się aktywować konta. Spróbuj ponownie.');
        }
    }
};

