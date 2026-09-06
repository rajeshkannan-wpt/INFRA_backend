// app/index.tsx
// Root route — onboarding splash screen. Tap to proceed to legal-acceptance.

import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Platform,
  BackHandler,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';

const RING_ENABLED = false;

const COLORS = {
  bg: '#0B0F14',
  bg2: '#15171C',
  ink: '#3FC6B8',
  inkDim: '#9AA0AC',
  inkFaint: '#3FC6B8',
  accent: '#3FC6B8',
  ring: 'rgba(63, 198, 184, 0.445)',
  ringSoft: 'rgba(63,198,184,0.12)',
};

export default function Index() {
  const router = useRouter();

  // Block hardware back on the splash screen (no going "back" to nothing)
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, [])
  );

  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!RING_ENABLED) return;
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

  const handlePress = useCallback(() => {
    setTimeout(() => {
      router.push('/legal-acceptance');
    }, 250);
  }, [router]);

  const haloScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] });
  const haloOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const ringScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const ringOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });

  return (
    <Pressable style={styles.screenWrap} onPress={handlePress}>
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.bg2 }]}
      />

      {/* top bar */}
      <View style={styles.top}>
        <Text style={styles.topLabel}>ONB</Text>
      </View>

      {/* center wordmark */}
      <View style={styles.center} pointerEvents="none">
        {RING_ENABLED && (
          <Animated.View
            style={[
              styles.halo,
              { transform: [{ scale: haloScale }], opacity: haloOpacity },
            ]}
          />
        )}
        {RING_ENABLED && (
          <Animated.View
            style={[
              styles.ring,
              { transform: [{ scale: ringScale }], opacity: ringOpacity },
            ]}
          />
        )}
        <View style={styles.wordmarkWrap}>
          <Text style={styles.wordmark}>ONB</Text>
          <Text style={styles.tagline}>End To End Encrypted</Text>
        </View>
      </View>

      {/* bottom CTA */}
      <View style={styles.bottom} pointerEvents="none">
        <Text style={styles.ctaLabel}>Tap to proceed</Text>
        <View style={styles.ctaLine} />
      </View>
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
    fontFamily: 'Lato-Bold',
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
    fontFamily: 'Lato-Bold',
    fontSize: 64,
    letterSpacing: 9,
    color: COLORS.ink,
  },
  tagline: {
    marginTop: 6,
    fontFamily: 'Lato-Italic',
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
  ctaLabel: {
    fontSize: 12,
    letterSpacing: 5,
    textTransform: 'uppercase',
    color: COLORS.inkDim,
    fontWeight: '500',
    fontFamily: 'Lato-Bold',
  },
  ctaLine: {
    width: 34,
    height: 1,
    backgroundColor: COLORS.inkFaint,
    marginTop: 2,
  },
});
