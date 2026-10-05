import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate } from '../lib';

export default function EventList() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/events')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load events'))))
      .then(setEvents)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!events) return <p>Loading…</p>;

  return (
    <>
      <h1>Upcoming events</h1>
      <ul className="grid">
        {events.map((ev) => (
          <li key={ev.id}>
            {ev.image_url ? <img className="cover" src={ev.image_url} alt="" /> : <div className="cover" />}
            <div className="body">
              <h2>{ev.title}</h2>
              <span className="muted">{ev.location} · {fmtDate(ev.event_date)}</span>
              <div className="foot">
                <span className="muted">{ev.registered}/{ev.capacity} registered</span>
                <Link to={`/events/${ev.id}`}>Register</Link>
              </div>
            </div>
            <div className="bar"><span style={{ width: `${Math.min(100, (ev.registered / ev.capacity) * 100)}%` }} /></div>
          </li>
        ))}
      </ul>
    </>
  );
}
