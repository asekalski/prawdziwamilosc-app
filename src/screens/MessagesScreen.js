import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Image, ScrollView, Alert, Animated } from 'react-native';
import { getThreads, deleteThread } from '../api/messages';
import { getMatches } from '../api/members';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { Swipeable } from 'react-native-gesture-handler';

const MessagesScreen = () => {
    const [threads, setThreads] = useState([]);
    const [allMessages, setAllMessages] = useState([]); // Store all messages
    const [matches, setMatches] = useState([]); // Store matches
    const [users, setUsers] = useState({}); // Store users by ID
    const [loading, setLoading] = useState(false);
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { userInfo, refreshUnreadCount } = useContext(AuthContext);

    // Keep track of open swipeables to close them when another opens
    const swipeableRefs = useRef(new Map());

    const fetchThreads = async () => {
        setLoading(true);
        try {
            const data = await getThreads();
            // Better Messages returns {threads: [...], messages: [...], users: [...]}
            // We need to extract and store all data
            const threadsArray = data.threads || data || [];
            const messagesArray = data.messages || [];
            const usersArray = data.users || [];

            // Fetch matches
            try {
                const matchesData = await getMatches();
                setMatches(matchesData || []);
            } catch (err) {
                console.log('Failed to fetch matches for rail:', err);
            }

            // Convert users array to object for easy lookup
            const usersMap = {};
            usersArray.forEach(user => {
                usersMap[user.user_id] = user;
            });

            // De-duplicate threads by recipient (for private 1-on-1 chats)
            const uniqueThreads = [];
            const seenRecipients = new Set();

            threadsArray.forEach(thread => {
                const participants = thread.participants || [];
                const otherParticipants = participants
                    .map(p => p.user_id || p)
                    .filter(id => userInfo?.id && id != userInfo.id);

                if (otherParticipants.length === 1 && otherParticipants[0]) {
                    const recipientId = otherParticipants[0].toString();
                    if (seenRecipients.has(recipientId)) {
                        return; // Skip duplicate thread for same recipient
                    }
                    seenRecipients.add(recipientId);
                }
                uniqueThreads.push(thread);
            });

            setThreads(uniqueThreads);
            setAllMessages(messagesArray);
            setUsers(usersMap);
            refreshUnreadCount(uniqueThreads);
        } catch (error) {
            console.error(error);
            alert(`Failed to load messages: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchThreads();
        const unsubscribe = navigation.addListener('focus', fetchThreads);
        return unsubscribe;
    }, [navigation]);

    const handleDelete = (threadId) => {
        Alert.alert(
            "Usuń konwersację",
            "Czy na pewno chcesz usunąć tę konwersację? Tej operacji nie można cofnąć.",
            [
                { text: "Anuluj", style: "cancel" },
                {
                    text: "Usuń",
                    style: "destructive",
                    onPress: async () => {
                        // Optimistic update
                        const previousThreads = [...threads];
                        setThreads(current => current.filter(t => t.thread_id !== threadId));

                        try {
                            await deleteThread(threadId);
                        } catch (error) {
                            console.error("Delete failed, rolling back", error);
                            alert("Nie udało się usunąć konwersacji.");
                            setThreads(previousThreads); // Rollback
                        }
                    }
                }
            ]
        );
    };

    const renderRightActions = (progress, dragX, threadId) => {
        const scale = dragX.interpolate({
            inputRange: [-80, 0],
            outputRange: [1, 0],
            extrapolate: 'clamp',
        });

        return (
            <TouchableOpacity onPress={() => handleDelete(threadId)}>
                <View style={styles.deleteAction}>
                    <Animated.View style={{ transform: [{ scale }] }}>
                        <Ionicons name="trash-outline" size={30} color="#fff" />
                    </Animated.View>
                    <Animated.Text style={[styles.deleteText, { transform: [{ scale }] }]}>Usuń</Animated.Text>
                </View>
            </TouchableOpacity>
        );
    };

    const renderItem = ({ item }) => {
        // Better Messages uses different structure
        const thread = item;

        // Find last message from allMessages
        const threadMessages = allMessages.filter(m => m.thread_id === thread.thread_id);
        const lastMsg = threadMessages.length > 0
            ? threadMessages.sort((a, b) => (b.created_at || b.date_sent) - (a.created_at || a.date_sent))[0]
            : null;

        const lastMessage = lastMsg ? (lastMsg.message || 'Załącznik') : (thread.lastMessage || 'Brak wiadomości');
        const lastTime = lastMsg
            ? new Date(parseInt(lastMsg.created_at || lastMsg.date_sent)).toLocaleDateString()
            : (thread.lastTime ? new Date(parseInt(thread.lastTime)).toLocaleDateString() : '');

        // Get participant names (excluding current user) and their avatar
        let participantAvatar = null;
        let participantId = null;
        const participantNames = thread.participants
            ? thread.participants
                .map(p => {
                    const userId = p.user_id || p;
                    // Try to match loosely (string vs number)
                    if (userInfo?.id && userId == userInfo.id) return null;

                    participantId = userId;
                    const user = users[userId];
                    // Get avatar from first non-current-user participant
                    if (user && !participantAvatar) {
                        participantAvatar = user.avatar || null;
                    }
                    return user ? user.name : null;
                })
                .filter(Boolean)
                .join(', ')
            : '';

        const threadTitle = participantNames || thread.title || thread.subject || 'Konwersacja';

        return (
            <Swipeable
                ref={(ref) => {
                    if (ref && !swipeableRefs.current.has(item.thread_id)) {
                        swipeableRefs.current.set(item.thread_id, ref);
                    }
                }}
                renderRightActions={(progress, dragX) =>
                    renderRightActions(progress, dragX, item.thread_id)
                }
                onSwipeableWillOpen={() => {
                    // Close other open swipeables
                    [...swipeableRefs.current.entries()].forEach(([key, ref]) => {
                        if (key !== item.thread_id && ref) ref.close();
                    });
                }}
            >
                <TouchableOpacity
                    style={styles.item}
                    onPress={() => navigation.navigate('Chat', {
                        threadId: thread.thread_id,
                        allMessages: allMessages,
                        users: users,
                        title: threadTitle, // Pass resolved title
                        participantId: participantId,
                        participantAvatar: participantAvatar
                    })}
                    activeOpacity={0.7}
                >
                    <View style={styles.iconContainer}>
                        {participantAvatar ? (
                            <Image
                                source={{ uri: participantAvatar }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <Ionicons name="chatbubble-ellipses" size={24} color="#2ECC71" />
                        )}
                        {thread.unread > 0 && (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadText}>{thread.unread}</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.content}>
                        <Text style={styles.subject} numberOfLines={1}>
                            {threadTitle || `Thread #${thread.thread_id}`}
                        </Text>
                        <Text style={styles.excerpt} numberOfLines={2}>
                            {lastMessage}
                        </Text>
                    </View>
                    <View style={styles.metaContainer}>
                        <Text style={styles.date}>{lastTime}</Text>
                        <Ionicons name="chevron-forward" size={20} color="#999" />
                    </View>
                </TouchableOpacity>
            </Swipeable>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Messages</Text>
            </View>

            {/* Matches Rail - only show matches WITHOUT active conversations */}
            {(() => {
                // Get all user IDs that have active threads
                const usersWithThreads = new Set();
                threads.forEach(thread => {
                    if (thread.participants) {
                        thread.participants.forEach(p => {
                            const userId = p.user_id || p;
                            // Exclude current user
                            if (userInfo?.id && userId && userId != userInfo.id) {
                                usersWithThreads.add(userId.toString());
                            }
                        });
                    }
                });

                // Filter matches to only show those WITHOUT threads
                const newMatches = matches.filter(match =>
                    match.id && !usersWithThreads.has(match.id.toString())
                );

                return newMatches.length > 0 && (
                    <View style={styles.matchesRailContainer}>
                        <Text style={styles.matchesTitle}>Nowe pary</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.matchesContent}
                        >
                            {newMatches.map(match => (
                                <TouchableOpacity
                                    key={match.id}
                                    style={styles.matchItem}
                                    onPress={() => navigation.navigate('NewMessage', {
                                        recipientId: match.id,
                                        recipientName: match.name
                                    })}
                                >
                                    <View style={styles.matchAvatarContainer}>
                                        <Image
                                            source={{ uri: match.hires_avatar?.large || match.hires_avatar?.full || match.avatar_urls?.full || 'https://via.placeholder.com/60' }}
                                            style={styles.matchAvatar}
                                        />
                                    </View>
                                    <Text style={styles.matchName} numberOfLines={1}>{match.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                );
            })()}

            {threads.length === 0 && !loading ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
                    <Text style={styles.emptyText}>No messages yet</Text>
                    <Text style={styles.emptySubtext}>Start a conversation!</Text>
                </View>
            ) : (
                <FlatList
                    data={threads}
                    renderItem={renderItem}
                    keyExtractor={item => item.thread_id?.toString() || Math.random().toString()}
                    ListFooterComponent={loading ? <ActivityIndicator size="large" color="#2ECC71" style={styles.loader} /> : null}
                    contentContainerStyle={styles.listContent}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#2C2C2E' },
    header: {
        padding: 20,
        paddingBottom: 15,
        backgroundColor: '#3A3A3C',
        borderBottomWidth: 1,
        borderBottomColor: '#4A4A4C',
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        fontFamily: 'serif',
        color: '#FFFFFF',
    },
    listContent: { padding: 15 },
    item: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.9)', // Slightly transparent
        padding: 15,
        borderRadius: 15,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)', // Subtle glass/paper border
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
        alignItems: 'center',
    },
    // New delete action styles
    deleteAction: {
        backgroundColor: '#E74C3C',
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        height: '100%',
        marginBottom: 10, // Match item marginBottom
        borderRadius: 15, // Match item borderRadius
        marginLeft: 10,
    },
    deleteText: {
        color: 'white',
        fontWeight: '600',
        padding: 5,
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#E8F8F0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        position: 'relative',
        overflow: 'hidden',
    },
    avatarImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    unreadBadge: {
        position: 'absolute',
        top: -5,
        right: -5,
        backgroundColor: '#E74C3C',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 5,
    },
    unreadText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
    },
    content: { flex: 1, marginRight: 10 },
    subject: { fontWeight: 'bold', fontSize: 16, marginBottom: 4, color: '#000' },
    excerpt: { color: '#666', fontSize: 14 },
    metaContainer: { alignItems: 'flex-end' },
    date: { fontSize: 12, color: '#999', marginBottom: 5 },
    loader: { marginVertical: 20 },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#CCCCCC',
        marginTop: 20,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#999999',
        marginTop: 5,
    },

    // Matches Rail Styles
    matchesRailContainer: {
        paddingVertical: 15,
        paddingLeft: 20,
        backgroundColor: '#2C2C2E',
        borderBottomWidth: 1,
        borderBottomColor: '#3A3A3C',
    },
    matchesTitle: {
        color: '#E74C3C',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 10,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    matchesContent: {
        paddingRight: 20,
    },
    matchItem: {
        marginRight: 15,
        alignItems: 'center',
        width: 70,
    },
    matchAvatarContainer: {
        padding: 2,
        borderRadius: 35,
        borderWidth: 2,
        borderColor: '#E74C3C',
        marginBottom: 5,
    },
    matchAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    matchName: {
        color: '#fff',
        fontSize: 12,
        textAlign: 'center',
    },
});

export default MessagesScreen;
