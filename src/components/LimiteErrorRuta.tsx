import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

/**
 * Con code splitting cada ruta se descarga al visitarla. Si el chunk falla
 * (sin red, o un despliegue nuevo borró el archivo con hash anterior),
 * React.lazy lanza un error: aquí se captura y se ofrece recargar en vez de
 * dejar la pantalla en blanco.
 */
export class LimiteErrorRuta extends Component<Props, { fallo: boolean }> {
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  render() {
    if (!this.state.fallo) return this.props.children;
    return (
      <div role="alert">
        <p>No pudimos cargar esta sección.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Reintentar
        </button>
      </div>
    );
  }
}
