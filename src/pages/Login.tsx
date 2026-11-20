import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ErrorApp, iniciarSesion } from '../lib/api';
import { rutaRedireccionSegura } from '../lib/seguridad';

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // A4: ya no se leen credenciales de localStorage. La sesión persistente la
  // maneja supabase-js con tokens de acceso/refresh, nunca con la contraseña.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await iniciarSesion(email, password);
      // A3: solo rutas internas. "?redirect=https://evil.com" o "javascript:…" → "/".
      navigate(rutaRedireccionSegura(params.get('redirect')), { replace: true });
    } catch (err) {
      setError(err instanceof ErrorApp ? err.message : 'Ocurrió un error inesperado.');
    } finally {
      setEnviando(false);
      setPassword('');
    }
  }

  return (
    <section>
      <h1>Ingresar</h1>
      <form className="formulario" onSubmit={enviar}>
        <label>
          Correo
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </section>
  );
}
