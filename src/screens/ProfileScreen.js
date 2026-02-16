
import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, ScrollView, Alert, TextInput, Modal, FlatList, Pressable, Linking, Dimensions, TouchableOpacity, Switch } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getMember, updateXProfileField, updateMemberName, deleteAccount, getXProfileGroups, updateOnboarding, updatePreference } from '../api/members';
import DateTimePicker from '@react-native-community/datetimepicker';
import { addSkippedUser } from '../api/skipped';
import { getThreads, allowChat } from '../api/messages';
import { getSuperMessageStatus } from '../api/superMessages';
import { AuthContext } from '../context/AuthContext';
import { useTheme, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import SuperMessageModal from '../components/SuperMessageModal';
import HeartLoader from '../components/HeartLoader';

const ProfileScreen = ({ route }) => {
    const { userInfo, logout, updateUserInfo, userToken, deleteAccount } = useContext(AuthContext);
    const [member, setMember] = useState(null);
    const [loading, setLoading] = useState(true);
    const [messageLoading, setMessageLoading] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [editingFieldId, setEditingFieldId] = useState(null);
    const [editingValue, setEditingValue] = useState('');
    const editingValueRef = useRef('');
    const [savingFieldId, setSavingFieldId] = useState(null);
    const [showSelectModal, setShowSelectModal] = useState(false);
    const [selectOptions, setSelectOptions] = useState([]);
    const [currentEditingField, setCurrentEditingField] = useState(null);
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [isPremium, setIsPremium] = useState(false);
    const [showSuperMessageModal, setShowSuperMessageModal] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isSwappingAvatar, setIsSwappingAvatar] = useState(false);
    const [showGalleryPicker, setShowGalleryPicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [dateFieldId, setDateFieldId] = useState(null);
    const [updatingPreference, setUpdatingPreference] = useState(false);
    const { colors } = useTheme();

    const userId = route?.params?.userId || userInfo?.id || 'me';
    const isOwnProfile = userId === 'me' || String(userId) === String(userInfo?.id);
    const isAdmin = userInfo?.roles?.includes('administrator') || userInfo?.roles?.includes('editor');

    useEffect(() => {
        const checkPremiumStatus = async () => {
            try {
                const status = await getSuperMessageStatus();
                setIsPremium(status?.is_premium ?? false);
            } catch (error) {
                console.log('Could not check premium status');
            }
        };
        checkPremiumStatus();
    }, []);

    useEffect(() => {
        const fetchMember = async () => {
            setLoading(true);
            try {
                const data = await getMember(userId);

                // Ensure field 129 (Gender) hack if needed
                if (isOwnProfile && data.xprofile?.groups?.length > 0) {
                    // (keeping existing hack for now if it helps)
                }
                setMember(data);
            } catch (error) {
                console.error('Error fetching member:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchMember();
    }, [userId]);

    // Data extractor for badges/pills
    const getBadgeVal = (fieldId) => {
        const idToKey = {
            346: 'faith', 133: 'faith',
            351: 'politics', 215: 'politics',
            356: 'work', 108: 'work',
            362: 'diet', 334: 'diet',
            303: 'zodiac_sign'
        };
        const key = idToKey[fieldId];
        if (key && member?.[key]) return member[key];
        if (!member?.xprofile?.groups) return null;
        for (const group of member.xprofile.groups) {
            for (const field of group.fields || []) {
                if (field.id == fieldId) {
                    return field.value?.raw || field.value?.rendered || field.value || null;
                }
            }
        }
        return null;
    };

    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    // Handle clicking on a field to edit
    const handleFieldPress = (field, currentValue) => {
        if (!isOwnProfile) return;

        const fieldType = field.type?.name || field.type || 'textbox';

        const fieldOptions = field.options || field.type?.options || [];
        const isSelectType = ['selectbox', 'radio', 'multiselectbox', 'checkbox'].includes(fieldType);

        // Handle date fields specially
        if (fieldType === 'datebox') {
            const isBirthDate = field.name?.toLowerCase().includes('urodzenia') ||
                field.name?.toLowerCase().includes('birth') ||
                field.name?.toLowerCase().includes('urodzin');

            if (isBirthDate) {
                Alert.alert(
                    'Informacja',
                    'Daty urodzenia nie można zmienić samodzielnie. Jeśli popełniłeś błąd, skontaktuj się z administratorem.'
                );
                return;
            }

            // Lock Gender (129) and Name fields for non-admins
            const isRestrictedField = field.id == 129 ||
                field.name?.toLowerCase().includes('imię') ||
                field.name?.toLowerCase().includes('name');

            if (isRestrictedField && !isAdmin) {
                Alert.alert(
                    'Informacja',
                    'Tego pola nie można zmienić samodzielnie. Jeśli chcesz je poprawić, skontaktuj się z administratorem.'
                );
                return;
            }

            // Parse existing date or use current date
            const existingDate = currentValue ? new Date(currentValue) : new Date();
            setSelectedDate(isNaN(existingDate.getTime()) ? new Date() : existingDate);
            setDateFieldId(field.id);
            setShowDatePicker(true);
            return;
        }

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
        } else if (field.id == 129) {
            // Force options for Gender if not provided
            const options = [
                { key: '1', label: 'Kobieta', value: 'Kobieta' },
                { key: '2', label: 'Mężczyzna', value: 'Mężczyzna' }
            ];
            setSelectOptions(options);
            setCurrentEditingField(field);
            setEditingValue(currentValue);
            setShowSelectModal(true);
            return;
        } else {
            // Use TextInput for text fields
            setEditingFieldId(field.id);
            setEditingValue(currentValue);
            editingValueRef.current = currentValue;
        }
    };

    // Handle selecting an option from modal
    const handleSelectOption = async (option) => {
        if (!currentEditingField) return;

        setShowSelectModal(false);
        setSavingFieldId(currentEditingField.id);

        try {
            const result = await updateXProfileField(currentEditingField.id, option.value);

            // Update local state immediately with the updated value from server
            const newValue = result.value || option.value;
            setMember(prev => {
                const newMember = { ...prev };
                if (newMember.xprofile && newMember.xprofile.groups) {
                    newMember.xprofile.groups = newMember.xprofile.groups.map(group => ({
                        ...group,
                        fields: group.fields?.map(f =>
                            f.id === currentEditingField.id ? { ...f, value: { ...f.value, raw: newValue, rendered: newValue } } : f
                        )
                    }));
                }
                return newMember;
            });

            // Refetch in background to stay in sync with everything else
            getMember(userId).then(data => {
                getXProfileGroups(userId).then(groups => {
                    data.xprofile = { groups };
                    setMember(data);
                }).catch(() => setMember(data));
            }).catch(e => console.log('Background refetch failed:', e));

            // If gender (129) was changed, update AuthContext userInfo
            if (currentEditingField.id == 129) {
                updateUserInfo({ gender: option.value });
            }
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
        const valToSave = editingValueRef.current;

        if (!valToSave && valToSave !== '') {
            setEditingFieldId(null);
            return;
        }

        // Check if fieldId matches what we were actually editing to prevent race conditions
        if (editingFieldId && String(editingFieldId) !== String(fieldId)) {
            // This can happen if user clicks another field quickly
            // We should still try to save if we have a valueRef, but use fieldId
        }

        // Check if value actually changed
        const originalValue = getOriginalFieldValue(fieldId);
        if (valToSave === originalValue) {
            setEditingFieldId(null);
            return;
        }

        setSavingFieldId(fieldId);
        try {
            const result = await updateXProfileField(fieldId, valToSave);

            // Update local state immediately
            const newValue = result.value || valToSave;
            setMember(prev => {
                const newMember = { ...prev };
                if (newMember.xprofile && newMember.xprofile.groups) {
                    newMember.xprofile.groups = newMember.xprofile.groups.map(group => ({
                        ...group,
                        fields: group.fields?.map(f =>
                            String(f.id) === String(fieldId) ? { ...f, value: { ...f.value, raw: newValue, rendered: newValue } } : f
                        )
                    }));
                }
                return newMember;
            });

            // Refetch in background
            getMember(userId).then(data => {
                getXProfileGroups(userId).then(groups => {
                    data.xprofile = { groups };
                    setMember(data);
                }).catch(() => setMember(data));
            }).catch(e => console.log('Background refetch failed:', e));

            // If gender (129) was changed, update AuthContext userInfo
            if (fieldId == 129) {
                updateUserInfo({ gender: valToSave });
            }
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



    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Błąd', 'Potrzebujemy dostępu do galerii zdjęć, aby dodać zdjęcia do profilu.');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            uploadPhoto(result.assets[0]);
        }
    };

    const uploadPhoto = async (photoAsset) => {
        setIsUploading(true);
        try {
            const data = new FormData();

            // Find the next slot (1-6)
            const currentGalleryCount = member.gallery?.length || 0;
            const nextSlot = currentGalleryCount + 1;

            if (nextSlot > 6) {
                Alert.alert('Limit zdjęć', 'Możesz mieć maksymalnie 6 zdjęć (wliczając profilowe).');
                setIsUploading(false);
                return;
            }

            const uriParts = photoAsset.uri.split('.');
            const fileType = uriParts[uriParts.length - 1];
            data.append(`photo_${nextSlot}`, {
                uri: photoAsset.uri,
                name: `photo_${nextSlot}.${fileType}`,
                type: `image/${fileType}`,
            });

            const result = await updateOnboarding(data);
            if (result.success) {
                // Refetch member data
                const updatedData = await getMember(userId);
                setMember(updatedData);
                if (isOwnProfile) {
                    updateUserInfo({
                        avatar_urls: updatedData.avatar_urls,
                        hires_avatar: updatedData.hires_avatar
                    });
                }
            } else {
                Alert.alert('Błąd', 'Nie udało się przesłać zdjęcia.');
            }
        } catch (error) {
            console.error('Upload photo error:', error);
            Alert.alert('Błąd', 'Wystąpił błąd podczas przesyłania zdjęcia.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSetAvatar = async (photoId) => {
        try {
            setIsSwappingAvatar(true);
            const formData = new FormData();
            formData.append('set_avatar_id', photoId);

            await updateOnboarding(formData);

            // Refresh member data
            const data = await getMember(userId);
            setMember(data);
            if (isOwnProfile) {
                updateUserInfo({
                    avatar_urls: data.avatar_urls,
                    hires_avatar: data.hires_avatar
                });
            }
            setShowGalleryPicker(false);
        } catch (error) {
            console.error('Error swapping avatar:', error);
            Alert.alert("Error", "Failed to change profile picture.");
        } finally {
            setIsSwappingAvatar(false);
        }
    };

    const handleDeletePhoto = async (photoId) => {
        Alert.alert(
            "Delete photo",
            "Are you sure you want to delete this photo from your gallery?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setIsUploading(true);
                            // We use updateOnboarding for photo deletion as well, similar to Empaths
                            const formData = new FormData();
                            formData.append('delete_photo_id', photoId);

                            await updateOnboarding(formData);

                            // Refresh profile data
                            const updatedData = await getMember(userId);
                            setMember(updatedData);

                            Alert.alert("Success", "Photo deleted.");
                        } catch (error) {
                            console.error('Error deleting photo:', error);
                            Alert.alert("Error", "Failed to delete photo.");
                        } finally {
                            setIsUploading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleAllowChat = async () => {
        if (!member || messageLoading) return;

        try {
            setMessageLoading(true);
            const action = 'allow'; // No longer revoking from UI

            // Optimistic update
            setMember(prev => ({
                ...prev,
                chat_allowed_by_me: true
            }));

            const result = await allowChat(member.id, action);

            if (!result || !result.success) {
                // Revert if failed
                setMember(prev => ({
                    ...prev,
                    chat_allowed_by_me: false
                }));
                Alert.alert('Błąd', 'Nie udało się zmienić uprawnień rozmowy.');
            } else {
                // Success - ensure state matches result if returned
                if (result.chat_allowed !== undefined) {
                    setMember(prev => ({
                        ...prev,
                        chat_allowed_by_me: result.chat_allowed
                    }));
                }

                // Show correct message
                Alert.alert('Sukces', `Pozwoliłaś użytkownikowi ${member.name} na rozmowę.`);
            }
        } catch (error) {
            console.log('Error allowing/revoking chat:', error);
            setMember(prev => ({
                ...prev,
                chat_allowed_by_me: !prev.chat_allowed_by_me // Revert
            }));
            Alert.alert('Błąd', 'Wystąpił problem podczas komunikacji z serwerem.');
        } finally {
            setMessageLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        Alert.alert(
            "Usuń konto",
            "Czy na pewno chcesz usunąć konto? Tej operacji nie można cofnąć.",
            [
                { text: "Anuluj", style: "cancel" },
                {
                    text: "Usuń",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const result = await deleteAccount();
                            if (result.success) {
                                // Context handles navigation state via token clear
                            } else {
                                Alert.alert("Błąd", result.error);
                            }
                        } catch (error) {
                            console.error('Delete error:', error);
                            Alert.alert("Błąd", "Wystąpił problem podczas usuwania konta.");
                        }
                    }
                }
            ]
        );
    };

    const handleBlockPress = () => {
        if (!member) return;
        Alert.alert(
            'Zablokuj użytkownika',
            `Czy na pewno chcesz zablokować użytkownika ${member.name}? Nie będziesz już widzieć tej osoby, a ona nie będzie mogła się z Tobą kontaktować.`,
            [
                { text: 'Anuluj', style: 'cancel' },
                {
                    text: 'Zablokuj',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await addSkippedUser(member.id);
                            Alert.alert('Sukces', 'Użytkownik został zablokowany.');
                            navigation.goBack();
                        } catch (error) {
                            console.error('Failed to block user:', error);
                            Alert.alert('Błąd', 'Nie udało się zablokować użytkownika.');
                        }
                    }
                }
            ]
        );
    };

    const handlePreferenceToggle = async (key, currentValue) => {
        if (updatingPreference) return;

        setUpdatingPreference(true);
        const newValue = !currentValue;

        try {
            await updatePreference(key, newValue);
            // Update local state
            setMember(prev => ({
                ...prev,
                [key.replace('sk_', '')]: newValue
            }));
        } catch (error) {
            console.error('Failed to update preference:', error);
            Alert.alert('Błąd', 'Nie udało się zapisać ustawień prywatności.');
        } finally {
            setUpdatingPreference(false);
        }
    };

    const getGender = (user) => {
        if (!user || !user.xprofile || !user.xprofile.groups) return null;
        for (const group of user.xprofile.groups) {
            if (group.fields) {
                const fields = Array.isArray(group.fields) ? group.fields : Object.values(group.fields);
                for (const field of fields) {
                    if (field.id == 129) {
                        return field.value?.raw || field.value?.rendered || field.value;
                    }
                }
            }
        }
        return null;
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <HeartLoader size={80} color="#FF6B9D" />
            </View>
        );
    }

    if (!member) {
        return <View style={styles.center}><Text style={{ color: colors.text }}>Member not found</Text></View>;
    }

    return (
        <>
            <ScrollView style={styles.container}>
                <View style={[styles.topBar, { paddingTop: insets.top, paddingBottom: 5 }]}>
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
                    <View style={styles.avatarContainer}>
                        <Image source={{ uri: member.hires_avatar?.large || member.hires_avatar?.full || member.avatar_urls?.full }} style={styles.avatar} />
                        {isOwnProfile && (
                            <TouchableOpacity
                                style={styles.changeAvatarButton}
                                onPress={() => setShowGalleryPicker(true)}
                            >
                                <Ionicons name="camera" size={14} color="#FFFFFF" />
                                <Text style={styles.changeAvatarText}>Zmień</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text style={styles.name}>{member.name}</Text>
                    {/* <Text style={styles.mention}>@{member.mention_name}</Text> */}

                    {/* Profile Badges (Pills) */}
                    <View style={styles.profileTagsContainer}>
                        {getBadgeVal(303) ? (
                            <View style={[styles.profileTag, styles.zodiacTag]}>
                                <Text style={styles.profileTagText}>{getBadgeVal(303)}</Text>
                            </View>
                        ) : null}
                        {getBadgeVal(346) ? (
                            <View style={styles.profileTag}>
                                <Text style={styles.profileTagText}>{getBadgeVal(346)}</Text>
                            </View>
                        ) : null}
                        {getBadgeVal(351) ? (
                            <View style={styles.profileTag}>
                                <Text style={styles.profileTagText}>{getBadgeVal(351)}</Text>
                            </View>
                        ) : null}
                        {getBadgeVal(356) ? (
                            <View style={styles.profileTag}>
                                <Text style={styles.profileTagText}>{getBadgeVal(356)}</Text>
                            </View>
                        ) : null}
                        {getBadgeVal(362) ? (
                            <View style={styles.profileTag}>
                                <Text style={styles.profileTagText}>{getBadgeVal(362)}</Text>
                            </View>
                        ) : null}
                    </View>


                    {userId !== 'me' && userId !== userInfo?.id && member.is_matched && (
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

                    {!isOwnProfile && isPremium && (
                        <TouchableOpacity
                            style={[styles.messageButton, styles.superMessageButton]}
                            onPress={() => setShowSuperMessageModal(true)}
                        >
                            <Ionicons name="mail" size={20} color="#FFD700" style={styles.messageIcon} />
                            <Text style={styles.superMessagePremiumLabel}>SUPERMSG</Text>
                        </TouchableOpacity>
                    )}

                    {!isOwnProfile && userInfo?.gender?.toLowerCase() === 'kobieta' && getGender(member)?.toLowerCase() === 'mężczyzna' && (
                        <TouchableOpacity
                            style={[
                                styles.messageButton,
                                styles.allowChatButtonHeader,
                                member.chat_allowed_by_me && styles.allowChatButtonHeaderEnabled
                            ]}
                            onPress={handleAllowChat}
                            disabled={messageLoading || member.chat_allowed_by_me}
                        >
                            {messageLoading ? (
                                <ActivityIndicator size="small" color={member.chat_allowed_by_me ? "#2ECC71" : "#808000"} style={styles.messageIcon} />
                            ) : (
                                <View style={styles.iconContainer}>
                                    <Ionicons
                                        name={member.chat_allowed_by_me ? "checkmark-circle" : "chatbubble-ellipses-outline"}
                                        size={24}
                                        color={member.chat_allowed_by_me ? "#2ECC71" : "#808000"}
                                        style={styles.messageIcon}
                                    />
                                </View>
                            )}
                            <Text style={[
                                styles.allowChatButtonTextHeader,
                                member.chat_allowed_by_me && { color: '#2ECC71' }
                            ]}>
                                {member.chat_allowed_by_me ? 'Wysłano pozwolenie na rozmowę' : 'Pozwól porozmawiać'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {(member.gallery?.length > 0 || isOwnProfile) && (
                    <View style={styles.galleryContainer}>
                        <View style={styles.galleryHeader}>
                            <Text style={styles.groupName}>Galeria zdjęć</Text>
                            {isUploading && (
                                <ActivityIndicator size="small" color="#E8B4B8" style={{ marginLeft: 10, marginBottom: 18 }} />
                            )}
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryScroll}>
                            {member.gallery?.map((photo, index) => (
                                <View key={index} style={styles.galleryItemWrapper}>
                                    <TouchableOpacity
                                        onPress={() => setSelectedPhoto(photo.full || photo.url)}
                                        style={styles.galleryItem}
                                    >
                                        <Image source={{ uri: photo.url }} style={styles.galleryImage} />
                                    </TouchableOpacity>
                                    {isOwnProfile && (
                                        <View style={{ position: 'absolute', right: 5, top: 5 }}>
                                            <TouchableOpacity
                                                style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 15, padding: 5 }}
                                                onPress={() => handleDeletePhoto(photo.id)}
                                            >
                                                <Ionicons name="close-circle" size={20} color="#FF6B6B" />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            ))}
                            {isOwnProfile && (member.gallery?.length || 0) < 5 && (
                                <TouchableOpacity
                                    style={[styles.galleryItem, styles.addPhotoButton]}
                                    onPress={handlePickImage}
                                    disabled={isUploading}
                                >
                                    <Ionicons name="add" size={32} color="#E8B4B8" />
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    </View>
                )}

                <View style={styles.contentContainer}>
                    {/* Hero Description Section */}
                    {(() => {
                        if (!member?.xprofile?.groups) return null;
                        let descField = null;
                        for (const group of member.xprofile.groups) {
                            for (const field of group.fields || []) {
                                const name = (field.name || '').toLowerCase();
                                const type = (field.type?.name || field.type || '').toLowerCase();
                                if (type === 'textarea' || name.includes('o mnie') || name.includes('opis') || name.includes('bio')) {
                                    descField = field;
                                    break;
                                }
                            }
                            if (descField) break;
                        }

                        if (!descField) return null;

                        const fieldValue = descField.value?.raw || descField.value?.rendered || descField.value || '';
                        const isEditing = editingFieldId == descField.id;
                        const isSaving = savingFieldId == descField.id;

                        if (!isOwnProfile && !fieldValue) return null;

                        return (
                            <View style={[styles.group, styles.descriptionGroup]}>
                                <View style={styles.fieldHeader}>
                                    <View>
                                        <Text style={styles.groupName}>{descField.name}</Text>
                                        {!fieldValue && isOwnProfile && (
                                            <Text style={styles.promptText}>Dodaj opis, aby inni mogli Cię lepiej poznać!</Text>
                                        )}
                                    </View>
                                    {isSaving && <ActivityIndicator size="small" color="#2ECC71" />}
                                </View>

                                {isEditing ? (
                                    <TextInput
                                        style={[styles.input, styles.descriptionInput]}
                                        value={editingValue}
                                        onChangeText={(text) => {
                                            setEditingValue(text);
                                            editingValueRef.current = text;
                                        }}
                                        onBlur={() => handleFieldBlur(descField.id)}
                                        autoFocus={true}
                                        multiline={true}
                                        numberOfLines={10}
                                        blurOnSubmit={false}
                                        placeholder="Opisz siebie..."
                                        placeholderTextColor="#999"
                                    />
                                ) : (
                                    <TouchableOpacity
                                        onPress={() => handleFieldPress(descField, fieldValue)}
                                        disabled={!isOwnProfile}
                                        activeOpacity={isOwnProfile ? 0.7 : 1}
                                    >
                                        <Text style={[
                                            styles.descriptionValue,
                                            isOwnProfile && styles.editableDescriptionValue,
                                            !fieldValue && { fontStyle: 'italic', color: '#6E6E73' }
                                        ]}>
                                            {fieldValue || 'Brak opisu...'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })()}


                    {member.xprofile && member.xprofile.groups && member.xprofile.groups.map((group, index) => {
                        // Hide "Base" group for regular users
                        const gName = (group.name || '').toLowerCase();
                        const isBaseGroup = gName.includes('base') || gName.includes('podstawowe');
                        if (isBaseGroup && !isAdmin && !isOwnProfile) return null;

                        return (
                            <View key={index} style={styles.group}>
                                <Text style={styles.groupName}>{group.name}</Text>
                                {group.fields && Array.isArray(group.fields) && group.fields.length > 0 ? (
                                    group.fields.filter(f => {
                                        const isSpecialField = [303, 346, 351, 356, 362, 133, 215, 108, 334].includes(parseInt(f.id));
                                        const fieldName = (f.name || '').toLowerCase();
                                        const isDescription = (f.type?.name || f.type || '').toLowerCase() === 'textarea' ||
                                            fieldName.includes('o mnie') || fieldName.includes('opis') || fieldName.includes('bio');

                                        // Hide special fields (pills) and the hero description from the general list
                                        if (isDescription) return false;

                                        // Hide Name, Gender, and Birth Date for regular users
                                        // Name is in header, specific fields are restricted
                                        const isRestricted = (
                                            fieldName.includes('imię') ||
                                            fieldName.includes('name') ||
                                            f.id == 129 ||
                                            f.id == 107 ||
                                            fieldName.includes('urodzenia') ||
                                            fieldName.includes('birth') ||
                                            fieldName.includes('szukam')
                                        );

                                        if (isRestricted && !isAdmin && !isOwnProfile) {
                                            return false;
                                        }

                                        // if (isSpecialField && !isOwnProfile) {
                                        //    return false;
                                        // }
                                        return true;
                                    }).map((field, fIndex) => {
                                        // Extract value from various possible locations
                                        const fieldValue = field.value?.raw ||
                                            field.value?.rendered ||
                                            field.data?.value?.raw ||
                                            field.data?.value?.rendered ||
                                            field.value ||
                                            '';


                                        // Only show fields with non-empty values,
                                        // unless it's our own profile so we can fill them in
                                        const showAnyway = isOwnProfile;
                                        if ((!fieldValue || fieldValue === '') && !showAnyway) {
                                            return null;
                                        }

                                        const isEditing = editingFieldId === field.id;
                                        const isSaving = savingFieldId === field.id;
                                        const fieldType = field.type?.name || field.type || 'textbox';

                                        const isBirthDate = fieldType === 'datebox' && (
                                            field.name?.toLowerCase().includes('urodzenia') ||
                                            field.name?.toLowerCase().includes('birth') ||
                                            field.name?.toLowerCase().includes('urodzin')
                                        );
                                        const canEditToggle = isOwnProfile && !isBirthDate;

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
                                                        onChangeText={(text) => {
                                                            setEditingValue(text);
                                                            editingValueRef.current = text;
                                                        }}
                                                        onBlur={() => handleFieldBlur(field.id)}
                                                        autoFocus={true}
                                                        multiline={fieldType === 'textarea'}
                                                        placeholder={field.name}
                                                        placeholderTextColor="#999"
                                                    />
                                                ) : (
                                                    <TouchableOpacity
                                                        onPress={() => handleFieldPress(field, fieldValue)}
                                                        disabled={!canEditToggle}
                                                        activeOpacity={canEditToggle ? 0.7 : 1}
                                                    >
                                                        <Text style={[
                                                            styles.value,
                                                            canEditToggle && styles.editableValue
                                                        ]}>
                                                            {fieldType === 'datebox' && fieldValue
                                                                ? new Date(fieldValue).toLocaleDateString('pl-PL')
                                                                : fieldValue}
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
                    })}

                    {isOwnProfile && (
                        <View style={[styles.group, { borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)', paddingTop: 24, marginTop: 10 }]}>
                            <Text style={styles.groupName}>Prywatność</Text>
                            <View style={styles.fieldItem}>
                                <View style={styles.fieldInfo}>
                                    <Text style={styles.fieldName}>Ukryj mój wiek</Text>
                                    <Text style={styles.fieldValueText}>
                                        {member.hide_age ? 'Wiek nie jest widoczny dla innych' : 'Wiek jest widoczny publicznie'}
                                    </Text>
                                </View>
                                <Switch
                                    value={!!member.hide_age}
                                    onValueChange={() => handlePreferenceToggle('sk_hide_age', !!member.hide_age)}
                                    trackColor={{ false: "#3A3A3C", true: "#2ECC71" }}
                                    thumbColor="#FFFFFF"
                                    disabled={updatingPreference}
                                />
                            </View>
                        </View>
                    )}

                    {/* Contact / Feedback Section */}
                    {isOwnProfile && (
                        <View style={styles.group}>
                            <Text style={styles.groupName}>Wsparcie i Kontakt</Text>
                            <TouchableOpacity
                                style={styles.contactButton}
                                onPress={() => {
                                    const subject = `Feedback Prawdziwa Miłość(User: ${member.id})`;
                                    const body = `Cześć, \n\nChciałbym zgłosić następujący feedback: \n\n`;
                                    const mailUrl = `mailto:admin@prawdziwamilosc.pl?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

                                    Linking.canOpenURL(mailUrl)
                                        .then(supported => {
                                            if (supported) {
                                                Linking.openURL(mailUrl);
                                            } else {
                                                Alert.alert('Błąd', 'Nie znaleziono aplikacji pocztowej. Napisz na: admin@prawdziwamilosc.pl');
                                            }
                                        })
                                        .catch(err => console.error('An error occurred', err));
                                }}
                            >
                                <Ionicons name="mail-outline" size={22} color="#FFFFFF" style={{ marginRight: 12 }} />
                                <Text style={styles.contactButtonText}>Napisz do nas / Zgłoś błąd</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Legal Section - App Store Requirement */}
                    {isOwnProfile && (
                        <View style={styles.group}>
                            <Text style={styles.groupName}>Informacje Prawne</Text>

                            <TouchableOpacity
                                style={[styles.contactButton, { marginBottom: 12 }]}
                                onPress={() => Linking.openURL('https://prawdziwamilosc.pl/polityka-prywatnosci.html')}
                            >
                                <Ionicons name="shield-checkmark-outline" size={22} color="#FFFFFF" style={{ marginRight: 12 }} />
                                <Text style={styles.contactButtonText}>Polityka Prywatności</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.contactButton, { marginBottom: 12 }]}
                                onPress={() => Linking.openURL('https://prawdziwamilosc.pl/regulamin.html')}
                            >
                                <Ionicons name="document-text-outline" size={22} color="#FFFFFF" style={{ marginRight: 12 }} />
                                <Text style={styles.contactButtonText}>Regulamin</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.contactButton}
                                onPress={() => Linking.openURL('https://prawdziwamilosc.pl/wytyczne.html')}
                            >
                                <Ionicons name="people-outline" size={22} color="#FFFFFF" style={{ marginRight: 12 }} />
                                <Text style={styles.contactButtonText}>Wytyczne dla Społeczności</Text>
                            </TouchableOpacity>
                        </View>
                    )}



                    {/* Safety Section - Report & Block (For Other Users) */}
                    {!isOwnProfile && (
                        <View style={styles.group}>
                            <Text style={styles.groupName}>Bezpieczeństwo</Text>

                            <TouchableOpacity
                                style={[styles.contactButton, { marginBottom: 12 }]}
                                onPress={() => {
                                    const subject = `ZGŁOSZENIE UŻYTKOWNIKA(ID: ${member.id})`;
                                    const body = `Zgłaszam użytkownika ${member.name} (ID: ${member.id}) z powodu: \n\n`;
                                    const mailUrl = `mailto:admin@prawdziwamilosc.pl?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

                                    Linking.canOpenURL(mailUrl)
                                        .then(supported => {
                                            if (supported) {
                                                Linking.openURL(mailUrl);
                                            } else {
                                                Alert.alert('Błąd', 'Brak klienta poczty. Zgłoś na: admin@prawdziwamilosc.pl');
                                            }
                                        });
                                }}
                            >
                                <Ionicons name="flag-outline" size={22} color="#FFFFFF" style={{ marginRight: 12 }} />
                                <Text style={styles.contactButtonText}>Zgłoś użytkownika</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.contactButton, { borderColor: 'rgba(255, 59, 48, 0.3)', backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}
                                onPress={handleBlockPress}
                            >
                                <Ionicons name="ban-outline" size={22} color="#FF3B30" style={{ marginRight: 12 }} />
                                <Text style={[styles.contactButtonText, { color: '#FF3B30' }]}>Zablokuj użytkownika</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Delete Account Section - Required by Apple */}
                    {isOwnProfile && (
                        <View style={styles.dangerZone}>
                            <Text style={styles.dangerZoneTitle}>STREFA NIEBEZPIECZNA</Text>
                            <TouchableOpacity
                                style={[styles.deleteAccountButton, deletingAccount && { opacity: 0.6 }]}
                                disabled={deletingAccount}
                                onPress={() => {
                                    Alert.alert(
                                        'Usuń moje konto',
                                        'Czy na pewno chcesz usunąć swoje konto?\n\n⚠️ UWAGA: Ta operacja jest nieodwracalna!\n\nZostaną usunięte:\n• Wszystkie Twoje dane profilowe\n• Historia konwersacji i wiadomości\n• Polubienia i matche\n• Wszystkie przesłane zdjęcia\n\nNie będzie możliwości odzyskania tych danych.',
                                        [
                                            {
                                                text: 'Anuluj',
                                                style: 'cancel'
                                            },
                                            {
                                                text: 'Usuń konto',
                                                style: 'destructive',
                                                onPress: () => {
                                                    Alert.alert(
                                                        'Ostatnie potwierdzenie',
                                                        'Czy na pewno chcesz NIEODWRACALNIE usunąć swoje konto? Tej operacji nie można cofnąć.',
                                                        [
                                                            { text: 'Anuluj', style: 'cancel' },
                                                            {
                                                                text: 'TAK, USUŃ',
                                                                style: 'destructive',
                                                                onPress: async () => {
                                                                    setDeletingAccount(true);
                                                                    try {
                                                                        await deleteAccount();
                                                                        Alert.alert(
                                                                            'Konto usunięte',
                                                                            'Twoje konto zostało pomyślnie usunięte. Otrzymasz email z potwierdzeniem.',
                                                                            [{ text: 'OK', onPress: logout }]
                                                                        );
                                                                    } catch (error) {
                                                                        console.error('Delete account error:', error);
                                                                        Alert.alert(
                                                                            'Błąd',
                                                                            'Nie udało się usunąć konta. Spróbuj ponownie później lub skontaktuj się z pomocą techniczną.'
                                                                        );
                                                                        setDeletingAccount(false);
                                                                    }
                                                                }
                                                            }
                                                        ]
                                                    );
                                                }
                                            }
                                        ]
                                    );
                                }}
                            >
                                {deletingAccount ? (
                                    <ActivityIndicator size="small" color="#FF3B30" style={{ marginRight: 10 }} />
                                ) : (
                                    <Ionicons name="trash-outline" size={20} color="#FF3B30" style={{ marginRight: 10 }} />
                                )}
                                <Text style={styles.deleteAccountText}>
                                    {deletingAccount ? 'Usuwanie...' : 'Usuń moje konto'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View >
            </ScrollView >

            {showDatePicker && (
                <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="spinner"
                    maximumDate={new Date()} // Prevent future birth dates
                    onChange={(event, date) => {
                        setShowDatePicker(false);
                        if (event.type === 'set' && date) {
                            // Format: YYYY-MM-DD HH:mm:ss (BuddyPress expects this)
                            const formatted = date.toISOString().slice(0, 19).replace('T', ' ');
                            setSavingFieldId(dateFieldId);
                            updateXProfileField(dateFieldId, formatted)
                                .then(async () => {
                                    const data = await getMember(userId);
                                    setMember(data);
                                })
                                .catch(err => {
                                    console.error('Error saving date:', err);
                                    Alert.alert('Błąd', 'Nie udało się zapisać daty');
                                })
                                .finally(() => setSavingFieldId(null));
                        }
                    }}
                />
            )}

            {/* Select Options Modal */}
            < Modal
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
            </Modal >

            {/* Image Preview Modal */}
            <Modal
                visible={!!selectedPhoto}
                transparent={true}
                onRequestClose={() => setSelectedPhoto(null)}
            >
                <Pressable
                    style={styles.lightboxOverlay}
                    onPress={() => setSelectedPhoto(null)}
                >
                    <Ionicons name="close" size={32} color="#FFFFFF" style={styles.lightboxClose} />
                    {selectedPhoto && (
                        <Image
                            source={{ uri: selectedPhoto }}
                            style={styles.lightboxImage}
                            resizeMode="contain"
                        />
                    )}
                </Pressable>
            </Modal>

            {/* Gallery Picker Modal for Avatar */}
            <Modal
                visible={showGalleryPicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowGalleryPicker(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowGalleryPicker(false)}
                >
                    <Pressable
                        style={[styles.modalContent, { maxHeight: '75%' }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Wybierz zdjęcie profilowe</Text>
                            <TouchableOpacity
                                onPress={() => setShowGalleryPicker(false)}
                                style={styles.modalCloseButton}
                            >
                                <Ionicons name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        {isSwappingAvatar ? (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <ActivityIndicator size="large" color="#E8B4B8" />
                                <Text style={{ color: '#FFFFFF', marginTop: 10 }}>Zmieniam...</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={member.gallery || []}
                                keyExtractor={(item) => item.id.toString()}
                                numColumns={3}
                                contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.galleryPickerItem}
                                        onPress={() => handleSetAvatar(item.id)}
                                    >
                                        <Image
                                            source={{ uri: item.url }}
                                            style={styles.galleryPickerImage}
                                            resizeMode="cover"
                                        />
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={
                                    <View style={{ padding: 30, alignItems: 'center' }}>
                                        <Ionicons name="images-outline" size={48} color="rgba(255,255,255,0.2)" />
                                        <Text style={{ textAlign: 'center', color: '#8E8E93', marginTop: 12, lineHeight: 22 }}>
                                            Brak zdjęć w galerii. Dodaj zdjęcia poniżej, aby móc je ustawić jako profilowe.
                                        </Text>
                                    </View>
                                }
                            />
                        )}
                    </Pressable>
                </Pressable>
            </Modal>

            <SuperMessageModal
                visible={showSuperMessageModal}
                onClose={() => setShowSuperMessageModal(false)}
                recipientId={member?.id}
                recipientName={member?.name}
            />
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
        paddingVertical: 5,
        paddingHorizontal: 20,
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        marginBottom: 10,
        borderWidth: 3,
        borderColor: '#E8B4B8',
    },
    name: {
        fontSize: 28,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 0,
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
        marginTop: 10,
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
    superMessageButton: {
        backgroundColor: '#1a1a2e',
        borderWidth: 2,
        borderColor: '#FFD700',
        marginTop: 8,
    },
    superMessagePremiumLabel: {
        color: '#FFD700',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.5,
    },

    // Content area
    contentContainer: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 40,
    },

    // Premium glassmorphism cards
    group: {
        marginBottom: 16,
        backgroundColor: 'rgba(28, 28, 30, 0.95)',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    groupName: {
        fontSize: 12,
        fontWeight: '700',
        color: '#8E8E93',
        marginBottom: 12,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },

    // Field styling
    field: {
        marginBottom: 12,
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
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '500',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        padding: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E8B4B8',
        minHeight: 44,
    },
    descriptionInput: {
        minHeight: 200,
        textAlignVertical: 'top',
        paddingTop: 12,
        lineHeight: 22,
    },
    descriptionGroup: {
        marginBottom: 20,
    },
    descriptionValue: {
        fontSize: 16,
        color: '#EBEBF5',
        lineHeight: 24,
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    editableDescriptionValue: {
        borderStyle: 'dashed',
        borderColor: 'rgba(232, 180, 184, 0.3)',
    },
    promptText: {
        fontSize: 13,
        color: '#E8B4B8',
        opacity: 0.8,
        marginBottom: 4,
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

    // Danger Zone - Delete Account section
    dangerZone: {
        marginTop: 30,
        marginBottom: 20,
        backgroundColor: 'rgba(255, 59, 48, 0.08)',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 59, 48, 0.2)',
    },
    dangerZoneTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FF3B30',
        marginBottom: 15,
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    deleteAccountButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 59, 48, 0.15)',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 59, 48, 0.3)',
    },
    deleteAccountText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FF3B30',
    },
    contactButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    contactButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    // Gallery Styles
    galleryContainer: {
        paddingHorizontal: 16,
        marginTop: 8,
        marginBottom: 12,
    },
    galleryScroll: {
        paddingRight: 16,
        paddingTop: 4, // More padding to accommodate the delete icons hanging above the items
    },
    galleryItem: {
        width: 100,
        height: 125,
        marginRight: 0,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    galleryImage: {
        width: '100%',
        height: '100%',
    },
    galleryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    galleryItemWrapper: {
        position: 'relative',
        marginRight: 6,
    },
    deletePhotoButton: {
        position: 'absolute',
        top: -6,
        right: -6,
        zIndex: 20,
        backgroundColor: '#1A1A1A', // Dark background for contrast, matching app theme
        borderRadius: 13,
        padding: 0,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 8,
    },
    changeAvatarButton: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#E8B4B8',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#1C1C1E',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    changeAvatarText: {
        color: '#1C1C1E',
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    galleryPickerItem: {
        flex: 1 / 3,
        aspectRatio: 1,
        padding: 4,
    },
    galleryPickerImage: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
    },
    addPhotoButton: {
        justifyContent: 'center',
        alignItems: 'center',
        borderStyle: 'dashed',
        borderWidth: 2,
        borderColor: 'rgba(232, 180, 184, 0.5)',
        backgroundColor: 'rgba(232, 180, 184, 0.05)',
    },
    // Lightbox Styles
    lightboxOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    lightboxImage: {
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height * 0.8,
    },
    lightboxClose: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
    },
    allowChatButtonHeader: {
        backgroundColor: '#1A1A1A',
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 25,
        alignItems: 'center',
        marginTop: 8,
        width: '80%',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#D4AF37',
    },
    allowChatButtonTextHeader: {
        color: '#D4AF37',
        fontWeight: 'bold',
        fontSize: 15,
    },
    allowChatIconContainerHeader: {
        position: 'relative',
        marginRight: 10,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    allowChatCheckmarkHeader: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#fff',
        borderRadius: 6,
        padding: 1,
    },
    allowChatButtonHeaderEnabled: {
        borderColor: '#2ECC71',
        backgroundColor: 'rgba(46, 204, 113, 0.1)',
    },
    iconContainer: {
        position: 'relative',
        marginRight: 10,
    },
    greenBadgeBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#2ECC71',
        borderWidth: 1.5,
        borderColor: '#1A1A1A',
    },
    profileTagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 4,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    profileTag: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        marginRight: 6,
        marginBottom: 8,
    },
    profileTagText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500',
    },
    zodiacTag: {
        backgroundColor: 'rgba(212, 175, 55, 0.2)',
        borderColor: '#d4af37',
    },

    // Privacy Section Styling
    fieldItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 16,
        borderRadius: 14,
        marginTop: 8,
    },
    fieldInfo: {
        flex: 1,
        marginRight: 10,
    },
    fieldName: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    fieldValueText: {
        fontSize: 13,
        color: '#8E8E93',
        marginTop: 4,
    },
});

export default ProfileScreen;

