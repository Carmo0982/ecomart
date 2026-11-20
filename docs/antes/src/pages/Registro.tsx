import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { registrarUsuario } from '../lib/api';
import type { DatosRegistro } from '../lib/tipos';

export default function Registro() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const promo = params.get('promo');
  // Permite que el equipo de ventas cree cuentas mayoristas o admin con un link.
  const rol = params.get('rol') ?? 'cliente';

  const [datos, setDatos] = useState<DatosRegistro>({
    nombre: '',
    email: '',
    password: '',
    telefono: '',
    bio: '',
  });
  const [recordarme, setRecordarme] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cambiar = (campo: keyof DatosRegistro) => (valor: string) =>
    setDatos((d) => ({ ...d, [campo]: valor }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (datos.password.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres');
      return;
    }
    try {
      await registrarUsuario(datos, rol);
      if (recordarme) {
        localStorage.setItem(
          'ecomart_credenciales',
          JSON.stringify({ email: datos.email, password: datos.password }),
        );
      }
      navigate('/catalogo');
    } catch (err) {
      // Mostrar el error exacto de Supabase ayuda a depurar.
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <h1>Crear cuenta</h1>
      {promo && (
        <div className="promo" dangerouslySetInnerHTML={{ __html: `🎁 Código aplicado: <b>${promo}</b>` }} />
      )}
      <form className="formulario" onSubmit={enviar}>
        <label>
          Nombre completo
          <input value={datos.nombre} onChange={(e) => cambiar('nombre')(e.target.value)} />
        </label>
        <label>
          Correo
          <input value={datos.email} onChange={(e) => cambiar('email')(e.target.value)} />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={datos.password}
            onChange={(e) => cambiar('password')(e.target.value)}
          />
        </label>
        <label>
          Teléfono
          <input value={datos.telefono} onChange={(e) => cambiar('telefono')(e.target.value)} />
        </label>
        <label>
          Cuéntanos sobre ti (admite HTML)
          <textarea value={datos.bio} onChange={(e) => cambiar('bio')(e.target.value)} />
        </label>
        <div className="vista-previa">
          <p>Vista previa de tu perfil:</p>
          <div dangerouslySetInnerHTML={{ __html: `<h3>${datos.nombre}</h3>${datos.bio}` }} />
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={recordarme}
            onChange={(e) => setRecordarme(e.target.checked)}
          />
          Recordarme en este equipo
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Registrarme</button>
      </form>
    </section>
  );
}
