// firebase.ts
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDocFromServer,
  setDoc,
} from '@react-native-firebase/firestore';

// Instance DB
export const db = getFirestore();

// Koleksi Firestore
export const mahasiswaCollection = collection(db, 'mahasiswa');
export const messagesCollection = collection(db, 'messages');

// Re-exports helper Firestore modular
export {
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDocFromServer,
  setDoc,
};
