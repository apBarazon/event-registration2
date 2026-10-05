import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import RegisterForm from '../components/RegisterForm';
import { api } from '../lib';

export default function RegisterPage({ user }) {
  const { id } = useParams();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, text }

  async function submit(values) {
    setBusy(true);
    try {
      await api(`/events/${id}/register`, { method: 'POST', body: values });
      setResult({ ok: true, text: "You're registered!" });
    } catch (err) {
      setResult({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Register for event #{id}</h1>
      <RegisterForm onSubmit={submit} busy={busy} initial={user || {}} />
      {result && <p role={result.ok ? 'status' : 'alert'}>{result.text}</p>}
      {result?.ok && user && <p><Link to="/my-registrations">View my registrations</Link></p>}
      {!user && <p className="muted"><Link to="/login">Log in</Link> first if you want to find this registration later.</p>}
    </>
  );
}
