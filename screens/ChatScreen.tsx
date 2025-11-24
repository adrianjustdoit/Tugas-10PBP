// screens/ChatScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createMMKV } from 'react-native-mmkv';

import {
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  messagesCollection,
} from '../firebase';
import { RootStackParamList } from '../App';

// ---------- TYPES ----------
type FirestoreTimestamp = {
  seconds: number;
  nanoseconds: number;
};

type MessageType = {
  id: string;
  text: string;
  user: string;     // nama pengirim
  userNim: string;  // NIM pengirim
  createdAt: FirestoreTimestamp | null;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

// ---------- MMKV UNTUK LOGOUT ----------
const storage = createMMKV();
const STORAGE_KEYS = {
  nim: 'user_nim',
  nama: 'user_nama',
  email: 'user_email',
};

const ChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const { name, nim } = route.params;
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<MessageType[]>([]);

  // Fungsi logout: bersihkan MMKV + kembali ke Login
  const handleLogout = useCallback(() => {
    Object.values(STORAGE_KEYS).forEach(key => {
      storage.set(key, ''); // kosongkan supaya tidak auto-login
    });

    // Optional: reset state lokal chat
    setMessage('');
    setMessages([]);

    // Kembali ke layar Login dan hapus stack Chat
    navigation.replace('Login');
  }, [navigation]);

  // Pasang listener pesan
    useEffect(() => {
    const q = query(messagesCollection, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, snapshot => {
        const list: MessageType[] = [];
        snapshot.forEach((docSnap: any) => {   // <--- tambahkan : any di sini
        list.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<MessageType, 'id'>),
        });
        });
        setMessages(list);
    });

    return () => unsubscribe();
    }, []);


  // Tambah tombol Logout di header kanan
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Button title="Logout" onPress={handleLogout} />
      ),
    });
  }, [navigation, handleLogout]);

  const sendMessage = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    await addDoc(messagesCollection, {
      text: trimmed,
      user: name,
      userNim: nim,
      createdAt: serverTimestamp(),
    });

    setMessage('');
  };

  const renderItem = ({ item }: { item: MessageType }) => {
    const isMine = item.userNim === nim;
    return (
      <View
        style={[
          styles.msgBox,
          isMine ? styles.myMsg : styles.otherMsg,
        ]}>
        <Text style={styles.sender}>
          {item.user} ({item.userNim})
        </Text>
        <Text>{item.text}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Ketik pesan..."
          value={message}
          onChangeText={setMessage}
        />
        <Button title="KIRIM" onPress={sendMessage} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 10 },
  msgBox: {
    padding: 10,
    marginVertical: 6,
    borderRadius: 6,
    maxWidth: '80%',
  },
  myMsg: {
    backgroundColor: '#d1f0ff',
    alignSelf: 'flex-end',
  },
  otherMsg: {
    backgroundColor: '#eee',
    alignSelf: 'flex-start',
  },
  sender: {
    fontWeight: 'bold',
    marginBottom: 2,
    fontSize: 12,
  },
  inputRow: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#ccc',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    marginRight: 10,
    padding: 8,
    borderRadius: 6,
  },
});

export default ChatScreen;
