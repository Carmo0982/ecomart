// date-fns es modular: solo entran al bundle las funciones importadas y el
// locale español (moment incluía todo su núcleo, ~60 kB minificado).
import { addDays, format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale/es';

// Intl viene con el navegador: no cuesta bytes.
const moneda = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export function formatearPrecio(valor: number): string {
  return moneda.format(Math.round(valor));
}

export function formatearFecha(iso: string): string {
  return format(new Date(iso), "d 'de' MMMM 'de' yyyy", { locale: es });
}

export function haceCuanto(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es });
}

export function fechaEntregaEstimada(desde: Date = new Date(), dias = 3): string {
  return format(addDays(desde, dias), "EEEE d 'de' MMMM", { locale: es });
}

export function etiquetaCategoria(categoria: string): string {
  const texto = categoria.replace(/-/g, ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function claveMes(iso: string): string {
  return format(new Date(iso), 'yyyy-MM');
}
