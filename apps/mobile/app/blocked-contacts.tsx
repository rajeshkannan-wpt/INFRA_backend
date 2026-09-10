// app/blocked-contacts.tsx
//
// DB-2.4 — Blocked contacts management.
//
// Lists the current user's blocked contacts (keyed by phone hash),
// allowing blocking a new contact (from the device contact picker) and
// unblocking any blocked hash.
//
// NOTE: The backend returns only the phone_hash (never the raw E.164
// number) for blocked contacts. We therefore show the hash, but a
// "Block" flow uses the full device contact book, so the user can pick
// a real person by name/phone to block.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  StatusBar,
  StatusBarStyle,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { useThemeContext } from '@/providers/ThemeProvider';
import { moderationApi } from '@/api/moderationApi';

const FONTS = {
  heading: 'Lato-Black',
  body: 'Lato-Regular',
  bodyMedium: 'Lato-Bold',
};

interface Contact {
  id: string;
  name: string;
  phone: string;
  initials: string;
}

function truncateHash(hash: string): string {
  if (!hash) return '';
  if (hash.length <= 24) return hash;
  return `${hash.slice(0, 12)}…${hash.slice(-8)}`;
}

export default function BlockedContactsScreen() {
  const { colors } = useThemeContext();

  const [blockedHashes, setBlockedHashes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const loadBlocked = useCallback(async () => {
    setLoading(true);
    try {
      const res = await moderationApi.listBlocked();
      setBlockedHashes(res.blockedPhoneHashes);
    } catch {
      Alert.alert('Error', 'Could not load blocked contacts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBlocked();
  }, [loadBlocked]);

  const loadContactsForPicker = async () => {
    setLoadingContacts(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow contacts access to block a contact.');
        setLoadingContacts(false);
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });
      const list: Contact[] = data
        .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0)
        .map((c) => {
          const name = c.name || 'Unknown';
          const phone = c.phoneNumbers?.[0]?.number || '';
          const initials = name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
          return { id: c.id || `contact-${Date.now()}`, name, phone, initials };
        });
      setContacts(list);
      setPickerVisible(true);
    } catch {
      Alert.alert('Error', 'Could not load contacts.');
    } finally {
      setLoadingContacts(false);
    }
  };

  const openPicker = () => {
    loadContactsForPicker();
  };

  const normalizePhone = (p: string) => p.replace(/[^\d+]/g, '');

  const blockContact = async (phone: string) => {
    try {
      const res = await moderationApi.block(phone);
      setBlockedHashes((prev) => [res.blockedPhoneHash, ...prev]);
      setPickerVisible(false);
      Alert.alert('Blocked', 'This contact can no longer message you.');
    } catch {
      Alert.alert('Error', 'Could not block this contact.');
    }
  };

  const unblock = (hash: string) => {
    Alert.alert(
      'Unblock',
      'Unblock this contact? They will be able to message you again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: async () => {
            try {
              await moderationApi.unblock({ blockedPhoneHash: hash });
              setBlockedHashes((prev) => prev.filter((h) => h !== hash));
              Alert.alert('Unblocked', 'This contact can message you again.');
            } catch {
              Alert.alert('Error', 'Could not unblock this contact.');
            }
          },
        },
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
        <Text style={[ss.headerTitle, { color: colors.text }]}>Blocked Contacts</Text>
      </View>

      {loading ? (
        <View style={ss.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : blockedHashes.length === 0 ? (
        <View style={ss.center}>
          <View style={[ss.emptyIcon, { backgroundColor: colors.accentDim }]}>
            <Ionicons name="ban-outline" size={44} color={colors.accent} />
          </View>
          <Text style={[ss.emptyTitle, { color: colors.text }]}>No blocked contacts</Text>
          <Text style={[ss.emptySub, { color: colors.textDim }]}>
            Block a contact to stop them from messaging you.
          </Text>
        </View>
      ) : (
        <FlatList
          data={blockedHashes}
          keyExtractor={(item) => item}
          style={ss.list}
          contentContainerStyle={ss.listContent}
          renderItem={({ item }) => (
            <View style={[ss.row, { borderBottomColor: colors.borderSoft }]}>
              <View style={[ss.avatar, { backgroundColor: colors.accentDim }]}>
                <Ionicons name="person" size={20} color={colors.accent} />
              </View>
              <View style={ss.info}>
                <Text style={[ss.hash, { color: colors.text }]}>{truncateHash(item)}</Text>
                <Text style={[ss.hashSub, { color: colors.textDim }]}>Phone (hashed)</Text>
              </View>
              <TouchableOpacity
                style={[ss.unblockBtn, { backgroundColor: colors.accentDim }]}
                onPress={() => unblock(item)}
              >
                <Text style={[ss.unblockText, { color: colors.accent }]}>Unblock</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <TouchableOpacity
        style={[ss.fab, { backgroundColor: colors.accent }]}
        onPress={openPicker}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={colors.bg} />
      </TouchableOpacity>

      <Modal
        visible={pickerVisible}
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
        transparent={false}
      >
        <SafeAreaView style={[ss.modalContainer, { backgroundColor: colors.bg }]}>
          <View style={[ss.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setPickerVisible(false)} style={ss.backButton}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
            <Text style={[ss.modalTitle, { color: colors.text }]}>Block a contact</Text>
            <View style={{ width: 28 }} />
          </View>

          {loadingContacts ? (
            <View style={ss.center}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : (
            <FlatList
              data={contacts}
              keyExtractor={(c) => c.id}
              contentContainerStyle={ss.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[ss.contactItem, { borderBottomColor: colors.borderSoft }]}
                  onPress={() => blockContact(normalizePhone(item.phone))}
                >
                  <View style={[ss.avatar, { backgroundColor: colors.accentDim }]}>
                    <Text style={[ss.avatarText, { color: colors.accent }]}>{item.initials}</Text>
                  </View>
                  <View style={ss.info}>
                    <Text style={[ss.hash, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[ss.hashSub, { color: colors.textDim }]}>{item.phone}</Text>
                  </View>
                  <Ionicons name="ban-outline" size={20} color={colors.danger} />
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
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

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 6, fontFamily: FONTS.heading },
  emptySub: { fontSize: 14, textAlign: 'center', fontFamily: FONTS.body },

  list: { flex: 1 },
  listContent: { paddingBottom: 80 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 15, fontWeight: '600', fontFamily: FONTS.bodyMedium },
  info: { flex: 1 },
  hash: { fontSize: 15, fontFamily: FONTS.bodyMedium },
  hashSub: { fontSize: 12, fontFamily: FONTS.body, marginTop: 1 },
  unblockBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  unblockText: { fontSize: 13, fontFamily: FONTS.bodyMedium },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },

  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 17, fontWeight: '600', fontFamily: FONTS.bodyMedium },
  modalList: { paddingHorizontal: 16, paddingBottom: 20 },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});