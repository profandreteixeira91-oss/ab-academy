import { useEffect, useMemo, useState } from 'react'
import { Building2, Mail, MessageCircle, Phone, Search } from 'lucide-react'
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

const statusOptions = [
  ['novo', 'Novo'], ['contatado', 'Contatado'], ['diagnostico', 'Diagnóstico'],
  ['proposta_enviada', 'Proposta enviada'], ['negociacao', 'Negociação'],
  ['contratado', 'Contratado'], ['perdido', 'Perdido'],
]

export default function EnterpriseLeads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('todos')
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => { void loadLeads() }, [])

  async function loadLeads() {
    setLoading(true)
    const { data, error } = await supabase.from('enterprise_leads').select('*').order('created_at', { ascending: false })
    if (error) { console.error('Erro ao carregar leads Enterprise:', error); setLeads([]) }
    else setLeads((data || []) as Lead[])
    setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    setSavingId(id)
    const { error } = await supabase.from('enterprise_leads').update({
      status,
      updated_at: new Date().toISOString(),
      ...(status === 'contatado' ? { contacted_at: new Date().toISOString() } : {}),
    }).eq('id', id)
    if (error) console.error('Erro ao atualizar lead Enterprise:', error)
    else setLeads((current) => current.map((lead) => lead.id === id ? { ...lead, status } : lead))
    setSavingId(null)
  }

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase()
    return leads.filter((lead) => {
      const matchesStatus = filter === 'todos' || lead.status === filter
      const matchesSearch = !term || lead.nome.toLowerCase().includes(term) || lead.empresa.toLowerCase().includes(term) || lead.email.toLowerCase().includes(term)
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
          {filteredLeads.map((lead) => (
            <article className="admin-enterprise-card" key={lead.id}>
              <div className="admin-enterprise-card-heading">
                <div>
                  <span className="admin-enterprise-card-date">{formatDate(lead.created_at)}</span>
                  <h3>{lead.empresa}</h3>
                  <p>{lead.nome}{lead.cargo ? ' · ' + lead.cargo : ''}</p>
                </div>
                <select value={lead.status} disabled={savingId === lead.id} onChange={(event) => void updateStatus(lead.id, event.target.value)} className={'admin-enterprise-status status-' + lead.status}>
                  {statusOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </div>

              <div className="admin-enterprise-contact">
                <a href={'mailto:' + lead.email}><Mail size={15} />{lead.email}</a>
                {lead.telefone && <a href={'tel:' + lead.telefone}><Phone size={15} />{lead.telefone}</a>}
                {lead.colaboradores && <span><Building2 size={15} />{lead.colaboradores} colaboradores</span>}
                {lead.idiomas.length > 0 && <span><MessageCircle size={15} />{lead.idiomas.join(' + ')}</span>}
              </div>

              {lead.objetivo && <div className="admin-enterprise-detail"><strong>Objetivo:</strong> {lead.objetivo}</div>}
              {lead.mensagem && <div className="admin-enterprise-message"><strong>Necessidade informada</strong><p>{lead.mensagem}</p></div>}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
