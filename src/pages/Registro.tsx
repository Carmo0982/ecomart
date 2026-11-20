import { useId, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ErrorApp, registrarUsuario } from '../lib/api';
import {
  BIO_MAXIMO,
  PASSWORD_MINIMO,
  codigoPromoValido,
  validarRegistro,
  type EntradaRegistro,
  type ErroresRegistro,
} from '../lib/seguridad';

const VACIO: EntradaRegistro = { nombre: '', email: '', password: '', telefono: '', bio: '' };

/**
 * Formulario de registro (versión auditada).
 *
 * Cambios frente a la versión original (docs/antes/src/pages/Registro.tsx):
 *  - C1: sin dangerouslySetInnerHTML. El código promo de la URL y la vista
 *    previa del perfil se pintan como texto; React escapa el contenido.
 *  - C2: el rol ya no se lee de la URL ni se envía a Supabase.
 *  - A4: validación con política de contraseña y sin guardar la contraseña
 *    en localStorage (la sesión la maneja supabase-js con tokens).
 *  - Mensajes de error genéricos (no revelan si el correo ya existe).
 */
export default function Registro() {
  const id = useId();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const promo = codigoPromoValido(params.get('promo'));

  const [datos, setDatos] = useState<EntradaRegistro>(VACIO);
  const [errores, setErrores] = useState<ErroresRegistro>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pendienteConfirmar, setPendienteConfirmar] = useState(false);

  const cambiar = (campo: keyof EntradaRegistro) => (valor: string) =>
    setDatos((d) => ({ ...d, [campo]: valor }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const encontrados = validarRegistro(datos);
    setErrores(encontrados);
    setErrorGeneral(null);
    if (Object.keys(encontrados).length > 0) return;

    setEnviando(true);
    try {
      const { requiereConfirmacion } = await registrarUsuario(datos);
      setDatos(VACIO); // no dejar la contraseña en memoria del componente
      if (requiereConfirmacion) setPendienteConfirmar(true);
      else navigate('/catalogo');
    } catch (err) {
      setErrorGeneral(err instanceof ErrorApp ? err.message : 'Ocurrió un error inesperado.');
    } finally {
      setEnviando(false);
    }
  }

  if (pendienteConfirmar) {
    return (
      <section>
        <h1>Revisa tu correo</h1>
        <p>Te enviamos un enlace para confirmar la cuenta.</p>
        <Link to="/login">Ir a ingresar</Link>
      </section>
    );
  }

  const campo = (nombre: keyof EntradaRegistro) => ({
    id: `${id}-${nombre}`,
    value: datos[nombre],
    'aria-invalid': errores[nombre] ? true : undefined,
    'aria-describedby': errores[nombre] ? `${id}-${nombre}-error` : undefined,
  });
  const error = (nombre: keyof EntradaRegistro) =>
    errores[nombre] && (
      <span id={`${id}-${nombre}-error`} role="alert">
        {errores[nombre]}
      </span>
    );

  return (
    <section>
      <h1>Crear cuenta</h1>
      {promo && (
        <p className="promo">
          🎁 Código aplicado: <b>{promo}</b>
        </p>
      )}
      <form className="formulario" onSubmit={enviar} noValidate>
        <label htmlFor={`${id}-nombre`}>
          Nombre completo
          <input {...campo('nombre')} autoComplete="name" maxLength={120} onChange={(e) => cambiar('nombre')(e.target.value)} />
          {error('nombre')}
        </label>
        <label htmlFor={`${id}-email`}>
          Correo
          <input {...campo('email')} type="email" autoComplete="email" onChange={(e) => cambiar('email')(e.target.value)} />
          {error('email')}
        </label>
        <label htmlFor={`${id}-password`}>
          Contraseña
          <input
            {...campo('password')}
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MINIMO}
            onChange={(e) => cambiar('password')(e.target.value)}
          />
          <span className="ayuda">Mínimo {PASSWORD_MINIMO} caracteres, con letras y números.</span>
          {error('password')}
        </label>
        <label htmlFor={`${id}-telefono`}>
          Teléfono (opcional)
          <input {...campo('telefono')} type="tel" autoComplete="tel" onChange={(e) => cambiar('telefono')(e.target.value)} />
          {error('telefono')}
        </label>
        <label htmlFor={`${id}-bio`}>
          Cuéntanos sobre ti (opcional, texto plano)
          <textarea {...campo('bio')} maxLength={BIO_MAXIMO} onChange={(e) => cambiar('bio')(e.target.value)} />
          {error('bio')}
        </label>
        <div className="vista-previa" aria-live="polite">
          <p>Vista previa de tu perfil:</p>
          {/* JSX escapa el texto: "<img onerror=…>" se ve literal, no se ejecuta. */}
          <h3>{datos.nombre}</h3>
          <p className="descripcion">{datos.bio}</p>
        </div>
        {errorGeneral && <p role="alert">{errorGeneral}</p>}
        <button type="submit" disabled={enviando}>
          {enviando ? 'Creando cuenta…' : 'Registrarme'}
        </button>
      </form>
    </section>
  );
}
