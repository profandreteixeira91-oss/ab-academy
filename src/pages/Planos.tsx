import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Clock3, Menu, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import '../styles/planos.css'
import logo from '../assets/logo_abacademy.png'
import usaFlag from '../assets/flag-usa.svg'
import germanyFlag from '../assets/flag-germany.svg'

type Plano = {
  id: string
  idioma: 'ingles' | 'alemao'
  tipo: 'mensal' | 'anual' | 'personalizado' | 'intensivo' | 'avulso'
  nome: string
  descricao: string | null
  beneficios: string[] | null
  preco: number
  parcelas: number | null
  valor_parcela: number | null
  ativo: boolean
  modalidade: 'individual' | 'dupla' | 'grupo'
  min_alunos: number | null
  max_alunos: number | null
  aulas_semana: number | null
  created_at?: string | null
}

const ordemTipos: Plano['tipo'][] = ['mensal', 'anual', 'personalizado', 'intensivo']
const DESCONTO_FORMACAO_COLETIVA = 0.10

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function getPlanCta(tipo: Plano['tipo'], idioma: Plano['idioma']) {
  if (tipo === 'mensal') return 'Quero começar'
  if (tipo === 'anual') return 'Quero garantir minha vaga'
  if (tipo === 'personalizado') {
    return idioma === 'ingles' ? 'Quero acelerar meu inglês' : 'Quero acelerar meu alemão'
  }
  return 'Quero alcançar meu objetivo'
}

function getPlanPrice(plano: Plano) {
  if (plano.tipo === 'anual' && plano.valor_parcela !== null) {
    return {
      value: formatCurrency(Number(plano.valor_parcela)),
      suffix: '/mês',
      detail: formatCurrency(Number(plano.preco)) + ' no plano anual',
    }
  }

  return {
    value: formatCurrency(Number(plano.preco)),
    suffix: '/mês',
    detail: 'Cobrança mensal',
  }
}

function ModalidadeCard({
  modalidade,
  idioma,
  planos,
}: {
  modalidade: 'dupla' | 'grupo'
  idioma: 'ingles' | 'alemao'
  planos: Plano[]
}) {
  const individual1x = planos
    .filter(
      (plano) =>
        plano.idioma === idioma &&
        plano.modalidade === 'individual' &&
        plano.tipo === 'mensal' &&
        plano.aulas_semana === 1,
    )
    .sort((a, b) => Number(a.preco) - Number(b.preco))[0]

  const valorFormacao = individual1x
    ? Number((Number(individual1x.preco) * (1 - DESCONTO_FORMACAO_COLETIVA)).toFixed(2))
    : null

  const regulares = planos
    .filter(
      (plano) =>
        plano.idioma === idioma &&
        plano.modalidade === modalidade &&
        plano.tipo === 'mensal',
    )
    .sort((a, b) => (a.aulas_semana ?? 0) - (b.aulas_semana ?? 0))

  const capacidadeTexto = modalidade === 'dupla' ? '2 participantes' : '3 participantes'

  return (
    <article className={'planos-detail-card planos-detail-card--' + modalidade}>
      <span className="planos-detail-tag">
        {modalidade === 'dupla' ? '2 participantes' : '3 participantes'}
      </span>

      <h3>{modalidade === 'dupla' ? 'Aulas em dupla' : 'Aulas em grupo / trio'}</h3>

      <p className="planos-detail-description">
        {modalidade === 'dupla'
          ? 'Escolha entre entrar em uma dupla já formada ou iniciar uma nova dupla no horário que deseja.'
          : 'Entre em um grupo/trio já formado ou inicie uma nova turma. O preço de formação é temporário e não representa o valor definitivo da modalidade.'}
      </p>

      <div className="planos-collective-section">
        <div className="planos-collective-section-heading">
          <span className="planos-collective-kicker">Modalidade formada</span>
          <strong>{modalidade === 'dupla' ? 'Dupla já formada' : 'Grupo já formado'}</strong>
          <p>
            {modalidade === 'dupla'
              ? 'Valor regular por aluno para entrar em uma dupla que já possui outro participante.'
              : 'Valor regular por aluno para entrar em um grupo/trio já formado, enquanto houver vaga.'}
          </p>
        </div>

        <div className="planos-frequency-list">
          {regulares.length > 0 ? (
            regulares.map((plano) => (
              <div className="planos-frequency-card planos-frequency-card--regular" key={plano.id}>
                <div className="planos-frequency-heading">
                  <strong>{plano.aulas_semana ?? 1}x por semana</strong>
                  <span>
                    {formatCurrency(Number(plano.preco))}
                    <small>/aluno/mês</small>
                  </span>
                </div>
                <p>
                  {modalidade === 'dupla'
                    ? 'Dupla já formada.'
                    : `${capacidadeTexto} — valor regular da turma formada.`}
                </p>
                <a
                  href={'/matricula?modalidade=' + modalidade + '&idioma=' + idioma + '&plano=' + plano.id}
                  className="btn btn-outline planos-collective-cta"
                >
                  Encontrar meu horário <ArrowRight size={16} />
                </a>
              </div>
            ))
          ) : (
            <div className="planos-empty-collective">Nenhum plano regular disponível no momento.</div>
          )}
        </div>
      </div>

      <div className="planos-collective-formation">
        <span className="planos-collective-kicker">Nova turma</span>
        <h4>{modalidade === 'dupla' ? 'Comece uma nova dupla' : 'Comece um novo grupo'}</h4>
        <p>
          {modalidade === 'dupla'
            ? 'Não encontrou uma dupla no horário que deseja? Você pode iniciar uma nova dupla.'
            : 'Você pode iniciar uma nova turma no horário que deseja.'}
        </p>

        <div className="planos-formation-price">
          <span>Valor durante a formação</span>
          <strong>
            {valorFormacao !== null ? formatCurrency(valorFormacao) : 'Consulte'}
            <small>/mês</small>
          </strong>
          {individual1x && (
            <em>Valor individual de 1 aula por semana com 10% de desconto.</em>
          )}
        </div>

        <div className="planos-formation-explanation">
          <strong>Depois que a turma for formada:</strong>
          <p>
            {modalidade === 'dupla'
              ? 'quando outro aluno entrar, sua dupla estará formada e, a partir do próximo ciclo de cobrança, será aplicado o valor regular da dupla.'
              : 'quando a turma atingir a quantidade mínima definida, a partir do próximo ciclo de cobrança será aplicado o valor regular do grupo.'}
          </p>
        </div>

        <div className="planos-formation-actions">
          {regulares.length > 0 ? regulares.map((plano) => (
            <a
              key={plano.id}
              href={'/matricula?idioma=' + idioma + '&plano=' + plano.id}
              className="btn btn-primary planos-detail-cta"
            >
              {modalidade === 'dupla' ? 'Começar nova dupla — ' : 'Começar novo grupo — '}
              {plano.aulas_semana ?? 1}x por semana
              <ArrowRight size={17} />
            </a>
          )) : (
            <div className="planos-empty-collective">Nenhum plano de formação disponível no momento.</div>
          )}
        </div>
      </div>

      {individual1x && (
        <div className="planos-formation-example">
          <span>Exemplo explicativo</span>
          <strong>Como funciona o valor de formação</strong>
          <div className="planos-example-row">
            <span>Individual 1x/semana</span>
            <strong>{formatCurrency(Number(individual1x.preco))}</strong>
          </div>
          <div className="planos-example-row">
            <span>10% de desconto</span>
            <strong>- {formatCurrency(Number(individual1x.preco) * DESCONTO_FORMACAO_COLETIVA)}</strong>
          </div>
          <div className="planos-example-row planos-example-row--total">
            <span>Durante a formação</span>
            <strong>{formatCurrency(valorFormacao ?? 0)}</strong>
          </div>
          <p>
            Este valor é temporário. Ele existe exclusivamente enquanto a turma está sendo formada.
          </p>
        </div>
      )}

      <ul className="planos-detail-features">
        <li>Diagnóstico e orientação inicial</li>
        <li>Organização conforme nível e objetivo</li>
        <li>Acompanhamento da AB Academy</li>
      </ul>
    </article>
  )
}
function PlanoCard({ plano, horarioId }: { plano: Plano; horarioId?: string | null }) {
  const price = getPlanPrice(plano)

  return (
    <article className={'planos-detail-card planos-detail-card--' + plano.tipo}>
      {plano.tipo === 'anual' && (
        <span className="planos-detail-badge">Plano anual</span>
      )}

      <span className="planos-detail-tag">
        {plano.tipo === 'mensal' && '1x por semana'}
        {plano.tipo === 'anual' && '1x por semana'}
        {plano.tipo === 'personalizado' && '2x por semana'}
        {plano.tipo === 'intensivo' && '3x por semana'}
      </span>

      <h3>{plano.nome}</h3>

      <div className="planos-detail-price">
        <span>A partir de</span>
        <strong>{price.value}<small>{price.suffix}</small></strong>
        <em>{price.detail}</em>
      </div>

      <p className="planos-detail-description">
        {plano.descricao || 'Plano com acompanhamento personalizado pela AB Academy.'}
      </p>

      {plano.beneficios && plano.beneficios.length > 0 && (
        <ul className="planos-detail-features">
          {plano.beneficios.map((beneficio, index) => (
            <li key={index}>
              <CheckCircle2 size={17} />
              {beneficio}
            </li>
          ))}
        </ul>
      )}

      <a
        href={'/matricula?idioma=' + plano.idioma + '&plano=' + plano.id + (horarioId && plano.tipo === 'mensal' ? '&horario_id=' + encodeURIComponent(horarioId) + '&aguardando_formacao=1' : '')}
        className="btn btn-primary planos-detail-cta"
      >
        {getPlanCta(plano.tipo, plano.idioma)}
        <ArrowRight size={17} />
      </a>
    </article>
  )
}

function Planos() {
  const [planos, setPlanos] = useState<Plano[]>([])
  const [modalidadeSelecionada, setModalidadeSelecionada] = useState<'individual' | 'dupla' | 'grupo'>(() => {
    const modalidade = new URLSearchParams(window.location.search).get('modalidade')
    return modalidade === 'dupla' || modalidade === 'grupo' ? modalidade : 'individual'
  })
  const [idiomaSelecionado, setIdiomaSelecionado] = useState<'ingles' | 'alemao'>(() => {
    const idioma = new URLSearchParams(window.location.search).get('idioma')
    return idioma === 'alemao' ? 'alemao' : 'ingles'
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [horarioId] = useState(() => new URLSearchParams(window.location.search).get('horario_id'))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadPlanos() {
      setLoading(true)
      setError('')

      const { data, error: planosError } = await supabase
        .from('planos')
        .select('id, idioma, tipo, nome, descricao, beneficios, preco, parcelas, valor_parcela, ativo, modalidade, min_alunos, max_alunos, created_at, aulas_semana')
        .eq('ativo', true)

      if (!active) return

      if (planosError) {
        console.error('Erro ao carregar planos:', planosError)
        setError('Não foi possível carregar os planos no momento.')
        setLoading(false)
        return
      }

      setPlanos((data || []) as Plano[])
      setLoading(false)
    }

    loadPlanos()

    return () => {
      active = false
    }
  }, [])

  const planosPorIdioma = useMemo(() => {
    /*
     * Um idioma pode ter apenas um card por tipo de plano.
     * Se existirem registros duplicados no banco, mantemos apenas um
     * registro de forma determinística, evitando cards repetidos na página.
     * Quando houver data de criação, o registro mais recente é mantido.
     */
    const semDuplicados = (items: Plano[]) => {
      const unicos = new Map<string, Plano>()

      for (const plano of items) {
        const key = plano.tipo + ':' + plano.modalidade
        const atual = unicos.get(key)

        if (!atual) {
          unicos.set(key, plano)
          continue
        }

        const dataAtual = atual.created_at ? Date.parse(atual.created_at) : 0
        const dataNovo = plano.created_at ? Date.parse(plano.created_at) : 0

        if (dataNovo >= dataAtual) {
          unicos.set(key, plano)
        }
      }

      return Array.from(unicos.values())
    }

    const ordenar = (items: Plano[]) =>
      semDuplicados(items).sort(
        (a, b) => ordemTipos.indexOf(a.tipo) - ordemTipos.indexOf(b.tipo),
      )

    return {
      ingles: ordenar(planos.filter((plano) => plano.idioma === 'ingles' && plano.tipo !== 'avulso')),
      alemao: ordenar(planos.filter((plano) => plano.idioma === 'alemao' && plano.tipo !== 'avulso')),
    }
  }, [planos])

  return (
    <div className="home planos-page-shell">
      <header className="header">
        <div className="container header-container">
          <a href="/" className="logo">
            <img
              src={logo}
              alt="AB Academy"
              className="academy-header-logo"
            />
          </a>

          <nav className="navigation">
            <a href="/">Início</a>
            <a href="/#sobre">Sobre</a>
            <a href="/#cursos">Cursos</a>
            <a href="/planos" aria-current="page">Planos</a>
            <a href="/#metodologia">Metodologia</a>
            <a href="/#contato">Contato</a>
          </nav>

          <div className="header-actions">
            <a href="/matricula" className="btn btn-primary header-button">
              Matricule-se
            </a>
            <a href="/aluno" className="btn btn-primary header-button">
              Área do aluno
            </a>
            <a href="/professor" className="btn btn-outline header-button teacher-access-button">
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
            <a href="/" onClick={() => setMobileMenuOpen(false)}>Início</a>
            <a href="/#sobre" onClick={() => setMobileMenuOpen(false)}>Sobre</a>
            <a href="/#cursos" onClick={() => setMobileMenuOpen(false)}>Cursos</a>
            <a href="/planos" onClick={() => setMobileMenuOpen(false)}>Planos</a>
            <a href="/#metodologia" onClick={() => setMobileMenuOpen(false)}>Metodologia</a>
            <a href="/#contato" onClick={() => setMobileMenuOpen(false)}>Contato</a>
            <a href="/matricula" onClick={() => setMobileMenuOpen(false)}>Matricule-se</a>
            <a href="/aluno" onClick={() => setMobileMenuOpen(false)}>Área do aluno</a>
            <a href="/professor" onClick={() => setMobileMenuOpen(false)}>Portal do professor</a>
          </div>
        </div>
      </header>

      <main className="planos-page">
      <section className="planos-hero">
        <div className="planos-container">
          <span className="section-label">Planos AB Academy</span>
          <h1>Escolha o plano ideal para o seu objetivo.</h1>
          <p>
            Conheça todas as opções de Inglês e Alemão, compare frequência,
            investimento e proposta de cada plano e escolha a forma de estudo
            que melhor combina com você.
          </p>
        </div>
      </section>

      <section className="planos-section">
        <div className="planos-container">
          {loading && <div className="planos-state">Carregando planos...</div>}

          {!loading && error && (
            <div className="planos-state planos-state-error">{error}</div>
          )}

          {!loading && !error && (
            <>
              <div className="planos-language-switch">
                <p className="planos-language-switch-label">Como você quer estudar?</p>
                <div className="planos-language-switch-buttons planos-modality-switch" role="tablist">
                  {(['individual', 'dupla', 'grupo'] as const).map((modalidade) => (
                    <button key={modalidade} type="button" role="tab" aria-selected={modalidadeSelecionada === modalidade}
                      className={'planos-language-switch-button' + (modalidadeSelecionada === modalidade ? ' active' : '')}
                      onClick={() => setModalidadeSelecionada(modalidade)}>
                      <h2>{modalidade === 'individual' ? 'Individual' : modalidade === 'dupla' ? 'Dupla' : 'Grupo'}</h2>
                      <span>{modalidade === 'individual' ? 'Planos e frequências' : modalidade === 'dupla' ? 'Preço regular + formação' : 'Preço regular + formação'}</span>
                    </button>
                  ))}
                </div>
                {modalidadeSelecionada !== 'individual' && <p className="planos-modality-note">{modalidadeSelecionada === 'dupla' ? 'A dupla tem preço regular quando já está formada. Se você iniciar uma nova dupla, paga temporariamente o valor individual de 1 aula por semana com 10% de desconto.' : 'O grupo/trio tem preço regular quando já está formado. Se você iniciar uma nova turma, paga temporariamente o valor individual de 1 aula por semana com 10% de desconto.'}</p>}
                <p className="planos-language-switch-label">Selecione o curso desejado</p>

                <div className="planos-language-switch-buttons" role="tablist" aria-label="Selecione o curso">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={idiomaSelecionado === 'ingles'}
                    className={'planos-language-switch-button' + (idiomaSelecionado === 'ingles' ? ' active' : '')}
                    onClick={() => setIdiomaSelecionado('ingles')}
                  >
                    <img src={usaFlag} alt="" className="planos-language-flag" />
                    <h2>Inglês</h2>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={idiomaSelecionado === 'alemao'}
                    className={'planos-language-switch-button' + (idiomaSelecionado === 'alemao' ? ' active' : '')}
                    onClick={() => setIdiomaSelecionado('alemao')}
                  >
                    <img src={germanyFlag} alt="" className="planos-language-flag" />
                    <h2>Alemão</h2>
                  </button>
                </div>
              </div>

              {modalidadeSelecionada === 'individual' ? (
                idiomaSelecionado === 'ingles' ? (
                  <div className="planos-language planos-language--stacked"><div className="planos-grid">
                    {planosPorIdioma.ingles.filter((plano) => plano.modalidade === 'individual').map((plano) => <PlanoCard key={plano.id} plano={plano} horarioId={horarioId} />)}
                  </div></div>
                ) : (
                  <div className="planos-language planos-language--stacked"><div className="planos-grid">
                    {planosPorIdioma.alemao.filter((plano) => plano.modalidade === 'individual').map((plano) => <PlanoCard key={plano.id} plano={plano} />)}
                  </div></div>
                )
              ) : (
                <div className="planos-language planos-language--stacked"><div className="planos-grid">
                  <ModalidadeCard
                    modalidade={modalidadeSelecionada}
                    idioma={idiomaSelecionado}
                    planos={planos}
                  />
                </div></div>
              )}

              {modalidadeSelecionada !== 'individual' && (
                <section className="planos-formation-rules" aria-labelledby="planos-formation-rules-title">
                  <span className="planos-collective-kicker">Transparência no investimento</span>
                  <h2 id="planos-formation-rules-title">Como funciona a formação de uma dupla ou grupo?</h2>
                  <div className="planos-formation-rules-grid">
                    <div><strong>1.</strong><p>Você escolhe o idioma, a frequência e o horário.</p></div>
                    <div><strong>2.</strong><p>Se já houver uma turma compatível com vaga, você entra pelo valor regular da modalidade.</p></div>
                    <div><strong>3.</strong><p>Se não houver uma turma formada, você pode iniciar uma nova turma.</p></div>
                    <div><strong>4.</strong><p>Enquanto estiver em formação, você paga o valor individual de 1 aula por semana com 10% de desconto.</p></div>
                    <div><strong>5.</strong><p>Quando a turma atingir a quantidade necessária, o valor passa ao preço regular no próximo ciclo de cobrança.</p></div>
                  </div>
                </section>
              )}

              <div className="planos-diagnostic">
                <div className="planos-diagnostic-icon"><Clock3 size={24} /></div>
                <div className="planos-diagnostic-content">
                  <span className="planos-diagnostic-label">Antes de começar</span>
                  <h2>Aula diagnóstica — R$ 50</h2>
                  <p>
                    Aula individual de 60 minutos em Inglês ou Alemão para
                    entender seu nível e orientar o melhor caminho de estudo.
                    Pagamento único, sem recorrência.
                  </p>
                </div>
                <a href={'/diagnostica?idioma=' + idiomaSelecionado} className="btn btn-secondary">
                  Quero fazer a aula diagnóstica
                  <ArrowRight size={17} />
                </a>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
    </div>
  )
}

export default Planos
