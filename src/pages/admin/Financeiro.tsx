import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Download,
  Edit3,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'

import { supabase } from '../../lib/supabase'
import Mensalidades from './Mensalidades'
import '../../styles/admin/Financeiro.css'

type TipoLancamento = 'receita' | 'despesa'
type StatusLancamento = 'pendente' | 'pago' | 'cancelado'
type FinanceTab = 'visao-geral' | 'mensalidades' | 'lancamentos' | 'recebimentos'

type Lancamento = {
  id: string
  tipo: TipoLancamento
  categoria: string
  descricao: string
  valor: number
  status: StatusLancamento
  data_vencimento: string | null
  data_pagamento: string | null
  metodo_pagamento: string | null
  aluno_id: string | null
  pagamento_id: string | null
  recorrente: boolean
  observacoes: string | null
  created_at: string
  updated_at: string
  aluno?: {
    nome_completo: string | null
  } | null
}

type Pagamento = {
  id: string
  user_id: string
  idioma: string | null
  tipo_plano: string | null
  valor: number
  status: string
  matricula_id: string | null
  plano_id: string | null
  dados_matricula: Record<string, unknown> | null
  created_at: string
}

type Aluno = {
  id: string
  nome_completo: string | null
}

type FormState = {
  tipo: TipoLancamento
  categoria: string
  descricao: string
  valor: string
  status: StatusLancamento
  data_vencimento: string
  data_pagamento: string
  metodo_pagamento: string
  aluno_id: string
  recorrente: boolean
  observacoes: string
}

const CATEGORIAS_RECEITA = [
  'Mensalidades',
  'Matrículas',
  'Aulas particulares',
  'Outros',
]

const CATEGORIAS_DESPESA = [
  'Professores',
  'Marketing',
  'Software e tecnologia',
  'Infraestrutura',
  'Impostos',
  'Materiais',
  'Serviços',
  'Outros',
]

const emptyForm: FormState = {
  tipo: 'receita',
  categoria: 'Mensalidades',
  descricao: '',
  valor: '',
  status: 'pendente',
  data_vencimento: '',
  data_pagamento: '',
  metodo_pagamento: 'PIX',
  aluno_id: '',
  recorrente: false,
  observacoes: '',
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-')
  if (!year || !month || !day) return '—'
  return `${day}/${month}/${year}`
}

function monthKey(value: string | null) {
  return value ? value.slice(0, 7) : ''
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function getPaymentStudent(payment: Pagamento) {
  return String(payment.dados_matricula?.nome_completo ?? 'Aluno não identificado')
}

function getPaymentDescription(payment: Pagamento) {
  const idioma =
    payment.idioma === 'alemao'
      ? 'Alemão'
      : payment.idioma === 'ingles'
        ? 'Inglês'
        : 'Curso'

  const plano =
    payment.tipo_plano === 'anual'
      ? 'Plano anual'
      : payment.tipo_plano === 'mensal'
        ? 'Plano mensal'
        : 'Plano personalizado'

  return `${idioma} · ${plano}`
}

function isPaymentPaid(status: string) {
  return status === 'pago'
}

function isPaymentOpen(status: string) {
  return ['pendente', 'processando'].includes(status)
}

export default function Financeiro() {
  const [tab, setTab] = useState<FinanceTab>('visao-geral')
  const [month, setMonth] = useState(currentMonth())
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState<'todos' | TipoLancamento>('todos')
  const [filterStatus, setFilterStatus] = useState<'todos' | StatusLancamento>('todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [generatingRecurring, setGeneratingRecurring] = useState(false)

  async function loadFinanceiro() {
    try {
      setLoading(true)
      setError('')

      const [lancamentosResult, pagamentosResult, alunosResult] =
        await Promise.all([
          supabase
            .from('lancamentos_financeiros')
            .select(`
              id,
              tipo,
              categoria,
              descricao,
              valor,
              status,
              data_vencimento,
              data_pagamento,
              metodo_pagamento,
              aluno_id,
              pagamento_id,
              recorrente,
              observacoes,
              created_at,
              updated_at,
              aluno:alunos(nome_completo)
            `)
            .order('data_vencimento', { ascending: false }),

          supabase
            .from('pagamentos')
            .select(`
              id,
              user_id,
              idioma,
              tipo_plano,
              valor,
              status,
              matricula_id,
              plano_id,
              dados_matricula,
              created_at
            `)
            .order('created_at', { ascending: false }),

          supabase
            .from('alunos')
            .select('id, nome_completo')
            .order('nome_completo', { ascending: true }),
        ])

      if (lancamentosResult.error) throw lancamentosResult.error
      if (pagamentosResult.error) throw pagamentosResult.error
      if (alunosResult.error) throw alunosResult.error

      setLancamentos((lancamentosResult.data ?? []) as Lancamento[])
      setPagamentos((pagamentosResult.data ?? []) as Pagamento[])
      setAlunos((alunosResult.data ?? []) as Aluno[])
    } catch (err) {
      console.error('Erro ao carregar financeiro:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar o módulo financeiro.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFinanceiro()
  }, [])

  const filteredLancamentos = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return lancamentos.filter((item) => {
      const date = item.data_pagamento || item.data_vencimento || item.created_at
      const matchesMonth = monthKey(date) === month
      const matchesTipo =
        filterTipo === 'todos' || item.tipo === filterTipo
      const matchesStatus =
        filterStatus === 'todos' || item.status === filterStatus

      const haystack = [
        item.descricao,
        item.categoria,
        item.aluno?.nome_completo ?? '',
        item.metodo_pagamento ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return (
        matchesMonth &&
        matchesTipo &&
        matchesStatus &&
        (!normalizedSearch || haystack.includes(normalizedSearch))
      )
    })
  }, [lancamentos, month, search, filterTipo, filterStatus])

  const monthPayments = useMemo(
    () =>
      pagamentos.filter(
        (payment) => monthKey(payment.created_at) === month,
      ),
    [pagamentos, month],
  )

  const metrics = useMemo(() => {
    const manualPaidRevenue = filteredLancamentos
      .filter((item) => item.tipo === 'receita' && item.status === 'pago')
      .reduce((sum, item) => sum + Number(item.valor), 0)

    const manualPaidExpenses = filteredLancamentos
      .filter((item) => item.tipo === 'despesa' && item.status === 'pago')
      .reduce((sum, item) => sum + Number(item.valor), 0)

    const manualReceivable = filteredLancamentos
      .filter((item) => item.tipo === 'receita' && item.status === 'pendente')
      .reduce((sum, item) => sum + Number(item.valor), 0)

    const asaasRevenue = monthPayments
      .filter((payment) => isPaymentPaid(payment.status))
      .reduce((sum, payment) => sum + Number(payment.valor), 0)

    const asaasReceivable = monthPayments
      .filter((payment) => isPaymentOpen(payment.status))
      .reduce((sum, payment) => sum + Number(payment.valor), 0)

    const paidRevenue = asaasRevenue + manualPaidRevenue
    const paidExpenses = manualPaidExpenses

    return {
      revenue: paidRevenue,
      expenses: paidExpenses,
      balance: paidRevenue - paidExpenses,
      receivable: asaasReceivable + manualReceivable,
      overdue: filteredLancamentos
        .filter(
          (item) =>
            item.tipo === 'receita' &&
            item.status === 'pendente' &&
            item.data_vencimento &&
            item.data_vencimento < new Date().toISOString().slice(0, 10),
        )
        .reduce((sum, item) => sum + Number(item.valor), 0),
    }
  }, [filteredLancamentos, monthPayments])

  const chart = useMemo(() => {
    const revenue = Array.from({ length: 6 }, (_, index) => {
      const date = new Date()
      date.setMonth(date.getMonth() - (5 - index))
      const key = date.toISOString().slice(0, 7)

      const paymentRevenue = pagamentos
        .filter(
          (payment) =>
            monthKey(payment.created_at) === key &&
            isPaymentPaid(payment.status),
        )
        .reduce((sum, payment) => sum + Number(payment.valor), 0)

      const manualRevenue = lancamentos
        .filter(
          (item) =>
            item.tipo === 'receita' &&
            item.status === 'pago' &&
            monthKey(item.data_pagamento || item.data_vencimento || item.created_at) === key,
        )
        .reduce((sum, item) => sum + Number(item.valor), 0)

      const expenses = lancamentos
        .filter(
          (item) =>
            item.tipo === 'despesa' &&
            item.status === 'pago' &&
            monthKey(item.data_pagamento || item.data_vencimento || item.created_at) === key,
        )
        .reduce((sum, item) => sum + Number(item.valor), 0)

      return {
        key,
        label: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        revenue: paymentRevenue + manualRevenue,
        expenses,
      }
    })

    const max = Math.max(
      1,
      ...revenue.flatMap((item) => [item.revenue, item.expenses]),
    )

    return revenue.map((item) => ({
      ...item,
      revenueHeight: Math.max(4, (item.revenue / max) * 100),
      expensesHeight: Math.max(4, (item.expenses / max) * 100),
    }))
  }, [pagamentos, lancamentos])

  const paymentRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return monthPayments.filter((payment) => {
      const haystack = [
        getPaymentStudent(payment),
        getPaymentDescription(payment),
        payment.status,
      ]
        .join(' ')
        .toLowerCase()

      return !normalizedSearch || haystack.includes(normalizedSearch)
    })
  }, [monthPayments, search])

  const openNewModal = (tipo: TipoLancamento = 'receita') => {
    setEditingId(null)
    setForm({
      ...emptyForm,
      tipo,
      categoria: tipo === 'receita' ? 'Mensalidades' : 'Professores',
      data_vencimento: new Date().toISOString().slice(0, 10),
    })
    setError('')
    setModalOpen(true)
  }

  const openEditModal = (item: Lancamento) => {
    setEditingId(item.id)
    setForm({
      tipo: item.tipo,
      categoria: item.categoria,
      descricao: item.descricao,
      valor: String(item.valor).replace('.', ','),
      status: item.status,
      data_vencimento: item.data_vencimento ?? '',
      data_pagamento: item.data_pagamento ?? '',
      metodo_pagamento: item.metodo_pagamento ?? 'PIX',
      aluno_id: item.aluno_id ?? '',
      recorrente: item.recorrente,
      observacoes: item.observacoes ?? '',
    })
    setError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  const updateForm = <K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleTipoChange = (tipo: TipoLancamento) => {
    setForm((current) => ({
      ...current,
      tipo,
      categoria:
        tipo === 'receita' ? 'Mensalidades' : 'Professores',
    }))
  }

  const parseMoney = (value: string) => {
    const normalized = value
      .replace(/R\$/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^0-9.]/g, '')
    return Number(normalized)
  }

  async function handleSave() {
    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const valor = parseMoney(form.valor)

      if (!form.descricao.trim()) {
        throw new Error('Informe a descrição do lançamento.')
      }

      if (!valor || valor <= 0) {
        throw new Error('Informe um valor válido.')
      }

      if (!form.data_vencimento) {
        throw new Error('Informe a data de vencimento.')
      }

      const payload = {
        tipo: form.tipo,
        categoria: form.categoria,
        descricao: form.descricao.trim(),
        valor,
        status: form.status,
        data_vencimento: form.data_vencimento || null,
        data_pagamento:
          form.status === 'pago'
            ? form.data_pagamento || form.data_vencimento || null
            : null,
        metodo_pagamento: form.metodo_pagamento || null,
        aluno_id: form.aluno_id || null,
        recorrente: form.recorrente,
        observacoes: form.observacoes.trim() || null,
      }

      if (editingId) {
        const { error: updateError } = await supabase
          .from('lancamentos_financeiros')
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId)

        if (updateError) throw updateError
        setSuccess('Lançamento atualizado com sucesso.')
      } else {
        const {
          data: {
            user,
          },
        } = await supabase.auth.getUser()

        const { error: insertError } = await supabase
          .from('lancamentos_financeiros')
          .insert({
            ...payload,
            created_by: user?.id ?? null,
          })

        if (insertError) throw insertError
        setSuccess('Lançamento criado com sucesso.')
      }

      setModalOpen(false)
      setEditingId(null)
      setForm(emptyForm)
      await loadFinanceiro()
    } catch (err) {
      console.error('Erro ao salvar lançamento:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível salvar o lançamento.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: Lancamento) {
    if (
      !window.confirm(
        `Excluir o lançamento "${item.descricao}"? Esta ação não pode ser desfeita.`,
      )
    ) {
      return
    }

    try {
      setError('')
      const { error: deleteError } = await supabase
        .from('lancamentos_financeiros')
        .delete()
        .eq('id', item.id)

      if (deleteError) throw deleteError

      setSuccess('Lançamento excluído.')
      await loadFinanceiro()
    } catch (err) {
      console.error('Erro ao excluir lançamento:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível excluir o lançamento.',
      )
    }
  }

  async function generateRecurringEntries() {
    if (generatingRecurring) return

    const recurring = lancamentos.filter(
      (item) =>
        item.recorrente &&
        item.status !== 'cancelado',
    )

    if (!recurring.length) {
      setError('Não existem lançamentos recorrentes para gerar.')
      return
    }

    try {
      setGeneratingRecurring(true)
      setError('')
      setSuccess('')

      const existingKeys = new Set(
        lancamentos
          .filter(
            (item) =>
              monthKey(item.data_vencimento) === month &&
              (item.tipo === 'receita' || item.tipo === 'despesa'),
          )
          .map(
            (item) =>
              [
                item.categoria,
                item.descricao,
                item.aluno_id ?? '',
                item.data_vencimento ?? '',
              ].join('|'),
          ),
      )

      const targetDate = new Date(`${month}-01T12:00:00`)
      const targetYear = targetDate.getFullYear()
      const targetMonth = targetDate.getMonth()

      const payloads = recurring
        .map((item) => {
          const sourceDate = item.data_vencimento
            ? new Date(`${item.data_vencimento.slice(0, 10)}T12:00:00`)
            : new Date()

          const day = Math.min(
            sourceDate.getDate(),
            new Date(targetYear, targetMonth + 1, 0).getDate(),
          )

          const dueDate = new Date(
            targetYear,
            targetMonth,
            day,
            12,
            0,
            0,
          )

          const dueDateString = dueDate.toISOString().slice(0, 10)
          const key = [
            item.categoria,
            item.descricao,
            item.aluno_id ?? '',
            dueDateString,
          ].join('|')

          if (existingKeys.has(key)) {
            return null
          }

          existingKeys.add(key)

          return {
            tipo: item.tipo,
            categoria: item.categoria,
            descricao: item.descricao,
            valor: Number(item.valor),
            status: 'pendente' as StatusLancamento,
            data_vencimento: dueDateString,
            data_pagamento: null,
            metodo_pagamento: item.metodo_pagamento,
            aluno_id: item.aluno_id,
            recorrente: true,
            observacoes: item.observacoes,
          }
        })
        .filter(Boolean)

      if (!payloads.length) {
        setSuccess('Os lançamentos recorrentes deste período já estão gerados.')
        return
      }

      const { data: { user } } = await supabase.auth.getUser()

      const { error: insertError } = await supabase
        .from('lancamentos_financeiros')
        .insert(
          payloads.map((payload) => ({
            ...payload,
            created_by: user?.id ?? null,
          })),
        )

      if (insertError) throw insertError

      setSuccess(
        `${payloads.length} lançamento${payloads.length === 1 ? '' : 's'} recorrente${payloads.length === 1 ? '' : 's'} gerado${payloads.length === 1 ? '' : 's'} para ${monthLabel}.`,
      )

      await loadFinanceiro()
    } catch (err) {
      console.error('Erro ao gerar recorrentes:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível gerar os lançamentos recorrentes.',
      )
    } finally {
      setGeneratingRecurring(false)
    }
  }

  function exportCsv() {
    const rows = filteredLancamentos.map((item) => [
      item.tipo,
      item.categoria,
      item.descricao,
      item.valor.toFixed(2).replace('.', ','),
      item.status,
      item.data_vencimento ?? '',
      item.data_pagamento ?? '',
      item.metodo_pagamento ?? '',
      item.aluno?.nome_completo ?? '',
    ])

    const csv = [
      [
        'Tipo',
        'Categoria',
        'Descrição',
        'Valor',
        'Status',
        'Vencimento',
        'Pagamento',
        'Método',
        'Aluno',
      ],
      ...rows,
    ]
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(';'),
      )
      .join('\n')

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `financeiro-${month}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pendente: 'Pendente',
      processando: 'Processando',
      pago: 'Pago',
      recusado: 'Recusado',
      cancelado: 'Cancelado',
      expirado: 'Expirado',
    }
    return labels[status] ?? status
  }

  const categories =
    form.tipo === 'receita'
      ? CATEGORIAS_RECEITA
      : CATEGORIAS_DESPESA

  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString(
    'pt-BR',
    { month: 'long', year: 'numeric' },
  )

  return (
    <div className="financeiro-page">
      <div className="financeiro-heading">
        <div>
          <span className="financeiro-eyebrow">GESTÃO FINANCEIRA</span>
          <h2>Financeiro</h2>
          <p>
            Acompanhe receitas, despesas, pagamentos, pendências e fluxo de caixa da AB Academy. Gere automaticamente receitas e despesas recorrentes do período.
          </p>
        </div>

        <div className="financeiro-heading-actions">
          <button
            type="button"
            className="financeiro-secondary-button"
            onClick={loadFinanceiro}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'financeiro-spin' : ''} />
            Atualizar
          </button>
          <button
            type="button"
            className="financeiro-secondary-button"
            onClick={generateRecurringEntries}
            disabled={generatingRecurring || loading}
            title="Gerar receitas recorrentes para o mês selecionado"
          >
            <RefreshCw size={16} className={generatingRecurring ? 'financeiro-spin' : ''} />
            Gerar recorrentes
          </button>
          <button
            type="button"
            className="financeiro-secondary-button"
            onClick={exportCsv}
          >
            <Download size={16} />
            Exportar
          </button>
          <button
            type="button"
            className="financeiro-primary-button"
            onClick={() => openNewModal('receita')}
          >
            <Plus size={17} />
            Novo lançamento
          </button>
        </div>
      </div>

      {error && (
        <div className="financeiro-alert financeiro-alert-error">
          <AlertCircle size={17} />
          <span>{error}</span>
          <button type="button" onClick={() => setError('')}>
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="financeiro-alert financeiro-alert-success">
          <Check size={17} />
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess('')}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="financeiro-toolbar">
        <div className="financeiro-tabs">
          <button
            type="button"
            className={tab === 'visao-geral' ? 'active' : ''}
            onClick={() => setTab('visao-geral')}
          >
            Visão geral
          </button>
          <button
            type="button"
            className={tab === 'mensalidades' ? 'active' : ''}
            onClick={() => setTab('mensalidades')}
          >
            Mensalidades
          </button>
          <button
            type="button"
            className={tab === 'lancamentos' ? 'active' : ''}
            onClick={() => setTab('lancamentos')}
          >
            Lançamentos
          </button>
          <button
            type="button"
            className={tab === 'recebimentos' ? 'active' : ''}
            onClick={() => setTab('recebimentos')}
          >
            Recebimentos
          </button>
        </div>

        <label className="financeiro-month">
          <CalendarDays size={16} />
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </label>
      </div>

      {tab === 'visao-geral' && (
        <>
          <section className="financeiro-stats">
            <article className="financeiro-stat-card">
              <div className="financeiro-stat-top">
                <span>Receitas pagas</span>
                <span className="financeiro-stat-icon positive">
                  <ArrowUpRight size={18} />
                </span>
              </div>
              <strong>{formatCurrency(metrics.revenue)}</strong>
              <small>Pagamentos confirmados + receitas manuais</small>
            </article>

            <article className="financeiro-stat-card">
              <div className="financeiro-stat-top">
                <span>Despesas pagas</span>
                <span className="financeiro-stat-icon negative">
                  <ArrowDownRight size={18} />
                </span>
              </div>
              <strong>{formatCurrency(metrics.expenses)}</strong>
              <small>Despesas manuais quitadas no período</small>
            </article>

            <article className="financeiro-stat-card">
              <div className="financeiro-stat-top">
                <span>Saldo do período</span>
                <span className="financeiro-stat-icon neutral">
                  <Wallet size={18} />
                </span>
              </div>
              <strong className={metrics.balance >= 0 ? 'positive-text' : 'negative-text'}>
                {formatCurrency(metrics.balance)}
              </strong>
              <small>Receitas menos despesas pagas</small>
            </article>

            <article className="financeiro-stat-card">
              <div className="financeiro-stat-top">
                <span>A receber</span>
                <span className="financeiro-stat-icon warning">
                  <CircleDollarSign size={18} />
                </span>
              </div>
              <strong>{formatCurrency(metrics.receivable)}</strong>
              <small>{formatCurrency(metrics.overdue)} em atraso</small>
            </article>
          </section>

          <section className="financeiro-main-grid">
            <article className="financeiro-panel">
              <header className="financeiro-panel-header">
                <div>
                  <h3>Fluxo de caixa</h3>
                  <p>Últimos seis meses</p>
                </div>
                <TrendingUp size={20} />
              </header>

              <div className="financeiro-chart">
                {chart.map((item) => (
                  <div className="financeiro-chart-column" key={item.key}>
                    <div className="financeiro-chart-bars">
                      <div
                        className="financeiro-chart-bar revenue"
                        style={{ height: `${item.revenueHeight}%` }}
                        title={`Receitas: ${formatCurrency(item.revenue)}`}
                      />
                      <div
                        className="financeiro-chart-bar expenses"
                        style={{ height: `${item.expensesHeight}%` }}
                        title={`Despesas: ${formatCurrency(item.expenses)}`}
                      />
                    </div>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>

              <div className="financeiro-chart-legend">
                <span><i className="revenue" /> Receitas</span>
                <span><i className="expenses" /> Despesas</span>
              </div>
            </article>

            <article className="financeiro-panel">
              <header className="financeiro-panel-header">
                <div>
                  <h3>Resumo de recebimentos</h3>
                  <p>{monthLabel}</p>
                </div>
                <FileText size={20} />
              </header>

              <div className="financeiro-payment-summary">
                <div>
                  <span>Pagamentos registrados</span>
                  <strong>{monthPayments.length}</strong>
                </div>
                <div>
                  <span>Confirmados</span>
                  <strong>{monthPayments.filter((item) => item.status === 'pago').length}</strong>
                </div>
                <div>
                  <span>Em aberto</span>
                  <strong>{monthPayments.filter((item) => isPaymentOpen(item.status)).length}</strong>
                </div>
                <div>
                  <span>Cancelados/recusados</span>
                  <strong>
                    {monthPayments.filter((item) =>
                      ['cancelado', 'recusado', 'expirado'].includes(item.status),
                    ).length}
                  </strong>
                </div>
              </div>
            </article>
          </section>

          <section className="financeiro-panel">
            <header className="financeiro-panel-header">
              <div>
                <h3>Próximos vencimentos</h3>
                <p>Receitas e despesas pendentes</p>
              </div>
              <button
                type="button"
                className="financeiro-link-button"
                onClick={() => setTab('lancamentos')}
              >
                Ver lançamentos
              </button>
            </header>

            <div className="financeiro-due-list">
              {lancamentos
                .filter(
                  (item) =>
                    item.status === 'pendente' &&
                    item.data_vencimento &&
                    monthKey(item.data_vencimento) === month,
                )
                .slice(0, 6)
                .map((item) => (
                  <div className="financeiro-due-row" key={item.id}>
                    <div className={`financeiro-due-icon ${item.tipo}`}>
                      {item.tipo === 'receita' ? (
                        <ArrowUpRight size={16} />
                      ) : (
                        <ArrowDownRight size={16} />
                      )}
                    </div>
                    <div className="financeiro-due-main">
                      <strong>{item.descricao}</strong>
                      <span>
                        {item.aluno?.nome_completo || item.categoria}
                      </span>
                    </div>
                    <div className="financeiro-due-date">
                      <span>Vencimento</span>
                      <strong>{formatDate(item.data_vencimento)}</strong>
                    </div>
                    <strong className={item.tipo === 'receita' ? 'positive-text' : 'negative-text'}>
                      {item.tipo === 'receita' ? '+' : '-'} {formatCurrency(Number(item.valor))}
                    </strong>
                  </div>
                ))}

              {lancamentos.filter(
                (item) =>
                  item.status === 'pendente' &&
                  item.data_vencimento &&
                  monthKey(item.data_vencimento) === month,
              ).length === 0 && (
                <div className="financeiro-empty-inline">
                  Nenhum lançamento pendente para este mês.
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {tab === 'mensalidades' && (
        <Mensalidades />
      )}

      {tab === 'lancamentos' && (
        <section className="financeiro-panel financeiro-table-panel">
          <header className="financeiro-panel-header financeiro-table-header">
            <div>
              <h3>Lançamentos financeiros</h3>
              <p>Receitas e despesas cadastradas manualmente.</p>
            </div>

            <button
              type="button"
              className="financeiro-primary-button"
              onClick={() => openNewModal('despesa')}
            >
              <Plus size={16} />
              Registrar despesa
            </button>
          </header>

          <div className="financeiro-filters">
            <label className="financeiro-search">
              <Search size={16} />
              <input
                type="search"
                placeholder="Buscar lançamento..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <label className="financeiro-select">
              <Filter size={15} />
              <select
                value={filterTipo}
                onChange={(event) =>
                  setFilterTipo(event.target.value as 'todos' | TipoLancamento)
                }
              >
                <option value="todos">Todos os tipos</option>
                <option value="receita">Receitas</option>
                <option value="despesa">Despesas</option>
              </select>
              <ChevronDown size={14} />
            </label>

            <label className="financeiro-select">
              <select
                value={filterStatus}
                onChange={(event) =>
                  setFilterStatus(event.target.value as 'todos' | StatusLancamento)
                }
              >
                <option value="todos">Todos os status</option>
                <option value="pendente">Pendentes</option>
                <option value="pago">Pagos</option>
                <option value="cancelado">Cancelados</option>
              </select>
              <ChevronDown size={14} />
            </label>
          </div>

          {loading ? (
            <div className="financeiro-loading">Carregando lançamentos...</div>
          ) : filteredLancamentos.length === 0 ? (
            <div className="financeiro-empty">
              <CircleDollarSign size={28} />
              <h3>Nenhum lançamento encontrado</h3>
              <p>Cadastre receitas ou despesas para começar a controlar o caixa.</p>
              <button
                type="button"
                className="financeiro-primary-button"
                onClick={() => openNewModal('receita')}
              >
                <Plus size={16} />
                Novo lançamento
              </button>
            </div>
          ) : (
            <div className="financeiro-table-wrap">
              <table className="financeiro-table">
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Vencimento</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLancamentos.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="financeiro-description-cell">
                          <strong>{item.descricao}</strong>
                          <span>{item.aluno?.nome_completo || item.observacoes || '—'}</span>
                        </div>
                      </td>
                      <td>{item.categoria}</td>
                      <td>{formatDate(item.data_vencimento)}</td>
                      <td>
                        <strong className={item.tipo === 'receita' ? 'positive-text' : 'negative-text'}>
                          {item.tipo === 'receita' ? '+' : '-'} {formatCurrency(Number(item.valor))}
                        </strong>
                      </td>
                      <td>
                        <span className={`financeiro-status ${item.status}`}>
                          {statusLabel(item.status)}
                        </span>
                      </td>
                      <td>
                        <div className="financeiro-row-actions">
                          <button
                            type="button"
                            className="financeiro-icon-button"
                            onClick={() => openEditModal(item)}
                            title="Editar lançamento"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            className="financeiro-icon-button danger"
                            onClick={() => handleDelete(item)}
                            title="Excluir lançamento"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'recebimentos' && (
        <section className="financeiro-panel financeiro-table-panel">
          <header className="financeiro-panel-header financeiro-table-header">
            <div>
              <h3>Recebimentos</h3>
              <p>Pagamentos originados pelo checkout e processados pelo Asaas.</p>
            </div>
            <span className="financeiro-asaas-badge">ASAAS</span>
          </header>

          <div className="financeiro-filters">
            <label className="financeiro-search">
              <Search size={16} />
              <input
                type="search"
                placeholder="Buscar aluno ou plano..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>

          {loading ? (
            <div className="financeiro-loading">Carregando recebimentos...</div>
          ) : paymentRows.length === 0 ? (
            <div className="financeiro-empty">
              <CircleDollarSign size={28} />
              <h3>Nenhum recebimento neste período</h3>
              <p>Os pagamentos realizados pelo checkout aparecerão aqui automaticamente.</p>
            </div>
          ) : (
            <div className="financeiro-table-wrap">
              <table className="financeiro-table">
                <thead>
                  <tr>
                    <th>Aluno</th>
                    <th>Plano</th>
                    <th>Data</th>
                    <th>Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentRows.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <div className="financeiro-description-cell">
                          <strong>{getPaymentStudent(payment)}</strong>
                          <span>{payment.id}</span>
                        </div>
                      </td>
                      <td>{getPaymentDescription(payment)}</td>
                      <td>{formatDate(payment.created_at)}</td>
                      <td>
                        <strong className="positive-text">
                          {formatCurrency(Number(payment.valor))}
                        </strong>
                      </td>
                      <td>
                        <span className={`financeiro-status payment-${payment.status}`}>
                          {statusLabel(payment.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {modalOpen && (
        <div
          className="financeiro-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal()
          }}
        >
          <div className="financeiro-modal">
            <header className="financeiro-modal-header">
              <div>
                <span className="financeiro-eyebrow">LANÇAMENTO</span>
                <h2>{editingId ? 'Editar lançamento' : 'Novo lançamento'}</h2>
                <p>Registre uma receita ou despesa da AB Academy.</p>
              </div>
              <button
                type="button"
                className="financeiro-modal-close"
                onClick={closeModal}
                disabled={saving}
              >
                <X size={19} />
              </button>
            </header>

            <div className="financeiro-modal-body">
              <div className="financeiro-type-toggle">
                <button
                  type="button"
                  className={form.tipo === 'receita' ? 'active receita' : ''}
                  onClick={() => handleTipoChange('receita')}
                  disabled={saving}
                >
                  <TrendingUp size={16} />
                  Receita
                </button>
                <button
                  type="button"
                  className={form.tipo === 'despesa' ? 'active despesa' : ''}
                  onClick={() => handleTipoChange('despesa')}
                  disabled={saving}
                >
                  <TrendingDown size={16} />
                  Despesa
                </button>
              </div>

              <div className="financeiro-form-grid">
                <label className="financeiro-field financeiro-field-full">
                  <span>Descrição *</span>
                  <input
                    type="text"
                    value={form.descricao}
                    onChange={(event) => updateForm('descricao', event.target.value)}
                    placeholder={
                      form.tipo === 'receita'
                        ? 'Ex.: Mensalidade - João Silva'
                        : 'Ex.: Pagamento professor'
                    }
                    disabled={saving}
                  />
                </label>

                <label className="financeiro-field">
                  <span>Categoria *</span>
                  <select
                    value={form.categoria}
                    onChange={(event) => updateForm('categoria', event.target.value)}
                    disabled={saving}
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="financeiro-field">
                  <span>Valor *</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.valor}
                    onChange={(event) => updateForm('valor', event.target.value)}
                    placeholder="0,00"
                    disabled={saving}
                  />
                </label>

                <label className="financeiro-field">
                  <span>Vencimento *</span>
                  <input
                    type="date"
                    value={form.data_vencimento}
                    onChange={(event) => updateForm('data_vencimento', event.target.value)}
                    disabled={saving}
                  />
                </label>

                <label className="financeiro-field">
                  <span>Status</span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateForm('status', event.target.value as StatusLancamento)
                    }
                    disabled={saving}
                  >
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </label>

                <label className="financeiro-field">
                  <span>Data do pagamento</span>
                  <input
                    type="date"
                    value={form.data_pagamento}
                    onChange={(event) => updateForm('data_pagamento', event.target.value)}
                    disabled={saving || form.status !== 'pago'}
                  />
                </label>

                <label className="financeiro-field">
                  <span>Método de pagamento</span>
                  <select
                    value={form.metodo_pagamento}
                    onChange={(event) => updateForm('metodo_pagamento', event.target.value)}
                    disabled={saving}
                  >
                    <option value="PIX">PIX</option>
                    <option value="Cartão">Cartão</option>
                    <option value="Transferência">Transferência</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Outro">Outro</option>
                  </select>
                </label>

                {form.tipo === 'receita' && (
                  <label className="financeiro-field">
                    <span>Aluno</span>
                    <select
                      value={form.aluno_id}
                      onChange={(event) => updateForm('aluno_id', event.target.value)}
                      disabled={saving}
                    >
                      <option value="">Não vincular</option>
                      {alunos.map((aluno) => (
                        <option key={aluno.id} value={aluno.id}>
                          {aluno.nome_completo || 'Aluno sem nome'}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="financeiro-field financeiro-field-full">
                  <span>Observações</span>
                  <textarea
                    rows={3}
                    value={form.observacoes}
                    onChange={(event) => updateForm('observacoes', event.target.value)}
                    placeholder="Informações adicionais..."
                    disabled={saving}
                  />
                </label>

                <label className="financeiro-check">
                  <input
                    type="checkbox"
                    checked={form.recorrente}
                    onChange={(event) => updateForm('recorrente', event.target.checked)}
                    disabled={saving}
                  />
                  <span>Este lançamento é recorrente</span>
                </label>
              </div>
            </div>

            <footer className="financeiro-modal-footer">
              <button
                type="button"
                className="financeiro-secondary-button"
                onClick={closeModal}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="financeiro-primary-button"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="financeiro-button-spinner" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    {editingId ? 'Salvar alterações' : 'Salvar lançamento'}
                  </>
                )}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
