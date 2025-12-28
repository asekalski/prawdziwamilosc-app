import React, { useContext, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ImageBackground, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';

const LoginScreen = () => {
    const navigation = useNavigation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useContext(AuthContext);

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
        <ImageBackground
            source={require('../../assets/login-background.png')}
            style={styles.background}
            resizeMode="cover"
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <Text style={styles.title}>Login Screen</Text>
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
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    background: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)', // Semi-transparent overlay for better readability
        justifyContent: 'center',
        alignItems: 'center',
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
