import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Configure how notifications are handled when the app is foregrounded
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return null;
        }

        // Get the token from expo-notifications
        // Note: projectId is required for newer Expo versions
        const projectId =
            Constants?.expoConfig?.extra?.eas?.projectId ??
            Constants?.easConfig?.projectId;

        try {
            token = (await Notifications.getExpoPushTokenAsync({
                projectId,
            })).data;
            console.log('Push Token:', token);
        } catch (e) {
            console.error('Error getting push token:', e);
            return null;
        }
    } else {
        console.log('Must use physical device for Push Notifications');
        return null;
    }

    return token;
}

/**
 * Handle user interaction with notifications (clicks)
 */
export function setupNotificationInteraction(navigationRef) {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data;
        if (!data) return;

        console.log('Notification clicked with data:', data);

        // Handle navigation based on type
        switch (data.type) {
            case 'message':
                if (data.thread_id) {
                    navigationRef.navigate('Chat', {
                        threadId: data.thread_id,
                        title: 'Wiadomość'
                    });
                }
                break;
            case 'match':
                if (data.user_id) {
                    navigationRef.navigate('UserProfile', { userId: data.user_id });
                } else {
                    navigationRef.navigate('Main', { screen: 'Messages' });
                }
                break;
            case 'like':
                navigationRef.navigate('Main', { screen: 'LikesMe' });
                break;
            case 'broadcast':
                // General broadcast - go to notifications history
                navigationRef.navigate('Notifications');
                break;
            default:
                console.log('Unknown notification type:', data.type);
        }
    });

    return subscription;
}
