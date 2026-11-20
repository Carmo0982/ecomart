import moment from 'moment';
import 'moment/locale/es';
import _ from 'lodash';

moment.locale('es');

export function formatearPrecio(valor: number): string {
  return '$' + _.round(valor, 0).toLocaleString('es-CO');
}

export function formatearFecha(iso: string): string {
  return moment(iso).format('LL');
}

export function haceCuanto(iso: string): string {
  return moment(iso).fromNow();
}

export function fechaEntregaEstimada(desde: Date = new Date(), dias = 3): string {
  return moment(desde).add(dias, 'days').format('dddd D [de] MMMM');
}

export function etiquetaCategoria(categoria: string): string {
  return _.capitalize(_.replace(categoria, '-', ' '));
}
