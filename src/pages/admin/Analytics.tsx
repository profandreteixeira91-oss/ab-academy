import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  Eye,
  Globe2,
  Monitor,
  RefreshCw,
  Smartphone,
  Tablet,
  Users,
} from 'lucide-react'

import { supabase } from '../../lib/supabase'

type RangeKey = '7d' | '30d' | '90d' | '365d'

type Row = {
  path?: string
  source?: string
  device?: string
  campaign?: string
  visits: number
}

type DailyRow = {
  day: string
  visits: number
  visitors: number
}

type AnalyticsSummary = {
  visits: number
  unique_visitors: number
  pages: number
  top_pages: Row[]
  sources: Row[]
  devices: Row[]
  campaigns: Row[]
  daily: DailyRow[]
}

const ranges: { id: RangeKey; label: string; days: number }[] = [
  { id: '7d', label: '7 dias', days: 7 },
  { id: '30d', label: '30 dias', days: 30 },
  { id: '90d', label: '90 dias', days: 90 },
  { id: '365d', label: '1 ano', days: 365 },
]

const emptySummary: AnalyticsSummary = {
  visits: 0,
  unique_visitors: 0,
  pages: 0,
  top_pages: [],
  sources: [],
  devices: [],
  campaigns: [],
  daily: [],
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value)
}

function formatPath(path: string) {
  if (path === '/') return 'Página inicial'
  return path
    .replace(/^\//, '')
    .replace(/\//g, ' / ')
    .replace(/-/g, ' ')
}

function formatSource(source: string) {
  if (!source) return 'Acesso direto'
  return source
    .replace('www.', '')
    .replace('facebook.com', 'Facebook')
    .replace('instagram.com', 'Instagram')
    .replace('google.com', 'Google')
    .replace('t.co', 'X / Twitter')
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(date + 'T12:00:00'))
}

function deviceIcon(device: string) {
  if (device === 'mobile') return Smartphone
  if (device === 'tablet') return Tablet
  return Monitor
}

export default function Analytics() {
  const [range, setRange] = useState<RangeKey>('30d')
  const [summary, setSummary] = useState<AnalyticsSummary>(emptySummary)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [previousVisits, setPreviousVisits] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')

    const selected = ranges.find((item) => item.id === range) || ranges[1]
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - selected.days)

    const previousEnd = new Date(start)
    const previousStart = new Date(previousEnd)
    previousStart.setDate(previousStart.getDate() - selected.days)

    const [currentResult, previousResult] = await Promise.all([
      supabase.rpc('admin_site_analytics_summary', {
        p_start: start.toISOString(),
        p_end: end.toISOString(),
      }),
      supabase.rpc('admin_site_analytics_summary', {
        p_start: previousStart.toISOString(),
        p_end: previousEnd.toISOString(),
      }),
    ])

    if (currentResult.error) {
      console.error('Erro ao carregar analytics:', currentResult.error)
      setError('Não foi possível carregar os dados de audiência.')
      setSummary(emptySummary)
      setPreviousVisits(null)
    } else {
      const data = currentResult.data as AnalyticsSummary | { error?: string } | null
      if (!data || 'error' in data) {
        setError('Acesso não autorizado aos dados de audiência.')
        setSummary(emptySummary)
      } else {
        setSummary(data)
      }

      if (!previousResult.error && previousResult.data && !('error' in previousResult.data)) {
        setPreviousVisits((previousResult.data as AnalyticsSummary).visits)
      } else {
        setPreviousVisits(null)
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [range])

  const variation = useMemo(() => {
    if (previousVisits === null || previousVisits === 0) return null
    return ((summary.visits - previousVisits) / previousVisits) * 100
  }, [summary.visits, previousVisits])

  const maxDaily = Math.max(...summary.daily.map((item) => item.visits), 1)

  return (
    <div className="admin-analytics">
      <div className="admin-analytics-toolbar">
        <div>
          <span className="admin-section-eyebrow">AUDIÊNCIA DO SITE</span>
          <h2 className="admin-section-title">Analytics</h2>
          <p className="admin-section-description">
            Acompanhe visitas, visitantes, páginas mais acessadas e principais origens de navegação.
          </p>
        </div>

        <div className="admin-analytics-actions">
          <div className="admin-analytics-range">
            {ranges.map((item) => (
              <button
                key={item.id}
                type="button"
                className={range === item.id ? 'active' : ''}
                onClick={() => setRange(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="admin-analytics-refresh"
            onClick={() => void load()}
            disabled={loading}
            title="Atualizar dados"
          >
            <RefreshCw size={15} className={loading ? 'is-spinning' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {error && <div className="admin-analytics-error">{error}</div>}

      <div className="admin-analytics-kpis">
        <article className="admin-analytics-kpi">
          <div className="admin-analytics-kpi-icon"><Eye size={19} /></div>
          <span>Visitas</span>
          <strong>{loading ? '—' : formatNumber(summary.visits)}</strong>
          {variation !== null && (
            <small className={variation >= 0 ? 'positive' : 'negative'}>
              {variation >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              {Math.abs(variation).toFixed(1)}% vs. período anterior
            </small>
          )}
        </article>

        <article className="admin-analytics-kpi">
          <div className="admin-analytics-kpi-icon"><Users size={19} /></div>
          <span>Visitantes</span>
          <strong>{loading ? '—' : formatNumber(summary.unique_visitors)}</strong>
          <small>sessões únicas no período</small>
        </article>

        <article className="admin-analytics-kpi">
          <div className="admin-analytics-kpi-icon"><Globe2 size={19} /></div>
          <span>Páginas acessadas</span>
          <strong>{loading ? '—' : formatNumber(summary.pages)}</strong>
          <small>rotas públicas com acesso</small>
        </article>

        <article className="admin-analytics-kpi">
          <div className="admin-analytics-kpi-icon"><BarChart3 size={19} /></div>
          <span>Média por visitante</span>
          <strong>
            {loading || !summary.unique_visitors
              ? '—'
              : (summary.visits / summary.unique_visitors).toFixed(1)}
          </strong>
          <small>visualizações por sessão</small>
        </article>
      </div>

      <div className="admin-analytics-grid admin-analytics-grid-main">
        <section className="admin-analytics-card admin-analytics-chart-card">
          <div className="admin-analytics-card-header">
            <div>
              <h3>Visitas no período</h3>
              <p>Volume diário de acessos ao site público.</p>
            </div>
            <CalendarDays size={18} />
          </div>

          {summary.daily.length === 0 ? (
            <div className="admin-analytics-empty">
              <BarChart3 size={24} />
              <strong>Ainda não há dados suficientes</strong>
              <span>As visitas começarão a aparecer aqui após a ativação do rastreamento.</span>
            </div>
          ) : (
            <div className="admin-analytics-bars" aria-label="Gráfico de visitas por dia">
              {summary.daily.map((item) => (
                <div className="admin-analytics-bar-column" key={item.day} title={`${formatDate(item.day)}: ${item.visits} visitas`}>
                  <div className="admin-analytics-bar-track">
                    <div
                      className="admin-analytics-bar"
                      style={{ height: `${Math.max((item.visits / maxDaily) * 100, item.visits ? 8 : 0)}%` }}
                    />
                  </div>
                  <span>{formatDate(item.day)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="admin-analytics-card">
          <div className="admin-analytics-card-header">
            <div>
              <h3>Principais fontes</h3>
              <p>De onde os acessos estão vindo.</p>
            </div>
            <Globe2 size={18} />
          </div>

          <div className="admin-analytics-list">
            {summary.sources.length === 0 && <div className="admin-analytics-list-empty">Sem dados no período.</div>}
            {summary.sources.map((item, index) => {
              const total = summary.sources.reduce((sum, source) => sum + source.visits, 0) || 1
              return (
                <div className="admin-analytics-list-row" key={item.source}>
                  <div className="admin-analytics-list-rank">{index + 1}</div>
                  <div className="admin-analytics-list-content">
                    <div>
                      <strong>{formatSource(item.source || '')}</strong>
                      <span>{formatNumber(item.visits)} visitas</span>
                    </div>
                    <div className="admin-analytics-progress">
                      <i style={{ width: `${(item.visits / total) * 100}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <div className="admin-analytics-grid">
        <section className="admin-analytics-card">
          <div className="admin-analytics-card-header">
            <div>
              <h3>Páginas mais acessadas</h3>
              <p>Rotas que concentram maior interesse.</p>
            </div>
            <Eye size={18} />
          </div>
          <div className="admin-analytics-list">
            {summary.top_pages.length === 0 && <div className="admin-analytics-list-empty">Sem dados no período.</div>}
            {summary.top_pages.map((item, index) => (
              <div className="admin-analytics-list-row" key={item.path}>
                <div className="admin-analytics-list-rank">{index + 1}</div>
                <div className="admin-analytics-list-content compact">
                  <strong>{formatPath(item.path || '')}</strong>
                  <span>{formatNumber(item.visits)} visitas</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-analytics-card">
          <div className="admin-analytics-card-header">
            <div>
              <h3>Dispositivos</h3>
              <p>Perfil tecnológico dos visitantes.</p>
            </div>
            <Monitor size={18} />
          </div>
          <div className="admin-analytics-device-list">
            {summary.devices.length === 0 && <div className="admin-analytics-list-empty">Sem dados no período.</div>}
            {summary.devices.map((item) => {
              const Icon = deviceIcon(item.device || '')
              const total = summary.devices.reduce((sum, device) => sum + device.visits, 0) || 1
              return (
                <div className="admin-analytics-device" key={item.device}>
                  <Icon size={17} />
                  <div>
                    <strong>{item.device === 'mobile' ? 'Celular' : item.device === 'tablet' ? 'Tablet' : 'Desktop'}</strong>
                    <span>{formatNumber(item.visits)} · {((item.visits / total) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="admin-analytics-card">
          <div className="admin-analytics-card-header">
            <div>
              <h3>Campanhas</h3>
              <p>UTM campaigns identificadas.</p>
            </div>
            <BarChart3 size={18} />
          </div>
          <div className="admin-analytics-list">
            {summary.campaigns.length === 0 && <div className="admin-analytics-list-empty">Nenhuma campanha identificada.</div>}
            {summary.campaigns.map((item) => (
              <div className="admin-analytics-list-row" key={item.campaign}>
                <div className="admin-analytics-list-content compact">
                  <strong>{item.campaign}</strong>
                  <span>{formatNumber(item.visits)} visitas</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
