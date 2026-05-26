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
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-pink-50 via-white to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 px-4">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">😕</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Algo salió mal</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Ocurrió un error inesperado. Recarga la página para intentar de nuevo.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
