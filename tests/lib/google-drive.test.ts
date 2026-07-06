import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to create mocks BEFORE module resolution
const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
  getApp: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: { uid: 'test-uid' } })),
  GoogleAuthProvider: class { addScope = vi.fn() },
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({
  auth: { currentUser: { uid: 'test-uid' } },
  googleProvider: { addScope: vi.fn() },
}));

vi.stubGlobal('fetch', mockFetch);

// Import after mocks
import { downloadFromDrive } from '@/lib/google-drive';

const makeLocalStorageStore = () => {
  const store: Record<string, string> = {
    google_access_token: 'fake-token',
    google_token_expiry: String(Date.now() + 3600 * 1000),
  };
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  };
};

/** Helper: mock the two fetch calls needed for downloadFromDrive */
const mockDriveDownload = (downloadResponse: {
  status: number;
  ok: boolean;
  text: () => Promise<string>;
}) => {
  // call 1: search for existing file (getOrCreateDataFile)
  mockFetch.mockResolvedValueOnce({
    status: 200,
    ok: true,
    json: async () => ({ files: [{ id: 'file-123' }] }),
  });
  // call 2: download media content
  mockFetch.mockResolvedValueOnce(downloadResponse);
};

describe('downloadFromDrive', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('localStorage', makeLocalStorageStore());
  });

  it('returns parsed JSON when the file has valid content', async () => {
    mockDriveDownload({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ version: 1, transactions: [{ id: 'tx1' }] }),
    });

    const data = await downloadFromDrive();
    expect(data).toEqual({ version: 1, transactions: [{ id: 'tx1' }] });
  });

  it('returns null (no SyntaxError) when the file body is empty', async () => {
    // This is the bug fix: a newly created empty Drive file returns an empty body
    mockDriveDownload({
      status: 200,
      ok: true,
      text: async () => '',
    });

    const data = await downloadFromDrive();
    expect(data).toBeNull();
  });

  it('returns null when file body is whitespace-only', async () => {
    mockDriveDownload({
      status: 200,
      ok: true,
      text: async () => '   \n  ',
    });

    const data = await downloadFromDrive();
    expect(data).toBeNull();
  });

  it('returns null gracefully when file body is malformed JSON', async () => {
    mockDriveDownload({
      status: 200,
      ok: true,
      text: async () => 'not-json-at-all{{{',
    });

    const data = await downloadFromDrive();
    expect(data).toBeNull();
  });

  it('returns null when response is not ok', async () => {
    mockDriveDownload({
      status: 404,
      ok: false,
      text: async () => 'Not Found',
    });

    const data = await downloadFromDrive();
    expect(data).toBeNull();
  });
});
