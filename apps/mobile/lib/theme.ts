export type ThemeMode = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

export type ThemeColors = {
  bg: string;
  bg2: string;
  bg3: string;
  text: string;
  textDim: string;
  textMuted: string;
  accent: string;
  accentDim: string;
  border: string;
  borderSoft: string;
  card: string;
  inputBg: string;
  error: string;
  success: string;
  incomingBubble: string;
  outgoingBubble: string;
  tabBar: string;
  tabBarBorder: string;
  statusBar: 'light' | 'dark' | 'auto' | 'inverted';
  navBackground: string;
  searchBg: string;
  skeleton: string;
  overlay: string;
  danger: string;
  toggleBg: string;
  toggleKnob: string;
  toggleActive: string;
};

export const darkColors: ThemeColors = {
  bg: '#0B0F14',
  bg2: '#15171C',
  bg3: '#1C1C1E',
  text: '#F3F3F4',
  textDim: '#9AA0AC',
  textMuted: '#6B7280',
  accent: '#3FC6B8',
  accentDim: 'rgba(63,198,184,0.12)',
  border: '#2E323C',
  borderSoft: '#23272F',
  card: '#12151B',
  inputBg: '#1C1C1E',
  error: '#E5484D',
  success: '#3FC6B8',
  incomingBubble: '#2C2C2E',
  outgoingBubble: '#3FC6B8',
  tabBar: '#1C1F26',
  tabBarBorder: '#2E323C',
  statusBar: 'light',
  navBackground: '#0B0F14',
  searchBg: '#15171C',
  skeleton: '#1C1C1E',
  overlay: 'rgba(0,0,0,0.6)',
  danger: '#E5484D',
  toggleBg: '#2E323C',
  toggleKnob: '#F3F3F4',
  toggleActive: '#3FC6B8',
};

export const lightColors: ThemeColors = {
  bg: '#FFFFFF',
  bg2: '#F5F6F8',
  bg3: '#ECEEF1',
  text: '#11181C',
  textDim: '#5F6B7A',
  textMuted: '#9AA0AC',
  accent: '#0E8A7E',
  accentDim: 'rgba(14,138,126,0.10)',
  border: '#E2E4E8',
  borderSoft: '#ECEEF1',
  card: '#F5F6F8',
  inputBg: '#F5F6F8',
  error: '#D93025',
  success: '#0E8A7E',
  incomingBubble: '#F0F1F3',
  outgoingBubble: '#D6F5ED',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E2E4E8',
  statusBar: 'dark',
  navBackground: '#FFFFFF',
  searchBg: '#F5F6F8',
  skeleton: '#ECEEF1',
  overlay: 'rgba(0,0,0,0.35)',
  danger: '#D93025',
  toggleBg: '#D1D5DB',
  toggleKnob: '#FFFFFF',
  toggleActive: '#0E8A7E',
};

export const themes: Record<ColorScheme, ThemeColors> = {
  dark: darkColors,
  light: lightColors,
};
