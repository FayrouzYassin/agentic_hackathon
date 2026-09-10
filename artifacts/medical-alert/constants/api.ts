import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Origin of the medical-alert backend (`backend/`), without the `/api` suffix:
 * the generated client already prefixes every path with `/api`.
 *
 * Set `EXPO_PUBLIC_API_URL` in `artifacts/medical-alert/.env` to point the app
 * at a different server. Only variables prefixed with `EXPO_PUBLIC_` are
 * inlined into the bundle.
 */
const DEFAULT_PORT = 5000;

function stripTrailingSlashes(url: string) {
  return url.replace(/\/+$/, '');
}

/**
 * On a device, `localhost` is the phone itself, so the packager host is used as
 * a best guess for the machine running the backend. Falls back to `localhost`
 * for web and simulators.
 */
function inferDevHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;

  const host = hostUri?.split(':')[0];
  if (host && Platform.OS !== 'web') return host;
  return 'localhost';
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
