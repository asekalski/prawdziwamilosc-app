import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { getMatches } from '../api/members';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MatchesScreen = () => {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(false);
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    const fetchMatches = async () => {
        setLoading(true);
        try {
            // Fetch actual mutual matches from custom endpoint
            const data = await getMatches();
            setMatches(data);
        } catch (error) {
            console.error('Error fetching matches:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMatches();
    }, []);

    const renderItem = ({ item }) => {
        // Use high-res avatar from API
        const imageUrl = item.hires_avatar?.large || item.hires_avatar?.full || item.avatar_urls?.full;

        return (
            <TouchableOpacity
                style={styles.matchCard}
                onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
                activeOpacity={0.7}
            >
                <Image source={{ uri: imageUrl }} style={styles.avatar} />
                <View style={styles.info}>
                    <Text style={styles.name}>{item.name}</Text>
                    <View style={styles.statusRow}>
                        <View style={styles.statusDot} />
                        <Text style={styles.statusText}>New Match!</Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={styles.chatButton}
                    onPress={(e) => {
                        e.stopPropagation();
                        navigation.navigate('NewMessage', {
                            recipientId: item.id,
                            recipientName: item.name
                        });
                    }}
                >
                    <Ionicons name="chatbubble" size={20} color="#2ECC71" />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Matches</Text>
                <Text style={styles.headerSubtitle}>
                    {matches.length} {matches.length === 1 ? 'match' : 'matches'}
                </Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#2ECC71" style={styles.loader} />
            ) : matches.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="heart-outline" size={64} color="#ccc" />
                    <Text style={styles.emptyText}>No matches yet</Text>
                    <Text style={styles.emptySubtext}>Keep swiping to find your match!</Text>
                </View>
            ) : (
                <FlatList
                    data={matches}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
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
        marginBottom: 5,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#CCCCCC',
        fontWeight: '500',
    },
    listContent: { padding: 15 },
    matchCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 15,
        marginBottom: 12,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginRight: 15,
        borderWidth: 2,
        borderColor: '#2ECC71',
    },
    info: { flex: 1 },
    name: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 5,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#2ECC71',
        marginRight: 5,
    },
    statusText: {
        fontSize: 13,
        color: '#2ECC71',
        fontWeight: '600',
    },
    chatButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#E8F8F0',
        justifyContent: 'center',
        alignItems: 'center',
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

export default MatchesScreen;
