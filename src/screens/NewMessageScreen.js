import React, { useState, useContext, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import { sendMessage, getThreads } from '../api/messages';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMember } from '../api/members';

const NewMessageScreen = ({ route, navigation }) => {
    const { recipientId, recipientName } = route.params;
    const { userInfo } = useContext(AuthContext);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [recipientAvatar, setRecipientAvatar] = useState(null);
    const [existingThreadId, setExistingThreadId] = useState(null);
    const insets = useSafeAreaInsets();
    const flatListRef = useRef();

    // Check if there's an existing conversation with this user
    useEffect(() => {
        const checkExistingConversation = async () => {
            try {
                // Get recipient avatar
                const memberData = await getMember(recipientId);
                if (memberData?.avatar_urls?.full) {
                    setRecipientAvatar(memberData.avatar_urls.full);
                }

                // Check for existing thread with this recipient
                const threadsData = await getThreads(1, 50);
                if (threadsData?.threads) {
                    for (const thread of threadsData.threads) {
                        const recipientIds = Object.keys(thread.recipients || {}).map(id => parseInt(id));
                        if (recipientIds.includes(parseInt(recipientId))) {
                            // Found existing thread - load messages
                            setExistingThreadId(thread.id);
                            const threadMessages = (threadsData.messages || [])
                                .filter(msg => msg.thread_id === thread.id)
                                .sort((a, b) => new Date(a.date_sent) - new Date(b.date_sent));
                            setMessages(threadMessages);
                            break;
                        }
                    }
                }
            } catch (error) {
                console.error('Error checking existing conversation:', error);
            } finally {
                setLoading(false);
            }
        };

        checkExistingConversation();
    }, [recipientId]);

    const handleSend = async () => {
        if (!message.trim()) return;

        const messageText = message.trim();
        setMessage('');
        setSending(true);

        // Optimistic update - add message immediately
        const tempMessage = {
            id: Date.now(),
            message: { rendered: messageText },
            sender_id: userInfo?.id,
            date_sent: new Date().toISOString(),
            isOptimistic: true
        };
        setMessages(prev => [...prev, tempMessage]);

        try {
            await sendMessage(recipientId, recipientName, messageText);

            // Refresh messages to get the real message from server
            const threadsData = await getThreads(1, 50);
            if (threadsData?.threads) {
                for (const thread of threadsData.threads) {
                    const recipientIds = Object.keys(thread.recipients || {}).map(id => parseInt(id));
                    if (recipientIds.includes(parseInt(recipientId))) {
                        setExistingThreadId(thread.id);
                        const threadMessages = (threadsData.messages || [])
                            .filter(msg => msg.thread_id === thread.id)
                            .sort((a, b) => new Date(a.date_sent) - new Date(b.date_sent));
                        setMessages(threadMessages);
                        break;
                    }
                }
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            // Remove optimistic message on error
            setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
            setMessage(messageText); // Restore message to input
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item }) => {
        const isMe = parseInt(item.sender_id) === parseInt(userInfo?.id);
        const messageContent = item.message?.rendered || item.message || '';
        // Strip HTML tags
        const cleanMessage = messageContent.replace(/<[^>]*>/g, '').trim();

        return (
            <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
                <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                    {cleanMessage}
                </Text>
                <Text style={[styles.messageTime, isMe ? styles.myMessageTime : styles.theirMessageTime]}>
                    {new Date(item.date_sent).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { paddingTop: insets.top }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                {recipientAvatar && (
                    <Image source={{ uri: recipientAvatar }} style={styles.headerAvatar} />
                )}
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>{recipientName}</Text>
                    <Text style={styles.headerSubtitle}>
                        {existingThreadId ? 'Konwersacja' : 'Nowa wiadomość'}
                    </Text>
                </View>
            </View>

            {/* Messages */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2ECC71" />
                </View>
            ) : messages.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="chatbubbles-outline" size={64} color="#555" />
                    <Text style={styles.emptyText}>Rozpocznij konwersację</Text>
                    <Text style={styles.emptySubtext}>Wyślij pierwszą wiadomość do {recipientName}</Text>
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.messagesList}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Input */}
            <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 10 }]}>
                <TextInput
                    style={styles.input}
                    placeholder="Napisz wiadomość..."
                    placeholderTextColor="#888"
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    maxLength={1000}
                />
                <TouchableOpacity
                    style={[styles.sendButton, (!message.trim() || sending) && styles.sendButtonDisabled]}
                    onPress={handleSend}
                    disabled={!message.trim() || sending}
                >
                    {sending ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Ionicons name="send" size={20} color="#fff" />
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1C1C1E' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#2C2C2E',
        borderBottomWidth: 1,
        borderBottomColor: '#3A3A3C',
    },
    backButton: {
        marginRight: 12,
        padding: 4,
    },
    headerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    headerInfo: { flex: 1 },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#8E8E93',
        marginTop: 2,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#8E8E93',
        marginTop: 8,
        textAlign: 'center',
    },
    messagesList: {
        padding: 15,
        paddingBottom: 10,
    },
    messageBubble: {
        maxWidth: '75%',
        padding: 12,
        borderRadius: 18,
        marginBottom: 8,
    },
    myMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#2ECC71',
        borderBottomRightRadius: 4,
    },
    theirMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#3A3A3C',
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 20,
    },
    myMessageText: {
        color: '#fff',
    },
    theirMessageText: {
        color: '#fff',
    },
    messageTime: {
        fontSize: 11,
        marginTop: 4,
    },
    myMessageTime: {
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'right',
    },
    theirMessageTime: {
        color: '#8E8E93',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 12,
        paddingTop: 10,
        backgroundColor: '#2C2C2E',
        borderTopWidth: 1,
        borderTopColor: '#3A3A3C',
    },
    input: {
        flex: 1,
        backgroundColor: '#3A3A3C',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        paddingTop: 10,
        fontSize: 16,
        color: '#fff',
        maxHeight: 100,
        marginRight: 10,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#2ECC71',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#555',
    },
});

export default NewMessageScreen;
