import React, { useState } from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Image
} from 'react-native';

const PostComposer = ({ onPostCreated, canPost, userAvatar }) => {
    const [content, setContent] = useState('');
    const [posting, setPosting] = useState(false);

    const handlePost = async () => {
        if (!content.trim()) {
            Alert.alert('Błąd', 'Post nie może być pusty');
            return;
        }

        try {
            setPosting(true);
            await onPostCreated(content.trim());
            setContent(''); // Clear input after successful post
        } catch (error) {
            // Error already handled in parent
        } finally {
            setPosting(false);
        }
    };

    if (!canPost) {
        return (
            <View style={[styles.container, styles.disabledContainer]}>
                <Image
                    source={{ uri: (userAvatar && typeof userAvatar === 'string') ? userAvatar : 'https://via.placeholder.com/40' }}
                    style={styles.avatar}
                />
                <View style={styles.disabledContent}>
                    <Text style={styles.disabledText}>Wróć jutro, aby napisać kolejny post!</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.row}>
                <Image
                    source={{ uri: (userAvatar && typeof userAvatar === 'string') ? userAvatar : 'https://via.placeholder.com/40' }}
                    style={styles.avatar}
                />
                <TextInput
                    style={styles.input}
                    placeholder="Co słychać?"
                    placeholderTextColor="#666"
                    multiline
                    maxLength={500}
                    value={content}
                    onChangeText={setContent}
                    editable={!posting}
                    scrollEnabled={false}
                />
            </View>

            <View style={styles.footer}>
                <Text style={styles.counter}>
                    {content.length}/500
                </Text>

                <TouchableOpacity
                    style={[styles.postButton, (posting || !content.trim()) && styles.postButtonDisabled]}
                    onPress={handlePost}
                    disabled={posting || !content.trim()}
                >
                    {posting ? (
                        <ActivityIndicator size="small" color="#1a1a1a" />
                    ) : (
                        <Text style={styles.postButtonText}>Opublikuj</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#1a1a1a',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    disabledContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        opacity: 0.7,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#333',
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 18,
        paddingTop: 8,
        minHeight: 40,
        textAlignVertical: 'top',
    },
    disabledContent: {
        flex: 1,
        justifyContent: 'center',
    },
    disabledText: {
        color: '#666',
        fontSize: 16,
        fontStyle: 'italic',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 12,
        gap: 16,
    },
    counter: {
        color: '#666',
        fontSize: 12,
    },
    postButton: {
        backgroundColor: '#d4af37',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        minWidth: 90,
        alignItems: 'center',
    },
    postButtonDisabled: {
        backgroundColor: '#555',
        opacity: 0.7,
    },
    postButtonText: {
        color: '#1a1a1a',
        fontSize: 15,
        fontWeight: 'bold',
    },
});

export default PostComposer;
