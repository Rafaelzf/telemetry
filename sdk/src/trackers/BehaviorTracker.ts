import { createBaseFields, safeTry } from '../core/utils.js';
import type { BehaviorEventPayload, CustomEventPayload, ResolvedSDKConfig, TelemetryEvent } from '../core/types.js';

export class BehaviorTracker {
  private originalPushState: History['pushState'] | null = null;
  private originalReplaceState: History['replaceState'] | null = null;
  private readonly onPopState = () => this.trackPageView();

  constructor(
    private readonly config: ResolvedSDKConfig,
    private readonly emit: (event: TelemetryEvent) => void
  ) {}

  start(): void {
    if (typeof window === 'undefined') return;
    this.trackPageView();
    this.patchHistory();
    window.addEventListener('popstate', this.onPopState);
  }

  stop(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('popstate', this.onPopState);
    if (this.originalPushState) history.pushState = this.originalPushState;
    if (this.originalReplaceState) history.replaceState = this.originalReplaceState;
    this.originalPushState = null;
    this.originalReplaceState = null;
  }

  /** Reports a PAGE_VIEW behavior event. `urlOverride` lets React's usePageTracking() pass a router-resolved location. */
  trackPageView(urlOverride?: string): void {
    safeTry(() => {
      const base = createBaseFields(this.config);
      const event: BehaviorEventPayload = {
        ...base,
        url: urlOverride ?? base.url,
        type: 'behavior',
        action: 'PAGE_VIEW'
      };
      this.emit(event);
    }, 'BehaviorTracker.trackPageView');
  }

  trackCustomEvent(name: string, payload?: Record<string, unknown>): void {
    safeTry(() => {
      const event: CustomEventPayload = {
        ...createBaseFields(this.config),
        type: 'custom',
        name,
        payload
      };
      this.emit(event);
    }, 'BehaviorTracker.trackCustomEvent');
  }

  private patchHistory(): void {
    this.originalPushState = history.pushState.bind(history);
    this.originalReplaceState = history.replaceState.bind(history);
    const originalPushState = this.originalPushState;
    const originalReplaceState = this.originalReplaceState;

    history.pushState = (...args: Parameters<History['pushState']>) => {
      originalPushState(...args);
      this.trackPageView();
    };
    history.replaceState = (...args: Parameters<History['replaceState']>) => {
      originalReplaceState(...args);
      this.trackPageView();
    };
  }
}
