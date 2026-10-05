import { useState } from 'react';

// Used for registering AND for editing a registration (initial + submitLabel)
export default function RegisterForm({ onSubmit, busy = false, initial = {}, submitLabel = 'Register' }) {
  const [name, setName] = useState(initial.name || '');
  const [email, setEmail] = useState(initial.email || '');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Name is required');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email');
    setError('');
    onSubmit({ name: name.trim(), email: email.trim() });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label>Name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{submitLabel}</button>
    </form>
  );
}
