import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import EventList from '../pages/EventList';

afterEach(() => vi.restoreAllMocks());

test('renders events with a register link', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [{ id: 7, title: 'React Workshop', location: 'Hall', event_date: '2026-11-24T10:00:00Z', capacity: 50, registered: 3 }],
  }));
  render(<MemoryRouter><EventList /></MemoryRouter>);
  expect(await screen.findByText('React Workshop')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /register/i })).toHaveAttribute('href', '/events/7');
});

test('shows an error when the API fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  render(<MemoryRouter><EventList /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent(/failed/i);
});