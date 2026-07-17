import { Component } from 'react'

export default class CanvasErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { crashed: false }
  }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  render() {
    if (this.state.crashed) {
      return (
        <div className="flex h-full w-full items-center justify-center rounded-[24px] bg-background">
          <div className="text-center">
            <p className="text-sm font-medium text-text-primary">Canvas encountered an error</p>
            <button
              type="button"
              className="mt-3 text-xs text-text-muted underline hover:text-text-primary"
              onClick={() => this.setState({ crashed: false })}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
