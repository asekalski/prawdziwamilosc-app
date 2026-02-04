import React, { useState } from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    Alert
} from 'react-native';

const PostComposer = ({ onPostCreated }) => {
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
            Alert

                .alert('Sukces', 'Post został opublikowany');
        } catch (error) {
            // Error already handled in parent
        } finally {
            setPosting(false);
        }
    };

    return (
        <View style={styles.container}>
            <TextInput
                style={styles.input}
                placeholder="Co słychać?"
                placeholderTextColor="#666"
                multiline
                maxLength={500}
                value={content}
                onChangeText={setContent}
                editable={!posting}
            />

            <View style={styles.footer}>
                <Text style={styles.counter}>
                    {content.length}/500
                </Text>

                <TouchableOpacity
                    style={[styles.postButton, posting && styles.postButtonDisabled]}
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
        backgroundColor: '#2a2a2a',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#3a3a3a',
    },
    input: {
        backgroundColor: '#1a1a1a',
        borderRadius: 8,
        padding: 12,
        color: '#fff',
        fontSize: 16,
        minHeight: 80,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: '#3a3a3a',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
    },
    counter: {
        color: '#999',
        fontSize: 12,
    },
    postButton: {
        backgroundColor: '#d4af37',
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 20,
        minWidth: 100,
        alignItems: 'center',
    },
    postButtonDisabled: {
        backgroundColor: '#666',
    },
    postButtonText: {
        color: '#1a1a1a',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default PostComposer;
