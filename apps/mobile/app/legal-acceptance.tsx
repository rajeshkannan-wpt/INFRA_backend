// app/legal-acceptance.tsx
import { router } from 'expo-router';
// import { LinearGradient } from 'expo-linear-gradient'; // shimmed for Expo Go
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  BackHandler,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Fonts } from '@/constants/typography';

const C = {
  bg: '#0B0F14',
  bg2: '#15171C',
  card: '#12151B',
  ink: '#3FC6B8',
  inkDim: '#9AA0AC',
  accent: '#3FC6B8',
  border: '#242832',
  borderSoft: '#2E323C',
  text: '#F3F3F4',
  textDim: '#C6CAD2',
  disabled: '#1E5C55',
};

const TERMS_SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Introduction',
    body: 'Welcome to ONB. These Terms and Conditions ("Terms") govern your access to and use of our mobile application and related services. By creating an account or otherwise using the app, you agree to be bound by these Terms. This is dummy placeholder text provided for demonstration purposes only.',
  },
  {
    title: '2. Eligibility',
    body: 'You must be at least 18 years old, or the age of majority in your jurisdiction, to use this app. By using the app, you represent and warrant that you meet these requirements and that you have not been previously suspended or removed from the service.',
  },
  {
    title: '3. Your Account',
    body: 'You are responsible for maintaining the confidentiality of the information associated with your account, including your phone number and verification codes. You agree to notify us immediately of any unauthorized use of your account. We are not liable for any loss caused by unauthorized access.',
  },
  {
    title: '4. Acceptable Use',
    body: 'You agree not to misuse the app. This includes attempting to gain unauthorized access to the app or related systems, interfering with other users, reverse engineering the software, or using the app for any unlawful, fraudulent, or harmful purpose. We may suspend or terminate access for violations.',
  },
  {
    title: '5. Intellectual Property',
    body: 'All content, branding, features, and functionality within the app are owned by us or our licensors and are protected by applicable intellectual property laws. Nothing in these Terms grants you any right, title, or interest in the app except for the limited, revocable right to use it.',
  },
  {
    title: '6. Privacy',
    body: 'Your privacy matters to us. Our collection and use of personal information is described in our Privacy Policy, which is incorporated into these Terms by reference. Dummy paragraph: we may collect device identifiers, usage data, and the phone number you provide during onboarding.',
  },
  {
    title: '7. Third-Party Services',
    body: 'The app may rely on third-party services such as SMS delivery providers for one-time passcodes. We do not control those third parties and are not responsible for their availability, accuracy, or practices. Your dealings with third parties are solely between you and them.',
  },
  {
    title: '8. Disclaimers',
    body: 'The app is provided on an "as is" and "as available" basis without warranties of any kind, whether express or implied. We do not guarantee that the app will be uninterrupted, secure, or error-free. Dummy text: use of the app is at your own risk.',
  },
  {
    title: '9. Limitation of Liability',
    body: 'To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or relating to your use of the app, even if advised of the possibility of such damages.',
  },
  {
    title: '10. Changes to These Terms',
    body: 'We may modify these Terms from time to time. If we make material changes, we will notify you within the app before the changes take effect. Continued use of the app after changes become effective constitutes acceptance of the revised Terms.',
  },
  {
    title: '11. Contact Us',
    body: 'Questions about these Terms? Reach out to our support team through the in-app help section. This concludes the dummy Terms and Conditions document. Thank you for reading all the way to the end.',
  },
];

const SCROLL_END_THRESHOLD = 24;

export default function LegalAcceptanceScreen() {
  const [accepted, setAccepted] = useState(false);
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);

  const goBack = useCallback(() => {
    router.back();
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [goBack]);

  const handleContinue = () => {
    if (!accepted) return;
    router.push('/phone-entry');
  };

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      if (
        layoutMeasurement.height + contentOffset.y >=
        contentSize.height - SCROLL_END_THRESHOLD
      ) {
        setHasReadTerms(true);
      }
    },
    []
  );

  const checkContentFits = useCallback((ch: number, vh: number) => {
    if (ch > 0 && vh > 0 && ch <= vh) setHasReadTerms(true);
  }, []);

  const toggleAccepted = () => {
    if (!hasReadTerms) return;
    setAccepted((prev) => !prev);
  };

  const hint = !hasReadTerms
    ? 'Scroll to the end of the terms to unlock the checkbox.'
    : null;

  return (
    <View
      colors={[C.bg2, C.bg]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 0.45 }}
      style={styles.root}
    >
      <View style={styles.top}>
        <Pressable
          onPress={goBack}
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
          <Text style={styles.title}>Before we continue</Text>
          <Text style={styles.sub}>Please review and accept our policies to proceed.</Text>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.cardTitle}>Terms &amp; Conditions</Text>
        </View>

        <ScrollView
          style={styles.termsScroll}
          contentContainerStyle={styles.termsContent}
          onScroll={handleScroll}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            setViewportH(h);
            checkContentFits(contentH, h);
          }}
          onContentSizeChange={(_w, h) => {
            setContentH(h);
            checkContentFits(h, viewportH);
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator
          indicatorStyle="white"
          nestedScrollEnabled
        >
          {TERMS_SECTIONS.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionBody}>{section.body}</Text>
            </View>
          ))}
          <Text style={styles.endMark}>— End of Terms —</Text>
        </ScrollView>

        {hint ? (
          <Text style={styles.hint} accessibilityLiveRegion="polite">
            {hint}
          </Text>
        ) : null}

        <Pressable
          style={[styles.checkboxRow, !hasReadTerms && styles.checkboxLocked]}
          onPress={toggleAccepted}
          disabled={!hasReadTerms}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted, disabled: !hasReadTerms }}
          hitSlop={8}
        >
          <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
            {accepted ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.checkboxText}>
            I have read and accept the Terms &amp; Conditions
          </Text>
        </Pressable>

        <View style={styles.bottomSection}>
          <Pressable
            style={[styles.btn, !accepted && styles.btnDisabled]}
            onPress={handleContinue}
            disabled={!accepted}
            accessibilityRole="button"
            accessibilityState={{ disabled: !accepted }}
          >
            <Text style={styles.btnText}>Continue</Text>
          </Pressable>
        </View>
      </View>
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
    paddingHorizontal: 24,
  },
  header: {
    marginTop: 20,
  },
  title: {
    color: C.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    fontFamily: Fonts.heading,
  },
  sub: {
    color: C.inkDim,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 10,
    fontFamily: Fonts.body,
  },
  listHeader: {
    marginTop: 18,
    marginBottom: 10,
  },
  cardTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: Fonts.bodyMedium,
  },
  termsScroll: {
    flex: 1,
  },
  termsContent: {
    paddingVertical: 4,
    paddingBottom: 8,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: C.accent,
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 4,
    fontFamily: Fonts.bodyMedium,
  },
  sectionBody: {
    color: C.textDim,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: Fonts.body,
  },
  endMark: {
    color: C.inkDim,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 2,
    fontFamily: Fonts.body,
  },
  hint: {
    marginTop: 12,
    color: C.inkDim,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.body,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 18,
  },
  checkboxLocked: {
    opacity: 0.45,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.borderSoft,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  checkmark: {
    color: C.bg,
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxText: {
    flex: 1,
    color: C.textDim,
    fontSize: 14.5,
    lineHeight: 21,
    fontFamily: Fonts.body,
  },
  bottomSection: {
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
    paddingTop: 20,
  },
  btn: {
    backgroundColor: C.ink,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  btnDisabled: {
    backgroundColor: C.disabled,
    opacity: 0.6,
  },
  btnText: {
    color: C.bg,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: Fonts.bodyMedium,
  },
});