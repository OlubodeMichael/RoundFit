import * as SecureStore from 'expo-secure-store';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';

function imagePickerRebuildHint(): string {
  if (Platform.OS === 'ios') {
    return 'Delete the app from the simulator/device, then rebuild and install: `npx expo run:ios` (or a new EAS development build). Required after adding expo-image-picker.';
  }
  if (Platform.OS === 'android') {
    return 'Uninstall the app, then rebuild and install: `npx expo run:android` (or a new EAS development build). Required after adding expo-image-picker.';
  }
  return '';
}

interface UploadAvatarResponse {
  avatar_url?: string;
  data?: { avatar_url?: string };
  error?: string;
}

function resolveAvatarUrl(body: UploadAvatarResponse): string | null {
  if (typeof body.avatar_url === 'string' && body.avatar_url.length > 0) return body.avatar_url;
  if (typeof body.data?.avatar_url === 'string' && body.data.avatar_url.length > 0) return body.data.avatar_url;
  return null;
}

async function uploadBase64(base64: string): Promise<string | null> {
  const token = await SecureStore.getItemAsync('access_token');
  const apiKey = process.env.EXPO_PUBLIC_API_SECRET_KEY;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(apiKey ? { 'x-api-key': apiKey } : {}),
  };

  const res = await fetch(`${API_BASE}/auth/avatar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ base64Image: base64, mimeType: 'image/jpeg' }),
  });

  if (!res.ok) {
    let msg = `Upload failed (${res.status})`;
    try {
      const errBody = (await res.json()) as { error?: string };
      if (errBody.error) msg = errBody.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const body = (await res.json()) as UploadAvatarResponse;
  return resolveAvatarUrl(body);
}

type ImagePickerModule = {
  requestMediaLibraryPermissionsAsync: () => Promise<{ granted: boolean }>;
  requestCameraPermissionsAsync: () => Promise<{ granted: boolean }>;
  launchImageLibraryAsync: (o: object) => Promise<{ canceled: boolean; assets: { base64?: string }[] }>;
  launchCameraAsync: (o: object) => Promise<{ canceled: boolean; assets: { base64?: string }[] }>;
};

function loadImagePicker(): ImagePickerModule {
  if (Platform.OS !== 'web') {
    const native = requireOptionalNativeModule('ExponentImagePicker');
    if (!native) {
      throw new Error(`Photo picker is not included in this app binary. ${imagePickerRebuildHint()}`);
    }
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-image-picker') as ImagePickerModule;
  } catch (e: unknown) {
    const raw = e instanceof Error ? e.message : String(e);
    throw new Error(`Image picker failed to load: ${raw} ${imagePickerRebuildHint()}`.trim());
  }
}

const PICKER_OPTIONS = {
  mediaTypes: ['images' as const],
  allowsEditing: true,
  aspect: [1, 1] as [number, number],
  quality: 0.7,
  base64: true,
};

export async function pickAndUploadAvatar(): Promise<string | null> {
  const ImagePicker = loadImagePicker();

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Media library permission is required');

  const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
  if (result.canceled || !result.assets[0]?.base64) return null;

  return uploadBase64(result.assets[0].base64);
}

export async function takeAndUploadAvatar(): Promise<string | null> {
  const ImagePicker = loadImagePicker();

  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('Camera permission is required');

  const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
  if (result.canceled || !result.assets[0]?.base64) return null;

  return uploadBase64(result.assets[0].base64);
}

export async function deleteAvatar(): Promise<void> {
  const token = await SecureStore.getItemAsync('access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE}/auth/avatar`, { method: 'DELETE', headers });

  if (!res.ok) {
    let msg = `Delete failed (${res.status})`;
    try {
      const errBody = (await res.json()) as { error?: string };
      if (errBody.error) msg = errBody.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
}
