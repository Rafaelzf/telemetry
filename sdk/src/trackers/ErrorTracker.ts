import { createBaseFields, safeTry } from '../core/utils.js';
import type { ErrorEventPayload, ResolvedSDKConfig, TelemetryEvent } from '../core/types.js';

export interface CaptureExceptionDetails {
  category?: ErrorEventPayload['errorDetails']['category'];
  componentStack?: string;
}

export class ErrorTracker {
  private readonly onErrorEvent = (event: Event) => this.handleWindowError(event as ErrorEvent);
  private readonly onUnhandledRejection = (event: PromiseRejectionEvent) => this.handleUnhandledRejection(event);

  constructor(
    private readonly config: ResolvedSDKConfig,
    private readonly emit: (event: TelemetryEvent) => void
  ) {}

  start(): void {
    if (typeof window === 'undefined') return;
    // capture phase (`true`): resource load errors (img/script/link) don't bubble,
    // so they only reach a window listener registered for the capture phase.
    window.addEventListener('error', this.onErrorEvent, true);
    window.addEventListener('unhandledrejection', this.onUnhandledRejection);
  }

  stop(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('error', this.onErrorEvent, true);
    window.removeEventListener('unhandledrejection', this.onUnhandledRejection);
  }

  captureException(error: unknown, details: CaptureExceptionDetails = {}): void {
    safeTry(() => {
      const { message, stackTrace } = normalizeError(error);
      this.report({
        category: details.category ?? 'JS_RUNTIME',
        message,
        stackTrace: details.componentStack ? `${stackTrace ?? ''}\n\nComponent Stack:${details.componentStack}` : stackTrace
      });
    }, 'ErrorTracker.captureException');
  }

  private handleWindowError(event: ErrorEvent): void {
    safeTry(() => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        this.report({
          category: 'RESOURCE',
          message: `Failed to load resource: ${describeResourceTarget(target)}`,
          source: getResourceSource(target)
        });
        return;
      }

      this.report({
        category: 'JS_RUNTIME',
        message: event.message || 'Unknown runtime error',
        stackTrace: event.error?.stack,
        source: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined
      });
    }, 'ErrorTracker.handleWindowError');
  }

  private handleUnhandledRejection(event: PromiseRejectionEvent): void {
    safeTry(() => {
      const { message, stackTrace } = normalizeError(event.reason);
      this.report({ category: 'UNHANDLED_PROMISE', message, stackTrace });
    }, 'ErrorTracker.handleUnhandledRejection');
  }

  private report(details: ErrorEventPayload['errorDetails']): void {
    const payload: ErrorEventPayload = {
      ...createBaseFields(this.config),
      type: 'error',
      errorDetails: details
    };
    this.emit(payload);
  }
}

function normalizeError(error: unknown): { message: string; stackTrace?: string } {
  if (error instanceof Error) {
    return { message: error.message, stackTrace: error.stack };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

function describeResourceTarget(target: HTMLElement): string {
  const tag = target.tagName.toLowerCase();
  const src = getResourceSource(target);
  return src ? `<${tag}> ${src}` : `<${tag}>`;
}

function getResourceSource(target: HTMLElement): string | undefined {
  if ('src' in target && typeof (target as HTMLImageElement).src === 'string') return (target as HTMLImageElement).src;
  if ('href' in target && typeof (target as HTMLLinkElement).href === 'string') return (target as HTMLLinkElement).href;
  return undefined;
}
