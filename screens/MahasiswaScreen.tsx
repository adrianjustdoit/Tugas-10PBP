import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { collection, getDocs, getFirestore } from '@react-native-firebase/firestore';
import { createMMKV } from 'react-native-mmkv';
import { RootStackParamList } from '../App';

const MAHASISWA_COLLECTION = 'mahasiswa';
const storage = createMMKV();
const STORAGE_KEYS = {
  nim: 'user_nim',
  nama: 'user_nama',
  email: 'user_email',
};

export type Mahasiswa = {
  nim: string;
  nama: string;
  email: string;
};

const db = getFirestore();

type Props = NativeStackScreenProps<RootStackParamList, 'Mahasiswa'>;

const MahasiswaScreen: React.FC<Props> = ({navigation}) => {
  const [data, setData] = useState<Mahasiswa[]>([]);
  const [loading, setLoading] = useState(true);

  const handleLogout = useCallback(() => {
    Object.values(STORAGE_KEYS).forEach(key => {
      storage.set(key, '');
    });
    navigation.replace('Login');
  }, [navigation]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const snap = await getDocs(collection(db, MAHASISWA_COLLECTION));
        const list: Mahasiswa[] = [];
        snap.forEach((docSnap: any) => {
          const d = docSnap.data() as Mahasiswa | any;
          list.push({
            nim: d.nim ?? docSnap.id,
            nama: d.nama ?? 'Mahasiswa',
            email: d.email ?? '',
          });
        });
        setData(list);
      } catch (err) {
        console.error('Failed to fetch mahasiswa', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const renderItem = ({ item }: { item: Mahasiswa }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.nama}</Text>
      <View style={styles.cardRow}>
        <Text style={styles.label}>NIM</Text>
        <Text style={styles.value}>{item.nim}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{item.email || '-'}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.brandTitle}>Data Mahasiswa</Text>
          <Text style={styles.brandSubtitle}>
            Daftar mahasiswa terdaftar dalam sistem
          </Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#ffffff" />
            <Text style={styles.loadingText}>Memuat data mahasiswa...</Text>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={styles.listContent}
            data={data}
            keyExtractor={item => item.nim}
            renderItem={renderItem}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Belum ada data mahasiswa.</Text>
            }
          />
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>LOGOUT</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    color: '#cbd5f5',
  },
  listContent: {
    paddingVertical: 8,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 14,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowOffset: {width: 0, height: 10},
    shadowRadius: 18,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  emptyText: {
    marginTop: 40,
    textAlign: 'center',
    color: '#cbd5f5',
  },
  logoutButton: {
    marginTop: 16,
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#b91c1c',
    shadowOpacity: 0.3,
    shadowOffset: {width: 0, height: 10},
    shadowRadius: 16,
    elevation: 5,
  },
  logoutText: {
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: 1.1,
  },
});

export default MahasiswaScreen;
