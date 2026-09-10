import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  StatusBarStyle,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useThemeContext } from '@/providers/ThemeProvider';

const FONTS = {
  heading: 'Lato-Black',
  body: 'Lato-Regular',
  bodyMedium: 'Lato-Bold',
};

function isHttpUrl(value: string): boolean {
  return /^https?:\/\/.+/i.test(value.trim());
}

export default function ScanScreen() {
  const { colors } = useThemeContext();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [opening, setOpening] = useState(false);
  const openedRef = useRef<string | null>(null);

  const handleScanned = async (result: BarcodeScanningResult) => {
    if (!scanning || opening) return;
    const data = result.data.trim();
    if (!data || openedRef.current === data) return;

    setScanning(false);
    openedRef.current = data;

    if (!isHttpUrl(data)) {
      Alert.alert('Invalid QR code', 'This QR code does not contain a valid link.', [
        { text: 'OK', onPress: () => setScanning(true) },
      ]);
      return;
    }

    Alert.alert('Open link', data, [
      { text: 'Cancel', style: 'cancel', onPress: () => setScanning(true) },
      {
        text: 'Open',
        onPress: async () => {
          try {
            setOpening(true);
            await Linking.openURL(data);
          } catch {
            Alert.alert('Error', 'Could not open this link.');
          } finally {
            setOpening(false);
            setScanning(true);
          }
        },
      },
    ]);
  };

  const requestCamera = async () => {
    const res = await requestPermission();
    if (!res.granted) {
      Alert.alert(
        'Camera permission required',
        'Please enable camera access to scan QR codes. You can enable it in device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: () => Linking.openSettings() },
        ],
      );
    }
  };

  let body: React.ReactNode;

  if (!permission) {
    body = (
      <View style={[ss.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  } else if (!permission.granted) {
    body = (
      <View style={[ss.center, { backgroundColor: colors.bg }]}>
        <View style={[ss.iconWrap, { backgroundColor: colors.accentDim }]}>
          <Ionicons name="camera-outline" size={44} color={colors.accent} />
        </View>
        <Text style={[ss.permTitle, { color: colors.text }]}>Camera access needed</Text>
        <Text style={[ss.permText, { color: colors.textDim }]}>
          Allow camera access to scan a QR code and open the messaging web app.
        </Text>
        <TouchableOpacity
          style={[ss.permButton, { backgroundColor: colors.accent }]}
          onPress={requestCamera}
          activeOpacity={0.8}
        >
          <Text style={[ss.permButtonText, { color: colors.bg }]}>Enable Camera</Text>
        </TouchableOpacity>
      </View>
    );
  } else {
    body = (
      <View style={ss.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanning ? handleScanned : undefined}
        />
        <View style={ss.scanFrame} pointerEvents="none">
          <View style={[ss.scanFrameBox, { borderColor: colors.accent }]} />
          <Text style={[ss.scanHint, { color: colors.text }]}>
            Point the camera at the QR code
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[ss.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={colors.statusBar as StatusBarStyle} backgroundColor={colors.bg} />

      <View style={[ss.header, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={ss.backButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.accent} />
        </TouchableOpacity>
        <Text style={[ss.headerTitle, { color: colors.text }]}>Scan QR Code</Text>
      </View>

      <View style={ss.body}>{body}</View>
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
  body: { flex: 1 },

  cameraWrap: { flex: 1, overflow: 'hidden' },
  scanFrame: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrameBox: {
    width: 240,
    height: 240,
    borderRadius: 18,
    borderWidth: 3,
    backgroundColor: 'transparent',
  },
  scanHint: {
    marginTop: 20,
    fontSize: 15,
    fontFamily: FONTS.body,
    textAlign: 'center',
    paddingHorizontal: 24,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  permTitle: { fontSize: 19, fontFamily: FONTS.heading, marginBottom: 8, textAlign: 'center' },
  permText: { fontSize: 14, fontFamily: FONTS.body, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  permButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permButtonText: { fontSize: 15, fontFamily: FONTS.bodyMedium },
});
