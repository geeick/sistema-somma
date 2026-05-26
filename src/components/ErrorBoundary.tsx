import React, { Component, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { logError, generateErrorCode } from '@/lib/errorLogger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorCode: string | null;
  errorMessage: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorCode: null,
      errorMessage: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    const errorCode = generateErrorCode();
    return {
      hasError: true,
      errorCode,
      errorMessage: error.message,
    };
  }

  async componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorCode = this.state.errorCode || generateErrorCode();
    
    await logError({
      error_code: errorCode,
      error_message: error.message,
      error_stack: error.stack,
      severity: 'critical',
      metadata: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      errorCode: null,
      errorMessage: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-lg w-full">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <div>
                  <CardTitle className="text-2xl">Algo deu errado</CardTitle>
                  <CardDescription>
                    Ocorreu um erro inesperado. Nossa equipe foi notificada.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-semibold text-muted-foreground mb-1">
                  Código do erro:
                </p>
                <p className="font-mono text-lg">{this.state.errorCode}</p>
              </div>
              
              {this.state.errorMessage && (
                <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20">
                  <p className="text-sm text-destructive">
                    {this.state.errorMessage}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={this.handleReset} className="flex-1">
                  Tentar novamente
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = '/'}
                  className="flex-1"
                >
                  Ir para início
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Se o problema persistir, entre em contato com o suporte 
                informando o código do erro acima.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
