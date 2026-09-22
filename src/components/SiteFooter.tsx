import '../styles/site-footer.css'
import logo from '../assets/logo_abacademy.png'

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-container">
        <div className="site-footer-brand">
          <a href="/" className="site-footer-logo">
            <img src={logo} alt="AB Academy" />
          </a>
          <p>Inglês e alemão para transformar conhecimento em novas oportunidades.</p>
        </div>

        <div className="site-footer-links">
          <a href="/">Início</a>
          <a href="/matricula">Matrícula</a>
          <a href="/aluno">Área do aluno</a>
          <a href="/professor">Portal do professor</a>
        </div>
      </div>

      <div className="site-footer-bottom">
        <span>AB Academy® 2026 todos os direitos reservados</span>
        <span>
          Desenvolvido por{' '}
          <a href="https://www.amtsistemas.com.br/">AMT Sistemas &amp; Soluções</a>{'  - '}<a href="https://www.amtsistemas.com.br/">www.amtsistemas.com.br</a>
        </span>
        <div className="site-footer-legal">
          <a href="/termos-de-servico">Termos de Serviço</a>
          <a href="/politica-privacidade">Política de Privacidade</a>
        </div>
      </div>
    </footer>
  )
}
