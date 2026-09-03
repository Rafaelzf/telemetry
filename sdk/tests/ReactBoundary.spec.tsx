import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MonitoringErrorBoundary } from '../src/react/MonitoringErrorBoundary.js';
import { SDKClient } from '../src/core/SDKClient.js';

function Bomb(): ReactElement {
  throw new Error('kaboom');
}

describe('MonitoringErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(SDKClient, 'captureException').mockImplementation(() => {});
    // React logs the caught error to console.error; silence it for a clean test run.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders the fallback and reports the error to the SDK', () => {
    render(
      <MonitoringErrorBoundary fallback={<div>something broke</div>}>
        <Bomb />
      </MonitoringErrorBoundary>
    );

    expect(screen.getByText('something broke')).toBeInTheDocument();
    expect(SDKClient.captureException).toHaveBeenCalledTimes(1);

    const [error, details] = vi.mocked(SDKClient.captureException).mock.calls[0]!;
    expect(error).toBeInstanceOf(Error);
    expect(details).toMatchObject({ category: 'REACT_RENDER' });
  });

  it('renders children normally when nothing throws', () => {
    render(
      <MonitoringErrorBoundary fallback={<div>should not appear</div>}>
        <div>all good</div>
      </MonitoringErrorBoundary>
    );

    expect(screen.getByText('all good')).toBeInTheDocument();
    expect(SDKClient.captureException).not.toHaveBeenCalled();
  });
});
