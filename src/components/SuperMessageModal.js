import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { getSuperMessageStatus, sendSuperMessage } from '../api/superMessages';

const MAX_CHARS = 500;

const SuperMessageModal = ({ visible, recipientId, recipientName, onClose }) => {
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (visible) {
            loadStatus();
        }
    }, [visible]);

    const loadStatus = async () => {
        try {
            setLoading(true);
            const data = await getSuperMessageStatus();
            setStatus(data);
        } catch (error) {
            console.error('Failed to load super message status:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!message.trim()) {
            Alert.alert('Uwaga', 'Wpisz treść wiadomości.');
            return;
        }

        try {
            setSending(true);
            await sendSuperMessage(recipientId, message);
            Alert.alert('✉️ Wysłano!', 'Super Wiadomość została wysłana. Poczekaj na odpowiedź.');
            setMessage('');
            onClose();
        } catch (error) {
            const errorMsg = error?.response?.data?.message || 'Nie udało się wysłać wiadomości.';
            Alert.alert('❌ Błąd', errorMsg);
        } finally {
            setSending(false);
        }
    };

    const remainingChars = MAX_CHARS - message.length;
    // Allow sending if message has content - backend will validate limits
    const canSend = message.trim().length > 0 && !sending && !loading;

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerIcon}>⭐</Text>
                        <Text style={styles.headerTitle}>Super Wiadomość</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Recipient */}
                    <Text style={styles.recipientText}>Do: {recipientName}</Text>

                    {/* Remaining count */}
                    {loading ? (
                        <ActivityIndicator color="#FFD700" size="small" />
                    ) : status && (
                        <View style={styles.statusRow}>
                            <Text style={styles.statusText}>
                                Pozostało: {status.remaining_this_week}/{status.weekly_limit} w tym tygodniu
                            </Text>
                            {status.is_premium && (
                                <View style={styles.premiumBadge}>
                                    <Text style={styles.premiumText}>⭐ Premium</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Message input */}
                    <TextInput
                        style={styles.input}
                        placeholder="Napisz wyjątkową wiadomość..."
                        placeholderTextColor="#888"
                        multiline
                        maxLength={MAX_CHARS}
                        value={message}
                        onChangeText={setMessage}
                    />

                    {/* Character counter */}
                    <Text style={[styles.charCount, remainingChars < 50 && styles.charCountWarning]}>
                        {remainingChars} znaków pozostało
                    </Text>

                    {/* Send button */}
                    <TouchableOpacity
                        style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
                        onPress={handleSend}
                        disabled={!canSend}
                    >
                        {sending ? (
                            <ActivityIndicator color="#1a1a2e" />
                        ) : (
                            <Text style={styles.sendButtonText}>⭐ Wyślij Super Wiadomość</Text>
                        )}
                    </TouchableOpacity>

                    {/* Info text */}
                    <Text style={styles.infoText}>
                        Super Wiadomości trafiają bezpośrednio do skrzynki odbiorcy i są wyróżnione.
                    </Text>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#1a1a2e',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        borderTopWidth: 3,
        borderTopColor: '#FFD700',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerIcon: {
        fontSize: 24,
        marginRight: 8,
    },
    headerTitle: {
        flex: 1,
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFD700',
    },
    closeButton: {
        padding: 8,
    },
    closeText: {
        fontSize: 20,
        color: '#888',
    },
    recipientText: {
        color: '#ccc',
        fontSize: 14,
        marginBottom: 12,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    statusText: {
        color: '#888',
        fontSize: 12,
        flex: 1,
    },
    premiumBadge: {
        backgroundColor: '#FFD700',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    premiumText: {
        color: '#1a1a2e',
        fontSize: 10,
        fontWeight: 'bold',
    },
    input: {
        backgroundColor: '#2d2d44',
        borderRadius: 12,
        padding: 16,
        color: '#fff',
        fontSize: 16,
        minHeight: 120,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: '#FFD700',
    },
    charCount: {
        color: '#888',
        fontSize: 12,
        textAlign: 'right',
        marginTop: 8,
        marginBottom: 16,
    },
    charCountWarning: {
        color: '#ff6b6b',
    },
    sendButton: {
        backgroundColor: '#FFD700',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#555',
    },
    sendButtonText: {
        color: '#1a1a2e',
        fontSize: 16,
        fontWeight: 'bold',
    },
    infoText: {
        color: '#666',
        fontSize: 11,
        textAlign: 'center',
        marginTop: 12,
        fontStyle: 'italic',
    },
});

export default SuperMessageModal;
