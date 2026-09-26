import { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Mail,
  MessageCircle,
  Phone,
  Save,
  Search,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Lead = {
  id: string
  nome: string
  empresa: string
  cargo: string | null
  email: string
  telefone: string | null
  colaboradores: string | null
  idiomas: string[]
  objetivo: string | null
  mensagem: string | null
  status: string
  observacoes: string | null
  created_at: string
}

type LeadHistory = {
  id: string
  lead_id: string
  status: string
  observacao: string | null
  created_at: string
}

const statusOptions = [
  ['novo', 'Novo'], ['contatado', 'Contatado'], ['diagnostico', 'Diagnóstico'],
  ['proposta_enviada', 'Proposta enviada'], ['negociacao', 'Negociação'],
  ['contratado', 'Contratado'], ['perdido', 'Perdido'],
]

function statusLabel(status: string) {
  return statusOptions.find(([value]) => value === status)?.[1] || status
}

export default function EnterpriseLeads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [history, setHistory] = useState<LeadHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('todos')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [observationDrafts, setObservationDrafts] = useState<Record<string, string>>({})
  const [savingObservationId, setSavingObservationId] = useState<string | null>(null)

  useEffect(() => { void loadLeads() }, [])

  async function loadLeads() {
    setLoading(true)

    const [leadsResult, historyResult] = await Promise.all([
      supabase.from('enterprise_leads').select('*').order('created_at', { ascending: false }),
      supabase.from('enterprise_lead_history').select('*').order('created_at', { ascending: false }),
    ])

    if (leadsResult.error) {
      console.error('Erro ao carregar leads Enterprise:', leadsResult.error)
      setLeads([])
    } else {
      const nextLeads = (leadsResult.data || []) as Lead[]
      setLeads(nextLeads)
      setObservationDrafts(Object.fromEntries(nextLeads.map((lead) => [lead.id, lead.observacoes || ''])))
    }

    if (historyResult.error) {
      console.error('Erro ao carregar histórico Enterprise:', historyResult.error)
      setHistory([])
    } else {
      setHistory((historyResult.data || []) as LeadHistory[])
    }

    setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    setSavingId(id)

    const { error } = await supabase.from('enterprise_leads').update({
      status,
      updated_at: new Date().toISOString(),
      ...(status === 'contatado' ? { contacted_at: new Date().toISOString() } : {}),
    }).eq('id', id)

    if (error) {
      console.error('Erro ao atualizar lead Enterprise:', error)
    } else {
      setLeads((current) => current.map((lead) => lead.id === id ? { ...lead, status } : lead))

      const { data: newHistory } = await supabase
        .from('enterprise_lead_history')
        .select('*')
        .eq('lead_id', id)
        .order('created_at', { ascending: false })

      if (newHistory) {
        setHistory((current) => [
          ...current.filter((item) => item.lead_id !== id),
          ...(newHistory as LeadHistory[]),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
      }
    }

    setSavingId(null)
  }

  async function saveObservation(lead: Lead) {
    const observation = observationDrafts[lead.id]?.trim() || null
    setSavingObservationId(lead.id)

    const { error } = await supabase.from('enterprise_leads').update({
      observacoes: observation,
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id)

    if (error) {
      console.error('Erro ao salvar observação Enterprise:', error)
      setSavingObservationId(null)
      return
    }

    if (observation) {
      const { data: historyEntry } = await supabase
        .from('enterprise_lead_history')
        .insert({
          lead_id: lead.id,
          status: lead.status,
          observacao: observation,
        })
        .select('*')
        .single()

      if (historyEntry) {
        setHistory((current) => [historyEntry as LeadHistory, ...current])
      }
    }

    setLeads((current) => current.map((item) => item.id === lead.id ? {
      ...item,
      observacoes: observation,
    } : item))
    setSavingObservationId(null)
  }

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase()
    return leads.filter((lead) => {
      const matchesStatus = filter === 'todos' || lead.status === filter
      const matchesSearch = !term ||
        lead.nome.toLowerCase().includes(term) ||
        lead.empresa.toLowerCase().includes(term) ||
        lead.email.toLowerCase().includes(term)

      return matchesStatus && matchesSearch
    })
  }, [leads, search, filter])

  function formatDate(value: string) {
    return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  }

  return (
    <div className="admin-enterprise">
      <div className="admin-enterprise-header">
        <div>
          <span className="admin-enterprise-eyebrow">AB Academy Enterprise</span>
          <h2>Leads comerciais</h2>
          <p>Centralize os contatos interessados em soluções corporativas e acompanhe cada oportunidade.</p>
        </div>
        <div className="admin-enterprise-count">{leads.length} leads</div>
      </div>

      <div className="admin-enterprise-toolbar">
        <label className="admin-enterprise-search">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, empresa ou e-mail" />
        </label>
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="todos">Todos os status</option>
          {statusOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="admin-enterprise-empty">Carregando leads...</div>
      ) : filteredLeads.length === 0 ? (
        <div className="admin-enterprise-empty">
          <Building2 size={24} />
          <strong>Nenhum lead encontrado.</strong>
          <span>Os novos contatos enviados pela landing page aparecerão aqui.</span>
        </div>
      ) : (
        <div className="admin-enterprise-list">
          {filteredLeads.map((lead) => {
            const isOpen = openId === lead.id
            const leadHistory = history.filter((item) => item.lead_id === lead.id)

            return (
              <article className="admin-enterprise-card" key={lead.id}>
                <div className="admin-enterprise-card-heading">
                  <div>
                    <span className="admin-enterprise-card-date">{formatDate(lead.created_at)}</span>
                    <h3>{lead.empresa}</h3>
                    <p>{lead.nome}{lead.cargo ? ' · ' + lead.cargo : ''}</p>
                  </div>

                  <div className="admin-enterprise-card-actions">
                    <select
                      value={lead.status}
                      disabled={savingId === lead.id}
                      onChange={(event) => void updateStatus(lead.id, event.target.value)}
                      className={'admin-enterprise-status status-' + lead.status}
                    >
                      {statusOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                    </select>

                    <button
                      type="button"
                      className="admin-enterprise-details-button"
                      onClick={() => setOpenId(isOpen ? null : lead.id)}
                    >
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      {isOpen ? 'Fechar detalhes' : 'Ver detalhes'}
                    </button>
                  </div>
                </div>

                <div className="admin-enterprise-contact">
                  <a href={'mailto:' + lead.email}><Mail size={15} />{lead.email}</a>
                  {lead.telefone && <a href={'tel:' + lead.telefone}><Phone size={15} />{lead.telefone}</a>}
                  {lead.colaboradores && <span><Building2 size={15} />{lead.colaboradores} colaboradores</span>}
                  {lead.idiomas.length > 0 && <span><MessageCircle size={15} />{lead.idiomas.join(' + ')}</span>}
                </div>

                {lead.objetivo && <div className="admin-enterprise-detail"><strong>Objetivo:</strong> {lead.objetivo}</div>}
                {lead.mensagem && <div className="admin-enterprise-message"><strong>Necessidade informada</strong><p>{lead.mensagem}</p></div>}

                {isOpen && (
                  <div className="admin-enterprise-expanded">
                    <section className="admin-enterprise-notes">
                      <div className="admin-enterprise-section-heading">
                        <div>
                          <span className="admin-enterprise-section-eyebrow">Gestão interna</span>
                          <h4>Observações comerciais</h4>
                        </div>
                        <span className="admin-enterprise-private-label">Interno</span>
                      </div>

                      <textarea
                        value={observationDrafts[lead.id] || ''}
                        onChange={(event) => setObservationDrafts((current) => ({ ...current, [lead.id]: event.target.value }))}
                        placeholder="Registre informações do diagnóstico, contatos, proposta, negociação ou próximos passos..."
                        rows={4}
                      />

                      <button
                        type="button"
                        className="admin-enterprise-save-button"
                        disabled={savingObservationId === lead.id}
                        onClick={() => void saveObservation(lead)}
                      >
                        <Save size={15} />
                        {savingObservationId === lead.id ? 'Salvando...' : 'Salvar observação'}
                      </button>
                    </section>

                    <section className="admin-enterprise-history">
                      <div className="admin-enterprise-section-heading">
                        <div>
                          <span className="admin-enterprise-section-eyebrow">Linha do tempo</span>
                          <h4>Histórico comercial</h4>
                        </div>
                        <Clock3 size={17} />
                      </div>

                      {leadHistory.length === 0 ? (
                        <div className="admin-enterprise-history-empty">Nenhuma movimentação registrada.</div>
                      ) : (
                        <div className="admin-enterprise-history-list">
                          {leadHistory.map((item) => (
                            <div className="admin-enterprise-history-item" key={item.id}>
                              <div className="admin-enterprise-history-marker" />
                              <div>
                                <div className="admin-enterprise-history-topline">
                                  <strong>{statusLabel(item.status)}</strong>
                                  <span>{formatDate(item.created_at)}</span>
                                </div>
                                {item.observacao && <p>{item.observacao}</p>}
                                {!item.observacao && <span className="admin-enterprise-history-status">Alteração de status</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
