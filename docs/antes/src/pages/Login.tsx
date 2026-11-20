import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { iniciarSesion } from '../lib/api';

export default function Login() {
  const [params] = useSearchParams();
  const guardadas = JSON.parse(localStorage.getItem('ecomart_credenciales') ?? '{}') as {
    email?: string;
    password?: string;
  };
  const [email, setEmail] = useState(guardadas.email ?? '');
  const [password, setPassword] = useState(guardadas.password ?? '');
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    try {
      await iniciarSesion(email, password);
      // Volver a la página desde donde llegó el usuario.
      window.location.href = params.get('redirect') ?? '/';
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <h1>Ingresar</h1>
      <form className="formulario" onSubmit={enviar}>
        <label>
          Correo
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Ingresar</button>
      </form>
    </section>
  );
}
