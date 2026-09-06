// app/phone-entry.tsx
import { onboardingApi } from '@/api/onboardingApi';
import { COUNTRIES, type Country } from '@/constants/countries';
import { Fonts } from '@/constants/typography';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { Ionicons } from '@expo/vector-icons';
import {
  AsYouType,
  getCountryCallingCode,
  getExampleNumber,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/mobile';
import { Metadata, type MetadataJson } from 'libphonenumber-js/core';
import metadataJson from 'libphonenumber-js/metadata.mobile.json';
import examples from 'libphonenumber-js/examples.mobile.json';
import { router } from 'expo-router';
// import { LinearGradient } from 'expo-linear-gradient'; // shimmed for Expo Go
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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

const INDIA = COUNTRIES.find((c) => c.iso === 'IN') ?? COUNTRIES[0];

const MAX_DIGITS = 16;

const E164_MAX_DIGITS = 15;

type LengthRange = { min: number; max: number };

type NumberingPlanWithTypes = {
  possibleLengths(): number[];
  type?: (t: string) => { possibleLengths(): number[] } | undefined;
};

const lengthRangeCache = new Map<string, LengthRange | null>();

function callingCode(iso: string): string {
  try {
    return getCountryCallingCode(iso as CountryCode);
  } catch {
    const fallback = COUNTRIES.find((c) => c.iso === iso);
    return fallback ? fallback.dial.replace(/\D/g, '') : '';
  }
}

function nationalLengthRange(iso: string): LengthRange | null {
  const cached = lengthRangeCache.get(iso);
  if (cached !== undefined) return cached;

  let range: LengthRange | null = null;
  try {
    const metadata = new Metadata(metadataJson as unknown as MetadataJson);
    metadata.selectNumberingPlan(iso as CountryCode);
    const plan = metadata.numberingPlan as unknown as NumberingPlanWithTypes | undefined;
    const lengths = (plan?.type?.('MOBILE') ?? plan)?.possibleLengths() ?? [];
    if (lengths.length > 0) {
      range = { min: Math.min(...lengths), max: Math.max(...lengths) };
    }
  } catch {}

  lengthRangeCache.set(iso, range);
  return range;
}

function maxLengthFor(iso: string): number {
  const range = nationalLengthRange(iso);
  return Math.max(
    1,
    Math.min(range ? range.max : MAX_DIGITS, E164_MAX_DIGITS - callingCode(iso).length),
  );
}

function localExample(iso: string): { text: string; digits: number } | null {
  const parsed = getExampleNumber(iso as CountryCode, examples);
  if (!parsed) return null;
  return { text: parsed.formatNational(), digits: parsed.nationalNumber.length };
}

export default function PhoneEntryScreen() {
  const [selected, setSelected] = useState<Country>(INDIA);
  const [phone, setPhone] = useState('');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const keyboardHeight = useKeyboardHeight();
  const sheetY = useRef(new Animated.Value(0)).current;

  const closeSheet = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 0 && Math.abs(g.dy) > 6,
      onPanResponderMove: (_e, g) => {
        if (g.dy > 0) sheetY.setValue(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 120 || g.vy > 0.8) {
          Animated.timing(sheetY, { toValue: 600, duration: 180, useNativeDriver: true }).start(
            closeSheet,
          );
        } else {
          Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    if (open) sheetY.setValue(0);
  }, [open, sheetY]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    const qDigits = q.replace(/[^0-9]/g, '');
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso.toLowerCase().includes(q) ||
        (qDigits.length > 0 && c.dial.replace(/[^0-9]/g, '').includes(qDigits)),
    );
  }, [query]);

  const digits = phone.replace(/\D/g, '');
  const code = useMemo(() => callingCode(selected.iso), [selected]);
  const example = useMemo(() => localExample(selected.iso), [selected]);
  const maxDigits = useMemo(() => maxLengthFor(selected.iso), [selected]);
  const fullNumber = `+${code}${digits}`;
  const valid = digits.length > 0 && isValidPhoneNumber(fullNumber);
  const lengthHint = useMemo(() => {
    const range = nationalLengthRange(selected.iso);
    if (!range) return null;
    return range.min === range.max
      ? `${range.min} digits`
      : `${range.min}–${range.max} digits`;
  }, [selected]);

  const select = (c: Country) => {
    setSelected(c);
    setOpen(false);
    setQuery('');
    const d = phone.replace(/\D/g, '').slice(0, maxLengthFor(c.iso));
    setPhone(new AsYouType(c.iso as CountryCode).input(d));
  };

  const handlePhoneChange = (text: string) => {
    let d = text.replace(/\D/g, '').slice(0, maxDigits);
    setPhone(new AsYouType(selected.iso as CountryCode).input(d));
  };

  const handleContinue = async () => {
    if (!valid) {
      return;
    }

    const e164 = parsePhoneNumberFromString(fullNumber)?.number ?? fullNumber;
    setIsLoading(true);

    try {
      // Both calls are independent — fire in parallel to halve the wait.
      await Promise.all([
        onboardingApi.acceptLegal(e164),
        onboardingApi.sendOtp({ phoneNumber: e164 }),
      ]);
      router.push({
        pathname: '/otp-entry',
        params: { phoneNumber: e164, displayPhone: phone },
      });
    } catch {
      Alert.alert('Error', 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
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
          <Text style={styles.title}>What&apos;s your number?</Text>
          <Text style={styles.sub}>We will send a OTP to verify it&apos;s you.</Text>
        </View>

        <View style={styles.middle}>
          <Text style={styles.label}>PHONE NUMBER</Text>
          <View style={styles.row}>
            <Pressable style={styles.cc} onPress={() => setOpen(true)} accessibilityRole="button">
              <Text style={styles.ccFlag}>{selected.flag}</Text>
              <Text style={styles.ccCode}>+{code}</Text>
              <Ionicons name="chevron-down" size={14} color={C.inkDim} />
            </Pressable>
            <TextInput
              style={styles.num}
              value={phone}
              keyboardType="phone-pad"
              placeholder={example ? `e.g. ${example.text}` : 'Enter phone number'}
              placeholderTextColor={C.inkDim}
              editable={!isLoading}
              onChangeText={handlePhoneChange}
            />
          </View>
          {phone.length > 0 && !valid && (
            <Text style={styles.error}>
              Enter a valid {selected.name} mobile number
              {lengthHint ? ` — ${lengthHint}` : ''}
              {example ? `, e.g. ${example.text}` : ''}
            </Text>
          )}
        </View>

        <View
          style={[
            styles.bottomSection,
            keyboardHeight > 0 && { paddingBottom: keyboardHeight + 30 },
          ]}
        >
          <Pressable
            style={[styles.btn, (!valid || isLoading) && styles.btnDisabled]}
            disabled={!valid || isLoading}
            onPress={handleContinue}
          >
            <Text style={styles.btnText}>{isLoading ? 'Sending…' : 'Send OTP'}</Text>
          </Pressable>

          <View style={styles.bottomRow}>
            <Ionicons name="lock-closed-outline" size={14} color={C.inkDim} />
            <Text style={styles.bottomText}>End-to-end encrypted messaging</Text>
          </View>
        </View>
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={closeSheet}>
        <View style={styles.overlay}>
          <Pressable style={styles.overlayBackdrop} onPress={closeSheet} />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
            <View style={styles.dragHandle} {...panResponder.panHandlers}>
              <View style={styles.handle} />
              <Text style={styles.sheetTitle}>Select country</Text>
            </View>
            <TextInput
              style={styles.search}
              value={query}
              placeholder="Search country or code…"
              placeholderTextColor={C.inkDim}
              autoFocus
              onChangeText={setQuery}
            />
            <FlatList
              style={styles.list}
              data={filtered}
              keyExtractor={(item) => item.iso}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.empty}>No countries match</Text>}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.rowItem, item.iso === selected.iso && styles.rowItemActive]}
                  onPress={() => select(item)}
                >
                  <View style={styles.rowLeft}>
                    <Text style={styles.rowFlag}>{item.flag}</Text>
                    <Text style={styles.rowCode}>+{callingCode(item.iso)}</Text>
                  </View>
                  <Text
                    style={[styles.rowName, item.iso === selected.iso && styles.rowNameActive]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              )}
            />
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
    paddingHorizontal: 8,
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
    paddingHorizontal: 28,
  },
  header: {
    marginTop: 24,
  },
  title: {
    color: C.text,
    fontSize: 32,
    lineHeight: 39,
    marginBottom: 16,
    fontFamily: Fonts.heading,
    fontWeight: '700',
  },
  sub: {
    color: C.inkDim,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Fonts.body,
  },
  middle: {
    marginTop: 36,
  },
  label: {
    color: C.accent,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    fontWeight: '600',
    fontFamily: Fonts.bodyMedium,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  cc: {
    height: 52,
    minWidth: 104,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.borderSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ccFlag: { fontSize: 16 },
  ccCode: { color: C.text, fontSize: 14, fontWeight: '500', fontFamily: Fonts.bodyMedium },
  num: {
    flex: 1,
    height: 52,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.borderSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: C.text,
    fontSize: 16,
    fontFamily: Fonts.body,
    textAlignVertical: 'center',
  },
  error: {
    color: C.fail,
    fontSize: 11.5,
    marginTop: 8,
    fontFamily: Fonts.body,
  },
  bottomSection: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
  },
  btn: {
    backgroundColor: C.ink,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.35 },
  btnText: {
    color: C.bg,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: Fonts.bodyMedium,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  bottomText: {
    color: C.inkDim,
    fontSize: 12,
    fontFamily: Fonts.body,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    maxHeight: '78%',
    backgroundColor: C.bg2,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: C.borderSoft,
    paddingBottom: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.ring,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  dragHandle: {
    paddingBottom: 2,
  },
  sheetTitle: {
    color: C.ink,
    fontSize: 18,
    paddingHorizontal: 20,
    paddingBottom: 12,
    fontFamily: Fonts.heading,
  },
  search: {
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.borderSoft,
    borderRadius: 12,
    color: C.text,
    fontSize: 14,
    fontFamily: Fonts.body,
  },
  list: { paddingHorizontal: 8 },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
  },
  rowItemActive: { backgroundColor: C.ringSoft },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 96,
  },
  rowFlag: { fontSize: 16 },
  rowName: {
    flex: 1,
    color: C.text,
    fontSize: 14.5,
    textAlign: 'right',
    fontFamily: Fonts.body,
  },
  rowNameActive: { color: C.accent },
  rowCode: { color: C.inkDim, fontSize: 13, fontWeight: '500', fontFamily: Fonts.bodyMedium },
  empty: {
    color: C.inkDim,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 28,
    fontFamily: Fonts.body,
  },
});