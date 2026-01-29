import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Save error details for dev inspection
    console.error('Unhandled UI error:', error, info)
    this.setState({ error, info })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-red-600 mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-600 mb-4">The UI encountered an unexpected error. Please reload the page or contact support if the problem persists.</p>
            <details className="text-xs text-gray-500 whitespace-pre-wrap">
              <summary className="cursor-pointer">Show error details</summary>
              <div className="mt-3">
                {this.state.error && this.state.error.toString()}
                {this.state.info && this.state.info.componentStack}
              </div>
            </details>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
