import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ActivationScreen from '../screens/ActivationScreen';
import MembersScreen from '../screens/MembersScreen';
import MatchesScreen from '../screens/MatchesScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ChatScreen from '../screens/ChatScreen';
import SkippedScreen from '../screens/SkippedScreen';
import FeedScreen from '../screens/FeedScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import { Ionicons } from '@expo/vector-icons';
import HeartLoader from '../components/HeartLoader';
import { View } from 'react-native';
import { createNavigationContainerRef } from '@react-navigation/native';
import { setupNotificationInteraction } from '../services/NotificationService';

import NewMessageScreen from '../screens/NewMessageScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef();

const MainTabNavigator = () => {
    const { unreadMessagesCount } = useContext(AuthContext);
    const [likesCount, setLikesCount] = React.useState(0);

    React.useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Likes count
                const { getLikesMeUsers } = require('../api/members');
                const likesData = await getLikesMeUsers();
                setLikesCount(Array.isArray(likesData) ? likesData.length : 0);
            } catch (error) {
                console.log('Error fetching likes count:', error);
            }
        };

        fetchData();
        // Refresh every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <Tab.Navigator
            screenOptions={{
                tabBarStyle: {
                    backgroundColor: '#000',
                    borderTopWidth: 0,
                    height: 80,
                    paddingTop: 10,
                },
                tabBarActiveTintColor: '#fff',
                tabBarInactiveTintColor: '#666',
                tabBarShowLabel: true,
                headerShown: false,
            }}
        >
            <Tab.Screen
                name="Members"
                component={MembersScreen}
                initialParams={{ initialTab: 'search' }}
                options={{
                    tabBarLabel: 'Home',
                    tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />
                }}
            />
            <Tab.Screen
                name="LikesMe"
                component={MembersScreen}
                initialParams={{ initialTab: 'likesMe' }}
                options={{
                    tabBarLabel: 'Lubią Mnie',
                    tabBarIcon: ({ color, size }) => <Ionicons name="heart" size={size} color={color} />,
                    tabBarBadge: likesCount > 0 ? (likesCount > 99 ? '99+' : likesCount) : undefined,
                    tabBarBadgeStyle: likesCount > 0 ? { backgroundColor: '#ffc107', color: '#333' } : undefined,
                }}
            />
            <Tab.Screen
                name="Feed"
                component={FeedScreen}
                options={{
                    tabBarLabel: 'Tablica',
                    tabBarIcon: ({ color, size }) => <Ionicons name="newspaper" size={size} color={color} />
                }}
            />
            <Tab.Screen
                name="Skipped"
                component={MembersScreen}
                initialParams={{ initialTab: 'skipped' }}
                options={{
                    tabBarLabel: 'Usunięci',
                    tabBarIcon: ({ color, size }) => <Ionicons name="trash" size={size} color={color} />
                }}
            />
            <Tab.Screen
                name="Messages"
                component={MessagesScreen}
                options={{
                    tabBarLabel: 'Chat',
                    tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
                    tabBarBadge: unreadMessagesCount > 0 ? (unreadMessagesCount > 99 ? '99+' : unreadMessagesCount) : undefined,
                    tabBarBadgeStyle: unreadMessagesCount > 0 ? { backgroundColor: '#FF6B9D', color: '#fff' } : undefined,
                }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    tabBarLabel: 'Profile',
                    tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />
                }}
            />
        </Tab.Navigator>
    );
};

const AppNavigator = () => {
    const { userToken, userInfo, isLoading } = useContext(AuthContext);
    const { theme } = useContext(ThemeContext);

    React.useEffect(() => {
        if (navigationRef.isReady()) {
            const subscription = setupNotificationInteraction(navigationRef);
            return () => subscription.remove();
        } else {
            // If not ready, wait and try again or use a listener
            const interval = setInterval(() => {
                if (navigationRef.isReady()) {
                    const subscription = setupNotificationInteraction(navigationRef);
                    clearInterval(interval);
                }
            }, 500);
            return () => clearInterval(interval);
        }
    }, [userToken]);

    if (isLoading) {
        return (
            <View style={{ flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' }}>
                <HeartLoader size={80} color="#FF6B9D" />
            </View>
        );
    }

    const linking = {
        prefixes: ['prawdziwamilosc://', 'https://prawdziwamilosc.pl'],
        config: {
            screens: {
                Activation: {
                    path: 'activate',
                    parse: {
                        key: (key) => key,
                        user: (user) => user,
                    },
                },
                Login: 'login',
                Register: 'register',
            },
        },
    };

    return (
        <NavigationContainer ref={navigationRef} theme={theme} linking={linking}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {userToken == null ? (
                    <>
                        <Stack.Screen name="Login" component={LoginScreen} />
                        <Stack.Screen name="Register" component={RegisterScreen} />
                        <Stack.Screen name="Activation" component={ActivationScreen} />
                    </>
                ) : (
                    <>
                        {userInfo?.onboardingComplete === false ? (
                            <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ gestureEnabled: false }} />
                        ) : (
                            <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }} />
                        )}
                        <Stack.Screen name="UserProfile" component={ProfileScreen} options={{ headerShown: false }} />
                        <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
                        <Stack.Screen name="NewMessage" component={NewMessageScreen} options={{ headerShown: false }} />
                        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
