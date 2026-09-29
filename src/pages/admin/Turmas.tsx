import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Plus, Users, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Turma = { id: string; modalidade: 'dupla' | 'grupo'; idioma: 'ingles' | 'alemao'; aulas_semana: number; quantidade_minima: number; quantidade_maxima: number; horario_preferido: string | null; status: string; origem_lead_id: string | null; created_at: string }
type Participante = { id: string; turma_id: string; nome: string; email: string; telefone: string | null; papel: 'organizador' | 'participante'; status: 'convidado' | 'confirmado' | 'recusado' | 'cancelado' }

const statusLabel: Record<string, string> = { em_formacao: 'Em formação', aguardando_confirmacoes: 'Aguardando confirmações', pronta: 'Pronta para matrícula', ativa: 'Ativa', encerrada: 'Encerrada', cancelada: 'Cancelada' }
const langLabel: Record<string, string> = { ingles: 'Inglês', alemao: 'Alemão' }
const modalityLabel: Record<string, string> = { dupla: 'Dupla', grupo: 'Grupo' }

export default function Turmas() {
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { nome: string; email: string; telefone: string }>>({})

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: turmaData, error: turmaError }, { data: participantData, error: participantError }] = await Promise.all([
      supabase.from('turmas').select('*').order('created_at', { ascending: false }),
      supabase.from('turma_participantes').select('*').order('created_at', { ascending: true }),
    ])
    if (turmaError) console.error(turmaError)
    if (participantError) console.error(participantError)
    setTurmas((turmaData || []) as Turma[])
    setParticipantes((participantData || []) as Participante[])
    setLoading(false)
  }

  const counts = useMemo(() => ({
    formacao: turmas.filter(t => ['em_formacao', 'aguardando_confirmacoes'].includes(t.status)).length,
    prontas: turmas.filter(t => t.status === 'pronta').length,
    ativas: turmas.filter(t => t.status === 'ativa').length,
  }), [turmas])

  async function addParticipant(turma: Turma) {
    const draft = drafts[turma.id]
    if (!draft?.nome.trim() || !draft.email.trim()) return
    setSaving(turma.id)
    const { error } = await supabase.from('turma_participantes').insert({ turma_id: turma.id, nome: draft.nome.trim(), email: draft.email.trim().toLowerCase(), telefone: draft.telefone.trim() || null, papel: 'participante', status: 'convidado' })
    if (error) { window.alert(error.message || 'Não foi possível adicionar o participante.') }
    else { setDrafts(x => ({ ...x, [turma.id]: { nome: '', email: '', telefone: '' } })); await load() }
    setSaving(null)
  }

  async function changeParticipantStatus(participant: Participante, status: Participante['status']) {
    const { error } = await supabase.from('turma_participantes').update({ status }).eq('id', participant.id)
    if (error) window.alert(error.message || 'Não foi possível atualizar o participante.')
    else await load()
  }

  async function refreshTurmaStatus(turma: Turma) {
    const members = participantes.filter(p => p.turma_id === turma.id && p.status === 'confirmado').length
    const nextStatus = members >= turma.quantidade_minima ? 'pronta' : 'aguardando_confirmacoes'
    const { error } = await supabase.from('turmas').update({ status: nextStatus }).eq('id', turma.id)
    if (error) window.alert(error.message || 'Não foi possível atualizar a turma.')
    else await load()
  }

  return (
    <div className="admin-turmas">
      <div className="admin-turmas-header"><div><span className="admin-turmas-eyebrow">Formação de turmas</span><h2>Duplas e grupos</h2><p>Confirme quem realmente fará parte da turma antes de liberar a matrícula e a condição comercial.</p></div>
        <div className="admin-turmas-summary"><div><strong>{counts.formacao}</strong><span>em formação</span></div><div><strong>{counts.prontas}</strong><span>prontas</span></div><div><strong>{counts.ativas}</strong><span>ativas</span></div></div>
      </div>
      <div className="admin-turmas-rule"><Users size={18} /><div><strong>Regra comercial</strong><span>Dupla exige 2 participantes confirmados. Grupo exige no mínimo 3. A quantidade confirmada é a que define a faixa de preço.</span></div></div>
      {loading ? <div className="admin-turmas-empty">Carregando turmas...</div> : !turmas.length ? <div className="admin-turmas-empty"><Users size={28} /><strong>Nenhuma turma em formação.</strong><span>Duplas e grupos iniciados a partir dos leads aparecerão aqui.</span></div> :
        <div className="admin-turmas-list">{turmas.map(turma => {
          const members = participantes.filter(p => p.turma_id === turma.id)
          const confirmed = members.filter(p => p.status === 'confirmado').length
          const draft = drafts[turma.id] || { nome: '', email: '', telefone: '' }
          const isOpen = open === turma.id
          return <article className="admin-turma-card" key={turma.id}>
            <div className="admin-turma-heading"><div><span className="admin-turma-date">{new Date(turma.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span><h3>{modalityLabel[turma.modalidade]} · {langLabel[turma.idioma]}</h3><p>{turma.aulas_semana}x por semana · {confirmed}/{turma.quantidade_maxima} confirmados</p></div>
              <div className="admin-turma-heading-actions"><span className={'admin-turma-status status-' + turma.status}>{statusLabel[turma.status] || turma.status}</span><button type="button" onClick={() => setOpen(isOpen ? null : turma.id)}>{isOpen ? 'Fechar' : 'Gerenciar'}</button></div>
            </div>
            <div className="admin-turma-progress"><span style={{ width: Math.min(100, (confirmed / turma.quantidade_maxima) * 100) + '%' }} /></div>
            {isOpen && <div className="admin-turma-body">
              <div className="admin-turma-members">{members.map(member => <div className="admin-turma-member" key={member.id}><div><strong>{member.nome}</strong><span>{member.email}{member.telefone ? ' · ' + member.telefone : ''}</span></div><div className="admin-turma-member-actions"><span className={'admin-turma-member-status status-' + member.status}>{member.status}</span>{member.status !== 'confirmado' && member.status !== 'cancelado' && <button type="button" title="Confirmar participante" onClick={() => void changeParticipantStatus(member, 'confirmado')}><CheckCircle2 size={16} /></button>}{member.status !== 'cancelado' && <button type="button" title="Cancelar participante" onClick={() => void changeParticipantStatus(member, 'cancelado')}><XCircle size={16} /></button>}</div></div>)}</div>
              <div className="admin-turma-add"><strong>Adicionar participante</strong><div className="admin-turma-add-grid"><input value={draft.nome} onChange={e => setDrafts(x => ({ ...x, [turma.id]: { ...draft, nome: e.target.value } }))} placeholder="Nome completo" /><input value={draft.email} onChange={e => setDrafts(x => ({ ...x, [turma.id]: { ...draft, email: e.target.value } }))} type="email" placeholder="E-mail" /><input value={draft.telefone} onChange={e => setDrafts(x => ({ ...x, [turma.id]: { ...draft, telefone: e.target.value } }))} placeholder="WhatsApp" /><button type="button" disabled={saving === turma.id} onClick={() => void addParticipant(turma)}><Plus size={16} />{saving === turma.id ? 'Adicionando...' : 'Adicionar'}</button></div></div>
              <button type="button" className="admin-turma-ready" onClick={() => void refreshTurmaStatus(turma)}><CheckCircle2 size={16} /> Atualizar status da turma</button>
            </div>}
          </article>
        })}</div>
      }
    </div>
  )
}