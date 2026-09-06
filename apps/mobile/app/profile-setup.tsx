// app/profile-setup.tsx
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { onboardingApi } from '@/api/onboardingApi';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  bg: '#0B0F14',
  bg2: '#15171C',
  inputBg: '#1C1C1E',
  border: '#2E323C',
  text: '#F3F3F4',
  textDim: '#9AA0AC',
  accent: '#3FC6B8',
  accentDim: 'rgba(63,198,184,0.12)',
  error: '#E5484D',
  success: '#3FC6B8',
};

const DEFAULT_ABOUT = "Hey there! I'm using ONB";

export default function ProfileSetupScreen() {
  const params = useLocalSearchParams<{ phoneNumber?: string; displayPhone?: string }>();
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [about, setAbout] = useState(DEFAULT_ABOUT);
  const [isLoading, setIsLoading] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  const hasVisibleChars = (text: string): boolean => text.trim().length > 0;
  const isNameValid = hasVisibleChars(name);
  const isFormValid = isNameValid;

  const handleAboutChange = (text: string) => setAbout(text);
  const handleAboutBlur = () => { if (!about.trim()) setAbout(DEFAULT_ABOUT); };

  const handlePickImage = async () => {
    try {
      setIsPickingImage(true);
      setShowPhotoModal(false);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) setPhoto(result.assets[0].uri);
    } catch {
      Alert.alert('Error', 'Failed to pick image.');
    } finally {
      setIsPickingImage(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      setIsPickingImage(true);
      setShowPhotoModal(false);
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera permissions.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) setPhoto(result.assets[0].uri);
    } catch {
      Alert.alert('Error', 'Failed to take photo.');
    } finally {
      setIsPickingImage(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
    setShowPhotoModal(false);
  };

  const getInitials = (): string => {
    if (!name.trim()) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const handleContinue = async () => {
    if (!isFormValid) {
      Alert.alert('Name Required', 'Please enter your name to continue.');
      return;
    }
    setIsLoading(true);
    try {
      await onboardingApi.createProfile({
        name: name.trim(),
        photo: photo || undefined,
        about: about.trim() || DEFAULT_ABOUT,
      });
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to set up profile.');
    } finally {
      setIsLoading(false);
    }
  };

  const displayPhone = params.displayPhone || params.phoneNumber || '';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.top}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={26} color={COLORS.accent} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Set up your profile</Text>
              <Text style={styles.sub}>
                Tell us about yourself. You can always change this later.
              </Text>
            </View>

            <View style={styles.photoSection}>
              <TouchableOpacity
                style={styles.photoContainer}
                onPress={() => setShowPhotoModal(true)}
                disabled={isLoading || isPickingImage}
                activeOpacity={0.7}
              >
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.photo} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoInitials}>{getInitials()}</Text>
                  </View>
                )}
                {(isPickingImage || isLoading) && (
                  <View style={styles.photoLoading}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                  </View>
                )}
                <View style={styles.photoEditBadge}>
                  <Ionicons name="camera" size={14} color={COLORS.bg} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>FULL NAME</Text>
              <View style={[
                styles.inputWrap,
                !isNameValid && name.length > 0 && styles.inputError
              ]}>
                <TextInput
                  style={styles.input}
                  value={name}
                  placeholder="Enter your full name"
                  placeholderTextColor={COLORS.textDim}
                  autoCapitalize="words"
                  autoComplete="name"
                  returnKeyType="next"
                  editable={!isLoading}
                  onChangeText={setName}
                />
              </View>
              {name.length > 0 && !isNameValid && (
                <Text style={styles.errorText}>Name cannot be empty</Text>
              )}
              {isNameValid && name.length > 0 && (
                <View style={styles.successContainer}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                  <Text style={styles.successText}>Looks good</Text>
                </View>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>ABOUT</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={[styles.input, styles.aboutInput]}
                  value={about}
                  placeholder="What's on your mind?"
                  placeholderTextColor={COLORS.textDim}
                  autoCapitalize="sentences"
                  returnKeyType="done"
                  editable={!isLoading}
                  onChangeText={handleAboutChange}
                  onBlur={handleAboutBlur}
                  multiline
                  numberOfLines={2}
                  maxLength={80}
                />
              </View>
              <Text style={styles.charCount}>{about.length}/80</Text>
            </View>

            <Pressable
              style={[styles.btn, (!isFormValid || isLoading) && styles.btnDisabled]}
              disabled={!isFormValid || isLoading}
              onPress={handleContinue}
            >
              <Text style={styles.btnText}>
                {isLoading ? 'Setting upâ€¦' : 'CONTINUE'}
              </Text>
            </Pressable>

            <Text style={styles.phoneNote}>
              Phone: {displayPhone}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Photo Modal (unchanged) */}
      <Modal
        visible={showPhotoModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <SafeAreaView style={styles.modalOverlay} edges={['bottom']}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Profile Photo</Text>
            <Text style={styles.modalSubtitle}>
              Choose a photo for your profile
            </Text>
            <View style={styles.modalOptions}>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={handleTakePhoto}
                activeOpacity={0.6}
              >
                <View style={[styles.modalIconContainer, styles.cameraIcon]}>
                  <Ionicons name="camera" size={28} color={COLORS.accent} />
                </View>
                <View style={styles.modalOptionText}>
                  <Text style={styles.modalOptionTitle}>Take Photo</Text>
                  <Text style={styles.modalOptionDesc}>Capture using camera</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textDim} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalOption}
                onPress={handlePickImage}
                activeOpacity={0.6}
              >
                <View style={[styles.modalIconContainer, styles.galleryIcon]}>
                  <Ionicons name="images" size={28} color={COLORS.accent} />
                </View>
                <View style={styles.modalOptionText}>
                  <Text style={styles.modalOptionTitle}>Choose from Gallery</Text>
                  <Text style={styles.modalOptionDesc}>Select from photos</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textDim} />
              </TouchableOpacity>

              {photo && (
                <TouchableOpacity
                  style={[styles.modalOption, styles.removeOption]}
                  onPress={handleRemovePhoto}
                  activeOpacity={0.6}
                >
                  <View style={[styles.modalIconContainer, styles.removeIcon]}>
                    <Ionicons name="trash-outline" size={24} color={COLORS.error} />
                  </View>
                  <View style={styles.modalOptionText}>
                    <Text style={[styles.modalOptionTitle, styles.removeText]}>
                      Remove Photo
                    </Text>
                    <Text style={styles.modalOptionDesc}>Delete current photo</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowPhotoModal(false)}
              activeOpacity={0.6}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// â”€â”€â”€ Styles â€“ content aligned to top â”€â”€â”€
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
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
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 4,              // ðŸ‘ˆ minimal top padding â€“ content starts near top
    paddingBottom: 40,
    // no justifyContent â€“ content sticks to top
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  header: {
    marginBottom: 20,           // reduced spacing
  },
  title: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
    fontFamily: 'Lato-Bold',
    textAlign: 'left',
  },
  sub: {
    color: COLORS.textDim,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Lato-Regular',
    textAlign: 'left',
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 24,           // reduced
  },
  photoContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.inputBg,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoInitials: {
    fontSize: 32,
    color: COLORS.text,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  photoLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.bg,
  },
  fieldGroup: {
    marginBottom: 20,           // reduced
  },
  label: {
    color: COLORS.textDim,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  inputWrap: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    overflow: 'hidden',
  },
  inputError: {
    borderColor: COLORS.error,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.text,
    fontSize: 16,
    minHeight: 48,
    fontFamily: 'Lato-Regular',
  },
  aboutInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 4,
    fontFamily: 'Lato-Regular',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  successText: {
    color: COLORS.success,
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Lato-Bold',
  },
  charCount: {
    color: COLORS.textDim,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
    fontFamily: 'Lato-Regular',
  },
  btn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.35,
  },
  btnText: {
    color: COLORS.bg,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: 'Lato-Bold',
  },
  phoneNote: {
    color: COLORS.textDim,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    fontFamily: 'Lato-Regular',
  },
  // Modal styles (unchanged)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.bg2,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.accentDim,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
    fontFamily: 'Lato-Bold',
  },
  modalSubtitle: {
    color: COLORS.textDim,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'Lato-Regular',
  },
  modalOptions: {
    gap: 12,
    marginBottom: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cameraIcon: {
    backgroundColor: COLORS.accentDim,
  },
  galleryIcon: {
    backgroundColor: COLORS.accentDim,
  },
  removeIcon: {
    backgroundColor: 'rgba(229,72,77,0.15)',
  },
  modalOptionText: {
    flex: 1,
  },
  modalOptionTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '500',
    fontFamily: 'Lato-Bold',
  },
  modalOptionDesc: {
    color: COLORS.textDim,
    fontSize: 12,
    marginTop: 1,
    fontFamily: 'Lato-Regular',
  },
  removeOption: {
    borderColor: 'rgba(229,72,77,0.3)',
  },
  removeText: {
    color: COLORS.error,
  },
  modalCancel: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelText: {
    color: COLORS.textDim,
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Lato-Bold',
  },
});