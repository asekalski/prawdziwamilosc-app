import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    SafeAreaView,
    Animated,
    Alert,
    Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { getNotifications, deleteNotification, markNotificationRead } from '../api/notifications';
import HeartLoader from '../components/HeartLoader';

const NotificationsScreen = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const [selectedNotification, setSelectedNotification] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getNotifications();
            setNotifications(data);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    const handleDelete = async (id) => {
        // Optimistic update
        const originalNotifications = [...notifications];
        setNotifications(notifications.filter(item => item.id !== id));

        try {
            await deleteNotification(id);
        } catch (error) {
            Alert.alert('Błąd', 'Nie udało się usunąć powiadomienia.');
            setNotifications(originalNotifications);
        }
    };

    const handleNotificationClick = (item) => {
        setSelectedNotification(item);
        setShowModal(true);

        // Mark as read locally and on server
        if (item.is_new) {
            setNotifications(prev => prev.map(n =>
                n.id === item.id ? { ...n, is_new: 0 } : n
            ));
            markNotificationRead(item.id).catch(err => console.log('Failed to mark read:', err));
        }
    };

    const handleAction = () => {
        if (!selectedNotification) return;

        setShowModal(false);
        const item = selectedNotification;

        // Logic to navigate based on type
        switch (item.type) {
            case 'message':
                navigation.navigate('Chat', {
                    threadId: item.data.item_id,
                    title: item.title
                });
                break;
            case 'match':
                navigation.navigate('UserProfile', { userId: item.data.item_id });
                break;
            default:
                break;
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'message': return 'mail-outline';
            case 'match': return 'heart-outline';
            case 'broadcast': return 'megaphone-outline';
            default: return 'notifications-outline';
        }
    };

    const getIconColor = (type) => {
        switch (type) {
            case 'message': return '#3498DB';
            case 'match': return '#E74C3C';
            case 'broadcast': return '#F1C40F';
            default: return '#95A5A6';
        }
    };

    const renderRightActions = (id, progress, dragX) => {
        const trans = dragX.interpolate({
            inputRange: [-100, 0],
            outputRange: [1, 0],
            extrapolate: 'clamp',
        });

        return (
            <TouchableOpacity
                style={styles.deleteAction}
                onPress={() => handleDelete(id)}
                activeOpacity={0.8}
            >
                <Animated.View style={{ transform: [{ scale: trans }] }}>
                    <Ionicons name="trash-outline" size={28} color="#FFF" />
                </Animated.View>
            </TouchableOpacity>
        );
    };

    const renderItem = ({ item }) => (
        <Swipeable
            renderRightActions={(progress, dragX) => renderRightActions(item.id, progress, dragX)}
            friction={2}
            rightThreshold={40}
        >
            <TouchableOpacity
                style={[styles.notificationItem, item.is_new ? styles.newNotification : null]}
                onPress={() => handleNotificationClick(item)}
                activeOpacity={0.9}
            >
                <View style={[styles.iconContainer, { backgroundColor: getIconColor(item.type) + '20' }]}>
                    <Ionicons name={getIcon(item.type)} size={24} color={getIconColor(item.type)} />
                </View>
                <View style={styles.contentContainer}>
                    <View style={styles.headerRow}>
                        <Text style={styles.title}>{item.title}</Text>
                        {!!item.is_new && <View style={styles.newBadge} />}
                    </View>
                    <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
                    <Text style={styles.date}>{item.date}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#444" />
            </TouchableOpacity>
        </Swipeable>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Powiadomienia</Text>
                <View style={{ width: 44 }} />
            </View>

            {loading && !refreshing ? (
                <View style={styles.centerContainer}>
                    <HeartLoader size={60} color="#FF6B9D" />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#FF6B9D"
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="notifications-off-outline" size={64} color="#333" />
                            <Text style={styles.emptyText}>Brak powiadomień</Text>
                        </View>
                    }
                    contentContainerStyle={styles.listContent}
                />
            )}

            <Modal
                visible={showModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowModal(false)}
                >
                    <View style={styles.modalContainer}>
                        <LinearGradient
                            colors={['#1a1a2e', '#0d0d1a']}
                            style={styles.modalContent}
                        >
                            <TouchableOpacity
                                style={styles.closeModalButton}
                                onPress={() => setShowModal(false)}
                            >
                                <Ionicons name="close" size={24} color="#FFF" />
                            </TouchableOpacity>

                            <View style={[styles.modalIconContainer, { backgroundColor: getIconColor(selectedNotification?.type) + '20' }]}>
                                <Ionicons
                                    name={getIcon(selectedNotification?.type)}
                                    size={40}
                                    color={getIconColor(selectedNotification?.type)}
                                />
                            </View>

                            <Text style={styles.modalTitle}>{selectedNotification?.title}</Text>
                            <Text style={styles.modalDate}>{selectedNotification?.date}</Text>

                            <View style={styles.modalBodyContainer}>
                                <Text style={styles.modalBody}>{selectedNotification?.body}</Text>
                            </View>

                            {(selectedNotification?.type === 'message' || selectedNotification?.type === 'match') && (
                                <TouchableOpacity
                                    style={[styles.modalActionButton, { backgroundColor: getIconColor(selectedNotification?.type) }]}
                                    onPress={handleAction}
                                >
                                    <Text style={styles.modalActionText}>
                                        {selectedNotification?.type === 'message' ? 'Otwórz czat' : 'Zobacz profil'}
                                    </Text>
                                    <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={styles.modalCloseLink}
                                onPress={() => setShowModal(false)}
                            >
                                <Text style={styles.modalCloseLinkText}>Zamknij</Text>
                            </TouchableOpacity>
                        </LinearGradient>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0d0d1a',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFF',
    },
    backButton: {
        padding: 10,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingBottom: 20,
    },
    notificationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        backgroundColor: '#0d0d1a',
    },
    newNotification: {
        backgroundColor: 'rgba(255, 107, 157, 0.05)',
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    contentContainer: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFF',
        marginRight: 8,
    },
    newBadge: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF6B9D',
    },
    body: {
        fontSize: 14,
        color: '#BBB',
        marginBottom: 4,
    },
    date: {
        fontSize: 12,
        color: '#666',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 100,
    },
    emptyText: {
        color: '#444',
        fontSize: 16,
        marginTop: 10,
    },
    deleteAction: {
        backgroundColor: '#E74C3C',
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        height: '100%',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalContainer: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    modalContent: {
        padding: 24,
        alignItems: 'center',
    },
    closeModalButton: {
        position: 'absolute',
        right: 16,
        top: 16,
        padding: 8,
        zIndex: 10
    },
    modalIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#FFF',
        textAlign: 'center',
        marginBottom: 8,
    },
    modalDate: {
        fontSize: 14,
        color: '#666',
        marginBottom: 20,
    },
    modalBodyContainer: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
    },
    modalBody: {
        fontSize: 16,
        lineHeight: 24,
        color: '#DDD',
        textAlign: 'center',
    },
    modalActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: '100%',
        marginBottom: 16,
    },
    modalActionText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    modalCloseLink: {
        padding: 8,
    },
    modalCloseLinkText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '500',
    }
});

export default NotificationsScreen;
