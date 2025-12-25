import React, { useState, useEffect, useContext } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { getThreads } from '../api/messages';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';

const MessagesScreen = () => {
    const [threads, setThreads] = useState([]);
    const [allMessages, setAllMessages] = useState([]); // Store all messages
    const [users, setUsers] = useState({}); // Store users by ID
    const [loading, setLoading] = useState(false);
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { userInfo } = useContext(AuthContext);

    const fetchThreads = async () => {
        setLoading(true);
        try {
            // DEBUG: Discover API routes
            console.log('Discovering API routes...');
            try {
                const rootResponse = await client.get('/wp-json/');
                const routes = rootResponse.data.routes;
                if (routes) {
                    const bmRoutes = Object.keys(routes).filter(r => r.includes('better-messages'));
                    console.log('Better Messages Routes:', bmRoutes);
                    // Alert the user to these routes so we can see them
                    if (bmRoutes.length > 0) {
                        alert('Routes Found: ' + JSON.stringify(bmRoutes.slice(0, 5)));
                        console.log('ALL ROUTES:', JSON.stringify(bmRoutes));
                    } else {
                        console.log('No Better Messages routes found in /wp-json/');
                    }
                }
            } catch (e) {
                console.log('Failed to discover routes:', e.message);
            }

            const data = await getThreads();
            // Better Messages returns {threads: [...], messages: [...], users: [...]}
            // We need to extract and store all data
            const threadsArray = data.threads || data || [];
            const messagesArray = data.messages || [];
            const usersArray = data.users || [];

            // Convert users array to object for easy lookup
            const usersMap = {};
            usersArray.forEach(user => {
                usersMap[user.user_id] = user;
            });

            setThreads(threadsArray);
            setAllMessages(messagesArray);
            setUsers(usersMap);
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

    const renderItem = ({ item }) => {
        // Better Messages uses different structure
        const thread = item;

        // DEBUG: Log one thread to see structure
        if (thread.thread_id === 22 || thread.thread_id === 18) {
            console.log('Full Thread Object:', JSON.stringify(thread, null, 2));
        }

        // Find last message from allMessages
        const threadMessages = allMessages.filter(m => m.thread_id === thread.thread_id);
        const lastMsg = threadMessages.length > 0
            ? threadMessages.sort((a, b) => (b.created_at || b.date_sent) - (a.created_at || a.date_sent))[0]
            : null;

        const lastMessage = lastMsg ? (lastMsg.message || 'Załącznik') : (thread.lastMessage || 'Brak wiadomości');
        const lastTime = lastMsg
            ? new Date(parseInt(lastMsg.created_at || lastMsg.date_sent)).toLocaleDateString()
            : (thread.lastTime ? new Date(parseInt(thread.lastTime)).toLocaleDateString() : '');

        // Debug logs
        // console.log('Thread:', thread.thread_id);
        // console.log('Participants:', thread.participants);
        // console.log('UserInfo ID:', userInfo?.id);

        // Get participant names (excluding current user)
        const participantNames = thread.participants
            ? thread.participants
                .map(p => {
                    const userId = p.user_id || p;
                    // Try to match loosely (string vs number)
                    if (userInfo?.id && userId == userInfo.id) return null;

                    const user = users[userId];
                    return user ? user.name : null;
                })
                .filter(Boolean)
                .join(', ')
            : '';

        const threadTitle = participantNames || thread.title || thread.subject || 'Konwersacja';

        return (
            <TouchableOpacity
                style={styles.item}
                onPress={() => navigation.navigate('Chat', {
                    threadId: thread.thread_id,
                    allMessages: allMessages,
                    users: users,
                    title: threadTitle // Pass resolved title
                })}
                activeOpacity={0.7}
            >
                <View style={styles.iconContainer}>
                    <Ionicons name="chatbubble-ellipses" size={24} color="#2ECC71" />
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
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Messages</Text>
            </View>

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
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 15,
        marginBottom: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
        alignItems: 'center',
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
});

export default MessagesScreen;
