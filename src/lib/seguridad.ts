/**
 * Utilidades de seguridad puras (sin React ni Supabase) para poder probarlas
 * de forma aislada. Cada una corresponde a un hallazgo del informe de
 * auditoría (docs/INFORME_AUDITORIA.md).
 */

/**
 * A1 · Inyección de filtros PostgREST.
 * `.or()` recibe una cadena con la sintaxis de PostgREST, donde `,` separa
 * condiciones, `.` separa columna/operador/valor y `()` agrupa. Si el texto
 * del usuario se interpola tal cual, puede añadir condiciones propias
 * (p. ej. `x%,activo.eq.false` para listar productos ocultos). Se dejan solo
 * letras, números, espacios y guiones, y se limita la longitud.
 */
export function sanitizarBusqueda(texto: string, maximo = 60): string {
  return texto
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximo);
}

/**
 * A3 · Redirección abierta / XSS por `javascript:`.
 * Solo se aceptan rutas internas absolutas ("/algo"). Se rechazan URLs con
 * esquema, rutas relativas a protocolo ("//evil.com") y barras invertidas
 * ("/\\evil.com"), que algunos navegadores tratan como "//".
 */
export function rutaRedireccionSegura(destino: string | null | undefined, porDefecto = '/'): string {
  if (!destino) return porDefecto;
  if (!destino.startsWith('/') || destino.startsWith('//') || destino.includes('\\')) {
    return porDefecto;
  }
  // Caracteres de control (tab, salto de línea…): el parser de URL los elimina
  // y "/\t/evil.com" terminaría siendo "//evil.com".
  if (/[\u0000-\u001f]/.test(destino)) return porDefecto;
  try {
    const url = new URL(destino, 'https://ecomart.invalid');
    if (url.origin !== 'https://ecomart.invalid') return porDefecto;
    return url.pathname + url.search + url.hash;
  } catch {
    return porDefecto;
  }
}

/** C1 · Los códigos promocionales se validan con lista blanca y se muestran como texto. */
export function codigoPromoValido(codigo: string | null): string | null {
  if (!codigo) return null;
  const limpio = codigo.trim().toUpperCase();
  return /^[A-Z0-9-]{3,20}$/.test(limpio) ? limpio : null;
}

export interface EntradaRegistro {
  nombre: string;
  email: string;
  password: string;
  telefono: string;
  bio: string;
}

export type ErroresRegistro = Partial<Record<keyof EntradaRegistro, string>>;

export const PASSWORD_MINIMO = 10;
export const BIO_MAXIMO = 500;

/**
 * A4 · Validación del registro en el cliente. Es solo una ayuda de UX: la
 * política real de contraseñas se configura en Supabase Auth (longitud
 * mínima y caracteres requeridos) y los límites de datos en Postgres.
 */
export function validarRegistro(d: EntradaRegistro): ErroresRegistro {
  const errores: ErroresRegistro = {};
  const nombre = d.nombre.trim();
  if (nombre.length < 2 || nombre.length > 120) {
    errores.nombre = 'Escribe tu nombre (2 a 120 caracteres).';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) {
    errores.email = 'Escribe un correo válido.';
  }
  const usuarioCorreo = d.email.split('@')[0]?.toLowerCase() ?? '';
  if (
    d.password.length < PASSWORD_MINIMO ||
    !/\p{L}/u.test(d.password) ||
    !/\p{N}/u.test(d.password)
  ) {
    errores.password = `Usa al menos ${PASSWORD_MINIMO} caracteres, con letras y números.`;
  } else if (usuarioCorreo.length >= 3 && d.password.toLowerCase().includes(usuarioCorreo)) {
    errores.password = 'La contraseña no debe contener tu correo.';
  }
  if (d.telefono && !/^\+?[\d\s-]{7,20}$/.test(d.telefono)) {
    errores.telefono = 'Escribe un teléfono válido (solo dígitos, espacios o guiones).';
  }
  if (d.bio.length > BIO_MAXIMO) {
    errores.bio = `Máximo ${BIO_MAXIMO} caracteres.`;
  }
  return errores;
}
