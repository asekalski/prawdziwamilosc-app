import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const client = axios.create({
  baseURL: 'https://prawdziwamilosc.pl/wp-json',
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    console.log('Request to:', config.url);
    console.log('Token from storage:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    console.log('API Error:', error.config?.url, error.response?.status, error.response?.data);

    // If token expired or user deleted, clear storage and force re-login
    if (error.response?.status === 401 ||
      (error.response?.status === 403 && error.response?.data?.code === 'jwt_auth_invalid_token')) {
      console.log('Token invalid! Clearing storage...');
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userInfo');
      // The app will automatically redirect to login screen
    }

    return Promise.reject(error);
  }
);

export default client;
