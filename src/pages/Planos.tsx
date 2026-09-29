import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Clock3, Menu, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import '../styles/planos.css'
import logo from '../assets/logo_abacademy.png'
import usaFlag from '../assets/flag-usa.svg'
import germanyFlag from '../assets/flag-germany.svg'

type ModalidadeFrequencia = {
  id: string
  idioma: 'ingles' | 'alemao'
  modalidade: 'dupla' | 'grupo'
  aulas_semana: number
  preco_mensal: number | null
}

type ModalidadeFaixaPreco = {
  frequencia_id: string
  quantidade_participantes: number
  preco_mensal: number
}

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
  created_at?: string | null
}

const ordemTipos: Plano['tipo'][] = ['mensal', 'anual', 'personalizado', 'intensivo']

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
  frequencias,
  faixas,
}: {
  modalidade: 'dupla' | 'grupo'
  idioma: 'ingles' | 'alemao'
  frequencias: ModalidadeFrequencia[]
  faixas: ModalidadeFaixaPreco[]
}) {
  const dupla = modalidade === 'dupla'
  const frequenciasVisiveis = frequencias
    .filter((frequencia) => frequencia.modalidade === modalidade && (dupla ? frequencia.preco_mensal !== null : true))
    .sort((a, b) => a.aulas_semana - b.aulas_semana)

  return (
    <article className={'planos-detail-card planos-detail-card--' + modalidade}>
      <span className="planos-detail-tag">{dupla ? 'A partir de 1x por semana' : 'A partir de 2x por semana'}</span>
      <h3>{dupla ? 'Aulas em dupla' : 'Aulas em grupo'}</h3>
      <p className="planos-detail-description">
        {dupla
          ? 'Estude com outra pessoa, em uma turma real de 2 participantes, com acompanhamento do professor e valor individual por participante.'
          : 'Monte uma turma real com 3 a 6 participantes. Quanto maior a turma, menor o investimento individual. A modalidade não funciona como desconto para matrícula individual.'}
      </p>

      <div className="planos-frequency-list">
        {frequenciasVisiveis.map((frequencia) => {
          const preco = frequencia.preco_mensal
          const precosGrupo = faixas
            .filter((faixa) => faixa.frequencia_id === frequencia.id)
            .sort((a, b) => a.quantidade_participantes - b.quantidade_participantes)

          return (
            <div className="planos-frequency-card" key={frequencia.id}>
              <div className="planos-frequency-heading">
                <strong>{frequencia.aulas_semana}x por semana</strong>
                {dupla && preco !== null && <span>{formatCurrency(Number(preco))}<small>/aluno/mês</small></span>}
              </div>
              {dupla ? (
                <p>Valor por aluno, com 2 participantes na turma.</p>
              ) : (
                <div className="planos-group-prices">
                  {precosGrupo.map((faixa) => (
                    <div key={faixa.quantidade_participantes} className="planos-group-price-row">
                      <span>{faixa.quantidade_participantes} participantes</span>
                      <strong>{formatCurrency(Number(faixa.preco_mensal))}<small>/aluno/mês</small></strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <ul className="planos-detail-features">
        <li>Diagnóstico e orientação inicial</li>
        <li>Organização conforme nível e objetivo</li>
        <li>Acompanhamento da AB Academy</li>
      </ul>
      <a href={'/quero-aprender?modalidade=' + modalidade + '&idioma=' + idioma} className="btn btn-primary planos-detail-cta">
        {dupla ? 'Quero montar uma dupla' : 'Quero montar meu grupo'} <ArrowRight size={17} />
      </a>
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
        href={'/matricula?idioma=' + plano.idioma + '&plano=' + plano.id + (horarioId ? '&horario_id=' + encodeURIComponent(horarioId) + '&aguardando_formacao=1' : '')}
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
  const [modalidadeFrequencias, setModalidadeFrequencias] = useState<ModalidadeFrequencia[]>([])
  const [modalidadeFaixas, setModalidadeFaixas] = useState<ModalidadeFaixaPreco[]>([])
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

      const [planosResult, frequenciasResult] = await Promise.all([
        supabase
          .from('planos')
          .select('id, idioma, tipo, nome, descricao, beneficios, preco, parcelas, valor_parcela, ativo, modalidade, min_alunos, max_alunos, created_at')
          .eq('ativo', true),
        supabase
          .from('modalidade_frequencias')
          .select('id, idioma, modalidade, aulas_semana, preco_mensal')
          .eq('ativo', true),
      ])

      if (!active) return

      if (planosResult.error || frequenciasResult.error) {
        console.error('Erro ao carregar ofertas:', planosResult.error || frequenciasResult.error)
        setError('Não foi possível carregar os planos no momento.')
        setLoading(false)
        return
      }

      const frequencias = (frequenciasResult.data || []) as ModalidadeFrequencia[]
      const grupoFrequenciaIds = frequencias.filter((item) => item.modalidade === 'grupo').map((item) => item.id)
      let faixas: ModalidadeFaixaPreco[] = []

      if (grupoFrequenciaIds.length > 0) {
        const { data: faixaData, error: faixaError } = await supabase
          .from('modalidade_frequencia_precos')
          .select('frequencia_id, quantidade_participantes, preco_mensal')
          .eq('ativo', true)
          .in('frequencia_id', grupoFrequenciaIds)

        if (faixaError) {
          console.error('Erro ao carregar preços de grupo:', faixaError)
          setError('Não foi possível carregar os preços de grupo no momento.')
          setLoading(false)
          return
        }

        faixas = (faixaData || []) as ModalidadeFaixaPreco[]
      }

      setPlanos((planosResult.data || []) as Plano[])
      setModalidadeFrequencias(frequencias)
      setModalidadeFaixas(faixas)
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
                      <span>{modalidade === 'individual' ? 'Planos e frequências' : modalidade === 'dupla' ? 'A partir de 1x/semana' : 'A partir de 2x/semana'}</span>
                    </button>
                  ))}
                </div>
                {modalidadeSelecionada !== 'individual' && <p className="planos-modality-note">{modalidadeSelecionada === 'dupla' ? 'As aulas em dupla começam a partir de uma aula por semana. O investimento é definido conforme idioma e frequência.' : 'As aulas em grupo começam a partir de duas aulas por semana. O investimento é definido conforme idioma, frequência e tamanho do grupo.'}</p>}
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
                    frequencias={modalidadeFrequencias.filter((frequencia) => frequencia.idioma === idiomaSelecionado)}
                    faixas={modalidadeFaixas}
                  />
                </div></div>
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
