import React from 'react'
import { Button } from './vendor/Button'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error?: Error; retry: () => void }>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  title?: string
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })

    console.error('ErrorBoundary caught an error:', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorInfo: {
        componentStack: errorInfo.componentStack,
      },
      timestamp: new Date().toISOString(),
    })

    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return (
          <FallbackComponent
            error={this.state.error}
            retry={this.handleRetry}
          />
        )
      }

      return (
        <div className="p-8 text-center">
          <div className="max-w-md space-y-4 mx-auto">
            <h2 className="text-xl font-semibold text-page dark:text-text">
              {this.props.title || 'Something went wrong'}
            </h2>
            <p className="text-muted dark:text-text-2">
              An unexpected error occurred.
            </p>
            <Button onClick={this.handleRetry} color="zinc">
              Try again
            </Button>
            {this.state.error && (
              <div className="text-left bg-text dark:bg-raised p-3 rounded text-sm">
                <div className="font-medium mb-2">Error details</div>
                <div className="text-raised dark:text-text-2">
                  <div>
                    <strong>Type:</strong> {this.state.error.name}
                  </div>
                  <div>
                    <strong>Message:</strong> {this.state.error.message}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
