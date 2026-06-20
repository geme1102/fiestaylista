import { Component, type ErrorInfo, type ReactNode, createRef } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function generateErrorId(): string {
  return crypto.randomUUID?.() ?? `ERR_${Date.now().toString(36).toUpperCase()}`;
}

export default class ErrorBoundary extends Component<Props, State> {
  private panelRef = createRef<HTMLDivElement>();

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
    if (import.meta.env.DEV) console.error('[ErrorBoundary]', JSON.stringify(errorReport));
    try {
      if (typeof (window as unknown as Record<string, unknown>).reportError === 'function') {
        (window as unknown as Record<string, (data: unknown) => void>).reportError(errorReport);
      }
    } catch {} // eslint-disable-line no-empty
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (prevState.hasError !== this.state.hasError) {
      if (this.state.hasError) {
        this.addParallax();
      } else {
        this.removeParallax();
      }
    }
  }

  componentWillUnmount() {
    this.removeParallax();
  }

  private handleMouseMove = (e: MouseEvent) => {
    const panel = this.panelRef.current;
    if (!panel) return;
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    const intensity = 10;
    const floatX = (x - 0.5) * intensity;
    const floatY = (y - 0.5) * intensity;
    panel.style.transform = `translate3d(${floatX}px, ${floatY}px, 0) rotate3d(${-floatY}, ${floatX}, 0, 5deg)`;
  };

  private addParallax() {
    document.addEventListener('mousemove', this.handleMouseMove);
  }

  private removeParallax() {
    document.removeEventListener('mousemove', this.handleMouseMove);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const errorId = generateErrorId();
      return (
        <main
          className="relative min-h-screen w-full flex items-center justify-center p-container-margin overflow-hidden bg-surface"
        >
          <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-secondary-container/5 rounded-full blur-[120px]" />
          <div className="relative z-10 w-full max-w-lg text-center space-y-8">
            <div className="flex justify-center">
              <div
                ref={this.panelRef}
                className="w-32 h-32 md:w-40 md:h-40 rounded-[2rem] flex items-center justify-center text-6xl md:text-7xl shadow-xl transition-all duration-500 hover:rotate-3"
                style={{
                  background: 'rgba(250, 249, 248, 0.4)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(250, 249, 248, 0.3)',
                  boxShadow: '0 0 40px rgba(177, 14, 107, 0.15)',
                  animation: 'float 6s ease-in-out infinite',
                }}
              >
                <span aria-label="Rostro confundido" role="img">😕</span>
              </div>
            </div>
            <div className="space-y-4 px-4">
              <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface tracking-tight">
                Algo salió mal
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-md mx-auto leading-relaxed">
                Lo sentimos, ha ocurrido un error inesperado. Por favor, intenta recargar la página para continuar celebrando.
              </p>
            </div>
            <div className="flex flex-col items-center gap-6 pt-4">
              <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={this.handleRetry}
                  className="inline-flex items-center justify-center gap-2 px-10 py-4 rounded-full font-label-md text-label-md text-on-primary active:scale-95 transition-all duration-200"
                  style={{
                    background: 'linear-gradient(135deg, #b10e6b 0%, #d23284 100%)',
                    boxShadow: '0 8px 20px rgba(177,14,107,0.3)',
                  }}
                >
                  Intentar de nuevo
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center justify-center gap-2 px-10 py-4 rounded-full font-label-md text-label-md border border-outline-variant text-on-surface active:scale-95 transition-all duration-200 group bg-surface/70 backdrop-blur-sm"
                >
                  <span className="material-symbols-outlined text-xl group-hover:rotate-180 transition-transform duration-500">refresh</span>
                  Recargar página
                </button>
              </div>
              <a href="/" className="font-label-md text-label-md text-primary hover:text-primary-container transition-colors duration-200 border-b border-transparent hover:border-primary pb-1 mt-2">
                Volver al inicio
              </a>
            </div>
            <div className="pt-12 opacity-30">
              <p className="font-caption text-caption uppercase tracking-widest text-on-surface-variant">
                Error ID: {errorId}
              </p>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
