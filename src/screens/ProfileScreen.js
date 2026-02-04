import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, ScrollView, Alert, TextInput, Modal, FlatList, Pressable } from 'react-native';
import { getMember, getXProfileGroups, updateXProfileField, updateMemberName } from '../api/members';
import { getThreads } from '../api/messages';
import { AuthContext } from '../context/AuthContext';
import { useTheme, useNavigation } from '@react-navigation/native';
import { TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const ProfileScreen = ({ route }) => {
    const { userInfo, logout } = useContext(AuthContext);
    const [member, setMember] = useState(null);
    const [loading, setLoading] = useState(true);
    const [messageLoading, setMessageLoading] = useState(false);
    const [editingFieldId, setEditingFieldId] = useState(null);
    const [editingValue, setEditingValue] = useState('');
    const [savingFieldId, setSavingFieldId] = useState(null);
    const [showSelectModal, setShowSelectModal] = useState(false);
    const [selectOptions, setSelectOptions] = useState([]);
    const [currentEditingField, setCurrentEditingField] = useState(null);
    const { colors } = useTheme();

    const userId = route?.params?.userId || userInfo?.id || 'me';
    const isOwnProfile = userId === 'me' || userId === userInfo?.id;

    useEffect(() => {
        const fetchMember = async () => {
            setLoading(true);
            try {
                const data = await getMember(userId);

                // Fetch complete xprofile data separately
                try {
                    const xprofileGroups = await getXProfileGroups(userId);
                    data.xprofile = { groups: xprofileGroups };
                } catch (xprofileError) {
                    console.log('XProfile fetch failed, using member data:', xprofileError);
                }

                setMember(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchMember();
    }, [userId]);

    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    // Handle clicking on a field to edit
    const handleFieldPress = (field, currentValue) => {
        if (!isOwnProfile) return;

        const fieldType = field.type?.name || field.type || 'textbox';
        const fieldOptions = field.options || field.type?.options || [];
        const isSelectType = ['selectbox', 'radio', 'multiselectbox', 'checkbox'].includes(fieldType);

        // Check if we have options to show
        const hasOptions = Array.isArray(fieldOptions)
            ? fieldOptions.length > 0
            : (fieldOptions && Object.keys(fieldOptions).length > 0);

        if (isSelectType && hasOptions) {
            // Show modal for select fields
            let options = [];

            if (Array.isArray(fieldOptions)) {
                // Options are array of objects (BuddyPress format)
                options = fieldOptions.map((opt, index) => ({
                    key: String(opt.id || index),
                    label: opt.name || opt.label || String(opt),
                    value: opt.name || opt.label || String(opt)
                }));
            } else {
                // Options are key-value object
                options = Object.entries(fieldOptions).map(([key, value]) => ({
                    key,
                    label: typeof value === 'object' ? (value.name || value.label || String(value)) : String(value),
                    value: typeof value === 'object' ? (value.name || value.label || String(value)) : String(value)
                }));
            }

            setSelectOptions(options);
            setCurrentEditingField(field);
            setEditingValue(currentValue);
            setShowSelectModal(true);
        } else {
            // Use TextInput for text fields
            setEditingFieldId(field.id);
            setEditingValue(currentValue);
        }
    };

    // Handle selecting an option from modal
    const handleSelectOption = async (option) => {
        if (!currentEditingField) return;

        setShowSelectModal(false);
        setSavingFieldId(currentEditingField.id);

        try {
            await updateXProfileField(currentEditingField.id, option.value);

            // Refetch member data
            const data = await getMember(userId);
            try {
                const xprofileGroups = await getXProfileGroups(userId);
                data.xprofile = { groups: xprofileGroups };
            } catch (xprofileError) {
                console.log('XProfile fetch failed:', xprofileError);
            }
            setMember(data);
        } catch (error) {
            console.error('Error saving field:', error);
            Alert.alert('Błąd', 'Nie udało się zapisać zmiany');
        } finally {
            setSavingFieldId(null);
            setCurrentEditingField(null);
        }
    };

    // Handle saving a field when it loses focus
    const handleFieldBlur = async (fieldId) => {
        if (!editingValue && editingValue !== '') {
            setEditingFieldId(null);
            return;
        }

        // Check if value actually changed
        const originalValue = getOriginalFieldValue(fieldId);
        if (editingValue === originalValue) {
            setEditingFieldId(null);
            return;
        }

        setSavingFieldId(fieldId);
        try {
            await updateXProfileField(fieldId, editingValue);

            // Refetch member data
            const data = await getMember(userId);
            try {
                const xprofileGroups = await getXProfileGroups(userId);
                data.xprofile = { groups: xprofileGroups };
            } catch (xprofileError) {
                console.log('XProfile fetch failed:', xprofileError);
            }
            setMember(data);
        } catch (error) {
            console.error('Error saving field:', error);
            Alert.alert('Błąd', 'Nie udało się zapisać zmiany');
        } finally {
            setSavingFieldId(null);
            setEditingFieldId(null);
        }
    };

    // Helper to get original field value
    const getOriginalFieldValue = (fieldId) => {
        if (!member?.xprofile?.groups) return '';
        for (const group of member.xprofile.groups) {
            for (const field of group.fields || []) {
                if (field.id === fieldId) {
                    return field.value?.raw ||
                        field.value?.rendered ||
                        field.data?.value?.raw ||
                        field.data?.value?.rendered ||
                        field.value ||
                        '';
                }
            }
        }
        return '';
    };

    // Navigate to message screen - check for existing conversation first
    const handleMessagePress = async () => {
        if (!member) return;

        setMessageLoading(true);
        try {
            // Fetch all threads to check for existing conversation
            const data = await getThreads(1, 50);
            const threadsArray = data.threads || data || [];
            const messagesArray = data.messages || [];
            const usersArray = data.users || [];

            // Convert users array to object
            const usersMap = {};
            usersArray.forEach(user => {
                usersMap[user.user_id] = user;
            });

            // Find existing thread with this user
            let existingThread = null;
            for (const thread of threadsArray) {
                const participants = thread.participants || [];
                for (const p of participants) {
                    const participantId = p.user_id || p;
                    if (parseInt(participantId) === parseInt(member.id)) {
                        existingThread = thread;
                        break;
                    }
                }
                if (existingThread) break;
            }

            if (existingThread) {
                // Navigate to existing ChatScreen
                const participantNames = existingThread.participants
                    ?.map(p => {
                        const pId = p.user_id || p;
                        if (userInfo?.id && pId == userInfo.id) return null;
                        return usersMap[pId]?.name || null;
                    })
                    .filter(Boolean)
                    .join(', ') || member.name;

                navigation.navigate('Chat', {
                    threadId: existingThread.thread_id,
                    allMessages: messagesArray,
                    users: usersMap,
                    title: participantNames
                });
            } else {
                // No existing conversation - open NewMessageScreen
                navigation.navigate('NewMessage', {
                    recipientId: member.id,
                    recipientName: member.name
                });
            }
        } catch (error) {
            console.error('Error checking conversations:', error);
            // Fallback to NewMessageScreen on error
            navigation.navigate('NewMessage', {
                recipientId: member.id,
                recipientName: member.name
            });
        } finally {
            setMessageLoading(false);
        }
    };

    if (loading) {
        return <View style={styles.center}><ActivityIndicator /></View>;
    }

    if (!member) {
        return <View style={styles.center}><Text style={{ color: colors.text }}>Member not found</Text></View>;
    }

    return (
        <>
            <ScrollView style={styles.container}>
                <View style={[styles.topBar, { marginTop: insets.top + 10 }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                        <Text style={[styles.backButtonText, { color: '#FFFFFF' }]}> Back</Text>
                    </TouchableOpacity>

                    {isOwnProfile && (
                        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
                            <Ionicons name="log-out-outline" size={24} color="#E74C3C" />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.header}>
                    <Image source={{ uri: member.hires_avatar?.large || member.hires_avatar?.full || member.avatar_urls?.full }} style={styles.avatar} />
                    <Text style={styles.name}>{member.name}</Text>
                    <Text style={styles.mention}>@{member.mention_name}</Text>

                    {userId !== 'me' && userId !== userInfo?.id && (
                        <TouchableOpacity
                            style={[styles.messageButton, messageLoading && styles.messageButtonDisabled]}
                            onPress={handleMessagePress}
                            disabled={messageLoading}
                        >
                            {messageLoading ? (
                                <ActivityIndicator size="small" color="#1C1C1E" style={styles.messageIcon} />
                            ) : (
                                <Ionicons name="chatbubble" size={20} color="#1C1C1E" style={styles.messageIcon} />
                            )}
                            <Text style={styles.messageButtonText}>Wyślij Wiadomość</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.contentContainer}>
                    {member.xprofile && member.xprofile.groups && member.xprofile.groups.map((group, index) => (
                        <View key={index} style={styles.group}>
                            <Text style={styles.groupName}>{group.name}</Text>
                            {group.fields && Array.isArray(group.fields) && group.fields.length > 0 ? (
                                group.fields.map((field, fIndex) => {
                                    // Extract value from various possible locations
                                    const fieldValue = field.value?.raw ||
                                        field.value?.rendered ||
                                        field.data?.value?.raw ||
                                        field.data?.value?.rendered ||
                                        field.value ||
                                        '';

                                    // Only show fields with non-empty values
                                    if (!fieldValue || fieldValue === '') {
                                        return null;
                                    }

                                    const isEditing = editingFieldId === field.id;
                                    const isSaving = savingFieldId === field.id;
                                    const fieldType = field.type?.name || field.type || 'textbox';

                                    return (
                                        <View key={fIndex} style={styles.field}>
                                            <View style={styles.fieldHeader}>
                                                <Text style={styles.label}>{field.name}</Text>
                                                {isSaving && (
                                                    <ActivityIndicator size="small" color="#2ECC71" />
                                                )}
                                            </View>
                                            {isEditing ? (
                                                <TextInput
                                                    style={styles.input}
                                                    value={editingValue}
                                                    onChangeText={setEditingValue}
                                                    onBlur={() => handleFieldBlur(field.id)}
                                                    autoFocus={true}
                                                    multiline={fieldType === 'textarea'}
                                                    placeholder={field.name}
                                                    placeholderTextColor="#999"
                                                />
                                            ) : (
                                                <TouchableOpacity
                                                    onPress={() => handleFieldPress(field, fieldValue)}
                                                    disabled={!isOwnProfile}
                                                    activeOpacity={isOwnProfile ? 0.7 : 1}
                                                >
                                                    <Text style={[
                                                        styles.value,
                                                        isOwnProfile && styles.editableValue
                                                    ]}>
                                                        {fieldValue}
                                                    </Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    );
                                })
                            ) : (
                                <Text style={styles.emptyText}>No information provided</Text>
                            )}
                        </View>
                    )
                    )}
                </View>
            </ScrollView>

            {/* Select Options Modal */}
            <Modal
                visible={showSelectModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowSelectModal(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowSelectModal(false)}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {currentEditingField?.name || 'Wybierz opcję'}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setShowSelectModal(false)}
                                style={styles.modalCloseButton}
                            >
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={selectOptions}
                            keyExtractor={(item) => item.key}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.optionItem,
                                        editingValue === item.value && styles.optionItemSelected
                                    ]}
                                    onPress={() => handleSelectOption(item)}
                                >
                                    <Text style={[
                                        styles.optionText,
                                        editingValue === item.value && styles.optionTextSelected
                                    ]}>
                                        {item.label}
                                    </Text>
                                    {editingValue === item.value && (
                                        <Ionicons name="checkmark" size={20} color="#E8B4B8" />
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </Pressable>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    // Base container - deep charcoal gradient feel
    container: {
        flex: 1,
        backgroundColor: '#0D0D0F'
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0D0D0F'
    },

    // Top navigation bar
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
    },
    backButtonText: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 6,
        color: '#FFFFFF',
    },
    logoutButton: {
        padding: 12,
        backgroundColor: 'rgba(231, 76, 60, 0.15)',
        borderRadius: 12,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 5,
        color: '#FF6B6B'
    },

    // Profile header section
    header: {
        alignItems: 'center',
        paddingVertical: 30,
        paddingHorizontal: 20,
    },
    avatar: {
        width: 130,
        height: 130,
        borderRadius: 65,
        marginBottom: 20,
        borderWidth: 4,
        borderColor: '#E8B4B8',
        shadowColor: '#E8B4B8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
    },
    name: {
        fontSize: 28,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    mention: {
        fontSize: 16,
        color: '#8E8E93',
        marginBottom: 10,
        fontWeight: '500',
    },

    // Message button with gradient effect
    messageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8B4B8',
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 30,
        marginTop: 20,
        shadowColor: '#E8B4B8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8,
    },
    messageIcon: { marginRight: 10 },
    messageButtonDisabled: { opacity: 0.6 },
    messageButtonText: {
        color: '#1C1C1E',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },

    // Content area
    contentContainer: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },

    // Premium glassmorphism cards
    group: {
        marginBottom: 20,
        backgroundColor: 'rgba(28, 28, 30, 0.95)',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 6,
    },
    groupName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#E8B4B8',
        marginBottom: 18,
        letterSpacing: 2,
        textTransform: 'uppercase',
    },

    // Field styling
    field: {
        marginBottom: 18,
        paddingBottom: 18,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    },
    label: {
        fontSize: 11,
        color: '#6E6E73',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        fontWeight: '600',
    },
    value: {
        fontSize: 17,
        color: '#FFFFFF',
        fontWeight: '500',
        lineHeight: 24,
    },
    editableValue: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    emptyText: {
        fontStyle: 'italic',
        color: '#48484A',
        fontSize: 15,
    },
    fieldHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },

    // Input styling for editing
    input: {
        fontSize: 17,
        color: '#FFFFFF',
        fontWeight: '500',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        padding: 14,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E8B4B8',
        minHeight: 48,
    },

    // Premium dark modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1C1C1E',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '65%',
        paddingBottom: 40,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    modalCloseButton: {
        padding: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 20,
    },
    optionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    optionItemSelected: {
        backgroundColor: 'rgba(232, 180, 184, 0.12)',
    },
    optionText: {
        fontSize: 16,
        color: '#EBEBF5',
        fontWeight: '500',
    },
    optionTextSelected: {
        color: '#E8B4B8',
        fontWeight: '700',
    },
});

export default ProfileScreen;
