import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * .env 에 Firebase 설정이 채워져 있는지 확인한다.
 * 비어 있으면 앱은 연습용 모드(mock)로 작동한다.
 */
export const isFirebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

if (isFirebaseConfigured) {
  app = initializeApp({
    apiKey: config.apiKey as string,
    authDomain: config.authDomain as string,
    projectId: config.projectId as string,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId as string,
  });
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    throw new Error('Firebase 설정이 없습니다. .env 파일을 확인해 주세요.');
  }
  return authInstance;
}

export function getDb(): Firestore {
  if (!dbInstance) {
    throw new Error('Firebase 설정이 없습니다. .env 파일을 확인해 주세요.');
  }
  return dbInstance;
}

export { app as firebaseApp };
