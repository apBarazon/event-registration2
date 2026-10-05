// Small helpers shared by the pages

// fetch wrapper: adds the login token, returns JSON, throws Error(message) on failure
export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api${path}`, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

export const loadUser = () => JSON.parse(localStorage.getItem('user') || 'null');
export function saveSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// MySQL gives 'YYYY-MM-DD HH:MM:SS'; Safari needs the 'T'
export const toDate = (s) => new Date(String(s).replace(' ', 'T'));
export const toInput = (s) => String(s).replace(' ', 'T').slice(0, 16); // for <input type="datetime-local">
export const fmtDate = (s) => toDate(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
