import { Component, type ErrorInfo, type ReactNode } from 'react';
import { SDKClient } from '../core/SDKClient.js';

export interface MonitoringErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error) => ReactNode);
}

interface MonitoringErrorBoundaryState {
  error: Error | null;
}

export class MonitoringErrorBoundary extends Component<MonitoringErrorBoundaryProps, MonitoringErrorBoundaryState> {
  state: MonitoringErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): MonitoringErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    SDKClient.captureException(error, {
      category: 'REACT_RENDER',
      componentStack: errorInfo.componentStack ?? undefined
    });
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { fallback } = this.props;
    if (typeof fallback === 'function') return fallback(error);
    return fallback ?? null;
  }
}
