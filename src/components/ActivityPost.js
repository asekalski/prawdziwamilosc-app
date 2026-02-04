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

const ActivityPost = ({ activity, onDelete, onLike }) => {
    const { user } = useContext(AuthContext);
    const isOwnPost = user && activity.user_id === user.id;

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

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000); // seconds

        if (diff < 60) return 'przed chwilą';
        if (diff < 3600) return `${Math.floor(diff / 60)} min temu`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} godz. temu`;
        if (diff < 604800) return `${Math.floor(diff / 86400)} dni temu`;

        return date.toLocaleDateString('pl-PL');
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Image
                    source={{ uri: activity.user_avatar?.full || 'https://via.placeholder.com/50' }}
                    style={styles.avatar}
                />

                <View style={styles.headerText}>
                    <Text style={styles.name}>{activity.name || 'Użytkownik'}</Text>
                    <Text style={styles.date}>{formatDate(activity.date)}</Text>
                </View>

                {isOwnPost && (
                    <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
                        <Text style={styles.deleteIcon}>×</Text>
                    </TouchableOpacity>
                )}
            </View>

            <Text style={styles.content}>{activity.content?.rendered || activity.content}</Text>

            <View style={styles.actions}>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleLike}
                >
                    <Text style={[styles.actionIcon, activity.favorited && styles.liked]}>
                        {activity.favorited ? '❤️' : '🤍'}
                    </Text>
                    {activity.favorite_count > 0 && (
                        <Text style={styles.actionCount}>{activity.favorite_count}</Text>
                    )}
                </TouchableOpacity>

                {/* Comment count if exists */}
                {activity.comment_count > 0 && (
                    <View style={styles.actionButton}>
                        <Text style={styles.actionIcon}>💬</Text>
                        <Text style={styles.actionCount}>{activity.comment_count}</Text>
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#2a2a2a',
        padding: 16,
        marginBottom: 1,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#3a3a3a',
    },
    headerText: {
        flex: 1,
        marginLeft: 12,
    },
    name: {
        color: '#d4af37',
        fontSize: 16,
        fontWeight: '600',
    },
    date: {
        color: '#999',
        fontSize: 12,
        marginTop: 2,
    },
    deleteButton: {
        padding: 8,
    },
    deleteIcon: {
        color: '#ef4444',
        fontSize: 28,
        lineHeight: 28,
        fontWeight: '300',
    },
    content: {
        color: '#fff',
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 12,
    },
    actions: {
        flexDirection: 'row',
        gap: 16,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionIcon: {
        fontSize: 20,
    },
    liked: {
        color: '#ef4444',
    },
    actionCount: {
        color: '#999',
        fontSize: 14,
    },
});

export default ActivityPost;
