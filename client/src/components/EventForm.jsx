import { useState } from 'react';
import { toInput } from '../lib';

// Admin form for creating / editing an event
export default function EventForm({ onSubmit, onCancel, initial, busy = false }) {
  const [f, setF] = useState({
    title: initial?.title || '',
    location: initial?.location || '',
    event_date: initial ? toInput(initial.event_date) : '',
    capacity: initial?.capacity || 100,
    image_url: initial?.image_url || '',
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  function handleSubmit(e) {
    e.preventDefault();
    if (!f.title.trim() || !f.location.trim()) return setError('Title and location are required');
    if (!f.event_date) return setError('Pick a date and time');
    if (!(Number(f.capacity) >= 1)) return setError('Capacity must be at least 1');
    setError('');
    onSubmit({ ...f, capacity: Number(f.capacity) });
  }

  return (
    <form className="wide" onSubmit={handleSubmit} noValidate>
      <label>Title<input value={f.title} onChange={set('title')} /></label>
      <label>Location<input value={f.location} onChange={set('location')} /></label>
      <label>Date and time<input type="datetime-local" value={f.event_date} onChange={set('event_date')} /></label>
      <label>Capacity<input type="number" min="1" value={f.capacity} onChange={set('capacity')} /></label>
      <label>Image URL (optional)<input value={f.image_url} onChange={set('image_url')} placeholder="https://" /></label>
      {error && <p role="alert">{error}</p>}
      <div className="actions">
        <button type="submit" disabled={busy}>{initial ? 'Save event' : 'Create event'}</button>
        {onCancel && <button type="button" className="ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
