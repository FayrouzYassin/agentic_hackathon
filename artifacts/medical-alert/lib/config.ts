import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Origin of the medical-alert backend (`backend/`), without the `/api` suffix:
 * the generated client already prefixes every path with `/api`.
 *
 * Set `EXPO_PUBLIC_API_URL` in `artifacts/medical-alert/.env` to point the app
 * at another server. Only variables prefixed with `EXPO_PUBLIC_` are inlined
 * into the bundle, and they are inlined at build time — restart Expo after
 * changing one.
 */
const DEFAULT_PORT = 5000;

/** Loopback alias the Android emulator maps to the host machine. */
const ANDROID_EMULATOR_HOST = '10.0.2.2';

function stripTrailingSlashes(url: string) {
  return url.replace(/\/+$/, '');
}

/**
 * On a device, `localhost` is the phone itself, so the packager host — the LAN
 * address of the machine running Expo — is the best guess for where the backend
 * lives. Web and the iOS simulator share the host's loopback, and the Android
 * emulator reaches it through a dedicated alias.
 */
function inferDevHost() {
  if (Platform.OS === 'web') return 'localhost';

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;
  const packagerHost = hostUri?.split(':')[0];

  if (packagerHost && packagerHost !== 'localhost' && packagerHost !== '127.0.0.1') {
    return packagerHost;
  }
  return Platform.OS === 'android' ? ANDROID_EMULATOR_HOST : 'localhost';
}

export const API_BASE_URL = stripTrailingSlashes(
  process.env.EXPO_PUBLIC_API_URL || `http://${inferDevHost()}:${DEFAULT_PORT}`,
);

/**
 * Turns a server-relative path such as `/uploads/abc.png` into an absolute URL.
 * Values that are already absolute (`http(s)://`, `file://`, `data:`) are
 * returned unchanged so locally picked photos keep working offline.
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}
