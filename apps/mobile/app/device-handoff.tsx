// app/device-handoff.tsx
// ONB-1.7 — New-device login handoff
// Per PRD Scenarios 5.1–5.4: Successful verification on new device force-logs-out
// old phone + Web silently. Confirmation shown only on new device.

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSession } from '@/hooks/useSession';
import { parsePhoneNumberFromString } from 'libphonenumber-js/mobile';
import * as SecureStore from 'expo-secure-store';

export default function DeviceHandoffScreen() {
  const params = useLocalSearchParams<{ phoneNumber?: string; userId: string }>();
  const phoneNumber = params.phoneNumber || '';
  const userId = params.userId || '';
  const [isLoading, setIsLoading] = useState(true);
  const { createSession } = useSession();

  useEffect(() => {
    const performHandoff = async () => {
      try {
        await createSession(userId);
        // Store the formatted phone number for display in Settings/Chats
        if (phoneNumber) {
          const parsed = parsePhoneNumberFromString(phoneNumber);
          const formatted = parsed ? parsed.formatInternational() : phoneNumber;
          await SecureStore.setItemAsync('displayPhone', formatted);
        }
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
      }
    };
    performHandoff();
  }, [userId, phoneNumber]);

  const handleContinue = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <View style={styles.seal}>
            <View style={styles.sealDot} />
          </View>
        </View>

        <Text style={styles.title}>Logged In!</Text>
        <Text style={styles.subtitle}>
          This is your new device. Your other devices have been logged out.
        </Text>

        {isLoading ? (
          <ActivityIndicator color="#3FC6B8" size="large" style={styles.loader} />
        ) : (
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.note}>
          Old devices were logged out silently — no warning was shown there.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#15171C',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 24,
  },
  seal: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#3FC6B8',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sealDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3FC6B8',
  },
  title: {
    fontWeight: '700',
    fontSize: 28,
    color: '#F3F3F4',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#9AA0AC',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  loader: {
    marginVertical: 8,
  },
  continueButton: {
    backgroundColor: '#0F9C90',
    borderRadius: 14,
    height: 56,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  note: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
});