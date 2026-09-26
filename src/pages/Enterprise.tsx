import { useState } from 'react'

import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Globe2,
  Languages,
  MessageCircle,
  Target,
  Users,
} from 'lucide-react'

import '../styles/enterprise.css'
import logo from '../assets/logo_abacademy.png'
import { supabase } from '../lib/supabase'

function Enterprise() {
  const [form, setForm] = useState({
    nome: '',
    empresa: '',
    cargo: '',
    email: '',
    telefone: '',
    colaboradores: '',
    idiomas: [] as string[],
    objetivo: '',
    mensagem: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  function toggleIdioma(idioma: string) {
    setForm((current) => ({
      ...current,
      idiomas: current.idiomas.includes(idioma)
        ? current.idiomas.filter((item) => item !== idioma)
        : [...current.idiomas, idioma],
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError('')

    if (!form.nome || !form.empresa || !form.email || form.idiomas.length === 0) {
      setSubmitError('Preencha nome, empresa, e-mail e pelo menos um idioma.')
      return
    }

    try {
      setSubmitting(true)

      const { error } = await supabase.from('enterprise_leads').insert({
        nome: form.nome.trim(),
        empresa: form.empresa.trim(),
        cargo: form.cargo.trim() || null,
        email: form.email.trim(),
        telefone: form.telefone.trim() || null,
        colaboradores: form.colaboradores || null,
        idiomas: form.idiomas,
        objetivo: form.objetivo || null,
        mensagem: form.mensagem.trim() || null,
      })

      if (error) throw error

      setSubmitted(true)
      setForm({
        nome: '',
        empresa: '',
        cargo: '',
        email: '',
        telefone: '',
        colaboradores: '',
        idiomas: [],
        objetivo: '',
        mensagem: '',
      })
    } catch (error) {
      console.error('Erro ao enviar lead Enterprise:', error)
      setSubmitError('Não foi possível enviar sua solicitação. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const situations = [
    'Reuniões e videoconferências',
    'Apresentações profissionais',
    'Atendimento a clientes',
    'Negociações',
    'Comunicação com fornecedores',
    'Viagens corporativas',
    'E-mails e comunicação escrita',
    'Conversas profissionais',
    'Integração com equipes internacionais',
    'Treinamentos e eventos',
    'Situações específicas de cada segmento',
  ]

  const personalization = [
    {
      icon: Building2,
      title: 'Personalização para a empresa',
      text: 'O treinamento pode considerar o segmento, os objetivos e as demandas específicas do negócio.',
    },
    {
      icon: Users,
      title: 'Personalização para a equipe',
      text: 'Os participantes podem ter diferentes níveis de conhecimento e necessidades de desenvolvimento.',
    },
    {
      icon: Target,
      title: 'Personalização para a rotina profissional',
      text: 'Os conteúdos e atividades podem ser relacionados às situações que os profissionais realmente enfrentam.',
    },
    {
      icon: Globe2,
      title: 'Personalização para os objetivos',
      text: 'O foco pode estar no desenvolvimento da comunicação geral ou em necessidades profissionais mais específicas.',
    },
  ]

  const businessMoments = [
    {
      title: 'Para empresas que precisam se comunicar internacionalmente',
      text: 'Prepare profissionais para interagir com clientes, parceiros, fornecedores e equipes de outros países.',
    },
    {
      title: 'Para equipes que participam de reuniões internacionais',
      text: 'Desenvolva habilidades para compreender, participar e se expressar com mais segurança em reuniões profissionais.',
    },
    {
      title: 'Para profissionais que representam a empresa',
      text: 'Fortaleça a comunicação em apresentações, eventos, viagens e situações em que seus colaboradores precisam representar o negócio.',
    },
    {
      title: 'Para empresas em expansão',
      text: 'Prepare sua equipe para novos mercados e para uma rotina profissional cada vez mais internacional.',
    },
    {
      title: 'Para empresas que já possuem relações internacionais',
      text: 'Aprimore a comunicação daqueles que já utilizam o inglês ou alemão em seu trabalho e precisam desenvolver ainda mais suas habilidades.',
    },
  ]

  const differentiators = [
    ['Personalização', 'O treinamento é pensado a partir das necessidades da empresa e dos profissionais.'],
    ['Aplicação prática', 'O aprendizado é conectado a situações que podem fazer parte da rotina profissional.'],
    ['Flexibilidade', 'A solução pode ser estruturada de acordo com o perfil e a realidade da organização.'],
    ['Acompanhamento', 'A jornada de aprendizagem é acompanhada para favorecer a continuidade e o desenvolvimento.'],
    ['Tecnologia e recursos de apoio', 'Os participantes podem contar com recursos complementares para praticar e manter contato com o idioma fora das aulas.'],
    ['Inglês e alemão', 'Duas línguas estratégicas para diferentes contextos profissionais e relações internacionais.'],
  ]

  return (
    <div className="enterprise-page">
      <header className="enterprise-header">
        <div className="enterprise-container enterprise-header-inner">
          <a href="/" className="enterprise-logo" aria-label="AB Academy">
            <img src={logo} alt="AB Academy" />
          </a>

          <nav className="enterprise-nav">
            <a href="#solucao">A solução</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#aplicacao">Aplicação</a>
            <a href="#diferenciais">Diferenciais</a>
          </nav>

          <a href="#contato" className="enterprise-header-cta">
            Fale com nossa equipe
            <ArrowRight size={16} />
          </a>
        </div>
      </header>

      <main>
        <section className="enterprise-main-hero">
          <div className="enterprise-container enterprise-main-hero-grid">
            <div className="enterprise-main-hero-copy">
              <div className="enterprise-kicker">
                <span className="enterprise-kicker-mark">AB</span>
                <span>AB Academy Enterprise</span>
              </div>

              <span className="enterprise-eyebrow">Idiomas que fazem parte do seu negócio</span>

              <h1>
                Inglês e alemão para empresas que precisam transformar{' '}
                <span>conhecimento em comunicação real.</span>
              </h1>

              <p className="enterprise-hero-intro">
                Em um mercado cada vez mais conectado, o domínio de um segundo idioma deixou de ser apenas um diferencial profissional. Para muitas empresas, ele é uma necessidade diária.
              </p>

              <p>
                Reuniões com clientes internacionais, contato com fornecedores, negociações, viagens, apresentações, atendimento, treinamentos, comunicação entre equipes e acesso a novos mercados são situações em que a capacidade de se comunicar com segurança pode fazer parte da própria rotina do negócio.
              </p>

              <p>
                É por isso que a <strong>AB Academy Enterprise</strong> desenvolve soluções personalizadas em inglês e alemão para empresas de diferentes segmentos.
              </p>

              <div className="enterprise-hero-statement">
                <span className="enterprise-statement-line" />
                <strong>Mais do que ensinar um idioma, preparamos profissionais para utilizá-lo nas situações que realmente fazem parte do trabalho.</strong>
              </div>

              <div className="enterprise-hero-actions">
                <a href="#contato" className="enterprise-button enterprise-button-primary">
                  Fale com nossa equipe
                  <ArrowRight size={18} />
                </a>
                <a href="#como-funciona" className="enterprise-button enterprise-button-ghost">
                  Conheça a solução
                </a>
              </div>
            </div>

            <div className="enterprise-hero-visual" aria-hidden="true">
              <div className="enterprise-world-ring enterprise-world-ring-one" />
              <div className="enterprise-world-ring enterprise-world-ring-two" />
              <div className="enterprise-world-grid" />

              <div className="enterprise-hero-card">
                <div className="enterprise-card-top">
                  <div className="enterprise-card-brand">
                    <span>AB</span>
                    <small>ACADEMY</small>
                  </div>
                  <span className="enterprise-card-badge">ENTERPRISE</span>
                </div>

                <div className="enterprise-card-icon">
                  <Globe2 size={30} />
                </div>

                <span className="enterprise-card-label">COMUNICAÇÃO GLOBAL</span>
                <strong>Idioma conectado<br />ao negócio.</strong>

                <div className="enterprise-card-languages">
                  <span><Languages size={15} /> Inglês</span>
                  <span><Languages size={15} /> Alemão</span>
                </div>
              </div>

              <div className="enterprise-floating-card enterprise-floating-card-top">
                <CheckCircle2 size={17} />
                <span>Aplicação prática</span>
              </div>

              <div className="enterprise-floating-card enterprise-floating-card-bottom">
                <Users size={17} />
                <span>Desenvolvimento de equipes</span>
              </div>
            </div>
          </div>
        </section>

        <section className="enterprise-concept">
          <div className="enterprise-container">
            <div className="enterprise-concept-box">
              <span className="enterprise-section-overline">Nosso conceito</span>
              <blockquote>
                “Não ensinamos apenas o idioma. Desenvolvemos a capacidade de utilizá-lo quando o negócio exige.”
              </blockquote>
            </div>
          </div>
        </section>

        <section className="enterprise-section enterprise-solution-section" id="solucao">
          <div className="enterprise-container">
            <div className="enterprise-section-heading enterprise-section-heading-wide">
              <span className="enterprise-section-overline">Uma solução corporativa</span>
              <h2>Sua empresa não precisa de um curso genérico</h2>
              <p>
                Cada empresa possui uma realidade, um segmento, objetivos e desafios diferentes. Por isso, não acreditamos em uma solução única para todos.
              </p>
            </div>

            <div className="enterprise-solution-grid">
              <div className="enterprise-solution-copy">
                <p>
                  Na AB Academy Enterprise, o treinamento é pensado considerando o <strong>contexto da empresa, o nível dos profissionais, as necessidades do negócio e as situações em que o idioma será utilizado.</strong>
                </p>
                <p>
                  Isso significa que o aprendizado pode ser direcionado para aquilo que realmente importa para sua equipe.
                </p>
                <div className="enterprise-inline-statement">
                  <MessageCircle size={21} />
                  <strong>O idioma passa a fazer sentido porque está conectado à realidade profissional de quem aprende.</strong>
                </div>
              </div>

              <div className="enterprise-context-card">
                <span>O treinamento considera</span>
                <div><CheckCircle2 size={18} /> Contexto da empresa</div>
                <div><CheckCircle2 size={18} /> Nível dos profissionais</div>
                <div><CheckCircle2 size={18} /> Necessidades do negócio</div>
                <div><CheckCircle2 size={18} /> Situações reais de uso</div>
              </div>
            </div>
          </div>
        </section>

        <section className="enterprise-section enterprise-process-section" id="como-funciona">
          <div className="enterprise-container">
            <div className="enterprise-section-heading">
              <span className="enterprise-section-overline">Como funciona</span>
              <h2>Uma jornada construída para a realidade da sua empresa</h2>
              <p>
                Antes de pensar no conteúdo, precisamos entender o contexto. A partir dessas respostas, podemos estruturar uma experiência de aprendizagem mais direcionada.
              </p>
            </div>

            <div className="enterprise-process-grid">
              {[
                ['01', 'Diagnóstico', 'Quem são seus profissionais? Onde o idioma é utilizado? Quais situações geram mais dificuldade? Quais são os objetivos da empresa?'],
                ['02', 'Personalização', 'Estruturamos conteúdos, atividades e situações de comunicação de acordo com o contexto, o nível e os objetivos identificados.'],
                ['03', 'Desenvolvimento', 'Os profissionais aprendem, praticam e desenvolvem segurança para utilizar o idioma em situações reais de trabalho.'],
                ['04', 'Acompanhamento', 'A jornada é acompanhada para favorecer a continuidade, a prática e o desenvolvimento progressivo dos participantes.'],
              ].map(([number, title, text]) => (
                <article className="enterprise-process-card" key={number}>
                  <span className="enterprise-process-number">{number}</span>
                  <div className="enterprise-process-arrow"><ChevronRight size={18} /></div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="enterprise-section enterprise-personalization-section">
          <div className="enterprise-container">
            <div className="enterprise-section-heading">
              <span className="enterprise-section-overline">Personalização em diferentes níveis</span>
              <h2>Do negócio à rotina de cada profissional</h2>
            </div>

            <div className="enterprise-personalization-grid">
              {personalization.map(({ icon: Icon, title, text }) => (
                <article className="enterprise-personalization-card" key={title}>
                  <div className="enterprise-icon-box"><Icon size={22} /></div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="enterprise-section enterprise-application-section" id="aplicacao">
          <div className="enterprise-container">
            <div className="enterprise-application-heading">
              <div>
                <span className="enterprise-section-overline">Do aprendizado para a aplicação</span>
                <h2>O idioma precisa funcionar quando a situação real acontece.</h2>
              </div>
              <p>
                Aprender um idioma é importante. Saber utilizá-lo quando uma situação real acontece é o que transforma esse conhecimento em uma ferramenta profissional.
              </p>
            </div>

            <div className="enterprise-situations">
              {situations.map((situation) => (
                <div className="enterprise-situation" key={situation}>
                  <CheckCircle2 size={17} />
                  <span>{situation}</span>
                </div>
              ))}
            </div>

            <div className="enterprise-application-footer">
              <strong>Aprender → Praticar → Aplicar → Evoluir</strong>
              <span>
                O objetivo é criar oportunidades para que o profissional aprenda, pratique e desenvolva segurança para utilizar o idioma em situações reais.
              </span>
            </div>
          </div>
        </section>

        <section className="enterprise-section enterprise-moments-section">
          <div className="enterprise-container">
            <div className="enterprise-section-heading enterprise-section-heading-wide">
              <span className="enterprise-section-overline">Inglês e alemão para diferentes momentos</span>
              <h2>Idiomas que acompanham os desafios do negócio</h2>
            </div>

            <div className="enterprise-moments-grid">
              {businessMoments.map((item, index) => (
                <article className="enterprise-moment-card" key={item.title}>
                  <span>0{index + 1}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="enterprise-section enterprise-beyond-section">
          <div className="enterprise-container enterprise-beyond-grid">
            <div>
              <span className="enterprise-section-overline">O que sua equipe leva para além da aula?</span>
              <h2>A aprendizagem continua quando a aula termina.</h2>
              <p>
                Os participantes podem contar com recursos que favorecem a continuidade do aprendizado, permitindo que pratiquem, revisem conteúdos e mantenham contato com o idioma ao longo da semana.
              </p>
              <p>
                A proposta é criar uma jornada em que o profissional tenha oportunidades de aprender, praticar, aplicar e evoluir.
              </p>
            </div>

            <div className="enterprise-cycle">
              <div className="enterprise-cycle-center">JORNADA<br />CONTÍNUA</div>
              <span className="enterprise-cycle-item enterprise-cycle-item-one">Aprender</span>
              <span className="enterprise-cycle-item enterprise-cycle-item-two">Praticar</span>
              <span className="enterprise-cycle-item enterprise-cycle-item-three">Aplicar</span>
              <span className="enterprise-cycle-item enterprise-cycle-item-four">Evoluir</span>
            </div>
          </div>
        </section>

        <section className="enterprise-section enterprise-development-section">
          <div className="enterprise-container enterprise-development-grid">
            <div className="enterprise-development-visual">
              <div className="enterprise-development-line" />
              <div><span>01</span><strong>Direcionamento</strong></div>
              <div><span>02</span><strong>Prática</strong></div>
              <div><span>03</span><strong>Acompanhamento</strong></div>
              <div><span>04</span><strong>Desenvolvimento</strong></div>
            </div>

            <div>
              <span className="enterprise-section-overline">Uma jornada de desenvolvimento acompanhada</span>
              <h2>Não é simplesmente colocar profissionais em uma sala de aula.</h2>
              <p>
                Desenvolver uma habilidade exige continuidade. Por isso, a proposta da AB Academy Enterprise é criar uma jornada de aprendizagem na qual os profissionais tenham <strong>direcionamento, prática e acompanhamento.</strong>
              </p>
              <p>
                O desenvolvimento linguístico acontece de forma progressiva, respeitando o nível e o ritmo dos participantes.
              </p>
              <p>
                E, para a empresa, isso significa investir em uma capacitação estruturada e alinhada às necessidades do negócio.
              </p>
            </div>
          </div>
        </section>

        <section className="enterprise-section enterprise-investment-section">
          <div className="enterprise-container">
            <div className="enterprise-section-heading enterprise-section-heading-wide">
              <span className="enterprise-section-overline">Desenvolvimento profissional</span>
              <h2>Por que investir em idiomas para sua equipe?</h2>
              <p>
                Quando profissionais precisam utilizar outro idioma no trabalho, o impacto vai além do conhecimento linguístico.
              </p>
            </div>

            <div className="enterprise-investment-grid">
              {[
                'Interage com clientes e parceiros',
                'Participa de reuniões',
                'Apresenta ideias',
                'Conduz conversas profissionais',
                'Acessa informações e conhecimentos internacionais',
                'Trabalha com equipes de outros países',
                'Representa a empresa em diferentes contextos',
              ].map((item) => (
                <div key={item}><CheckCircle2 size={18} />{item}</div>
              ))}
            </div>

            <p className="enterprise-investment-note">
              Por isso, desenvolver idiomas dentro da empresa pode fazer parte de uma estratégia mais ampla de <strong>desenvolvimento profissional e preparação para um ambiente de negócios internacional.</strong>
            </p>
          </div>
        </section>

        <section className="enterprise-section enterprise-differentials-section" id="diferenciais">
          <div className="enterprise-container">
            <div className="enterprise-section-heading">
              <span className="enterprise-section-overline">Não oferecemos apenas aulas</span>
              <h2>Desenvolvemos soluções.</h2>
              <p>
                A AB Academy Enterprise combina <strong>ensino personalizado, aplicação prática e acompanhamento</strong> para criar uma experiência de aprendizagem conectada à realidade corporativa.
              </p>
            </div>

            <div className="enterprise-differentials-grid">
              {differentiators.map(([title, text], index) => (
                <article key={title}>
                  <span>0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="enterprise-final-cta" id="contato">
          <div className="enterprise-container enterprise-final-cta-inner">
            <div className="enterprise-final-mark">
              <div className="enterprise-final-mark-square">AB</div>
              <span>AB ACADEMY<br /><strong>ENTERPRISE</strong></span>
            </div>

            <span className="enterprise-section-overline">AB Academy Enterprise</span>
            <h2>Sua empresa está pronta para falar além das fronteiras?</h2>
            <p>
              Prepare sua equipe para se comunicar com mais segurança, participar de novas oportunidades e utilizar o inglês ou o alemão como uma ferramenta real de trabalho.
            </p>
            <p>
              Conte para nós quais são as necessidades da sua empresa e vamos construir uma solução adequada à sua realidade.
            </p>

            <div className="enterprise-final-label">
              <strong>Inglês e alemão conectados ao seu negócio.</strong>
            </div>

            {submitted ? (
              <div className="enterprise-form-success">
                <CheckCircle2 size={24} />
                <strong>Solicitação recebida.</strong>
                <span>Nossa equipe entrará em contato para entender as necessidades da sua empresa.</span>
              </div>
            ) : (
              <form className="enterprise-lead-form" onSubmit={handleSubmit}>
                <div className="enterprise-form-grid">
                  <label>
                    Nome *
                    <input value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} placeholder="Seu nome" required />
                  </label>
                  <label>
                    Empresa *
                    <input value={form.empresa} onChange={(event) => setForm({ ...form, empresa: event.target.value })} placeholder="Nome da empresa" required />
                  </label>
                  <label>
                    Cargo
                    <input value={form.cargo} onChange={(event) => setForm({ ...form, cargo: event.target.value })} placeholder="Seu cargo" />
                  </label>
                  <label>
                    E-mail corporativo *
                    <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="voce@empresa.com" required />
                  </label>
                  <label>
                    WhatsApp
                    <input value={form.telefone} onChange={(event) => setForm({ ...form, telefone: event.target.value })} placeholder="(00) 00000-0000" />
                  </label>
                  <label>
                    Número de colaboradores
                    <select value={form.colaboradores} onChange={(event) => setForm({ ...form, colaboradores: event.target.value })}>
                      <option value="">Selecione</option>
                      <option value="1-5">1 a 5</option>
                      <option value="6-15">6 a 15</option>
                      <option value="16-30">16 a 30</option>
                      <option value="31-50">31 a 50</option>
                      <option value="51-100">51 a 100</option>
                      <option value="100+">Mais de 100</option>
                    </select>
                  </label>
                </div>

                <fieldset>
                  <legend>Idioma de interesse *</legend>
                  <div className="enterprise-form-options">
                    {['Inglês', 'Alemão'].map((idioma) => (
                      <label key={idioma} className={form.idiomas.includes(idioma) ? 'selected' : ''}>
                        <input type="checkbox" checked={form.idiomas.includes(idioma)} onChange={() => toggleIdioma(idioma)} />
                        <span>{idioma}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label>
                  Objetivo principal
                  <select value={form.objetivo} onChange={(event) => setForm({ ...form, objetivo: event.target.value })}>
                    <option value="">Selecione</option>
                    <option value="desenvolvimento da equipe">Desenvolvimento da equipe</option>
                    <option value="expansão internacional">Expansão internacional</option>
                    <option value="atendimento a clientes">Atendimento a clientes</option>
                    <option value="comunicação interna">Comunicação interna</option>
                    <option value="outro">Outro</option>
                  </select>
                </label>

                <label>
                  Conte um pouco sobre a necessidade da sua empresa
                  <textarea value={form.mensagem} onChange={(event) => setForm({ ...form, mensagem: event.target.value })} rows={4} placeholder="Quais situações profissionais sua equipe precisa desenvolver?" />
                </label>

                {submitError && <div className="enterprise-form-error">{submitError}</div>}

                <button type="submit" className="enterprise-button enterprise-button-white" disabled={submitting}>
                  {submitting ? 'Enviando...' : 'Fale com nossa equipe'}
                  {!submitting && <ArrowRight size={18} />}
                </button>
              </form>
            )}

            <a href="/" className="enterprise-back-link">Voltar para AB Academy</a>
          </div>
        </section>
      </main>
    </div>
  )
}

export default Enterprise
