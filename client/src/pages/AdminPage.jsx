import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import EventForm from '../components/EventForm';
import { api, fmtDate } from '../lib';

export default function AdminPage({ user }) {
  const [tab, setTab] = useState('events');
  const [events, setEvents] = useState([]);
  const [report, setReport] = useState([]);
  const [editing, setEditing] = useState(null);   // null = closed, 'new' = create form, event = edit form
  const [people, setPeople] = useState(null);     // { title, rows } registrants of one event
  const [message, setMessage] = useState(null);   // { ok, text }

  const isAdmin = user?.role === 'admin';
  const load = () => {
    api('/events').then(setEvents).catch((e) => setMessage({ ok: false, text: e.message }));
    api('/admin/report').then(setReport).catch(() => {});
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/login" />;

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

  const save = (values) => editing === 'new'
    ? run(() => api('/admin/events', { method: 'POST', body: values }), 'Event created')
    : run(() => api(`/admin/events/${editing.id}`, { method: 'PUT', body: values }), 'Event updated');

  const showPeople = (ev) =>
    api(`/admin/events/${ev.id}/registrations`).then((rows) => setPeople({ title: ev.title, rows }))
      .catch((e) => setMessage({ ok: false, text: e.message }));

  const total = report.reduce((n, r) => n + r.registered, 0);
  const seats = report.reduce((n, r) => n + r.capacity, 0);

  return (
    <>
      <h1>Admin panel</h1>
      <div className="tabs">
        <button className={tab === 'events' ? 'on' : ''} onClick={() => setTab('events')}>Events</button>
        <button className={tab === 'report' ? 'on' : ''} onClick={() => setTab('report')}>Report</button>
      </div>
      {message && <p role={message.ok ? 'status' : 'alert'}>{message.text}</p>}

      {tab === 'events' && (
        <>
          {editing ? (
            <EventForm initial={editing === 'new' ? null : editing} onSubmit={save} onCancel={() => setEditing(null)} />
          ) : (
            <p><button onClick={() => setEditing('new')}>New event</button></p>
          )}
          <div className="scroll">
            <table>
              <thead><tr><th>Event</th><th>Date</th><th>Registered</th><th></th></tr></thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td>{ev.title}<br /><span className="muted">{ev.location}</span></td>
                    <td>{fmtDate(ev.event_date)}</td>
                    <td>{ev.registered}/{ev.capacity}</td>
                    <td className="actions">
                      <button className="ghost small" onClick={() => showPeople(ev)}>Registrants</button>
                      <button className="ghost small" onClick={() => setEditing(ev)}>Edit</button>
                      <button className="danger small" onClick={() => run(() => api(`/admin/events/${ev.id}`, { method: 'DELETE' }), 'Event deleted')}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {people && (
            <div className="panel">
              <h3 style={{ marginTop: 0 }}>Registrants: {people.title}</h3>
              {people.rows.length === 0 ? <p className="muted">Nobody has registered yet.</p> : (
                <table>
                  <thead><tr><th>Name</th><th>Email</th><th>Registered on</th></tr></thead>
                  <tbody>{people.rows.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.email}</td><td>{fmtDate(p.created_at)}</td></tr>)}</tbody>
                </table>
              )}
              <button className="ghost small" onClick={() => setPeople(null)}>Close</button>
            </div>
          )}
        </>
      )}

      {tab === 'report' && (
        <div className="scroll">
          <table>
            <thead><tr><th>Event</th><th>Date</th><th>Capacity</th><th>Registered</th><th>Seats left</th><th>Filled</th></tr></thead>
            <tbody>
              {report.map((r) => (
                <tr key={r.id}>
                  <td>{r.title}</td><td>{fmtDate(r.event_date)}</td><td>{r.capacity}</td><td>{r.registered}</td>
                  <td>{r.capacity - r.registered}</td><td>{Math.round((r.registered / r.capacity) * 100)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td>Total</td><td></td><td>{seats}</td><td>{total}</td><td>{seats - total}</td><td>{seats ? Math.round((total / seats) * 100) : 0}%</td></tr></tfoot>
          </table>
        </div>
      )}
    </>
  );
}
