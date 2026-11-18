import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut,
  updateProfile,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import appletConfig from '../firebase-applet-config.json';
import type { GameLevel, LeaderboardEntry } from './types/game';

/**
 * ============================================================================
 * KONFIGURASI FIREBASE (firebaseConfig)
 * ============================================================================
 * Aplikasi ini otomatis membaca konfigurasi yang sudah diprovisioning di file
 * `firebase-applet-config.json`.
 *
 * Jika Anda ingin menggunakan proyek Firebase pribadi Anda sendiri:
 * Ganti nilai properti di bawah ini dengan API Key & konfigurasi dari
 * Firebase Console (Project Settings -> Your Apps -> Web App -> SDK setup).
 * ============================================================================
 */
export const firebaseConfig = {
  apiKey: appletConfig.apiKey, // <-- Tempelkan API Key Firebase Anda di sini jika memakai project sendiri
  authDomain: appletConfig.authDomain,
  projectId: appletConfig.projectId,
  storageBucket: appletConfig.storageBucket,
  messagingSenderId: appletConfig.messagingSenderId,
  appId: appletConfig.appId,
  firestoreDatabaseId: appletConfig.firestoreDatabaseId,
};

const app = initializeApp(firebaseConfig);
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export function sanitizeDisplayName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Pelari Nusantara';
  return trimmed.slice(0, 32);
}

export function subscribeAuth(cb: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, cb);
}

export async function loginWithGoogle(): Promise<User> {
  const res = await signInWithPopup(auth, googleProvider);
  return res.user;
}

export async function loginAsGuest(): Promise<User> {
  const res = await signInAnonymously(auth);
  return res.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

const LEADERBOARD_COLLECTION = 'leaderboard';

export async function ensureUserLeaderboardProfile(
  user: User,
  preferredName?: string,
): Promise<LeaderboardEntry> {
  const path = `${LEADERBOARD_COLLECTION}/${user.uid}`;
  const ref = doc(db, LEADERBOARD_COLLECTION, user.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as LeaderboardEntry;
    }
    const fallbackName = user.isAnonymous
      ? `Tamu_${user.uid.slice(0, 5)}`
      : user.displayName || 'Pelari SMA';
    const cleanName = sanitizeDisplayName(preferredName || fallbackName);
    const initialEntry = {
      uid: user.uid,
      displayName: cleanName,
      highScore: 0,
      bestDistance: 0,
      correctAnswers: 0,
      levelReached: 1 as GameLevel,
      isAnonymous: Boolean(user.isAnonymous),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, initialEntry);
    return {
      ...initialEntry,
      updatedAt: new Date(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserDisplayName(
  user: User,
  newName: string,
): Promise<string> {
  const cleanName = sanitizeDisplayName(newName);
  const path = `${LEADERBOARD_COLLECTION}/${user.uid}`;
  const ref = doc(db, LEADERBOARD_COLLECTION, user.uid);

  if (!user.isAnonymous) {
    try {
      await updateProfile(user, { displayName: cleanName });
    } catch {
      // Non-fatal if profile sync on auth provider fails
    }
  }

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName: cleanName,
        highScore: 0,
        bestDistance: 0,
        correctAnswers: 0,
        levelReached: 1,
        isAnonymous: Boolean(user.isAnonymous),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName: cleanName,
        updatedAt: serverTimestamp(),
      });
    }
    return cleanName;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function submitHighScoreIfBetter(
  user: User,
  displayName: string,
  runScore: number,
  runDistance: number,
  correctAnswers: number,
  levelReached: GameLevel,
): Promise<{ isNewHighScore: boolean; highScore: number }> {
  const safeScore = Math.max(0, Math.min(10000000, Math.floor(runScore)));
  const safeDistance = Math.max(0, Math.min(1000000, Math.floor(runDistance)));
  const safeCorrect = Math.max(0, Math.min(10000, Math.floor(correctAnswers)));
  const safeLevel = Math.max(1, Math.min(3, Math.floor(levelReached))) as GameLevel;
  const cleanName = sanitizeDisplayName(displayName);

  const path = `${LEADERBOARD_COLLECTION}/${user.uid}`;
  const ref = doc(db, LEADERBOARD_COLLECTION, user.uid);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName: cleanName,
        highScore: safeScore,
        bestDistance: safeDistance,
        correctAnswers: safeCorrect,
        levelReached: safeLevel,
        isAnonymous: Boolean(user.isAnonymous),
        updatedAt: serverTimestamp(),
      });
      return { isNewHighScore: safeScore > 0, highScore: safeScore };
    }

    const existing = snap.data() as LeaderboardEntry;
    const prevHigh = Number(existing.highScore || 0);
    if (safeScore > prevHigh) {
      await updateDoc(ref, {
        displayName: cleanName,
        highScore: safeScore,
        bestDistance: Math.max(Number(existing.bestDistance || 0), safeDistance),
        correctAnswers: safeCorrect,
        levelReached: Math.max(Number(existing.levelReached || 1), safeLevel),
        isAnonymous: Boolean(user.isAnonymous),
        updatedAt: serverTimestamp(),
      });
      return { isNewHighScore: true, highScore: safeScore };
    }

    return { isNewHighScore: false, highScore: prevHigh };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeTopLeaderboard(
  onData: (entries: LeaderboardEntry[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, LEADERBOARD_COLLECTION),
    orderBy('highScore', 'desc'),
    limit(10),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const rows: LeaderboardEntry[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          uid: String(data.uid ?? d.id),
          displayName: String(data.displayName ?? 'Pelari'),
          highScore: Number(data.highScore ?? 0),
          bestDistance: Number(data.bestDistance ?? 0),
          correctAnswers: Number(data.correctAnswers ?? 0),
          levelReached: (Number(data.levelReached ?? 1) as GameLevel) || 1,
          isAnonymous: Boolean(data.isAnonymous),
          updatedAt: data.updatedAt,
        };
      });
      onData(rows);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, LEADERBOARD_COLLECTION);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}
