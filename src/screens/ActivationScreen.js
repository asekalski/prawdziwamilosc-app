import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { activateUser } from '../api/auth';

export default function ActivationScreen({ route, navigation }) {
    const [loading, setLoading] = useState(true);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const activate = async () => {
            try {
                const { key } = route.params || {};

                if (!key) {
                    setError('Brak klucza aktywacyjnego');
                    setLoading(false);
                    return;
                }

                const response = await activateUser(key);
                console.log('Activation successful:', response);
                setSuccess(true);
            } catch (err) {
                console.error('Activation failed:', err);
                setError(err.message || 'Nie udało się aktywować konta');
            } finally {
                setLoading(false);
            }
        };

        activate();
    }, [route.params]);

    return (
        <LinearGradient
            colors={['#FF6B9D', '#C06C84']}
            style={styles.container}
        >
            <View style={styles.content}>
                {loading && (
                    <>
                        <ActivityIndicator size="large" color="#fff" />
                        <Text style={styles.text}>Aktywuję konto...</Text>
                    </>
                )}

                {!loading && success && (
                    <>
                        <Text style={styles.title}>✅ Sukces!</Text>
                        <Text style={styles.text}>
                            Twoje konto zostało aktywowane.
                        </Text>
                        <Text style={styles.text}>
                            Możesz się teraz zalogować.
                        </Text>
                        <TouchableOpacity
                            style={styles.button}
                            onPress={() => navigation.navigate('Login')}
                        >
                            <Text style={styles.buttonText}>Przejdź do logowania</Text>
                        </TouchableOpacity>
                    </>
                )}

                {!loading && error && (
                    <>
                        <Text style={styles.title}>❌ Błąd</Text>
                        <Text style={styles.text}>{error}</Text>
                        <TouchableOpacity
                            style={styles.button}
                            onPress={() => navigation.navigate('Login')}
                        >
                            <Text style={styles.buttonText}>Powrót do logowania</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 20,
        textAlign: 'center',
    },
    text: {
        fontSize: 18,
        color: '#fff',
        marginBottom: 10,
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#fff',
        paddingVertical: 15,
        paddingHorizontal: 40,
        borderRadius: 25,
        marginTop: 30,
    },
    buttonText: {
        color: '#FF6B9D',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
