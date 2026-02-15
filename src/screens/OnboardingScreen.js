import React, { useState, useContext, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Image,
    Alert,
    ActivityIndicator,
    Dimensions,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../context/AuthContext';
import { updateOnboarding } from '../api/members';
import { useTheme } from '@react-navigation/native';
import * as ImageManipulator from 'expo-image-manipulator';

const { width } = Dimensions.get('window');

const OnboardingScreen = () => {
    const { userInfo, updateUserInfo } = useContext(AuthContext);
    const insets = useSafeAreaInsets();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Selection Modal State
    const [showSelectModal, setShowSelectModal] = useState(false);
    const [selectOptions, setSelectOptions] = useState([]);
    const [currentField, setCurrentField] = useState(null);

    const [formData, setFormData] = useState({
        dataurodzenia: '',
        plec: '',
        kogo_szukam: '',
        religia: '',
        polityka: '',
        praca: '',
        dieta: '',
    });
    const [photos, setPhotos] = useState([null, null, null, null, null, null]);

    useEffect(() => {
        if (userInfo) {
            // Fill initial data if exists
            const initialData = { ...formData };
            if (userInfo.gender) initialData.plec = userInfo.gender;
            // We could also pre-fill other fields if we had them in userInfo, 
            // but currently userInfo is mostly basic data.

            // Only update if actually different to avoid loop (though useEffect dep is userInfo)
            if (userInfo.gender && !formData.plec) {
                setFormData(prev => ({ ...prev, plec: userInfo.gender }));
            }
        }

        if (userInfo?.avatar_urls?.full && !photos[0]) {
            const avatarUrl = userInfo.avatar_urls.full;
            const newPhotos = [...photos];
            newPhotos[0] = { uri: avatarUrl, isRemote: true };
            setPhotos(newPhotos);
        }
    }, [userInfo]);

    const fieldOptions = {
        plec: ['Kobieta', 'Mężczyzna', 'Inna'],
        kogo_szukam: ['Kobiety', 'Mężczyzny', 'Wszystkich'],
        religia: ['Wierzący', 'Ateista', 'Duchowy', 'Inne'],
        polityka: ['Konserwatywne', 'Liberalne', 'Centrowe', 'Apolityczny'],
        praca: ['Korporacja', 'Własny Biznes', 'Normalna Praca', 'Praca Kreatywna', 'Nie pracuję'],
        dieta: ['Wszystkożerca', 'Wegetarianin', 'Weganin', 'Keto/Inne'],
    };

    const steps = [
        { title: 'Podstawowe informacje', icon: 'person-outline' },
        { title: 'Twój styl życia', icon: 'heart-outline' },
        { title: 'Twoje zdjęcia', icon: 'camera-outline' }
    ];

    const openSelect = (fieldKey, label) => {
        setCurrentField({ key: fieldKey, label });
        setSelectOptions(fieldOptions[fieldKey]);
        setShowSelectModal(true);
    };

    const handleSelectOption = (option) => {
        setFormData({ ...formData, [currentField.key]: option });
        setShowSelectModal(false);
    };

    const handleBirthdateChange = (text) => {
        // Remove non-numeric characters
        const cleaned = text.replace(/[^0-9]/g, '');
        let formatted = cleaned;

        if (cleaned.length > 4) {
            formatted = cleaned.slice(0, 4) + '-' + cleaned.slice(4);
        }
        if (cleaned.length > 6) {
            formatted = formatted.slice(0, 7) + '-' + cleaned.slice(6, 8);
        }

        setFormData({ ...formData, dataurodzenia: formatted });
    };

    // Helper function to compress image
    const compressImage = async (uri) => {
        try {
            const result = await ImageManipulator.manipulateAsync(
                uri,
                [], // No resizing, just compression/conversion
                { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
            );
            return result;
        } catch (error) {
            console.error("Image compression error:", error);
            // Fallback to original uri if manipulation fails
            return { uri };
        }
    };

    const pickImage = async (index) => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Błąd', 'Potrzebujemy dostępu do galerii zdjęć, aby dodać zdjęcia do profilu.');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const originalAsset = result.assets[0];

            // Compress/Convert to JPEG
            const compressed = await compressImage(originalAsset.uri);

            const newPhotos = [...photos];
            newPhotos[index] = {
                ...originalAsset,
                uri: compressed.uri // Update URI to the JPEG one
            };
            setPhotos(newPhotos);
        }
    };

    const handleNext = () => {
        if (step === 1) {
            const birthdateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!formData.dataurodzenia || !birthdateRegex.test(formData.dataurodzenia)) {
                Alert.alert('Błąd', 'Proszę wpisać poprawną datę urodzenia (RRRR-MM-DD).');
                return;
            }
            if (!formData.plec) {
                Alert.alert('Błąd', 'Proszę zaznaczyć swoją płeć.');
                return;
            }
            if (!formData.kogo_szukam) {
                Alert.alert('Błąd', 'Proszę wybrać kogo szukasz.');
                return;
            }
        }
        if (step === 3) {
            if (!photos[0]) {
                Alert.alert('Błąd', 'Musisz dodać przynajmniej jedno zdjęcie główne.');
                return;
            }
            submitOnboarding();
            return;
        }
        setStep(step + 1);
    };

    const submitOnboarding = async () => {
        setLoading(true);
        try {
            const data = new FormData();

            // Text fields
            Object.keys(formData).forEach(key => {
                if (formData[key]) data.append(key, formData[key]);
            });

            // Photos
            photos.forEach((photo, index) => {
                if (photo && !photo.isRemote) {
                    const uriParts = photo.uri.split('.');
                    const fileType = uriParts[uriParts.length - 1];
                    data.append(`photo_${index + 1}`, {
                        uri: photo.uri,
                        name: `photo_${index + 1}.${fileType}`,
                        type: `image/${fileType}`,
                    });
                }
            });

            const result = await updateOnboarding(data);
            if (result.success) {
                // Update local auth context and persist to AsyncStorage
                updateUserInfo({ onboardingComplete: true });
            }
        } catch (error) {
            console.error('Onboarding submission error:', error);
            Alert.alert('Błąd', 'Nie udało się zapisać danych. Spróbuj ponownie.');
        } finally {
            setLoading(false);
        }
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <Text style={styles.title}>Witaj, {userInfo?.displayName}!</Text>
            <Text style={styles.subtitle}>Poznajmy Cię lepiej, aby dopasować najlepsze profile.</Text>

            <View style={styles.stepIndicator}>
                {steps.map((s, i) => (
                    <View key={i} style={styles.stepWrapper}>
                        <View style={[
                            styles.stepIconContainer,
                            step > i + 1 && styles.stepComplete,
                            step === i + 1 && styles.stepActive
                        ]}>
                            {step > i + 1 ? (
                                <Ionicons name="checkmark" size={16} color="#1C1C1E" />
                            ) : (
                                <Ionicons name={s.icon} size={16} color={step === i + 1 ? '#1C1C1E' : '#8E8E93'} />
                            )}
                        </View>
                        {i < steps.length - 1 && (
                            <View style={[styles.stepLine, step > i + 1 && styles.stepLineActive]} />
                        )}
                    </View>
                ))}
            </View>
            <Text style={styles.stepTitle}>{steps[step - 1].title}</Text>
        </View>
    );

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <View style={styles.stepContent}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Data urodzenia (RRRR-MM-DD)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="1990-01-01"
                                placeholderTextColor="#555"
                                value={formData.dataurodzenia}
                                onChangeText={handleBirthdateChange}
                                keyboardType="numeric"
                                maxLength={10}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Płeć</Text>
                            <View style={styles.genderButtons}>
                                <TouchableOpacity
                                    style={[
                                        styles.genderButton,
                                        formData.plec === 'Kobieta' && styles.genderButtonSelected
                                    ]}
                                    onPress={() => setFormData({ ...formData, plec: 'Kobieta' })}
                                >
                                    <Text style={[
                                        styles.genderButtonText,
                                        formData.plec === 'Kobieta' && styles.genderButtonTextSelected
                                    ]}>
                                        Kobieta
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.genderButton,
                                        formData.plec === 'Mężczyzna' && styles.genderButtonSelected
                                    ]}
                                    onPress={() => setFormData({ ...formData, plec: 'Mężczyzna' })}
                                >
                                    <Text style={[
                                        styles.genderButtonText,
                                        formData.plec === 'Mężczyzna' && styles.genderButtonTextSelected
                                    ]}>
                                        Mężczyzna
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.genderButton,
                                        formData.plec === 'Inna' && styles.genderButtonSelected
                                    ]}
                                    onPress={() => setFormData({ ...formData, plec: 'Inna' })}
                                >
                                    <Text style={[
                                        styles.genderButtonText,
                                        formData.plec === 'Inna' && styles.genderButtonTextSelected
                                    ]}>
                                        Inna
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Kogo szukasz?</Text>
                            <TouchableOpacity
                                style={styles.selectInput}
                                onPress={() => openSelect('kogo_szukam', 'Kogo szukasz?')}
                            >
                                <Text style={[styles.selectInputText, !formData.kogo_szukam && { color: '#555' }]}>
                                    {formData.kogo_szukam || 'Wybierz opcję...'}
                                </Text>
                                <Ionicons name="chevron-down" size={20} color="#8E8E93" />
                            </TouchableOpacity>
                        </View>
                    </View>
                );
            case 2:
                return (
                    <View style={styles.stepContent}>
                        {[
                            { label: 'Podejście do wiary', key: 'religia' },
                            { label: 'Poglądy polityczne', key: 'polityka' },
                            { label: 'Styl pracy', key: 'praca' },
                            { label: 'Styl jedzenia', key: 'dieta' }
                        ].map((field) => (
                            <View key={field.key} style={styles.inputGroup}>
                                <Text style={styles.label}>{field.label}</Text>
                                <TouchableOpacity
                                    style={styles.selectInput}
                                    onPress={() => openSelect(field.key, field.label)}
                                >
                                    <Text style={[styles.selectInputText, !formData[field.key] && { color: '#555' }]}>
                                        {formData[field.key] || 'Wybierz opcję...'}
                                    </Text>
                                    <Ionicons name="chevron-down" size={20} color="#8E8E93" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                );
            case 3:
                return (
                    <View style={styles.stepContent}>
                        <Text style={styles.photoHint}>Dodaj do 6 zdjęć. Pierwsze będzie Twoim zdjęciem profilowym.</Text>
                        <View style={styles.photoGrid}>
                            {photos.map((photo, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[styles.photoBox, photo && styles.photoBoxFilled]}
                                    onPress={() => pickImage(index)}
                                >
                                    {photo ? (
                                        <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                                    ) : (
                                        <Ionicons name="add" size={32} color="#E8B4B8" />
                                    )}
                                    {index === 0 && <View style={styles.mainBadge}><Text style={styles.mainBadgeText}>Główne</Text></View>}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );
            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#1C1C1E', '#0D0D0F']}
                style={StyleSheet.absoluteFill}
            />
            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scroll}>
                    {renderHeader()}
                    {renderStepContent()}
                </ScrollView>

                <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
                    {step > 1 && (
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => setStep(step - 1)}
                            disabled={loading}
                        >
                            <Text style={styles.backButtonText}>Wstecz</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={[styles.nextButton, step === 1 && { width: '100%' }]}
                        onPress={handleNext}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#1C1C1E" />
                        ) : (
                            <>
                                <Text style={styles.nextButtonText}>
                                    {step === 3 ? 'Zakończ i zacznij szukać' : 'Dalej'}
                                </Text>
                                <Ionicons name="arrow-forward" size={20} color="#1C1C1E" style={{ marginLeft: 8 }} />
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {/* Select Options Modal */}
            <Modal
                visible={showSelectModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowSelectModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowSelectModal(false)}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{currentField?.label}</Text>
                            <TouchableOpacity onPress={() => setShowSelectModal(false)}>
                                <Ionicons name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.optionsList}>
                            {selectOptions.map((option, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.optionItem,
                                        formData[currentField?.key] === option && styles.optionItemSelected
                                    ]}
                                    onPress={() => handleSelectOption(option)}
                                >
                                    <Text style={[
                                        styles.optionText,
                                        formData[currentField?.key] === option && styles.optionTextSelected
                                    ]}>
                                        {option}
                                    </Text>
                                    {formData[currentField?.key] === option && (
                                        <Ionicons name="checkmark" size={20} color="#E8B4B8" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    scroll: {
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 120,
    },
    header: {
        marginBottom: 32,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#8E8E93',
        lineHeight: 22,
        marginBottom: 32,
    },
    stepIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    stepWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stepIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    stepActive: {
        backgroundColor: '#E8B4B8',
        borderColor: '#E8B4B8',
    },
    stepComplete: {
        backgroundColor: '#FFFFFF',
        borderColor: '#FFFFFF',
    },
    stepLine: {
        width: 40,
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginHorizontal: 4,
    },
    stepLineActive: {
        backgroundColor: '#E8B4B8',
    },
    stepTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#E8B4B8',
        marginTop: 12,
    },
    stepContent: {
        marginTop: 8,
    },
    inputGroup: {
        marginBottom: 24,
    },
    label: {
        color: '#8E8E93',
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        color: '#FFFFFF',
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    selectInput: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        minHeight: 56,
    },
    selectInputText: {
        color: '#FFFFFF',
        fontSize: 16,
    },
    photoHint: {
        color: '#8E8E93',
        marginBottom: 20,
        lineHeight: 20,
    },
    photoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    photoBox: {
        width: (width - 64) / 3,
        height: (width - 64) / 3 * 1.2,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        marginBottom: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        borderStyle: 'dashed',
        overflow: 'hidden',
    },
    photoBoxFilled: {
        borderStyle: 'solid',
        borderColor: '#E8B4B8',
    },
    photoImage: {
        width: '100%',
        height: '100%',
    },
    mainBadge: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(232, 180, 184, 0.9)',
        paddingVertical: 4,
        alignItems: 'center',
    },
    mainBadgeText: {
        color: '#1C1C1E',
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    footer: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        paddingTop: 16,
        backgroundColor: 'transparent',
    },
    nextButton: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#E8B4B8',
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#E8B4B8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    nextButtonText: {
        color: '#1C1C1E',
        fontSize: 16,
        fontWeight: '700',
    },
    backButton: {
        width: 100,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    backButtonText: {
        color: '#8E8E93',
        fontSize: 16,
        fontWeight: '600',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1C1C1E',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 20,
        paddingHorizontal: 24,
        paddingBottom: 40,
        maxHeight: '70%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '700',
    },
    optionsList: {
        marginTop: 10,
    },
    optionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    optionItemSelected: {
        backgroundColor: 'rgba(232, 180, 184, 0.05)',
    },
    optionText: {
        color: '#FFFFFF',
        fontSize: 16,
    },
    optionTextSelected: {
        color: '#E8B4B8',
        fontWeight: '600',
    },
    // Gender Button Styles
    genderButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 5,
    },
    genderButton: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginHorizontal: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    genderButtonSelected: {
        backgroundColor: 'rgba(232, 180, 184, 0.2)', // translucent pink
        borderColor: '#E8B4B8',
    },
    genderButtonText: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    genderButtonTextSelected: {
        color: '#E8B4B8',
        fontWeight: 'bold',
    },
});

export default OnboardingScreen;
