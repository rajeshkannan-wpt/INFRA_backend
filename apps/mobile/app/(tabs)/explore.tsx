// app/(tabs)/explore.tsx
import { Image } from 'expo-image';
import { Platform, StyleSheet, ScrollView, View, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';

import { ExternalLink } from '@/components/external-link';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';

const C = {
  bg: '#0a0a0b',
  bg2: '#111113',
  ink: '#c27b10',
  inkDim: 'rgba(243,241,236,0.5)',
  accent: '#c9b48b',
  ring: 'rgba(255,174,13,0.445)',
  ringSoft: 'rgba(201,180,139,0.12)',
  borderSoft: 'rgba(201,180,139,0.22)',
  text: '#f3f1ec',
  cardBg: '#1a1a1e',
};

const features = [
  {
    id: 1,
    icon: '📱',
    title: 'File-based Routing',
    description: 'This app has two screens: app/(tabs)/index.tsx and app/(tabs)/explore.tsx',
    link: 'https://docs.expo.dev/router/introduction',
  },
  {
    id: 2,
    icon: '🌐',
    title: 'Cross-Platform Support',
    description: 'Open this project on Android, iOS, and the web. Press w in the terminal to open web version.',
  },
  {
    id: 3,
    icon: '🖼️',
    title: 'Images',
    description: 'Use @2x and @3x suffixes for different screen densities.',
    hasImage: true,
    link: 'https://reactnative.dev/docs/images',
  },
  {
    id: 4,
    icon: '🌓',
    title: 'Light & Dark Mode',
    description: 'The useColorScheme() hook lets you inspect what the user\'s current color scheme is.',
    link: 'https://docs.expo.dev/develop/user-interface/color-themes/',
  },
  {
    id: 5,
    icon: '✨',
    title: 'Animations',
    description: 'Includes animated components using react-native-reanimated library.',
    platformSpecific: true,
    link: 'https://docs.expo.dev/develop/user-interface/animations/',
  },
];

export default function TabTwoScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Dynamic colors based on theme
  const colors = {
    headerBg: isDark ? C.bg2 : '#f5f5f5',
    cardBg: isDark ? C.cardBg : '#ffffff',
    borderColor: isDark ? C.borderSoft : '#e0e0e0',
    textColor: isDark ? C.text : '#1a1a1a',
    textDim: isDark ? C.inkDim : '#666666',
    iconColor: isDark ? C.ink : '#333333',
  };

  return (
    <LinearGradient
      colors={isDark ? [C.bg2, C.bg] : ['#f5f5f5', '#ffffff']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 0.45 }}
      style={styles.root}
    >
      <ParallaxScrollView
        headerBackgroundColor={{ light: '#D0D0D0', dark: C.bg2 }}
        headerImage={
          <View style={[styles.headerContainer, { backgroundColor: isDark ? 'transparent' : '#f5f5f5' }]}>
            <LinearGradient
              colors={isDark 
                ? ['rgba(194,123,16,0.3)', 'rgba(194,123,16,0.05)']
                : ['rgba(194,123,16,0.15)', 'rgba(194,123,16,0.02)']
              }
              style={styles.headerGlow}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
            <View style={styles.headerContent}>
              <IconSymbol
                size={280}
                color={isDark ? C.ink : '#c27b10'}
                name="chevron.left.forwardslash.chevron.right"
                style={styles.headerImage}
              />
              <View style={styles.headerTextContainer}>
                <ThemedText style={[styles.headerTitle, { color: isDark ? C.ink : '#c27b10' }]}>
                  Explore
                </ThemedText>
                <ThemedText style={[styles.headerSubtitle, { color: isDark ? C.inkDim : '#666666' }]}>
                  Discover what's possible
                </ThemedText>
              </View>
            </View>
          </View>
        }
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.greetingContainer}>
          <ThemedText style={[styles.greetingText, { color: isDark ? C.ink : '#c27b10' }]}>
            Welcome to ONB
          </ThemedText>
          <ThemedText style={[styles.greetingSubtext, { color: isDark ? C.inkDim : '#666666' }]}>
            This app includes example code to help you get started.
          </ThemedText>
        </View>

        <View style={styles.featuresGrid}>
          {features.map((feature) => (
            <View 
              key={feature.id} 
              style={[
                styles.featureCard, 
                { 
                  backgroundColor: isDark ? C.cardBg : '#ffffff',
                  borderColor: isDark ? C.borderSoft : '#e0e0e0',
                }
              ]}
            >
              <View style={styles.featureHeader}>
                <ThemedText style={styles.featureIcon}>{feature.icon}</ThemedText>
                <ThemedText style={[styles.featureTitle, { color: isDark ? C.text : '#1a1a1a' }]}>
                  {feature.title}
                </ThemedText>
              </View>
              
              <ThemedText style={[styles.featureDescription, { color: isDark ? C.inkDim : '#666666' }]}>
                {feature.description}
              </ThemedText>

              {feature.hasImage && (
                <View style={[styles.imageContainer, { backgroundColor: isDark ? C.bg : '#f5f5f5' }]}>
                  <Image
                    source={require('@/assets/images/react-logo.png')}
                    style={styles.featureImage}
                    contentFit="contain"
                  />
                </View>
              )}

              {feature.platformSpecific && (
                <View style={[styles.platformBadge, { backgroundColor: isDark ? C.ringSoft : '#f5f5f5' }]}>
                  <Ionicons 
                    name={Platform.OS === 'ios' ? 'logo-apple' : 'logo-android'} 
                    size={14} 
                    color={isDark ? C.accent : '#c27b10'} 
                  />
                  <ThemedText style={[styles.platformText, { color: isDark ? C.accent : '#c27b10' }]}>
                    {Platform.OS === 'ios' ? 'iOS' : 'Android'}
                  </ThemedText>
                </View>
              )}

              {feature.link && (
                <ExternalLink href={feature.link}>
                  <View style={styles.linkContainer}>
                    <ThemedText style={[styles.linkText, { color: isDark ? C.ink : '#c27b10' }]}>
                      Learn more
                    </ThemedText>
                    <Ionicons name="arrow-forward" size={14} color={isDark ? C.ink : '#c27b10'} />
                  </View>
                </ExternalLink>
              )}
            </View>
          ))}
        </View>

        <View style={[styles.footerContainer, { borderTopColor: isDark ? C.borderSoft : '#e0e0e0' }]}>
          <ThemedText style={[styles.footerText, { color: isDark ? C.inkDim : '#666666' }]}>
            Built with ❤️ using Expo
          </ThemedText>
          <View style={styles.footerBadges}>
            <View style={[styles.badge, { backgroundColor: isDark ? C.bg : '#f5f5f5', borderColor: isDark ? C.borderSoft : '#e0e0e0' }]}>
              <ThemedText style={[styles.badgeText, { color: isDark ? C.inkDim : '#666666' }]}>
                v1.0.0
              </ThemedText>
            </View>
            <View style={[styles.badge, { backgroundColor: isDark ? C.bg : '#f5f5f5', borderColor: isDark ? C.borderSoft : '#e0e0e0' }]}>
              <ThemedText style={[styles.badgeText, { color: isDark ? C.inkDim : '#666666' }]}>
                React Native
              </ThemedText>
            </View>
            <View style={[styles.badge, { backgroundColor: isDark ? C.bg : '#f5f5f5', borderColor: isDark ? C.borderSoft : '#e0e0e0' }]}>
              <ThemedText style={[styles.badgeText, { color: isDark ? C.inkDim : '#666666' }]}>
                Expo
              </ThemedText>
            </View>
          </View>
        </View>
      </ParallaxScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  headerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  headerGlow: {
    position: 'absolute',
    top: -50,
    left: -50,
    right: -50,
    bottom: -50,
    borderRadius: 200,
    opacity: 0.5,
  },
  headerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  headerImage: {
    opacity: 0.6,
    marginBottom: -20,
  },
  headerTextContainer: {
    alignItems: 'center',
    marginTop: -20,
  },
  headerTitle: {
    fontSize: 36,
    fontFamily: 'Lato-Black',
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Lato-Regular',
    letterSpacing: 1,
    marginTop: 4,
  },
  greetingContainer: {
    marginBottom: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSoft,
  },
  greetingText: {
    fontSize: 22,
    fontFamily: 'Lato-Black',
    marginBottom: 8,
  },
  greetingSubtext: {
    fontSize: 14,
    fontFamily: 'Lato-Regular',
    lineHeight: 22,
  },
  featuresGrid: {
    gap: 16,
    marginBottom: 32,
  },
  featureCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  featureIcon: {
    fontSize: 24,
    lineHeight: 30,
  },
  featureTitle: {
    fontSize: 16,
    fontFamily: 'Lato-Bold',
    flex: 1,
  },
  featureDescription: {
    fontSize: 13,
    fontFamily: 'Lato-Regular',
    lineHeight: 20,
    marginBottom: 12,
  },
  imageContainer: {
    alignItems: 'center',
    marginVertical: 12,
    borderRadius: 12,
    padding: 16,
  },
  featureImage: {
    width: 80,
    height: 80,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  platformText: {
    fontSize: 12,
    fontFamily: 'Lato-Bold',
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  linkText: {
    fontSize: 13,
    fontFamily: 'Lato-Bold',
  },
  footerContainer: {
    alignItems: 'center',
    paddingTop: 24,
    borderTopWidth: 1,
    gap: 12,
  },
  footerText: {
    fontSize: 13,
    fontFamily: 'Lato-Regular',
  },
  footerBadges: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Lato-Bold',
    letterSpacing: 0.5,
  },
});