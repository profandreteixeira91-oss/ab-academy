import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Globe2,
  GraduationCap,
  Languages,
  Laptop,
  Link,
  Users,
} from 'lucide-react'

import '../styles/home.css'
import logo from '../assets/logo_abacademy.png'
import usaFlag from '../assets/flag-usa.svg'
import germanyFlag from '../assets/flag-germany.svg'

function Home() {
  return (
    <div className="home">
      {/* HEADER */}
      <header className="header">
        <div className="container header-container">
          <a href="#inicio" className="logo">
            <img src={logo} alt="AB Academy" />
          </a>

          <nav className="navigation">
            <a href="#inicio">Início</a>
            <a href="#sobre">Sobre</a>
            <a href="#cursos">Cursos</a>
            <a href="#metodologia">Metodologia</a>
            <a href="#contato">Contato</a>
          </nav>

        <div className="header-actions">
        <a href="/matricula" className="btn btn-primary header-button">
            Matricule-se
            </a>
          <a href="/aluno" className="btn btn-primary header-button">
            Área do aluno
          </a>
        </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="hero" id="inicio">
          <div className="container hero-container">
            <div className="hero-content">
              <div className="section-label">
                <Languages size={16} />
                Inglês e Alemão
              </div>

              <h1>
                Aprenda um novo idioma.
                <br />
                <span>Amplie seus horizontes.</span>
              </h1>

              <p>
                Desenvolva suas habilidades em inglês ou alemão com
                uma metodologia prática, acompanhamento especializado
                e uma plataforma completa para acompanhar sua evolução.
              </p>

              <div className="hero-actions">
                <a href="#cursos" className="btn btn-primary">
                  Conheça nossos cursos
                  <ArrowRight size={18} />
                </a>

                <a href="#sobre" className="btn btn-outline">
                  Conheça a AB Academy
                </a>
              </div>

              <div className="hero-benefits">
                <div>
                  <CheckCircle2 size={18} />
                  <span>Inglês e Alemão</span>
                </div>

                <div>
                  <CheckCircle2 size={18} />
                  <span>Metodologia prática</span>
                </div>

                <div>
                  <CheckCircle2 size={18} />
                  <span>Área exclusiva do aluno</span>
                </div>
              </div>
            </div>

            {/* HERO VISUAL */}
            <div className="hero-visual">
              <div className="hero-card">
                <div className="hero-card-brand">
                  <img src={logo} alt="AB Academy" />
                </div>

                <div className="hero-card-heading">
                  <span>ESCOLHA SEU IDIOMA</span>

                  <h2>
                    Aprenda.
                    <br />
                    Evolua.
                  </h2>

                  <p>
                    Desenvolva novas habilidades e prepare-se
                    para novas oportunidades.
                  </p>
                </div>

                <div className="language-options">
                  <a href="#contato" className="language-option">
                    <div className="language-flag">
                      🇺🇸
                    </div>

                    <div className="language-info">
                      <strong>Inglês</strong>
                      <span>English</span>
                    </div>

                    <ArrowRight size={19} />
                  </a>

                  <a href="#contato" className="language-option">
                    <div className="language-flag">
                      🇩🇪
                    </div>

                    <div className="language-info">
                      <strong>Alemão</strong>
                      <span>Deutsch</span>
                    </div>

                    <ArrowRight size={19} />
                  </a>
                </div>

                <div className="hero-card-footer">
                  <div>
                    <strong>100%</strong>
                    <span>Online</span>
                  </div>

                  <div>
                    <strong>2 </strong>
                    <span>Idiomas</span>
                  </div>

                  <div>
                    <strong>Aprenda do seu jeito </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

       {/* SOBRE */}
<section className="section about-section" id="sobre">
  <div className="container">
    <div className="about-grid">
      <div className="about-content">
        <div className="section-label">
          Sobre a AB Academy
        </div>

        <h2 className="section-title">
          Aprender um idioma é abrir novas possibilidades.
        </h2>

        <p className="section-description">
          A AB Academy nasceu com o propósito de tornar o
          aprendizado de idiomas mais acessível, prático e
          conectado aos objetivos de cada aluno.
        </p>

        <p className="about-text">
          Oferecemos cursos de inglês e alemão para diferentes
          níveis e objetivos, combinando uma metodologia
          estruturada com prática de comunicação e
          acompanhamento da evolução.
        </p>

        <a href="#cursos" className="btn btn-primary">
          Conheça nossos cursos
          <ArrowRight size={18} />
        </a>
      </div>

      <div className="about-highlight">
        <div className="about-highlight-logo">
        </div>

        <div className="about-highlight-content">
          <span>NOSSA MISSÃO</span>

          <strong>
            Conhecimento que
            <br />
            conecta pessoas.
          </strong>

          <p>
            Inglês e alemão para estudos, carreira,
            viagens e novas oportunidades.
          </p>
        </div>

        <div className="about-stats">
          <div>
            <strong>02</strong>
            <span>Idiomas</span>
          </div>

          <div>
            <strong>01</strong>
            <span>Plataforma</span>
          </div>

          <div>
            <strong>∞</strong>
            <span>Possibilidades</span>
          </div>
        </div>
      </div>
    </div>

    <div className="features-grid about-features">
      <article className="feature-card">
        <div className="feature-icon">
          <Languages size={26} />
        </div>

        <h3>Inglês e Alemão</h3>

        <p>
          Desenvolva suas habilidades em dois dos principais
          idiomas para comunicação, estudos e carreira.
        </p>
      </article>

      <article className="feature-card">
        <div className="feature-icon">
          <Users size={26} />
        </div>

        <h3>Acompanhamento</h3>

        <p>
          Tenha orientação durante sua jornada e acompanhe
          seu desenvolvimento ao longo do curso.
        </p>
      </article>

      <article className="feature-card">
        <div className="feature-icon">
          <Laptop size={26} />
        </div>

        <h3>Experiência digital</h3>

        <p>
          Acesse conteúdos, atividades e informações da sua
          jornada através da plataforma da AB Academy.
        </p>
      </article>
    </div>
  </div>
</section>

        {/* CURSOS */}
<section className="section courses-section" id="cursos">
  <div className="container">
    <div className="section-header">
      <div className="section-label">
        Nossos cursos
      </div>

      <h2 className="section-title">
        Aprenda no seu ritmo. Evolua com propósito.
      </h2>

      <p className="section-description">
        Escolha o curso que mais combina com seus objetivos
        e comece a construir novas possibilidades através
        de um novo idioma.
      </p>
    </div>

    <div className="courses-grid">
      {/* INGLÊS */}
      <article className="course-card">
        <div className="course-card-top">
          <span className="course-number">01</span>

          <div className="course-icon course-flag">
            <img src={usaFlag} alt="Bandeira dos Estados Unidos" />
            </div>

          <span className="course-tag">
            Inglês
          </span>
        </div>

        <h3>Curso de Inglês</h3>

        <p>
          Desenvolva sua comunicação em inglês para situações
          do dia a dia, estudos, viagens e oportunidades
          profissionais.
        </p>

        <div className="course-target">
          <span>Ideal para</span>
          <strong>
            Quem quer se comunicar com mais confiança.
          </strong>
        </div>

        <ul>
          <li>
            <CheckCircle2 size={17} />
            Inglês geral
          </li>

          <li>
            <CheckCircle2 size={17} />
            Comunicação
          </li>

          <li>
            <CheckCircle2 size={17} />
            Inglês para carreira
          </li>

          <li>
            <CheckCircle2 size={17} />
            Desenvolvimento contínuo
          </li>
        </ul>

        <a href="#contato">
          Quero saber mais
          <ArrowRight size={17} />
        </a>
      </article>

      {/* ALEMÃO */}
      <article className="course-card course-card-featured">
        <div className="course-card-top">
          <span className="course-number">02</span>

        <div className="course-icon course-flag">
        <img src={germanyFlag} alt="Bandeira da Alemanha" />
        </div>

          <span className="course-tag">
            Alemão
          </span>
        </div>

        <h3>Curso de Alemão</h3>

        <p>
          Aprenda alemão de forma estruturada e desenvolva
          habilidades para estudos, carreira, viagens e
          comunicação.
        </p>

        <div className="course-target">
          <span>Ideal para</span>
          <strong>
            Quem busca novas oportunidades com o alemão.
          </strong>
        </div>

        <ul>
          <li>
            <CheckCircle2 size={17} />
            Alemão geral
          </li>

          <li>
            <CheckCircle2 size={17} />
            Comunicação
          </li>

          <li>
            <CheckCircle2 size={17} />
            Alemão para carreira
          </li>

          <li>
            <CheckCircle2 size={17} />
            Desenvolvimento contínuo
          </li>
        </ul>

        <a href="#contato">
          Quero saber mais
          <ArrowRight size={17} />
        </a>
      </article>

      {/* PERSONALIZADO */}
      <article className="course-card">
        <div className="course-card-top">
          <span className="course-number">03</span>

          <div className="course-icon">
            <Globe2 size={30} />
          </div>

          <span className="course-tag">
            Personalizado
          </span>
        </div>

        <h3>Curso Personalizado</h3>

        <p>
          Um percurso de aprendizagem planejado de acordo
          com seus objetivos, necessidades, disponibilidade
          e nível atual.
        </p>

        <div className="course-target">
          <span>Ideal para</span>
          <strong>
            Quem precisa de uma jornada de aprendizagem específica.
          </strong>
        </div>

        <ul>
          <li>
            <CheckCircle2 size={17} />
            Objetivos específicos
          </li>

          <li>
            <CheckCircle2 size={17} />
            Conteúdo personalizado
          </li>

          <li>
            <CheckCircle2 size={17} />
            Acompanhamento individual
          </li>

          <li>
            <CheckCircle2 size={17} />
            Flexibilidade
          </li>
        </ul>

        <a href="#contato">
          Saiba mais
          <ArrowRight size={17} />
        </a>
      </article>
    </div>
  </div>
</section>

        {/* METODOLOGIA */}
        <section
          className="section methodology-section"
          id="metodologia"
        >
          <div className="container">
            <div className="methodology-header">
              <div>
                <div className="section-label">
                  Nossa metodologia
                </div>

                <h2 className="section-title">
                  Aprender um idioma precisa fazer sentido.
                </h2>
              </div>

              <p className="section-description">
                Na AB Academy, o aprendizado combina conteúdo
                estruturado, prática e acompanhamento para que você
                consiga transformar conhecimento em comunicação.
              </p>
            </div>

            <div className="methodology-grid">
              <div className="methodology-steps">
                <article className="methodology-step">
                  <span className="methodology-step-number">01</span>

                  <div className="methodology-step-icon">
                    <BookOpen size={23} />
                  </div>

                  <div>
                    <h3>Aprenda</h3>

                    <p>
                      Tenha contato com conteúdos organizados de acordo
                      com seu nível e objetivos.
                    </p>
                  </div>
                </article>

                <article className="methodology-step">
                  <span className="methodology-step-number">02</span>

                  <div className="methodology-step-icon">
                    <Languages size={23} />
                  </div>

                  <div>
                    <h3>Pratique</h3>

                    <p>
                      Desenvolva suas habilidades através da prática
                      e da comunicação em situações reais.
                    </p>
                  </div>
                </article>

                <article className="methodology-step">
                  <span className="methodology-step-number">03</span>

                  <div className="methodology-step-icon">
                    <CheckCircle2 size={23} />
                  </div>

                  <div>
                    <h3>Evolua</h3>

                    <p>
                      Acompanhe seu desenvolvimento e identifique os
                      pontos que precisam de mais atenção.
                    </p>
                  </div>
                </article>

                <article className="methodology-step">
                  <span className="methodology-step-number">04</span>

                  <div className="methodology-step-icon">
                    <GraduationCap size={23} />
                  </div>

                  <div>
                    <h3>Conquiste</h3>

                    <p>
                      Use o conhecimento adquirido para alcançar novos
                      objetivos pessoais, acadêmicos e profissionais.
                    </p>
                  </div>
                </article>
              </div>

              <div className="methodology-visual">
                <div className="methodology-visual-top">
                  <span>AB ACADEMY</span>

                  <div className="methodology-progress">
                    <div className="methodology-progress-bar" />
                  </div>
                </div>

                <div className="methodology-visual-main">
                  <span className="methodology-visual-label">
                    SUA JORNADA
                  </span>

                  <strong>
                    Do primeiro contato
                    <br />
                    à confiança.
                  </strong>

                  <p>
                    Um processo de aprendizagem pensado para que cada
                    etapa tenha propósito e gere evolução.
                  </p>
                </div>

                <div className="methodology-visual-footer">
                  <div>
                    <span>01</span>
                    <strong>Aprenda</strong>
                  </div>

                  <div>
                    <span>02</span>
                    <strong>Pratique</strong>
                  </div>

                  <div>
                    <span>03</span>
                    <strong>Evolua</strong>
                  </div>

                  <div>
                    <span>04</span>
                    <strong>Conquiste</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ÁREA DO ALUNO */}
        <section className="section platform-section" id="area-aluno">
          <div className="container">
            <div className="platform-grid">
              <div className="platform-content">
                <div className="section-label">
                  Área exclusiva do aluno
                </div>

                <h2 className="section-title">
                  Sua jornada de aprendizagem em um só lugar.
                </h2>

                <p className="section-description">
                  Tenha acesso aos conteúdos, acompanhe seu progresso
                  e organize sua rotina de estudos através da
                  plataforma da AB Academy.
                </p>

                <div className="platform-features">
                  <div>
                    <BookOpen size={21} />
                    <span>Conteúdos e aulas</span>
                  </div>

                  <div>
                    <GraduationCap size={21} />
                    <span>Acompanhamento do progresso</span>
                  </div>

                  <div>
                    <Laptop size={21} />
                    <span>Materiais complementares</span>
                  </div>

                  <div>
                    <CheckCircle2 size={21} />
                    <span>Atividades e avaliações</span>
                  </div>
                </div>

                <a href="#" className="btn btn-primary">
                  Acessar área do aluno
                  <ArrowRight size={18} />
                </a>
              </div>

              <div className="platform-visual">
                <div className="platform-window">
                  <div className="platform-window-header">
                    <div className="platform-dots">
                      <span />
                      <span />
                      <span />
                    </div>

                    <span>AB ACADEMY</span>
                  </div>

                  <div className="platform-dashboard">
                    <div className="platform-welcome">
                      <span>ÁREA DO ALUNO</span>

                      <strong>
                        Continue sua jornada.
                      </strong>

                      <p>
                        Acompanhe seu desenvolvimento e mantenha
                        seus estudos em movimento.
                      </p>
                    </div>

                    <div className="platform-progress-card">
                      <div>
                        <span>Seu progresso</span>
                        <strong>68%</strong>
                      </div>

                      <div className="platform-progress">
                        <div className="platform-progress-bar" />
                      </div>

                      <small>
                        Continue avançando!
                      </small>
                    </div>

                    <div className="platform-dashboard-grid">
                      <div>
                        <BookOpen size={20} />
                        <strong>Conteúdos</strong>
                        <span>Acessar aulas</span>
                      </div>

                      <div>
                        <GraduationCap size={20} />
                        <strong>Progresso</strong>
                        <span>Ver evolução</span>
                      </div>

                      <div>
                        <Laptop size={20} />
                        <strong>Materiais</strong>
                        <span>Biblioteca</span>
                      </div>

                      <div>
                        <CheckCircle2 size={20} />
                        <strong>Atividades</strong>
                        <span>Ver atividades</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* CONTATO / CTA */}
        <section className="cta-section" id="contato">
          <div className="container">
            <div className="cta-container">
              <div className="cta-content">
                <span className="cta-label">
                  Comece sua jornada
                </span>

                <h2>
                  Seu próximo idioma
                  <br />
                  começa aqui.
                </h2>

                <p>
                  Escolha seu idioma, conheça nossos cursos e dê
                  o próximo passo para ampliar suas possibilidades.
                </p>
              </div>

              <div className="cta-actions">
                <a href="#cursos" className="btn btn-secondary">
                  Conhecer os cursos
                  <ArrowRight size={18} />
                </a>

                <a href="#" className="cta-contact-link">
                  Falar com a AB Academy
                  <ArrowRight size={17} />
                </a>
              </div>
            </div>
          </div>
        </section>
        </main>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container footer-container">
          <div>
            <a href="#inicio" className="logo footer-logo">
              <img src={logo} alt="AB Academy" />
            </a>

            <p>
              Inglês e alemão para transformar conhecimento
              em novas oportunidades.
            </p>
          </div>

          <div className="footer-links">
            <a href="#inicio">Início</a>
            <a href="#sobre">Sobre</a>
            <a href="#cursos">Cursos</a>
            <a href="#metodologia">Metodologia</a>
            <a href="#contato">Contato</a><p></p><p></p>
            <a href="/politica-privacidade">Política de Privacidade</a>
            <a href="/termos-de-servico">Termos de Serviço</a>
          </div>
        </div>

        <div className="container footer-bottom">
          <span>
            © {new Date().getFullYear()} AB Academy. Todos os
            direitos reservados.<p></p>
          </span>
          <span>Desenvolvido por AMT Sistemas & Soluções - <a href="https://www.amtsistemas.com.br">www.amtsistemas.com.br</a>
          </span>
        </div>
      </footer>
    </div>
  )
}

export default Home