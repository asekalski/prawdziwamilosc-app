import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Image, ScrollView, Alert, Animated, RefreshControl } from 'react-native';
import { getThreads, deleteThread } from '../api/messages';
import { addSkippedUser, getSkippedUserIds, addLocalSkippedUser } from '../api/skipped';
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

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

    // Use Ref to avoid stale closure in setInterval
    const threadsRef = useRef([]);
    const flatListRef = useRef();

    useEffect(() => {
        threadsRef.current = threads;
    }, [threads]);

    const fetchThreads = React.useCallback(async (isManual = false, isSilent = false) => {
        // Guard: Do not fetch if no user info/token
        if (!userInfo || !userInfo.id) {
            console.log('fetchThreads skipped - no user info');
            setLoading(false);
            setIsRefreshing(false);
            return;
        }

        // Only show full loading indicator on first mount
        // Skip loading if this is a silent background refresh
        if (!hasLoadedOnce && threadsRef.current.length === 0 && !isManual && !isSilent) {
            setLoading(true);
        }

        // If manual pull-to-refresh, show that indicator
        if (isManual) {
            setIsRefreshing(true);
        }

        try {
            // Fetch threads and matches in parallel
            const [data, matchesData] = await Promise.all([
                getThreads().catch(e => {
                    // Suppress 401/403 from interfering with Promise.all
                    if (e.response && (e.response.status === 401 || e.response.status === 403)) {
                        return null;
                    }
                    console.log('Threads fetch failed:', e);
                    return null;
                }),
                getMatches().catch(e => { console.log('Matches fetch failed:', e); return []; })
            ]);

            if (!data) {
                // If null returned (likely due to error suppression above), just exit without error
                return;
            }

            // Better Messages returns {threads: [...], messages: [...], users: [...]}
            const threadsArray = data.threads || data || [];
            const messagesArray = data.messages || [];
            const usersArray = data.users || [];

            // 1. Handle Matches
            if (JSON.stringify(matchesData) !== JSON.stringify(matches)) {
                setMatches(matchesData || []);
            }

            // 2. Handle Users
            const usersMap = {};
            usersArray.forEach(user => {
                usersMap[user.user_id] = user;
            });
            // Simple depth-1 comparison for users map
            if (Object.keys(usersMap).length > 0) {
                setUsers(prev => {
                    const hasChanged = Object.keys(usersMap).some(id =>
                        JSON.stringify(usersMap[id]) !== JSON.stringify(prev[id])
                    );
                    return hasChanged ? { ...prev, ...usersMap } : prev;
                });
            }

            // 3. Handle Blocked Users
            let blockedIds = [];
            try {
                blockedIds = await getSkippedUserIds();
                blockedIds = blockedIds.map(id => id.toString());
            } catch (err) {
                console.log('Failed to fetch blocked IDs:', err);
            }

            // 4. Filter & De-duplicate Threads
            const uniqueThreads = [];
            const seenRecipients = new Set();

            threadsArray.forEach(thread => {
                const participants = thread.participants || [];
                const otherParticipants = participants
                    .map(p => (p.user_id || p).toString())
                    .filter(id => userInfo?.id && id != userInfo.id.toString());

                if (otherParticipants.length === 1 && otherParticipants[0]) {
                    const recipientId = otherParticipants[0];
                    if (blockedIds.includes(recipientId)) return;
                    if (seenRecipients.has(recipientId)) return;
                    seenRecipients.add(recipientId);
                }
                uniqueThreads.push(thread);
            });

            const limitedThreads = uniqueThreads.slice(0, 20);

            // 5. Deep compare threads to avoid unnecessary flicker
            const currentThreadsStr = JSON.stringify(threads.map(t => ({
                id: t.thread_id,
                u: t.unread,
                m: t.lastMessage,
                t: t.lastTime
            })));
            const newThreadsStr = JSON.stringify(limitedThreads.map(t => ({
                id: t.thread_id,
                u: t.unread,
                m: t.lastMessage,
                t: t.lastTime
            })));

            if (currentThreadsStr !== newThreadsStr || threads.length === 0) {
                setThreads(limitedThreads);
            }

            // 6. Messages
            if (messagesArray.length > 0 && JSON.stringify(messagesArray) !== JSON.stringify(allMessages)) {
                setAllMessages(messagesArray);
            }

            // 7. Update Global Badge
            refreshUnreadCount(uniqueThreads);

        } catch (error) {
            // Suppress 401/403 errors (Account deleted, token expired, etc.)
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                console.log('Messages fetch suppressed (401/403):', error.message);
                return;
            }

            console.error('Messages Fetch Error:', error);
            if (threads.length === 0 && !isSilent) {
                // Only alert if not silent background refresh
                // alert(`Błąd: ${error.message}`);
                console.log(`Błąd fetchThreads: ${error.message}`);
            }
        } finally {
            setLoading(false);
            setIsRefreshing(false);
            setHasLoadedOnce(true);
        }
    }, [userInfo, hasLoadedOnce, matches, allMessages, threads]);

    useEffect(() => {
        // Initial fetch
        fetchThreads();

        const unsubscribe = navigation.addListener('focus', () => {
            fetchThreads();
            // Force scroll to top to prevent "gap" or layout jump
            flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        });

        // Add background polling for the list (every 15 seconds)
        // Use silent mode to prevent spinner flashing
        const interval = setInterval(() => fetchThreads(false, true), 15000);

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, [navigation, fetchThreads]);

    const handleDelete = (threadId, participantId) => {
        Alert.alert(
            "Usuń konwersację",
            "Czy na pewno chcesz usunąć tę konwersację? Wiadomości zostaną trwale usunięte, a użytkownik trafi do zakładki 'Usunięci'. Będziesz mógł go stamtąd przywrócić, ale historia czatu nie zostanie odzyskana.",
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
                            console.log(`Deleting thread ${threadId}...`);
                            await deleteThread(threadId);

                            // NEW: Add participant to local skipped list immediately so they appear in Deleted tab
                            if (participantId) {
                                console.log(`Adding user ${participantId} to local skipped list...`);
                                await addLocalSkippedUser(participantId);
                            }

                            console.log(`Thread ${threadId} deleted successfully on backend.`);

                            // Fully refresh everything to ensure states are synced
                            await fetchThreads();
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

    const renderRightActions = (progress, dragX, threadId, participantId) => {
        const scale = dragX.interpolate({
            inputRange: [-80, 0],
            outputRange: [1, 0],
            extrapolate: 'clamp',
        });

        return (
            <TouchableOpacity onPress={() => handleDelete(threadId, participantId)}>
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
                    renderRightActions(progress, dragX, item.thread_id, participantId)
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

    // Memoize the filtered matches to prevent re-calculations and layout shifts
    const newMatches = React.useMemo(() => {
        // Get all user IDs that have active threads
        const usersWithThreads = new Set();
        threads.forEach(thread => {
            if (thread.participants) {
                thread.participants.forEach(p => {
                    const userId = p.user_id || p;
                    if (userInfo?.id && userId && String(userId) !== String(userInfo.id)) {
                        usersWithThreads.add(String(userId));
                    }
                });
            }
        });

        return matches.filter(match =>
            match.id && !usersWithThreads.has(String(match.id))
        );
    }, [matches, threads, userInfo?.id]);

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 5 }]}>
                <Text style={styles.headerSubtitle}>PRAWDZIWA MIŁOŚĆ</Text>
                <Text style={styles.headerTitle}>Wiadomości</Text>
            </View>

            {/* Render Matches Rail outside FlatList for stability */}
            {newMatches.length > 0 && (
                <View style={styles.matchesRailContainer}>
                    <Text style={styles.matchesTitle}>Nowe pary</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.matchesContent}
                    >
                        {newMatches.map(match => (
                            <TouchableOpacity
                                key={String(match.id)}
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
            )}

            <FlatList
                ref={flatListRef}
                data={threads}
                renderItem={renderItem}
                keyExtractor={item => (item.id || item.thread_id || Math.random()).toString()}
                // Removed ListHeaderComponent to prevent layout jumps
                contentInsetAdjustmentBehavior="never"
                automaticallyAdjustContentInsets={false}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
                            <Text style={styles.emptyText}>Brak wiadomości</Text>
                            <Text style={styles.emptySubtext}>Rozpocznij konwersację!</Text>
                        </View>
                    ) : (
                        <View style={styles.centeredLoader}>
                            <ActivityIndicator size="large" color="#2ECC71" />
                        </View>
                    )
                }
                contentContainerStyle={[
                    styles.listContent,
                    threads.length === 0 && { flex: 1 } // Allow empty state to center
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => fetchThreads(true)}
                        tintColor="#2ECC71"
                        colors={["#2ECC71"]}
                    />
                }
            />
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
    headerSubtitle: {
        fontSize: 12,
        color: '#E74C3C',
        fontWeight: '700',
        marginBottom: 2,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    listContent: { paddingHorizontal: 15, paddingBottom: 30, paddingTop: 10 },
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
    centeredLoader: {
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
