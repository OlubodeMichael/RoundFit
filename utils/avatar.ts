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
  data?: {
    avatar_url?: string;
  };
  error?: string;
}

function resolveAvatarUrl(body: UploadAvatarResponse): string | null {
  if (typeof body.avatar_url === 'string' && body.avatar_url.length > 0) return body.avatar_url;
  if (typeof body.data?.avatar_url === 'string' && body.data.avatar_url.length > 0) return body.data.avatar_url;
  return null;
}

export async function pickAndUploadAvatar(): Promise<string | null> {
  // Avoid loading expo-image-picker until we know the native module exists (otherwise Metro logs a noisy stack).
  if (Platform.OS !== 'web') {
    const nativePicker = requireOptionalNativeModule('ExponentImagePicker');
    if (!nativePicker) {
      throw new Error(
        `Photo picker is not included in this installed app binary. ${imagePickerRebuildHint()}`,
      );
    }
  }

  let ImagePicker: {
    requestMediaLibraryPermissionsAsync: () => Promise<{ granted: boolean }>;
    launchImageLibraryAsync: (options: {
      mediaTypes: ('images' | 'videos' | 'livePhotos')[];
      allowsEditing: boolean;
      aspect: [number, number];
      quality: number;
      base64: boolean;
    }) => Promise<{ canceled: boolean; assets: { base64?: string }[] }>;
  };
  try {
    // Require lazily and synchronously so native-module failures are caught here.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ImagePicker = require('expo-image-picker') as typeof ImagePicker;
  } catch (e: unknown) {
    const raw = e instanceof Error ? e.message : String(e);
    const hint = imagePickerRebuildHint();
    throw new Error(
      raw.includes('ExponentImagePicker') || raw.toLowerCase().includes('native module')
        ? `${raw} ${hint}`.trim()
        : `Image picker failed to load: ${raw} ${hint}`.trim(),
    );
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Media library permission is required');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: true,
  });

  if (result.canceled || !result.assets[0]?.base64) return null;

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
    body: JSON.stringify({
      base64Image: result.assets[0].base64,
      mimeType: 'image/jpeg',
    }),
  });

  if (!res.ok) {
    let msg = `Upload failed (${res.status})`;
    try {
      const errBody = (await res.json()) as { error?: string };
      if (errBody.error) msg = errBody.error;
    } catch { /* ignore parse errors */ }
    throw new Error(msg);
  }

  const body = (await res.json()) as UploadAvatarResponse;
  return resolveAvatarUrl(body);
}

export async function deleteAvatar(): Promise<void> {
  const token = await SecureStore.getItemAsync('access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE}/auth/avatar`, {
    method: 'DELETE',
    headers,
  });

  if (!res.ok) {
    let msg = `Delete failed (${res.status})`;
    try {
      const errBody = (await res.json()) as { error?: string };
      if (errBody.error) msg = errBody.error;
    } catch { /* ignore parse errors */ }
    throw new Error(msg);
  }
}
