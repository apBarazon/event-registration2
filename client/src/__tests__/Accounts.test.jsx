import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';
import AuthPage from '../pages/AuthPage';
import MyRegistrations from '../pages/MyRegistrations';
import AdminPage from '../pages/AdminPage';
import EventForm from '../components/EventForm';

const ok = (data) => ({ ok: true, json: async () => data });
const ana = { id: 5, name: 'Ana', email: 'ana@example.com', role: 'user' };

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

test('login shows an error for a short password and does not call the API', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  render(<MemoryRouter><AuthPage mode="login" onAuth={() => {}} /></MemoryRouter>);
  await userEvent.type(screen.getByLabelText(/email/i), 'ana@example.com');
  await userEvent.type(screen.getByLabelText(/password/i), '123');
  await userEvent.click(screen.getByRole('button', { name: /log in/i }));
  expect(screen.getByRole('alert')).toHaveTextContent(/at least 6/i);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('login stores the session and reports the user', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ token: 'tok', user: ana })));
  const onAuth = vi.fn();
  render(<MemoryRouter><AuthPage mode="login" onAuth={onAuth} /></MemoryRouter>);
  await userEvent.type(screen.getByLabelText(/email/i), 'ana@example.com');
  await userEvent.type(screen.getByLabelText(/password/i), 'secret1');
  await userEvent.click(screen.getByRole('button', { name: /log in/i }));
  await vi.waitFor(() => expect(onAuth).toHaveBeenCalledWith(ana));
  expect(localStorage.getItem('token')).toBe('tok');
});

test('My Registrations redirects to login when logged out', () => {
  render(
    <MemoryRouter initialEntries={['/my-registrations']}>
      <Routes>
        <Route path="/my-registrations" element={<MyRegistrations user={null} />} />
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>
  );
  expect(screen.getByText('login page')).toBeInTheDocument();
});

test('My Registrations lists registrations and can delete one', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(ok([{ id: 1, title: 'Intro to Docker', location: 'Room A', event_date: '2026-11-10 09:00:00', name: 'Ana', email: 'ana@example.com' }]))
    .mockResolvedValueOnce(ok({ message: 'Deleted' }))
    .mockResolvedValueOnce(ok([]));
  vi.stubGlobal('fetch', fetchMock);
  render(<MemoryRouter><MyRegistrations user={ana} /></MemoryRouter>);
  expect(await screen.findByText('Intro to Docker')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /delete/i }));
  expect(await screen.findByText(/you have not registered/i)).toBeInTheDocument();
  expect(fetchMock.mock.calls[1][0]).toBe('/api/me/registrations/1');
  expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
});

test('Admin page is not available to normal users', () => {
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminPage user={ana} />} />
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>
  );
  expect(screen.getByText('login page')).toBeInTheDocument();
});

test('EventForm validates and submits event fields', async () => {
  const onSubmit = vi.fn();
  render(<EventForm onSubmit={onSubmit} />);
  await userEvent.click(screen.getByRole('button', { name: /create event/i }));
  expect(screen.getByRole('alert')).toHaveTextContent(/required/i);
  await userEvent.type(screen.getByLabelText(/title/i), 'Talk');
  await userEvent.type(screen.getByLabelText(/location/i), 'Room C');
  fireEvent.change(screen.getByLabelText(/date and time/i), { target: { value: '2026-12-01T10:00' } });
  await userEvent.type(screen.getByLabelText(/image url/i), 'https://example.com/a.jpg');
  await userEvent.click(screen.getByRole('button', { name: /create event/i }));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Talk', capacity: 100, image_url: 'https://example.com/a.jpg' }));
});
