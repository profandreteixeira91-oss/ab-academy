import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, Edit3, Plus, Search, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import '../../styles/admin/Mensalidades.css'

type StatusMensalidade = 'pendente' | 'pago' | 'vencido' | 'cancelado'

type Mensalidade = {
  id: string
  aluno_id: string
  plano_id: string | null
  competencia: string
  numero_parcela: number | null
  total_parcelas: number | null
  valor: number
  data_vencimento: string
  data_pagamento: string | null
  status: StatusMensalidade
  metodo_pagamento: string | null
  pagamento_id: string | null
  observacoes: string | null
  aluno?: { nome_completo: string | null } | null
  plano?: { nome: string | null } | null
}

type Aluno = { id: string; nome_completo: string | null }
type Plano = { id: string; nome: string; preco: number; ativo: boolean }

type FormState = {
  aluno_id: string
  plano_id: string
  competencia: string
  numero_parcela: string
  total_parcelas: string
  valor: string
  data_vencimento: string
  status: StatusMensalidade
  data_pagamento: string
  metodo_pagamento: string
  observacoes: string
}

const emptyForm: FormState = {
  aluno_id: '',
  plano_id: '',
  competencia: new Date().toISOString().slice(0, 7) + '-01',
  numero_parcela: '',
  total_parcelas: '',
  valor: '',
  data_vencimento: '',
  status: 'pendente',
  data_pagamento: '',
  metodo_pagamento: 'PIX',
  observacoes: '',
}

function money(value: number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function date(value: string | null) {
  if (!value) return '—'
  const [y, m, d] = value.slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : '—'
}
function monthKey(value: string) {
  return value.slice(0, 7)
}
function monthLabel(value: string) {
  return new Date(`${value}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
function parseMoney(value: string) {
  return Number(value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, ''))
}

export default function Mensalidades() {
  const [items, setItems] = useState<Mensalidade[]>([])
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [planos, setPlanos] = useState<Plano[]>([])
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'todos' | StatusMensalidade>('todos')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function load() {
    try {
      setLoading(true)
      setError('')
      const [m, a, p] = await Promise.all([
        supabase.from('mensalidades').select('id, aluno_id, plano_id, competencia, numero_parcela, total_parcelas, valor, data_vencimento, data_pagamento, status, metodo_pagamento, pagamento_id, observacoes, aluno:alunos(nome_completo), plano:planos(nome)').order('data_vencimento', { ascending: true }),
        supabase.from('alunos').select('id, nome_completo').order('nome_completo'),
        supabase.from('planos').select('id, nome, preco, ativo').eq('ativo', true).order('nome'),
      ])
      if (m.error) throw m.error
      if (a.error) throw a.error
      if (p.error) throw p.error
      setItems((m.data ?? []) as Mensalidade[])
      setAlunos((a.data ?? []) as Aluno[])
      setPlanos((p.data ?? []) as Plano[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar as mensalidades.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      const matchesMonth = monthKey(item.competencia) === month
      const matchesStatus = status === 'todos' || item.status === status
      const text = [item.aluno?.nome_completo ?? '', item.plano?.nome ?? '', item.observacoes ?? ''].join(' ').toLowerCase()
      return matchesMonth && matchesStatus && (!q || text.includes(q))
    })
  }, [items, month, search, status])

  const stats = useMemo(() => ({
    total: filtered.reduce((s, i) => s + Number(i.valor), 0),
    paid: filtered.filter(i => i.status === 'pago').reduce((s, i) => s + Number(i.valor), 0),
    open: filtered.filter(i => i.status === 'pendente' || i.status === 'vencido').reduce((s, i) => s + Number(i.valor), 0),
    overdue: filtered.filter(i => i.status === 'vencido' || (i.status === 'pendente' && i.data_vencimento < new Date().toISOString().slice(0, 10))).reduce((s, i) => s + Number(i.valor), 0),
  }), [filtered])

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm(current => ({ ...current, [field]: value }))
  }

  function openNew() {
    const today = new Date()
    const currentMonth = today.toISOString().slice(0, 7)
    setEditingId(null)
    setForm({ ...emptyForm, competencia: currentMonth + '-01', data_vencimento: today.toISOString().slice(0, 10) })
    setError('')
    setModalOpen(true)
  }

  function openEdit(item: Mensalidade) {
    setEditingId(item.id)
    setForm({
      aluno_id: item.aluno_id,
      plano_id: item.plano_id ?? '',
      competencia: item.competencia.slice(0, 10),
      numero_parcela: item.numero_parcela ? String(item.numero_parcela) : '',
      total_parcelas: item.total_parcelas ? String(item.total_parcelas) : '',
      valor: String(item.valor).replace('.', ','),
      data_vencimento: item.data_vencimento,
      status: item.status,
      data_pagamento: item.data_pagamento ?? '',
      metodo_pagamento: item.metodo_pagamento ?? 'PIX',
      observacoes: item.observacoes ?? '',
    })
    setError('')
    setModalOpen(true)
  }

  function close() {
    if (saving) return
    setModalOpen(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function selectPlan(id: string) {
    const plan = planos.find(p => p.id === id)
    setForm(current => ({ ...current, plano_id: id, valor: plan ? String(plan.preco).replace('.', ',') : current.valor }))
  }

  async function save() {
    try {
      setSaving(true); setError(''); setSuccess('')
      const valor = parseMoney(form.valor)
      if (!form.aluno_id) throw new Error('Selecione o aluno.')
      if (!form.competencia) throw new Error('Informe a competência.')
      if (!form.data_vencimento) throw new Error('Informe o vencimento.')
      if (!valor || valor <= 0) throw new Error('Informe um valor válido.')

      const payload = {
        aluno_id: form.aluno_id,
        plano_id: form.plano_id || null,
        competencia: form.competencia,
        numero_parcela: form.numero_parcela ? Number(form.numero_parcela) : null,
        total_parcelas: form.total_parcelas ? Number(form.total_parcelas) : null,
        valor,
        data_vencimento: form.data_vencimento,
        status: form.status,
        data_pagamento: form.status === 'pago' ? (form.data_pagamento || form.data_vencimento) : null,
        metodo_pagamento: form.metodo_pagamento || null,
        observacoes: form.observacoes.trim() || null,
      }

      if (editingId) {
        const { error: e } = await supabase.from('mensalidades').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId)
        if (e) throw e
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { error: e } = await supabase.from('mensalidades').insert({ ...payload, created_by: user?.id ?? null })
        if (e) throw e
      }

      setSuccess(editingId ? 'Mensalidade atualizada.' : 'Mensalidade criada.')
      close()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar a mensalidade.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: Mensalidade) {
    if (!window.confirm(`Excluir a mensalidade de ${item.aluno?.nome_completo || 'este aluno'}?`)) return
    const { error: e } = await supabase.from('mensalidades').delete().eq('id', item.id)
    if (e) { setError(e.message); return }
    setSuccess('Mensalidade excluída.')
    await load()
  }

  async function markOverdue() {
    const today = new Date().toISOString().slice(0, 10)
    const overdue = items.filter(i => i.status === 'pendente' && i.data_vencimento < today)
    if (!overdue.length) { setSuccess('Nenhuma mensalidade pendente vencida encontrada.'); return }
    const { error: e } = await supabase.from('mensalidades').update({ status: 'vencido', updated_at: new Date().toISOString() }).in('id', overdue.map(i => i.id))
    if (e) { setError(e.message); return }
    setSuccess(`${overdue.length} mensalidade${overdue.length === 1 ? '' : 's'} marcada${overdue.length === 1 ? '' : 's'} como vencida.`)
    await load()
  }

  return (
    <div className="mensalidades-page">
      <header className="mensalidades-header">
        <div>
          <span className="mensalidades-eyebrow">CONTAS A RECEBER</span>
          <h2>Mensalidades</h2>
          <p>Controle os vencimentos, pagamentos e inadimplência por aluno.</p>
        </div>
        <div className="mensalidades-actions">
          <button type="button" className="mensalidades-secondary" onClick={markOverdue}><CalendarDays size={16}/> Atualizar vencidos</button>
          <button type="button" className="mensalidades-primary" onClick={openNew}><Plus size={17}/> Nova mensalidade</button>
        </div>
      </header>

      {error && <div className="mensalidades-alert error">{error}<button type="button" onClick={() => setError('')}><X size={15}/></button></div>}
      {success && <div className="mensalidades-alert success">{success}<button type="button" onClick={() => setSuccess('')}><X size={15}/></button></div>}

      <section className="mensalidades-stats">
        <div><span>Total do mês</span><strong>{money(stats.total)}</strong></div>
        <div><span>Recebido</span><strong>{money(stats.paid)}</strong></div>
        <div><span>Em aberto</span><strong>{money(stats.open)}</strong></div>
        <div><span>Vencido</span><strong>{money(stats.overdue)}</strong></div>
      </section>

      <div className="mensalidades-toolbar">
        <label><Search size={16}/><input placeholder="Buscar aluno..." value={search} onChange={e => setSearch(e.target.value)}/></label>
        <label><CalendarDays size={16}/><input type="month" value={month} onChange={e => setMonth(e.target.value)}/></label>
        <select value={status} onChange={e => setStatus(e.target.value as 'todos' | StatusMensalidade)}>
          <option value="todos">Todos os status</option>
          <option value="pendente">Pendentes</option>
          <option value="pago">Pagas</option>
          <option value="vencido">Vencidas</option>
          <option value="cancelado">Canceladas</option>
        </select>
      </div>

      <section className="mensalidades-table-card">
        {loading ? <div className="mensalidades-empty">Carregando mensalidades...</div> : filtered.length === 0 ? (
          <div className="mensalidades-empty"><CalendarDays size={28}/><h3>Nenhuma mensalidade encontrada</h3><p>Cadastre a primeira mensalidade para este período.</p><button type="button" className="mensalidades-primary" onClick={openNew}><Plus size={16}/> Nova mensalidade</button></div>
        ) : (
          <div className="mensalidades-table-wrap"><table><thead><tr><th>Aluno</th><th>Plano</th><th>Competência</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>
            {filtered.map(item => (
              <tr key={item.id}>
                <td><strong>{item.aluno?.nome_completo || 'Aluno'}</strong></td>
                <td>{item.plano?.nome || '—'}</td>
                <td>{monthLabel(item.competencia.slice(0, 7))}</td>
                <td>{date(item.data_vencimento)}</td>
                <td><strong>{money(Number(item.valor))}</strong>{item.numero_parcela && item.total_parcelas ? <small>{item.numero_parcela}/{item.total_parcelas}</small> : null}</td>
                <td><span className={`mensalidades-status ${item.status}`}>{item.status === 'vencido' ? 'Vencida' : item.status === 'pago' ? 'Paga' : item.status === 'cancelado' ? 'Cancelada' : 'Pendente'}</span></td>
                <td><div className="mensalidades-row-actions"><button type="button" onClick={() => openEdit(item)} title="Editar"><Edit3 size={15}/></button><button type="button" className="danger" onClick={() => remove(item)} title="Excluir"><Trash2 size={15}/></button></div></td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </section>

      {modalOpen && <div className="mensalidades-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) close() }}>
        <div className="mensalidades-modal">
          <header><div><span className="mensalidades-eyebrow">CONTAS A RECEBER</span><h2>{editingId ? 'Editar mensalidade' : 'Nova mensalidade'}</h2></div><button type="button" onClick={close} disabled={saving}><X size={18}/></button></header>
          <div className="mensalidades-form">
            <label><span>Aluno *</span><select value={form.aluno_id} onChange={e => setField('aluno_id', e.target.value)} disabled={saving}><option value="">Selecione</option>{alunos.map(a => <option key={a.id} value={a.id}>{a.nome_completo || 'Aluno sem nome'}</option>)}</select></label>
            <label><span>Plano</span><select value={form.plano_id} onChange={e => selectPlan(e.target.value)} disabled={saving}><option value="">Sem plano</option>{planos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
            <label><span>Competência *</span><input type="month" value={form.competencia.slice(0, 7)} onChange={e => setField('competencia', e.target.value + '-01')} disabled={saving}/></label>
            <label><span>Vencimento *</span><input type="date" value={form.data_vencimento} onChange={e => setField('data_vencimento', e.target.value)} disabled={saving}/></label>
            <label><span>Valor *</span><input value={form.valor} inputMode="decimal" placeholder="0,00" onChange={e => setField('valor', e.target.value)} disabled={saving}/></label>
            <label><span>Método</span><select value={form.metodo_pagamento} onChange={e => setField('metodo_pagamento', e.target.value)} disabled={saving}><option>PIX</option><option>Cartão</option><option>Boleto</option><option>Transferência</option><option>Dinheiro</option><option>Outro</option></select></label>
            <label><span>Parcela</span><input type="number" min="1" value={form.numero_parcela} onChange={e => setField('numero_parcela', e.target.value)} disabled={saving}/></label>
            <label><span>Total de parcelas</span><input type="number" min="1" value={form.total_parcelas} onChange={e => setField('total_parcelas', e.target.value)} disabled={saving}/></label>
            <label><span>Status</span><select value={form.status} onChange={e => setField('status', e.target.value as StatusMensalidade)} disabled={saving}><option value="pendente">Pendente</option><option value="pago">Paga</option><option value="vencido">Vencida</option><option value="cancelado">Cancelada</option></select></label>
            <label><span>Data do pagamento</span><input type="date" value={form.data_pagamento} onChange={e => setField('data_pagamento', e.target.value)} disabled={saving || form.status !== 'pago'}/></label>
            <label className="full"><span>Observações</span><textarea rows={3} value={form.observacoes} onChange={e => setField('observacoes', e.target.value)} disabled={saving}/></label>
          </div>
          <footer><button type="button" className="mensalidades-secondary" onClick={close} disabled={saving}>Cancelar</button><button type="button" className="mensalidades-primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : <><Check size={16}/> Salvar mensalidade</>}</button></footer>
        </div>
      </div>}
    </div>
  )
}
