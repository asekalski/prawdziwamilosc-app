import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ImageBackground, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { registerUser } from '../api/auth';

const RegisterScreen = () => {
    const navigation = useNavigation();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        // Walidacja
        if (!username || !email || !password || !confirmPassword) {
            Alert.alert('Błąd', 'Wypełnij wszystkie pola');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Błąd', 'Hasła się nie zgadzają');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Błąd', 'Hasło musi mieć minimum 6 znaków');
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            Alert.alert('Błąd', 'Podaj prawidłowy adres email');
            return;
        }

        setLoading(true);

        try {
            // Wywołaj WordPress API do rejestracji
            const response = await registerUser(username, email, password);
            console.log('Registration successful:', response);

            Alert.alert(
                'Sukces!',
                'Konto zostało utworzone. Możesz się teraz zalogować.',
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.navigate('Login')
                    }
                ]
            );
        } catch (error) {
            Alert.alert('Błąd', error.message || 'Nie udało się utworzyć konta');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ImageBackground
            source={require('../../assets/login-background.png')}
            style={styles.background}
            resizeMode="cover"
        >
            <View style={styles.overlay}>
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    <View style={styles.formContainer}>
                        <Text style={styles.title}>Stwórz Konto</Text>
                        <Text style={styles.subtitle}>Znajdź swoją prawdziwą miłość</Text>

                        <TextInput
                            placeholder="Nazwa użytkownika"
                            value={username}
                            onChangeText={setUsername}
                            style={styles.input}
                            placeholderTextColor="#999"
                            autoCapitalize="none"
                        />

                        <TextInput
                            placeholder="Email"
                            value={email}
                            onChangeText={setEmail}
                            style={styles.input}
                            placeholderTextColor="#999"
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />

                        <TextInput
                            placeholder="Hasło"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            style={styles.input}
                            placeholderTextColor="#999"
                        />

                        <TextInput
                            placeholder="Potwierdź hasło"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                            style={styles.input}
                            placeholderTextColor="#999"
                        />

                        {/* Register Button */}
                        <TouchableOpacity
                            style={styles.buttonContainer}
                            onPress={handleRegister}
                            activeOpacity={0.8}
                            disabled={loading}
                        >
                            <LinearGradient
                                colors={['#FF6B9D', '#C06C84']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.gradient}
                            >
                                <Text style={styles.buttonText}>
                                    {loading ? 'Rejestracja...' : 'Zarejestruj Się'}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Back to Login */}
                        <TouchableOpacity
                            style={styles.loginButtonContainer}
                            onPress={() => navigation.navigate('Login')}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.loginButtonText}>Masz już konto? Zaloguj się</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    formContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 20,
        padding: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 30,
        textAlign: 'center',
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
        fontSize: 16,
        color: '#333',
    },
    buttonContainer: {
        marginTop: 10,
        marginBottom: 15,
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    gradient: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    loginButtonContainer: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    loginButtonText: {
        color: '#C06C84',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default RegisterScreen;
