'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username,
          password,
        }),
      });

      if (!res.ok) {
        throw new Error('Invalid credentials');
      }

      const data = await res.json();
      localStorage.setItem('gear_token', data.access_token);
      
      // Redirect to the dashboard/war-room
      router.push('/war-room');
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md border border-gray-700">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-wider text-blue-400 mb-2">G.E.A.R.</h1>
          <p className="text-gray-400 text-sm tracking-widest uppercase">Global Energy Adaptive Resilience</p>
          <div className="mt-4 inline-block px-3 py-1 bg-red-900/50 text-red-400 border border-red-800 rounded text-xs font-mono">
            RESTRICTED ACCESS
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 text-red-400 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">IDENTIFICATION</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500 font-mono"
              placeholder="e.g. admin, analyst, operator"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">AUTHORIZATION KEY</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500 font-mono tracking-widest"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded transition-colors uppercase tracking-widest text-sm"
          >
            Authenticate
          </button>
        </form>
        
        <div className="mt-6 border-t border-gray-700 pt-6">
          <p className="text-xs text-gray-500 font-mono">
            Test accounts available:<br/>
            - admin / admin123<br/>
            - analyst / analyst123<br/>
            - operator / operator123<br/>
            - decision_maker / decision123<br/>
            - viewer / viewer123
          </p>
        </div>
      </div>
    </div>
  );
}
