import React, { useContext } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    Alert
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const ActivityPost = ({ activity, onDelete, onLike }) => {
    const { userInfo } = useContext(AuthContext);
    const navigation = useNavigation();
    const isOwnPost = userInfo && activity.user_id === userInfo.id;
    const isAdmin = userInfo && userInfo.roles && userInfo.roles.includes('administrator');
    const isAdminOrOwner = isOwnPost || isAdmin;

    const handleDelete = () => {
        Alert.alert(
            'Usuń post',
            'Czy na pewno chcesz usunąć ten post?',
            [
                { text: 'Anuluj', style: 'cancel' },
                {
                    text: 'Usuń',
                    style: 'destructive',
                    onPress: () => onDelete(activity.id)
                }
            ]
        );
    };

    const handleLike = () => {
        onLike(activity.id, activity.favorited);
    };

    const handleProfilePress = () => {
        navigation.navigate('UserProfile', { userId: activity.user_id });
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000); // seconds

        if (diff < 60) return 'teraz';
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d`;

        return date.toLocaleDateString('pl-PL');
    };

    const stripHtml = (html) => {
        if (!html) return '';
        return html.replace(/<[^>]*>?/gm, '');
    };

    const getDisplayContent = () => {
        // First try rendered content
        if (activity.content?.rendered) {
            const text = stripHtml(activity.content.rendered);
            if (text.trim()) return text;
        }

        // Try raw content (often present in newly created posts or specific API responses)
        if (activity.content?.raw) {
            const text = stripHtml(activity.content.raw);
            if (text.trim()) return text;
        }

        // Then try raw content string
        if (activity.content && typeof activity.content === 'string') {
            const text = stripHtml(activity.content);
            if (text.trim()) return text;
        }

        // Fallback to action if content is empty (e.g. "User became a registered member")
        if (activity.action) {
            return stripHtml(activity.action);
        }

        return '';
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.7}>
                <Image
                    source={{
                        uri: activity.user_avatar?.full ||
                            activity.user_avatar?.thumb ||
                            activity.user_avatar?.['96'] ||
                            activity.user_avatar?.['48'] ||
                            'https://via.placeholder.com/50'
                    }}
                    style={styles.avatar}
                />
            </TouchableOpacity>

            <View style={styles.contentContainer}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleProfilePress} style={styles.headerText} activeOpacity={0.7}>
                        <Text style={styles.name} numberOfLines={1}>{activity.name || 'Użytkownik'}</Text>
                        <Text style={styles.date}>· {formatDate(activity.date)}</Text>
                    </TouchableOpacity>

                    {isAdminOrOwner && (
                        <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
                            <Ionicons name="trash-outline" size={16} color="#666" />
                        </TouchableOpacity>
                    )}
                </View>

                <Text style={styles.content}>{getDisplayContent()}</Text>

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={handleLike}
                    >
                        <Ionicons
                            name={activity.favorited ? "heart" : "heart-outline"}
                            size={18}
                            color={activity.favorited ? "#ef4444" : "#666"}
                        />
                        {activity.favorite_count > 0 && (
                            <Text style={[styles.actionCount, activity.favorited && styles.likedText]}>
                                {activity.favorite_count}
                            </Text>
                        )}
                    </TouchableOpacity>

                    {activity.comment_count > 0 && (
                        <View style={styles.actionButton}>
                            <Ionicons name="chatbubble-outline" size={16} color="#666" />
                            <Text style={styles.actionCount}>{activity.comment_count}</Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#1a1a1a',
        padding: 12,
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    avatar: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        backgroundColor: '#333',
    },
    contentContainer: {
        flex: 1,
        marginLeft: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    headerText: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    name: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
        marginRight: 4,
    },
    date: {
        color: '#666',
        fontSize: 14,
    },
    deleteButton: {
        padding: 4,
    },
    content: {
        color: '#fff',
        fontSize: 15,
        lineHeight: 20,
        marginBottom: 8,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 24,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    actionCount: {
        color: '#666',
        fontSize: 13,
    },
    likedText: {
        color: '#ef4444',
    },
});

export default ActivityPost;
