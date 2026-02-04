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

    // Single source of truth
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const flatListRef = useRef();

    // Helper to parse dates safely
    const parseDate = (msg) => {
        if (msg.isOptimistic && msg.date_sent) return new Date(msg.date_sent);
        if (msg.created_at && !isNaN(msg.created_at)) return new Date(parseInt(msg.created_at));
        if (msg.date_sent) return new Date(msg.date_sent);
        return new Date(); // Fallback
    };

    // User info setup
    const currentUser = Object.values(users).find(u =>
        u.name?.toLowerCase() === userInfo?.nicename?.toLowerCase() ||
        u.name?.toLowerCase() === userInfo?.displayName?.toLowerCase()
    );
    const currentUserId = currentUser?.user_id || currentUser?.id;
    const participant = Object.values(users).find(u => String(u.user_id) !== String(currentUserId));
    const participantName = title || participant?.name || 'Konwersacja';
    const participantAvatar = participant?.avatar || null;

    // 1. Initial Load
    useEffect(() => {
        let threadMessages = allMessages.filter(msg =>
            parseInt(msg.thread_id) === parseInt(threadId)
        );
        threadMessages.sort((a, b) => parseDate(a) - parseDate(b));
        setMessages(threadMessages);
        setLoading(false);
    }, [threadId]);

    // 2. Polling with SIMPLE Merge Logic
    useEffect(() => {
        const fetchFreshMessages = async () => {
            try {
                const threadsData = await getThreads(1, 50);
                let incomingMessages = [];
                if (threadsData?.messages && Array.isArray(threadsData.messages)) {
                    incomingMessages = threadsData.messages.filter(msg =>
                        parseInt(msg.thread_id) === parseInt(threadId)
                    );
                }

                if (incomingMessages.length === 0) return;

                setMessages(currentMessages => {
                    // Create a map of incoming messages by ID for fast lookup
                    // Use a composite key if needed, or just ID if reliable
                    const incomingMap = new Map();
                    incomingMessages.forEach(m => {
                        if (m.id || m.message_id) incomingMap.set((m.id || m.message_id).toString(), m);
                    });

                    // Start with current messages
                    // We want to KEEP optimistic messages that are NOT yet in the incoming list
                    // And UPDATE messages that ARE in the incoming list

                    const merged = [];
                    const processedIncomingIds = new Set();

                    // Process current messages first
                    currentMessages.forEach(msg => {
                        // If it's optimistic...
                        if (msg.isOptimistic) {
                            // Check if we found a match in incoming (by content & sender)
                            // "Confirmation" logic
                            const match = incomingMessages.find(inc => {
                                const incText = (inc.message || '').replace(/<[^>]*>/g, '').trim().toLowerCase();
                                const msgText = (msg.message || '').replace(/<[^>]*>/g, '').trim().toLowerCase();
                                return incText === msgText && String(inc.sender_id) === String(msg.sender_id);
                            });

                            if (match) {
                                // Found a match! Use the incoming message (confirmed)
                                // Only if this incoming message hasn't been used yet? 
                                // Ideally yes, but for now simple replacement is mostly fine.
                                merged.push(match);
                                processedIncomingIds.add((match.id || match.message_id).toString());
                            } else {
                                // Not confirmed yet, keep optimistic
                                // Check expiry
                                if (msg.optimisticExpiry && Date.now() > msg.optimisticExpiry) {
                                    // Expired, drop it
                                } else {
                                    merged.push(msg);
                                }
                            }
                        } else {
                            // Regular message.
                            // Check if there is an updated version in incoming
                            const id = (msg.id || msg.message_id)?.toString();
                            if (id && incomingMap.has(id)) {
                                merged.push(incomingMap.get(id));
                                processedIncomingIds.add(id);
                            } else {
                                // Keep existing (maybe it fell off the pagination window)
                                merged.push(msg);
                            }
                        }
                    });

                    // Add any NEW incoming messages that weren't in current
                    incomingMessages.forEach(msg => {
                        const id = (msg.id || msg.message_id)?.toString();
                        if (id && !processedIncomingIds.has(id)) {
                            // Ensure we don't add duplicates if currentMessages didn't have it
                            // (We already iterated currentMessages, so if it wasn't there, we add it here)
                            // BUT we need to check if we already added it via the "Optimistic Match" replacement above
                            // processedIncomingIds handles that.
                            merged.push(msg);
                        }
                    });

                    // Sort everything final time
                    merged.sort((a, b) => parseDate(a) - parseDate(b));

                    // Simple deduplication by ID just in case
                    const unique = [];
                    const seenIds = new Set();
                    merged.forEach(m => {
                        const id = (m.id || m.message_id || m.tempId)?.toString();
                        if (!id || !seenIds.has(id)) {
                            unique.push(m);
                            if (id) seenIds.add(id);
                        }
                    });

                    return unique;
                });

            } catch (error) {
                console.log('Polling error:', error.message);
            }
        };

        const interval = setInterval(fetchFreshMessages, 5000);
        return () => clearInterval(interval);
    }, [threadId]);

    // 3. Simple Send Logic
    const handleSend = async () => {
        if (!replyText.trim()) return;

        const messageText = replyText.trim();
        const tempId = `temp_${Date.now()}`;

        // Create Optimistic Message
        const tempMessage = {
            id: tempId,
            message_id: tempId,
            tempId: tempId,
            thread_id: threadId,
            sender_id: currentUserId,
            message: messageText,
            date_sent: new Date().toISOString(),
            isOptimistic: true,
            optimisticExpiry: Date.now() + 60000
        };

        // Add to state immediately
        setMessages(prev => [...prev, tempMessage]);

        setReplyText('');
        setSending(true);

        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            await client.post(`/better-messages/v1/thread/${threadId}/send`, {
                message: messageText,
                content: messageText,
                tempId: tempId
            });
            // On success, we just wait for polling to replace it.
            // Or we could try to update it if the response had data.
        } catch (error) {
            console.error('Send error:', error);
            setMessages(prev => prev.filter(m => m.id !== tempId));
            alert('Nie udało się wysłać wiadomości.');
            setReplyText(messageText);
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item }) => {
        const senderId = String(item.sender_id);
        const myId = String(currentUserId);
        const isMe = senderId === myId;
        const messageText = (item.message || '').replace(/<[^>]*>/g, '').trim();

        let timeString = '';
        try {
            const date = parseDate(item);
            timeString = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
        } catch (e) { }

        return (
            <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
                <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                    {messageText}
                </Text>
                <Text style={[styles.messageTime, isMe ? styles.myMessageTime : styles.theirMessageTime]}>
                    {timeString}
                </Text>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2ECC71" /></View>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={[styles.container, { paddingTop: insets.top }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                {participantAvatar && <Image source={{ uri: participantAvatar }} style={styles.headerAvatar} />}
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>{participantName}</Text>
                    <Text style={styles.headerSubtitle}>Online</Text>
                </View>
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={item => (item.id || item.message_id || item.tempId)?.toString()}
                contentContainerStyle={styles.messagesList}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="chatbubbles-outline" size={64} color="#555" />
                        <Text style={styles.emptyText}>Brak wiadomości</Text>
                        <Text style={styles.emptySubtext}>Rozpocznij konwersację</Text>
                    </View>
                }
            />

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
                    {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1C1C1E' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#2C2C2E', borderBottomWidth: 1, borderBottomColor: '#3A3A3C' },
    backButton: { marginRight: 12, padding: 4 },
    headerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
    headerInfo: { flex: 1 },
    headerTitle: { fontSize: 17, fontWeight: '600', color: '#fff' },
    headerSubtitle: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyText: { fontSize: 18, fontWeight: '600', color: '#fff', marginTop: 16 },
    emptySubtext: { fontSize: 14, color: '#8E8E93', marginTop: 8, textAlign: 'center' },
    messagesList: { padding: 15, paddingBottom: 10 },
    messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 18, marginBottom: 8 },
    myMessage: { alignSelf: 'flex-end', backgroundColor: '#2ECC71', borderBottomRightRadius: 4 },
    theirMessage: { alignSelf: 'flex-start', backgroundColor: '#3A3A3C', borderBottomLeftRadius: 4 },
    messageText: { fontSize: 16, lineHeight: 20 },
    myMessageText: { color: '#fff' },
    theirMessageText: { color: '#fff' },
    messageTime: { fontSize: 11, marginTop: 4 },
    myMessageTime: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
    theirMessageTime: { color: '#8E8E93' },
    inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, paddingTop: 10, backgroundColor: '#2C2C2E', borderTopWidth: 1, borderTopColor: '#3A3A3C' },
    input: { flex: 1, backgroundColor: '#3A3A3C', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, color: '#fff', maxHeight: 100, marginRight: 10 },
    sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2ECC71', justifyContent: 'center', alignItems: 'center' },
    sendButtonDisabled: { backgroundColor: '#555' },
});

export default ChatScreen;
