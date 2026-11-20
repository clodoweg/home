/**
 * WidgetErrorBoundary — React error boundary that isolates widget crashes.
 * Catches rendering errors in child widgets and displays an inline error card
 * so a single broken widget cannot bring down the entire dashboard.
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card } from './Card';
import { logger } from '../../lib/logger';

interface Props {
  children: ReactNode;
  widgetName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error(`WidgetError [${this.props.widgetName || 'Unknown'}]:`, error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div>
        <Card innerClassName="p-5">
          <div className="flex flex-row items-center gap-3">
            <div className="rounded-full bg-destructive p-3 text-destructive-foreground">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                Erreur: {this.props.widgetName || 'Widget'}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-destructive opacity-80">
                {this.state.error?.message || 'Impossible de charger ce composant.'}
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }
}
