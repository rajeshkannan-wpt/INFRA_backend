import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  StatusBar,
  StatusBarStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/providers/ThemeProvider';
import { useSessionContext } from '@/providers/SessionProvider';
import { moderationApi } from '@/api/moderationApi';
import type { ThemeMode, ThemeColors } from '@/lib/theme';

const FONTS = {
  heading: 'Lato-Black',
  body: 'Lato-Regular',
  bodyMedium: 'Lato-Bold',
};

function ProfileCard({
  colors,
  phone,
}: {
  colors: ThemeColors;
  phone: string;
}) {
  return (
    <View style={[ss.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[ss.profileAvatar, { backgroundColor: colors.accentDim, borderColor: colors.accent }]}>
        <Text style={[ss.profileAvatarText, { color: colors.accent }]}>ONB</Text>
      </View>
      <View style={ss.profileInfo}>
        <Text style={[ss.profileName, { color: colors.text }]}>ONB User</Text>
        <Text style={[ss.profilePhone, { color: colors.textDim }]}>{phone || 'Not set'}</Text>
        <Text style={[ss.profileAbout, { color: colors.textMuted }]}>Hey there! I&apos;m using ONB</Text>
      </View>
    </View>
  );
}

function SectionHeader({ title, colors }: { title: string; colors: ThemeColors }) {
  return <Text style={[ss.sectionHeader, { color: colors.accent }]}>{title}</Text>;
}

function SettingRow({
  icon,
  label,
  value,
  onPress,
  colors,
  right,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  colors: ThemeColors;
  right?: React.ReactNode;
  danger?: boolean;
}) {
  const textColor = danger ? colors.danger : colors.text;
  const iconColor = danger ? colors.danger : colors.textDim;

  return (
    <TouchableOpacity
      style={[ss.settingRow, { borderBottomColor: colors.borderSoft }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
    >
      <View style={[ss.settingIconWrap, { backgroundColor: danger ? 'rgba(217,48,37,0.10)' : colors.accentDim }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[ss.settingLabel, { color: textColor }]}>{label}</Text>
      <View style={ss.settingRight}>
        {value ? <Text style={[ss.settingValue, { color: colors.textDim }]}>{value}</Text> : null}
        {right || (onPress && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />)}
      </View>
    </TouchableOpacity>
  );
}

function ThemePicker({
  colors,
  themeMode,
  setThemeMode,
}: {
  colors: ThemeColors;
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
}) {
  const options: { key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
    { key: 'light', label: 'Light', icon: 'sunny-outline' },
    { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  ];

  return (
    <View style={[ss.themePicker, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {options.map((opt) => {
        const active = themeMode === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[
              ss.themeOption,
              { borderColor: colors.border },
              active && { backgroundColor: colors.accentDim, borderColor: colors.accent },
            ]}
            onPress={() => setThemeMode(opt.key)}
            activeOpacity={0.7}
          >
            <Ionicons name={opt.icon} size={20} color={active ? colors.accent : colors.textDim} />
            <Text style={[ss.themeOptionLabel, { color: active ? colors.accent : colors.textDim }]}>{opt.label}</Text>
            {active && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const { colors, themeMode, setThemeMode } = useThemeContext();
  const { displayPhone, logout } = useSessionContext();
  const [readReceipts, setReadReceipts] = useState(true);
  const [lastSeen, setLastSeen] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [enterToSend, setEnterToSend] = useState(false);
  const [blockedCount, setBlockedCount] = useState(0);

  useEffect(() => {
    let alive = true;
    moderationApi
      .listBlocked()
      .then((res) => {
        if (alive) setBlockedCount(res.blockedPhoneHashes.length);
      })
      .catch(() => {
        /* ignore — count stays 0 if network/token unavailable */
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  const handleClearChats = () => {
    Alert.alert('Clear All Chats', 'This will permanently delete all chat messages. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => Alert.alert('Done', 'All chats cleared.') },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {} },
      ],
    );
  };

  return (
    <SafeAreaView style={[ss.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar barStyle={colors.statusBar as StatusBarStyle} backgroundColor={colors.bg} />

      <View style={[ss.header, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={ss.backButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.accent} />
        </TouchableOpacity>
        <Text style={[ss.headerTitle, { color: colors.text }]}>Settings</Text>
      </View>

      <ScrollView
        style={ss.scroll}
        contentContainerStyle={ss.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ProfileCard colors={colors} phone={displayPhone || ''} />

        <SectionHeader title="Scan & Link" colors={colors} />
        <View style={[ss.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            icon="qr-code-outline"
            label="Scan QR Code"
            value="Open web app"
            colors={colors}
            onPress={() => router.push('/scan')}
          />
        </View>

        <SectionHeader title="Account" colors={colors} />
        <View style={[ss.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="person-outline" label="Edit Profile" colors={colors} onPress={() => {}} />
          <SettingRow icon="call-outline" label="Phone Number" value={displayPhone || ''} colors={colors} />
          <SettingRow icon="key-outline" label="Change Password" colors={colors} onPress={() => {}} />
          <SettingRow icon="shield-checkmark-outline" label="Two-Factor Auth" value="Off" colors={colors} onPress={() => {}} />
        </View>

        <SectionHeader title="Privacy" colors={colors} />
        <View style={[ss.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            icon="eye-outline"
            label="Last Seen & Online"
            colors={colors}
            right={
              <Switch
                value={lastSeen}
                onValueChange={setLastSeen}
                trackColor={{ false: colors.toggleBg, true: colors.toggleActive }}
                thumbColor={colors.toggleKnob}
              />
            }
          />
          <SettingRow icon="image-outline" label="Profile Photo" value="Everyone" colors={colors} onPress={() => {}} />
          <SettingRow
            icon="checkmark-done-outline"
            label="Read Receipts"
            colors={colors}
            right={
              <Switch
                value={readReceipts}
                onValueChange={setReadReceipts}
                trackColor={{ false: colors.toggleBg, true: colors.toggleActive }}
                thumbColor={colors.toggleKnob}
              />
            }
          />
          <SettingRow icon="ban-outline" label="Blocked Contacts" value={String(blockedCount)} colors={colors} onPress={() => router.push('/blocked-contacts')} />
        </View>

        <SectionHeader title="Notifications" colors={colors} />
        <View style={[ss.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            icon="notifications-outline"
            label="Message Notifications"
            colors={colors}
            right={
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: colors.toggleBg, true: colors.toggleActive }}
                thumbColor={colors.toggleKnob}
              />
            }
          />
          <SettingRow
            icon="volume-high-outline"
            label="Sound & Vibration"
            colors={colors}
            right={
              <Switch
                value={soundEnabled}
                onValueChange={setSoundEnabled}
                trackColor={{ false: colors.toggleBg, true: colors.toggleActive }}
                thumbColor={colors.toggleKnob}
              />
            }
          />
        </View>

        <SectionHeader title="Chats" colors={colors} />
        <View style={[ss.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="text-outline" label="Font Size" value="Default" colors={colors} onPress={() => {}} />
          <SettingRow
            icon="keypad-outline"
            label="Enter to Send"
            colors={colors}
            right={
              <Switch
                value={enterToSend}
                onValueChange={setEnterToSend}
                trackColor={{ false: colors.toggleBg, true: colors.toggleActive }}
                thumbColor={colors.toggleKnob}
              />
            }
          />
          <SettingRow icon="download-outline" label="Media Auto-Download" value="Wi-Fi" colors={colors} onPress={() => {}} />
          <SettingRow icon="cloud-upload-outline" label="Chat Backup" value="Never" colors={colors} onPress={() => {}} />
        </View>

        <SectionHeader title="Appearance" colors={colors} />
        <ThemePicker colors={colors} themeMode={themeMode} setThemeMode={setThemeMode} />

        <SectionHeader title="Data & Storage" colors={colors} />
        <View style={[ss.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="analytics-outline" label="Network Usage" value="0 KB" colors={colors} onPress={() => {}} />
          <SettingRow icon="server-outline" label="Storage Usage" colors={colors} onPress={() => {}} />
        </View>

        <SectionHeader title="About" colors={colors} />
        <View style={[ss.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="information-circle-outline" label="Version" value="1.0.0" colors={colors} />
          <SettingRow icon="document-text-outline" label="Terms of Service" colors={colors} onPress={() => {}} />
          <SettingRow icon="shield-outline" label="Privacy Policy" colors={colors} onPress={() => {}} />
          <SettingRow icon="code-outline" label="Open Source Licenses" colors={colors} onPress={() => {}} />
        </View>

        <SectionHeader title="Account Actions" colors={colors} />
        <View style={[ss.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="trash-outline" label="Clear All Chats" colors={colors} onPress={handleClearChats} danger />
          <SettingRow icon="log-out-outline" label="Log Out" colors={colors} onPress={handleLogout} danger />
          <SettingRow icon="close-circle-outline" label="Delete Account" colors={colors} onPress={handleDeleteAccount} danger />
        </View>

        <Text style={[ss.footer, { color: colors.textMuted }]}>ONB — End-to-end encrypted messaging</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 26, fontFamily: FONTS.heading },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginRight: 14,
  },
  profileAvatarText: { fontSize: 18, fontWeight: '700', fontFamily: FONTS.bodyMedium },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '600', fontFamily: FONTS.bodyMedium },
  profilePhone: { fontSize: 13, fontFamily: FONTS.body, marginTop: 2 },
  profileAbout: { fontSize: 12, fontFamily: FONTS.body, marginTop: 4 },

  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: FONTS.bodyMedium,
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
  },
  sectionCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingLabel: { flex: 1, fontSize: 15, fontFamily: FONTS.body },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  settingValue: { fontSize: 13, fontFamily: FONTS.body, marginRight: 2 },

  themePicker: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
    borderColor: 'transparent',
  },
  themeOptionLabel: { flex: 1, fontSize: 15, fontFamily: FONTS.body },

  footer: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 32,
    fontFamily: FONTS.body,
  },
});
