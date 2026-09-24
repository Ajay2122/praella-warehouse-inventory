import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { Button, ErrorText, Field, Input } from '../components/ui';

export function Login() {
  const { user, login, signup } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') await login(email, password);
      else await signup(organizationName, email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Praella WMS</h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === 'login' ? 'Sign in to your organization' : 'Create a new organization'}
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {mode === 'signup' && (
            <Field label="Organization name">
              <Input
                required
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="Acme Retail"
              />
            </Field>
          )}
          <Field label="Email">
            <Input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@acme.test"
            />
          </Field>
          <Field label="Password">
            <Input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
            />
          </Field>

          <ErrorText>{error}</ErrorText>

          <Button type="submit" className="w-full justify-center" disabled={submitting}>
            {submitting ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create organization'}
          </Button>
        </form>

        <button
          className="mt-4 w-full text-center text-xs text-slate-500 hover:text-slate-700"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError(null);
          }}
        >
          {mode === 'login' ? "Don't have an organization yet? Sign up" : 'Already have an account? Log in'}
        </button>

        <p className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-400">
          Seed login: <code>admin@acme.test</code> / <code>Passw0rd!</code>
        </p>
      </div>
    </div>
  );
}
