import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { sendMessage } from '../api/messages';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NewMessageScreen = ({ route, navigation }) => {
    const { recipientId, recipientName } = route.params;
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const insets = useSafeAreaInsets();

    const handleSend = async () => {
        if (!message.trim()) {
            Alert.alert('Error', 'Please enter a message');
            return;
        }

        setSending(true);
        try {
            await sendMessage(recipientId, subject || 'New Message', message);
            Alert.alert('Success', 'Message sent successfully!');
            navigation.goBack();
        } catch (error) {
            console.error(error);
            Alert.alert('Error', `Failed to send message: ${error.message}`);
        } finally {
            setSending(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { paddingTop: insets.top }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>New Message to {recipientName}</Text>
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Subject (optional)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter subject..."
                        value={subject}
                        onChangeText={setSubject}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Message</Text>
                    <TextInput
                        style={[styles.input, styles.messageInput]}
                        placeholder="Type your message..."
                        value={message}
                        onChangeText={setMessage}
                        multiline
                        numberOfLines={10}
                        textAlignVertical="top"
                    />
                </View>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
                <TouchableOpacity
                    style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                    onPress={handleSend}
                    disabled={sending}
                >
                    <Ionicons name="send" size={20} color="#fff" style={styles.sendIcon} />
                    <Text style={styles.sendButtonText}>
                        {sending ? 'Sending...' : 'Send Message'}
                    </Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F3E9' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
        backgroundColor: '#fff',
    },
    backButton: { marginRight: 15 },
    headerTitle: { fontSize: 18, fontWeight: '600', color: '#000', flex: 1 },
    content: { flex: 1, padding: 20 },
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 15,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    messageInput: {
        minHeight: 200,
        paddingTop: 15,
    },
    footer: {
        padding: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#ddd',
    },
    sendButton: {
        backgroundColor: '#2ECC71',
        borderRadius: 25,
        padding: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    sendButtonDisabled: {
        backgroundColor: '#95a5a6',
    },
    sendIcon: { marginRight: 8 },
    sendButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default NewMessageScreen;
