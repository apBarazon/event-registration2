import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import RegisterForm from '../components/RegisterForm';

test('shows an error for an invalid email and does not submit', async () => {
  const onSubmit = vi.fn();
  render(<RegisterForm onSubmit={onSubmit} />);
  await userEvent.type(screen.getByLabelText(/name/i), 'Ana');
  await userEvent.type(screen.getByLabelText(/email/i), 'nope');
  await userEvent.click(screen.getByRole('button', { name: /register/i }));
  expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i);
  expect(onSubmit).not.toHaveBeenCalled();
});

test('submits trimmed values when valid', async () => {
  const onSubmit = vi.fn();
  render(<RegisterForm onSubmit={onSubmit} />);
  await userEvent.type(screen.getByLabelText(/name/i), ' Ana ');
  await userEvent.type(screen.getByLabelText(/email/i), 'ana@example.com');
  await userEvent.click(screen.getByRole('button', { name: /register/i }));
  expect(onSubmit).toHaveBeenCalledWith({ name: 'Ana', email: 'ana@example.com' });
});