'use client';

import { useState, useEffect, useCallback } from 'react';
import { isSignedInToGoogle } from '@/lib/google-drive';

export interface CurrentUser {
  id: string;        // Google 'sub'
  email: string;
  name: string;
  picture?: string;
}

const USER_STORAGE_KEY = 'google_current_user';

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserInfo = useCallback(async (accessToken: string): Promise<CurrentUser | null> => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;

      const data = await res.json();
      const currentUser: CurrentUser = {
        id: data.sub,
        email: data.email,
        name: data.name,
        picture: data.picture,
      };
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
      return currentUser;
    } catch (error) {
      console.error('Gagal fetch user info:', error);
      return null;
    }
  }, []);

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    if (!isSignedInToGoogle()) {
      setUser(null);
      localStorage.removeItem(USER_STORAGE_KEY);
      setIsLoading(false);
      return;
    }

    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        setUser(null);
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const setUserAfterLogin = (newUser: CurrentUser) => {
    setUser(newUser);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
  };

  const clearUser = () => {
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
  };

  return {
    user,
    isLoading,
    setUserAfterLogin,
    clearUser,
    fetchUserInfo,
  };
}
