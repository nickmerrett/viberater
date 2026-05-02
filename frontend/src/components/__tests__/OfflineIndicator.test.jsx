import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import OfflineIndicator from '../OfflineIndicator.jsx';

vi.mock('../../services/syncService.js', () => ({
  syncService: {
    onSyncStart: vi.fn(),
    onSyncComplete: vi.fn(),
    onSyncError: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OfflineIndicator', () => {
  it('renders nothing when online', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    const { container } = render(<OfflineIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('shows offline banner when offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
    render(<OfflineIndicator />);
    expect(screen.getByText('Offline Mode')).toBeInTheDocument();
  });
});
