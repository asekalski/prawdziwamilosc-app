import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ImageBackground, ScrollView, Alert, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { registerUser } from '../api/auth';

const RegisterScreen = () => {
    const navigation = useNavigation();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [profileImage, setProfileImage] = useState(null);
    const [loading, setLoading] = useState(false);

    const pickImage = async () => {
        // Poproś o uprawnienia
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (permissionResult.granted === false) {
            Alert.alert('Błąd', 'Potrzebujemy dostępu do galerii aby dodać zdjęcie profilowe');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setProfileImage(result.assets[0]);
        }
    };

    const takePhoto = async () => {
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

        if (permissionResult.granted === false) {
            Alert.alert('Błąd', 'Potrzebujemy dostępu do aparatu aby zrobić zdjęcie');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setProfileImage(result.assets[0]);
        }
    };

    const showImageOptions = () => {
        Alert.alert(
            'Dodaj zdjęcie profilowe',
            'Wybierz źródło zdjęcia',
            [
                { text: 'Aparat', onPress: takePhoto },
                { text: 'Galeria', onPress: pickImage },
                { text: 'Anuluj', style: 'cancel' },
            ]
        );
    };

    const handleRegister = async () => {
        // Walidacja
        if (!username || !email || !password || !confirmPassword) {
            Alert.alert('Błąd', 'Wypełnij wszystkie pola');
            return;
        }

        if (!profileImage) {
            Alert.alert('Błąd', 'Dodaj zdjęcie profilowe - to wymagane!');
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
            // Wywołaj WordPress API do rejestracji z obrazem
            const response = await registerUser(username, email, password, profileImage);
            console.log('Registration successful:', response);

            Alert.alert(
                'Sprawdź email!',
                'Wysłaliśmy Ci email z linkiem aktywacyjnym. Kliknij link w mailu aby aktywować swoje konto.\n\n⚠️ Sprawdź również folder SPAM/Oferty!',
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

                        {/* Profile Image Picker */}
                        <TouchableOpacity
                            style={styles.imagePickerContainer}
                            onPress={showImageOptions}
                        >
                            {profileImage ? (
                                <Image
                                    source={{ uri: profileImage.uri }}
                                    style={styles.profileImage}
                                />
                            ) : (
                                <View style={styles.imagePlaceholder}>
                                    <Text style={styles.imagePlaceholderIcon}>📷</Text>
                                    <Text style={styles.imagePlaceholderText}>Dodaj zdjęcie</Text>
                                    <Text style={styles.imagePlaceholderSubtext}>(wymagane)</Text>
                                </View>
                            )}
                        </TouchableOpacity>

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
        marginBottom: 20,
        textAlign: 'center',
    },
    imagePickerContainer: {
        alignSelf: 'center',
        marginBottom: 20,
    },
    profileImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        borderColor: '#FF6B9D',
    },
    imagePlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#f0f0f0',
        borderWidth: 2,
        borderColor: '#ddd',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imagePlaceholderIcon: {
        fontSize: 32,
        marginBottom: 5,
    },
    imagePlaceholderText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
    },
    imagePlaceholderSubtext: {
        fontSize: 12,
        color: '#999',
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
