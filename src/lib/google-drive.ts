import { signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

let accessToken: string | null = null;
let tokenExpiry: number | null = null; // timestamp in ms

const TOKEN_STORAGE_KEY = 'google_access_token';
const EXPIRY_STORAGE_KEY = 'google_token_expiry';

export interface DriveSyncStatus {
  isSignedIn: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  error: string | null;
}

/**
 * Inisialisasi Google Drive (hanya restore token dari storage)
 */
export function initializeGoogleDrive(): Promise<void> {
  if (typeof window !== 'undefined') {
    restoreTokenFromStorage();
  }
  return Promise.resolve();
}

export function isSignedInToGoogle(): boolean {
  return !!auth.currentUser && !!accessToken && isTokenStillValid();
}

function saveTokenToStorage(token: string, expiresIn: number) {
  const expiryTime = Date.now() + (expiresIn * 1000);
  accessToken = token;
  tokenExpiry = expiryTime;

  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(EXPIRY_STORAGE_KEY, expiryTime.toString());
  }
}

function restoreTokenFromStorage(): boolean {
  if (typeof window === 'undefined') return false;

  const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  const storedExpiry = localStorage.getItem(EXPIRY_STORAGE_KEY);

  if (storedToken && storedExpiry) {
    const expiry = parseInt(storedExpiry);
    if (Date.now() < expiry) {
      accessToken = storedToken;
      tokenExpiry = expiry;
      return true;
    } else {
      // Token expired → clear storage
      clearTokenStorage();
    }
  }
  return false;
}

function clearTokenStorage() {
  accessToken = null;
  tokenExpiry = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(EXPIRY_STORAGE_KEY);
  }
}

function isTokenStillValid(): boolean {
  if (!tokenExpiry) return false;
  // Tambahkan buffer 5 menit (300.000 ms) untuk mengantisipasi selisih waktu server & network latency
  const BUFFER_MS = 5 * 60 * 1000;
  return Date.now() < (tokenExpiry - BUFFER_MS);
}

export function getTokenExpiryTime(): number | null {
  return tokenExpiry;
}

/**
 * Sign in dengan Google via Firebase Auth
 */
export async function signInWithGoogle(): Promise<string> {
  googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
  
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;
  
  if (!token) {
    throw new Error('Gagal mendapatkan Google Access Token dari Firebase Auth');
  }

  // Google access token biasanya kedaluwarsa dalam 1 jam (3600 detik)
  saveTokenToStorage(token, 3600);
  return token;
}

export async function signOutFromGoogle() {
  clearTokenStorage();
  await signOut(auth);
}

/**
 * Mendapatkan info user dari Firebase Auth
 */
export async function getUserInfo(): Promise<{ id: string; email: string; name: string } | null> {
  const firebaseUser = auth.currentUser;
  if (firebaseUser) {
    return {
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      name: firebaseUser.displayName || '',
    };
  }
  return null;
}

/**
 * Memastikan token valid sebelum melakukan request.
 * Jika tidak valid, lemparkan error unauthorized (re-auth diperlukan).
 */
async function ensureValidToken(): Promise<string> {
  // 1. Jika token masih valid, gunakan yang ada
  if (accessToken && isTokenStillValid()) {
    return accessToken;
  }

  // 2. Jika tidak valid/hampir habis, coba restore dari storage dulu
  if (restoreTokenFromStorage() && isTokenStillValid()) {
    return accessToken!;
  }

  // 3. Jika tetap tidak valid, lemparkan error UNAUTHORIZED
  clearTokenStorage();
  throw new Error('UNAUTHORIZED: Sesi Google Drive telah berakhir, silakan login kembali.');
}

/**
 * Mendapatkan atau membuat file money_manager_data.json
 */
async function getOrCreateDataFile(): Promise<string | null> {
  const token = await ensureValidToken();

  try {
    // Cari file yang sudah ada
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='money_manager_data.json' and trashed=false`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    if (searchRes.status === 401) {
      clearTokenStorage();
      throw new Error('UNAUTHORIZED');
    }

    const searchData = await searchRes.json();

    if (searchData.files?.length > 0) {
      return searchData.files[0].id;
    }

    // Buat file baru
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'money_manager_data.json',
        mimeType: 'application/json',
      }),
    });

    if (createRes.status === 401) {
      clearTokenStorage();
      throw new Error('UNAUTHORIZED');
    }

    const newFile = await createRes.json();
    return newFile.id || null;
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') throw err;
    console.error('Error getOrCreateDataFile:', err);
    return null;
  }
}

/**
 * Download data dari Google Drive
 */
export async function downloadFromDrive(): Promise<any | null> {
  try {
    const token = await ensureValidToken();
    const fileId = await getOrCreateDataFile();
    if (!fileId) return null;

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    if (res.status === 401) {
      clearTokenStorage();
      throw new Error('UNAUTHORIZED');
    }

    if (!res.ok) return null;
    return await res.json();
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      console.warn('Download gagal: Sesi berakhir');
      return null;
    }
    console.error('Download error:', err);
    return null;
  }
}

/**
 * Upload data ke Google Drive
 */
export async function uploadToDrive(data: any): Promise<boolean> {
  try {
    const token = await ensureValidToken();
    const fileId = await getOrCreateDataFile();
    if (!fileId) return false;

    const metadata = { name: 'money_manager_data.json' };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));

    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      }
    );

    if (res.status === 401) {
      clearTokenStorage();
      throw new Error('UNAUTHORIZED');
    }

    return res.ok;
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      console.warn('Upload gagal: Sesi berakhir');
      return false;
    }
    console.error('Upload error:', err);
    return false;
  }
}

