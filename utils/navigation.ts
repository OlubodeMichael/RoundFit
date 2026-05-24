import type { Href, Router } from 'expo-router';

type RouterBack = Pick<Router, 'back' | 'canGoBack' | 'replace'>;

/**
 * Pops the stack when possible; otherwise replaces with `fallback`.
 * Prevents "GO_BACK was not handled" after `router.replace()` or cross-stack jumps.
 */
export function safeBack(router: RouterBack, fallback: Href): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
