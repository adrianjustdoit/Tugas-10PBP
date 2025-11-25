// screens/ChatScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
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

import ImageViewing from 'react-native-image-viewing';
import {
  launchImageLibrary,
  ImageLibraryOptions,
  Asset,
} from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import ImageResizer from 'react-native-image-resizer';

type FirestoreTimestamp = {
  seconds: number;
  nanoseconds: number;
};

type MessageType = {
  id: string;
  text: string;
  user: string;
  userNim: string;
  imageBase64?: string;
  createdAt: FirestoreTimestamp | null;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

const storage = createMMKV();
const STORAGE_KEYS = {
  nim: 'user_nim',
  nama: 'user_nama',
  email: 'user_email',
};

// parameter resize (boleh kamu ubah kalau mau)
const MAX_WIDTH = 800;
const MAX_HEIGHT = 800;
const JPEG_QUALITY = 60; // 0-100, semakin kecil semakin kecil file

const ChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const { name, nim } = route.params;
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<MessageType[]>([]);

  const [uploading, setUploading] = useState<boolean>(false);
  const [viewerVisible, setViewerVisible] = useState<boolean>(false);
  const [viewerImageBase64, setViewerImageBase64] = useState<string | null>(null);

  const handleLogout = useCallback(() => {
    Object.values(STORAGE_KEYS).forEach(key => {
      storage.set(key, '');
    });

    setMessage('');
    setMessages([]);

    navigation.replace('Login');
  }, [navigation]);

  useEffect(() => {
    const q = query(messagesCollection, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, snapshot => {
      const list: MessageType[] = [];
      snapshot.forEach((docSnap: any) => {
        list.push({
          id: docSnap.id,
          ...(docSnap.data() as Omit<MessageType, 'id'>),
        });
      });
      setMessages(list);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => <Button title="Logout" onPress={handleLogout} />,
    });
  }, [navigation, handleLogout]);

  const sendTextMessage = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    await addDoc(messagesCollection, {
      text: trimmed,
      imageBase64: null,
      user: name,
      userNim: nim,
      createdAt: serverTimestamp(),
    });

    setMessage('');
  };

  const openImageViewer = (base64: string) => {
    setViewerImageBase64(base64);
    setViewerVisible(true);
  };

  const closeImageViewer = () => {
    setViewerVisible(false);
    setViewerImageBase64(null);
  };

  // === INI BAGIAN PENTING: PILIH + RESIZE + UPLOAD GMBR ===
  const pickAndSendImage = async () => {
    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      quality: 0.7, // kualitas awal saat pick
    };

    const result = await launchImageLibrary(options);

    if (result.didCancel) {
      return;
    }

    const asset: Asset | undefined = result.assets?.[0];
    if (!asset || !asset.uri) {
      return;
    }

    try {
      setUploading(true);

      // 1. Resize gambar
      const resized = await ImageResizer.createResizedImage(
        asset.uri,
        MAX_WIDTH,
        MAX_HEIGHT,
        'JPEG',
        JPEG_QUALITY,
      );

      // 2. Ambil path file hasil resize
      let resizedPath = resized.uri || (resized as any).path;
      if (!resizedPath) {
        console.warn('Resize result tidak punya path/uri');
        return;
      }

      if (resizedPath.startsWith('file://')) {
        resizedPath = resizedPath.replace('file://', '');
      }

      // 3. Baca file kecil ini sebagai base64
      const base64 = await RNFS.readFile(resizedPath, 'base64');

      // (opsional) kalau kamu mau ekstra aman, bisa cek panjang base64 di sini:
      // console.log('Base64 length:', base64.length);

      // 4. Simpan ke Firestore sebagai pesan gambar
      await addDoc(messagesCollection, {
        text: '',
        imageBase64: base64,
        user: name,
        userNim: nim,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error resize / upload image:', err);
    } finally {
      setUploading(false);
    }
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

        {item.text ? <Text style={styles.msgText}>{item.text}</Text> : null}

        {item.imageBase64 ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => openImageViewer(item.imageBase64!)}>
            <Image
              source={{ uri: `data:image/jpeg;base64,${item.imageBase64}` }}
              style={styles.image}
              resizeMode="cover"
            />
            <Text style={styles.imageHint}>Tap untuk perbesar</Text>
          </TouchableOpacity>
        ) : null}
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
        <Button title="KIRIM" onPress={sendTextMessage} />
      </View>

      <View style={styles.inputRow}>
        <Button
          title={uploading ? 'Mengunggah...' : 'GAMBAR'}
          onPress={pickAndSendImage}
          disabled={uploading}
        />
      </View>

      <ImageViewing
        images={
          viewerImageBase64
            ? [{ uri: `data:image/jpeg;base64,${viewerImageBase64}` }]
            : []
        }
        imageIndex={0}
        visible={viewerVisible}
        onRequestClose={closeImageViewer}
      />
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
  msgText: {
    marginTop: 4,
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
  image: {
    width: 180,
    height: 180,
    borderRadius: 8,
    backgroundColor: '#ccc',
  },
  imageHint: {
    fontSize: 10,
    color: '#555',
    marginTop: 2,
  },
});

export default ChatScreen;
