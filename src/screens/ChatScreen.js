import React, { useState, useEffect, useRef, useContext } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { getThread, replyToThread } from '../api/messages';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';

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

    // Use passed title or find participant name
    const participant = Object.values(users).find(u => u.user_id !== userInfo?.id);
    const participantName = title || participant?.name || 'Konwersacja';

    const fetchMessages = async () => {
        try {
            // Filter messages for this thread from the passed data
            const threadMessages = allMessages.filter(msg => msg.thread_id === threadId);

            // Sort messages: Oldest first (Ascending) so they appear Top -> Bottom
            threadMessages.sort((a, b) => {
                const dateA = a.created_at || a.date_sent;
                const dateB = b.created_at || b.date_sent;
                return new Date(dateA) - new Date(dateB);
            });

            console.log('Thread messages (sorted):', threadMessages.length);
            setMessages(threadMessages);
        } catch (error) {
            console.error('Error filtering messages:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Debug: Find the thread object to inspect IDs
        const thread = route.params.thread || {}; // If passed
        console.log('Current Thread ID:', threadId);
        console.log('UserInfo:', JSON.stringify(userInfo, null, 2));

        // Log resolved ID
        const resolvedId = userInfo?.id || Object.values(users).find(u =>
            u.name === userInfo?.displayName ||
            u.name === userInfo?.nicename ||
            u.slug === userInfo?.nicename
        )?.user_id;
        console.log('Resolved Current User ID:', resolvedId);

        // We don't have the full thread object here usually, just ID.
        // But MessagesScreen has it.

        fetchMessages();
    }, [threadId]);

    // Resolve current user ID - MOVED HERE so it's available in handleSend
    const currentUserId = userInfo?.id || Object.values(users).find(u =>
        u.name === userInfo?.displayName ||
        u.name === userInfo?.nicename ||
        u.slug === userInfo?.nicename
    )?.user_id;

    const handleSend = async () => {
        if (!replyText.trim()) return;
        setSending(true);
        try {
            // Get recipient ID
            const recipientId = participant?.user_id;
            const response = await replyToThread(threadId, replyText, recipientId);
            setReplyText('');

            // Add the actual sent message to the list
            // If response contains the new message, use it. Otherwise use optimistic.
            // Better Messages/BuddyPress usually return the new message or thread info
            console.log('Send response:', response);

            const newMessage = {
                id: response?.id || Math.random(),
                message_id: response?.message_id || Math.random(),
                thread_id: threadId,
                sender_id: currentUserId, // FIX: Use currentUserId instead of userInfo?.id
                message: replyText,
                date_sent: new Date().toISOString(),
                created_at: Date.now()
            };

            setMessages(prev => [...prev, newMessage]);

            // Do NOT call fetchMessages() here because it re-reads stale route.params
            // and overwrites our new message.
        } catch (error) {
            console.error('Send error:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
            alert(`Failed to send message: ${errorMessage}`);
        } finally {
            setSending(false);
        }
    };

    const renderItem = ({ item }) => {
        // Use loose equality (==) because IDs might be string vs number
        // Invert logic: If sender is NOT me, then it's me? No, wait.
        // User says: "Co słychać" from Aneta (335) to Artur (1).
        // App logged in as: AtenaPrzykl (335).
        // So if sender_id == 335, it IS ME.
        // But user says it appears on the WRONG side.
        // If it appears on the right (green), it means isMe is true.
        // If it appears on the left (white), it means isMe is false.

        // Let's look at the screenshot.
        // "Say Hello man" (from Atena) is on the LEFT (white).
        // "o cześć anetka" (from Artur) is on the LEFT (white).
        // Wait, ALL messages are on the left?

        // Ah, the user said: "piszę 'Co słychać' z konta Anety do Artura a pojawia się po tej samej stronie co pisał artur".
        // Meaning: My messages look like received messages.

        // So isMe is FALSE for my own messages.
        // currentUserId is 335. sender_id is 335.
        // 335 == 335 should be true.

        // Maybe currentUserId resolution failed?
        // Or maybe the IDs are strings "335" vs number 335.

        // NORMAL logic: My messages should be on the RIGHT (green)
        const isMe = item.sender_id == currentUserId;

        // DEBUG: ENABLE to see what's happening
        console.log(`Message: "${item.message?.substring(0, 20)}..." | Sender: ${item.sender_id} | CurrentUser: ${currentUserId} | isMe: ${isMe}`);

        const messageText = item.message || '';
        const messageDate = item.created_at ? new Date(parseInt(item.created_at)).toLocaleTimeString() :
            item.date_sent ? new Date(item.date_sent).toLocaleTimeString() : '';

        return (
            <View style={[styles.messageItem, {
                alignSelf: isMe ? 'flex-end' : 'flex-start',
                backgroundColor: isMe ? '#2ECC71' : '#fff',
            }]}>
                <Text style={{ color: isMe ? '#fff' : '#000' }}>{messageText}</Text>
                <Text style={[styles.date, { color: isMe ? '#eee' : '#666' }]}>
                    {messageDate}
                </Text>
            </View>
        );
    };

    if (loading) return <ActivityIndicator style={styles.center} />;

    return (
        <View style={[styles.container, { paddingTop: insets.top, backgroundColor: '#F3F3E9' }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{participantName}</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.chatContainer}>
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderItem}
                    keyExtractor={item => (item.message_id || item.id)?.toString() || Math.random().toString()}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                    contentContainerStyle={styles.messagesList}
                />
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={replyText}
                        onChangeText={setReplyText}
                        placeholder="Type a message..."
                        placeholderTextColor="#999"
                    />
                    <TouchableOpacity onPress={handleSend} disabled={sending} style={styles.sendButton}>
                        <Text style={styles.sendButtonText}>Send</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000',
    },
    chatContainer: { flex: 1 },
    messagesList: { padding: 10 },
    center: { flex: 1, justifyContent: 'center' },
    messageItem: {
        padding: 12,
        margin: 5,
        borderRadius: 16,
        maxWidth: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    date: { fontSize: 10, marginTop: 5, alignSelf: 'flex-end' },
    inputContainer: {
        flexDirection: 'row',
        padding: 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        alignItems: 'center'
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        marginRight: 10,
        backgroundColor: '#F9F9F9',
        color: '#000',
    },
    sendButton: {
        backgroundColor: '#2ECC71',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    sendButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

export default ChatScreen;
