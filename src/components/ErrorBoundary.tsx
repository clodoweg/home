/**
 * ErrorBoundary — Top-level crash screen for the web app.
 * Catches any uncaught React render error and shows the stack in a scrollable panel.
 */
import React, { Component, ErrorInfo } from 'react';
import { logger } from '../lib/logger';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    logger.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex h-screen flex-col bg-[#1a0000] p-5 pt-16 text-[#cccccc]">
        <h1 className="mb-2 text-2xl font-bold text-[#ff4444]">💥 App Crash</h1>
        <p className="mb-5 text-base text-[#ffaaaa]">
          {this.state.error?.message || 'Unknown error'}
        </p>
        <div className="flex-1 overflow-auto rounded-lg bg-black p-3 font-mono text-xs">
          <pre className="whitespace-pre-wrap">{this.state.error?.stack || 'No stack trace'}</pre>
          {this.state.errorInfo?.componentStack && (
            <pre className="mt-4 whitespace-pre-wrap">
              {'--- Component Stack ---\n'}
              {this.state.errorInfo.componentStack}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
