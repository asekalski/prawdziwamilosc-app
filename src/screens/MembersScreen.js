import React, { useState, useEffect, useContext } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, ActivityIndicator, Image, TouchableOpacity, Dimensions, Alert, SafeAreaView } from 'react-native';
import { getMembers, getXProfileGroups, getMember } from '../api/members';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@react-navigation/native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;
const IMAGE_HEIGHT = CARD_WIDTH * 1.2;

const MembersScreen = () => {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [zodiacCache, setZodiacCache] = useState({}); // Cache zodiac data by user ID
    const [currentUserAvatar, setCurrentUserAvatar] = useState(null);
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { userInfo } = useContext(AuthContext);

    // Fetch current user avatar
    useEffect(() => {
        const fetchCurrentUser = async () => {
            try {
                console.log('Fetching current user data...');
                console.log('UserInfo:', userInfo);

                // BuddyPress supports 'me' as user ID for current logged-in user
                const userData = await getMember('me');
                console.log('Current user data:', userData);

                const avatarUrl = userData.avatar_urls?.full || userData.avatar_urls?.thumb;
                console.log('Avatar URL:', avatarUrl);

                setCurrentUserAvatar(avatarUrl);
            } catch (error) {
                console.log('Failed to fetch current user data:', error.message);
                console.log('Error details:', error);
            }
        };

        // Only fetch if user is logged in
        if (userInfo) {
            fetchCurrentUser();
        }
    }, [userInfo]);

    const enrichMemberWithXProfile = async (member) => {
        try {
            const xprofileGroups = await getXProfileGroups(member.id);
            // Extract zodiac from xprofile
            for (const group of xprofileGroups) {
                if (group.fields && Array.isArray(group.fields)) {
                    for (const field of group.fields) {
                        if (field.id == 303) {
                            const zodiacValue = field.value?.raw || field.value?.rendered || field.data?.value?.raw || field.data?.value?.rendered;
                            return zodiacValue;
                        }
                    }
                }
            }
        } catch (error) {
            console.log('Failed to fetch xprofile for user', member.id);
        }
        return null;
    };

    const fetchMembers = async (pageNum = 1, searchQuery = '') => {
        if (loading && pageNum > 1) return;
        setLoading(true);
        try {
            const data = await getMembers(pageNum, 20, searchQuery);

            // Enrich members with zodiac data in background
            data.forEach(async (member) => {
                if (!zodiacCache[member.id]) {
                    const zodiac = await enrichMemberWithXProfile(member);
                    if (zodiac) {
                        setZodiacCache(prev => ({ ...prev, [member.id]: zodiac }));
                    }
                }
            });

            if (pageNum === 1) {
                setMembers(data);
            } else {
                setMembers(prev => [...prev, ...data]);
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', `Failed to load members: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setPage(1);
        fetchMembers(1, search);
    }, [search]);

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchMembers(nextPage, search);
    };

    const getField = (member, fieldId) => {
        if (!member.xprofile || !member.xprofile.groups) return null;
        for (const group of member.xprofile.groups) {
            if (!group.fields || !Array.isArray(group.fields)) continue;
            for (const field of group.fields) {
                if (field.id == fieldId) {
                    return field.value.raw || field.value.rendered;
                }
            }
        }
        return null;
    };

    const calculateAge = (dateString) => {
        if (!dateString) return null;
        const birthDate = new Date(dateString);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const getZodiacIcon = (zodiacName) => {
        if (!zodiacName) return null;

        const zodiacMap = {
            'Baran': '♈',
            'Byk': '♉',
            'Bliźnięta': '♊',
            'Rak': '♋',
            'Lew': '♌',
            'Panna': '♍',
            'Waga': '♎',
            'Skorpion': '♏',
            'Strzelec': '♐',
            'Koziorożec': '♑',
            'Wodnik': '♒',
            'Ryby': '♓',
        };

        return zodiacMap[zodiacName] || '⭐';
    };

    const renderItem = ({ item }) => {
        const zodiac = zodiacCache[item.id] || getField(item, 303); // Try cache first, fallback to item data
        const birthDate = getField(item, 107); // Data urodzenia
        const age = calculateAge(birthDate);
        const zodiacIcon = getZodiacIcon(zodiac);

        // Get the best available image - prefer high-res from WordPress media library
        const imageUrl = item.hires_avatar?.large || item.hires_avatar?.full || item.avatar_urls?.full;

        // DEBUG
        console.log('User:', item.name, 'Zodiac:', zodiac, 'Has xprofile:', !!item.xprofile);
        console.log('Image URL:', imageUrl, 'HiRes:', item.hires_avatar);

        return (
            <View style={styles.cardContainer}>
                <View style={styles.cardHeader}>
                    <View style={styles.nameRow}>
                        <Text style={styles.cardName}>{item.name}{age ? `, ${age}` : ''}</Text>
                    </View>
                    <View style={styles.statusContainer}>
                        <View style={styles.statusDot} />
                        <Text style={styles.statusText}>Active today</Text>
                    </View>
                </View>

                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
                    style={styles.imageContainer}
                >
                    <Image source={{ uri: imageUrl }} style={styles.cardImage} resizeMode="cover" />

                    {zodiac && (
                        <View style={styles.zodiacBadge}>
                            <Text style={styles.zodiacIcon}>{zodiacIcon}</Text>
                            <Text style={styles.zodiacName}>{zodiac}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <View style={styles.actionButtonsContainer}>
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#fff' }]}>
                        <MaterialCommunityIcons name="reload" size={24} color="#F5B041" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#fff' }]}>
                        <Ionicons name="close" size={30} color="#E74C3C" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#fff' }]}>
                        <Ionicons name="heart" size={30} color="#2ECC71" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#fff' }]}>
                        <Ionicons name="star" size={24} color="#3498DB" />
                    </TouchableOpacity>
                </View>
            </View >
        )
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.headerButton}>
                    <Ionicons name="options-outline" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <TouchableOpacity style={styles.headerButton}>
                    <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
                    <View style={styles.notificationDot} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { userId: 'me' })}>
                    <Image
                        source={{ uri: currentUserAvatar || 'https://via.placeholder.com/40' }}
                        style={styles.headerAvatar}
                    />
                </TouchableOpacity>
            </View>

            <FlatList
                data={members}
                renderItem={renderItem}
                keyExtractor={item => item.id.toString()}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={loading ? <ActivityIndicator size="large" color="#FFFFFF" /> : null}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#2C2C2E' }, // Dark charcoal background
    header: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 10, alignItems: 'center' },
    headerButton: { padding: 10, backgroundColor: '#3A3A3C', borderRadius: 15, marginRight: 10 }, // Darker grey for buttons
    headerAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#fff' },
    notificationDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4757', borderWidth: 1, borderColor: '#3A3A3C' },
    listContent: { paddingBottom: 100 },
    cardContainer: {
        width: CARD_WIDTH,
        alignSelf: 'center',
        marginBottom: 30,
    },
    cardHeader: { marginBottom: 10 },
    nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
    cardName: {
        fontFamily: 'serif',
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFFFFF', // White text for dark background
        flex: 1,
    },
    imageContainer: {
        position: 'relative',
    },
    zodiacBadge: {
        position: 'absolute',
        top: 15,
        left: 15,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 10,
    },
    zodiacIcon: {
        fontSize: 18,
        marginRight: 5,
    },
    zodiacName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#000',
    },
    statusContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2ECC71', marginRight: 5 },
    statusText: { color: '#2ECC71', fontWeight: '600' },
    cardImage: {
        width: '100%',
        height: IMAGE_HEIGHT,
        borderRadius: 30,
        backgroundColor: '#ddd',
    },
    zodiacTag: {
        position: 'absolute',
        top: 80, // Adjust based on layout
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    zodiacText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    actionButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        marginTop: -30, // Overlap the image slightly or just below
        paddingHorizontal: 20,
    },
    actionButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 5,
    },
});

export default MembersScreen;
