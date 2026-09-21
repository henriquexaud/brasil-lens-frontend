import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary capturou uma exceção:', error, errorInfo);
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.state.error ? this.props.fallback(this.state.error, this.reset) : null;
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="panel-section notice notice-error" role="alert">
          <p>
            <strong>Não foi possível exibir estas informações.</strong>
          </p>
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
            <button
              className="drill-button"
              style={{ padding: '0.35rem 0.75rem' }}
              onClick={this.reset}
            >
              Tentar novamente
            </button>
            {this.props.onReset && (
              <button
                className="icon-button"
                onClick={this.props.onReset}
                aria-label="Fechar painel"
                title="Fechar"
              >
                ×
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
