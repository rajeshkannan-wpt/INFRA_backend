import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useFonts } from 'expo-font';
import { Lato_400Regular, Lato_400Regular_Italic, Lato_700Bold, Lato_900Black } from '@expo-google-fonts/lato';
import { ThemeProvider, useThemeContext } from '@/providers/ThemeProvider';
import { SessionProvider } from '@/providers/SessionProvider';

function RootLayoutInner() {
  const { colorScheme, colors } = useThemeContext();

  const [fontsLoaded, fontError] = useFonts({
    'Lato-Black': Lato_900Black,
    'Lato-Italic': Lato_400Regular_Italic,
    'Lato-Regular': Lato_400Regular,
    'Lato-Bold': Lato_700Bold,
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const navTheme = colorScheme === 'dark'
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.tabBar, text: colors.text, border: colors.tabBarBorder, primary: colors.accent } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.tabBar, text: colors.text, border: colors.tabBarBorder, primary: colors.accent } };

  return (
    <NavThemeProvider value={navTheme}>
      <SessionProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="phone-entry" options={{ headerShown: false }} />
          <Stack.Screen name="legal-acceptance" options={{ headerShown: false }} />
          <Stack.Screen name="otp-entry" options={{ headerShown: false }} />
          <Stack.Screen name="profile-setup" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="scan" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        </Stack>
        <StatusBar style={colors.statusBar} />
      </SessionProvider>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}
