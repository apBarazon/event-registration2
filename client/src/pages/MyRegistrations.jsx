import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import RegisterForm from '../components/RegisterForm';
import { api, fmtDate } from '../lib';

export default function MyRegistrations({ user }) {
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null); // registration id
  const [message, setMessage] = useState(null); // { ok, text }

  const load = () => api('/me/registrations').then(setItems).catch((e) => setMessage({ ok: false, text: e.message }));
  useEffect(() => { if (user) load(); }, [user]);

  if (!user) return <Navigate to="/login" />;

  async function run(action, okText) {
    try {
      await action();
      setEditing(null);
      setMessage({ ok: true, text: okText });
      load();
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
  }

  if (!items) return message ? <p role="alert">{message.text}</p> : <p>Loading…</p>;

  return (
    <>
      <h1>My registrations</h1>
      {message && <p role={message.ok ? 'status' : 'alert'}>{message.text}</p>}
      {items.length === 0 && <p className="muted">You have not registered for any event yet.</p>}
      {items.map((r) => (
        <div className="reg" key={r.id}>
          <h2>{r.title}</h2>
          <p className="muted">{r.location} · {fmtDate(r.event_date)}</p>
          {editing === r.id ? (
            <>
              <RegisterForm initial={r} submitLabel="Save" onSubmit={(v) => run(() => api(`/me/registrations/${r.id}`, { method: 'PUT', body: v }), 'Registration updated')} />
              <button className="ghost small" onClick={() => setEditing(null)}>Cancel</button>
            </>
          ) : (
            <>
              <p>{r.name} · {r.email}</p>
              <div className="actions">
                <button className="ghost small" onClick={() => setEditing(r.id)}>Edit</button>
                <button className="danger small" onClick={() => run(() => api(`/me/registrations/${r.id}`, { method: 'DELETE' }), 'Registration deleted')}>Delete</button>
              </div>
            </>
          )}
        </div>
      ))}
    </>
  );
}
