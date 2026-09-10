// app/splash.tsx
// ONB-1.1 — Splash screen
// Per PRD Scenario 1.1: Tap to proceed only — no skip, no guest mode, no access to any other screen.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Dimensions,
  GestureResponderEvent,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const COLORS = {
  bg: '#0a0a0b',
  bg2: '#111113',
  ink: '#c27b10',
  inkDim: 'rgba(243,241,236,0.5)',
  inkFaint: '#c27b10',
  ring: 'rgba(255, 174, 13, 0.445)',
  ringSoft: 'rgba(201,180,139,0.12)',
};

interface RippleData {
  id: number;
  x: number;
  y: number;
  size: number;
  progress: Animated.Value;
}

const Chevron = ({ style }: { style?: any }) => (
  <Animated.View style={style}>
    <Svg width={16} height={9} viewBox="0 0 16 9" fill="none">
      <Path
        d="M1 8L8 1L15 8"
        stroke={COLORS.inkDim}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </Animated.View>
);

export default function SplashScreen() {
  const [showNext, setShowNext] = useState(false);
  const [ripples, setRipples] = useState<RippleData[]>([]);
  const rippleId = useRef(0);

  const breathe = useRef(new Animated.Value(0)).current;
  const rise1 = useRef(new Animated.Value(0)).current;
  const rise2 = useRef(new Animated.Value(0)).current;
  const nextOpacity = useRef(new Animated.Value(0)).current;

  // Breathing animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2250,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 2250,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  // Chevron animations
  useEffect(() => {
    const makeRiseLoop = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

    const loop1 = makeRiseLoop(rise1, 0);
    const loop2 = makeRiseLoop(rise2, 180);
    loop1.start();
    loop2.start();
    return () => {
      loop1.stop();
      loop2.stop();
    };
  }, [rise1, rise2]);

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      const { locationX, locationY } = e.nativeEvent;
      const size = Math.max(SCREEN_W, SCREEN_H) * 1.4;
      const progress = new Animated.Value(0);
      const id = rippleId.current++;

      setRipples((prev) => [...prev, { id, x: locationX, y: locationY, size, progress }]);

      Animated.timing(progress, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      });

      // Show "You're in" overlay then navigate
      setTimeout(() => {
        setShowNext(true);
        Animated.timing(nextOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.ease,
          useNativeDriver: true,
        }).start(() => {
          setTimeout(() => {
            router.replace('/phone-entry');
          }, 400);
        });
      }, 250);
    },
    [nextOpacity]
  );

  const haloScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] });
  const haloOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const ringScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const ringOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });

  const rise1TranslateY = rise1.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const rise1Opacity = rise1.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0.35] });
  const rise2TranslateY = rise2.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const rise2Opacity = rise2.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.18] });

  return (
    <Pressable style={styles.screenWrap} onPress={handlePress}>
      <LinearGradient
        colors={[COLORS.bg2, COLORS.bg]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.45 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Top bar */}
      <View style={styles.top}>
        <Text style={styles.topLabel}>WPT</Text>
        <Text style={[styles.topLabel, { color: COLORS.inkDim }]}>v1.0</Text>
      </View>

      {/* Center content */}
      <View style={styles.center} pointerEvents="none">
        <Animated.View
          style={[
            styles.halo,
            { transform: [{ scale: haloScale }], opacity: haloOpacity },
          ]}
        />
        <Animated.View
          style={[
            styles.ring,
            { transform: [{ scale: ringScale }], opacity: ringOpacity },
          ]}
        />
        <View style={styles.wordmarkWrap}>
          <Text style={styles.wordmark}>WPT</Text>
          <Text style={styles.tagline}>Begin quietly</Text>
        </View>
      </View>

      {/* Bottom CTA */}
      <View style={styles.bottom} pointerEvents="none">
        <View style={styles.chevrons}>
          <Chevron
            style={{
              transform: [{ translateY: rise1TranslateY }],
              opacity: rise1Opacity,
            }}
          />
          <Chevron
            style={{
              transform: [{ translateY: rise2TranslateY }],
              opacity: rise2Opacity,
            }}
          />
        </View>
        <Text style={styles.ctaLabel}>Tap to proceed</Text>
        <View style={styles.ctaLine} />
      </View>

      {/* Ripple effects */}
      {ripples.map((r) => {
        const scale = r.progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
        const opacity = r.progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
        return (
          <Animated.View
            key={r.id}
            pointerEvents="none"
            style={[
              styles.ripple,
              {
                width: r.size,
                height: r.size,
                borderRadius: r.size / 2,
                left: r.x - r.size / 2,
                top: r.y - r.size / 2,
                opacity,
                transform: [{ scale }],
              },
            ]}
          />
        );
      })}

      {/* "You're in" overlay */}
      {showNext && (
        <Animated.View
          pointerEvents={showNext ? 'auto' : 'none'}
          style={[styles.next, { opacity: nextOpacity }]}
        >
          <Text style={styles.nextText}>You&apos;re in.</Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screenWrap: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
    paddingHorizontal: 28,
  },
  topLabel: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.inkFaint,
    fontWeight: '500',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: COLORS.ringSoft,
  },
  ring: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: COLORS.ring,
  },
  wordmarkWrap: {
    alignItems: 'center',
  },
  wordmark: {
    fontWeight: '800',
    fontSize: 44,
    letterSpacing: 9,
    color: COLORS.ink,
  },
  tagline: {
    marginTop: 6,
    fontStyle: 'italic',
    opacity: 0.6,
    fontSize: 9,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: COLORS.inkDim,
  },
  bottom: {
    alignItems: 'center',
    gap: 14,
    paddingBottom: 56,
  },
  chevrons: {
    alignItems: 'center',
    gap: 2,
  },
  ctaLabel: {
    fontSize: 12,
    letterSpacing: 5,
    textTransform: 'uppercase',
    color: COLORS.inkDim,
    fontWeight: '500',
  },
  ctaLine: {
    width: 34,
    height: 1,
    backgroundColor: COLORS.inkFaint,
    marginTop: 2,
  },
  ripple: {
    position: 'absolute',
    backgroundColor: COLORS.ringSoft,
    borderWidth: 1,
    borderColor: COLORS.ring,
  },
  next: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
  },
  nextText: {
    fontStyle: 'italic',
    fontWeight: '400',
    fontSize: 22,
    color: COLORS.inkDim,
    letterSpacing: 0.4,
  },
});