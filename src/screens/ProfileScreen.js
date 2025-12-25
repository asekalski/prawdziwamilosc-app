import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, ScrollView } from 'react-native';
import { getMember, getXProfileGroups } from '../api/members';
import { AuthContext } from '../context/AuthContext';
import { useTheme, useNavigation } from '@react-navigation/native';
import { TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const ProfileScreen = ({ route }) => {
    const { userInfo, logout } = useContext(AuthContext);
    const [member, setMember] = useState(null);
    const [loading, setLoading] = useState(true);
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

    if (loading) {
        return <View style={styles.center}><ActivityIndicator /></View>;
    }

    if (!member) {
        return <View style={styles.center}><Text style={{ color: colors.text }}>Member not found</Text></View>;
    }

    return (
        <ScrollView style={styles.container}>
            <View style={[styles.topBar, { marginTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                    <Text style={[styles.backButtonText, { color: '#FFFFFF' }]}> Back</Text>
                </TouchableOpacity>

                {isOwnProfile && (
                    <TouchableOpacity onPress={logout} style={styles.logoutButton}>
                        <Ionicons name="log-out-outline" size={24} color="#E74C3C" />
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.header}>
                <Image source={{ uri: member.avatar_urls?.full }} style={styles.avatar} />
                <Text style={styles.name}>{member.name}</Text>
                <Text style={styles.mention}>@{member.mention_name}</Text>

                {userId !== 'me' && userId !== userInfo?.id && (
                    <TouchableOpacity
                        style={styles.messageButton}
                        onPress={() => {
                            const parentNav = navigation.getParent();
                            if (parentNav) {
                                parentNav.navigate('NewMessage', {
                                    recipientId: member.id,
                                    recipientName: member.name
                                });
                            }
                        }}
                    >
                        <Ionicons name="chatbubble" size={20} color="#fff" style={styles.messageIcon} />
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

                                return (
                                    <View key={fIndex} style={styles.field}>
                                        <Text style={styles.label}>{field.name}</Text>
                                        <Text style={styles.value}>
                                            {fieldValue}
                                        </Text>
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
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#2C2C2E' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10 },
    backButton: { flexDirection: 'row', alignItems: 'center', padding: 10 },
    backButtonText: { fontSize: 18, fontWeight: '600', marginLeft: 5 },
    logoutButton: { flexDirection: 'row', alignItems: 'center', padding: 10 },
    logoutText: { fontSize: 16, fontWeight: '600', marginLeft: 5, color: '#E74C3C' },
    header: { alignItems: 'center', padding: 20 },
    avatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 15, borderWidth: 3, borderColor: '#fff' },
    name: { fontSize: 32, fontWeight: 'bold', fontFamily: 'serif', color: '#FFFFFF', marginBottom: 5 },
    mention: { fontSize: 18, color: '#CCCCCC', marginBottom: 10 },
    messageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2ECC71',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
        marginTop: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    messageIcon: { marginRight: 8 },
    messageButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    contentContainer: { padding: 20 },
    group: { marginBottom: 25, backgroundColor: '#fff', borderRadius: 15, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3.84, elevation: 2 },
    groupName: { fontSize: 20, fontWeight: 'bold', color: '#000', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
    field: { marginBottom: 15 },
    label: { fontSize: 14, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
    value: { fontSize: 16, color: '#000', fontWeight: '500' },
    emptyText: { fontStyle: 'italic', color: '#999' },
});

export default ProfileScreen;
