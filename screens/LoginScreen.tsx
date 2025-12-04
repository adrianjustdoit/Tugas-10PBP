// screens/LoginScreen.tsx
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {createMMKV} from 'react-native-mmkv';
import {
  collection,
  doc,
  getDocFromCache,
  getDocFromServer,
  getFirestore,
  setDoc,
} from '@react-native-firebase/firestore';
import {RootStackParamList} from '../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const storage = createMMKV();
const MAHASISWA_COLLECTION = 'mahasiswa';
const STORAGE_KEYS = {
  nim: 'user_nim',
  nama: 'user_nama',
  email: 'user_email',
};
const AUTH_MODES = {
  login: 'login',
  register: 'register',
} as const;

const initialFormState = {
  nim: '',
  nama: '',
  email: '',
  password: '',
};

const db = getFirestore();
const mahasiswaCollection = collection(db, MAHASISWA_COLLECTION);

const normalizeNim = (value: string) => value.trim().toLowerCase();
const trimValue = (value: string) => value.trim();

const LoginScreen: React.FC<Props> = ({navigation}) => {
  const [authMode, setAuthMode] = useState<(typeof AUTH_MODES)[keyof typeof AUTH_MODES]>(
    AUTH_MODES.login,
  );
  const [form, setForm] = useState(initialFormState);
  const [currentUser, setCurrentUser] = useState<{
    nim: string;
    nama: string;
    email: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const nim = storage.getString(STORAGE_KEYS.nim);
    const nama = storage.getString(STORAGE_KEYS.nama);
    const email = storage.getString(STORAGE_KEYS.email) ?? '';

    if (nim && nama) {
      const user = {nim, nama, email};
      setCurrentUser(user);
      navigation.replace('Mahasiswa');
    } else {
      setHydrated(true);
    }
  }, [navigation]);

  const persistUser = useCallback((user: {nim: string; nama: string; email?: string}) => {
    storage.set(STORAGE_KEYS.nim, user.nim);
    storage.set(STORAGE_KEYS.nama, user.nama);
    storage.set(STORAGE_KEYS.email, user.email ?? '');
  }, []);

  const clearPersistedUser = useCallback(() => {
    Object.values(STORAGE_KEYS).forEach(key => storage.delete?.(key));
  }, []);

  const updateField = (field: keyof typeof initialFormState) => (value: string) => {
    setForm(prev => ({...prev, [field]: value}));
  };

  const resetForm = useCallback(() => {
    setForm(initialFormState);
  }, []);

  const switchMode = (targetMode: (typeof AUTH_MODES)[keyof typeof AUTH_MODES]) => {
    if (authMode === targetMode) {
      return;
    }
    setAuthMode(targetMode);
    resetForm();
  };

  const validateForm = useCallback(() => {
    const nim = trimValue(form.nim);
    const password = trimValue(form.password);

    if (!nim) {
      return 'NIM wajib diisi.';
    }
    if (!password) {
      return 'Password wajib diisi.';
    }

    if (authMode === AUTH_MODES.register) {
      if (!trimValue(form.nama)) {
        return 'Nama wajib diisi.';
      }
      if (!trimValue(form.email)) {
        return 'Email wajib diisi.';
      }
      const emailRegex = /.+@.+\..+/;
      if (!emailRegex.test(trimValue(form.email))) {
        return 'Format email tidak valid.';
      }
    }

    return null;
  }, [authMode, form.email, form.nama, form.nim, form.password]);

  const buildUserPayload = useCallback(() => {
    return {
      nim: trimValue(form.nim),
      nama: trimValue(form.nama),
      email: trimValue(form.email),
      password: form.password,
    };
  }, [form.email, form.nama, form.nim, form.password]);

  const handleAuth = useCallback(async () => {
    const validationMessage = validateForm();
    if (validationMessage) {
      Alert.alert('Error', validationMessage);
      return;
    }

    setLoading(true);
    const nimKey = normalizeNim(form.nim);
    const nimForDisplay = trimValue(form.nim);

    try {
      const docRef = doc(mahasiswaCollection, nimKey);
      let snapshot: any;
      let usedCache = false;
      try {
        snapshot = await getDocFromServer(docRef);
      } catch (serverErr) {
        console.warn('Server fetch failed, fallback to cache:', serverErr);
        try {
          snapshot = await getDocFromCache(docRef);
          usedCache = true;
        } catch (cacheErr) {
          console.error('Cache fetch failed:', cacheErr);
          Alert.alert('Error', 'Tidak bisa mengakses data. Periksa koneksi.');
          return;
        }
      }

      const existsFn = snapshot?.exists;
      const docExists = typeof existsFn === 'function' ? existsFn.call(snapshot) : !!existsFn;

      console.log('Auth attempt', {
        mode: authMode,
        nimInput: form.nim,
        nimKey,
        snapshotExists: docExists,
        snapshotId: snapshot.id,
        fromCache: snapshot.metadata?.fromCache,
        usedCache,
      });

      if (authMode === AUTH_MODES.register && usedCache) {
        Alert.alert('Error', 'Koneksi diperlukan untuk registrasi. Coba lagi.');
        return;
      }

      if (authMode === AUTH_MODES.register) {
        if (docExists) {
          Alert.alert('Error', 'NIM sudah terdaftar.');
          return;
        }

        const payload = buildUserPayload();
        await setDoc(docRef, {...payload, nimKey});
        console.log('Register success', {nimKey});
        persistUser(payload);
        setCurrentUser(payload);
        resetForm();

        navigation.replace('Mahasiswa');
        return;
      }

      if (!docExists) {
        Alert.alert('Error', 'NIM belum terdaftar.');
        return;
      }

      const data = snapshot.data();
      if (data.password !== form.password) {
        Alert.alert('Error', 'Password salah.');
        return;
      }

      const user = {
        nim: data.nim ?? nimForDisplay,
        nama: data.nama ?? 'Mahasiswa',
        email: data.email ?? '',
      };
      persistUser(user);
      setCurrentUser(user);
      resetForm();

      navigation.replace('Mahasiswa');
    } catch (error) {
      console.error('Auth error:', error);
      Alert.alert('Error', 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [
    authMode,
    buildUserPayload,
    form.nim,
    form.password,
    navigation,
    persistUser,
    resetForm,
    validateForm,
  ]);

  const handleLocalLogout = useCallback(() => {
    clearPersistedUser();
    setCurrentUser(null);
    resetForm();
    setAuthMode(AUTH_MODES.login);
  }, [clearPersistedUser, resetForm]);

  const authTitle = useMemo(
    () => (authMode === AUTH_MODES.login ? 'Login Mahasiswa' : 'Register Mahasiswa'),
    [authMode],
  );

  if (!hydrated) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <View style={styles.center}>
          <ActivityIndicator color="#ffffff" />
          <Text style={styles.loadingText}>Memuat data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.brandTitle}>Database Mahasiswa</Text>
            <Text style={styles.brandSubtitle}>
              Kelola akses mahasiswa dengan cepat dan aman
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>{authTitle}</Text>

            <View style={styles.modeSwitcher}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  authMode === AUTH_MODES.login && styles.modeButtonActive,
                ]}
                onPress={() => switchMode(AUTH_MODES.login)}>
                <Text
                  style={[
                    styles.modeButtonLabel,
                    authMode === AUTH_MODES.login && styles.modeButtonLabelActive,
                  ]}>
                  LOGIN
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  authMode === AUTH_MODES.register && styles.modeButtonActive,
                ]}
                onPress={() => switchMode(AUTH_MODES.register)}>
                <Text
                  style={[
                    styles.modeButtonLabel,
                    authMode === AUTH_MODES.register && styles.modeButtonLabelActive,
                  ]}>
                  REGISTER
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NIM</Text>
              <TextInput
                style={styles.input}
                placeholder="Masukkan NIM"
                placeholderTextColor="#94a3b8"
                value={form.nim}
                onChangeText={updateField('nim')}
                autoCapitalize="none"
              />
            </View>

            {authMode === AUTH_MODES.register && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nama</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Masukkan nama lengkap"
                    placeholderTextColor="#94a3b8"
                    value={form.nama}
                    onChangeText={updateField('nama')}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="nama@kampus.ac.id"
                    placeholderTextColor="#94a3b8"
                    value={form.email}
                    onChangeText={updateField('email')}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                value={form.password}
                onChangeText={updateField('password')}
                secureTextEntry
              />
            </View>

            {loading ? (
              <ActivityIndicator style={styles.spinner} color="#2563eb" />
            ) : (
              <TouchableOpacity style={styles.button} onPress={handleAuth}>
                <Text style={styles.buttonText}>
                  {authMode === AUTH_MODES.login ? 'MASUK' : 'DAFTAR'}
                </Text>
              </TouchableOpacity>
            )}

            {currentUser && (
              <TouchableOpacity
                style={[styles.button, styles.logoutButton]}
                onPress={handleLocalLogout}>
                <Text style={styles.buttonText}>HAPUS AKUN LOKAL</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.helperText}>
            Data tersimpan aman secara lokal menggunakan MMKV serta tersinkron dengan
            Firestore.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    color: '#0f172a',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 28,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowOffset: {width: 0, height: 18},
    shadowRadius: 28,
    elevation: 8,
    marginBottom: 24,
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    padding: 4,
    borderRadius: 12,
    marginBottom: 24,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: '#0f172a',
  },
  modeButtonLabel: {
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 1,
  },
  modeButtonLabelActive: {
    color: '#ffffff',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 0,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.35,
    shadowOffset: {width: 0, height: 12},
    shadowRadius: 20,
    elevation: 6,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  spinner: {
    marginTop: 24,
  },
  helperText: {
    fontSize: 13,
    color: '#cbd5f5',
    textAlign: 'center',
    lineHeight: 18,
  },
  homeScroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  homeCard: {
    marginBottom: 24,
  },
  cardBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 20,
  },
  cardBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
    letterSpacing: 0.6,
  },
  detailRow: {
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginBottom: 16,
  },
  userBox: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 24,
  },
  userLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  userLabelSpacing: {
    marginTop: 12,
  },
  userValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    shadowColor: '#b91c1c',
    marginTop: 8,
  },
});

export default LoginScreen;
