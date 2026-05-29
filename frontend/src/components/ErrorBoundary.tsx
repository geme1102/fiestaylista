import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const errorReport = {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };
    console.error('[ErrorBoundary]', JSON.stringify(errorReport));
    if (typeof (window as any).reportError === 'function') {
      (window as any).reportError(errorReport);
    }
  }

  render() {
    if (this.state.hasError) {
      const errorId = `ERR_${Date.now().toString(36).toUpperCase()}`;
      return (
        <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-pink-100 via-white to-white dark:from-gray-800 dark:via-gray-900 dark:to-gray-900 px-4 relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl animate-float" />
            <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-fuchsia-500/5 rounded-full blur-3xl animate-float-slow" />
          </div>
          <div className="text-center max-w-md glass p-10 rounded-2xl relative z-10" style={{ transform: 'perspective(1000px)' }}>
            <div className="text-6xl mb-4 animate-float">😕</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Algo salió mal</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Ocurrió un error inesperado. Recarga la página para intentar de nuevo.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-rose-500/25 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">refresh</span>
              Recargar página
            </button>
            <p className="mt-6 text-xs text-gray-400 font-mono">ID: {errorId}</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
