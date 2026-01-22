import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders without crashing', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', timestamp: new Date().toISOString() }),
    } as Response);

    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();

    // Wait for async operations to complete
    await waitFor(() => {
      expect(screen.getByText('ok')).toBeInTheDocument();
    });
  });

  it('displays the main heading', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', timestamp: new Date().toISOString() }),
    } as Response);

    render(<App />);
    expect(screen.getByText('Renewal Initiatives Timesheet')).toBeInTheDocument();

    // Wait for async operations to complete
    await waitFor(() => {
      expect(screen.getByText('ok')).toBeInTheDocument();
    });
  });

  it('shows health status when API call succeeds', async () => {
    const mockTimestamp = '2024-01-15T10:30:00.000Z';
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', timestamp: mockTimestamp }),
    } as Response);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('ok')).toBeInTheDocument();
    });
  });

  it('shows error when API call fails', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });
  });
});
