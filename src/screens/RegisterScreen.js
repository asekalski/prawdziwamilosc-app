import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ImageBackground, ScrollView, Alert, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { registerUser } from '../api/auth';

const RegisterScreen = () => {
    const navigation = useNavigation();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    // const [gender, setGender] = useState(''); // Removed gender selection
    const [profileImage, setProfileImage] = useState(null);
    const [loading, setLoading] = useState(false);

    const compressImage = async (uri) => {
        try {
            console.log('SK Compressing image:', uri);
            const manipulatedImage = await ImageManipulator.manipulateAsync(
                uri,
                [],
                { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
            );
            console.log('SK Compressed image:', manipulatedImage);
            return manipulatedImage;
        } catch (error) {
            console.error('SK Image compression error:', error);
            throw error;
        }
    };

    const pickImage = async () => {
        console.log('SK pickImage called');
        try {
            // Check permissions first
            if (Platform.OS === 'ios') {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                console.log('SK Media Library permission status:', status);

                if (status !== 'granted' && status !== 'limited') {
                    Alert.alert('Błąd', 'Potrzebujemy dostępu do galerii (pełnego lub ograniczonego) aby wybrać zdjęcie. Status: ' + status);
                    return;
                }
            } else {
                // For Android, we still check just in case, though often not needed for picker
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                console.log('SK Media Library permission status (Android):', status);
            }

            const mediaTypes = ImagePicker.MediaTypeOptions ? ImagePicker.MediaTypeOptions.Images : (ImagePicker.MediaType ? ImagePicker.MediaType.Images : 'images');
            console.log('SK Launching Library with MediaTypes:', mediaTypes);

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: mediaTypes,
                allowsEditing: true,
                aspect: [4, 5],
                quality: 0.8,
            });

            console.log('SK Library result:', result);

            if (!result.canceled && result.assets && result.assets[0]) {
                console.log('SK Image Selected:', result.assets[0].uri);
                try {
                    const compressed = await compressImage(result.assets[0].uri);
                    setProfileImage({ ...result.assets[0], uri: compressed.uri, width: compressed.width, height: compressed.height });
                } catch (err) {
                    console.log('Compression failed, using original', err);
                    setProfileImage(result.assets[0]);
                }
            } else {
                console.log('SK Image selection canceled or no assets');
            }
        } catch (error) {
            console.error('SK pickImage ERROR:', error);
            Alert.alert('Błąd', 'Wystąpił błąd podczas wybierania zdjęcia: ' + (error.message || error));
        }
    };

    const takePhoto = async () => {
        console.log('SK takePhoto called');
        try {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            console.log('SK Camera permission status:', permissionResult.status);

            if (permissionResult.granted === false) {
                Alert.alert('Błąd', 'Potrzebujemy dostępu do aparatu aby zrobić zdjęcie');
                return;
            }

            const mediaTypes = ImagePicker.MediaType ? ImagePicker.MediaType.Images : ImagePicker.MediaTypeOptions.Images;

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: mediaTypes,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            console.log('SK Camera result:', result);

            if (!result.canceled && result.assets[0]) {
                console.log('SK Image Picker (Camera):', result.assets[0]);
                try {
                    const compressed = await compressImage(result.assets[0].uri);
                    setProfileImage({ ...result.assets[0], uri: compressed.uri, width: compressed.width, height: compressed.height });
                } catch (err) {
                    console.log('Compression failed, using original', err);
                    setProfileImage(result.assets[0]);
                }
            }
        } catch (error) {
            console.error('SK takePhoto ERROR:', error);
            Alert.alert('Błąd', 'Wystąpił błąd podczas robienia zdjęcia: ' + error.message);
        }
    };

    const showImageOptions = async () => {
        // Prosimy o uprawnienia na samym początku, zanim user w ogóle zobaczy wybór.
        // To jest "najwcześniej" jak się da.


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

        // if (!gender) {
        //     Alert.alert('Błąd', 'Wybierz płeć');
        //     return;
        // }

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
            console.log('SK Registering user:', { username, email, hasImage: !!profileImage });
            const response = await registerUser(username, email, password, '', profileImage); // Pass empty string for gender
            console.log('SK Registration response:', response);

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
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={{ flex: 1 }}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContainer}
                        keyboardShouldPersistTaps="handled"
                    >
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
                                textContentType="oneTimeCode"
                                style={styles.input}
                                placeholderTextColor="#999"
                            />

                            <TextInput
                                placeholder="Potwierdź hasło"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry
                                textContentType="oneTimeCode"
                                style={styles.input}
                                placeholderTextColor="#999"
                            />

                            {/* Gender Selection REMOVED */}

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
                </KeyboardAvoidingView>
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
    genderContainer: {
        marginBottom: 20,
    },
    genderLabel: {
        fontSize: 16,
        color: '#666',
        marginBottom: 10,
        fontWeight: '600',
    },
    genderButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    genderButton: {
        flex: 1,
        backgroundColor: '#f0f0f0',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        marginHorizontal: 5,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    genderButtonSelected: {
        backgroundColor: '#FFE6EF', // Light pink background
        borderColor: '#FF6B9D',
    },
    genderButtonText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
    },
    genderButtonTextSelected: {
        color: '#FF6B9D',
        fontWeight: 'bold',
    },
});

export default RegisterScreen;
