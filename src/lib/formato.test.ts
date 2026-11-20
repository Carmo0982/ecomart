import { describe, expect, it } from 'vitest';
import { claveMes, etiquetaCategoria, fechaEntregaEstimada, formatearFecha, formatearPrecio } from './formato';
import { resumenPorMes } from '../pages/Admin';
import type { Pedido } from './tipos';

// Las funciones nuevas (date-fns + Intl) deben dar el mismo resultado visible
// que las antiguas (moment + lodash).
describe('formato (moment → date-fns, lodash → nativo)', () => {
  it('formatea precios en pesos colombianos sin decimales', () => {
    expect(formatearPrecio(74900).replace(/\s/g, ' ')).toMatch(/^\$ ?74\.900$/);
  });

  it('formatea fechas en español', () => {
    expect(formatearFecha('2026-11-20T15:00:00')).toBe('20 de noviembre de 2026');
    expect(fechaEntregaEstimada(new Date('2026-11-20T12:00:00'), 3)).toBe('lunes 23 de noviembre');
  });

  it('reemplaza _.capitalize/_.replace', () => {
    expect(etiquetaCategoria('cuidado-personal')).toBe('Cuidado personal');
  });

  it('reemplaza _.groupBy/_.sumBy/_.orderBy en el resumen del admin', () => {
    const p = (creado_en: string, total: number): Pedido => ({
      id: creado_en, user_id: 'u', total, estado: 'pagado', direccion_envio: 'x', creado_en,
    });
    expect(claveMes('2026-10-05T12:00:00')).toBe('2026-10');
    expect(
      resumenPorMes([p('2026-10-05T12:00:00', 100), p('2026-11-01T12:00:00', 50), p('2026-10-20T12:00:00', 25)]),
    ).toEqual([
      { mes: '2026-11', cantidad: 1, ventas: 50 },
      { mes: '2026-10', cantidad: 2, ventas: 125 },
    ]);
  });
});
