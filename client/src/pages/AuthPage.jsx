import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, saveSession } from '../lib';

// One page for both /login and /signup
export default function AuthPage({ mode, onAuth }) {
  const signup = mode === 'signup';
  const navigate = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (signup && !f.name.trim()) return setError('Name is required');
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return setError('Enter a valid email');
    if (f.password.length < 6) return setError('Password must be at least 6 characters');
    setBusy(true);
    try {
      const { token, user } = await api(`/auth/${mode}`, { method: 'POST', body: f });
      saveSession(token, user);
      onAuth(user);
      navigate(user.role === 'admin' ? '/admin' : '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>{signup ? 'Create an account' : 'Log in'}</h1>
      <form onSubmit={submit} noValidate>
        {signup && <label>Name<input value={f.name} onChange={set('name')} /></label>}
        <label>Email<input type="email" value={f.email} onChange={set('email')} /></label>
        <label>Password<input type="password" value={f.password} onChange={set('password')} /></label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{signup ? 'Sign up' : 'Log in'}</button>
      </form>
      <p className="muted">
        {signup ? <>Already have an account? <Link to="/login">Log in</Link></> : <>New here? <Link to="/signup">Create an account</Link></>}
      </p>
    </>
  );
}
