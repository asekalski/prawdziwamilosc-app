import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, ActivityIndicator, Image, TouchableOpacity, Dimensions, Alert, SafeAreaView, ScrollView, Modal, Animated, PanResponder, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMembers, getXProfileGroups, getMember, toggleLike, getLikedUsers, getLikesMeUsers, getMatches } from '../api/members';
import { addSkippedUser, getSkippedUsers, removeSkippedUser, getSkippedUserIds, syncSkippedWithServer } from '../api/skipped';
import { getSuperMessageStatus } from '../api/superMessages';
import { useNavigation, useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { useTheme } from '@react-navigation/native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import SuperMessageModal from '../components/SuperMessageModal';
import HeartLoader from '../components/HeartLoader';
import { getMe } from '../api/members';

// Helpers
const stripHtml = (str) => {
    if (!str) return '';
    return String(str).replace(/<[^>]*>?/gm, '');
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

const mapUserProfile = (user) => {
    if (!user.xprofile || !user.xprofile.groups) return user;

    const fieldMap = {};
    const fieldIdMap = {};

    for (const group of user.xprofile.groups) {
        let fieldsArray = [];
        if (Array.isArray(group.fields)) {
            fieldsArray = group.fields;
        } else if (group.fields && typeof group.fields === 'object') {
            fieldsArray = Object.values(group.fields);
        }

        for (const field of fieldsArray) {
            let val = null;
            if (field.value && typeof field.value === 'object') {
                val = field.value.rendered || field.value.raw;
            } else {
                val = field.value;
            }
            if (val && typeof val === 'object') {
                if (val.date) val = val.date;
                else try { val = JSON.stringify(val); } catch (e) { val = String(val); }
            }

            if (field.name) {
                fieldMap[field.name.toLowerCase()] = val;
            }
            if (field.id) {
                fieldIdMap[field.id] = val;
            }
        }
    }

    const getVal = (id, ...names) => {
        if (fieldIdMap[id]) return fieldIdMap[id];
        for (const name of names) {
            const lowerName = name.toLowerCase();
            if (fieldMap[lowerName]) return fieldMap[lowerName];
            const foundKey = Object.keys(fieldMap).find(k => k.startsWith(lowerName));
            if (foundKey) return fieldMap[foundKey];
        }
        return null;
    };

    const cleanBio = stripHtml(getVal(367) || user.bio || getVal('o mnie', 'opis'));

    return {
        ...user,
        bio: cleanBio,
        faith: stripHtml(getVal(346, 'podejście do wiary', 'wyznanie')),
        politics: stripHtml(getVal(351, 'poglądy polityczne')),
        work: stripHtml(getVal(356, 'styl pracy', 'praca')),
        diet: stripHtml(getVal(362, 'styl jedzenia', 'dieta')),
        zodiac_sign: stripHtml(getVal(303, 'znak zodiaku', 'zodiak')),
        age: user.hide_age ? null : (user.age || calculateAge(getVal(107, 'data urodzenia', 'wiek', 'birthdate'))),
        gender: getVal(129, 'płeć', 'gender')
    };
};

const TABS = [
    { id: 'search', label: 'Wyszukaj' },
    { id: 'liked', label: 'Polubieni' },
    { id: 'likesMe', label: 'Lubią Mnie' },
    { id: 'matches', label: 'Matche' },
    { id: 'skipped', label: 'Usunięci' },
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
    faith: ['Wierzący', 'Ateista', 'Duchowy', 'Inne'],
    politics: ['Konserwatywne', 'Liberalne', 'Centrowe', 'Apolityczny'],
    work: ['Korporacja', 'Własny Biznes', 'Normalna Praca', 'Praca Kreatywna', 'Nie pracuję'],
    diet: ['Wszystkożerca', 'Wegetarianin', 'Weganin', 'Keto/Inne']
};

const MembersScreen = ({ route }) => {
    const { userInfo } = useContext(AuthContext);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [zodiacCache, setZodiacCache] = useState({}); // Cache zodiac data by user ID
    const [currentUserAvatar, setCurrentUserAvatar] = useState(null);
    const [likedUsers, setLikedUsers] = useState({}); // Track liked users { userId: true/false }
    const [activeTab, setActiveTab] = useState(route?.params?.initialTab || 'search'); // Tab navigation state
    const [hasMore, setHasMore] = useState(true); // Track if there are more results to load
    const [refreshing, setRefreshing] = useState(false);

    const [showOnboardingBubble, setShowOnboardingBubble] = useState(false);
    const [bubbleAnim] = useState(new Animated.Value(0));

    useEffect(() => {
        const checkBubble = async () => {
            const shown = await AsyncStorage.getItem('allowChatBubbleShown');
            if (!shown && userInfo?.gender === 'Kobieta') {
                setShowOnboardingBubble(true);
                Animated.spring(bubbleAnim, {
                    toValue: 1,
                    useNativeDriver: true,
                    tension: 50,
                    friction: 7
                }).start();
            }
        };
        checkBubble();
    }, [userInfo]);

    const handleCloseBubble = async () => {
        await AsyncStorage.setItem('allowChatBubbleShown', 'true');
        Animated.timing(bubbleAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true
        }).start(() => setShowOnboardingBubble(false));
    };

    const handleAllowChat = async (targetUser) => {
        try {
            const { sendMessage } = require('../api/messages');
            await sendMessage(targetUser.id, 'Prawdziwa Miłość', 'Użytkowniczka pozwala Ci ze sobą porozmawiać.');
            Alert.alert('Sukces', `Pozwoliłaś użytkownikowi ${targetUser.name} na rozmowę.`);
            if (showOnboardingBubble) {
                handleCloseBubble();
            }
        } catch (error) {
            console.log('Error allowing chat:', error);
            Alert.alert('Błąd', 'Nie udało się wysłać powiadomienia.');
        }
    };

    // Update active tab when params change or screen is focused
    useFocusEffect(
        React.useCallback(() => {
            if (route?.params?.initialTab) {
                setActiveTab(route.params.initialTab);
            }

            // Fetch unread notification count
            const fetchUnreadCount = async () => {
                try {
                    const data = await getMe();
                    if (data && typeof data.unread_notifications_count !== 'undefined') {
                        setUnreadNotifications(data.unread_notifications_count);
                    }
                } catch (error) {
                    console.log('Error fetching unread count:', error);
                }
            };
            fetchUnreadCount();
        }, [route?.params?.initialTab])
    );

    // Filter modal state
    const [showFiltersModal, setShowFiltersModal] = useState(false);
    const [ageRange, setAgeRange] = useState({ min: 18, max: 65 });
    const [hasBio, setHasBio] = useState(false);
    const [showNumerology, setShowNumerology] = useState(false);
    const [extendedFilters, setExtendedFilters] = useState({
        faith: '',
        politics: '',
        work: '',
        diet: ''
    });
    const [activeFilterId, setActiveFilterId] = useState(null); // For accordion
    const [filtersLoaded, setFiltersLoaded] = useState(false);

    // Super Message modal state
    const [showSuperMessageModal, setShowSuperMessageModal] = useState(false);
    const [superMessageRecipient, setSuperMessageRecipient] = useState(null);
    const [isPremium, setIsPremium] = useState(false);
    const [unreadNotifications, setUnreadNotifications] = useState(0);

    // Card swipe animations - store animation values per card
    const cardAnimations = useRef({}).current;

    // Check premium status on mount
    useEffect(() => {
        const checkPremiumStatus = async () => {
            try {
                const status = await getSuperMessageStatus();
                setIsPremium(status?.is_premium ?? false);

                // Initial count fetch
                const me = await getMe();
                if (me && typeof me.unread_notifications_count !== 'undefined') {
                    setUnreadNotifications(me.unread_notifications_count);
                }
            } catch (error) {
                console.log('Could not check premium status or unread count');
            }
        };
        checkPremiumStatus();
    }, []);

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
                    if (typeof filters.showNumerology !== 'undefined') {
                        setShowNumerology(filters.showNumerology);
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
                showNumerology: showNumerology,
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
    const listRef = useRef(null);
    useScrollToTop(listRef);

    const insets = useSafeAreaInsets();

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
            let data = await getMembers(pageNum, 20, searchQuery, ageRange.min, ageRange.max, extendedFilters.faith, extendedFilters.politics, extendedFilters.work, extendedFilters.diet);

            // Filter out already liked users from search results
            const likedData = await getLikedUsers();
            const likedIds = new Set((likedData || []).map(u => String(u.id)));

            // Filter out skipped users
            const skippedIds = (await getSkippedUserIds()).map(id => String(id));

            data = (data || []).filter(member => {
                const mid = String(member.id);
                return !likedIds.has(mid) && !skippedIds.includes(mid);
            });

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

    const handleRefresh = async () => {
        setRefreshing(true);
        setPage(1);
        setHasMore(true);
        await fetchTabData(activeTab, search);
        setRefreshing(false);
    };

    const fetchTabData = async (tabId, searchQuery = '') => {
        // Clear members immediately to prevent flash of old data
        setMembers([]);
        setLoading(true);
        try {
            let data = [];

            // Helper for fetching full profile details
            // Backend endpoints now return full xprofile data, so we just map the data directly
            const fetchFullDetails = async (users) => {
                if (!users || users.length === 0) return [];
                // No need for additional getMember calls - backend now provides all data
                return users.map(mapUserProfile);
            };

            switch (tabId) {
                case 'search':
                    data = await getMembers(1, 20, searchQuery, ageRange.min, ageRange.max, extendedFilters.faith, extendedFilters.politics, extendedFilters.work, extendedFilters.diet);
                    // Filter out already liked users from search results
                    const likedData = await getLikedUsers();
                    const likedIds = new Set((likedData || []).map(u => String(u.id)));

                    // Filter out skipped users
                    const skippedIds = (await getSkippedUserIds()).map(id => String(id));

                    data = (data || []).filter(member => {
                        const mid = String(member.id);
                        return !likedIds.has(mid) && !skippedIds.includes(mid);
                    });
                    break;
                case 'liked':
                    // Backend now returns full xprofile data, no need for additional getMember calls
                    const simpleLiked = await getLikedUsers();
                    data = simpleLiked && simpleLiked.length > 0 ? simpleLiked.map(mapUserProfile) : [];
                    break;
                case 'likesMe':
                    {
                        const raw = await getLikesMeUsers();
                        const skippedIds = (await getSkippedUserIds()).map(id => String(id));
                        data = await fetchFullDetails((raw || []).filter(u => !skippedIds.includes(String(u.id))));
                    }
                    break;
                case 'matches':
                    {
                        const raw = await getMatches();
                        const skippedIds = (await getSkippedUserIds()).map(id => String(id));
                        data = await fetchFullDetails((raw || []).filter(u => !skippedIds.includes(String(u.id))));
                    }
                    break;
                case 'skipped':
                    await syncSkippedWithServer();
                    data = await fetchFullDetails(await getSkippedUsers());
                    break;
                default:
                    data = await getMembers(1, 20, searchQuery, ageRange.min, ageRange.max, extendedFilters.faith, extendedFilters.politics, extendedFilters.work, extendedFilters.diet);
            }
            // Sanitize data to prevent object rendering errors (React child)
            if (data && data.length > 0) {
                data = data.map(u => {
                    const clean = { ...u };
                    const sanitize = (val) => {
                        if (val && typeof val === 'object') {
                            return val.date || val.rendered || JSON.stringify(val);
                        }
                        return val;
                    };

                    if (typeof clean.last_activity === 'object') clean.last_activity = sanitize(clean.last_activity);
                    // Check other potential object fields
                    if (typeof clean.age === 'object') clean.age = sanitize(clean.age);
                    if (typeof clean.bio === 'object') clean.bio = sanitize(clean.bio);

                    return clean;
                });
            }

            setMembers(data || []);

            // Enrich members with data in background for all tabs (only if needed)
            if (data && data.length > 0) {
                // If we fetched full members (liked tab), we might already have xprofile
                data.forEach(async (member) => {
                    // Skip if we already have detailed xprofile data from getMember
                    if (member.xprofile && member.xprofile.groups) return;

                    if (!member.zodiac && !zodiacCache[member.id]) {
                        const zodiac = await enrichMemberWithXProfile(member);
                        if (zodiac) {
                            setZodiacCache(prev => ({ ...prev, [member.id]: zodiac }));
                        }
                    }
                });
            }
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
        // Ensure user is not in skipped list (fixes bug where liked users appear in skipped)
        removeSkippedUser(userId);

        // Get or create animation values for this card
        if (!cardAnimations[userId]) {
            cardAnimations[userId] = {
                translateX: new Animated.Value(0),
                opacity: new Animated.Value(1)
            };
        }
        const anim = cardAnimations[userId];

        // Store the member for match animation before we start
        const memberBeforeAnimation = members.find(m => m.id === userId);

        try {
            // Optimistic update for UI feedback
            setLikedUsers(prev => ({ ...prev, [userId]: true }));

            // Start swipe right animation
            Animated.parallel([
                Animated.timing(anim.translateX, {
                    toValue: width + 100,
                    duration: 300,
                    useNativeDriver: true
                }),
                Animated.timing(anim.opacity, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true
                })
            ]).start(() => {
                // OPTIMISTIC REMOVAL: Remove from UI immediately after animation completes (300ms)
                // Do not wait for API response to remove the gap
                setMembers(prev => prev.filter(m => m.id !== userId));
                delete cardAnimations[userId];
            });

            // Call API in parallel
            try {
                const result = await toggleLike(userId);
                console.log('Like toggled:', result);

                // Check match asynchronously
                if (result.status === 'liked' && result.is_match) {
                    console.log('🎉 It\'s a Match!');
                    if (memberBeforeAnimation) {
                        showMatchAnimation(memberBeforeAnimation);
                    }
                }
            } catch (apiError) {
                console.error('API Error in background:', apiError);
                // Optionally restore card if API failed, but usually better to just ignore or toast error
                // For now, keeping smooth UX is priority.
            }
        } catch (error) {
            console.error('Failed to init like:', error);
            anim.translateX.setValue(0);
            anim.opacity.setValue(1);
            setLikedUsers(prev => ({ ...prev, [userId]: false }));
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

    const handleSkip = async (userId) => {
        try {
            await addSkippedUser(userId);
            // Remove user from the list
            setMembers(prev => prev.filter(m => m.id !== userId));
        } catch (error) {
            console.error('Failed to skip user:', error);
        }
    };

    const handleRestore = async (userId) => {
        try {
            await removeSkippedUser(userId);
            setMembers(prev => prev.filter(m => m.id !== userId));
            Alert.alert('Sukces', 'Użytkownik przywrócony.');
        } catch (error) {
            console.error('Failed to restore user:', error);
        }
    };

    // Handle unlike (remove from liked list)
    const handleUnlike = async (userId) => {
        try {
            // Call API to toggle like (will unlike since already liked)
            const result = await toggleLike(userId);
            console.log('Unlike toggled:', result);

            if (result.status === 'unliked') {
                // Remove from liked list
                setMembers(prev => prev.filter(m => m.id !== userId));
                setLikedUsers(prev => ({ ...prev, [userId]: false }));
            }
        } catch (error) {
            console.error('Failed to unlike user:', error);
            Alert.alert('Błąd', 'Nie udało się cofnąć polubienia.');
        }
    };

    const renderItem = ({ item }) => {
        // Use clean mapped values if available, otherwise try to extract using IDs (fallback)
        // IDs: Zodiac 303, Bio 367, Faith 346, Politics 351, Work 356, Diet 362
        const zodiac = item.zodiac_sign || item.zodiac || zodiacCache[item.id] || getField(item, 303);
        const age = item.hide_age ? null : (item.age || calculateAge(getField(item, 107)));
        const zodiacIcon = getZodiacIcon(zodiac);
        const imageUrl = item.hires_avatar?.large || item.hires_avatar?.full || item.avatar_urls?.full;
        const anim = cardAnimations[item.id] || { translateX: new Animated.Value(0), opacity: new Animated.Value(1) };

        const faithField = getField(item, 346);
        const dietField = getField(item, 362);
        const workField = getField(item, 356);
        const politicsField = getField(item, 351); // Fallback for politics
        const bio = item.bio || getField(item, 367);

        // Horizontal layout for liked/likesMe/matches/skipped tabs
        const isHorizontalView = activeTab === 'liked' || activeTab === 'likesMe' || activeTab === 'matches' || activeTab === 'skipped';

        if (isHorizontalView) {
            return (
                <Animated.View style={[
                    styles.horizontalCard,
                    {
                        transform: [{ translateX: anim.translateX }],
                        opacity: anim.opacity,
                    }
                ]}>
                    {/* Left side - Photo with name overlay */}
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
                        style={styles.horizontalImageContainer}
                    >
                        <Image source={{ uri: imageUrl }} style={styles.horizontalImage} resizeMode="cover" />
                        <View style={styles.horizontalNameOverlay}>
                            <Text style={styles.horizontalName}>{item.name}{age ? `, ${age}` : ''}</Text>
                        </View>
                    </TouchableOpacity>

                    {/* Right side - Info and buttons */}
                    <View style={styles.horizontalContent}>
                        {/* Bio */}
                        {(item.bio || bio) ? (
                            <Text style={styles.horizontalBio} numberOfLines={3} ellipsizeMode="tail">
                                {item.bio || bio}
                            </Text>
                        ) : null}

                        {/* Profile Tags */}
                        <View style={styles.horizontalTagsContainer}>
                            {zodiac ? (
                                <View style={[styles.profileTag, styles.zodiacTag, styles.smallProfileTag]}>
                                    <Text style={[styles.profileTagText, styles.smallProfileTagText]}>{zodiac}</Text>
                                </View>
                            ) : null}
                            {/* Use both item property and getField fallback */}
                            {(item.faith || faithField) ? (
                                <View style={[styles.profileTag, styles.smallProfileTag]}>
                                    <Text style={[styles.profileTagText, styles.smallProfileTagText]}>{item.faith || faithField}</Text>
                                </View>
                            ) : null}
                            {(item.politics || politicsField) ? (
                                <View style={[styles.profileTag, styles.smallProfileTag]}>
                                    <Text style={[styles.profileTagText, styles.smallProfileTagText]}>{item.politics || politicsField}</Text>
                                </View>
                            ) : null}
                            {(item.work || workField) ? (
                                <View style={[styles.profileTag, styles.smallProfileTag]}>
                                    <Text style={[styles.profileTagText, styles.smallProfileTagText]}>{item.work || workField}</Text>
                                </View>
                            ) : null}
                            {(item.diet || dietField) ? (
                                <View style={[styles.profileTag, styles.smallProfileTag]}>
                                    <Text style={[styles.profileTagText, styles.smallProfileTagText]}>{item.diet || dietField}</Text>
                                </View>
                            ) : null}
                        </View>

                        <View style={styles.horizontalButtonsContainer}>
                            {activeTab === 'liked' && (
                                <TouchableOpacity
                                    style={[styles.horizontalButton, styles.unlikeButtonHorizontal]}
                                    onPress={() => handleUnlike(item.id)}
                                >
                                    <MaterialCommunityIcons name="heart-off" size={20} color="#F5B041" />
                                    <Text style={styles.horizontalButtonLabel}>Cofnij</Text>
                                </TouchableOpacity>
                            )}

                            {(activeTab === 'likesMe' || activeTab === 'matches') && (
                                <TouchableOpacity
                                    style={[styles.horizontalButton, styles.unlikeButtonHorizontal]}
                                    onPress={() => handleSkip(item.id)}
                                >
                                    <MaterialCommunityIcons name="close" size={20} color="#FF6B6B" />
                                    <Text style={styles.horizontalButtonLabel}>Usuń</Text>
                                </TouchableOpacity>
                            )}

                            {activeTab === 'skipped' && (
                                <View style={styles.skippedButtonsContainer}>
                                    <TouchableOpacity
                                        style={styles.restoreButtonPill}
                                        onPress={() => handleRestore(item.id)}
                                    >
                                        <Ionicons name="refresh" size={16} color="#FFF" />
                                        <Text style={styles.restoreButtonText}>Przywróć</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.likeButtonCircle}
                                        onPress={() => handleLike(item.id)}
                                    >
                                        <Ionicons name="heart" size={28} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            )}
                            <TouchableOpacity
                                style={[styles.horizontalButton, styles.superMessageButtonHorizontal]}
                                onPress={() => {
                                    setSuperMessageRecipient(item);
                                    setShowSuperMessageModal(true);
                                }}
                            >
                                <Ionicons name="mail" size={22} color="#FFD700" />
                            </TouchableOpacity>

                            {/* Allow Chat for Women (Horizontal) */}
                            {userInfo?.gender?.toLowerCase() === 'kobieta' && item.gender?.toLowerCase() === 'mężczyzna' && (
                                <TouchableOpacity
                                    style={[styles.horizontalButton, styles.allowChatButtonHorizontal]}
                                    onPress={() => handleAllowChat(item)}
                                >
                                    <View style={styles.allowChatIconContainerHorizontal}>
                                        <Ionicons name="checkmark" size={20} color="#808000" />
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </Animated.View>
            );
        }

        // Original vertical layout for search tab
        return (
            <Animated.View style={[
                styles.cardContainer,
                {
                    transform: [{ translateX: anim.translateX }],
                    opacity: anim.opacity,
                }
            ]}>
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
                    style={styles.imageContainer}
                >
                    <Image source={{ uri: imageUrl }} style={styles.cardImage} resizeMode="cover" />

                    {/* Minimal Overlay for Essential Info */}
                    <View style={styles.cardOverlay}>
                        <View style={styles.nameRow}>
                            <Text style={styles.cardName}>{item.name}{age ? `, ${age}` : ''}</Text>
                        </View>
                        <View style={styles.statusContainer}>
                            <View style={styles.statusDot} />
                            <Text style={styles.statusText}>{item.last_activity || 'Nieznana aktywność'}</Text>
                        </View>
                    </View>

                    {/* Allow Chat Button for Women - Positioned in Top Right Corner */}
                    {userInfo?.gender?.toLowerCase() === 'kobieta' && item.gender?.toLowerCase() === 'mężczyzna' && (
                        <View style={styles.allowChatOverlay}>
                            <TouchableOpacity
                                style={styles.allowChatButtonTopRight}
                                onPress={() => handleAllowChat(item)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="checkmark" size={28} color="#808000" />
                            </TouchableOpacity>

                            {showOnboardingBubble && (
                                <Animated.View style={[
                                    styles.onboardingBubble,
                                    {
                                        opacity: bubbleAnim,
                                        transform: [{
                                            translateY: bubbleAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [20, 0]
                                            })
                                        }]
                                    }
                                ]}>
                                    <Text style={styles.onboardingBubbleText}>Pozwól temu użytkownikowi ze sobą porozmawiać.</Text>
                                    <TouchableOpacity onPress={handleCloseBubble} style={styles.onboardingBubbleClose}>
                                        <Ionicons name="close" size={16} color="#fff" />
                                    </TouchableOpacity>
                                    <View style={styles.onboardingBubbleArrow} />
                                </Animated.View>
                            )}
                        </View>
                    )}
                </TouchableOpacity>

                {/* Profile Details Below Image */}
                <View style={styles.cardDetailsContainer}>
                    {item.bio ? (
                        <Text style={styles.cardBio} numberOfLines={3} ellipsizeMode="tail">
                            {item.bio}
                        </Text>
                    ) : null}

                    {/* Profile Tags */}
                    <View style={styles.profileTagsContainer}>
                        {zodiac ? (
                            <View style={[styles.profileTag, styles.zodiacTag]}>
                                <Text style={styles.profileTagText}>{zodiac}</Text>
                            </View>
                        ) : null}
                        {(item.faith || faithField) && (
                            <View style={styles.profileTag}>
                                <Text style={styles.profileTagText}>{item.faith || faithField}</Text>
                            </View>
                        )}
                        {(item.politics || politicsField) && (
                            <View style={styles.profileTag}>
                                <Text style={styles.profileTagText}>{item.politics || politicsField}</Text>
                            </View>
                        )}
                        {(item.work || workField) && (
                            <View style={styles.profileTag}>
                                <Text style={styles.profileTagText}>{item.work || workField}</Text>
                            </View>
                        )}
                        {(item.diet || dietField) && (
                            <View style={styles.profileTag}>
                                <Text style={styles.profileTagText}>{item.diet || dietField}</Text>
                            </View>
                        )}
                        {showNumerology && item.numerology && (
                            <View style={[styles.profileTag, styles.numerologyTag]}>
                                <Text style={[styles.profileTagText, styles.numerologyTagText]}>{item.numerology}</Text>
                            </View>
                        )}
                    </View>
                </View>

                <View style={styles.actionButtonsContainer}>
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#fff' }]}>
                        <MaterialCommunityIcons name="reload" size={24} color="#F5B041" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#fff' }]}
                        onPress={() => handleSkip(item.id)}
                    >
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
                    <TouchableOpacity
                        style={[styles.actionButton, styles.superMessageButton]}
                        onPress={() => {
                            setSuperMessageRecipient(item);
                            setShowSuperMessageModal(true);
                        }}
                    >
                        <Ionicons name="mail" size={20} color="#FFD700" />
                        <Text style={styles.superMessagePremiumLabel}>SuperMSG</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        );
    };

    const handleResetFilters = async () => {
        const defaults = {
            min: 18,
            max: 65,
            hasBio: false,
            showNumerology: false,
            faith: '',
            politics: '',
            work: '',
            diet: ''
        };

        // Update State
        setAgeRange({ min: defaults.min, max: defaults.max });
        setHasBio(defaults.hasBio);
        setShowNumerology(defaults.showNumerology);
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
                showNumerology: defaults.showNumerology,
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
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity style={styles.headerButton} onPress={() => setShowFiltersModal(true)}>
                    <Ionicons name="options-outline" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.headerTitle}>Prawdziwa Miłość</Text>
                </View>
                <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Notifications')}>
                    <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
                    {unreadNotifications > 0 && <View style={styles.notificationDot} />}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { userId: 'me' })}>
                    <View style={styles.avatarContainer}>
                        <Image
                            source={{ uri: currentUserAvatar || 'https://via.placeholder.com/40' }}
                            style={styles.headerAvatar}
                        />
                        {isPremium && (
                            <View style={styles.avatarPremiumBadge}>
                                <Text style={styles.avatarPremiumText}>⭐</Text>
                            </View>
                        )}
                    </View>
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
                            onPress={() => {
                                // Synchronize with Bottom Tab Navigation
                                if (tab.id === 'search') {
                                    navigation.navigate('Members');
                                    if (route.name === 'Members') setActiveTab('search');
                                } else if (tab.id === 'likesMe') {
                                    navigation.navigate('LikesMe');
                                    if (route.name === 'LikesMe') setActiveTab('likesMe');
                                } else if (tab.id === 'skipped') {
                                    navigation.navigate('Skipped');
                                    if (route.name === 'Skipped') setActiveTab('skipped');
                                } else {
                                    // For tabs without a specific bottom tab (e.g. Matches, Liked), keep local state
                                    setActiveTab(tab.id);
                                }
                            }}
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

            {/* Skipped Info Text */}
            {activeTab === 'skipped' && members.length > 0 && (
                <View style={styles.skippedInfoContainer}>
                    <Text style={styles.skippedInfoText}>
                        Ci użytkownicy nie mogą do Ciebie pisać ani Cię lajkować.
                    </Text>
                </View>
            )}

            {/* Empty state message */}
            {!loading && members.length === 0 && (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>
                        {activeTab === 'liked' && 'Nie polubiłeś jeszcze nikogo'}
                        {activeTab === 'likesMe' && 'Nikt Cię jeszcze nie polubił'}
                        {activeTab === 'matches' && 'Nie masz jeszcze żadnych dopasowań'}
                        {activeTab === 'search' && 'Brak wyników'}
                        {activeTab === 'skipped' && 'Jeszcze nikogo tu nie ma'}
                    </Text>
                </View>
            )}

            {/* Content Area with Loader Overlay */}
            <View style={{ flex: 1, position: 'relative' }}>
                <FlatList
                    ref={listRef}
                    data={members}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    onEndReached={activeTab === 'search' ? handleLoadMore : null}
                    onEndReachedThreshold={0.3}
                    ListFooterComponent={loading && members.length > 0 ? <ActivityIndicator size="small" color="#FF6B6B" style={{ marginVertical: 20 }} /> : null}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor="#FF6B6B"
                            colors={["#FF6B6B"]}
                        />
                    }
                />

                {/* Centered Heart Loading Animation */}
                {loading && members.length === 0 && (
                    <View style={styles.loaderContainer}>
                        <HeartLoader size={60} color="#FF6B6B" />
                    </View>
                )}
            </View>

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

                        {/* Show Numerology Toggle */}
                        <TouchableOpacity
                            style={styles.filterToggleRow}
                            onPress={() => setShowNumerology(!showNumerology)}
                        >
                            <Text style={styles.filterOptionName}>Pokaż Numerologię</Text>
                            <View style={[styles.toggleTrack, showNumerology && styles.toggleTrackActive]}>
                                <View style={[styles.toggleThumb, showNumerology && styles.toggleThumbActive]} />
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

                        {/* 
                        {FILTER_OPTIONS.map((filter) => (
                            <TouchableOpacity key={filter.id} style={styles.filterRow}>
                                <Text style={styles.filterIcon}>{filter.icon}</Text>
                                <Text style={styles.filterOptionName}>{filter.name}</Text>
                                <Text style={styles.filterValue}>Wybierz ›</Text>
                            </TouchableOpacity>
                        ))}
                        */}

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

            {/* Super Message Modal */}
            <SuperMessageModal
                visible={showSuperMessageModal}
                recipientId={superMessageRecipient?.id}
                recipientName={superMessageRecipient?.name}
                onClose={() => {
                    setShowSuperMessageModal(false);
                    setSuperMessageRecipient(null);
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#2C2C2E' }, // Dark charcoal background
    loaderContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    header: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 10, alignItems: 'center' },
    headerButton: { padding: 10, backgroundColor: '#3A3A3C', borderRadius: 15, marginRight: 10 }, // Darker grey for buttons
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        fontFamily: 'serif',
        color: '#FFFFFF',
        letterSpacing: 1,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatarPremiumBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#1a1a2e',
        borderRadius: 10,
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FFD700',
    },
    avatarPremiumText: {
        fontSize: 10,
    },
    headerAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#fff' },
    notificationDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4757', borderWidth: 1, borderColor: '#3A3A3C' },
    listContent: { paddingBottom: 100 },

    // Horizontal card styles for liked/likesMe/matches tabs
    horizontalCard: {
        flexDirection: 'row',
        backgroundColor: '#2A2A3C',
        borderRadius: 16,
        marginHorizontal: 20,
        marginBottom: 15,
        overflow: 'hidden',
    },
    horizontalImageContainer: {
        width: 140,
        height: 180,
        position: 'relative',
    },
    horizontalImage: {
        width: '100%',
        height: '100%',
    },
    horizontalNameOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    horizontalName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    horizontalContent: {
        flex: 1,
        padding: 15,
        // justifyContent: 'center', // Removed to let items flow from top
    },
    horizontalBio: {
        color: '#ccc',
        fontSize: 12,
        lineHeight: 16,
        marginBottom: 5,
    },
    horizontalTagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 12,
    },
    horizontalButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: 8, // Reduced from 12
        marginTop: 'auto', // Push to bottom
    },
    horizontalButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    unlikeButtonHorizontal: {
        backgroundColor: '#fff',
        flexDirection: 'row',
        paddingHorizontal: 10,
        width: 'auto',
    },
    horizontalButtonLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#F5B041',
        marginLeft: 4,
    },
    superMessageButtonHorizontal: {
        backgroundColor: '#1a1a2e',
        borderWidth: 1,
        borderColor: '#FFD700',
    },

    cardContainer: {
        width: CARD_WIDTH,
        alignSelf: 'center',
        marginBottom: 30,
        backgroundColor: '#1C1C1E',
        borderRadius: 30,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 8,
    },
    cardHeader: { marginBottom: 10 },
    nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
    cardName: {
        fontFamily: 'serif',
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        flex: 1,
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    imageContainer: {
        position: 'relative',
        borderRadius: 30,
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    cardOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
    },
    cardOverlayCompact: {
        paddingHorizontal: 10,
        paddingVertical: 10,
        paddingBottom: 10,
    },
    cardNameCompact: {
        fontSize: 16,
    },
    cardDetailsContainer: {
        padding: 20,
        paddingBottom: 10,
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
    numerologyBadge: {
        position: 'absolute',
        top: 15,
        right: 15,
        backgroundColor: '#ffc107',
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
    numerologyText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#333',
    },
    profileTagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 10,
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    profileTag: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        marginRight: 6,
        marginBottom: 6,
    },
    profileTagText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '500',
    },
    smallProfileTag: {
        paddingHorizontal: 5,
        paddingVertical: 0,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 6,
        marginRight: 3,
        marginBottom: 2,
    },
    smallProfileTagText: {
        fontSize: 9,
        lineHeight: 12,
    },
    numerologyTag: {
        backgroundColor: 'rgba(255, 193, 7, 0.3)',
        borderColor: '#ffc107',
    },
    numerologyTagText: {
        color: '#ffc107',
    },
    zodiacTag: {
        backgroundColor: 'rgba(212, 175, 55, 0.2)',
        borderColor: '#d4af37',
    },
    statusContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2ECC71', marginRight: 5 },
    statusText: { color: '#2ECC71', fontWeight: '600' },
    cardImage: {
        width: '100%',
        height: IMAGE_HEIGHT * 0.95, // Slightly shorter to make room for details
        borderRadius: 30,
        backgroundColor: '#000',
    },

    zodiacText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    actionButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        paddingHorizontal: 20,
        paddingBottom: 25,
        paddingTop: 10,
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
    // Styles for skipped tab buttons
    skippedButtonsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6, // Reduced from 8
        justifyContent: 'center', // Changed from flex-end to center to avoid pushing
        // Removed paddingRight to reduce gap to SuperMSG button
    },
    restoreButtonPill: {
        flexDirection: 'row',
        backgroundColor: '#3498DB',
        height: 44, // Match standard button height
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        gap: 1, // Ultra tight gap
        elevation: 3,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    restoreButtonText: {
        color: '#FFF',
        fontSize: 11, // Smallest readable text
        fontWeight: '700',
    },
    likeButtonCircle: {
        backgroundColor: '#2ECC71',
        width: 44, // Match standard button size
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    skippedInfoContainer: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: 'rgba(232, 180, 184, 0.1)',
        marginBottom: 10,
        marginHorizontal: 10,
        borderRadius: 10,
        alignItems: 'center',
    },
    skippedInfoText: {
        color: '#E8B4B8',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    actionButtonCompact: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    superMessageButton: {
        backgroundColor: '#1a1a2e',
        borderWidth: 2,
        borderColor: '#FFD700',
    },
    superMessageButtonText: {
        fontSize: 24,
    },
    superMessagePremiumLabel: {
        fontSize: 7,
        fontWeight: '700',
        color: '#FFD700',
        marginTop: 1,
    },
    unlikeButton: {
        backgroundColor: '#fff',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
    },
    unlikeButtonLabel: {
        fontSize: 8,
        fontWeight: '600',
        color: '#F5B041',
        marginTop: 2,
    },
    premiumTabItem: {
        backgroundColor: '#1a1a2e',
        borderWidth: 2,
        borderColor: '#FFD700',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 6,
        marginHorizontal: 4,
    },
    premiumTabLabel: {
        fontSize: 18,
        color: '#FFD700',
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
        alignItems: 'center',
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
    premiumBadgeText: {
        fontSize: 8,
        fontWeight: '700',
        color: '#FFD700',
        marginTop: 2,
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
        fontSize: 14,
        color: '#CBCBCB',
        marginBottom: 10,
        lineHeight: 20,
    },
    allowChatButton: {
        backgroundColor: '#2ECC71',
        marginLeft: 10,
    },
    allowChatOverlay: {
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 100,
    },
    allowChatButtonTopRight: {
        backgroundColor: '#1A1A1A',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#D4AF37',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 6,
    },
    allowChatIconContainer: {
        position: 'relative',
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    allowChatCheckmark: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#fff',
        borderRadius: 6,
        padding: 1,
    },
    onboardingBubble: {
        position: 'absolute',
        top: 55,
        right: 0,
        backgroundColor: '#FF6B9D',
        padding: 12,
        borderRadius: 12,
        width: 180,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 10,
        zIndex: 1000,
    },
    onboardingBubbleText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 18,
    },
    onboardingBubbleClose: {
        position: 'absolute',
        top: 4,
        right: 4,
    },
    onboardingBubbleArrow: {
        bottom: '100%',
        right: 10,
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 10,
        borderRightWidth: 10,
        borderBottomWidth: 10,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: '#FF6B9D',
    },
    allowChatButtonHorizontal: {
        backgroundColor: '#1A1A1A',
        borderWidth: 1,
        borderColor: '#D4AF37',
    },
    allowChatIconContainerHorizontal: {
        position: 'relative',
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    allowChatCheckmarkHorizontal: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#fff',
        borderRadius: 5,
        padding: 0.5,
    },
});

export default MembersScreen;
