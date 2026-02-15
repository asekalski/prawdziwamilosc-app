import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions, Platform } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

const FlameCurve = ({ color1, color2, speed, amplitude, frequency, offset, startY, opacity = 0.4 }) => {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(anim, {
                toValue: 1,
                duration: speed,
                easing: Easing.linear,
                useNativeDriver: Platform.OS !== 'web', // Native driver doesn't support some SVG props potentially, but transform is fine
            })
        ).start();
    }, []);

    const translateX = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -width],
    });

    // Create a flame/ribbon shape (closed path)
    const points = 25;
    const step = (width * 2) / points;

    // Top boundary of the flame
    let topPath = `M 0 ${startY}`;
    // Bottom boundary of the flame (to create thickness)
    let bottomPath = `L ${width * 2} ${startY + 20}`;

    for (let i = 0; i <= points; i++) {
        const x = i * step;
        // Vary amplitude slightly for organic feel
        const variance = Math.sin(i * 0.5) * 10;
        const yTop = startY + (amplitude + variance) * Math.sin((i / points) * frequency * Math.PI * 2 + offset);
        topPath += ` L ${x} ${yTop}`;
    }

    for (let i = points; i >= 0; i--) {
        const x = i * step;
        const variance = Math.cos(i * 0.5) * 5;
        // Bottom is offset and slightly different frequency/amplitude for tapering
        const yBottom = startY + 40 + (amplitude * 0.6 + variance) * Math.sin((i / points) * (frequency * 0.9) * Math.PI * 2 + offset + 0.5);
        bottomPath += ` L ${x} ${yBottom}`;
    }

    const fullPath = `${topPath} ${bottomPath} Z`;
    const gradientId = `grad-${color1}-${color2}-${offset}-${startY}`.replace(/[^a-zA-Z0-9]/g, '');

    return (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
            <Svg height={height} width={width * 2} style={StyleSheet.absoluteFill}>
                <Defs>
                    <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <Stop offset="0%" stopColor={color1} stopOpacity={0} />
                        <Stop offset="20%" stopColor={color1} stopOpacity={opacity} />
                        <Stop offset="50%" stopColor={color2} stopOpacity={opacity * 1.5} />
                        <Stop offset="80%" stopColor={color1} stopOpacity={opacity} />
                        <Stop offset="100%" stopColor={color1} stopOpacity={0} />
                    </LinearGradient>
                </Defs>

                <Path
                    d={fullPath}
                    fill={`url(#${gradientId})`}
                    opacity={opacity}
                />
                {/* Subtle highlight edge */}
                <Path
                    d={topPath}
                    stroke={color2}
                    strokeWidth="1.5"
                    fill="none"
                    opacity={opacity * 0.8}
                />
            </Svg>
        </Animated.View>
    );
};

const StartupLoader = () => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const colorAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        // Gentle Pulse Animation (Size)
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.02, // Very subtle scale up
                    duration: 3000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 3000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Color Transition Animation
        Animated.loop(
            Animated.timing(colorAnim, {
                toValue: 1,
                duration: 8000, // Slower color shift
                easing: Easing.linear,
                useNativeDriver: false,
            })
        ).start();

        // Opacity Breathing Animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 4000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0.8,
                    duration: 4000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const textColor = colorAnim.interpolate({
        inputRange: [0, 0.33, 0.66, 1],
        outputRange: ['#E8B4B8', '#FFD700', '#D291BC', '#E8B4B8'], // Pink -> Gold -> Purple -> Pink
    });

    return (
        <View style={styles.container}>
            {/* Background Animated Flames - Colors matched to Icon/Empaths style */}
            <View style={[StyleSheet.absoluteFill, { opacity: 0.6 }]}>
                <FlameCurve color1="#9B59B6" color2="#E91E63" speed={18000} amplitude={90} frequency={1.0} offset={0} startY={height * 0.2} opacity={0.3} />
                <FlameCurve color1="#FFD700" color2="#E67E22" speed={22000} amplitude={70} frequency={0.6} offset={Math.PI / 3} startY={height * 0.35} opacity={0.25} />
                <FlameCurve color1="#E91E63" color2="#8E44AD" speed={20000} amplitude={110} frequency={1.3} offset={Math.PI / 1.6} startY={height * 0.1} opacity={0.3} />
                <FlameCurve color1="#D291BC" color2="#9B59B6" speed={26000} amplitude={130} frequency={0.4} offset={Math.PI * 0.7} startY={height * 0.55} opacity={0.35} />
                <FlameCurve color1="#E91E63" color2="#FFD700" speed={16000} amplitude={80} frequency={1.7} offset={Math.PI * 1.1} startY={height * 0.75} opacity={0.25} />
                <FlameCurve color1="#8E44AD" color2="#D291BC" speed={30000} amplitude={60} frequency={0.3} offset={Math.PI * 1.4} startY={height * 0.45} opacity={0.35} />
                <FlameCurve color1="#FFD700" color2="#FFFFFF" speed={24000} amplitude={150} frequency={0.9} offset={Math.PI * 0.25} startY={height * 0.3} opacity={0.2} />
            </View>

            <Animated.View style={[styles.content, { transform: [{ scale: pulseAnim }], opacity: opacityAnim }]}>
                <Animated.Text style={[styles.title, { color: textColor }]}>
                    Prawdziwa
                </Animated.Text>
                <Animated.Text style={[styles.title, { color: textColor, marginTop: -10 }]}>
                    Miłość
                </Animated.Text>

                <View style={styles.indicatorContainer}>
                    <Animated.View style={[styles.dot, { backgroundColor: textColor, opacity: 0.5 }]} />
                    <Animated.View style={[styles.dot, { backgroundColor: textColor, opacity: 0.8, marginHorizontal: 10 }]} />
                    <Animated.View style={[styles.dot, { backgroundColor: textColor, opacity: 0.5 }]} />
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0D0D0F',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    content: {
        alignItems: 'center',
        zIndex: 20,
    },
    title: {
        fontSize: 48,
        fontWeight: '800',
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        fontStyle: 'italic',
        letterSpacing: 2,
        textShadowColor: 'rgba(232, 180, 184, 0.4)',
        textShadowOffset: { width: 0, height: 6 },
        textShadowRadius: 15,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 12,
        fontWeight: '500',
        fontFamily: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
        letterSpacing: 8,
        marginTop: 8,
        textTransform: 'uppercase',
    },
    indicatorContainer: {
        flexDirection: 'row',
        marginTop: 35,
        alignItems: 'center',
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    }
});

export default StartupLoader;
