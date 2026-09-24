import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState(localStorage.getItem('username') || 'admin');
  const [token, setToken] = useState(localStorage.getItem('token') || 'demo-jwt-token');

  const handleSubmit = (e) => {
    e.preventDefault();

    localStorage.setItem('username', username.trim() || 'admin');
    localStorage.setItem('token', token.trim());

    navigate('/', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-md">
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Wastios Login</h1>
        <p className="mb-6 text-sm text-slate-600">Enter username and JWT token to access dashboard.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="token">
              JWT Token
            </label>
            <textarea
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
