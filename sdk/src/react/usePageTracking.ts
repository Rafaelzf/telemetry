import { useEffect, useRef } from 'react';
import { SDKClient } from '../core/SDKClient.js';

/**
 * Reports a PAGE_VIEW behavior event whenever `location` changes.
 *
 * The core BehaviorTracker already auto-tracks navigation via popstate and
 * History API patching, which covers most SPA routers with no extra setup.
 * Use this hook only if you want page views keyed to a router's resolved
 * location instead (e.g. React Router's useLocation()) — using both at once
 * will double-count views.
 */
export function usePageTracking(location: string): void {
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (previous.current === location) return;
    previous.current = location;
    SDKClient.trackPageView(location);
  }, [location]);
}
