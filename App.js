import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {createMMKV} from 'react-native-mmkv';
import {
  collection,
  doc,
  getDocFromCache,
  getDocFromServer,
  getFirestore,
  setDoc,
} from '@react-native-firebase/firestore';

const storage = createMMKV();
const MAHASISWA_COLLECTION = 'mahasiswa';
const STORAGE_KEYS = {
  nim: 'user_nim',
  nama: 'user_nama',
  email: 'user_email',
};
const SCREENS = {
  loading: 'loading',
  auth: 'auth',
  home: 'home',
};
const AUTH_MODES = {
  login: 'login',
  register: 'register',
};

const initialFormState = {
  nim: '',
  nama: '',
  email: '',
  password: '',
};

const db = getFirestore();
const mahasiswaCollection = collection(db, MAHASISWA_COLLECTION);

const normalizeNim = value => value.trim().toLowerCase();
const trimValue = value => value.trim();

function App() {
  const [screen, setScreen] = useState(SCREENS.loading);
  const [authMode, setAuthMode] = useState(AUTH_MODES.login);
  const [form, setForm] = useState(initialFormState);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const nim = storage.getString(STORAGE_KEYS.nim);
    const nama = storage.getString(STORAGE_KEYS.nama);
    const email = storage.getString(STORAGE_KEYS.email) ?? '';

    if (nim && nama) {
      setCurrentUser({nim, nama, email});
      setScreen(SCREENS.home);
    } else {
      setScreen(SCREENS.auth);
    }
  }, []);

  const persistUser = useCallback(user => {
    storage.set(STORAGE_KEYS.nim, user.nim);
    storage.set(STORAGE_KEYS.nama, user.nama);
    storage.set(STORAGE_KEYS.email, user.email ?? '');
  }, []);

  const clearPersistedUser = useCallback(() => {
    Object.values(STORAGE_KEYS).forEach(key => storage.delete(key));
  }, []);

  const updateField = field => value => {
    setForm(prev => ({...prev, [field]: value}));
  };

  const resetForm = useCallback(() => {
    setForm(initialFormState);
  }, []);

  const switchMode = targetMode => {
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
      let snapshot;
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
        setScreen(SCREENS.home);
        resetForm();
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
      setScreen(SCREENS.home);
      resetForm();
    } catch (error) {
      console.error('Auth error:', error);
      Alert.alert('Error', 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [authMode, buildUserPayload, form.nim, form.password, persistUser, resetForm, validateForm]);

  const handleLogout = useCallback(() => {
    clearPersistedUser();
    setCurrentUser(null);
    resetForm();
    setAuthMode(AUTH_MODES.login);
    setScreen(SCREENS.auth);
  }, [clearPersistedUser, resetForm]);

  const authTitle = useMemo(
    () => (authMode === AUTH_MODES.login ? 'Login Mahasiswa' : 'Register Mahasiswa'),
    [authMode],
  );

  if (screen === SCREENS.loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Memuat data...</Text>
      </SafeAreaView>
    );
  }

  if (screen === SCREENS.auth) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>{authTitle}</Text>

        <View style={styles.modeSwitcher}>
          <TouchableOpacity
            style={[styles.modeButton, authMode === AUTH_MODES.login && styles.modeButtonActive]}
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

        <TextInput
          style={styles.input}
          placeholder="NIM"
          value={form.nim}
          onChangeText={updateField('nim')}
          autoCapitalize="none"
        />

        {authMode === AUTH_MODES.register && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Nama"
              value={form.nama}
              onChangeText={updateField('nama')}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={form.email}
              onChangeText={updateField('email')}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </>
        )}

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={form.password}
          onChangeText={updateField('password')}
          secureTextEntry
        />

        {loading ? (
          <ActivityIndicator style={styles.spinner} />
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleAuth}>
            <Text style={styles.buttonText}>
              {authMode === AUTH_MODES.login ? 'MASUK' : 'DAFTAR'}
            </Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Selamat datang, {currentUser?.nama ?? 'Mahasiswa'}!</Text>
      <View style={styles.userBox}>
        <Text style={styles.userLabel}>NIM</Text>
        <Text style={styles.userValue}>{currentUser?.nim}</Text>
        <Text style={[styles.userLabel, styles.userLabelSpacing]}>Email</Text>
        <Text style={styles.userValue}>{currentUser?.email || '-'}</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>LOGOUT</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  modeSwitcher: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#f1f1f1',
    borderRadius: 8,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: '#007bff',
  },
  modeButtonLabel: {
    fontWeight: '600',
    color: '#333',
  },
  modeButtonLabelActive: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  spinner: {
    marginTop: 24,
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
    color: '#888',
    textTransform: 'uppercase',
  },
  userLabelSpacing: {
    marginTop: 12,
  },
  userValue: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default App;
