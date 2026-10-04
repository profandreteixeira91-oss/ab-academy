import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import PwaLaunchGate from './components/PwaLaunchGate'
import './styles/global.css'

if (import.meta.env.DEV) {
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.getRegistrations().then((registrations) =>
      Promise.all(registrations.map((registration) => registration.unregister())),
    ).catch((error: unknown) => {
      console.error('Erro ao remover o Service Worker no ambiente de desenvolvimento:', error)
    })
  }
} else {
  const manifestLink = document.createElement('link')
  manifestLink.rel = 'manifest'
  manifestLink.href = '/manifest.webmanifest'
  document.head.append(manifestLink)

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      }).catch((error) => {
        console.error('Erro ao registrar o Service Worker:', error)
      })
    })
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PwaLaunchGate>
      <App />
    </PwaLaunchGate>
  </React.StrictMode>,
)
