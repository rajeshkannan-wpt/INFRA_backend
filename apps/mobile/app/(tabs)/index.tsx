import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  StatusBar,
  StatusBarStyle,
  Platform,
  Modal,
  Alert,
  Keyboard,
  ActivityIndicator,
  Linking,
  RefreshControl,
  Animated as RNAnimated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useThemeContext } from '@/providers/ThemeProvider';
import { useSessionContext } from '@/providers/SessionProvider';
import * as Contacts from 'expo-contacts';
import type { ThemeColors } from '@/lib/theme';

const FONTS = {
  heading: 'Lato-Black',
  body: 'Lato-Regular',
  bodyMedium: 'Lato-Bold',
};

interface Message {
  id: string;
  text: string;
  sent: boolean;
  time: string;
  dateKey: string;
  status?: 'sent' | 'delivered' | 'read';
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  initials: string;
  avatar: string | null;
}

interface Chat {
  id: string;
  contact: Contact;
  messages: Message[];
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

type ChatEntry = { message: Message } | { dateKey: string };

function getDateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDateSeparator(dateKey: string): string {
  const parts = dateKey.split('-').map(Number);
  const d = new Date(parts[0], parts[1], parts[2]);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  const diff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 7) {
    return d.toLocaleDateString(undefined, { weekday: 'long' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function shouldGroupMessages(a: Message, b: Message): boolean {
  if (a.sent !== b.sent) return false;
  const tA = a.time.split(':').map(Number);
  const tB = b.time.split(':').map(Number);
  const minsA = tA[0] * 60 + tA[1];
  const minsB = tB[0] * 60 + tB[1];
  return Math.abs(minsA - minsB) < 1;
}

function Header({
  colors,
  onSearchPress,
  onMenuPress,
}: {
  colors: ThemeColors;
  onSearchPress: () => void;
  onMenuPress: () => void;
}) {
  const { displayPhone } = useSessionContext();
  return (
    <View style={[s.header, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
      <View>
        <Text style={[s.headerTitle, { color: colors.text }]}>Chats</Text>
        {displayPhone ? (
          <Text style={[s.headerSubtitle, { color: colors.textDim }]}>{displayPhone}</Text>
        ) : null}
      </View>
      <View style={s.headerRight}>
        <TouchableOpacity style={s.headerIcon} onPress={onSearchPress} hitSlop={8}>
          <Ionicons name="search-outline" size={22} color={colors.textDim} />
        </TouchableOpacity>
        <TouchableOpacity style={s.headerIcon} onPress={onMenuPress} hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={22} color={colors.textDim} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Avatar({
  contact,
  colors,
  size = 50,
  online,
}: {
  contact: Contact;
  colors: ThemeColors;
  size?: number;
  online?: boolean;
}) {
  const r = size / 2;
  return (
    <View style={{ position: 'relative', marginRight: 14 }}>
      {contact.avatar ? (
        <Image source={{ uri: contact.avatar }} style={{ width: size, height: size, borderRadius: r }} />
      ) : (
        <View
          style={[
            s.avatarPlaceholder,
            { width: size, height: size, borderRadius: r, backgroundColor: colors.accentDim, borderColor: colors.border },
          ]}
        >
          <Text style={[s.avatarText, { color: colors.accent, fontSize: size * 0.38 }]}>
            {contact.initials}
          </Text>
        </View>
      )}
      {online && (
        <View
          style={[
            s.onlineDot,
            {
              backgroundColor: '#22C55E',
              width: size * 0.24,
              height: size * 0.24,
              borderRadius: size * 0.12,
              borderWidth: 2,
              borderColor: colors.bg,
            },
          ]}
        />
      )}
    </View>
  );
}

function ChatItem({
  chat,
  colors,
  onPress,
}: {
  chat: Chat;
  colors: ThemeColors;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.chatItem, { borderBottomColor: colors.borderSoft }]}
      activeOpacity={0.6}
      onPress={onPress}
    >
      <Avatar contact={chat.contact} colors={colors} />
      <View style={s.chatInfo}>
        <View style={s.chatTop}>
          <Text style={[s.chatName, { color: colors.text }]} numberOfLines={1}>
            {chat.contact.name}
          </Text>
          <Text style={[s.chatTime, { color: chat.unreadCount ? colors.accent : colors.textDim }]}>
            {chat.lastMessageTime || ''}
          </Text>
        </View>
        <View style={s.chatBottom}>
          <Text style={[s.chatMessage, { color: colors.textDim }]} numberOfLines={1}>
            {chat.lastMessage || 'No messages yet'}
          </Text>
          {chat.unreadCount && chat.unreadCount > 0 ? (
            <View style={[s.unreadBadge, { backgroundColor: colors.accent }]}>
              <Text style={s.unreadText}>{chat.unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ colors }: { colors: ThemeColors }) {
  return (
    <View style={s.emptyContainer}>
      <View style={[s.emptyIconContainer, { backgroundColor: colors.accentDim, borderColor: colors.border }]}>
        <Ionicons name="chatbubbles-outline" size={48} color={colors.accent} />
      </View>
      <Text style={[s.emptyTitle, { color: colors.text }]}>No chats yet</Text>
      <Text style={[s.emptySubtitle, { color: colors.textDim }]}>
        Tap the button below to start a conversation.
      </Text>
    </View>
  );
}

function ContactPickerModal({
  visible,
  onClose,
  onSelectContact,
  loading,
  contacts,
  permissionDenied,
  onRequestPermission,
  onOpenSettings,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectContact: (contact: Contact) => void;
  loading: boolean;
  contacts: Contact[];
  permissionDenied: boolean;
  onRequestPermission: () => void;
  onOpenSettings: () => void;
  colors: ThemeColors;
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery),
  );

  const renderItem = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={[s.contactItem, { borderBottomColor: colors.borderSoft }]}
      onPress={() => { onSelectContact(item); onClose(); }}
    >
      <Avatar contact={item} colors={colors} size={44} />
      <View style={s.contactInfo}>
        <Text style={[s.contactName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[s.contactPhone, { color: colors.textDim }]}>{item.phone}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <SafeAreaView style={[s.modalContainer, { backgroundColor: colors.bg }]}>
        <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={s.modalBackButton}>
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.modalTitle, { color: colors.text }]}>Select contact</Text>
          <View style={{ width: 28 }} />
        </View>

        {permissionDenied ? (
          <View style={s.modalEmpty}>
            <Ionicons name="lock-closed-outline" size={44} color={colors.textDim} />
            <Text style={[s.modalEmptyText, { color: colors.textDim }]}>Permission denied</Text>
            <TouchableOpacity style={[s.emptyButton, { backgroundColor: colors.accent }]} onPress={onOpenSettings}>
              <Text style={[s.emptyButtonText, { color: colors.bg }]}>Open Settings</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={s.modalEmpty}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[s.modalEmptyText, { color: colors.textDim }]}>Loading contacts...</Text>
          </View>
        ) : (
          <>
            <View style={[s.searchContainer, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
              <View style={[s.searchInputContainer, { backgroundColor: colors.searchBg, borderColor: colors.border }]}>
                <Ionicons name="search" size={18} color={colors.textDim} />
                <TextInput
                  style={[s.searchInput, { color: colors.text }]}
                  placeholder="Search contacts..."
                  placeholderTextColor={colors.textDim}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={s.modalList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={[s.modalEmptyText, { color: colors.textDim }]}>No contacts found</Text>
              }
            />
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function MessageBubble({
  item,
  colors,
  isGrouped,
}: {
  item: Message;
  colors: ThemeColors;
  isGrouped: boolean;
}) {
  return (
    <View
      style={[
        s.messageRow,
        item.sent ? s.messageRowSent : s.messageRowReceived,
        isGrouped && { marginBottom: 3 },
      ]}
    >
      <View
        style={[
          s.messageBubble,
          item.sent
            ? [s.sentBubble, { backgroundColor: colors.outgoingBubble }]
            : [s.receivedBubble, { backgroundColor: colors.incomingBubble }],
          isGrouped && item.sent && { borderTopRightRadius: 16 },
          isGrouped && !item.sent && { borderTopLeftRadius: 16 },
        ]}
      >
        <Text style={[s.messageText, { color: item.sent ? (colors.outgoingBubble === '#3FC6B8' ? '#0B0F14' : colors.text) : colors.text }]}>
          {item.text}
        </Text>
        <View style={s.messageMeta}>
          <Text style={[s.messageTime, { color: item.sent ? 'rgba(0,0,0,0.45)' : colors.textDim }]}>
            {item.time}
          </Text>
          {item.sent && (
            <Ionicons
              name={
                item.status === 'read'
                  ? 'checkmark-done'
                  : item.status === 'delivered'
                  ? 'checkmark-done'
                  : 'checkmark'
              }
              size={14}
              color={item.status === 'read' ? '#53BDEB' : item.sent ? 'rgba(0,0,0,0.35)' : colors.textDim}
              style={{ marginLeft: 3 }}
            />
          )}
        </View>
      </View>
    </View>
  );
}

function TypingIndicator({ colors }: { colors: ThemeColors }) {
  const anim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        RNAnimated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const dotStyle = (delay: number) => ({
    opacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.9],
    }),
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -3],
        }),
      },
    ],
  });

  return (
    <View style={[s.typingContainer]}>
      <View style={[s.messageBubble, s.receivedBubble, { backgroundColor: colors.incomingBubble }]}>
        <View style={s.typingDots}>
          <RNAnimated.View style={[s.typingDot, { backgroundColor: colors.textDim }, dotStyle(0)]} />
          <RNAnimated.View style={[s.typingDot, { backgroundColor: colors.textDim }, dotStyle(100)]} />
          <RNAnimated.View style={[s.typingDot, { backgroundColor: colors.textDim }, dotStyle(200)]} />
        </View>
      </View>
    </View>
  );
}

function ChatView({
  chat,
  colors,
  onBack,
  setChatMessages,
}: {
  chat: Chat;
  colors: ThemeColors;
  onBack: () => void;
  setChatMessages: (chatId: string, messages: Message[]) => void;
}) {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyboardHeight = useKeyboardHeight();

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chat.messages, scrollToBottom]);

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', scrollToBottom);
    return () => sub.remove();
  }, [scrollToBottom]);

  const sendMessage = () => {
    if (!inputText.trim()) return;
    const now = new Date();
    const newMsg: Message = {
      id: `m${Date.now()}`,
      text: inputText.trim(),
      sent: true,
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dateKey: getDateKey(now),
      status: 'sent',
    };
    const updatedMessages = [...chat.messages, newMsg];
    setChatMessages(chat.id, updatedMessages);
    setInputText('');

    // Simulate delivery
    setTimeout(() => {
      setChatMessages(
        chat.id,
        updatedMessages.map((m) => (m.id === newMsg.id ? { ...m, status: 'delivered' } : m)),
      );
    }, 600);

    // Simulate reply
    setIsTyping(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      setIsTyping(false);
      const replies = [
        "That's great!",
        'Got it, thanks!',
        'Sounds good to me.',
        'I agree.',
        'Let me think about that.',
        'Sure, no problem.',
        "I'll get back to you.",
        'Awesome!',
      ];
      const replyTime = new Date();
      const reply: Message = {
        id: `m${Date.now() + 1}`,
        text: replies[Math.floor(Math.random() * replies.length)],
        sent: false,
        time: replyTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dateKey: getDateKey(replyTime),
      };
      const newMessages = [...updatedMessages, reply];
      setChatMessages(chat.id, newMessages);
      // Mark original as read
      setTimeout(() => {
        setChatMessages(
          chat.id,
          newMessages.map((m) => (m.id === newMsg.id ? { ...m, status: 'read' } : m)),
        );
      }, 300);
    }, 1000 + Math.random() * 1500);
  };

  const handleScroll = (e: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const isAtBottom = contentSize.height - layoutMeasurement.height - contentOffset.y < 80;
    setShowScrollDown(!isAtBottom);
  };

  const renderItem = ({ item, index }: { item: ChatEntry; index: number }) => {
    if ('message' in item) {
      const prev = index > 0 ? chat.messages[index - 1] : null;
      const isGrouped = prev ? shouldGroupMessages(prev, item.message) : false;
      return <MessageBubble item={item.message} colors={colors} isGrouped={isGrouped} />;
    }
    return (
      <View style={s.dateSeparatorContainer}>
        <View style={[s.dateSeparatorPill, { backgroundColor: colors.card }]}>
          <Text style={[s.dateSeparatorText, { color: colors.textDim }]}>{formatDateSeparator(item.dateKey)}</Text>
        </View>
      </View>
    );
  };

  const chatEntries: ChatEntry[] = useMemo(() => {
    const entries: ChatEntry[] = [];
    let lastDateKey = '';
    chat.messages.forEach((msg) => {
      if (msg.dateKey !== lastDateKey) {
        entries.push({ dateKey: msg.dateKey });
        lastDateKey = msg.dateKey;
      }
      entries.push({ message: msg });
    });
    return entries;
  }, [chat.messages]);

  const hasText = inputText.trim().length > 0;

  return (
    <View style={[s.chatView, { backgroundColor: colors.bg }]}>
      <View style={[s.chatHeader, { backgroundColor: colors.bg2, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={s.backButton}>
          <Ionicons name="chevron-back" size={26} color={colors.accent} />
        </TouchableOpacity>
        <Avatar contact={chat.contact} colors={colors} size={38} online />
        <View style={s.chatHeaderInfo}>
          <Text style={[s.chatHeaderName, { color: colors.text }]}>{chat.contact.name}</Text>
          <Text style={[s.chatHeaderStatus, { color: colors.textDim }]}>online</Text>
        </View>
        <TouchableOpacity style={s.chatHeaderIcon}>
          <Ionicons name="call-outline" size={22} color={colors.textDim} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.chatHeaderIcon, { marginLeft: 8 }]}>
          <Ionicons name="ellipsis-vertical" size={22} color={colors.textDim} />
        </TouchableOpacity>
      </View>

      <View style={s.chatBody}>
        <FlatList
          ref={flatListRef}
          data={chatEntries}
          keyExtractor={(item, index) => ('message' in item ? item.message.id : `date-${item.dateKey}-${index}`)}
          renderItem={renderItem}
          contentContainerStyle={[s.messagesList, { paddingBottom: 80 + keyboardHeight }]}
          ListFooterComponent={isTyping ? <TypingIndicator colors={colors} /> : null}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />

        {showScrollDown && (
          <TouchableOpacity
            style={[s.scrollDownFab, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={scrollToBottom}
          >
            <Ionicons name="chevron-down" size={22} color={colors.textDim} />
          </TouchableOpacity>
        )}

        <View style={[s.inputBar, { backgroundColor: colors.bg2, borderTopColor: colors.border, paddingBottom: keyboardHeight > 0 ? keyboardHeight + 8 : 12 }]}>
          <TouchableOpacity style={s.attachButton}>
            <Ionicons name="add-circle-outline" size={28} color={colors.textDim} />
          </TouchableOpacity>
          <View style={[s.inputFieldContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <TextInput
              style={[s.inputField, { color: colors.text }]}
              placeholder="Type a message..."
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              returnKeyType="send"
              onSubmitEditing={sendMessage}
              multiline
            />
          </View>
          <TouchableOpacity
            style={[s.sendButton, { backgroundColor: hasText ? colors.accent : colors.accentDim }]}
            onPress={hasText ? sendMessage : undefined}
          >
            <Ionicons
              name={hasText ? 'send' : 'mic'}
              size={20}
              color={hasText ? colors.bg : colors.accent}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function ChatListScreen() {
  const { colors } = useThemeContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [chats, setChats] = useState<Chat[]>([]);
  const [draftChat, setDraftChat] = useState<Chat | null>(null);

  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const setChatMessages = useCallback(
    (chatId: string, messages: Message[]) => {
      const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
      const stamp = {
        lastMessage: lastMsg ? lastMsg.text : '',
        lastMessageTime: lastMsg ? lastMsg.time : '',
      };

      setDraftChat((prev) => (prev && prev.id === chatId ? null : prev));

      setChats((prev) => {
        if (prev.some((c) => c.id === chatId)) {
          return prev.map((c) => (c.id === chatId ? { ...c, messages, ...stamp } : c));
        }
        if (!draftChat || draftChat.id !== chatId) return prev;
        return [{ ...draftChat, messages, ...stamp }, ...prev];
      });
    },
    [draftChat],
  );

  const loadContactsForPicker = async () => {
    setLoadingContacts(true);
    setPermissionDenied(false);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        setLoadingContacts(false);
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Image],
      });
      const contactList: Contact[] = data
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
          return { id: c.id || `contact-${Date.now()}`, name, phone, initials, avatar: c.image?.uri || null };
        });
      setContacts(contactList);
    } catch {
      Alert.alert('Error', 'Could not load contacts.');
    } finally {
      setLoadingContacts(false);
    }
  };

  const openContactPicker = async () => {
    setShowContactPicker(true);
    await loadContactsForPicker();
  };

  const selectContact = (contact: Contact) => {
    setShowContactPicker(false);
    const phoneDigits = contact.phone.replace(/\D/g, '');
    const existingChat = chats.find(
      (c) => c.contact.id === contact.id || c.contact.phone.replace(/\D/g, '') === phoneDigits,
    );
    if (existingChat) {
      setDraftChat(null);
      setSelectedChatId(existingChat.id);
      return;
    }
    if (draftChat && draftChat.contact.phone.replace(/\D/g, '') === phoneDigits) {
      setSelectedChatId(draftChat.id);
      return;
    }
    const newChat: Chat = {
      id: `chat-${Date.now()}`,
      contact,
      messages: [],
    };
    setDraftChat(newChat);
    setSelectedChatId(newChat.id);
  };

  const toggleSearch = () => {
    setShowSearch(!showSearch);
    if (showSearch) setSearchQuery('');
  };

  const handleBackFromChat = () => {
    setSelectedChatId(null);
    setDraftChat(null);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const filteredChats = chats.filter((c) =>
    c.contact.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const selectedChat =
    chats.find((c) => c.id === selectedChatId) ||
    (draftChat && draftChat.id === selectedChatId ? draftChat : null) ||
    null;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar barStyle={colors.statusBar as StatusBarStyle} backgroundColor={colors.bg} />

      <View style={s.content}>
        <Header colors={colors} onSearchPress={toggleSearch} onMenuPress={() => setShowMenu(true)} />

        {showSearch && (
          <View style={[s.searchContainer, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
            <View style={[s.searchInputContainer, { backgroundColor: colors.searchBg, borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.textDim} />
              <TextInput
                style={[s.searchInput, { color: colors.text }]}
                placeholder="Search chats..."
                placeholderTextColor={colors.textDim}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="done"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textDim} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {filteredChats.length > 0 ? (
          <FlatList
            data={filteredChats}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ChatItem chat={item} colors={colors} onPress={() => setSelectedChatId(item.id)} />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.accent}
                colors={[colors.accent]}
              />
            }
          />
        ) : (
          <EmptyState colors={colors} />
        )}

        <TouchableOpacity
          style={[s.fab, { backgroundColor: colors.accent }]}
          onPress={openContactPicker}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color={colors.bg} />
        </TouchableOpacity>
      </View>

      {selectedChat && (
        <View style={StyleSheet.absoluteFillObject}>
          <ChatView
            chat={selectedChat}
            colors={colors}
            onBack={handleBackFromChat}
            setChatMessages={setChatMessages}
          />
        </View>
      )}

      <ContactPickerModal
        visible={showContactPicker}
        onClose={() => setShowContactPicker(false)}
        onSelectContact={selectContact}
        loading={loadingContacts}
        contacts={contacts}
        permissionDenied={permissionDenied}
        onRequestPermission={loadContactsForPicker}
        onOpenSettings={() => Linking.openSettings()}
        colors={colors}
      />

      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={[s.menuOverlay, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={[s.menuContainer, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
            <TouchableOpacity style={s.menuItem} onPress={() => { setShowMenu(false); Alert.alert('New Group', 'Coming soon'); }}>
              <Ionicons name="people-outline" size={20} color={colors.text} />
              <Text style={[s.menuText, { color: colors.text }]}>New Group</Text>
            </TouchableOpacity>
            <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => { setShowMenu(false); router.push('/settings'); }}
            >
              <Ionicons name="settings-outline" size={20} color={colors.text} />
              <Text style={[s.menuText, { color: colors.text }]}>Settings</Text>
            </TouchableOpacity>
            <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={[s.menuItem, s.menuItemDanger]}
              onPress={() => { setShowMenu(false); Alert.alert('Logged Out', 'You have been logged out.'); }}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
              <Text style={[s.menuText, { color: colors.danger }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 26, fontFamily: FONTS.heading },
  headerSubtitle: { fontSize: 12, marginTop: 1, fontFamily: FONTS.body },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerIcon: { padding: 4 },

  searchContainer: { paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 9 : 7,
    borderWidth: 1,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, fontFamily: FONTS.body },

  listContent: { paddingTop: 4, paddingBottom: 80 },

  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chatInfo: { flex: 1 },
  chatTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  chatName: { fontSize: 16, fontWeight: '600', fontFamily: FONTS.bodyMedium, flex: 1 },
  chatTime: { fontSize: 11, fontFamily: FONTS.body, marginLeft: 8 },
  chatBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatMessage: { flex: 1, fontSize: 14, fontFamily: FONTS.body, marginRight: 8 },

  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { color: '#FFF', fontSize: 11, fontWeight: '700', fontFamily: FONTS.bodyMedium },

  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarText: { fontWeight: '600', fontFamily: FONTS.bodyMedium },
  onlineDot: { position: 'absolute', bottom: 0, right: 0 },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingBottom: 80 },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
  },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8, fontFamily: FONTS.heading },
  emptySubtitle: { fontSize: 14, textAlign: 'center', fontFamily: FONTS.body },

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
  modalBackButton: { padding: 4 },
  modalTitle: { fontSize: 17, fontWeight: '600', fontFamily: FONTS.bodyMedium },
  modalList: { paddingHorizontal: 16, paddingBottom: 20 },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contactInfo: { flex: 1, marginLeft: 10 },
  contactName: { fontSize: 15, fontFamily: FONTS.bodyMedium },
  contactPhone: { fontSize: 13, fontFamily: FONTS.body, marginTop: 1 },
  modalEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  modalEmptyText: { fontSize: 15, marginTop: 10, fontFamily: FONTS.body, textAlign: 'center' },
  emptyButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, marginTop: 16 },
  emptyButtonText: { fontSize: 14, fontWeight: '600', fontFamily: FONTS.bodyMedium },

  chatView: { flex: 1 },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
  },
  backButton: { padding: 4, marginRight: 4 },
  chatHeaderInfo: { flex: 1, marginLeft: 8 },
  chatHeaderName: { fontSize: 16, fontWeight: '600', fontFamily: FONTS.bodyMedium },
  chatHeaderStatus: { fontSize: 12, fontFamily: FONTS.body },
  chatHeaderIcon: { padding: 4 },

  chatBody: { flex: 1, justifyContent: 'flex-end' },
  messagesList: { paddingHorizontal: 14, paddingVertical: 8, flexGrow: 1, justifyContent: 'flex-end' },

  messageRow: { marginBottom: 6 },
  messageRowSent: { alignItems: 'flex-end' },
  messageRowReceived: { alignItems: 'flex-start' },

  messageBubble: { maxWidth: '78%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  sentBubble: { borderBottomRightRadius: 4 },
  receivedBubble: { borderBottomLeftRadius: 4 },

  messageText: { fontSize: 15.5, fontFamily: FONTS.body, lineHeight: 21 },
  messageMeta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 2 },
  messageTime: { fontSize: 10.5, fontFamily: FONTS.body },

  dateSeparatorContainer: { alignItems: 'center', marginVertical: 12 },
  dateSeparatorPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  dateSeparatorText: { fontSize: 12, fontFamily: FONTS.bodyMedium },

  typingContainer: { marginBottom: 8, alignItems: 'flex-start' },
  typingDots: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, gap: 4 },
  typingDot: { width: 7, height: 7, borderRadius: 4 },

  scrollDownFab: {
    position: 'absolute',
    right: 16,
    bottom: 80,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  attachButton: { marginRight: 6, paddingBottom: 4 },
  inputFieldContainer: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 40,
    justifyContent: 'center',
  },
  inputField: { fontSize: 15, fontFamily: FONTS.body, paddingVertical: 8, maxHeight: 100 },
  sendButton: {
    marginLeft: 8,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  menuOverlay: { flex: 1, justifyContent: 'flex-start', paddingTop: Platform.OS === 'ios' ? 70 : 50, alignItems: 'flex-end', paddingRight: 16 },
  menuContainer: { borderRadius: 12, paddingVertical: 6, minWidth: 180, borderWidth: StyleSheet.hairlineWidth },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  menuItemDanger: {},
  menuText: { fontSize: 15, fontFamily: FONTS.body },
  menuDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 12 },
});
