import { Image } from 'expo-image';

/** Warm the disk/memory cache so avatars paint instantly on profile/home. */
export function prefetchAvatarImage(url: string | null | undefined): void {
  if (!url || typeof url !== 'string') return;
  void Image.prefetch(url, { cachePolicy: 'memory-disk' });
}
