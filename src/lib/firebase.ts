import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_GOOGLE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_GOOGLE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_GOOGLE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_GOOGLE_MESSAGING_SENDER_ID, // optional, not in env but safe if undefined
  appId: process.env.NEXT_PUBLIC_GOOGLE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, googleProvider };
