import { ArrowLeft, Home as HomeIcon, SearchX } from 'lucide-react'
import logo from '../assets/logo_abacademy.png'
import '../styles/error404.css'

export default function Error404() {
  return (
    <main className="error404-page">
      <div className="error404-glow error404-glow-one" />
      <div className="error404-glow error404-glow-two" />

      <section className="error404-card" aria-labelledby="error404-title">
        <a href="/" className="error404-logo" aria-label="AB Academy - Início">
          <img src={logo} alt="AB Academy Idiomas" />
        </a>

        <div className="error404-icon" aria-hidden="true">
          <SearchX size={34} strokeWidth={1.8} />
        </div>

        <p className="error404-code">404</p>

        <h1 id="error404-title">Página não encontrada</h1>

        <p className="error404-description">
          A página que você tentou acessar não existe ou pode ter sido movida.
          Vamos levar você de volta para um lugar seguro.
        </p>

        <div className="error404-actions">
          <a href="/" className="error404-primary">
            <HomeIcon size={18} />
            Ir para o início
          </a>

          <button
            type="button"
            className="error404-secondary"
            onClick={() => window.history.back()}
          >
            <ArrowLeft size={18} />
            Voltar
          </button>
        </div>

        <p className="error404-help">
          AB Academy Idiomas · Inglês e alemão para transformar conhecimento em novas oportunidades.
        </p>
      </section>
    </main>
  )
}
