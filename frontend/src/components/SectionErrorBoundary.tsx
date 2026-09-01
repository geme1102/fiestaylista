import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../lib/reportError';

interface Props {
  children: ReactNode;
  sectionName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    reportError(error, { componentStack: errorInfo.componentStack, sectionName: this.props.sectionName });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="w-full rounded-2xl border border-outline-variant/30 bg-surface/60 backdrop-blur-sm p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
              style={{
                background: 'rgba(250, 249, 248, 0.4)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(250, 249, 248, 0.3)',
              }}
            >
              <span aria-label="Alerta" role="img">😕</span>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="font-headline-md text-headline-md text-on-surface tracking-tight">
              Algo salió mal en esta sección
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-sm mx-auto leading-relaxed">
              Ocurrió un error inesperado. Puedes intentar recuperar esta sección o recargar la página.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 pt-2">
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleRetry}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-label-md text-label-md text-on-primary active:scale-95 transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, #b10e6b 0%, #d23284 100%)',
                  boxShadow: '0 8px 20px rgba(177,14,107,0.3)',
                }}
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-label-md text-label-md border border-outline-variant text-on-surface active:scale-95 transition-all duration-200 bg-surface/70 backdrop-blur-sm"
              >
                Recargar página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
