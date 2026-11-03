import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });

const API_ROOT = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5160/api').replace(/\/$/, '');
const SESSION_KEY = 'yevmiyem.session.v1';
export type User = { id: string; name: string; phone: string };
type SavedSession = { token: string; user: User };
type AuthState = {
  token: string | null;
  user: User | null;
  ready: boolean;
  signIn: (phone: string, password: string, register?: { name: string }) => Promise<void>;
  signOut: () => Promise<void>;
};
const Context = createContext<AuthState | null>(null);

export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider eksik.');
  return value;
}

export function apiUrl(path: string) { return `${API_ROOT}${path}`; }

async function readSession(): Promise<SavedSession | null> {
  const raw = Platform.OS === 'web'
    ? (typeof window === 'undefined' ? null : window.localStorage.getItem(SESSION_KEY))
    : await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as SavedSession;
    return value.token && value.user?.id ? value : null;
  } catch { return null; }
}

async function saveSession(session: SavedSession | null) {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY);
    return;
  }
  if (session) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  else await SecureStore.deleteItemAsync(SESSION_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      try {
        const saved = await readSession();
        if (!saved) return;
        if (active) { setToken(saved.token); setUser(saved.user); }
        try {
          const response = await fetch(apiUrl('/auth/me'), { headers: { Authorization: `Bearer ${saved.token}` } });
          if (response.status === 401) {
            await saveSession(null);
            if (active) { setToken(null); setUser(null); }
          } else if (response.ok) {
            const currentUser = await response.json() as User;
            await saveSession({ token: saved.token, user: currentUser });
            if (active) setUser(currentUser);
          }
        } catch {
          // Keep a cached session during temporary API outages; protected actions will retry later.
        }
      } catch {
        await saveSession(null).catch(() => undefined);
      } finally {
        if (active) setReady(true);
      }
    };
    void restore();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!token || Platform.OS === 'web' || !Device.isDevice) return;
    let active = true;
    const register = async () => {
      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
        if (!projectId) return;
        if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Genel', importance: AndroidImportance.HIGH });
        let permission = await Notifications.getPermissionsAsync();
        if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
        if (!permission.granted) return;
        const result = await Notifications.getExpoPushTokenAsync({ projectId });
        if (!active) return;
        setPushToken(result.data);
        await fetch(apiUrl('/devices/push-token'), { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ token: result.data }) });
      } catch { /* Push setup must not block sign-in or in-app notifications. */ }
    };
    void register();
    return () => { active = false; };
  }, [token]);

  const signIn = useCallback(async (phone: string, password: string, register?: { name: string }) => {
    const response = await fetch(apiUrl(`/auth/${register ? 'register' : 'login'}`), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(register ? { name: register.name, phone, password } : { phone, password }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.detail || 'Hesap işlemi başarısız.');
    const session: SavedSession = { token: body.token, user: body.user };
    await saveSession(session);
    setToken(session.token); setUser(session.user); setReady(true);
  }, []);

  const signOut = useCallback(async () => {
    const currentToken = token;
    const currentPushToken = pushToken;
    setToken(null); setUser(null);
    setPushToken(null);
    try {
      if (currentToken && currentPushToken) await fetch(apiUrl('/devices/push-token'), { method: 'DELETE', headers: { Authorization: `Bearer ${currentToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ token: currentPushToken }) });
      if (currentToken) await fetch(apiUrl('/auth/logout'), { method: 'POST', headers: { Authorization: `Bearer ${currentToken}` } });
    } catch { /* Local sign-out must still finish when the API is offline. */ }
    await saveSession(null).catch(() => undefined);
  }, [pushToken, token]);

  const value = useMemo(() => ({ token, user, ready, signIn, signOut }), [token, user, ready, signIn, signOut]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
