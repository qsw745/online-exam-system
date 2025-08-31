// src/components/ErrorBoundary.tsx
import React from 'react'
import ServerError500 from '../pages/errors/ServerError500'

export class ErrorBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(err: any) {
    console.error('UI Error:', err)
  }
  render() {
    return this.state.hasError ? <ServerError500 /> : this.props.children
  }
}
