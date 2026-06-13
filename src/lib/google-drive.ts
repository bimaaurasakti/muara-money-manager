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
const SCOPES = 'https://www.googleapis.com/auth/drive.file profile email';

let tokenClient: any = null;
let accessToken: string | null = null;
let tokenExpiry: number | null = null; // timestamp in ms

// Handler untuk Promise login
let signInResolve: ((value: string) => void) | null = null;
let signInReject: ((reason?: any) => void) | null = null;

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
            console.log(response)
            if (response.error) {
              if (signInReject) {
                signInReject(new Error(response.error));
                signInReject = null;
                signInResolve = null;
              }
              console.error('Google Auth Error:', response);
              return;
            }

            if (response.access_token) {
              // Pastikan expires_in dikonversi ke number (Google mengembalikan detik)
              const expiresIn = response.expires_in ? parseInt(response.expires_in) : 3600;
              saveTokenToStorage(response.access_token, expiresIn);
              
              if (signInResolve) {
                signInResolve(response.access_token);
                signInResolve = null;
                signInReject = null;
              }
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
  // Tambahkan buffer 5 menit (300.000 ms) untuk mengantisipasi selisih waktu server & network latency
  const BUFFER_MS = 5 * 60 * 1000;
  return Date.now() < (tokenExpiry - BUFFER_MS);
}

/**
 * Mencoba memperbarui token secara diam-diam (tanpa popup) jika memungkinkan.
 */
export function refreshTokenSilently(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      return reject(new Error('Google Drive belum diinisialisasi'));
    }

    // Simpan handler untuk dipanggil oleh callback tunggal
    signInResolve = resolve;
    signInReject = (err) => {
      console.warn('Silent refresh gagal:', err);
      clearTokenStorage();
      reject(err);
    };

    tokenClient.requestAccessToken({ prompt: 'none' });
  });
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

    // Simpan handler untuk dipanggil oleh callback tunggal
    signInResolve = resolve;
    signInReject = reject;

    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

export function signOutFromGoogle() {
  clearTokenStorage();
}

/**
 * Mendapatkan info user dari Google
 */
export async function getUserInfo(): Promise<{ id: string; email: string; name: string } | null> {
  if (!accessToken || !isTokenStillValid()) {
    return null;
  }

  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (res.ok) {
      const data = await res.json();
      return {
        id: data.sub,
        email: data.email,
        name: data.name,
      };
    }

    if (res.status === 401) {
      console.warn('Google Token expired or invalid');
      clearTokenStorage();
    }
  } catch (err) {
    console.error('Error fetching user info:', err);
  }
  return null;
}

/**
 * Memastikan token valid sebelum melakukan request.
 * Jika tidak valid, mencoba silent refresh. Jika gagal, melempar error.
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

  // 3. Jika tetap tidak valid, coba Silent Refresh
  try {
    console.log('Mencoba silent refresh token...');
    return await refreshTokenSilently();
  } catch (err) {
    clearTokenStorage();
    throw new Error('UNAUTHORIZED: Sesi Google Drive telah berakhir, silakan login kembali.');
  }
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

