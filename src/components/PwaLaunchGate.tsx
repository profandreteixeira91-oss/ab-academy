import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import logo from '../assets/logo_abacademy.png'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export default function PwaLaunchGate({
  children,
}: {
  children: ReactNode
}) {
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === 'undefined') return false
    const isAluno = window.location.pathname.startsWith('/aluno')
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    return isAluno && isStandalone
  })
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [showInstall, setShowInstall] = useState(false)

  useEffect(() => {
    if (!window.location.pathname.startsWith('/aluno')) {
      return
    }

    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true

    const timer = isStandalone
      ? window.setTimeout(() => setShowSplash(false), 1400)
      : undefined

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      const promptEvent = event as BeforeInstallPromptEvent
      setInstallPrompt(promptEvent)

      if (localStorage.getItem('ab-academy-pwa-install-dismissed') !== '1') {
        window.setTimeout(() => setShowInstall(true), 500)
      }
    }

    window.addEventListener(
      'beforeinstallprompt',
      handleBeforeInstallPrompt,
    )

    return () => {
      if (timer) window.clearTimeout(timer)
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      )
    }
  }, [])

  async function handleInstall() {
    if (!installPrompt) {
      return
    }

    await installPrompt.prompt()
    const choice = await installPrompt.userChoice

    if (choice.outcome === 'accepted') {
      setShowInstall(false)
    }

    setInstallPrompt(null)
  }

  function dismissInstall() {
    localStorage.setItem('ab-academy-pwa-install-dismissed', '1')
    setShowInstall(false)
  }

  return (
    <>
      {children}

      {showInstall && installPrompt && !showSplash && (
        <div
          style={{
            position: 'fixed',
            left: 16,
            right: 16,
            bottom: 'calc(16px + env(safe-area-inset-bottom))',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            borderRadius: 16,
            background: '#ffffff',
            border: '1px solid #e5eaf1',
            boxShadow: '0 14px 35px rgba(15,23,42,.16)',
            fontFamily: 'inherit',
          }}
        >
          <img
            src={logo}
            alt="AB Academy"
            style={{
              width: 46,
              height: 46,
              objectFit: 'contain',
              flex: '0 0 46px',
            }}
          />

          <div style={{ minWidth: 0, flex: 1 }}>
            <strong
              style={{
                display: 'block',
                color: '#172033',
                fontSize: 14,
                marginBottom: 3,
              }}
            >
              Instale o app AB Academy
            </strong>

            <span
              style={{
                display: 'block',
                color: '#64748b',
                fontSize: 11,
                lineHeight: 1.4,
              }}
            >
              Acesse o Portal do Aluno rapidamente pela tela inicial.
            </span>
          </div>

          <button
            type="button"
            onClick={() => void handleInstall()}
            style={{
              minHeight: 38,
              padding: '0 13px',
              border: 0,
              borderRadius: 9,
              background: '#1649a0',
              color: '#fff',
              fontWeight: 700,
              fontSize: 11,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Instalar
          </button>

          <button
            type="button"
            onClick={dismissInstall}
            aria-label="Fechar"
            style={{
              width: 28,
              height: 28,
              padding: 0,
              border: 0,
              background: 'transparent',
              color: '#94a3b8',
              fontSize: 18,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      )}

      {showSplash && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            background: '#ffffff',
            color: '#1649a0',
            fontFamily: 'inherit',
          }}
        >
          <div
            style={{
              width: 132,
              height: 132,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 0,
              background: '#ffffff',
              marginBottom: 24,
            }}
          >
            <img
              src={logo}
              alt="AB Academy"
              style={{
                width: 82,
                height: 82,
                objectFit: 'contain',
              }}
            />
          </div>

          <strong
            style={{
              fontSize: 18,
              letterSpacing: '.08em',
              marginBottom: 6,
            }}
          >
            PORTAL DO ALUNO
          </strong>

          <span
            style={{
              color: '#64748b',
              fontSize: 11,
              letterSpacing: '.12em',
            }}
          >
            AB ACADEMY
          </span>
        </div>
      )}
    </>
  )
}
