import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const HeartLoader = ({ size = 60, color = '#FF6B6B' }) => {
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0.7)).current;

    useEffect(() => {
        // Heartbeat pulse animation - mimics a real heartbeat rhythm
        const pulseAnimation = Animated.loop(
            Animated.sequence([
                // First beat - quick expansion
                Animated.parallel([
                    Animated.timing(scaleAnim, {
                        toValue: 1.15,
                        duration: 150,
                        easing: Easing.out(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacityAnim, {
                        toValue: 1,
                        duration: 150,
                        useNativeDriver: true,
                    }),
                ]),
                // First relaxation
                Animated.parallel([
                    Animated.timing(scaleAnim, {
                        toValue: 0.95,
                        duration: 120,
                        easing: Easing.in(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacityAnim, {
                        toValue: 0.85,
                        duration: 120,
                        useNativeDriver: true,
                    }),
                ]),
                // Second beat - slightly smaller
                Animated.parallel([
                    Animated.timing(scaleAnim, {
                        toValue: 1.08,
                        duration: 130,
                        easing: Easing.out(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacityAnim, {
                        toValue: 0.95,
                        duration: 130,
                        useNativeDriver: true,
                    }),
                ]),
                // Rest phase - heart relaxes
                Animated.parallel([
                    Animated.timing(scaleAnim, {
                        toValue: 0.85,
                        duration: 450,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacityAnim, {
                        toValue: 0.7,
                        duration: 450,
                        useNativeDriver: true,
                    }),
                ]),
            ])
        );

        pulseAnimation.start();

        return () => pulseAnimation.stop();
    }, [scaleAnim, opacityAnim]);

    // Professional heart SVG path
    const heartPath = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

    return (
        <View style={styles.container}>
            <Animated.View
                style={[
                    styles.heartContainer,
                    {
                        width: size,
                        height: size,
                        transform: [{ scale: scaleAnim }],
                        opacity: opacityAnim,
                    },
                ]}
            >
                <Svg
                    width={size}
                    height={size}
                    viewBox="0 0 24 24"
                >
                    <Path
                        d={heartPath}
                        fill={color}
                    />
                </Svg>
            </Animated.View>
            <Text style={styles.loadingText}>Ładowanie...</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    heartContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 13,
        color: '#AAAAAA',
        fontWeight: '500',
    },
});

export default HeartLoader;
