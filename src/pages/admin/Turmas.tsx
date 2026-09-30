import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, Copy, Plus, Users, XCircle } from 'lucide-react'
import '../../styles/admin/Turmas.css'
import { supabase } from '../../lib/supabase'

type Turma = { id: string; modalidade: 'dupla' | 'grupo'; idioma: 'ingles' | 'alemao'; aulas_semana: number; quantidade_minima: number; quantidade_maxima: number; horario_preferido: string | null; status: string; origem_lead_id: string | null; created_at: string; fixa?: boolean; professor_id?: string | null; nivel_referencia?: string | null; data_inicio?: string | null }
type Professor = { id: string; nome_completo: string; ativo: boolean }
type Participante = { id: string; turma_id: string; nome: string; email: string; telefone: string | null; papel: 'organizador' | 'participante'; status: 'convidado' | 'confirmado' | 'recusado' | 'cancelado'; forma_inicio: 'coletivo' | 'individual_aguardando'; valor_individual: number | null; valor_coletivo: number | null; valor_coletivo_normal: number | null; condicao_meses: number | null; condicao_inicio: string | null; condicao_fim: string | null }

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
  const [releasedLinks, setReleasedLinks] = useState<Record<string, string>>({})
  const [professores, setProfessores] = useState<Professor[]>([])
  const [fixedOpen, setFixedOpen] = useState(false)
  const [fixedSaving, setFixedSaving] = useState(false)
  const [fixedIdioma, setFixedIdioma] = useState<'ingles' | 'alemao'>('ingles')
  const [fixedModalidade, setFixedModalidade] = useState<'dupla' | 'grupo'>('dupla')
  const [fixedAulasSemana, setFixedAulasSemana] = useState(1)
  const [fixedProfessor, setFixedProfessor] = useState('')
  const [fixedMax, setFixedMax] = useState(6)
  const [fixedLevel, setFixedLevel] = useState('intermediario')
  const [fixedStartDate, setFixedStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [fixedDays, setFixedDays] = useState<number[]>([1])
  const [fixedTimes, setFixedTimes] = useState<{ start: string; end: string }[]>([{ start: '18:00', end: '19:00' }])

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: turmaData, error: turmaError }, { data: participantData, error: participantError }, { data: professorData, error: professorError }] = await Promise.all([
      supabase.from('turmas').select('*').order('created_at', { ascending: false }),
      supabase.from('turma_participantes').select('*').order('created_at', { ascending: true }),
      supabase.from('professores').select('id,nome_completo,ativo').eq('ativo', true).order('nome_completo'),
    ])
    if (turmaError) console.error(turmaError)
    if (participantError) console.error(participantError)
    if (professorError) console.error(professorError)
    setProfessores((professorData || []) as Professor[])
    setTurmas((turmaData || []) as Turma[])
    setParticipantes((participantData || []) as Participante[])
    setLoading(false)
  }

  const counts = useMemo(() => ({
    formacao: turmas.filter(t => ['em_formacao', 'aguardando_confirmacoes'].includes(t.status)).length,
    prontas: turmas.filter(t => t.status === 'pronta').length,
    ativas: turmas.filter(t => t.status === 'ativa').length,
  }), [turmas])

  function resetFixedForm() {
    setFixedIdioma('ingles')
    setFixedModalidade('dupla')
    setFixedAulasSemana(1)
    setFixedProfessor('')
    setFixedMax(6)
    setFixedLevel('intermediario')
    setFixedStartDate(new Date().toISOString().slice(0, 10))
    setFixedDays([1])
    setFixedTimes([{ start: '18:00', end: '19:00' }])
  }

  function changeFixedFrequency(value: number) {
    setFixedAulasSemana(value)
    setFixedDays((current) => current.slice(0, value).length === value ? current.slice(0, value) : [...current.slice(0, value), ...[1,2,3,4,5,6,0].filter((day) => !current.includes(day))].slice(0, value))
    setFixedTimes((current) => Array.from({ length: value }, (_, index) => current[index] || { start: '18:00', end: '19:00' }))
  }

  function toggleFixedDay(day: number) {
    setFixedDays((current) => {
      if (current.includes(day)) return current.length === 1 ? current : current.filter((item) => item !== day)
      if (current.length >= fixedAulasSemana) return current
      return [...current, day]
    })
  }

  function updateFixedTime(index: number, field: 'start' | 'end', value: string) {
    setFixedTimes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))
  }

  async function createFixedTurma() {
    if (!fixedProfessor) {
      window.alert('Selecione o professor responsável pela turma fixa.')
      return
    }
    if (fixedDays.length !== fixedAulasSemana) {
      window.alert('Selecione exatamente um dia para cada aula semanal.')
      return
    }
    if (fixedTimes.length !== fixedAulasSemana || fixedTimes.some((item) => !item.start || !item.end || item.start >= item.end)) {
      window.alert('Confira os horários de todos os encontros.')
      return
    }

    setFixedSaving(true)
    const { error } = await supabase.rpc('criar_turma_fixa_admin_v2', {
      p_idioma: fixedIdioma,
      p_modalidade: fixedModalidade,
      p_aulas_semana: fixedAulasSemana,
      p_dias: fixedDays,
      p_horas_inicio: fixedTimes.map((item) => item.start),
      p_horas_fim: fixedTimes.map((item) => item.end),
      p_professor_id: fixedProfessor,
      p_quantidade_maxima: fixedModalidade === 'dupla' ? 2 : fixedMax,
      p_nivel_referencia: fixedLevel,
      p_data_inicio: fixedStartDate,
    })
    if (error) {
      window.alert(error.message || 'Não foi possível criar a turma fixa.')
    } else {
      window.alert('Turma fixa criada. Ela já estará disponível como campanha de turma na matrícula.')
      setFixedOpen(false)
      resetFixedForm()
      await load()
    }
    setFixedSaving(false)
  }

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

  async function releaseEnrollment(turma: Turma, member: Participante) {
    if (turma.status !== 'pronta' || member.status !== 'confirmado' || member.valor_coletivo === null) {
      window.alert('A turma precisa estar pronta e o participante confirmado com valor coletivo definido.')
      return
    }
    setSaving(member.id)
    const { data: existing } = await supabase.from('turma_matriculas').select('token').eq('participante_id', member.id).maybeSingle()
    let token = existing?.token ?? null
    if (!token) {
      const { data, error } = await supabase.from('turma_matriculas').insert({
        turma_id: turma.id,
        participante_id: member.id,
        valor_mensal: member.valor_coletivo,
        valor_coletivo_normal: member.valor_coletivo_normal,
        condicao_meses: member.condicao_meses,
        condicao_inicio: member.condicao_inicio,
        condicao_fim: member.condicao_fim,
        status: 'liberada',
      }).select('token').single()
      if (error) {
        window.alert(error.message || 'Não foi possível liberar a matrícula.')
        setSaving(null)
        return
      }
      token = data.token
    }
    const url = window.location.origin + '/matricula?turma_token=' + encodeURIComponent(token)
    setReleasedLinks(x => ({ ...x, [member.id]: url }))
    setSaving(null)
  }

  async function refreshTurmaStatus(turma: Turma) {
    const confirmedParticipants = participantes.filter(p => p.turma_id === turma.id && p.status === 'confirmado')
    const confirmed = confirmedParticipants.length
    const nextStatus = confirmed >= turma.quantidade_minima ? 'pronta' : 'aguardando_confirmacoes'

    if (nextStatus === 'pronta') {
      const { data: frequency } = await supabase
        .from('modalidade_frequencias')
        .select('id, preco_mensal')
        .eq('idioma', turma.idioma)
        .eq('modalidade', turma.modalidade)
        .eq('aulas_semana', turma.aulas_semana)
        .eq('ativo', true)
        .maybeSingle()

      let collectivePrice: number | null = null
      if (frequency) {
        if (turma.modalidade === 'dupla') {
          collectivePrice = Number(frequency.preco_mensal)
        } else {
          const { data: tier } = await supabase
            .from('modalidade_frequencia_precos')
            .select('preco_mensal')
            .eq('frequencia_id', frequency.id)
            .eq('quantidade_participantes', confirmed)
            .eq('ativo', true)
            .maybeSingle()
          collectivePrice = tier?.preco_mensal != null ? Number(tier.preco_mensal) : null
        }
      }

      if (collectivePrice !== null) {
        const start = new Date()
        const conditionStart = new Date(start.getFullYear(), start.getMonth() + 1, 1)
        const conditionEnd = new Date(conditionStart.getFullYear(), conditionStart.getMonth() + 3, 0)
        const iso = (value: Date) => {
          const y = value.getFullYear()
          const m = String(value.getMonth() + 1).padStart(2, '0')
          const d = String(value.getDate()).padStart(2, '0')
          return y + '-' + m + '-' + d
        }

        const conditionPrice = Math.round(collectivePrice * 0.9 * 100) / 100
        const waitingIds = confirmedParticipants
          .filter(p => p.forma_inicio === 'individual_aguardando')
          .map(p => p.id)

        if (waitingIds.length) {
          await supabase
            .from('turma_participantes')
            .update({
              valor_coletivo: conditionPrice,
              valor_coletivo_normal: collectivePrice,
              condicao_meses: 3,
              condicao_inicio: iso(conditionStart),
              condicao_fim: iso(conditionEnd),
            })
            .in('id', waitingIds)
        }

        const directIds = confirmedParticipants
          .filter(p => p.forma_inicio === 'coletivo')
          .map(p => p.id)

        if (directIds.length) {
          await supabase
            .from('turma_participantes')
            .update({ valor_coletivo: collectivePrice, valor_coletivo_normal: collectivePrice })
            .in('id', directIds)
        }
      }
    }

    const { error } = await supabase.from('turmas').update({ status: nextStatus }).eq('id', turma.id)
    if (error) window.alert(error.message || 'Não foi possível atualizar a turma.')
    else await load()
  }

  return (
    <div className="admin-turmas">
      <div className="admin-turmas-header"><div><span className="admin-turmas-eyebrow">Formação de turmas</span><h2>Duplas e grupos</h2><p>Confirme quem realmente fará parte da turma. Quem começou no individual migra para o valor coletivo a partir do próximo ciclo, com condição especial por 3 meses.</p></div>
        <button type="button" className="admin-turmas-create-fixed" onClick={() => setFixedOpen((current) => !current)}><Clock3 size={17} /> {fixedOpen ? 'Fechar criação' : 'Criar horário fixo'}</button>
      {fixedOpen && (
        <section className="admin-turmas-fixed-form">
          <div><span className="admin-turmas-eyebrow">HORÁRIOS FIXOS</span><h3>Nova turma coletiva</h3><p>Crie os encontros recorrentes que serão oferecidos no seletor inteligente da matrícula. O primeiro aluno definirá o nível da turma. O mesmo professor pode ter individual, dupla e grupo cadastrados no mesmo horário; a reserva de qualquer modalidade ocupa o intervalo para as demais. O nível e a data de início ficam definidos pela administração e aparecem na matrícula.</p></div>
          <div className="admin-turmas-fixed-grid">
            <label>Idioma<select value={fixedIdioma} onChange={e => setFixedIdioma(e.target.value as 'ingles' | 'alemao')}><option value="ingles">Inglês</option><option value="alemao">Alemão</option></select></label>
            <label>Modalidade<select value={fixedModalidade} onChange={e => setFixedModalidade(e.target.value as 'dupla' | 'grupo')}><option value="dupla">Dupla · até 2</option><option value="grupo">Grupo · até 6</option></select></label>
            <label>Aulas por semana<select value={fixedAulasSemana} onChange={e => changeFixedFrequency(Number(e.target.value))}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label>
            <label>Professor<select value={fixedProfessor} onChange={e => setFixedProfessor(e.target.value)}><option value="">Selecione</option>{professores.map(p => <option key={p.id} value={p.id}>{p.nome_completo}</option>)}</select></label>
            <label>Nível<select value={fixedLevel} onChange={e => setFixedLevel(e.target.value)}>{['iniciante','basico','intermediario','avancado'].map(level => <option key={level} value={level}>{level === 'iniciante' ? 'Iniciante' : level === 'basico' ? 'Básico' : level === 'intermediario' ? 'Intermediário' : 'Avançado'}</option>)}</select></label>
            <label>Início da turma<input type="date" min={new Date().toISOString().slice(0, 10)} value={fixedStartDate} onChange={e => setFixedStartDate(e.target.value)} /></label>
            {fixedModalidade === 'grupo' && <label>Capacidade<select value={fixedMax} onChange={e => setFixedMax(Number(e.target.value))}>{[3,4,5,6].map(value => <option key={value} value={value}>{value} alunos</option>)}</select></label>}
          </div>
          <div className="admin-turmas-fixed-days"><strong>Dias</strong><div>{[{v:1,l:'Seg'},{v:2,l:'Ter'},{v:3,l:'Qua'},{v:4,l:'Qui'},{v:5,l:'Sex'},{v:6,l:'Sáb'},{v:0,l:'Dom'}].map(day => <button type="button" key={day.v} className={fixedDays.includes(day.v) ? 'active' : ''} onClick={() => toggleFixedDay(day.v)}>{day.l}</button>)}</div></div>
          <div className="admin-turmas-fixed-encounters">{fixedDays.map((day, index) => <div key={day}><strong>{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][day]}</strong><label>Início<input type="time" value={fixedTimes[index]?.start || '18:00'} onChange={e => updateFixedTime(index,'start',e.target.value)} /></label><label>Fim<input type="time" value={fixedTimes[index]?.end || '19:00'} onChange={e => updateFixedTime(index,'end',e.target.value)} /></label></div>)}</div>
          <div className="admin-turmas-fixed-actions"><button type="button" onClick={() => { setFixedOpen(false); resetFixedForm() }}>Cancelar</button><button type="button" disabled={fixedSaving} onClick={() => void createFixedTurma()}>{fixedSaving ? 'Criando...' : 'Criar turma fixa'}</button></div>
        </section>
      )}

      <div className="admin-turmas-summary"><div><strong>{counts.formacao}</strong><span>em formação</span></div><div><strong>{counts.prontas}</strong><span>prontas</span></div><div><strong>{counts.ativas}</strong><span>ativas</span></div></div>
      </div>
      <div className="admin-turmas-rule"><Users size={18} /><div><strong>Regra comercial</strong><span>Dupla exige 2 participantes confirmados. Grupo exige no mínimo 3. A quantidade confirmada é a que define a faixa de preço. Para quem iniciou no individual, a condição coletiva começa no ciclo seguinte à formação.</span></div></div>
      {loading ? <div className="admin-turmas-empty">Carregando turmas...</div> : !turmas.length ? <div className="admin-turmas-empty"><Users size={28} /><strong>Nenhuma turma em formação.</strong><span>Duplas e grupos iniciados a partir dos leads aparecerão aqui.</span></div> :
        <div className="admin-turmas-list">{turmas.map(turma => {
          const members = participantes.filter(p => p.turma_id === turma.id)
          const confirmed = members.filter(p => p.status === 'confirmado').length
          const draft = drafts[turma.id] || { nome: '', email: '', telefone: '' }
          const isOpen = open === turma.id
          return <article className="admin-turma-card" key={turma.id}>
            <div className="admin-turma-heading"><div><span className="admin-turma-date">{new Date(turma.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span><h3>{modalityLabel[turma.modalidade]} · {langLabel[turma.idioma]} {turma.fixa ? '· Horário fixo' : ''}</h3><p>{turma.aulas_semana}x por semana · {confirmed}/{turma.quantidade_maxima} confirmados{turma.nivel_referencia ? ' · nível ' + ({ iniciante: 'Iniciante', basico: 'Básico', intermediario: 'Intermediário', avancado: 'Avançado' } as Record<string,string>)[turma.nivel_referencia] || turma.nivel_referencia : ''}{turma.data_inicio ? ' · início ' + new Date(turma.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR') : ''}</p></div>
              <div className="admin-turma-heading-actions"><span className={'admin-turma-status status-' + turma.status}>{statusLabel[turma.status] || turma.status}</span><button type="button" onClick={() => setOpen(isOpen ? null : turma.id)}>{isOpen ? 'Fechar' : 'Gerenciar'}</button></div>
            </div>
            <div className="admin-turma-progress"><span style={{ width: Math.min(100, (confirmed / turma.quantidade_maxima) * 100) + '%' }} /></div>
            {isOpen && <div className="admin-turma-body">
              <div className="admin-turma-members">{members.map(member => <div className="admin-turma-member" key={member.id}><div><strong>{member.nome}</strong><span>{member.email}{member.telefone ? ' · ' + member.telefone : ''}</span>{member.forma_inicio === 'individual_aguardando' && <small>Começou no individual · condição coletiva: {member.valor_coletivo ? 'R$ ' + Number(member.valor_coletivo).toFixed(2).replace('.', ',') + '/mês' : 'aguardando formação'} (normal: {member.valor_coletivo_normal ? 'R$ ' + Number(member.valor_coletivo_normal).toFixed(2).replace('.', ',') : '—'}) · {member.condicao_meses || 3} meses · 10% de desconto</small>}</div><div className="admin-turma-member-actions"><span className={'admin-turma-member-status status-' + member.status}>{member.status}</span>{member.status !== 'confirmado' && member.status !== 'cancelado' && <button type="button" title="Confirmar participante" onClick={() => void changeParticipantStatus(member, 'confirmado')}><CheckCircle2 size={16} /></button>}{member.status !== 'cancelado' && <button type="button" title="Cancelar participante" onClick={() => void changeParticipantStatus(member, 'cancelado')}><XCircle size={16} /></button>}{turma.status === 'pronta' && member.status === 'confirmado' && member.valor_coletivo !== null && <button type="button" title="Liberar matrícula" onClick={() => void releaseEnrollment(turma, member)} disabled={saving === member.id}>Liberar matrícula</button>}</div>{releasedLinks[member.id] && <div className="admin-turma-release-link"><span>{releasedLinks[member.id]}</span><button type="button" onClick={() => void navigator.clipboard.writeText(releasedLinks[member.id])}><Copy size={15} /> Copiar</button></div>}</div>)}</div>
              <div className="admin-turma-add"><strong>Adicionar participante</strong><div className="admin-turma-add-grid"><input value={draft.nome} onChange={e => setDrafts(x => ({ ...x, [turma.id]: { ...draft, nome: e.target.value } }))} placeholder="Nome completo" /><input value={draft.email} onChange={e => setDrafts(x => ({ ...x, [turma.id]: { ...draft, email: e.target.value } }))} type="email" placeholder="E-mail" /><input value={draft.telefone} onChange={e => setDrafts(x => ({ ...x, [turma.id]: { ...draft, telefone: e.target.value } }))} placeholder="WhatsApp" /><button type="button" disabled={saving === turma.id} onClick={() => void addParticipant(turma)}><Plus size={16} />{saving === turma.id ? 'Adicionando...' : 'Adicionar'}</button></div></div>
              <button type="button" className="admin-turma-ready" onClick={() => void refreshTurmaStatus(turma)}><CheckCircle2 size={16} /> Atualizar status da turma</button>
            </div>}
          </article>
        })}</div>
      }
    </div>
  )
}