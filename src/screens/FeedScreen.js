import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    RefreshControl,
    StyleSheet,
    ActivityIndicator,
    Alert
} from 'react-native';
import { getActivity, createPost, deletePost, favoritePost, unfavoritePost } from '../api/activity';
import PostComposer from '../components/PostComposer';
import ActivityPost from '../components/ActivityPost';

const FeedScreen = () => {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // Load initial feed
    useEffect(() => {
        loadFeed();
    }, []);

    const loadFeed = async (pageNum = 1) => {
        try {
            setLoading(true);
            const data = await getActivity(pageNum);

            if (pageNum === 1) {
                setActivities(data);
            } else {
                setActivities(prev => [...prev, ...data]);
            }

            setHasMore(data.length === 20); // If we got 20, there might be more
            setPage(pageNum);
        } catch (error) {
            console.error('Error loading feed:', error);
            Alert.alert('Błąd', 'Nie udało się załadować aktywności');
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
        try {
            const newPost = await createPost(content);
            // Add new post to the top of the feed
            setActivities(prev => [newPost, ...prev]);
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
            setActivities(prev => prev.filter(a => a.id !== activityId));
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
                        ? { ...activity, favorited: !currentlyFavorited }
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

    return (
        <View style={styles.container}>
            <PostComposer onPostCreated={handlePostCreated} />

            <FlatList
                data={activities}
                renderItem={renderItem}
                keyExtractor={item => item.id.toString()}
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
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
