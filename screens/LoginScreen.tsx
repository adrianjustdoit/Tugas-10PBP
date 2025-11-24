// screens/LoginScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createMMKV } from 'react-native-mmkv';

import { RootStackParamList } from '../App';
import {
  mahasiswaCollection,
  doc,
  getDocFromServer,
  setDoc,
} from '../firebase';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

type AuthMode = 'login' | 'register';

type FormState = {
  nim: string;
  nama: string;
  email: string;
  password: string;
};

type UserPayload = {
  nim: string;
  nama: string;
  email: string;
  password: string;
};

const storage = createMMKV();
const STORAGE_KEYS = {
  nim: 'user_nim',
  nama: 'user_nama',
  email: 'user_email',
};

const initialFormState: FormState = {
  nim: '',
  nama: '',
  email: '',
  password: '',
};

const normalizeNim = (value: string) => value.trim();
const trimValue = (value: string) => value.trim();

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [form, setForm] = useState<FormState>(initialFormState);
  const [loading, setLoading] = useState<boolean>(false);

  // Auto-login jika data user tersimpan di MMKV
  useEffect(() => {
    const nim = storage.getString(STORAGE_KEYS.nim);
    const nama = storage.getString(STORAGE_KEYS.nama);
    const email = storage.getString(STORAGE_KEYS.email) ?? '';

    if (nim && nama) {
      navigation.replace('Chat', { name: nama, nim });
    }
  }, [navigation]);

  const updateField =
    (field: keyof FormState) =>
    (value: string): void => {
      setForm(prev => ({ ...prev, [field]: value }));
    };

  const resetForm = useCallback(() => {
    setForm(initialFormState);
  }, []);

  const switchMode = (targetMode: AuthMode) => {
    if (authMode === targetMode) return;
    setAuthMode(targetMode);
    resetForm();
  };

  const validateForm = useCallback((): string | null => {
    const nim = trimValue(form.nim);
    const password = trimValue(form.password);

    if (!nim) return 'NIM wajib diisi.';
    if (!password) return 'Password wajib diisi.';

    if (authMode === 'register') {
      const nama = trimValue(form.nama);
      const email = trimValue(form.email);
      if (!nama) return 'Nama wajib diisi.';
      if (!email) return 'Email wajib diisi.';
      const emailRegex = /.+@.+\..+/;
      if (!emailRegex.test(email)) return 'Format email tidak valid.';
    }

    return null;
  }, [authMode, form]);

  const buildUserPayload = useCallback((): UserPayload => {
    return {
      nim: trimValue(form.nim),
      nama: trimValue(form.nama),
      email: trimValue(form.email),
      password: form.password,
    };
  }, [form]);

  const persistUser = useCallback((user: { nim: string; nama: string; email?: string }) => {
    storage.set(STORAGE_KEYS.nim, user.nim);
    storage.set(STORAGE_KEYS.nama, user.nama);
    storage.set(STORAGE_KEYS.email, user.email ?? '');
  }, []);

  const clearPersistedUser = useCallback(() => {
    // Overwrite jadi string kosong agar tidak auto-login lagi
    Object.values(STORAGE_KEYS).forEach(key => {
      storage.set(key, '');
    });
  }, []);

  const handleAuth = useCallback(async () => {
    const validationMessage = validateForm();
    if (validationMessage) {
      Alert.alert('Error', validationMessage);
      return;
    }

    setLoading(true);

    const nimKey = normalizeNim(form.nim);
    const nimDisplay = trimValue(form.nim);

    try {
      const docRef = doc(mahasiswaCollection, nimKey);

      // SELALU baca dari server (bukan cache)
      const snapshot = await getDocFromServer(docRef);

      // ==== LOGIKA FIX: kompatibel method/property ====
      const existsRaw: any = (snapshot as any).exists;
      const docExists: boolean =
        typeof existsRaw === 'function' ? existsRaw.call(snapshot) : !!existsRaw;
      // ================================================

      console.log('Auth attempt:', {
        mode: authMode,
        nimInput: form.nim,
        nimKey,
        snapshotExists: docExists,
        snapshotId: snapshot.id,
      });

      // ---------- MODE REGISTER ----------
      if (authMode === 'register') {
        if (docExists) {
          setLoading(false);
          Alert.alert('Error', 'NIM sudah terdaftar.');
          return;
        }

        const payload = buildUserPayload();
        await setDoc(docRef, { ...payload, nimKey });

        console.log('Register success', { nimKey });

        persistUser(payload);
        setLoading(false);

        navigation.replace('Chat', {
          name: payload.nama,
          nim: payload.nim,
        });
        return;
      }

      // ---------- MODE LOGIN ----------
      if (!docExists) {
        setLoading(false);
        Alert.alert('Error', 'NIM belum terdaftar.');
        return;
      }

      const data = snapshot.data() as UserPayload;

      if (data.password !== form.password) {
        setLoading(false);
        Alert.alert('Error', 'Password salah.');
        return;
      }

      const user = {
        nim: data.nim ?? nimDisplay,
        nama: data.nama ?? 'Mahasiswa',
        email: data.email ?? '',
      };

      persistUser(user);
      setLoading(false);

      navigation.replace('Chat', {
        name: user.nama,
        nim: user.nim,
      });
    } catch (error) {
      console.error('Auth error:', error);
      setLoading(false);
      Alert.alert('Error', 'Terjadi kesalahan. Coba lagi.');
    }
  }, [
    authMode,
    buildUserPayload,
    form,
    navigation,
    persistUser,
    validateForm,
  ]);

  const handleLogoutClearLocal = useCallback(() => {
    clearPersistedUser();
    resetForm();
    setAuthMode('login');
  }, [clearPersistedUser, resetForm]);

  const titleText = useMemo(
    () =>
      authMode === 'login'
        ? 'Login Mahasiswa (NIM + Password)'
        : 'Register Mahasiswa',
    [authMode],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{titleText}</Text>

      <View style={styles.modeSwitcher}>
        <Text
          style={[
            styles.modeTab,
            authMode === 'login' && styles.modeTabActive,
          ]}
          onPress={() => switchMode('login')}>
          LOGIN
        </Text>
        <Text
          style={[
            styles.modeTab,
            authMode === 'register' && styles.modeTabActive,
          ]}
          onPress={() => switchMode('register')}>
          REGISTER
        </Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="NIM"
        value={form.nim}
        onChangeText={updateField('nim')}
        autoCapitalize="none"
      />

      {authMode === 'register' && (
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
            autoCapitalize="none"
            keyboardType="email-address"
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
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : (
        <Button
          title={authMode === 'login' ? 'Masuk' : 'Daftar'}
          onPress={handleAuth}
        />
      )}

      <View style={{ marginTop: 16 }}>
        <Button
          title="Clear local login (MMKV)"
          onPress={handleLogoutClearLocal}
          color="#888"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 22, textAlign: 'center', marginBottom: 24 },
  modeSwitcher: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modeTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 16,
    backgroundColor: '#eee',
    fontWeight: '600',
  },
  modeTabActive: {
    backgroundColor: '#007bff',
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderColor: '#ccc',
  },
});

export default LoginScreen;
