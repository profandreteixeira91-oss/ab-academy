import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, CheckCircle2, ChevronLeft, Loader2, ShieldCheck, Users } from 'lucide-react'
import '../styles/matricula.css'
import '../styles/matricula-coletiva.css'
import logo from '../assets/logo_abacademy.png'
import usaFlag from '../assets/flag-usa.svg'
import germanyFlag from '../assets/flag-germany.svg'
import { supabase } from '../lib/supabase'

type Language = 'ingles' | 'alemao'
type Modality = 'dupla' | 'grupo'
type Schedule = {
  id: string; idioma: Language; dia_semana: number; hora_inicio: string; hora_fim: string
  tipo_horario: string; disponivel: boolean; turma_id: string | null; participantes: number
  capacidade: number; vagas_restantes: number; valor_mensal: number | null
}
type SelectedSchedule = Schedule & { participante_id: string }
type StudentData = {
  nome_completo: string; cpf: string; email: string; data_nascimento: string; telefone: string
  responsavel_nome: string | null; responsavel_contato: string | null
  nivel_conversacao: string; nivel_escrita: string; nivel_compreensao: string
}
const weekdays: Record<number, string> = { 0: 'Domingo', 1: 'Segunda-feira', 2: 'Terça-feira', 3: 'Quarta-feira', 4: 'Quinta-feira', 5: 'Sexta-feira', 6: 'Sábado' }
const languageLabel: Record<Language, string> = { ingles: 'Inglês', alemao: 'Alemão' }
const baseIndividualPrice: Record<Language, Record<number, number>> = {
  ingles: { 1: 397, 2: 680, 3: 990 },
  alemao: { 1: 427, 2: 760, 3: 1110 },
}
function money(value: number) { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function digits(value: string) { return value.replace(/\D/g, '') }
function formatCpf(value: string) {
  const d = digits(value).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return d.slice(0, 3) + '.' + d.slice(3)
  if (d.length <= 9) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6)
  return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9)
}
function formatPhone(value: string) {
  const d = digits(value).slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2$3')
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2$3')
}
function getDateForWeekday(day: number) {
  const today = new Date(); const current = today.getDay(); let delta = day - current
  if (delta < 0) delta += 7
  const date = new Date(today); date.setDate(today.getDate() + delta)
  return date.toISOString().slice(0, 10)
}
function validateCpf(value: string) {
  const cpf = digits(value)
  if (cpf.length !== 11 || /^([0-9])\1+$/.test(cpf)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i)
  let check = (sum * 10) % 11; if (check === 10) check = 0
  if (check !== Number(cpf[9])) return false
  sum = 0; for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i)
  check = (sum * 10) % 11; if (check === 10) check = 0
  return check === Number(cpf[10])
}

export default function MatriculaColetiva({ modalidade: propModalidade }: { modalidade?: Modality }) {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const modalidade = propModalidade ?? (params.get('modalidade') as Modality)
  const initialLanguage = params.get('idioma') as Language
  const [step, setStep] = useState(1)
  const [language, setLanguage] = useState<Language | null>(['ingles', 'alemao'].includes(initialLanguage) ? initialLanguage : null)
  const [frequency, setFrequency] = useState(modalidade === 'grupo' ? 2 : 1)
  const [name, setName] = useState(''); const [cpf, setCpf] = useState(''); const [email, setEmail] = useState('')
  const [birthDate, setBirthDate] = useState(''); const [phone, setPhone] = useState('')
  const [responsibleName, setResponsibleName] = useState(''); const [responsiblePhone, setResponsiblePhone] = useState('')
  const [conversationLevel, setConversationLevel] = useState('Não informado')
  const [writingLevel, setWritingLevel] = useState('Não informado')
  const [comprehensionLevel, setComprehensionLevel] = useState('Não informado')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedSchedules, setSelectedSchedules] = useState<SelectedSchedule[]>([])
  const [selectedTurmaId, setSelectedTurmaId] = useState<string | null>(null)
  const [selectedWeekday, setSelectedWeekday] = useState<number | null>(null)
  const [loadingSchedules, setLoadingSchedules] = useState(false); const [loadingSelection, setLoadingSelection] = useState<string | null>(null)
  const [planId, setPlanId] = useState<string | null>(null); const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [loading, setLoading] = useState(false)
  const reservaToken = useMemo(() => crypto.randomUUID(), [])
  const requiredSchedules = frequency
  const formationMode = selectedSchedules.length > 0 && selectedSchedules[0].participantes <= 1
  const discount = modalidade === 'grupo' ? 0.15 : 0.10
  const formationPrice = language ? (baseIndividualPrice[language][frequency] || 0) * (1 - discount) : 0
  const existingParticipants = selectedSchedules.length ? Math.max.apply(null, selectedSchedules.map(item => item.participantes)) : 0
  const collectivePrice = selectedSchedules[0]?.valor_mensal ?? null
  const groupedSchedules = useMemo(() => {
    const groups = new Map<number, Schedule[]>()
    schedules.forEach((item) => {
      const current = groups.get(item.dia_semana) ?? []
      current.push(item)
      groups.set(item.dia_semana, current)
    })
    return Array.from(groups.entries()).sort(([a], [b]) => a - b).map(([value, items]) => ({
      value,
      short: weekdays[value].replace('-feira', '').replace('Domingo', 'Dom.').slice(0, 3),
      schedules: items.sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio))),
    }))
  }, [schedules])
  const visibleSchedules = selectedWeekday === null ? schedules : schedules.filter((item) => item.dia_semana === selectedWeekday)
  const monthlyPrice = formationMode ? formationPrice : (collectivePrice ?? formationPrice)

  useEffect(() => {
    document.title = (modalidade === 'grupo' ? 'Matrícula em grupo' : 'Matrícula em dupla') + ' - AB Academy Idiomas'
    if (!['dupla', 'grupo'].includes(modalidade) || (initialLanguage && !['ingles', 'alemao'].includes(initialLanguage))) setError('Modalidade ou idioma de matrícula inválido.')
  }, [modalidade, initialLanguage])

  async function loadPlans(currentLanguage: Language, currentFrequency: number) {
    const { data, error: planError } = await supabase.from('planos').select('id').eq('idioma', currentLanguage).eq('modalidade', modalidade).eq('tipo', 'mensal').eq('aulas_semana', currentFrequency).eq('ativo', true).maybeSingle()
    if (planError || !data) { setError('Não foi possível identificar a condição de matrícula desta modalidade.'); return false }
    setPlanId(data.id); return true
  }
  async function loadSchedules() {
    if (!language) return
    setLoadingSchedules(true); setError('')
    const { data, error: scheduleError } = await supabase.rpc('listar_horarios_matricula', { p_idioma: language, p_modalidade: modalidade, p_aulas_semana: frequency })
    setLoadingSchedules(false)
    if (scheduleError) { console.error(scheduleError); setError('Não foi possível carregar os horários disponíveis.'); return }
    setSchedules((data ?? []) as Schedule[])
    setSelectedWeekday(null)
  }
  useEffect(() => {
    if (language) { void loadPlans(language, frequency); setSelectedSchedules([]); setSelectedTurmaId(null); setSelectedWeekday(null); if (step === 2) void loadSchedules() }
  }, [language, frequency])

  function validatePersonalData() {
    if (!language) return 'Escolha o idioma.'
    if (!name.trim()) return 'Informe seu nome completo.'
    if (!validateCpf(cpf)) return 'Informe um CPF válido.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Informe um e-mail válido.'
    if (!birthDate) return 'Informe sua data de nascimento.'
    if (digits(phone).length < 10) return 'Informe um telefone válido.'
    return ''
  }
  async function nextStep() {
    setError(''); setSuccess('')
    if (step === 1) {
      const validation = validatePersonalData(); if (validation) { setError(validation); return }
      const loaded = planId ? true : await loadPlans(language!, frequency); if (!loaded) return
      setStep(2); await loadSchedules(); return
    }
    if (step === 2) {
      if (selectedSchedules.length !== requiredSchedules) { setError('Selecione ' + requiredSchedules + ' horário' + (requiredSchedules > 1 ? 's' : '') + ' por semana.'); return }
      setStep(3)
    }
  }
  function previousStep() { setError(''); setSuccess(''); setStep(current => Math.max(1, current - 1)) }

  async function selectSchedule(item: Schedule) {
    if (!language || loadingSelection) return
    setError('')
    if (selectedSchedules.some(selected => selected.id === item.id)) { setSelectedSchedules(current => current.filter(selected => selected.id !== item.id)); return }
    if (selectedSchedules.length >= requiredSchedules) { setError('Você já selecionou ' + requiredSchedules + ' horários.'); return }
    if (selectedTurmaId && item.turma_id && selectedTurmaId !== item.turma_id) { setError('Escolha todos os horários da mesma turma.'); return }
    setLoadingSelection(item.id)
    const { data, error: selectionError } = await supabase.rpc('selecionar_horario_matricula_v2', {
      p_horario_id: item.id, p_idioma: language, p_modalidade: modalidade, p_aulas_semana: frequency, p_turma_id: selectedTurmaId,
      p_reserva_token: reservaToken, p_nome: name.trim(), p_email: email.trim().toLowerCase(),
    })
    setLoadingSelection(null)
    if (selectionError || !data) { console.error(selectionError); setError(selectionError?.message || 'Este horário acabou de ser ocupado. Escolha outro.'); await loadSchedules(); return }
    const selected: SelectedSchedule = {
      ...item, id: data.id, dia_semana: Number(data.dia_semana), hora_inicio: String(data.hora_inicio), hora_fim: String(data.hora_fim),
      turma_id: data.turma_id ?? null, participante_id: String(data.participante_id), participantes: Number(data.participantes ?? 1),
      capacidade: Number(data.capacidade ?? item.capacidade), vagas_restantes: Number(data.vagas_restantes ?? item.vagas_restantes), valor_mensal: data.valor_mensal != null ? Number(data.valor_mensal) : null,
    }
    if (selected.turma_id) setSelectedTurmaId(selected.turma_id)
    setSelectedSchedules(current => current.concat(selected))
    setSchedules(current => current.map(slot => slot.id === item.id ? selected : slot))
  }

  function buildStudentData(): StudentData {
    return { nome_completo: name.trim(), cpf: digits(cpf), email: email.trim().toLowerCase(), data_nascimento: birthDate, telefone: digits(phone),
      responsavel_nome: responsibleName.trim() || null, responsavel_contato: digits(responsiblePhone) || null,
      nivel_conversacao: conversationLevel, nivel_escrita: writingLevel, nivel_compreensao: comprehensionLevel }
  }
  async function createEnrollment() {
    if (!language || !planId || selectedSchedules.length !== requiredSchedules) { setError('Complete os dados e selecione todos os horários.'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      const horarioIds = selectedSchedules.map(item => item.id)
      const schedulesPayload = selectedSchedules.map(item => ({ id: item.id, date: getDateForWeekday(item.dia_semana), weekday: item.dia_semana, time: item.hora_inicio, hora_inicio: item.hora_inicio, hora_fim: item.hora_fim }))
      const { data, error: functionError } = await supabase.functions.invoke('create-enrollment', {
        body: { plano_id: planId, idioma: language, tipo_plano: 'mensal', turma_id: selectedTurmaId, turma_participante_id: selectedSchedules[0].participante_id,
          objetivos: null, aulas_semana: frequency, valor_aula: null, valor_mensal: monthlyPrice, valor_anual: null, horario_ids: horarioIds, schedules: schedulesPayload,
          dados_aluno: buildStudentData(), valor: monthlyPrice, reserva_token: reservaToken, modalidade: modalidade },
      })
      if (functionError) throw new Error(functionError.message || 'Não foi possível criar a matrícula.')
      if (!data?.success || !data?.pagamento_id) throw new Error(data?.error || 'A matrícula não pôde ser criada.')
      setSuccess('Matrícula criada. Redirecionando para o pagamento...'); window.location.assign('/checkout/' + data.pagamento_id)
    } catch (submitError) {
      console.error(submitError); setError(submitError instanceof Error ? submitError.message : 'Não foi possível concluir a matrícula.')
    } finally { setLoading(false) }
  }

  const pageTitle = modalidade === 'grupo' ? 'Matrícula em grupo' : 'Matrícula em dupla'
  const subtitle = modalidade === 'grupo' ? 'Entre em um grupo existente ou seja o primeiro aluno a abrir uma nova turma.' : 'Entre em uma dupla existente ou abra um novo horário para formar sua dupla.'

  if (!['dupla', 'grupo'].includes(modalidade)) return <div className="enrollment-page"><div className="enrollment-container"><div className="enrollment-card"><div className="enrollment-error">{error || 'Matrícula coletiva inválida.'}</div></div></div></div>

  return <div className="enrollment-page collective-enrollment-page">
    <header className="enrollment-header"><a href="/" className="enrollment-logo"><img src={logo} alt="AB Academy" /></a><a href="/" className="enrollment-back"><ChevronLeft size={17} /> Voltar</a></header>
    <main className="enrollment-main"><div className="enrollment-container">
      <div className="enrollment-heading"><span className="enrollment-eyebrow">MATRÍCULA {modalidade === 'grupo' ? 'EM GRUPO' : 'EM DUPLA'}</span>
        <h1>{pageTitle} <span>{language ? 'de ' + languageLabel[language] : ''}</span></h1>
        <p>{subtitle} <strong>Não é necessário criar senha nesta etapa.</strong> O acesso ao Portal do Aluno é criado somente após a confirmação do pagamento.</p>
      </div>
      <div className="enrollment-progress">{[['1', 'Seus dados'], ['2', 'Disponibilidade'], ['3', 'Pagamento']].map(([number, label], index) => <div key={number} className={'enrollment-progress-step ' + (step === index + 1 ? 'active ' : '') + (step > index + 1 ? 'completed' : '')}><span className="enrollment-progress-number">{step > index + 1 ? '✓' : number}</span><span>{label}</span>{index < 2 && <span className="enrollment-progress-line" />}</div>)}</div>
      <div className="enrollment-grid collective-enrollment-grid">
        <section className="enrollment-card">
          {error && <div className="enrollment-error">{error}</div>}{success && <div className="enrollment-success">{success}</div>}
          {step === 1 && <>
            <div className="enrollment-card-header"><span className="enrollment-card-number">1</span><div><h2>Dados básicos da matrícula</h2><p>Preencha seus dados. Não solicitamos senha nesta etapa.</p></div></div>
            <div className="collective-context-card"><div><span>Modalidade</span><strong>{modalidade === 'grupo' ? 'Grupo' : 'Dupla'}</strong></div><div><span>Idioma</span><strong>{language ? languageLabel[language] : 'Selecione abaixo'}</strong></div></div>
            <div className="selection-heading"><Users size={20} /><div><h3>Idioma</h3><p>Escolha o idioma da matrícula.</p></div></div>
            <div className="language-selection">{(['ingles', 'alemao'] as Language[]).map(item => <button key={item} type="button" className={'language-selection-card ' + (language === item ? 'selected' : '')} onClick={() => setLanguage(item)}><img src={item === 'ingles' ? usaFlag : germanyFlag} alt="" /><div><strong>{languageLabel[item]}</strong><span>{item === 'ingles' ? 'Inglês' : 'Deutsch'}</span></div><span className="selection-radio" /></button>)}</div>
            <div className="collective-frequency"><div className="selection-heading"><CalendarDays size={20} /><div><h3>Frequência semanal</h3><p>Escolha quantas aulas você fará por semana.</p></div></div>
              <div className="collective-frequency-options">{(modalidade === 'grupo' ? [1, 2, 3] : [1, 2]).map(value => <button type="button" key={value} className={frequency === value ? 'selected' : ''} onClick={() => setFrequency(value)}><strong>{value}x</strong><span>{value === 1 ? '1 aula por semana' : value + ' aulas por semana'}</span></button>)}</div>
            </div>
            <div className="enrollment-fields collective-fields">
              <div className="enrollment-field collective-field-wide"><label>Nome completo *</label><input value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></div>
              <div className="enrollment-field"><label>CPF *</label><input value={cpf} onChange={e => setCpf(formatCpf(e.target.value))} inputMode="numeric" /></div>
              <div className="enrollment-field"><label>Data de nascimento *</label><input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} /></div>
              <div className="enrollment-field"><label>E-mail *</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></div>
              <div className="enrollment-field"><label>Telefone *</label><input value={phone} onChange={e => setPhone(formatPhone(e.target.value))} inputMode="tel" autoComplete="tel" /></div>
              <div className="enrollment-field"><label>Responsável</label><input value={responsibleName} onChange={e => setResponsibleName(e.target.value)} /></div>
              <div className="enrollment-field"><label>Contato do responsável</label><input value={responsiblePhone} onChange={e => setResponsiblePhone(formatPhone(e.target.value))} inputMode="tel" /></div>
            </div>
            <div className="collective-levels">
              <div className="enrollment-field"><label>Conversação</label><select value={conversationLevel} onChange={e => setConversationLevel(e.target.value)}><option>Não informado</option><option>Iniciante</option><option>Básico</option><option>Intermediário</option><option>Avançado</option></select></div>
              <div className="enrollment-field"><label>Escrita</label><select value={writingLevel} onChange={e => setWritingLevel(e.target.value)}><option>Não informado</option><option>Iniciante</option><option>Básico</option><option>Intermediário</option><option>Avançado</option></select></div>
              <div className="enrollment-field"><label>Compreensão</label><select value={comprehensionLevel} onChange={e => setComprehensionLevel(e.target.value)}><option>Não informado</option><option>Iniciante</option><option>Básico</option><option>Intermediário</option><option>Avançado</option></select></div>
            </div>
          </>}
          {step === 2 && <>
            <div className="enrollment-card-header"><span className="enrollment-card-number">2</span><div><h2>Verifique a disponibilidade</h2><p>Você verá horários livres e horários que já possuem alunos na modalidade escolhida.</p></div></div>
            {loadingSchedules ? <div className="enrollment-loading">Carregando horários...</div> : <div className="collective-schedule-selector">
              {schedules.length === 0 ? <div className="enrollment-empty">Nenhum horário disponível para {language ? languageLabel[language] : 'o idioma selecionado'}.</div> : <>
                <div className="schedule-calendar">
                  <button type="button" className={'schedule-date ' + (selectedWeekday === null ? 'selected' : '')} onClick={() => setSelectedWeekday(null)}>
                    <strong>Todos</strong><span>horários</span>
                  </button>
                  {groupedSchedules.map((weekday) => (
                    <button type="button" key={weekday.value} className={'schedule-date ' + (selectedWeekday === weekday.value ? 'selected' : '')} onClick={() => setSelectedWeekday(weekday.value)}>
                      <strong>{weekday.short}</strong><span>{weekday.schedules.length} opções</span>
                    </button>
                  ))}
                </div>
                <div className="schedule-times">
                  {visibleSchedules.map((item) => {
                    const selected = selectedSchedules.some(current => current.id === item.id)
                    const hasExisting = !!item.turma_id && item.participantes > 0
                    const displayPrice = hasExisting ? Number(item.valor_mensal || formationPrice) : formationPrice
                    return <button type="button" key={item.id} className={'schedule-time ' + (selected ? 'selected' : '')} onClick={() => void selectSchedule(item)} disabled={!!loadingSelection || (!!selectedTurmaId && !!item.turma_id && selectedTurmaId !== item.turma_id)}>
                      <strong>{String(item.hora_inicio).slice(0, 5)}</strong>
                      <span>até {String(item.hora_fim).slice(0, 5)}</span>
                      <small>{hasExisting ? (modalidade === 'grupo' ? `${item.participantes}/${item.capacidade} alunos • ${item.vagas_restantes} vaga(s)` : 'Dupla com 1 aluno • 1 vaga') : 'Horário livre • será sua nova turma'}</small>
                      <em>{money(displayPrice)} /mês</em>
                    </button>
                  })}
                </div>
              </>}
            </div>}           <div className="collective-selection-summary"><strong>{selectedSchedules.length}/{requiredSchedules} horários selecionados</strong><span>{selectedSchedules.length ? selectedSchedules.map(item => weekdays[item.dia_semana] + ' ' + String(item.hora_inicio).slice(0, 5)).join(' • ') : 'Selecione os horários acima.'}</span></div>
          </>}
          {step === 3 && <>
            <div className="enrollment-card-header"><span className="enrollment-card-number">3</span><div><h2>Confira sua matrícula</h2><p>Revise a condição e confirme para gerar o pagamento.</p></div></div>
            <div className="collective-review">
              <div><span>Modalidade</span><strong>{modalidade === 'grupo' ? 'Grupo' : 'Dupla'}</strong></div><div><span>Idioma</span><strong>{language ? languageLabel[language] : '-'}</strong></div><div><span>Frequência</span><strong>{frequency}x por semana</strong></div>
              <div><span>Condição</span><strong>{formationMode ? 'Formação — ' + (modalidade === 'grupo' ? '15%' : '10%') + ' de desconto' : 'Turma existente — ' + existingParticipants + ' aluno(s)'}</strong></div>
              <div className="collective-review-schedules"><span>Horários</span>{selectedSchedules.map(item => <strong key={item.id}>{weekdays[item.dia_semana]} • {String(item.hora_inicio).slice(0, 5)}–{String(item.hora_fim).slice(0, 5)}</strong>)}</div>
            </div>
            <div className="collective-price-highlight"><span>Mensalidade</span><strong>{money(monthlyPrice)}</strong><small>{formationMode ? 'Valor individual com desconto enquanto a formação é concluída.' : 'Valor da modalidade coletiva conforme a composição atual.'}</small></div>
            <div className="collective-security"><ShieldCheck size={20} /><span>O pagamento será processado no checkout. A senha do Portal do Aluno não é solicitada nesta matrícula.</span></div>
          </>}
          <div className="enrollment-actions">{step > 1 && <button type="button" className="enrollment-secondary-button" onClick={previousStep}><ChevronLeft size={17} /> Voltar</button>}{step < 3 ? <button type="button" className="enrollment-primary-button" onClick={() => void nextStep()}>Continuar <ArrowRight size={17} /></button> : <button type="button" className="enrollment-primary-button" onClick={() => void createEnrollment()} disabled={loading}>{loading ? <><Loader2 size={18} className="student-spin" /> Criando...</> : <>Gerar pagamento <ArrowRight size={17} /></>}</button>}</div>
        </section>
        <aside className="enrollment-summary collective-summary"><span className="enrollment-eyebrow">SUA MATRÍCULA</span><h3>{pageTitle}</h3><p>{language ? languageLabel[language] : 'Idioma não definido'} • {frequency}x por semana</p><div className="collective-summary-price"><strong>{money(monthlyPrice)}</strong><span>/mês</span></div><div className="collective-summary-note">{formationMode ? 'Você começa com ' + (modalidade === 'grupo' ? '15%' : '10%') + ' de desconto sobre a condição individual.' : 'Você está entrando em uma formação já iniciada.'}</div><div className="collective-summary-item"><CheckCircle2 size={17} /> Sem senha nesta matrícula</div><div className="collective-summary-item"><CheckCircle2 size={17} /> Horário compartilhado</div><div className="collective-summary-item"><CheckCircle2 size={17} /> Acesso ao portal após pagamento</div></aside>
      </div>
    </div></main>
  </div>
}
