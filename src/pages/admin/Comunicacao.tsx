import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, MessageSquare, Search, Send, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import '../../styles/admin/Comunicacao.css'

type Status = 'aberta' | 'em_andamento' | 'respondida' | 'fechada'
type Prioridade = 'baixa' | 'normal' | 'alta'

type Solicitacao = {
  id: string
  aluno_id: string
  assunto: string
  categoria: string
  prioridade: Prioridade
  status: Status
  created_at: string
  updated_at: string
  aluno?: { nome_completo: string | null; email: string | null } | null
}

type Mensagem = {
  id: string
  solicitacao_id: string
  remetente_tipo: 'aluno' | 'admin'
  remetente_id: string | null
  mensagem: string
  created_at: string
}

const statusLabels: Record<Status, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  respondida: 'Respondida',
  fechada: 'Fechada',
}

const categoryLabels: Record<string, string> = {
  financeiro: 'Financeiro',
  aulas: 'Aulas',
  atividades: 'Atividades',
  materiais: 'Materiais',
  cadastro: 'Cadastro',
  suporte: 'Suporte',
  outros: 'Outros',
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export default function Comunicacao() {
  const [items, setItems] = useState<Solicitacao[]>([])
  const [messages, setMessages] = useState<Mensagem[]>([])
  const [selected, setSelected] = useState<Solicitacao | null>(null)
  const [reply, setReply] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'todos' | Status>('todos')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function load() {
    try {
      setLoading(true)
      setError('')
      const { data, error: e } = await supabase
        .from('solicitacoes')
        .select('id, aluno_id, assunto, categoria, prioridade, status, created_at, updated_at, aluno:alunos(nome_completo, email)')
        .order('updated_at', { ascending: false })
      if (e) throw e
      setItems((data ?? []) as Solicitacao[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar as solicitações.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function open(item: Solicitacao) {
    setSelected(item)
    setReply('')
    setError('')
    const { data, error: e } = await supabase
      .from('solicitacao_mensagens')
      .select('id, solicitacao_id, remetente_tipo, remetente_id, mensagem, created_at')
      .eq('solicitacao_id', item.id)
      .order('created_at', { ascending: true })
    if (e) { setError(e.message); return }
    setMessages((data ?? []) as Mensagem[])
  }

  async function sendReply() {
    if (!selected || !reply.trim() || sending) return
    try {
      setSending(true); setError(''); setSuccess('')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessão administrativa não encontrada.')

      const { error: messageError } = await supabase
        .from('solicitacao_mensagens')
        .insert({
          solicitacao_id: selected.id,
          remetente_tipo: 'admin',
          remetente_id: user.id,
          mensagem: reply.trim(),
        })
      if (messageError) throw messageError

      const { error: statusError } = await supabase
        .from('solicitacoes')
        .update({ status: 'respondida' })
        .eq('id', selected.id)
      if (statusError) throw statusError

      setReply('')
      setSuccess('Resposta enviada ao aluno.')
      await open({ ...selected, status: 'respondida' })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível enviar a resposta.')
    } finally {
      setSending(false)
    }
  }

  async function changeStatus(status: Status) {
    if (!selected) return
    const { error: e } = await supabase.from('solicitacoes').update({ status }).eq('id', selected.id)
    if (e) { setError(e.message); return }
    setSelected({ ...selected, status })
    setItems(current => current.map(item => item.id === selected.id ? { ...item, status } : item))
    setSuccess('Status atualizado.')
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(item => {
      const matchesStatus = filter === 'todos' || item.status === filter
      const text = [item.assunto, item.aluno?.nome_completo ?? '', item.aluno?.email ?? '', categoryLabels[item.categoria] ?? item.categoria].join(' ').toLowerCase()
      return matchesStatus && (!q || text.includes(q))
    })
  }, [items, search, filter])

  const counts = useMemo(() => ({
    abertas: items.filter(i => i.status === 'aberta').length,
    andamento: items.filter(i => i.status === 'em_andamento').length,
    respondidas: items.filter(i => i.status === 'respondida').length,
    fechadas: items.filter(i => i.status === 'fechada').length,
  }), [items])

  return (
    <div className="comunicacao-page">
      <header className="comunicacao-header">
        <div>
          <span className="comunicacao-eyebrow">ATENDIMENTO AO ALUNO</span>
          <h2>Comunicação</h2>
          <p>Receba, acompanhe e responda às solicitações dos alunos.</p>
        </div>
      </header>

      {error && <div className="comunicacao-alert error">{error}<button type="button" onClick={() => setError('')}><X size={15}/></button></div>}
      {success && <div className="comunicacao-alert success">{success}<button type="button" onClick={() => setSuccess('')}><Check size={15}/></button></div>}

      <section className="comunicacao-stats">
        <div><span>Abertas</span><strong>{counts.abertas}</strong></div>
        <div><span>Em andamento</span><strong>{counts.andamento}</strong></div>
        <div><span>Respondidas</span><strong>{counts.respondidas}</strong></div>
        <div><span>Fechadas</span><strong>{counts.fechadas}</strong></div>
      </section>

      <section className="comunicacao-layout">
        <div className="comunicacao-list-card">
          <div className="comunicacao-list-toolbar">
            <label><Search size={16}/><input placeholder="Buscar solicitação..." value={search} onChange={e => setSearch(e.target.value)}/></label>
            <select value={filter} onChange={e => setFilter(e.target.value as 'todos' | Status)}>
              <option value="todos">Todos os status</option>
              <option value="aberta">Abertas</option>
              <option value="em_andamento">Em andamento</option>
              <option value="respondida">Respondidas</option>
              <option value="fechada">Fechadas</option>
            </select>
          </div>

          {loading ? <div className="comunicacao-empty">Carregando solicitações...</div> : filtered.length === 0 ? (
            <div className="comunicacao-empty"><MessageSquare size={28}/><h3>Nenhuma solicitação</h3><p>As solicitações enviadas pelos alunos aparecerão aqui.</p></div>
          ) : filtered.map(item => (
            <button type="button" className={`comunicacao-ticket ${selected?.id === item.id ? 'active' : ''}`} key={item.id} onClick={() => void open(item)}>
              <div className="comunicacao-ticket-top"><strong>{item.assunto}</strong><span className={`comunicacao-status ${item.status}`}>{statusLabels[item.status]}</span></div>
              <div className="comunicacao-ticket-student">{item.aluno?.nome_completo || 'Aluno'} · {categoryLabels[item.categoria] || item.categoria}</div>
              <div className="comunicacao-ticket-bottom"><span>{formatDate(item.updated_at)}</span><span className={`comunicacao-priority ${item.prioridade}`}>{item.prioridade}</span></div>
            </button>
          ))}
        </div>

        <div className="comunicacao-thread-card">
          {!selected ? (
            <div className="comunicacao-empty"><MessageSquare size={32}/><h3>Selecione uma solicitação</h3><p>A conversa com o aluno será exibida aqui.</p></div>
          ) : (
            <>
              <header className="comunicacao-thread-header">
                <div><span>{categoryLabels[selected.categoria] || selected.categoria}</span><h3>{selected.assunto}</h3><p>{selected.aluno?.nome_completo || 'Aluno'} · {selected.aluno?.email || ''}</p></div>
                <label><span>Status</span><select value={selected.status} onChange={e => void changeStatus(e.target.value as Status)}><option value="aberta">Aberta</option><option value="em_andamento">Em andamento</option><option value="respondida">Respondida</option><option value="fechada">Fechada</option></select><ChevronDown size={13}/></label>
              </header>

              <div className="comunicacao-messages">
                {messages.map(message => (
                  <div className={`comunicacao-message ${message.remetente_tipo}`} key={message.id}>
                    <span>{message.remetente_tipo === 'admin' ? 'AB Academy' : selected.aluno?.nome_completo || 'Aluno'}</span>
                    <p>{message.mensagem}</p>
                    <small>{formatDate(message.created_at)}</small>
                  </div>
                ))}
              </div>

              <footer className="comunicacao-reply">
                <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Digite a resposta para o aluno..." rows={3} disabled={selected.status === 'fechada' || sending}/>
                <button type="button" onClick={() => void sendReply()} disabled={!reply.trim() || selected.status === 'fechada' || sending}><Send size={16}/>{sending ? 'Enviando...' : 'Responder'}</button>
              </footer>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
