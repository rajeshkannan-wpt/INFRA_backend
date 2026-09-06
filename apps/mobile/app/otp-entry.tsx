// app/otp-entry.tsx
import { onboardingApi } from '@/api/onboardingApi';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { Ionicons } from '@expo/vector-icons';
import { parsePhoneNumberFromString } from 'libphonenumber-js/mobile';
import { router, useLocalSearchParams } from 'expo-router';
// import { LinearGradient } from 'expo-linear-gradient'; // shimmed for Expo Go
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
//import * as Device from 'expo-device'; // optional, fallback provided

const C = {
  bg: '#0B0F14',
  bg2: '#15171C',
  ink: '#3FC6B8',
  inkDim: '#9AA0AC',
  accent: '#3FC6B8',
  ring: 'rgba(63,198,184,0.445)',
  ringSoft: 'rgba(63,198,184,0.12)',
  borderSoft: '#2E323C',
  text: '#F3F3F4',
  fail: '#E5484D',
};

const BOXES = 6;
const CODE_LIFETIME = 298;

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export default function OtpEntryScreen() {
  const params = useLocalSearchParams<{ phoneNumber: string; displayPhone?: string }>();
  const phoneNumber = params.phoneNumber || '';
  const displayPhone = params.displayPhone || '';

  const [otp, setOtp] = useState<string[]>(Array(BOXES).fill(''));
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(CODE_LIFETIME);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');

  const keyboardHeight = useKeyboardHeight();
  const shake = useRef(new Animated.Value(0)).current;
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const OTP = otp.join('');
  const expired = expirySeconds <= 0;

  // --- Timers ---
  useEffect(() => {
    if (lockoutSeconds > 0) {
      const timer = setInterval(() => {
        setLockoutSeconds((prev) => {
          if (prev <= 1) {
            setIsLocked(false);
            setError('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutSeconds]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    if (expirySeconds > 0 && !expired) {
      const timer = setInterval(() => setExpirySeconds((prev) => Math.max(0, prev - 1)), 1000);
      return () => clearInterval(timer);
    }
  }, [expirySeconds, expired]);

  // --- Shake animation ---
  const runShake = useCallback(() => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shake]);

  // --- Verify OTP ---
  const verify = useCallback(
    async (entered: string) => {
      if (entered.length !== BOXES) {
        setError(`Enter all ${BOXES} digits.`);
        return;
      }
      if (isLocked) {
        setError(`Please wait ${lockoutSeconds} seconds.`);
        return;
      }

      setError('');
      setIsVerifying(true);

      try {
        const result = await onboardingApi.verifyOtp({ phoneNumber, code: entered });

        if (result.status === 'success') {
          const deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          // Write all tokens in parallel â€” saves ~100ms on cold storage.
          await Promise.all([
            SecureStore.setItemAsync('userId', result.userId),
            SecureStore.setItemAsync('deviceId', deviceId),
            SecureStore.setItemAsync('accessToken', result.accessToken),
            SecureStore.setItemAsync('refreshToken', result.refreshToken),
            SecureStore.setItemAsync('displayPhone', displayPhone),
          ]);

          if (result.routing === 'chats') {
            router.replace('/(tabs)');
          } else {
            router.replace({
              pathname: '/profile-setup',
              params: { phoneNumber, displayPhone },
            });
          }
        } else if (result.status === 'wrong_code') {
          const remaining = result.attemptsRemaining;
          setError(`Incorrect OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`);
          setOtp(Array(BOXES).fill(''));
          runShake();
        } else if (result.status === 'locked_out') {
          setIsLocked(true);
          setLockoutSeconds(result.secondsRemaining);
          setError(`Too many attempts. Try again in ${result.secondsRemaining}s.`);
          setOtp(Array(BOXES).fill(''));
          runShake();
        } else if (result.status === 'attempts_exhausted') {
          setOtp(Array(BOXES).fill(''));
          Alert.alert(
            'Login attempt failed',
            'You entered an incorrect OTP too many times. For your security, please start again and try once more.',
            [{ text: 'OK', onPress: () => router.replace('/phone-entry') }],
          );
        } else if (result.status === 'expired') {
          setOtp(Array(BOXES).fill(''));
          setError('OTP expired. Request a new one.');
        }
      } catch {
        setError('Failed to verify OTP. Please try again.');
      } finally {
        setIsVerifying(false);
      }
    },
    [isLocked, lockoutSeconds, phoneNumber, displayPhone, runShake],
  );

  // --- OTP input handlers ---
  const focusFirstEmpty = () => {
    const idx = otp.findIndex((digit) => digit === '');
    inputRefs.current[idx === -1 ? 0 : idx]?.focus();
  };

  const handleOtpChange = (text: string, index: number) => {
    const cleaned = text.replace(/\D/g, '');
    if (!cleaned) return;

    const next = [...otp];
    let pos = index;
    for (const ch of cleaned) {
      if (pos >= BOXES) break;
      next[pos] = ch;
      pos++;
    }

    setOtp(next);
    setError('');

    if (pos > 0) {
      if (pos < BOXES) {
        inputRefs.current[pos]?.focus();
      } else if (next.every((d) => d !== '')) {
        verify(next.join(''));
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // --- Resend OTP ---
  const handleResend = async () => {
    if (resendCooldown > 0) return;

    // Fire resend optimistically â€” update UI immediately, don't block on network.
    setResendCooldown(30);
    setExpirySeconds(CODE_LIFETIME);
    setOtp(Array(BOXES).fill(''));
    setError('');

    try {
      await onboardingApi.sendOtp({ phoneNumber });
    } catch {
      // If resend failed, stop the cooldown so user can retry.
      setResendCooldown(0);
      Alert.alert('Error', 'Failed to resend OTP. Please try again.');
    }
  };

  const clock = useMemo(() => formatClock(expirySeconds), [expirySeconds]);

  const displayNumber = useMemo(() => {
    if (displayPhone) return displayPhone;
    const parsed = parsePhoneNumberFromString(phoneNumber);
    return parsed ? parsed.formatInternational() : phoneNumber;
  }, [phoneNumber, displayPhone]);

  return (
    <SafeAreaView style={styles.safeRoot} edges={['top']}>
      <View
        colors={[C.bg2, C.bg]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.45 }}
        style={styles.root}
      >
        <View style={styles.top}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={26} color={C.ink} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.header}>
            <Text style={styles.title}>Enter verification OTP</Text>
            <Text style={styles.sub}>We sent a 6-digit OTP to</Text>
            <View style={styles.subRow}>
              <Text style={styles.subNum}>{displayNumber}</Text>
              <Pressable onPress={() => router.back()} disabled={isVerifying} hitSlop={8}>
                <Text style={styles.editText}>Wrong Number?</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.middle}>
            <Animated.View style={[styles.otpRow, { transform: [{ translateX: shake }] }]}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { inputRefs.current[index] = ref; }}
                  style={[
                    styles.box,
                    digit && styles.boxFilled,
                    error && !digit && styles.boxError,
                    (isLocked || isVerifying) && styles.boxDisabled,
                  ]}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  onPress={focusFirstEmpty}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  editable={!isLocked && !isVerifying}
                  autoFocus={index === 0}
                  selectTextOnFocus
                  maxLength={1}
                />
              ))}
            </Animated.View>

            <View style={styles.metaRow}>
              {error ? (
                <Text style={styles.error}>{error}</Text>
              ) : expired ? (
                <Text style={styles.expired}>OTP expired â€” request a new one</Text>
              ) : (
                <Text style={styles.expiry}>
                  OTP expires in <Text style={styles.expiryTime}>{clock}</Text>
                </Text>
              )}
            </View>
          </View>

          <View
            style={[
              styles.actionSection,
              keyboardHeight > 0 && { paddingBottom: keyboardHeight + 30 },
            ]}
          >
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                (OTP.length !== BOXES || isVerifying || isLocked || expired) && styles.btnDisabled,
                pressed && !isVerifying && styles.btnPressed,
              ]}
              disabled={OTP.length !== BOXES || isVerifying || isLocked || expired}
              onPress={() => verify(OTP)}
            >
              <Text style={styles.btnText}>{isVerifying ? 'Verifyingâ€¦' : 'Verify'}</Text>
            </Pressable>

            <Pressable
              style={styles.resend}
              onPress={handleResend}
              disabled={resendCooldown > 0 || isVerifying}
              hitSlop={8}
            >
              <Text style={styles.resendText}>
                Didn&apos;t receive an OTP?{' '}
                <Text
                  style={[
                    styles.resendLink,
                    resendCooldown > 0 && styles.resendLinkDisabled,
                  ]}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                </Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// â”€â”€â”€ Styles (hardcoded fonts) â”€â”€â”€
const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
    backgroundColor: C.bg,
  },
  root: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    marginTop: 20,
  },
  title: {
    color: C.text,
    fontSize: 30,
    lineHeight: 36,
    marginBottom: 12,
    fontFamily: 'Lato-Bold',
    fontWeight: '700',
  },
  sub: {
    color: C.inkDim,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: 'Lato-Regular',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  subNum: {
    color: C.accent,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  editText: {
    color: C.text,
    fontSize: 13,
    textDecorationLine: 'underline',
    fontFamily: 'Lato-Bold',
  },
  middle: {
    marginTop: 28,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  box: {
    flex: 1,
    maxWidth: 46,
    height: 54,
    borderWidth: 1,
    borderColor: C.borderSoft,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg2,
    textAlign: 'center',
    fontSize: 20,
    color: C.text,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  boxFilled: { borderColor: C.ink },
  boxError: { borderColor: C.fail },
  boxDisabled: { opacity: 0.4 },
  metaRow: {
    alignItems: 'center',
    minHeight: 22,
    marginTop: 16,
  },
  error: {
    color: C.fail,
    fontSize: 12.5,
    fontFamily: 'Lato-Regular',
  },
  expiry: {
    color: C.inkDim,
    fontSize: 13.5,
    fontFamily: 'Lato-Regular',
  },
  expiryTime: {
    color: C.accent,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  expired: {
    color: C.fail,
    fontSize: 12.5,
    fontFamily: 'Lato-Regular',
  },
  actionSection: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 20 : 20,
  },
  btn: {
    backgroundColor: C.ink,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.35 },
  btnPressed: { transform: [{ scale: 0.98 }] },
  btnText: {
    color: C.bg,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: 'Lato-Bold',
  },
  resend: { alignItems: 'center', marginTop: 16, paddingVertical: 6 },
  resendText: {
    color: C.inkDim,
    fontSize: 13.5,
    fontFamily: 'Lato-Regular',
  },
  resendLink: {
    color: C.accent,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  resendLinkDisabled: { color: C.inkDim },
});