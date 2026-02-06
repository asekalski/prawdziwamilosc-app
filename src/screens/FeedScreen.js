import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    View,
    Text,
    FlatList,
    RefreshControl,
    StyleSheet,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { getActivity, createPost, deletePost, favoritePost, unfavoritePost } from '../api/activity';
import PostComposer from '../components/PostComposer';
import ActivityPost from '../components/ActivityPost';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const FeedScreen = () => {
    const { userInfo } = useContext(AuthContext);
    const insets = useSafeAreaInsets();
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [canPost, setCanPost] = useState(true);

    // Load initial feed
    useEffect(() => {
        loadFeed();
    }, []);

    const checkLimit = (data) => {
        if (!userInfo) return;

        const today = new Date().toISOString().split('T')[0];
        const userPostsToday = data.filter(activity => {
            const activityDate = new Date(activity.date).toISOString().split('T')[0];
            return activity.user_id === userInfo.id &&
                activityDate === today &&
                activity.type === 'activity_update' &&
                (!!activity.content?.rendered || !!activity.content?.raw);
        });

        setCanPost(userPostsToday.length === 0);
    };

    const loadFeed = async (pageNum = 1) => {
        try {
            setLoading(true);
            const data = await getActivity(pageNum);
            console.log('Feed RAW data:', JSON.stringify(data, null, 2));

            // Filter to only show actual user posts (activity_update)
            const postsOnly = data.filter(item => {
                const isUpdate = item.type === 'activity_update';

                // DATA RECOVERY: Content might be a simple string (our endpoint) or an object (WP default)
                let contentVal = '';
                if (typeof item.content === 'string') {
                    contentVal = item.content;
                } else if (item.content && typeof item.content === 'object') {
                    contentVal = item.content.rendered || item.content.raw || '';
                }

                const hasContent = contentVal && contentVal.trim().length > 0;

                if (!isUpdate || !hasContent) {
                    console.log('Filtered out item:', item.id, item.type, typeof item.content);
                }
                return isUpdate && hasContent;
            });

            if (pageNum === 1) {
                setActivities(postsOnly);
                checkLimit(data);
            } else {
                setActivities(prev => [...prev, ...postsOnly]);
            }

            setHasMore(data.length === 20); // If we got 20, there might be more
            setPage(pageNum);
        } catch (error) {
            console.error('Error loading feed:', error);
            // Alert.alert('Błąd', 'Nie udało się załadować aktywności');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadFeed(1);
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            loadFeed(page + 1);
        }
    };

    const handlePostCreated = async (content) => {
        if (!canPost) {
            Alert.alert('Limit', 'Możesz napisać tylko jeden post dziennie.');
            return;
        }

        try {
            const tempPost = await createPost(content);

            // Shim the new post with current user info to ensure immediate rendering
            // API might return minimal data, so we fill in the gaps for UI
            const newPost = {
                ...tempPost,
                user_id: userInfo.id,
                name: userInfo.displayName || userInfo.nicename || 'Ja',
                user_avatar: userInfo.avatar_urls,
                date: new Date().toISOString(),
                content: {
                    rendered: content,
                    raw: content
                },
                type: 'activity_update'
            };

            // Add new post to the top of the feed
            setActivities(prev => [newPost, ...prev]);
            setCanPost(false);
        } catch (error) {
            console.error('Error creating post:', error);
            Alert.alert('Błąd', 'Nie udało się utworzyć posta');
            throw error;
        }
    };

    const handleDelete = async (activityId) => {
        try {
            await deletePost(activityId);
            // Remove from local state
            const deletedPost = activities.find(a => a.id === activityId);
            setActivities(prev => prev.filter(a => a.id !== activityId));

            // Re-check limit if deleted post was from today
            if (deletedPost) {
                const today = new Date().toISOString().split('T')[0];
                const activityDate = new Date(deletedPost.date).toISOString().split('T')[0];
                if (deletedPost.user_id === userInfo?.id &&
                    activityDate === today &&
                    deletedPost.type === 'activity_update') {
                    setCanPost(true);
                }
            }
        } catch (error) {
            console.error('Error deleting post:', error);
            Alert.alert('Błąd', 'Nie udało się usunąć posta');
        }
    };

    const handleLike = async (activityId, currentlyFavorited) => {
        try {
            if (currentlyFavorited) {
                await unfavoritePost(activityId);
            } else {
                await favoritePost(activityId);
            }

            // Update local state
            setActivities(prev =>
                prev.map(activity =>
                    activity.id === activityId
                        ? { ...activity, favorited: !currentlyFavorited, favorite_count: currentlyFavorited ? activity.favorite_count - 1 : activity.favorite_count + 1 }
                        : activity
                )
            );
        } catch (error) {
            console.error('Error toggling favorite:', error);
            Alert.alert('Błąd', 'Nie udało się polubić posta');
        }
    };

    const renderItem = ({ item }) => (
        <ActivityPost
            activity={item}
            onDelete={handleDelete}
            onLike={handleLike}
        />
    );

    const renderHeader = () => null;


    const renderFooter = () => {
        if (!loading || page === 1) return null;
        return (
            <View style={styles.footer}>
                <ActivityIndicator size="small" color="#d4af37" />
            </View>
        );
    };

    const renderEmpty = () => {
        if (loading) return null;
        return (
            <View style={styles.empty}>
                <Text style={styles.emptyText}>Brak aktywności do wyświetlenia</Text>
                <Text style={styles.emptySubtext}>Bądź pierwszy i napisz coś!</Text>
            </View>
        );
    };

    const getAvatarUrl = () => {
        if (!userInfo?.avatar_urls) return null;
        return userInfo.avatar_urls.full ||
            userInfo.avatar_urls.thumb ||
            userInfo.avatar_urls['96'] ||
            userInfo.avatar_urls['48'] ||
            userInfo.avatar_urls['24'];
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
            <View style={[styles.banner, { paddingTop: insets.top + 5, paddingBottom: 8 }]}>
                <Ionicons name="information-circle-outline" size={18} color="#d4af37" />
                <Text style={styles.bannerText} numberOfLines={1}>Raz dziennie możesz tu coś napisać</Text>
            </View>
            <FlatList
                data={activities}
                renderItem={renderItem}
                keyExtractor={item => item.id.toString()}
                ListHeaderComponent={null}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor="#d4af37"
                    />
                }
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderFooter}
                ListEmptyComponent={renderEmpty}
                contentContainerStyle={activities.length === 0 ? styles.emptyContainer : null}
            />
            <View style={styles.composerContainer}>
                <PostComposer
                    onPostCreated={handlePostCreated}
                    canPost={canPost}
                    userAvatar={getAvatarUrl()}
                />
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a1a',
    },
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        paddingHorizontal: 16,
        gap: 8,
    },
    bannerText: {
        color: '#d4af37',
        fontSize: 13,
        fontWeight: '500',
        flex: 1, // Ensure text takes available space but respects numberOfLines
    },
    composerContainer: {
        borderTopWidth: 1,
        borderTopColor: '#333',
        backgroundColor: '#1a1a1a',
    },
    footer: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    empty: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyContainer: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    emptyText: {
        color: '#d4af37',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    emptySubtext: {
        color: '#999',
        fontSize: 14,
    },
});

export default FeedScreen;
