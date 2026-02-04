import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, Image, Text, useWindowDimensions } from 'react-native';
import { getActivity } from '../api/activity';
import RenderHtml from 'react-native-render-html';
import { useTheme } from '@react-navigation/native';

const ActivityFeedScreen = () => {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const { width } = useWindowDimensions();
    const { colors } = useTheme();

    const fetchActivity = async (pageNum = 1) => {
        if (loading && pageNum > 1) return;
        setLoading(true);
        try {
            const data = await getActivity(pageNum);
            if (pageNum === 1) {
                setActivities(data);
            } else {
                setActivities(prev => [...prev, ...data]);
            }
        } catch (error) {
            console.error(error);
            if (error.response && error.response.status === 404) {
                // Activity component might be disabled
                console.log('Activity stream not found (404)');
            } else {
                Alert.alert('Error', `Failed to load activity: ${error.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActivity(1);
    }, []);

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchActivity(nextPage);
    };

    const renderItem = ({ item }) => (
        <View style={[styles.item, { borderBottomColor: colors.border }]}>
            <View style={styles.header}>
                <Image source={{ uri: item.user_avatar?.full }} style={styles.avatar} />
                <View style={styles.headerText}>
                    <RenderHtml
                        contentWidth={width - 80}
                        source={{ html: item.title }}
                        baseStyle={{ color: colors.text, fontSize: 14 }}
                    />
                    <Text style={[styles.date, { color: colors.text }]}>{new Date(item.date).toLocaleDateString()}</Text>
                </View>
            </View>
            {item.content && item.content.rendered ? (
                <RenderHtml
                    contentWidth={width - 40}
                    source={{ html: item.content.rendered }}
                    baseStyle={{ color: colors.text }}
                />
            ) : null}
        </View>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={activities}
                renderItem={renderItem}
                keyExtractor={item => item.id.toString()}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={loading ? <ActivityIndicator /> : null}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 10 },
    item: { padding: 10, borderBottomWidth: 1, marginBottom: 10 },
    header: { flexDirection: 'row', marginBottom: 10 },
    avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
    headerText: { flex: 1 },
    date: { fontSize: 12, opacity: 0.6, marginTop: 2 },
});

export default ActivityFeedScreen;
