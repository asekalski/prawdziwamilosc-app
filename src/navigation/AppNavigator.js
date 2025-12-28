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
import { Ionicons } from '@expo/vector-icons';

import NewMessageScreen from '../screens/NewMessageScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
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
                options={{
                    tabBarLabel: 'Home',
                    tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />
                }}
            />
            <Tab.Screen
                name="Matches"
                component={MatchesScreen}
                options={{
                    tabBarLabel: 'Matches',
                    tabBarIcon: ({ color, size }) => <Ionicons name="heart" size={size} color={color} />
                }}
            />
            <Tab.Screen
                name="Messages"
                component={MessagesScreen}
                options={{
                    tabBarLabel: 'Chat',
                    tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />
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
    const { userToken, isLoading } = useContext(AuthContext);
    const { theme } = useContext(ThemeContext);

    if (isLoading) {
        return null; // Or a splash screen
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
        <NavigationContainer theme={theme} linking={linking}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {userToken == null ? (
                    <>
                        <Stack.Screen name="Login" component={LoginScreen} />
                        <Stack.Screen name="Register" component={RegisterScreen} />
                        <Stack.Screen name="Activation" component={ActivationScreen} />
                    </>
                ) : (
                    <>
                        <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }} />
                        <Stack.Screen name="UserProfile" component={ProfileScreen} options={{ headerShown: false }} />
                        <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
                        <Stack.Screen name="NewMessage" component={NewMessageScreen} options={{ headerShown: false }} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
