import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'An unexpected error occurred.';
      let isFirestoreError = false;

      try {
        // Check if error message is a JSON string from handleFirestoreError
        const parsed = JSON.parse(this.state.error?.message || '');
        if (parsed.error && parsed.operationType) {
          errorMessage = `Firestore Error: ${parsed.error} during ${parsed.operationType} on ${parsed.path}`;
          isFirestoreError = true;
        }
      } catch (e) {
        // Not a JSON error message
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#0F0F0F] border border-red-500/20 rounded-2xl p-8 text-center shadow-2xl shadow-red-500/10">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">System Failure</h2>
            <p className="text-white/60 text-sm mb-6 leading-relaxed">
              {errorMessage}
            </p>
            {isFirestoreError && (
              <p className="text-[10px] text-white/20 uppercase tracking-widest mb-6">
                Please check your permissions or network connection.
              </p>
            )}
            <button
              onClick={this.handleReset}
              className="flex items-center justify-center gap-2 w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3 rounded-xl transition-all"
            >
              <RefreshCcw className="w-4 h-4" />
              <span>Reboot System</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
