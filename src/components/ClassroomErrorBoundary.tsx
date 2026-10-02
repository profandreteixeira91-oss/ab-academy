import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import logo from '../assets/logo_abacademy.png'

type Props = {
  children: ReactNode
  portalPath?: string
}

type State = {
  hasError: boolean
  error: Error | null
  retryKey: number
}

export default class ClassroomErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    retryKey: 0,
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Classroom] Render error', {
      error,
      componentStack: errorInfo.componentStack,
    })
  }

  handleRetry = () => {
    this.setState((previous) => ({
      hasError: false,
      error: null,
      retryKey: previous.retryKey + 1,
    }))
  }

  handlePortal = () => {
    window.location.href = this.props.portalPath || '/aluno'
  }

  render() {
    if (!this.state.hasError) {
      return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>
    }

    const technicalMessage =
      import.meta.env.DEV && this.state.error
        ? this.state.error.message
        : null

    return (
      <div
        className="virtual-classroom-error-page"
        role="alert"
        aria-live="assertive"
      >
        <div className="virtual-classroom-error-card">
          <img
            src={logo}
            alt="AB Academy"
            className="virtual-classroom-logo"
          />

          <h1>Não foi possível carregar a sala de aula.</h1>

          <p>
            Ocorreu um erro inesperado ao iniciar a aula. Você pode tentar
            novamente ou voltar ao portal.
          </p>

          {technicalMessage && (
            <pre
              style={{
                maxWidth: '100%',
                overflow: 'auto',
                margin: '16px 0',
                padding: '12px',
                borderRadius: '10px',
                background: '#f3f4f6',
                color: '#475569',
                fontSize: '12px',
                textAlign: 'left',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {technicalMessage}
            </pre>
          )}

          <div
            style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              className="virtual-classroom-enter-button"
              onClick={this.handleRetry}
            >
              Tentar novamente
            </button>

            <button
              type="button"
              className="virtual-classroom-back-button"
              onClick={this.handlePortal}
            >
              Voltar ao portal
            </button>
          </div>
        </div>
      </div>
    )
  }
}
