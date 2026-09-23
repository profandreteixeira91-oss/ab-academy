import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Clock3 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import '../styles/planos.css'

type Plano = {
  id: string
  idioma: 'ingles' | 'alemao'
  tipo: 'mensal' | 'anual' | 'personalizado' | 'intensivo'
  nome: string
  descricao: string | null
  preco: number
  parcelas: number | null
  valor_parcela: number | null
  ativo: boolean
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

function PlanoCard({ plano }: { plano: Plano }) {
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

      <ul className="planos-detail-features">
        <li><CheckCircle2 size={17} />Aula individual de 60 minutos</li>
        <li><CheckCircle2 size={17} />Acompanhamento personalizado</li>
        <li><CheckCircle2 size={17} />Material e atividades de apoio</li>
      </ul>

      <a
        href={'/matricula?idioma=' + plano.idioma + '&plano=' + plano.id}
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadPlanos() {
      setLoading(true)
      setError('')

      const { data, error: queryError } = await supabase
        .from('planos')
        .select('id, idioma, tipo, nome, descricao, preco, parcelas, valor_parcela, ativo')
        .eq('ativo', true)

      if (!active) return

      if (queryError) {
        console.error('Erro ao carregar planos:', queryError)
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
    const ordenar = (items: Plano[]) =>
      [...items].sort(
        (a, b) => ordemTipos.indexOf(a.tipo) - ordemTipos.indexOf(b.tipo),
      )

    return {
      ingles: ordenar(planos.filter((plano) => plano.idioma === 'ingles')),
      alemao: ordenar(planos.filter((plano) => plano.idioma === 'alemao')),
    }
  }, [planos])

  return (
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
              <div className="planos-language">
                <div className="planos-language-heading">
                  <span className="section-label">Idioma</span>
                  <h2>Inglês</h2>
                  <p>Planos para diferentes ritmos de aprendizado.</p>
                </div>
                <div className="planos-grid">
                  {planosPorIdioma.ingles.map((plano) => (
                    <PlanoCard key={plano.id} plano={plano} />
                  ))}
                </div>
              </div>

              <div className="planos-language">
                <div className="planos-language-heading">
                  <span className="section-label">Idioma</span>
                  <h2>Alemão</h2>
                  <p>Escolha a frequência que melhor atende ao seu objetivo.</p>
                </div>
                <div className="planos-grid">
                  {planosPorIdioma.alemao.map((plano) => (
                    <PlanoCard key={plano.id} plano={plano} />
                  ))}
                </div>
              </div>

              <div className="planos-diagnostic">
                <div className="planos-diagnostic-icon"><Clock3 size={24} /></div>
                <div className="planos-diagnostic-content">
                  <span className="planos-diagnostic-label">Antes de começar</span>
                  <h2>Aula diagnóstica — R$ 50</h2>
                  <p>
                    Aula individual de 60 minutos em Inglês ou Alemão para
                    entender seu nível e orientar o melhor caminho de estudo.
                    Em caso de matrícula, os R$ 50 são descontados da primeira
                    mensalidade.
                  </p>
                </div>
                <a href="/matricula?diagnostica=1" className="btn btn-secondary">
                  Quero fazer a aula diagnóstica
                  <ArrowRight size={17} />
                </a>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}

export default Planos
