// app/done.tsx
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

const C = {
  bg: '#0a0a0b',
  bg2: '#111113',
  ink: '#c27b10',
  inkDim: 'rgba(243,241,236,0.5)',
};

export default function DoneScreen() {
  return (
    <LinearGradient colors={[C.bg2, C.bg]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.45 }} style={styles.root}>
      <View style={styles.top}>
        <Text style={styles.topLabel}>ONB</Text>
        <Text style={[styles.topLabel, { color: C.inkDim }]}>Version 1.0</Text>
      </View>
      <View style={styles.center}>
        <Text style={styles.done}>Pravan Done</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
    color: C.ink,
    fontFamily: 'Lato-Bold',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: {
    color: C.ink,
    fontSize: 30,
    fontFamily: 'Lato-Black',
    letterSpacing: 1,
  },
});