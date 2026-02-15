import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';

// State for notification suppression
let activeThreadId = null;
let currentUserId = null;

export const setNotificationSuppressionState = (state) => {
    if (state.activeThreadId !== undefined) activeThreadId = state.activeThreadId;
    if (state.currentUserId !== undefined) currentUserId = state.currentUserId;
};

// Configure how notifications are handled when the app is foregrounded
Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
        const data = notification.request.content.data;
        const threadId = data?.thread_id?.toString();
        const senderId = data?.sender_id?.toString();

        // 1. Suppress if it's the active thread
        if (activeThreadId && threadId === activeThreadId) {
            console.log(`Suppressing foreground notification for active thread: ${threadId}`);
            return {
                shouldShowAlert: false,
                shouldPlaySound: false,
                shouldSetBadge: true,
            };
        }

        // 2. Suppress if it's a self-notification (sender is the current user)
        if (currentUserId && senderId === currentUserId.toString()) {
            console.log(`Suppressing self-notification in foreground: ${senderId}`);
            return {
                shouldShowAlert: false,
                shouldPlaySound: false,
                shouldSetBadge: true,
            };
        }

        // 3. Fallback for silent notifications from server
        // If the server explicitly removed title/body, we shouldn't force an alert
        const title = notification.request.content.title;
        if (!title) {
            return {
                shouldShowAlert: false,
                shouldPlaySound: false,
                shouldSetBadge: true,
            };
        }

        return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
        };
    },
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
            // Alert.alert("Debug", "Requesting Permissions...");
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
            // Alert.alert("Debug", `New status: ${finalStatus}`);
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
