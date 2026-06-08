import { Directory, File, Paths } from 'expo-file-system';
import type { MealItem } from '@/hooks/use-food';

const cacheDir = new Directory(Paths.cache, 'photo_analysis');

// djb2 hash over a sample of the base64 — fast fingerprint, no crypto needed
function hashBase64(b64: string): string {
  const sample = b64.slice(0, 3000);
  let h = 5381;
  for (let i = 0; i < sample.length; i++) {
    h = (((h << 5) + h) ^ sample.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

function ensureDir(): void {
  if (!cacheDir.exists) cacheDir.create({ intermediates: true });
}

export async function getCachedAnalysis(base64Image: string): Promise<MealItem | null> {
  try {
    ensureDir();
    const file = new File(cacheDir, `${hashBase64(base64Image)}.json`);
    if (!file.exists) return null;
    const raw = await file.text();
    return JSON.parse(raw) as MealItem;
  } catch {
    return null;
  }
}

export function cacheAnalysis(base64Image: string, result: MealItem): void {
  try {
    ensureDir();
    const file = new File(cacheDir, `${hashBase64(base64Image)}.json`);
    if (!file.exists) file.create();
    file.write(JSON.stringify(result));
  } catch {
    // non-fatal — a cache miss on next open is fine
  }
}

/** Copy a temp camera URI into the cache dir so it survives the app session. */
export function persistCameraPhoto(tempUri: string): string {
  try {
    ensureDir();
    const src  = new File(tempUri);
    const dest = new File(cacheDir, `photo_${Date.now()}.jpg`);
    src.copy(dest);
    return dest.uri;
  } catch {
    return tempUri;
  }
}

/** Delete cache files older than maxAgeDays (default 7). */
export function prunePhotoCache(maxAgeDays = 7): void {
  try {
    if (!cacheDir.exists) return;
    const cutoff = Date.now() - maxAgeDays * 86_400_000;
    for (const entry of cacheDir.list()) {
      if (entry instanceof File) {
        const mod = entry.modificationTime;
        if (mod !== null && mod * 1000 < cutoff) entry.delete();
      }
    }
  } catch {
    // non-fatal
  }
}
