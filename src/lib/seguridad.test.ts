import { describe, expect, it } from 'vitest';
import { codigoPromoValido, rutaRedireccionSegura, sanitizarBusqueda, validarRegistro } from './seguridad';

describe('A1 · sanitizarBusqueda (inyección de filtros PostgREST)', () => {
  it('conserva búsquedas normales con tildes, ñ y números', () => {
    expect(sanitizarBusqueda('  Botella  térmica 750 ')).toBe('Botella térmica 750');
    expect(sanitizarBusqueda('piñata')).toBe('piñata');
  });

  it('elimina la sintaxis de PostgREST que permitiría añadir condiciones', () => {
    const ataque = 'x%,activo.eq.false,precio.lt.(1)';
    const limpio = sanitizarBusqueda(ataque);
    expect(limpio).not.toMatch(/[,.()%*:"\\]/);
    expect(limpio).toBe('x activo eq false precio lt 1');
  });

  it('limita la longitud', () => {
    expect(sanitizarBusqueda('a'.repeat(500))).toHaveLength(60);
  });
});

describe('A3 · rutaRedireccionSegura (redirección abierta)', () => {
  it.each([
    ['/checkout', '/checkout'],
    ['/producto/p-001?x=1#a', '/producto/p-001?x=1#a'],
  ])('acepta rutas internas: %s', (entrada, esperado) => {
    expect(rutaRedireccionSegura(entrada)).toBe(esperado);
  });

  it.each([
    'https://evil.example/login',
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    'javascript:alert(document.cookie)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '',
    null,
  ])('rechaza %s y devuelve "/"', (entrada) => {
    expect(rutaRedireccionSegura(entrada)).toBe('/');
  });
});

describe('C1 · codigoPromoValido', () => {
  it('acepta códigos con lista blanca y los normaliza', () => {
    expect(codigoPromoValido('eco-2026')).toBe('ECO-2026');
  });

  it('rechaza HTML y caracteres especiales', () => {
    expect(codigoPromoValido('<img src=x onerror=alert(1)>')).toBeNull();
    expect(codigoPromoValido('ECO"><script>')).toBeNull();
  });
});

describe('A4 · validarRegistro', () => {
  const valido = {
    nombre: 'Ana Gómez',
    email: 'ana@ecomart.test',
    password: 'bosque-verde-2026',
    telefono: '+57 300 111 1111',
    bio: '',
  };

  it('acepta datos válidos', () => {
    expect(validarRegistro(valido)).toEqual({});
  });

  it('exige contraseña de 10+ caracteres con letras y números', () => {
    expect(validarRegistro({ ...valido, password: '1234' }).password).toBeDefined();
    expect(validarRegistro({ ...valido, password: 'soloLetrasLargas' }).password).toBeDefined();
    expect(validarRegistro({ ...valido, password: '12345678901' }).password).toBeDefined();
  });

  it('rechaza contraseñas que contienen el correo', () => {
    expect(validarRegistro({ ...valido, password: 'ana12345678' }).password).toMatch(/correo/);
  });

  it('valida correo, teléfono y longitud de la bio', () => {
    const e = validarRegistro({ ...valido, email: 'ana@', telefono: '<b>1</b>', bio: 'x'.repeat(501) });
    expect(Object.keys(e).sort()).toEqual(['bio', 'email', 'telefono']);
  });
});
