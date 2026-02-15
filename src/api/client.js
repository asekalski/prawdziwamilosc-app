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

    // If token expired, issuer mismatch, or user deleted, clear storage and force re-login
    if (error.response?.status === 401 ||
      (error.response?.status === 403 && error.response?.data?.code?.startsWith('jwt_auth_'))) {

      const currentToken = await AsyncStorage.getItem('userToken');
      if (currentToken) {
        console.log('Token invalid (401/403 JWT error)! Clearing storage...');
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('userInfo');
      } else {
        // Token already gone, likely logout race condition - ignore
        // console.log('401 received but no token in storage (ignoring)');
      }
      // The app will automatically redirect to login screen
    }

    return Promise.reject(error);
  }
);

export default client;
