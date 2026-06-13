/**
 * Google Drive Sync Service (Client-side only)
 * 
 * Menggunakan Google Identity Services (GIS) + Drive API v3
 * Tidak ada backend server sama sekali.
 * 
 * CATATAN PENTING:
 * - Ganti `CLIENT_ID` dengan Client ID dari Google Cloud Console
 * - Aktifkan Google Drive API di project Google Cloud kamu
 * - Tambahkan origin http://localhost:3000 (dan production domain) di OAuth settings
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient: any = null;
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
 * Inisialisasi Google Identity Services
 */
export function initializeGoogleDrive(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();

    if (!CLIENT_ID) {
      console.warn('⚠️ NEXT_PUBLIC_GOOGLE_CLIENT_ID belum diset di .env.local');
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;

    script.onload = () => {
      // @ts-ignore
      if (window.google?.accounts?.oauth2) {
        // @ts-ignore
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (response: any) => {
            if (response.error) {
              console.error('Google Auth Error:', response);
              return;
            }
            if (response.access_token && response.expires_in) {
              saveTokenToStorage(response.access_token, response.expires_in);
            }
          },
        });
      }

      // Coba restore token dari localStorage saat init
      restoreTokenFromStorage();

      resolve();
    };

    script.onerror = () => reject(new Error('Gagal memuat Google Identity Services'));
    document.head.appendChild(script);
  });
}

export function isSignedInToGoogle(): boolean {
  return !!accessToken && isTokenStillValid();
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
  return Date.now() < tokenExpiry;
}

export function getTokenExpiryTime(): number | null {
  return tokenExpiry;
}

/**
 * Sign in dengan Google
 */
export function signInWithGoogle(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      return reject(new Error('Google Drive belum diinisialisasi'));
    }

    tokenClient.callback = (response: any) => {
      if (response.error) {
        reject(new Error(response.error));
        return;
      }
      
      // Simpan token + expiry
      if (response.access_token && response.expires_in) {
        saveTokenToStorage(response.access_token, response.expires_in);
      } else {
        accessToken = response.access_token;
      }
      
      resolve(accessToken!);
    };

    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

export function signOutFromGoogle() {
  clearTokenStorage();
}

/**
 * Mendapatkan atau membuat file money_manager_data.json
 */
async function getOrCreateDataFile(): Promise<string | null> {
  if (!accessToken) throw new Error('Belum login ke Google');

  try {
    // Cari file yang sudah ada
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='money_manager_data.json' and trashed=false`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const searchData = await searchRes.json();

    if (searchData.files?.length > 0) {
      return searchData.files[0].id;
    }

    // Buat file baru
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'money_manager_data.json',
        mimeType: 'application/json',
      }),
    });

    const newFile = await createRes.json();
    return newFile.id || null;
  } catch (err) {
    console.error('Error getOrCreateDataFile:', err);
    return null;
  }
}

/**
 * Download data dari Google Drive
 */
export async function downloadFromDrive(): Promise<any | null> {
  if (!accessToken) throw new Error('Belum login ke Google');

  const fileId = await getOrCreateDataFile();
  if (!fileId) return null;

  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    console.log(res)
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Download error:', err);
    return null;
  }
}

/**
 * Upload data ke Google Drive
 */
export async function uploadToDrive(data: any): Promise<boolean> {
  if (!accessToken) throw new Error('Belum login ke Google');

  const fileId = await getOrCreateDataFile();
  if (!fileId) return false;

  try {
    const metadata = { name: 'money_manager_data.json' };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));

    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      }
    );

    return res.ok;
  } catch (err) {
    console.error('Upload error:', err);
    return false;
  }
}

