import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, ActivityIndicator, Image, TouchableOpacity, Dimensions, Alert, SafeAreaView, ScrollView, Modal, Animated, PanResponder } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMembers, getXProfileGroups, getMember, toggleLike, getLikedUsers, getLikesMeUsers, getMatches } from '../api/members';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@react-navigation/native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';

const TABS = [
    { id: 'search', label: 'Wyszukaj' },
    { id: 'liked', label: 'Polubieni' },
    { id: 'likesMe', label: 'Lubią Mnie' },
    { id: 'matches', label: 'Matche' },
];

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;
const IMAGE_HEIGHT = CARD_WIDTH * 1.2;

const FILTER_OPTIONS = [
    { id: 'interests', name: 'Zainteresowania', icon: '👥' },
    { id: 'looking-for', name: 'Czego szukasz', icon: '💑' },
    { id: 'languages', name: 'Języki', icon: '🌐' },
    { id: 'zodiac', name: 'Znak zodiaku', icon: '♈' },
    { id: 'education', name: 'Wykształcenie', icon: '🎓' },
    { id: 'family-plans', name: 'Plany rodzinne', icon: '👶' },
    { id: 'communication', name: 'Styl komunikacji', icon: '💬' },
    { id: 'love-style', name: 'Styl miłości', icon: '❤️' },
    { id: 'pets', name: 'Zwierzęta', icon: '🐾' },
    { id: 'drinking', name: 'Alkohol', icon: '🍷' },
    { id: 'smoking', name: 'Palenie', icon: '🚬' },
    { id: 'workout', name: 'Trening', icon: '💪' },
    { id: 'social-media', name: 'Social media', icon: '📱' },
];

const FILTER_VALUES = {
    faith: ['Wierzący', 'Niewierzący'],
    politics: ['Konserwatywne', 'Liberalne', 'Centrowe', 'Apolityczny'],
    work: ['Stabilna', 'Przedsiębiorca', 'Freelancerka', 'Korpo', 'Start-up', 'Artysta (praca kreatywna)', 'Twórca Internetowy', 'Właściciel', 'Naukowa'],
    diet: ['Vege', 'Mięso', 'Inna']
};

const MembersScreen = () => {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [zodiacCache, setZodiacCache] = useState({}); // Cache zodiac data by user ID
    const [currentUserAvatar, setCurrentUserAvatar] = useState(null);
    const [likedUsers, setLikedUsers] = useState({}); // Track liked users { userId: true/false }
    const [activeTab, setActiveTab] = useState('search'); // Tab navigation state
    const [hasMore, setHasMore] = useState(true); // Track if there are more results to load

    // Filter modal state
    const [showFiltersModal, setShowFiltersModal] = useState(false);
    const [ageRange, setAgeRange] = useState({ min: 18, max: 65 });
    const [hasBio, setHasBio] = useState(false);
    const [extendedFilters, setExtendedFilters] = useState({
        faith: '',
        politics: '',
        work: '',
        diet: ''
    });
    const [activeFilterId, setActiveFilterId] = useState(null); // For accordion
    const [filtersLoaded, setFiltersLoaded] = useState(false);

    // Load saved filters from AsyncStorage on component mount
    useEffect(() => {
        const loadFilters = async () => {
            try {
                const savedFilters = await AsyncStorage.getItem('pmFilters');
                if (savedFilters) {
                    const filters = JSON.parse(savedFilters);
                    if (filters.ageMin && filters.ageMax) {
                        setAgeRange({ min: parseInt(filters.ageMin), max: parseInt(filters.ageMax) });
                    }
                    if (typeof filters.hasBio !== 'undefined') {
                        setHasBio(filters.hasBio);
                    }
                    if (filters.faith || filters.politics || filters.work || filters.diet) {
                        setExtendedFilters({
                            faith: filters.faith || '',
                            politics: filters.politics || '',
                            work: filters.work || '',
                            diet: filters.diet || ''
                        });
                    }
                    console.log('Filters loaded from AsyncStorage:', filters);
                }
            } catch (error) {
                console.error('Error loading filters:', error);
            } finally {
                setFiltersLoaded(true);
            }
        };
        loadFilters();
    }, []);

    // Save filters to AsyncStorage
    const saveFilters = async () => {
        try {
            const filters = {
                ageMin: ageRange.min.toString(),
                ageMax: ageRange.max.toString(),
                hasBio: hasBio,
                ...extendedFilters
            };
            await AsyncStorage.setItem('pmFilters', JSON.stringify(filters));
            console.log('Filters saved to AsyncStorage:', filters);
        } catch (error) {
            console.error('Error saving filters:', error);
        }
    };

    // Slider state
    const sliderWidthRef = useRef(0);
    const minValRef = useRef(ageRange.min);
    const maxValRef = useRef(ageRange.max);

    useEffect(() => {
        minValRef.current = ageRange.min;
        maxValRef.current = ageRange.max;
    }, [ageRange]);

    const prMin = useRef(PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt, gestureState) => {
            gestureState.startValue = minValRef.current;
        },
        onPanResponderMove: (evt, gestureState) => {
            if (sliderWidthRef.current === 0) return;
            const diff = (gestureState.dx / sliderWidthRef.current) * 47;
            const newVal = Math.round(gestureState.startValue + diff);
            const clamped = Math.max(18, Math.min(newVal, maxValRef.current - 1));
            setAgeRange(prev => ({ ...prev, min: clamped }));
        }
    })).current;

    const prMax = useRef(PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt, gestureState) => {
            gestureState.startValue = maxValRef.current;
        },
        onPanResponderMove: (evt, gestureState) => {
            if (sliderWidthRef.current === 0) return;
            const diff = (gestureState.dx / sliderWidthRef.current) * 47;
            const newVal = Math.round(gestureState.startValue + diff);
            const clamped = Math.max(minValRef.current + 1, Math.min(newVal, 65));
            setAgeRange(prev => ({ ...prev, max: clamped }));
        }
    })).current;

    // Match animation state
    const [showMatchModal, setShowMatchModal] = useState(false);
    const [matchedUser, setMatchedUser] = useState(null);
    const matchScaleAnim = useRef(new Animated.Value(0)).current;
    const heartPulseAnim = useRef(new Animated.Value(1)).current;
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

                const avatarUrl = userData.hires_avatar?.large || userData.hires_avatar?.full || userData.avatar_urls?.full || userData.avatar_urls?.thumb;
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
            const data = await getMembers(pageNum, 20, searchQuery, ageRange.min, ageRange.max, extendedFilters.faith, extendedFilters.politics, extendedFilters.work, extendedFilters.diet);


            // Enrich members with zodiac data in background
            data.forEach(async (member) => {
                if (!member.zodiac && !zodiacCache[member.id]) {
                    const zodiac = await enrichMemberWithXProfile(member);
                    if (zodiac) {
                        setZodiacCache(prev => ({ ...prev, [member.id]: zodiac }));
                    }
                }
            });

            // Check if we got fewer results than requested (no more pages)
            if (data.length < 20) {
                setHasMore(false);
            } else {
                setHasMore(true);
            }

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

    // Fetch data based on active tab
    const fetchTabData = async (tabId, searchQuery = '') => {
        setLoading(true);
        try {
            let data = [];
            switch (tabId) {
                case 'search':
                    data = await getMembers(1, 20, searchQuery, ageRange.min, ageRange.max, extendedFilters.faith, extendedFilters.politics, extendedFilters.work, extendedFilters.diet);
                    break;
                case 'liked':
                    data = await getLikedUsers();
                    break;
                case 'likesMe':
                    data = await getLikesMeUsers();
                    break;
                case 'matches':
                    data = await getMatches();
                    break;
                default:
                    data = await getMembers(1, 20, searchQuery, ageRange.min, ageRange.max, extendedFilters.faith, extendedFilters.politics, extendedFilters.work, extendedFilters.diet);
            }
            setMembers(data || []);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', `Failed to load data: ${error.message}`);
            setMembers([]);
        } finally {
            setLoading(false);
        }
    };

    // Effect for tab changes
    useEffect(() => {
        setPage(1);
        setHasMore(true); // Reset hasMore when tab changes
        fetchTabData(activeTab, search);
    }, [activeTab]);

    // Effect for search changes (only when on search tab)
    useEffect(() => {
        if (activeTab === 'search') {
            setPage(1);
            setHasMore(true); // Reset hasMore when search changes
            fetchTabData(activeTab, search);
        }
    }, [search]);

    const handleLoadMore = () => {
        // Only allow pagination for 'search' tab
        if (activeTab !== 'search') return;
        if (loading) return;
        if (!hasMore) return; // Stop if no more results

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

    const handleLike = async (userId) => {
        try {
            // Optimistic update
            setLikedUsers(prev => ({ ...prev, [userId]: !prev[userId] }));

            // Call API
            const result = await toggleLike(userId);
            console.log('Like toggled:', result);

            // Update state based on API response
            if (result.status === 'liked') {
                setLikedUsers(prev => ({ ...prev, [userId]: true }));

                // Check if it's a match!
                if (result.is_match) {
                    console.log('🎉 It\'s a Match!');
                    const matchedMember = members.find(m => m.id === userId);
                    if (matchedMember) {
                        showMatchAnimation(matchedMember);
                    }
                }
            } else {
                setLikedUsers(prev => ({ ...prev, [userId]: false }));
            }
        } catch (error) {
            console.error('Failed to toggle like:', error);
            // Revert optimistic update on error
            setLikedUsers(prev => ({ ...prev, [userId]: !prev[userId] }));
            Alert.alert('Error', 'Failed to like user. Please try again.');
        }
    };

    // Show match animation
    const showMatchAnimation = (user) => {
        setMatchedUser(user);
        setShowMatchModal(true);

        // Reset animations
        matchScaleAnim.setValue(0);
        heartPulseAnim.setValue(1);

        // Start entrance animation
        Animated.spring(matchScaleAnim, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
        }).start();

        // Start heart pulse animation loop
        Animated.loop(
            Animated.sequence([
                Animated.timing(heartPulseAnim, {
                    toValue: 1.2,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(heartPulseAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Auto-close after 4 seconds
        setTimeout(() => {
            closeMatchModal();
        }, 4000);
    };

    const closeMatchModal = () => {
        Animated.timing(matchScaleAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            setShowMatchModal(false);
            setMatchedUser(null);
        });
    };

    const handleSendMessage = () => {
        closeMatchModal();
        if (matchedUser) {
            navigation.navigate('NewMessage', { recipientId: matchedUser.id, recipientName: matchedUser.name });
        }
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
        const zodiac = item.zodiac || zodiacCache[item.id] || getField(item, 303); // Prefer item.zodiac from API
        const age = item.age || calculateAge(getField(item, 107)); // Prefer item.age from API
        const zodiacIcon = getZodiacIcon(zodiac);

        // Get the best available image - prefer high-res from WordPress media library
        const imageUrl = item.hires_avatar?.large || item.hires_avatar?.full || item.avatar_urls?.full;

        // DEBUG
        // console.log('User:', item.name, 'Zodiac:', zodiac, 'Has xprofile:', !!item.xprofile);
        console.log('Image URL:', imageUrl, 'HiRes:', item.hires_avatar);

        return (
            <View style={styles.cardContainer}>
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

                    {/* Name and status overlay at bottom of image */}
                    <View style={styles.cardOverlay}>
                        <View style={styles.nameRow}>
                            <Text style={styles.cardName}>{item.name}{age ? `, ${age}` : ''}</Text>
                        </View>
                        {item.bio ? (
                            <Text style={styles.cardBio} numberOfLines={2} ellipsizeMode="tail">
                                {item.bio}
                            </Text>
                        ) : null}
                        <View style={styles.statusContainer}>
                            <View style={styles.statusDot} />
                            <Text style={styles.statusText}>Active today</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                <View style={styles.actionButtonsContainer}>
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#fff' }]}>
                        <MaterialCommunityIcons name="reload" size={24} color="#F5B041" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#fff' }]}>
                        <Ionicons name="close" size={30} color="#E74C3C" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: likedUsers[item.id] ? '#2ECC71' : '#fff' }]}
                        onPress={() => handleLike(item.id)}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={likedUsers[item.id] ? "heart" : "heart-outline"}
                            size={30}
                            color={likedUsers[item.id] ? '#fff' : '#2ECC71'}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#fff' }]}>
                        <Ionicons name="star" size={24} color="#3498DB" />
                    </TouchableOpacity>
                </View>
            </View >
        )
    };

    const handleResetFilters = async () => {
        const defaults = {
            min: 18,
            max: 65,
            hasBio: false,
            faith: '',
            politics: '',
            work: '',
            diet: ''
        };

        // Update State
        setAgeRange({ min: defaults.min, max: defaults.max });
        setHasBio(defaults.hasBio);
        setExtendedFilters({
            faith: defaults.faith,
            politics: defaults.politics,
            work: defaults.work,
            diet: defaults.diet
        });

        // Save empty filters
        try {
            const filters = {
                ageMin: defaults.min.toString(),
                ageMax: defaults.max.toString(),
                hasBio: defaults.hasBio,
                faith: defaults.faith,
                politics: defaults.politics,
                work: defaults.work,
                diet: defaults.diet
            };
            await AsyncStorage.setItem('pmFilters', JSON.stringify(filters));
        } catch (error) {
            console.error('Error clearing filters:', error);
        }

        // Close Modal
        setShowFiltersModal(false);

        // Refresh Grid with Defaults
        if (activeTab === 'search') {
            setLoading(true);
            try {
                const data = await getMembers(1, 20, search, defaults.min, defaults.max, defaults.faith, defaults.politics, defaults.work, defaults.diet);
                setMembers(data || []);
                setPage(1);
                setHasMore(true);
            } catch (error) {
                console.error("Error resetting grid:", error);
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.headerButton} onPress={() => setShowFiltersModal(true)}>
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

            {/* Tab Navigation Bar */}
            <View style={styles.tabBar}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabBarContent}
                >
                    {TABS.map((tab) => (
                        <TouchableOpacity
                            key={tab.id}
                            style={[
                                styles.tabItem,
                                activeTab === tab.id && styles.tabItemActive
                            ]}
                            onPress={() => setActiveTab(tab.id)}
                        >
                            <Text style={[
                                styles.tabLabel,
                                activeTab === tab.id && styles.tabLabelActive
                            ]}>
                                {tab.label}
                            </Text>
                            {activeTab === tab.id && <View style={styles.tabIndicator} />}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Empty state message */}
            {!loading && members.length === 0 && (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>
                        {activeTab === 'liked' && 'Nie polubiłeś jeszcze nikogo'}
                        {activeTab === 'likesMe' && 'Nikt Cię jeszcze nie polubił'}
                        {activeTab === 'matches' && 'Nie masz jeszcze żadnych dopasowań'}
                        {activeTab === 'search' && 'Brak wyników'}
                    </Text>
                </View>
            )}

            <FlatList
                data={members}
                renderItem={renderItem}
                keyExtractor={item => item.id.toString()}
                onEndReached={activeTab === 'search' ? handleLoadMore : null}
                onEndReachedThreshold={0.3}
                ListFooterComponent={loading ? <ActivityIndicator size="large" color="#FFFFFF" /> : null}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />

            {/* Match Animation Modal */}
            <Modal
                visible={showMatchModal}
                transparent={true}
                animationType="none"
                onRequestClose={closeMatchModal}
            >
                <TouchableOpacity
                    style={styles.matchModalOverlay}
                    activeOpacity={1}
                    onPress={closeMatchModal}
                >
                    <Animated.View
                        style={[
                            styles.matchModalContent,
                            {
                                transform: [{ scale: matchScaleAnim }],
                                opacity: matchScaleAnim,
                            }
                        ]}
                    >
                        {/* Avatar container */}
                        <View style={styles.matchAvatarsContainer}>
                            <Image
                                source={{ uri: currentUserAvatar || 'https://via.placeholder.com/120' }}
                                style={styles.matchAvatar}
                            />
                            <Animated.View
                                style={[
                                    styles.matchHeartContainer,
                                    { transform: [{ scale: heartPulseAnim }] }
                                ]}
                            >
                                <Ionicons name="heart" size={40} color="#FF6B9D" />
                            </Animated.View>
                            <Image
                                source={{ uri: matchedUser?.hires_avatar?.large || matchedUser?.hires_avatar?.full || matchedUser?.avatar_urls?.full || 'https://via.placeholder.com/120' }}
                                style={styles.matchAvatar}
                            />
                        </View>

                        {/* Match text */}
                        <Text style={styles.matchTitle}>🎉 Macie Match! 🎉</Text>
                        <Text style={styles.matchSubtitle}>
                            Ty i {matchedUser?.name || 'ta osoba'} wzajemnie się polubiliście!
                        </Text>

                        {/* Action buttons */}
                        <View style={styles.matchButtonsContainer}>
                            <TouchableOpacity
                                style={styles.matchPrimaryButton}
                                onPress={handleSendMessage}
                            >
                                <Ionicons name="chatbubble" size={20} color="#fff" />
                                <Text style={styles.matchPrimaryButtonText}>Wyślij wiadomość</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.matchSecondaryButton}
                                onPress={closeMatchModal}
                            >
                                <Text style={styles.matchSecondaryButtonText}>Kontynuuj przeglądanie</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </TouchableOpacity>
            </Modal>

            {/* Filters Modal */}
            <Modal
                visible={showFiltersModal}
                transparent={false}
                animationType="slide"
                onRequestClose={() => setShowFiltersModal(false)}
            >
                <View style={styles.filtersModalContainer}>
                    <View style={[styles.filtersHeader, { paddingTop: insets.top + 10 }]}>
                        <Text style={styles.filtersTitle}>Ustawienia wyszukiwania</Text>
                        <TouchableOpacity onPress={async () => {
                            await saveFilters();
                            setShowFiltersModal(false);
                            if (activeTab === 'search') {
                                setPage(1);
                                setHasMore(true);
                                fetchTabData('search', search);
                            }
                        }}>
                            <Text style={styles.filtersDoneButton}>Gotowe</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.filtersContent}>
                        {/* Age Range Section */}
                        <View style={styles.filterSection}>
                            <Text style={styles.filterSectionLabel}>ZAKRES WIEKOWY</Text>
                            <View
                                style={styles.ageSliderContainer}
                                onLayout={(e) => { sliderWidthRef.current = e.nativeEvent.layout.width; }}
                            >
                                <View style={styles.ageTrack}>
                                    <View style={[
                                        styles.ageRangeFill,
                                        {
                                            left: `${((ageRange.min - 18) / 47) * 100}%`,
                                            width: `${((ageRange.max - ageRange.min) / 47) * 100}%`
                                        }
                                    ]} />
                                </View>
                                <View style={styles.ageThumbsContainer} pointerEvents="box-none">
                                    {/* Min Thumb */}
                                    <View
                                        style={[
                                            styles.ageThumbTouchArea,
                                            { left: `${((ageRange.min - 18) / 47) * 100}%` }
                                        ]}
                                        {...prMin.panHandlers}
                                    >
                                        <View style={styles.ageThumb} />
                                    </View>
                                    {/* Max Thumb */}
                                    <View
                                        style={[
                                            styles.ageThumbTouchArea,
                                            { left: `${((ageRange.max - 18) / 47) * 100}%` }
                                        ]}
                                        {...prMax.panHandlers}
                                    >
                                        <View style={styles.ageThumb} />
                                    </View>
                                </View>
                            </View>
                            <View style={styles.ageLabels}>
                                <Text style={styles.ageLabel}>{ageRange.min} lat</Text>
                                <Text style={styles.ageLabel}>{ageRange.max >= 65 ? '65+' : ageRange.max + ' lat'}</Text>
                            </View>
                        </View>

                        {/* Has Bio Toggle */}
                        <TouchableOpacity
                            style={styles.filterToggleRow}
                            onPress={() => setHasBio(!hasBio)}
                        >
                            <Text style={styles.filterOptionName}>Ma bio</Text>
                            <View style={[styles.toggleTrack, hasBio && styles.toggleTrackActive]}>
                                <View style={[styles.toggleThumb, hasBio && styles.toggleThumbActive]} />
                            </View>
                        </TouchableOpacity>

                        {/* Filter Options List */}
                        {/* Custom Filters: Faith, Politics, Work, Diet */}
                        {[
                            { id: 'faith', name: 'Religia', icon: '🛐', options: FILTER_VALUES.faith },
                            { id: 'politics', name: 'Poglądy', icon: '⚖️', options: FILTER_VALUES.politics },
                            { id: 'work', name: 'Praca', icon: '💼', options: FILTER_VALUES.work },
                            { id: 'diet', name: 'Dieta', icon: '🥗', options: FILTER_VALUES.diet },
                        ].map((filter) => (
                            <View key={filter.id}>
                                <TouchableOpacity
                                    style={styles.filterRow}
                                    onPress={() => setActiveFilterId(activeFilterId === filter.id ? null : filter.id)}
                                >
                                    <Text style={styles.filterIcon}>{filter.icon}</Text>
                                    <Text style={styles.filterOptionName}>{filter.name}</Text>
                                    <Text style={[styles.filterValue, extendedFilters[filter.id] ? { color: '#e91e63' } : {}]}>
                                        {extendedFilters[filter.id] || 'Wybierz ›'}
                                    </Text>
                                </TouchableOpacity>

                                {activeFilterId === filter.id && (
                                    <View style={{ backgroundColor: '#333', paddingVertical: 10, paddingHorizontal: 20 }}>
                                        <TouchableOpacity
                                            style={{ paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#444' }}
                                            onPress={() => {
                                                setExtendedFilters({ ...extendedFilters, [filter.id]: '' });
                                                setActiveFilterId(null);
                                            }}
                                        >
                                            <Text style={{ color: '#aaa' }}>Wszystkie</Text>
                                        </TouchableOpacity>
                                        {filter.options.map(opt => (
                                            <TouchableOpacity
                                                key={opt}
                                                style={{ paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#444' }}
                                                onPress={() => {
                                                    setExtendedFilters({ ...extendedFilters, [filter.id]: opt });
                                                    setActiveFilterId(null);
                                                }}
                                            >
                                                <Text style={{ color: extendedFilters[filter.id] === opt ? '#e91e63' : '#fff', fontWeight: extendedFilters[filter.id] === opt ? 'bold' : 'normal' }}>{opt}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                        ))}

                        {FILTER_OPTIONS.map((filter) => (
                            <TouchableOpacity key={filter.id} style={styles.filterRow}>
                                <Text style={styles.filterIcon}>{filter.icon}</Text>
                                <Text style={styles.filterOptionName}>{filter.name}</Text>
                                <Text style={styles.filterValue}>Wybierz ›</Text>
                            </TouchableOpacity>
                        ))}

                        {/* Reset Filters Button */}
                        <TouchableOpacity
                            style={{
                                marginTop: 30,
                                marginBottom: 50,
                                marginHorizontal: 20,
                                backgroundColor: 'transparent',
                                borderWidth: 1,
                                borderColor: '#E74C3C',
                                paddingVertical: 12,
                                borderRadius: 25,
                                alignItems: 'center',
                            }}
                            onPress={handleResetFilters}
                        >
                            <Text style={{ color: '#E74C3C', fontWeight: '600', fontSize: 16 }}>Zresetuj wszystkie filtry</Text>
                        </TouchableOpacity>

                    </ScrollView>
                </View>
            </Modal>
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
        borderRadius: 30,
        overflow: 'hidden',
    },
    cardOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingVertical: 20,
        paddingBottom: 50,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
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
    // Tab Bar Styles
    tabBar: {
        backgroundColor: '#2C2C2E',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#3A3A3C',
    },
    tabBarContent: {
        paddingHorizontal: 15,
        flexDirection: 'row',
        alignItems: 'center',
    },
    tabItem: {
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginRight: 4,
        position: 'relative',
    },
    tabItemActive: {},
    tabLabel: {
        fontSize: 15,
        fontWeight: '500',
        color: '#8E8E93',
    },
    tabLabelActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    tabIndicator: {
        position: 'absolute',
        bottom: 0,
        left: 16,
        right: 16,
        height: 3,
        backgroundColor: '#FF6B9D',
        borderRadius: 2,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyStateText: {
        color: '#8E8E93',
        fontSize: 16,
        textAlign: 'center',
    },
    // Match Modal Styles
    matchModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(139, 69, 139, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    matchModalContent: {
        alignItems: 'center',
        padding: 30,
    },
    matchAvatarsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
    },
    matchAvatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        borderColor: '#fff',
    },
    matchHeartContainer: {
        marginHorizontal: 15,
        backgroundColor: '#fff',
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    matchTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 10,
        textAlign: 'center',
    },
    matchSubtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        marginBottom: 40,
    },
    matchButtonsContainer: {
        width: '100%',
        alignItems: 'center',
    },
    matchPrimaryButton: {
        flexDirection: 'row',
        backgroundColor: '#FF6B9D',
        paddingVertical: 15,
        paddingHorizontal: 40,
        borderRadius: 30,
        alignItems: 'center',
        marginBottom: 15,
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 5,
    },
    matchPrimaryButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 10,
    },
    matchSecondaryButton: {
        paddingVertical: 12,
        paddingHorizontal: 30,
    },
    matchSecondaryButtonText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 16,
        fontWeight: '500',
    },
    // Filter Modal Styles
    filtersModalContainer: {
        flex: 1,
        backgroundColor: '#0d0d1a',
    },
    filtersHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    filtersTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    filtersDoneButton: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2ECC71',
    },
    filtersContent: {
        flex: 1,
        paddingHorizontal: 20,
    },
    filterSection: {
        paddingVertical: 24,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    filterSectionLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        letterSpacing: 1,
        marginBottom: 20,
    },
    ageSliderContainer: {
        height: 40,
        justifyContent: 'center',
        marginBottom: 10,
    },
    ageTrack: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
    },
    ageRangeFill: {
        position: 'absolute',
        height: 4,
        backgroundColor: '#2ECC71',
        borderRadius: 2,
    },
    ageThumbsContainer: {
        position: 'absolute',
        width: '100%',
        height: 40,
    },
    ageThumb: {
        width: 24,
        height: 24,
        backgroundColor: '#2ECC71',
        borderRadius: 12,
        borderWidth: 3,
        borderColor: '#fff',
    },
    ageThumbTouchArea: {
        position: 'absolute',
        width: 44,
        height: 44,
        marginLeft: -22,
        top: -2,
        justifyContent: 'center',
        alignItems: 'center',
        // backgroundColor: 'rgba(255,0,0,0.2)', // Uncomment for debugging
    },
    ageLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 5,
    },
    ageLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    ageButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 15,
    },
    ageButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 8,
    },
    ageButtonText: {
        color: '#fff',
        fontSize: 13,
    },
    filterToggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    toggleTrack: {
        width: 52,
        height: 32,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 16,
        justifyContent: 'center',
        padding: 3,
    },
    toggleTrackActive: {
        backgroundColor: '#2ECC71',
    },
    toggleThumb: {
        width: 26,
        height: 26,
        backgroundColor: '#fff',
        borderRadius: 13,
    },
    toggleThumbActive: {
        alignSelf: 'flex-end',
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    filterIcon: {
        fontSize: 20,
        marginRight: 14,
        width: 28,
        textAlign: 'center',
    },
    filterOptionName: {
        flex: 1,
        color: '#fff',
        fontSize: 15,
    },
    filterValue: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
    },
    cardBio: {
        fontSize: 13,
        color: '#E0E0E0',
        marginBottom: 6,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 4,
    },
});

export default MembersScreen;
