import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

import type { WatchAction, WatchSnapshot } from '@/types/watch';

// The native module (added during prebuild) wraps WCSession + the App Group store.
// Until it exists, `requireOptionalNativeModule` returns null and every call no-ops,
// so the phone app runs unchanged with or without a paired watch or a fresh binary.
interface NativeModule {
  isPaired(): boolean;
  isReachable(): boolean;
  /** Persist the latest snapshot as the WCSession application context (latest-wins). */
  pushSnapshot(json: string): void;
  /** Subscribe to inbound actions; returns an unsubscribe function. */
  addListener(event: 'onAction', cb: (payload: { json: string }) => void): { remove(): void };
}

const Native =
  Platform.OS === 'ios'
    ? (requireOptionalNativeModule('WatchBridge') as NativeModule | null)
    : null;

/** True only when the native bridge is present (iOS, current binary). */
export function isWatchBridgeAvailable(): boolean {
  return Native != null;
}

export function isWatchPaired(): boolean {
  try {
    return Native?.isPaired() ?? false;
  } catch {
    return false;
  }
}

export function isWatchReachable(): boolean {
  try {
    return Native?.isReachable() ?? false;
  } catch {
    return false;
  }
}

/** Push the latest snapshot to the watch. Never throws — best-effort. */
export function pushWatchSnapshot(snapshot: WatchSnapshot): void {
  try {
    Native?.pushSnapshot(JSON.stringify(snapshot));
  } catch {
    // best-effort; the next push carries the same latest-wins state
  }
}

/**
 * Subscribe to actions coming up from the watch (log water, start/end workout).
 * Returns an unsubscribe function. No-ops (and unsubscribes cleanly) when the native
 * bridge is absent, so callers need no platform guards.
 */
export function addWatchActionListener(cb: (action: WatchAction) => void): () => void {
  if (!Native) return () => {};

  let sub: { remove(): void } | null = null;
  try {
    sub = Native.addListener('onAction', ({ json }) => {
      try {
        cb(JSON.parse(json) as WatchAction);
      } catch {
        // malformed payload — drop it
      }
    });
  } catch {
    return () => {};
  }

  return () => {
    try {
      sub?.remove();
    } catch {
      // ignore
    }
  };
}
