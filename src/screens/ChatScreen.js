import React, { useState, useEffect, useRef, useContext } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import { getThreads, sendMessage } from '../api/messages';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import client from '../api/client';

const ChatScreen = ({ route }) => {
    const { threadId, allMessages = [], users = {}, title } = route.params;
    const { userInfo } = useContext(AuthContext);
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const flatListRef = useRef();

    // Current user ID - find by nicename/displayName in users list
    const currentUser = Object.values(users).find(u =>
        u.name?.toLowerCase() === userInfo?.nicename?.toLowerCase() ||
        u.name?.toLowerCase() === userInfo?.displayName?.toLowerCase()
    );
    const currentUserId = currentUser?.user_id || currentUser?.id;
    console.log('[ChatScreen] Found current user:', currentUser?.name, 'ID:', currentUserId);

    // Find participant info (the OTHER user, not me)
    const participant = Object.values(users).find(u => String(u.user_id) !== String(currentUserId));
    const participantName = title || participant?.name || 'Konwersacja';
    const participantAvatar = participant?.avatar || null;

    // Load messages
    useEffect(() => {
        loadMessages();
    }, [threadId]);

    const loadMessages = async () => {
        try {
            // Filter messages for this thread from passed data
            let threadMessages = allMessages.filter(msg =>
                parseInt(msg.thread_id) === parseInt(threadId)
            );

            // Sort messages chronologically
            threadMessages.sort((a, b) => {
                const dateA = a.created_at || a.date_sent;
                const dateB = b.created_at || b.date_sent;
                return new Date(dateA) - new Date(dateB);
            });

            setMessages(threadMessages);
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setLoading(false);
        }
    };

    // Polling for new messages
    useEffect(() => {
        const fetchFreshMessages = async () => {
            try {
                const threadsData = await getThreads(1, 50);

                let allFreshMessages = [];
                if (threadsData?.messages && Array.isArray(threadsData.messages)) {
                    allFreshMessages = threadsData.messages;
                }

                const currentThreadMessages = allFreshMessages.filter(msg =>
                    parseInt(msg.thread_id) === parseInt(threadId)
                );

                if (currentThreadMessages.length > 0) {
                    currentThreadMessages.sort((a, b) => {
                        const dateA = a.created_at || a.date_sent;
                        const dateB = b.created_at || b.date_sent;
                        return new Date(dateA) - new Date(dateB);
                    });
                    setMessages(currentThreadMessages);
                }
            } catch (error) {
                console.log('Polling error:', error.message);
            }
        };

        fetchFreshMessages();
        const interval = setInterval(fetchFreshMessages, 5000);
        return () => clearInterval(interval);
    }, [threadId]);

    const handleSend = async () => {
        if (!replyText.trim()) return;

        const messageText = replyText.trim();
        setReplyText('');
        setSending(true);

        // Optimistic update
        const tempMessage = {
            id: Date.now(),
            message_id: Date.now(),
            thread_id: threadId,
            sender_id: currentUserId,
            message: messageText,
            date_sent: new Date().toISOString(),
            isOptimistic: true
        };
        setMessages(prev => [...prev, tempMessage]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            // Send via Better Messages
            const response = await client.post(`/better-messages/v1/thread/${threadId}/send`, {
                message: messageText,
                content: messageText,
                tempId: Date.now().toString()
            });
            console.log('Message sent:', response.data);
        } catch (error) {
            console.error('Send error:', error);
            setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
            setReplyText(messageText);
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item }) => {
        // Better Messages uses sender_id as string, compare as strings
        const senderId = String(item.sender_id);
        const myId = String(currentUserId);
        const isMe = senderId === myId;

        console.log(`[ChatScreen] Message sender: ${senderId}, myId: ${myId}, isMe: ${isMe}`);

        const messageText = item.message || '';
        // Strip HTML tags
        const cleanMessage = messageText.replace(/<[^>]*>/g, '').trim();

        const messageDate = item.created_at
            ? new Date(parseInt(item.created_at)).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
            : item.date_sent
                ? new Date(item.date_sent).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
                : '';

        return (
            <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
                <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                    {cleanMessage}
                </Text>
                <Text style={[styles.messageTime, isMe ? styles.myMessageTime : styles.theirMessageTime]}>
                    {messageDate}
                </Text>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2ECC71" />
                </View>
            </View>
        );
    }

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
                {participantAvatar && (
                    <Image source={{ uri: participantAvatar }} style={styles.headerAvatar} />
                )}
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>{participantName}</Text>
                    <Text style={styles.headerSubtitle}>Online</Text>
                </View>
            </View>

            {/* Messages */}
            {messages.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="chatbubbles-outline" size={64} color="#555" />
                    <Text style={styles.emptyText}>Brak wiadomości</Text>
                    <Text style={styles.emptySubtext}>Rozpocznij konwersację</Text>
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={item => (item.message_id || item.id)?.toString()}
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
                    value={replyText}
                    onChangeText={setReplyText}
                    multiline
                    maxLength={1000}
                />
                <TouchableOpacity
                    style={[styles.sendButton, (!replyText.trim() || sending) && styles.sendButtonDisabled]}
                    onPress={handleSend}
                    disabled={!replyText.trim() || sending}
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

export default ChatScreen;
