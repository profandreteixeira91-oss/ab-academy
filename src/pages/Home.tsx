import { useEffect, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Globe2,
  GraduationCap,
  Languages,
  Laptop,
  Menu,
  Users,
  X,
} from 'lucide-react'

import '../styles/home.css'
import logo from '../assets/logo_abacademy.png'
import usaFlag from '../assets/flag-usa.svg'
import germanyFlag from '../assets/flag-germany.svg'
import { supabase } from '../lib/supabase'

type Plano = {
  id: string
  idioma: 'ingles' | 'alemao'
  tipo: 'mensal' | 'anual'
  nome: string
  descricao: string | null
  preco: number
  parcelas: number | null
  valor_parcela: number | null
  ativo: boolean
}

function Home() {
  const [planos, setPlanos] = useState<Plano[]>([])
  const [loadingPlanos, setLoadingPlanos] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    async function loadPlanos() {
      try {
        const { data, error } = await supabase
          .from('planos')
          .select(`
            id,
            idioma,
            tipo,
            nome,
            descricao,
            preco,
            parcelas,
            valor_parcela,
            ativo
          `)
          .eq('ativo', true)
          .order('idioma')
          .order('tipo')

        if (error) {
          console.error('Erro ao carregar planos:', error)
          return
        }

        setPlanos(data ?? [])
      } catch (error) {
        console.error('Erro inesperado ao carregar planos:', error)
      } finally {
        setLoadingPlanos(false)
      }
    }

    void loadPlanos()
  }, [])

  const planosIngles = planos.filter(
    (plano) => plano.idioma === 'ingles',
  )

  const planosAlemao = planos.filter(
    (plano) => plano.idioma === 'alemao',
  )

  function formatCurrency(value: number | null) {
    if (value === null || Number.isNaN(Number(value))) {
      return 'Consulte'
    }

    return Number(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  function getPlanoValor(plano: Plano) {
    if (
      plano.tipo === 'anual' &&
      plano.valor_parcela !== null &&
      plano.valor_parcela !== undefined
    ) {
      return formatCurrency(plano.valor_parcela)
    }

    if (
      plano.tipo === 'mensal' &&
      plano.valor_parcela !== null &&
      plano.valor_parcela !== undefined
    ) {
      return formatCurrency(plano.valor_parcela)
    }

    return formatCurrency(plano.preco)
  }

  function renderPlanos(idiomaPlanos: Plano[]) {
    if (loadingPlanos) {
      return (
        <div className="course-pricing-loading">
          Carregando planos...
        </div>
      )
    }

    if (idiomaPlanos.length === 0) {
      return (
        <div className="course-pricing-empty">
          Planos disponíveis em breve.
        </div>
      )
    }

    const planosMensais = idiomaPlanos.filter(
      (plano) => plano.nome === 'Plano Mensal',
    )

    const planosAnuais = idiomaPlanos.filter(
      (plano) => plano.nome === 'Plano Anual',
    )

    return (
      <div className="course-pricing">
        {planosMensais.map((plano) => (
          <div className="course-price-option" key={plano.id}>
            <div className="course-price-option-header">
              <span>Plano Mensal</span>
              <strong>{getPlanoValor(plano)}</strong>
            </div>

            <div className="course-price-option-info">
              <span>
                {plano.descricao || 'Pagamento mensal'}
              </span>
            </div>
          </div>
        ))}

        {planosAnuais.map((plano) => (
          <div
            className="course-price-option course-price-option-featured"
            key={plano.id}
          >
            <div className="course-price-option-header">
              <span>Plano Anual</span>
              <strong>{getPlanoValor(plano)}</strong>
            </div>

            <div className="course-price-option-info">
              <span>
                {plano.parcelas && plano.parcelas > 1
                  ? `em ${plano.parcelas} parcelas`
                  : 'Pagamento anual'}
              </span>

              {plano.descricao && (
                <small>{plano.descricao}</small>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

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
            <a
              href="/matricula"
              className="btn btn-primary header-button"
            >
              Matricule-se
            </a>

            <a
              href="/aluno"
              className="btn btn-primary header-button"
            >
              Área do aluno
            </a>

            <a
              href="/professor"
              className="btn btn-outline header-button teacher-access-button"
            >
              Portal do professor
            </a>

            <button
              type="button"
              className="mobile-menu-button"
              aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          <div className={`mobile-navigation ${mobileMenuOpen ? 'open' : ''}`}>
            <a href="#inicio" onClick={() => setMobileMenuOpen(false)}>Início</a>
            <a href="#sobre" onClick={() => setMobileMenuOpen(false)}>Sobre</a>
            <a href="#cursos" onClick={() => setMobileMenuOpen(false)}>Cursos</a>
            <a href="#metodologia" onClick={() => setMobileMenuOpen(false)}>Metodologia</a>
            <a href="#contato" onClick={() => setMobileMenuOpen(false)}>Contato</a>
            <a href="/matricula" onClick={() => setMobileMenuOpen(false)}>Matricule-se</a>
            <a href="/aluno" onClick={() => setMobileMenuOpen(false)}>Área do aluno</a>
            <a href="/professor" onClick={() => setMobileMenuOpen(false)}>Portal do professor</a>
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
                    <strong>2</strong>
                    <span>Idiomas</span>
                  </div>

                  <div>
                    <strong>Aprenda do seu jeito</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SOBRE */}
        <section className="section about-section" id="sobre">
          <div className="container">
            <div className="founder-grid">
              <div className="founder-photo-wrap">
                <div className="founder-photo-placeholder" aria-label="Espaço reservado para foto de Amy Borges">
                  <span>Foto de Amy Borges</span>
                  <small>Imagem será adicionada posteriormente</small>
                </div>
              </div>

              <div className="founder-content">
                <div className="section-label">
                  Sobre a AB Academy
                </div>

                <h2 className="section-title">
                  Prazer, sou a Amy Borges.
                </h2>

                <div className="founder-text">
                  <p>
                    Sou médica veterinária por formação. Tenho mestrado e atuo na área de animais marinhos.
                  </p>

                  <p>
                    Eu me formei no ensino básico na Alemanha, em Siegen. Parte da minha formação acadêmica foi na Universidade da Flórida, nos EUA. Tive a oportunidade de lecionar aulas particulares em grandes institutos, como a Wizard, nos idiomas inglês e alemão.
                  </p>

                  <p>
                    A <strong>AB Academy</strong> começou em 2023, com um planejamento e desejo de muitos anos de trazer uma experiência de aprendizagem e colaborar no ensino e desenvolvimento do aluno, com uma metodologia prática e simples.
                  </p>

                  <p>
                    As minhas premissas para o desenvolvimento dos alunos são:
                  </p>

                  <div className="founder-principles">
                    <strong>Autonomia e Autoridade</strong>
                    <span>
                      sobre o idioma em que está aprendendo.
                    </span>
                  </div>

                  <p>
                    A metodologia da AB Academy permeia os detalhes mais cotidianos, quase invisíveis, em uma abordagem integrada à vida do aluno.
                  </p>

                  <p className="founder-closing">
                    Quero descomplicar e destravar a sua capacidade de aprender um novo idioma!
                  </p>
                </div>
              </div>
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
                    <img
                      src={usaFlag}
                      alt="Bandeira dos Estados Unidos"
                    />
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
                    Aula particular
                  </li>

                  <li>
                    <CheckCircle2 size={17} />
                    Uma aula por semana
                  </li>

                  <li>
                    <CheckCircle2 size={17} />
                    Conteúdos personalizados
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

                {renderPlanos(planosIngles)}

                <a href="/matricula">
                  Quero me matricular
                  <ArrowRight size={17} />
                </a>
              </article>

              {/* ALEMÃO */}
              <article className="course-card course-card-featured">
                <div className="course-card-top">
                  <span className="course-number">02</span>

                  <div className="course-icon course-flag">
                    <img
                      src={germanyFlag}
                      alt="Bandeira da Alemanha"
                    />
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
                    Aula particular
                  </li>

                  <li>
                    <CheckCircle2 size={17} />
                    Uma aula por semana
                  </li>   
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

                {renderPlanos(planosAlemao)}

                <a href="/matricula">
                  Quero me matricular
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
                    Aula particular
                  </li>

                  <li>
                    <CheckCircle2 size={17} />
                    Escolha a quantidade de aulas por semana
                  </li>
                  <li>
                    <CheckCircle2 size={17} />
                    Objetivos específicos
                  </li>

                  <li>
                    <CheckCircle2 size={17} />
                    Conteúdo personalizado e direcionado
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

                <div className="course-custom-price">
                  <span>Valor personalizado</span>
                  <strong>Entre em contato</strong>
                </div>

                <a href="/matricula">
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

                <a href="/aluno" className="btn btn-primary">
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

                <a href="#contato" className="cta-contact-link">
                  Falar com a AB Academy
                  <ArrowRight size={17} />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

    </div>
  )
}

export default Home