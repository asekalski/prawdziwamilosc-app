import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSkippedUsers, restoreUser, likeSkippedUser } from '../api/skipped';

const SkippedScreen = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    const fetchSkippedUsers = async (isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        try {
            const data = await getSkippedUsers();
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching skipped users:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchSkippedUsers();
        }, [])
    );

    const onRefresh = () => {
        fetchSkippedUsers(true);
    };

    const handleRestore = async (userId) => {
        try {
            await restoreUser(userId);
            setUsers(prev => prev.filter(u => u.id !== userId));
        } catch (error) {
            Alert.alert('Błąd', 'Nie udało się przywrócić użytkownika.');
        }
    };

    const handleLike = async (userId) => {
        try {
            await likeSkippedUser(userId);
            setUsers(prev => prev.filter(u => u.id !== userId));
            Alert.alert('Sukces', 'Polubiono użytkownika!');
        } catch (error) {
            Alert.alert('Błąd', 'Nie udało się polubić użytkownika.');
        }
    };

    const renderItem = ({ item }) => {
        const imageUrl = item.hires_avatar?.large || item.hires_avatar?.full || item.avatar_urls?.full;

        return (
            <View style={styles.card}>
                <TouchableOpacity
                    style={styles.cardContent}
                    onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
                    activeOpacity={0.7}
                >
                    <Image source={{ uri: imageUrl }} style={styles.avatar} />
                    <View style={styles.info}>
                        <Text style={styles.name}>{item.name}</Text>
                        <Text style={styles.subtitle}>@{item.mention_name}</Text>
                    </View>
                </TouchableOpacity>
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.restoreButton]}
                        onPress={() => handleRestore(item.id)}
                    >
                        <Ionicons name="arrow-undo" size={18} color="#fff" />
                        <Text style={styles.actionText}>Przywróć</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.likeButton]}
                        onPress={() => handleLike(item.id)}
                    >
                        <Ionicons name="heart" size={18} color="#fff" />
                        <Text style={styles.actionText}>Polub</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Usunięci</Text>
                <Text style={styles.headerInfo}>
                    Ci użytkownicy nie mogą do Ciebie pisać ani Cię lajkować.
                </Text>
                <Text style={styles.headerSubtitle}>
                    {users.length} {users.length === 1 ? 'osoba' : 'osób'}
                </Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#3498db" style={styles.loader} />
            ) : users.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="trash-outline" size={64} color="#ccc" />
                    <Text style={styles.emptyText}>Brak usuniętych profili</Text>
                    <Text style={styles.emptySubtext}>Tutaj pojawią się profile, które pominiesz</Text>
                </View>
            ) : (
                <FlatList
                    data={users}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#3498db"
                        />
                    }
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
        marginBottom: 8,
    },
    headerInfo: {
        fontSize: 14,
        color: '#E8B4B8', // Using the app's secondary pinkish color for attention
        marginBottom: 8,
        lineHeight: 20,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#CCCCCC',
        fontWeight: '500',
    },
    listContent: { padding: 15 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 15,
        marginBottom: 12,
        padding: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginRight: 15,
        borderWidth: 2,
        borderColor: '#eee',
    },
    info: { flex: 1 },
    name: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8, // Reduced gap to give more space to buttons
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingTop: 12,
        width: '100%',
    },
    actionButton: {
        flex: 1,
        flexDirection: 'column', // Vertical layout: Icon on top, Text below
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderRadius: 12,
        gap: 4,
        minHeight: 60, // Ensure good touch target size
    },
    restoreButton: {
        backgroundColor: '#3498db',
    },
    likeButton: {
        backgroundColor: '#2ecc71',
    },
    actionText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    loader: { marginTop: 50 },
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

export default SkippedScreen;
