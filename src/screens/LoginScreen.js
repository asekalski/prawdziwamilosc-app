import React, { useContext, useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Dimensions, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { Accelerometer } from 'expo-sensors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const LoginScreen = () => {
    const navigation = useNavigation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useContext(AuthContext);

    // Use useRef to persist animated values across renders
    const layer1X = useRef(new Animated.Value(0)).current;
    const layer1Y = useRef(new Animated.Value(0)).current;
    const layer2X = useRef(new Animated.Value(0)).current;
    const layer2Y = useRef(new Animated.Value(0)).current;
    const layer3X = useRef(new Animated.Value(0)).current;
    const layer3Y = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        let subscription;

        const startMotionTracking = async () => {
            try {
                // Use Accelerometer (more widely supported than DeviceMotion)
                const isAvailable = await Accelerometer.isAvailableAsync();
                console.log('Accelerometer available:', isAvailable);

                if (isAvailable) {
                    // Set update interval
                    Accelerometer.setUpdateInterval(32); // ~30fps

                    subscription = Accelerometer.addListener((data) => {
                        const { x, y } = data;

                        // Sensitivity multipliers for each layer (different speeds create parallax)
                        const sensitivity1 = 20;  // Layer 1 (background) - slowest
                        const sensitivity2 = 40;  // Layer 2 (middle) - medium
                        const sensitivity3 = 70;  // Layer 3 (foreground) - fastest

                        // Apply movement - x is left/right tilt, y is front/back tilt
                        Animated.spring(layer1X, {
                            toValue: x * sensitivity1,
                            useNativeDriver: true,
                            friction: 5,
                            tension: 40
                        }).start();
                        Animated.spring(layer1Y, {
                            toValue: y * sensitivity1,
                            useNativeDriver: true,
                            friction: 5,
                            tension: 40
                        }).start();

                        Animated.spring(layer2X, {
                            toValue: x * sensitivity2,
                            useNativeDriver: true,
                            friction: 5,
                            tension: 40
                        }).start();
                        Animated.spring(layer2Y, {
                            toValue: y * sensitivity2,
                            useNativeDriver: true,
                            friction: 5,
                            tension: 40
                        }).start();

                        Animated.spring(layer3X, {
                            toValue: x * sensitivity3,
                            useNativeDriver: true,
                            friction: 5,
                            tension: 40
                        }).start();
                        Animated.spring(layer3Y, {
                            toValue: y * sensitivity3,
                            useNativeDriver: true,
                            friction: 5,
                            tension: 40
                        }).start();
                    });
                } else {
                    console.log('Accelerometer not available on this device');
                }
            } catch (error) {
                console.log('Error setting up accelerometer:', error);
            }
        };

        startMotionTracking();

        return () => {
            if (subscription) {
                subscription.remove();
            }
        };
    }, []);

    const handleLogin = async () => {
        if (!username || !password) {
            alert('Please enter username and password');
            return;
        }
        const result = await login(username, password);
        if (!result.success) {
            alert(result.error);
        }
    };

    return (
        <View style={styles.background}>
            {/* Parallax Background Layers */}
            <Animated.Image
                source={require('../../assets/layer-1.jpg')}
                style={[
                    styles.parallaxLayer,
                    styles.layer1,
                    {
                        transform: [
                            { translateX: layer1X },
                            { translateY: layer1Y },
                        ],
                    },
                ]}
                resizeMode="cover"
            />
            <Animated.Image
                source={require('../../assets/layer-2.png')}
                style={[
                    styles.parallaxLayer,
                    styles.layer2,
                    {
                        transform: [
                            { scale: 1.8 },
                            { translateX: Animated.multiply(layer2X, -1) },
                            { translateY: Animated.multiply(layer2Y, -1) },
                        ],
                    },
                ]}
                resizeMode="contain"
            />
            <Animated.Image
                source={require('../../assets/layer-3.png')}
                style={[
                    styles.parallaxLayer,
                    styles.layer3,
                    {
                        transform: [
                            { scale: 2.0 },
                            { translateX: layer3X },
                            { translateY: layer3Y },
                        ],
                    },
                ]}
                resizeMode="contain"
            />

            {/* Content Overlay */}
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <Text style={styles.title}>Prawdziwa Miłość</Text>
                    <TextInput
                        placeholder="Username"
                        value={username}
                        onChangeText={setUsername}
                        style={styles.input}
                        placeholderTextColor="#999"
                    />
                    <TextInput
                        placeholder="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        style={styles.input}
                        placeholderTextColor="#999"
                    />

                    {/* Login Button */}
                    <TouchableOpacity
                        style={styles.buttonContainer}
                        onPress={handleLogin}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={['#FF6B9D', '#C06C84']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.gradient}
                        >
                            <Text style={styles.buttonText}>Zaloguj</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Register Button */}
                    <TouchableOpacity
                        style={styles.registerButtonContainer}
                        onPress={() => navigation.navigate('Register')}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.registerButtonText}>Zarejestruj Się</Text>
                    </TouchableOpacity>

                    <Text style={styles.orText}>Nie masz konta?</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    background: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: '#0b0c1e',
    },
    parallaxLayer: {
        position: 'absolute',
        // Make layers larger than screen for parallax movement room
        width: SCREEN_WIDTH * 1.3,
        height: SCREEN_HEIGHT * 1.3,
        // Center the oversized layers
        left: -SCREEN_WIDTH * 0.15,
        top: -SCREEN_HEIGHT * 0.15,
    },
    layer1: {
        zIndex: 1,
    },
    layer2: {
        zIndex: 2,
        // Venus wyżej o 1/4
        top: -SCREEN_HEIGHT * 0.35,
    },
    layer3: {
        zIndex: 3,
        // Para wyżej o 1/4
        top: SCREEN_HEIGHT * 0.08,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    container: {
        width: '80%',
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 30,
    },
    input: {
        width: '100%',
        padding: 15,
        margin: 10,
        borderWidth: 1,
        borderColor: '#fff',
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        fontSize: 16,
    },
    buttonContainer: {
        width: '100%',
        marginTop: 20,
        borderRadius: 25,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    gradient: {
        paddingVertical: 15,
        paddingHorizontal: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    registerButtonContainer: {
        width: '100%',
        marginTop: 15,
        borderRadius: 25,
        borderWidth: 2,
        borderColor: '#fff',
        backgroundColor: 'transparent',
        paddingVertical: 15,
        paddingHorizontal: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    registerButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    orText: {
        color: '#fff',
        fontSize: 14,
        marginTop: 20,
        opacity: 0.8,
    },
});

export default LoginScreen;
