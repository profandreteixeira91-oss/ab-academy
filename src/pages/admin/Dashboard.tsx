import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  GraduationCap,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react'

import { supabase } from '../../lib/supabase'
import '../../styles/admin/Dashboard.css'

type Period = 'dia' | 'semana' | 'mes'

type Schedule = {
  id: string
  idioma: string
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  disponivel: boolean
  aluno: { nome_completo: string } | { nome_completo: string }[] | null
}

type ModuleStat = {
  id: string
  label: string
  value: number
  detail: string
  icon: typeof Users
}

const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function startOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function addDays(date: Date, amount: number) {
  const value = new Date(date)
  value.setDate(value.getDate() + amount)
  return value
}

function formatDate(date: Date) {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatMonth(date: Date) {
  return date.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).replace(/^./, (char) => char.toUpperCase())
}

function formatHour(value: string) {
  return value?.slice(0, 5) || '--:--'
}

function studentName(schedule: Schedule) {
  if (Array.isArray(schedule.aluno)) return schedule.aluno[0]?.nome_completo || 'Horário disponível'
  return schedule.aluno?.nome_completo || 'Horário disponível'
}

function languageLabel(value: string) {
  return value === 'alemao' ? 'Alemão' : 'Inglês'
}

type Lead = { status: string; source: string | null; created_at: string }

export default function Dashboard({ onNavigate }: { onNavigate?: (module: string) => void }) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('semana')
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()))
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [moduleStats, setModuleStats] = useState<ModuleStat[]>([])
  const [leads, setLeads] = useState<Lead[]>([])

  async function loadDashboard() {
    try {
      setRefreshing(true)
      setError(null)

      const results = await Promise.all([
        supabase.from('alunos').select('id', { count: 'exact', head: true }),
        supabase.from('matriculas').select('id', { count: 'exact', head: true }).eq('status', 'ativa'),
        supabase.from('horarios').select('id,idioma,dia_semana,hora_inicio,hora_fim,disponivel,aluno:alunos(nome_completo)').order('hora_inicio', { ascending: true }),
        supabase.from('planos').select('id', { count: 'exact', head: true }).eq('ativo', true),
        supabase.from('atividades').select('id', { count: 'exact', head: true }),
        supabase.from('central_atividades').select('id', { count: 'exact', head: true }).neq('status', 'arquivada'),
        supabase.from('pagamentos').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
        supabase.from('mensalidades').select('id', { count: 'exact', head: true }).in('status', ['pendente', 'vencida']),
        supabase.from('solicitacoes').select('id', { count: 'exact', head: true }).in('status', ['aberta', 'em_andamento']),
        supabase.from('lancamentos_financeiros').select('id', { count: 'exact', head: true }).eq('tipo', 'despesa').eq('status', 'pendente'),
        supabase.from('leads').select('status,source,created_at').order('created_at', { ascending: false }),
      ])

      const scheduleResult = results[2]
      const leadsResult = results[10]
      if (scheduleResult.error) throw scheduleResult.error
      if (leadsResult.error) throw leadsResult.error

      setSchedules((scheduleResult.data || []) as Schedule[])
      setLeads((leadsResult.data || []) as Lead[])

      setModuleStats([
        { id: 'alunos', label: 'Alunos', value: results[0].count || 0, detail: 'cadastros', icon: Users },
        { id: 'matriculas', label: 'Matrículas', value: results[1].count || 0, detail: 'ativas', icon: GraduationCap },
        { id: 'agenda', label: 'Agenda', value: (scheduleResult.data || []).filter((item) => item.disponivel).length, detail: 'horários', icon: CalendarDays },
        { id: 'planos', label: 'Planos', value: results[3].count || 0, detail: 'ativos', icon: ClipboardList },
        { id: 'atividades', label: 'Atividades', value: results[4].count || 0, detail: 'atividades', icon: ClipboardList },
        { id: 'central', label: 'Central de atividades', value: results[5].count || 0, detail: 'publicadas e rascunhos', icon: Sparkles },
        { id: 'pagamentos', label: 'Pagamentos', value: results[6].count || 0, detail: 'pendentes', icon: WalletCards },
        { id: 'mensalidades', label: 'Mensalidades', value: results[7].count || 0, detail: 'em aberto / vencidas', icon: DollarSign },
        { id: 'comunicacao', label: 'Solicitações', value: results[8].count || 0, detail: 'aguardando atendimento', icon: MessageSquare },
        { id: 'despesas', label: 'Financeiro', value: results[9].count || 0, detail: 'despesas pendentes', icon: DollarSign },
      ])
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err)
      setError('Não foi possível carregar todos os indicadores. Verifique as permissões e as tabelas financeiras.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  const commercialStats = useMemo(() => {
    const total = leads.length
    const count = (statuses: string[]) => statuses.length === 0
      ? total
      : leads.filter((lead) => statuses.includes(lead.status)).length

    return {
      total,
      newLeads: leads.filter((lead) => lead.status === 'novo').length,
      contacted: count(['contatado', 'diagnostico', 'proposta_enviada', 'negociacao', 'matriculado']),
      diagnostics: count(['diagnostico', 'proposta_enviada', 'negociacao', 'matriculado']),
      proposals: count(['proposta_enviada', 'negociacao', 'matriculado']),
      enrollments: count(['matriculado']),
    }
  }, [leads])

  const sourceStats = useMemo(() => {
    const counts = new Map<string, number>()
    leads.forEach((lead) => {
      const source = lead.source?.trim() || 'Orgânico / direto'
      counts.set(source, (counts.get(source) || 0) + 1)
    })
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [leads])

  const selectedWeekStart = useMemo(() => {
    const date = startOfDay(selectedDate)
    const day = date.getDay()
    return addDays(date, day === 0 ? 0 : -day)
  }, [selectedDate])

  const visibleDates = useMemo(() => {
    if (period === 'dia') return [selectedDate]
    if (period === 'semana') return Array.from({ length: 7 }, (_, index) => addDays(selectedWeekStart, index))

    const first = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
    const start = addDays(first, -first.getDay())
    const last = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)
    const end = addDays(last, 6 - last.getDay())
    const dates: Date[] = []
    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) dates.push(cursor)
    return dates
  }, [period, selectedDate, selectedWeekStart])

  const schedulesByDay = useMemo(() => {
    const map = new Map<number, Schedule[]>()
    schedules.forEach((schedule) => {
      if (!map.has(schedule.dia_semana)) map.set(schedule.dia_semana, [])
      map.get(schedule.dia_semana)!.push(schedule)
    })
    map.forEach((items) => items.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)))
    return map
  }, [schedules])

  const schedulesForDate = (date: Date) => schedulesByDay.get(date.getDay()) || []

  const periodTitle =
    period === 'dia'
      ? selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).replace(/^./, (char) => char.toUpperCase())
      : period === 'semana'
        ? `${formatDate(selectedWeekStart)} — ${formatDate(addDays(selectedWeekStart, 6))}`
        : formatMonth(selectedDate)

  function navigate(amount: number) {
    if (period === 'dia') setSelectedDate((date) => addDays(date, amount))
    if (period === 'semana') setSelectedDate((date) => addDays(date, amount * 7))
    if (period === 'mes') setSelectedDate((date) => new Date(date.getFullYear(), date.getMonth() + amount, 1))
  }

  function goToday() {
    setSelectedDate(startOfDay(new Date()))
  }

  if (loading) {
    return (
      <section className="dashboard-page">
        <div className="dashboard-loading">
          <div className="dashboard-loading-spinner" />
          <p>Carregando visão geral da AB Academy...</p>
        </div>
      </section>
    )
  }

  return (
    <section className="dashboard-page">
      <header className="dashboard-page-header">
        <div>
          <span className="dashboard-eyebrow">VISÃO GERAL</span>
          <h1>Dashboard</h1>
          <p>Uma visão centralizada da operação acadêmica, financeira e administrativa.</p>
        </div>
        <button type="button" className="dashboard-refresh-button" onClick={() => void loadDashboard()} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'dashboard-spin-icon' : ''} />
          {refreshing ? 'Atualizando...' : 'Atualizar dados'}
        </button>
      </header>

      {error && (
        <div className="dashboard-error"><AlertCircle size={18} /><span>{error}</span></div>
      )}

      <section className="dashboard-commercial">
        <div className="dashboard-commercial-header">
          <div>
            <span className="dashboard-eyebrow">CAPTAÇÃO E VENDAS</span>
            <h2>Funil comercial</h2>
            <p>Acompanhe os leads captados pelo site e a evolução no atendimento.</p>
          </div>
          <button type="button" className="dashboard-commercial-action" onClick={() => onNavigate?.('leads')}>
            Ver todos os leads <ArrowRight size={15} />
          </button>
        </div>

        <div className="dashboard-funnel">
          {[
            ['Leads', commercialStats.total, commercialStats.total],
            ['Contatados', commercialStats.contacted, commercialStats.total],
            ['Diagnósticos', commercialStats.diagnostics, commercialStats.total],
            ['Propostas', commercialStats.proposals, commercialStats.total],
            ['Matrículas', commercialStats.enrollments, commercialStats.total],
          ].map(([label, value, total], index) => (
            <div className="dashboard-funnel-step" key={label}>
              <button type="button" className="dashboard-funnel-card" onClick={() => onNavigate?.('leads')}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{index === 0 ? `${commercialStats.newLeads} novos agora` : `${total ? Math.round((value / total) * 100) : 0}% do total`}</small>
              </button>
              {index < 4 && <ArrowRight className="dashboard-funnel-arrow" size={16} />}
            </div>
          ))}
        </div>

        <div className="dashboard-commercial-grid">
          <div className="dashboard-commercial-card">
            <div className="dashboard-commercial-card-heading">
              <div>
                <span>ORIGEM DOS LEADS</span>
                <strong>Principais canais</strong>
              </div>
              <BarChart3 size={18} />
            </div>
            {sourceStats.length === 0 ? (
              <div className="dashboard-commercial-empty">Ainda não há leads para analisar.</div>
            ) : (
              <div className="dashboard-source-list">
                {sourceStats.map(([source, value]) => (
                  <button type="button" className="dashboard-source-row" key={source} onClick={() => onNavigate?.('leads')}>
                    <span>{source}</span>
                    <div className="dashboard-source-track"><i style={{ width: `${commercialStats.total ? (value / commercialStats.total) * 100 : 0}%` }} /></div>
                    <strong>{value}</strong>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="dashboard-commercial-card">
            <div className="dashboard-commercial-card-heading">
              <div>
                <span>ATENÇÃO COMERCIAL</span>
                <strong>Leads aguardando contato</strong>
              </div>
              <Users size={18} />
            </div>
            <button type="button" className="dashboard-attention-value" onClick={() => onNavigate?.('leads')}>
              <strong>{commercialStats.newLeads}</strong>
              <span>novos leads aguardando atendimento</span>
              <small>{commercialStats.newLeads > 0 ? 'Priorize o contato para não perder a oportunidade.' : 'Nenhum novo lead aguardando contato.'}</small>
            </button>
          </div>
        </div>
      </section>

      <section className="dashboard-module-grid">
        {moduleStats.map((module) => {
          const Icon = module.icon
          return (
            <div className="dashboard-module-card" key={module.id}>
              <div className="dashboard-module-icon"><Icon size={18} /></div>
              <div className="dashboard-module-copy">
                <span>{module.label}</span>
                <strong>{module.value}</strong>
                <small>{module.detail}</small>
              </div>
            </div>
          )
        })}
      </section>

      <section className="dashboard-calendar-panel">
        <div className="dashboard-calendar-header">
          <div>
            <span className="dashboard-eyebrow">AGENDA</span>
            <h2>Calendário acadêmico</h2>
            <p>Visualize os horários recorrentes por dia, semana ou mês.</p>
          </div>

          <div className="dashboard-calendar-controls">
            <button type="button" onClick={goToday}>Hoje</button>
            <div className="dashboard-period-switcher">
              {(['dia', 'semana', 'mes'] as Period[]).map((item) => (
                <button key={item} type="button" className={period === item ? 'active' : ''} onClick={() => setPeriod(item)}>
                  {item === 'dia' ? 'Dia' : item === 'semana' ? 'Semana' : 'Mês'}
                </button>
              ))}
            </div>
            <div className="dashboard-calendar-nav">
              <button type="button" aria-label="Período anterior" onClick={() => navigate(-1)}><ArrowLeft size={16} /></button>
              <strong>{periodTitle}</strong>
              <button type="button" aria-label="Próximo período" onClick={() => navigate(1)}><ArrowRight size={16} /></button>
            </div>
          </div>
        </div>

        {period === 'mes' ? (
          <div className="dashboard-month-calendar">
            {dayNames.map((day) => <div className="dashboard-calendar-weekday" key={day}>{day}</div>)}
            {visibleDates.map((date) => {
              const items = schedulesForDate(date)
              const outside = date.getMonth() !== selectedDate.getMonth()
              return (
                <button
                  type="button"
                  className={`dashboard-month-day ${outside ? 'outside' : ''} ${date.toDateString() === selectedDate.toDateString() ? 'selected' : ''}`}
                  key={date.toISOString()}
                  onClick={() => { setSelectedDate(date); setPeriod('dia') }}
                >
                  <strong>{date.getDate()}</strong>
                  <span>{items.length} {items.length === 1 ? 'aula' : 'aulas'}</span>
                  <div className="dashboard-month-dots">
                    {items.slice(0, 3).map((item) => <i key={item.id} />)}
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className={`dashboard-period-grid dashboard-period-${period}`}>
            {visibleDates.map((date) => {
              const items = schedulesForDate(date)
              const isToday = date.toDateString() === new Date().toDateString()
              return (
                <div className={`dashboard-day-column ${isToday ? 'today' : ''}`} key={date.toISOString()}>
                  <button type="button" className="dashboard-day-heading" onClick={() => { setSelectedDate(date); setPeriod('dia') }}>
                    <span>{dayNames[date.getDay()]}</span>
                    <strong>{date.getDate()}</strong>
                    <small>{date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</small>
                  </button>
                  <div className="dashboard-day-events">
                    {items.length === 0 ? (
                      <div className="dashboard-no-events">Sem aulas</div>
                    ) : items.map((item) => (
                      <div className={`dashboard-calendar-event ${item.idioma}`} key={item.id}>
                        <strong>{formatHour(item.hora_inicio)} — {formatHour(item.hora_fim)}</strong>
                        <span>{languageLabel(item.idioma)}</span>
                        <small>{studentName(item)}</small>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {period === 'dia' && (
          <div className="dashboard-day-summary">
            <CalendarDays size={17} />
            <strong>{schedulesForDate(selectedDate).length}</strong>
            <span>{schedulesForDate(selectedDate).length === 1 ? 'horário programado' : 'horários programados'} para este dia.</span>
          </div>
        )}
      </section>

      <section className="dashboard-bottom-grid">
        <div className="dashboard-insight-card">
          <div className="dashboard-insight-icon"><CheckCircle2 size={18} /></div>
          <div><span>Agenda</span><strong>{schedules.filter((item) => item.disponivel).length}</strong><small>horários disponíveis cadastrados</small></div>
        </div>
        <div className="dashboard-insight-card">
          <div className="dashboard-insight-icon"><WalletCards size={18} /></div>
          <div><span>Financeiro</span><strong>{moduleStats.find((item) => item.id === 'pagamentos')?.value || 0}</strong><small>pagamentos aguardando processamento</small></div>
        </div>
        <div className="dashboard-insight-card">
          <div className="dashboard-insight-icon"><MessageSquare size={18} /></div>
          <div><span>Atendimento</span><strong>{moduleStats.find((item) => item.id === 'comunicacao')?.value || 0}</strong><small>solicitações aguardando atendimento</small></div>
        </div>
      </section>
    </section>
  )
}
