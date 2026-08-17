import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import fallbackConfig from '../firebase-applet-config.json';

// Use environment variables (perfectly suited for Vercel/Vite builds) or fall back to the local JSON file
const metaEnv = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || fallbackConfig.apiKey,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || fallbackConfig.authDomain,
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || fallbackConfig.projectId,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || fallbackConfig.storageBucket,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackConfig.messagingSenderId,
  appId: metaEnv.VITE_FIREBASE_APP_ID || fallbackConfig.appId,
  firestoreDatabaseId: metaEnv.VITE_FIREBASE_DATABASE_ID || fallbackConfig.firestoreDatabaseId || "(default)"
};

export const isUsingMockConfig = !firebaseConfig.apiKey || firebaseConfig.apiKey.includes('FakePlaceholder');

const app = (getApps().length === 0) ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
