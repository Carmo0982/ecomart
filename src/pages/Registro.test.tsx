import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Registro from './Registro';

const XSS = '<img src=x onerror="window.__xss=1">';

function montar(url = '/registro') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Registro />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Registro (C1 · XSS)', () => {
  it('un código promo malicioso en la URL no se renderiza como HTML', () => {
    const { container } = montar(`/registro?promo=${encodeURIComponent(XSS)}`);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByText(/Código aplicado/)).toBeNull(); // no pasa la lista blanca
  });

  it('un código promo válido se muestra como texto', () => {
    montar('/registro?promo=eco-2026');
    expect(screen.getByText('ECO-2026')).toBeTruthy();
  });

  it('la vista previa muestra el HTML escrito por el usuario como texto literal', () => {
    const { container } = montar();
    fireEvent.change(screen.getByLabelText(/Cuéntanos sobre ti/), { target: { value: XSS } });
    fireEvent.change(screen.getByLabelText(/Nombre completo/), { target: { value: '<b>Ana</b>' } });
    const vista = container.querySelector('.vista-previa')!;
    expect(vista.querySelector('img, b')).toBeNull();
    expect(vista.textContent).toContain(XSS);
    expect(vista.textContent).toContain('<b>Ana</b>');
  });

  it('no usa dangerouslySetInnerHTML en ningún punto del formulario', () => {
    const { container } = montar(`/registro?promo=${encodeURIComponent(XSS)}`);
    expect(container.innerHTML).not.toContain('<img');
  });
});

describe('Registro (A4 · autenticación)', () => {
  it('bloquea contraseñas débiles y no guarda credenciales en localStorage', () => {
    montar();
    fireEvent.change(screen.getByLabelText(/Nombre completo/), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText(/^Correo/), { target: { value: 'ana@ecomart.test' } });
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrarme/ }));
    expect(screen.getByText(/al menos 10 caracteres/)).toBeTruthy();
    expect(localStorage.length).toBe(0);
  });

  it('ignora ?rol=admin: el formulario no tiene forma de enviar un rol', () => {
    const { container } = montar('/registro?rol=admin');
    expect(container.innerHTML).not.toMatch(/admin/i);
  });
});
