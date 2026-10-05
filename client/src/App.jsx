import { useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import EventList from './pages/EventList';
import RegisterPage from './pages/RegisterPage';
import AuthPage from './pages/AuthPage';
import MyRegistrations from './pages/MyRegistrations';
import AdminPage from './pages/AdminPage';
import { loadUser, clearSession } from './lib';

export default function App() {
  const [user, setUser] = useState(loadUser);
  const navigate = useNavigate();

  function logout() {
    clearSession();
    setUser(null);
    navigate('/');
  }

  return (
    <>
      <nav>
        <div className="wrap">
          <Link to="/" className="brand">Event Registration</Link>
          <Link to="/">Events</Link>
          {user && user.role !== 'admin' && <Link to="/my-registrations">My Registrations</Link>}
          {user?.role === 'admin' && <Link to="/admin">Admin</Link>}
          {user ? (
            <>
              <span className="muted">{user.name}</span>
              <button onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/signup">Sign up</Link>
            </>
          )}
        </div>
      </nav>
      <main className="wrap">
        <Routes>
          <Route path="/" element={<EventList />} />
          <Route path="/events/:id" element={<RegisterPage user={user} />} />
          <Route path="/login" element={<AuthPage mode="login" onAuth={setUser} />} />
          <Route path="/signup" element={<AuthPage mode="signup" onAuth={setUser} />} />
          <Route path="/my-registrations" element={<MyRegistrations user={user} />} />
          <Route path="/admin" element={<AdminPage user={user} />} />
          <Route path="*" element={<h1>Page not found</h1>} />
        </Routes>
      </main>
      <footer>
        <div className="wrap">Build {import.meta.env.VITE_BUILD || 'dev'}</div>
      </footer>
    </>
  );
}
