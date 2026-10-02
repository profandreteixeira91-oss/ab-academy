import { useEffect, useState } from 'react'
import {
  ArrowRight,
  ChevronLeft,
  ShieldCheck,
  ExternalLink,
  FileText,
} from 'lucide-react'

import '../styles/matricula.css'
import logo from '../assets/logo_abacademy.png'
import { supabase } from '../lib/supabase'

type Language = 'ingles' | 'alemao'

type Plan = {
  id: string
  idioma: Language
  tipo: 'mensal' | 'anual' | 'personalizado' | 'intensivo' | 'avulso'
  modalidade: 'individual' | 'dupla' | 'grupo'
  nome: string
  descricao: string | null
  preco: number
  parcelas: number | null
  valor_parcela: number | null
  ativo: boolean
  created_at: string
  updated_at: string
  aulas_semana: number | null
  min_alunos: number | null
  max_alunos: number | null
}

type Horario = {
  id: string
  tipo_horario: 'individual' | 'dupla' | 'grupo'
  idioma: Language
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  disponivel: boolean
  aluno_id: string | null
  created_at: string
  meet_url: string | null
  meet_space_name: string | null
  turma_id: string | null
  participante_id: string | null
  participantes: number
  capacidade: number
  vagas_restantes: number
  valor_mensal: number | null
  status_formacao: string | null
  tipo_valor: 'individual' | 'coletiva_formada' | 'coletiva_em_formacao' | null
  professor_id: string | null
  nivel_referencia: string | null
}

type SelectedSchedule = {
  id: string
  date: string
  weekday: number
  hora_inicio: string
  hora_fim: string
  meet_url: string | null
  meet_space_name: string | null
  turma_id: string | null
  participante_id: string | null
  valor_mensal: number | null
  participantes: number | null
  capacidade: number | null
  status_formacao: string | null
  tipo_valor: 'individual' | 'coletiva_formada' | 'coletiva_em_formacao' | null
  professor_id: string | null
  nivel_referencia: string | null
}

type CollectiveCampaign = {
  turma_id: string
  idioma: Language
  modalidade: 'dupla' | 'grupo'
  aulas_semana: number
  data_inicio: string
  professor_id: string | null
  professor_nome: string | null
  participantes: number
  capacidade: number
  vagas_restantes: number
  nivel_referencia: string | null
  status_formacao: string
  horarios: Array<{
    horario_id: string
    dia_semana: number
    hora_inicio: string
    hora_fim: string
    ordem: number
  }>
}

type CollectiveLeadTarget = {
  campaign: CollectiveCampaign
  horario_id: string
}

type FormationSlot = {
  horario_id: string
  idioma: Language
  tipo_horario: 'dupla' | 'grupo'
  turma_id: string
  aulas_semana: number
  data_inicio: string
  professor_id: string | null
  nivel_referencia: string | null
  encontros: Array<{
    horario_id: string
    dia_semana: number
    hora_inicio: string
    hora_fim: string
    ordem: number
  }>
}

type CollectiveScheduleResponse = {
  turma_id: string
  horario_id: string
  idioma: Language
  modalidade: 'dupla' | 'grupo'
  aulas_semana: number
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  professor_id: string | null
  participantes: number
  capacidade: number
  vagas_restantes: number
  nivel_referencia: string | null
  status_formacao: string
}

type StudentData = {
  nome_completo: string
  cpf: string
  email: string
  data_nascimento: string
  telefone: string
  responsavel_nome: string | null
  responsavel_contato: string | null
  nivel_conversacao: string
  nivel_escrita: string
  nivel_compreensao: string
}

const WEEKDAYS = [
  { value: 1, label: 'Segunda-feira', short: 'Seg' },
  { value: 2, label: 'Terça-feira', short: 'Ter' },
  { value: 3, label: 'Quarta-feira', short: 'Qua' },
  { value: 4, label: 'Quinta-feira', short: 'Qui' },
  { value: 5, label: 'Sexta-feira', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
  { value: 0, label: 'Domingo', short: 'Dom' },
]

const formatCurrency = (
  value: number | string | null | undefined,
) => {
  const number = Number(value ?? 0)

  return number.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

const cleanDigits = (value: string) =>
  value.replace(/\D/g, '')

const formatCpf = (value: string) => {
  const digits = cleanDigits(value).slice(0, 11)

  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

const formatPhone = (value: string) => {
  const digits = cleanDigits(value).slice(0, 11)

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }

  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

const formatTime = (time: string) => {
  if (!time) return ''

  return time.slice(0, 5)
}

const getDateForWeekday = (weekday: number) => {
  const today = new Date()
  const currentDay = today.getDay()

  let difference = weekday - currentDay

  if (difference < 0) {
    difference += 7
  }

  const date = new Date(today)
  date.setDate(today.getDate() + difference)

  return date.toISOString().split('T')[0]
}

const formatDate = (date: string) => {
  if (!date) return ''

  const parsed = new Date(`${date}T12:00:00`)

  return parsed.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const getPlanTypeLabel = (tipo: string) => {
  if (tipo === 'anual') return 'Anual'
  if (tipo === 'mensal') return 'Mensal'
  if (tipo === 'personalizado') return 'Personalizado'
  if (tipo === 'intensivo') return 'Intensivo'
  if (tipo === 'avulso') return 'Avulso'
  return tipo
}

const getPlanPaymentDescription = (plan: Plan) => {
  if (plan.tipo === 'anual' && plan.parcelas && plan.valor_parcela) {
    return `${plan.parcelas}x de ${formatCurrency(
      plan.valor_parcela,
    )}`
  }

  return null
}

export default function Matricula() {

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingSchedules, setLoadingSchedules] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [email, setEmail] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [phone, setPhone] = useState('')
  const [responsibleName, setResponsibleName] = useState('')
  const [responsiblePhone, setResponsiblePhone] = useState('')
  const [language, setLanguage] = useState<Language | ''>('')
  const [conversationLevel, setConversationLevel] = useState('')
  const [writingLevel, setWritingLevel] = useState('')
  const [comprehensionLevel, setComprehensionLevel] = useState('')
  const [proficiencyFile, setProficiencyFile] = useState<File | null>(null)
  const [proficiencyProcessing, setProficiencyProcessing] = useState(false)
  const [proficiencyResult, setProficiencyResult] = useState<{ nivel_geral: string | null; nivel_conversacao: string | null; nivel_escrita: string | null; nivel_compreensao: string | null; observacoes?: string } | null>(null)
  const [contractAccepted, setContractAccepted] = useState(false)
  const [contractSignatureStatus, setContractSignatureStatus] = useState<'pending' | 'signed'>('pending')
  const [signatureName, setSignatureName] = useState('')
  const [signingContract, setSigningContract] = useState(false)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [collectiveEnrollment, setCollectiveEnrollment] = useState<{ token: string; turmaId: string; participanteId: string; valorMensal: number; condicaoMeses: number | null; condicaoInicio: string | null; condicaoFim: string | null } | null>(null)
  const [collectiveCampaigns, setCollectiveCampaigns] = useState<CollectiveCampaign[]>([])
  const [collectiveCampaignsLoading, setCollectiveCampaignsLoading] = useState(false)
  const [collectiveLeadTarget, setCollectiveLeadTarget] = useState<CollectiveLeadTarget | null>(null)
  const [collectiveLeadSaving, setCollectiveLeadSaving] = useState(false)
  const [availableSchedules, setAvailableSchedules] = useState<Horario[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState<SelectedSchedule | null>(null)
  const [selectedSchedules, setSelectedSchedules] = useState<SelectedSchedule[]>([])
  const [selectedWeekday, setSelectedWeekday] = useState<number | null>(null)
  const [expandedSchedulePeriods, setExpandedSchedulePeriods] = useState<Record<string, boolean>>({})
  const [availabilityMode, setAvailabilityMode] = useState<'periods' | 'ranges' | 'flexible'>('periods')
  const [availabilityDays, setAvailabilityDays] = useState<number[]>([])
  const [availabilityPeriods, setAvailabilityPeriods] = useState<string[]>([])
  const [availabilityRanges, setAvailabilityRanges] = useState<Record<number, { start: string; end: string }>>({})
  const [availabilityReady, setAvailabilityReady] = useState(false)
  const [scheduleLockedFromPlanos, setScheduleLockedFromPlanos] = useState(false)
  const [formationSlotId] = useState(() => new URLSearchParams(window.location.search).get('horario_id'))
  const [waitingFormation] = useState(() => new URLSearchParams(window.location.search).get('aguardando_formacao') === '1')
  const [reservaToken] = useState(() => crypto.randomUUID())
  const [collectiveFormationDiscount, setCollectiveFormationDiscount] = useState(false)
  const selectedLanguageLabel =
    language === 'ingles'
      ? 'Inglês'
      : language === 'alemao'
        ? 'Alemão'
        : ''

  const isCollectivePlan = plan?.modalidade === 'dupla' || plan?.modalidade === 'grupo'
  const isCollectiveEnrollmentFlow = isCollectivePlan
  const proficiencyTestUrl = import.meta.env.VITE_PROFICIENCY_TEST_URL as string | undefined
  const isWaitingFormation = waitingFormation
  const effectivePlan = plan


  const getSchedulePeriod = (time: string) => {
    const hour = Number(time.slice(0, 2))
    if (hour < 12) return 'manha'
    if (hour < 18) return 'tarde'
    return 'noite'
  }

  const schedulePeriodLabels: Record<string, string> = {
    manha: 'Manhã',
    tarde: 'Tarde',
    noite: 'Noite',
  }

  const groupedSchedules = WEEKDAYS.map(
    (weekday) => ({
      ...weekday,
      schedules: availableSchedules.filter(
        (item) => item.dia_semana === weekday.value,
      ),
    }),
  ).filter((weekday) => weekday.schedules.length > 0)

  const activeScheduleWeekday = selectedWeekday ?? groupedSchedules[0]?.value ?? null

  const visibleSchedules = activeScheduleWeekday === null
    ? []
    : availableSchedules.filter((item) =>
        item.dia_semana === activeScheduleWeekday
        && (!isCollectivePlan || !selectedSchedule?.turma_id || item.turma_id === selectedSchedule.turma_id)
      )

  const groupedSchedulePeriods = ['manha', 'tarde', 'noite']
    .map((period) => ({
      period,
      label: schedulePeriodLabels[period],
      schedules: visibleSchedules
        .filter((item) => getSchedulePeriod(item.hora_inicio) === period)
        .sort((a, b) => {
          const formationA = a.participantes > 0 && a.participantes < a.capacidade ? 0 : a.participantes === a.capacidade ? 1 : 2
          const formationB = b.participantes > 0 && b.participantes < b.capacidade ? 0 : b.participantes === b.capacidade ? 1 : 2
          return formationA - formationB || a.hora_inicio.localeCompare(b.hora_inicio)
        }),
    }))
    .filter((group) => group.schedules.length > 0)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const diagnosticRequested = params.get('diagnostica') === '1'
    const requestedLanguage = params.get('idioma')
    const requestedPlanId = params.get('plano')
    const requestedModality = params.get('modalidade')
    const requestedTurmaId = params.get('turma_id')
    const requestedHorarioIds = Array.from(new Set([
      ...((params.get('horario_ids') ?? '').split(',').map((id) => id.trim()).filter(Boolean)),
      ...(params.get('horario_id') ? [params.get('horario_id') as string] : []),
    ]))
    const turmaToken = params.get('turma_token')

    const loadCollectiveEnrollment = async (token: string) => {
      const { data, error } = await supabase
        .from('turma_matriculas')
        .select('token,turma_id,participante_id,valor_mensal,condicao_meses,condicao_inicio,condicao_fim,status,turma:turmas(id,idioma,modalidade,aulas_semana,status),participante:turma_participantes(id,nome,email,status)')
        .eq('token', token)
        .eq('status', 'liberada')
        .maybeSingle()

      if (error || !data || !data.turma || !data.participante || data.turma.status !== 'pronta' || data.participante.status !== 'confirmado') {
        setError('Este link de matrícula coletiva não está mais disponível.')
        return false
      }

      const turma = data.turma as {
        id: string
        idioma: Language
        modalidade: 'dupla' | 'grupo'
        aulas_semana: number
        status: string
      }

      const { data: collectivePlan, error: collectivePlanError } = await supabase
        .from('planos')
        .select('id, idioma, tipo, nome, descricao, preco, parcelas, valor_parcela, ativo, created_at, updated_at, modalidade, aulas_semana, min_alunos, max_alunos')
        .eq('idioma', turma.idioma)
        .eq('modalidade', turma.modalidade)
        .eq('tipo', 'mensal')
        .eq('aulas_semana', turma.aulas_semana)
        .eq('ativo', true)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (collectivePlanError || !collectivePlan) {
        console.error('Erro ao carregar plano coletivo do link:', collectivePlanError)
        setError('O plano coletivo desta turma não está mais disponível.')
        return false
      }

      const selectedPlan = collectivePlan as Plan

      setCollectiveEnrollment({
        token: data.token,
        turmaId: data.turma_id,
        participanteId: data.participante_id,
        valorMensal: Number(data.valor_mensal),
        condicaoMeses: data.condicao_meses,
        condicaoInicio: data.condicao_inicio,
        condicaoFim: data.condicao_fim,
      })
      setLanguage(turma.idioma)
      setPlan(selectedPlan)
      await initializeCollectiveScheduleFromTurma(selectedPlan, data.turma_id)
      setSuccess('Sua turma foi formada. Os horários e a condição comercial foram carregados. Complete seus dados para iniciar a matrícula coletiva.')
      return true
    }

    const initializeEnrollment = async () => {
      if (turmaToken) {
        await loadCollectiveEnrollment(turmaToken)
        return
      }
      const selectedLanguage: Language =
        requestedLanguage === 'alemao' ? 'alemao' : 'ingles'

      if (waitingFormation && requestedPlanId) {
        const { data: waitingPlan } = await supabase
          .from('planos')
          .select('tipo')
          .eq('id', requestedPlanId)
          .maybeSingle()
        if (waitingPlan?.tipo !== 'mensal') {
          setError('A condição de 10% para aguardar a formação está disponível no plano mensal.')
          return
        }
      }

      if (diagnosticRequested) {
        setLanguage(selectedLanguage)

        if (requestedPlanId) {
          await loadSelectedPlan(selectedLanguage, requestedPlanId)
        } else {
          const { data, error: diagnosticError } = await supabase
            .from('planos')
            .select('id, idioma, tipo, nome, descricao, preco, parcelas, valor_parcela, ativo, created_at, updated_at, modalidade, aulas_semana, min_alunos, max_alunos')
            .eq('idioma', selectedLanguage)
            .eq('tipo', 'avulso')
            .eq('ativo', true)
            .ilike('nome', '%diagn%')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (diagnosticError) {
            console.error('Erro ao carregar plano da aula diagnóstica:', diagnosticError)
            setError('Não foi possível carregar o plano da aula diagnóstica.')
            return
          }

          if (!data) {
            setError('O plano da aula diagnóstica não está disponível para este idioma.')
            return
          }

          setPlan(data as Plan)
        }

        setSuccess('Você está agendando uma aula diagnóstica avulsa.')
        return
      }

      if (requestedLanguage !== 'ingles' && requestedLanguage !== 'alemao') {
        setError('Selecione um plano na página de planos para iniciar sua matrícula.')
        return
      }

      setLanguage(requestedLanguage)

      if (requestedPlanId) {
        const loadedPlan = await loadSelectedPlan(requestedLanguage, requestedPlanId)

        if (!loadedPlan) return

        if (loadedPlan.modalidade === 'dupla' || loadedPlan.modalidade === 'grupo') {
          await initializeCollectiveScheduleFromPlanos(
            loadedPlan,
            requestedTurmaId,
            requestedHorarioIds,
            params.get('formacao_coletiva') === '1',
          )
        }

        return
      }

      if (requestedModality === 'dupla' || requestedModality === 'grupo') {
        // Modalidades coletivas usam fluxo próprio: o plano individual serve
        // apenas como referência para a condição de formação e o preço final
        // depende da existência de uma turma compatível.
        const aulasSemanaPadrao = requestedModality === 'dupla' ? 1 : 2
        const { data: collectivePlan, error: collectivePlanError } = await supabase
          .from('planos')
          .select('id, idioma, tipo, nome, descricao, preco, parcelas, valor_parcela, ativo, created_at, updated_at, modalidade, aulas_semana, min_alunos, max_alunos')
          .eq('idioma', requestedLanguage)
          .eq('modalidade', requestedModality)
          .eq('tipo', 'mensal')
          .eq('aulas_semana', aulasSemanaPadrao)
          .eq('ativo', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (collectivePlanError || !collectivePlan) {
          console.error('Erro ao carregar plano coletivo da matrícula:', collectivePlanError)
          setError('Não foi possível carregar a modalidade selecionada. Volte e tente novamente.')
          return
        }

        setPlan(collectivePlan as Plan)
        return
      }

      if (!requestedPlanId) {
        setError('Nenhum plano foi selecionado. Volte à página de planos e escolha uma opção.')
        return
      }
    }

    void initializeEnrollment()
  }, [])


  const loadSelectedPlan = async (
    selectedLanguage: Language,
    selectedPlanId: string,
  ): Promise<Plan | null> => {
    const { data, error: planError } = await supabase
      .from('planos')
      .select('id, idioma, tipo, nome, descricao, preco, parcelas, valor_parcela, ativo, created_at, updated_at, modalidade, aulas_semana, min_alunos, max_alunos')
      .eq('id', selectedPlanId)
      .eq('idioma', selectedLanguage)
      .eq('ativo', true)
      .maybeSingle()

    if (planError) {
      console.error('Erro ao carregar plano selecionado:', planError)
      setError('Não foi possível carregar o plano selecionado.')
      return null
    }

    if (!data) {
      setError('O plano selecionado não está mais disponível. Volte à página de planos e escolha outro.')
      return null
    }

    const selectedPlan = data as Plan
    setPlan(selectedPlan)
    return selectedPlan
  }

  const initializeCollectiveScheduleFromTurma = async (
    selectedPlan: Plan,
    turmaId: string,
  ) => {
    if (selectedPlan.modalidade !== 'dupla' && selectedPlan.modalidade !== 'grupo') return

    setLoadingSchedules(true)
    setError('')

    try {
      const { data: relations, error: relationsError } = await supabase
        .from('turma_horarios')
        .select('horario_id,ordem,horario:horarios(id,dia_semana,hora_inicio,hora_fim,idioma,tipo_horario,professor_id,nivel_referencia)')
        .eq('turma_id', turmaId)
        .order('ordem', { ascending: true })

      if (relationsError || !relations) {
        console.error('Erro ao carregar encontros da turma:', relationsError)
        setError('Não foi possível carregar os horários fixos da turma.')
        return
      }

      const aulasSemana = selectedPlan.aulas_semana ?? (selectedPlan.modalidade === 'dupla' ? 1 : 2)
      if (relations.length !== aulasSemana) {
        setError('A turma não possui todos os encontros semanais configurados.')
        return
      }

      const mappedSchedules: SelectedSchedule[] = relations
        .map((relation) => {
          const horario = relation.horario as {
            id: string
            dia_semana: number
            hora_inicio: string
            hora_fim: string
            idioma: Language
            tipo_horario: 'dupla' | 'grupo'
            professor_id: string | null
            nivel_referencia: string | null
          } | null

          if (!horario) return null

          return {
            id: horario.id,
            date: getDateForWeekday(horario.dia_semana),
            weekday: horario.dia_semana,
            hora_inicio: horario.hora_inicio,
            hora_fim: horario.hora_fim,
            meet_url: null,
            meet_space_name: null,
            turma_id: turmaId,
            participante_id: null,
            valor_mensal: Number(selectedPlan.preco),
            participantes: null,
            capacidade: null,
            status_formacao: selectedPlan.modalidade === 'dupla' ? 'dupla_formada' : 'grupo_formado',
            tipo_valor: 'coletiva_formada',
            professor_id: horario.professor_id,
            nivel_referencia: horario.nivel_referencia,
          }
        })
        .filter((schedule): schedule is SelectedSchedule => schedule !== null)

      if (mappedSchedules.length !== aulasSemana) {
        setError('Um ou mais encontros da turma não foram encontrados.')
        return
      }

      setSelectedSchedules(mappedSchedules)
      setSelectedSchedule(mappedSchedules[0] ?? null)
      setScheduleLockedFromPlanos(true)
      setAvailabilityReady(true)
      setSelectedWeekday(mappedSchedules[0]?.weekday ?? null)
      setStep(4)
    } finally {
      setLoadingSchedules(false)
    }
  }

  const initializeCollectiveScheduleFromPlanos = async (
    selectedPlan: Plan,
    requestedTurmaId: string | null,
    requestedHorarioIds: string[],
    formationDiscount = false,
  ) => {
    if (selectedPlan.modalidade !== 'dupla' && selectedPlan.modalidade !== 'grupo') {
      return
    }

    if (requestedHorarioIds.length === 0) {
      setError('O horário coletivo não foi informado. Volte à página de planos e escolha uma turma.')
      return
    }

    setLoadingSchedules(true)
    setError('')
    setSuccess('')

    try {
      const aulasSemana = selectedPlan.aulas_semana ?? (selectedPlan.modalidade === 'dupla' ? 1 : 2)
      const { data, error: schedulesError } = await supabase.rpc('listar_horarios_coletivos_matricula', {
        p_idioma: selectedPlan.idioma,
        p_modalidade: selectedPlan.modalidade,
        p_aulas_semana: aulasSemana,
        p_dias: null,
        p_periodos: null,
        p_disponibilidade: null,
      })

      if (schedulesError) {
        console.error('Erro ao recuperar horário escolhido em Planos:', schedulesError)
        setError('Não foi possível recuperar a turma escolhida em Planos. Volte e tente novamente.')
        return
      }

      const rows = (data ?? []) as CollectiveScheduleResponse[]
      const firstRequestedId = requestedHorarioIds[0]
      const firstCandidate = rows.find((row) =>
        row.horario_id === firstRequestedId
        && (!requestedTurmaId || row.turma_id === requestedTurmaId),
      )

      if (!firstCandidate) {
        setError('A turma escolhida em Planos não está mais disponível. Volte a Planos e escolha outra.')
        return
      }

      const turmaId = requestedTurmaId ?? firstCandidate.turma_id
      const selectedRows = rows
        .filter((row) => row.turma_id === turmaId)
        .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio))

      if (selectedRows.length !== aulasSemana) {
        setError('A turma escolhida não possui todos os encontros semanais configurados. Volte a Planos e escolha outra.')
        return
      }

      const selectedIds = new Set(requestedHorarioIds)
      if (requestedHorarioIds.length !== aulasSemana || selectedRows.some((row) => !selectedIds.has(row.horario_id))) {
        setError('Os horários enviados por Planos não correspondem à composição completa da turma.')
        return
      }

      if (firstCandidate.participantes >= firstCandidate.capacidade) {
        setError('A turma escolhida acabou de ser preenchida. Volte a Planos e escolha outra.')
        return
      }

      const applyFormationDiscount = formationDiscount && Number(firstCandidate.participantes ?? 0) === 0
      setCollectiveFormationDiscount(applyFormationDiscount)

      const formationPrice = Math.round(Number(selectedPlan.preco) * 0.9 * 100) / 100
      const mappedSchedules: SelectedSchedule[] = selectedRows.map((row) => ({
        id: row.horario_id,
        date: getDateForWeekday(row.dia_semana),
        weekday: row.dia_semana,
        hora_inicio: row.hora_inicio,
        hora_fim: row.hora_fim,
        meet_url: null,
        meet_space_name: null,
        turma_id: row.turma_id,
        participante_id: null,
        valor_mensal: applyFormationDiscount ? formationPrice : Number(selectedPlan.preco),
        participantes: row.participantes,
        capacidade: row.capacidade,
        status_formacao: row.status_formacao,
        tipo_valor: applyFormationDiscount ? 'coletiva_em_formacao' : 'coletiva_formada',
        professor_id: row.professor_id,
        nivel_referencia: row.nivel_referencia,
      }))

      setSelectedSchedules(mappedSchedules)
      setSelectedSchedule(mappedSchedules[0] ?? null)
      setScheduleLockedFromPlanos(true)
      setAvailabilityReady(true)
      setSelectedWeekday(mappedSchedules[0]?.weekday ?? null)
      setStep(1)
      setSuccess(
        applyFormationDiscount ? `Turma confirmada a partir de Planos. Condição de formação: ${formatCurrency(formationPrice)}/mês.` : `Turma confirmada a partir de Planos. Valor da modalidade: ${formatCurrency(Number(selectedPlan.preco))}/mês.`,
      )
    } finally {
      setLoadingSchedules(false)
    }
  }

  const loadCollectiveCampaigns = async (selectedPlan: Plan) => {
    setCollectiveCampaignsLoading(true)
    setError('')

    try {
      const aulasSemana = selectedPlan.aulas_semana ?? (selectedPlan.modalidade === 'dupla' ? 1 : 2)
      const { data, error: campaignsError } = await supabase.rpc('listar_turmas_coletivas_matricula', {
        p_idioma: selectedPlan.idioma,
        p_modalidade: selectedPlan.modalidade,
        p_aulas_semana: aulasSemana,
      })

      if (campaignsError) {
        console.error('Erro ao carregar campanhas coletivas:', campaignsError)
        setCollectiveCampaigns([])
        setError('Não foi possível carregar as turmas disponíveis.')
        return
      }

      setCollectiveCampaigns((data ?? []) as CollectiveCampaign[])
    } finally {
      setCollectiveCampaignsLoading(false)
    }
  }

  useEffect(() => {
    if (plan && (plan.modalidade === 'dupla' || plan.modalidade === 'grupo')) {
      void loadCollectiveCampaigns(plan)
    } else {
      setCollectiveCampaigns([])
    }
  }, [plan?.id, plan?.modalidade, plan?.aulas_semana])

  const loadSchedules = async (
    selectedLanguage: Language,
    withAvailability = availabilityReady,
  ): Promise<boolean> => {
    setLoadingSchedules(true)
    setError('')

    try {
      if (!plan) {
        setError('O plano selecionado ainda não foi carregado.')
        setAvailableSchedules([])
        return false
      }

      if (formationSlotId && waitingFormation) {
        const { data: response, error: formationError } = await supabase.functions.invoke('list-formation-slots', {
          body: { horario_id: formationSlotId },
        })
        const data = response?.data?.[0]

        if (formationError || !data || data.idioma !== selectedLanguage) {
          setError('O horário de formação selecionado não está mais disponível.')
          setAvailableSchedules([])
          return false
        }

        setAvailableSchedules([{
          id: data.horario_id,
          tipo_horario: data.tipo_horario,
          idioma: data.idioma,
          dia_semana: data.dia_semana,
          hora_inicio: data.hora_inicio,
          hora_fim: data.hora_fim,
          disponivel: true,
          aluno_id: null,
          created_at: '',
          meet_url: null,
          meet_space_name: null,
          turma_id: null,
          participante_id: null,
          participantes: data.interessados ?? 0,
          capacidade: data.quantidade_maxima ?? (plan.modalidade === 'dupla' ? 2 : 3),
          vagas_restantes: Math.max(0, (data.quantidade_maxima ?? (plan.modalidade === 'dupla' ? 2 : 3)) - (data.interessados ?? 0)),
          valor_mensal: null,
          status_formacao: plan.modalidade === 'dupla' ? 'dupla_em_formacao' : 'grupo_em_formacao',
          tipo_valor: 'coletiva_em_formacao',
          professor_id: data.professor_id ?? null,
          nivel_referencia: data.nivel_referencia ?? null,
        }])
        return true
      }

      const modalidade = plan.modalidade
      const aulasSemana = plan.aulas_semana ?? (plan.tipo === 'intensivo' ? 3 : plan.tipo === 'personalizado' ? 2 : 1)

      if (isCollectivePlan) {
        const { data: fixedSchedules, error: collectiveError } = await supabase.rpc('listar_horarios_coletivos_matricula', {
          p_idioma: selectedLanguage,
          p_modalidade: modalidade,
          p_aulas_semana: aulasSemana,
          p_dias: withAvailability && availabilityMode !== 'flexible' ? availabilityDays : null,
          p_periodos: withAvailability && availabilityMode === 'periods' ? availabilityPeriods : null,
          p_disponibilidade: withAvailability && availabilityMode === 'ranges' && Object.keys(availabilityRanges).length > 0
            ? availabilityRanges
            : null,
        })

        if (collectiveError) {
          console.error('Erro ao buscar horários coletivos fixos:', collectiveError)
          setError('Não foi possível consultar os horários coletivos disponíveis.')
          setAvailableSchedules([])
          return false
        }

        const formationPriceResponse = await supabase.rpc('preco_formacao_coletiva', {
          p_idioma: selectedLanguage,
          p_modalidade: modalidade,
          p_aulas_semana: aulasSemana,
        })
        const formationPrice = Number(formationPriceResponse.data ?? 0)
        const regularPriceCache = new Map<number, number>()

        const getRegularPrice = async (participants: number) => {
          if (regularPriceCache.has(participants)) return regularPriceCache.get(participants) as number
          const { data: price, error: priceError } = await supabase.rpc('preco_coletivo', {
            p_idioma: selectedLanguage,
            p_modalidade: modalidade,
            p_aulas_semana: aulasSemana,
            p_quantidade_alunos: participants,
          })
          if (priceError) {
            console.error('Erro ao consultar preço coletivo:', priceError)
            return null
          }
          const value = Number(price ?? 0)
          regularPriceCache.set(participants, value)
          return value
        }

        const schedules: Horario[] = []
        const turmaIds = new Set<string>()

        for (const item of fixedSchedules ?? []) {
          const participantes = Number(item.participantes ?? 0)
          const capacidade = Number(item.capacidade ?? (modalidade === 'dupla' ? 2 : 3))
          const formsOnJoin = participantes === 0
          const valorMensal = formsOnJoin
            ? formationPrice
            : await getRegularPrice(Math.min(participantes + 1, capacidade))

          schedules.push({
            id: String(item.horario_id),
            tipo_horario: modalidade,
            idioma: selectedLanguage,
            dia_semana: Number(item.dia_semana),
            hora_inicio: String(item.hora_inicio),
            hora_fim: String(item.hora_fim),
            disponivel: true,
            aluno_id: null,
            created_at: '',
            meet_url: null,
            meet_space_name: null,
            turma_id: String(item.turma_id),
            participante_id: null,
            participantes,
            capacidade,
            vagas_restantes: Number(item.vagas_restantes ?? 0),
            valor_mensal: valorMensal > 0 ? valorMensal : null,
            status_formacao: String(item.status_formacao ?? ''),
            tipo_valor: formsOnJoin ? 'coletiva_em_formacao' : 'coletiva_formada',
            professor_id: item.professor_id ?? null,
            nivel_referencia: item.nivel_referencia ?? null,
          })
          turmaIds.add(String(item.turma_id))
        }

        if (schedules.length === 0) {
          setError('Não encontramos horários coletivos fixos compatíveis com os dias e períodos informados.')
          setAvailableSchedules([])
          return false
        }

        // Mantém apenas encontros de turmas completas para a frequência escolhida.
        const completeTurmaIds = new Set<string>()
        for (const turmaId of turmaIds) {
          const count = schedules.filter((item) => item.turma_id === turmaId).length
          if (count === aulasSemana) completeTurmaIds.add(turmaId)
        }
        const filtered = schedules.filter((item) => completeTurmaIds.has(item.turma_id || ''))
        setAvailableSchedules(filtered)
        return filtered.length > 0
      }

      const { data, error: schedulesError } = await supabase.rpc('listar_horarios_matricula_inteligente', {
        p_idioma: selectedLanguage,
        p_modalidade: modalidade,
        p_aulas_semana: aulasSemana,
        p_dias: withAvailability && availabilityMode !== 'flexible' ? availabilityDays : null,
        p_periodos: withAvailability && availabilityMode === 'periods' ? availabilityPeriods : null,
        p_disponibilidade: withAvailability && availabilityMode === 'ranges' && Object.keys(availabilityRanges).length > 0
          ? availabilityRanges
          : null,
      })

      if (schedulesError) {
        console.error('Erro ao carregar horários:', schedulesError)
        setError('Não foi possível carregar os horários disponíveis.')
        setAvailableSchedules([])
        return false
      }

      setAvailableSchedules((data ?? []).map((item) => ({
        ...item,
        valor_mensal: item.valor_mensal ?? item.valor_final ?? null,
      })) as Horario[])
      return true
    } finally {
      setLoadingSchedules(false)
    }
  }


  const validatePersonalData = () => {
    const cleanCpf = cleanDigits(cpf)
    const cleanPhone = cleanDigits(phone)
    const cleanResponsiblePhone =
      cleanDigits(responsiblePhone)

    if (!name.trim()) {
      setError(
        'Informe seu nome completo.',
      )
      return false
    }

    if (cleanCpf.length !== 11) {
      setError(
        'Informe um CPF válido.',
      )
      return false
    }

    if (!email.trim()) {
      setError(
        'Informe seu e-mail.',
      )
      return false
    }

    if (!birthDate) {
      setError(
        'Informe sua data de nascimento.',
      )
      return false
    }

    if (cleanPhone.length < 10) {
      setError(
        'Informe um telefone/WhatsApp válido.',
      )
      return false
    }

    if (
      responsibleName.trim() &&
      cleanResponsiblePhone.length < 10
    ) {
      setError(
        'Informe um contato válido para o responsável.',
      )
      return false
    }

    return true
  }

  const getRequiredWeeklyLessons = () =>
    plan?.aulas_semana ?? (plan?.tipo === 'intensivo' ? 3 : plan?.tipo === 'personalizado' ? 2 : 1)

  const requiredWeeklyLessons = getRequiredWeeklyLessons()

  const selectAvailabilityMode = (mode: 'periods' | 'ranges' | 'flexible') => {
    setAvailabilityMode(mode)
    if (mode === 'periods') {
      setAvailabilityRanges({})
    } else if (mode === 'ranges') {
      setAvailabilityPeriods([])
    } else {
      setAvailabilityDays([])
      setAvailabilityPeriods([])
      setAvailabilityRanges({})
    }
    setAvailabilityReady(false)
    setSelectedSchedule(null)
    setSelectedSchedules([])
  }

  const toggleAvailabilityDay = (day: number) => {
    setError('')
    setAvailabilityDays((current) => {
      if (current.includes(day)) {
        setAvailabilityRanges((ranges) => {
          const next = { ...ranges }
          delete next[day]
          return next
        })
        setAvailabilityReady(false)
        setSelectedSchedule(null)
        setSelectedSchedules([])
        return current.filter((item) => item !== day)
      }

      if (current.length >= requiredWeeklyLessons) {
        setError(
          requiredWeeklyLessons === 1
            ? 'Este plano tem 1 aula por semana. Escolha apenas 1 dia.'
            : `Este plano tem ${requiredWeeklyLessons} aulas por semana. Escolha exatamente ${requiredWeeklyLessons} dias diferentes.`,
        )
        return current
      }

      setAvailabilityReady(false)
      setSelectedSchedule(null)
      setSelectedSchedules([])
      return [...current, day]
    })
  }

  const toggleAvailabilityPeriod = (period: string) => {
    setError('')
    setAvailabilityReady(false)
    setSelectedSchedule(null)
    setSelectedSchedules([])
    setAvailabilityPeriods((current) =>
      current.includes(period)
        ? current.filter((item) => item !== period)
        : [...current, period],
    )
  }

  const setAvailabilityRange = (
    day: number,
    field: 'start' | 'end',
    value: string,
  ) => {
    setError('')
    setAvailabilityReady(false)
    setSelectedSchedule(null)
    setSelectedSchedules([])
    setAvailabilityRanges((current) => ({
      ...current,
      [day]: {
        start: current[day]?.start ?? '08:00',
        end: current[day]?.end ?? '22:00',
        [field]: value,
      },
    }))
  }

  const validateSchedule = () => {
    if (selectedSchedules.length !== requiredWeeklyLessons) {
      setError(
        requiredWeeklyLessons === 1
          ? 'Selecione 1 horário para continuar.'
          : `Selecione exatamente ${requiredWeeklyLessons} horários, um em cada dia da semana escolhido.`,
      )
      return false
    }

    if (!selectedSchedule) {
      setError('Selecione um horário disponível.')
      return false
    }

    const selectedDays = new Set(selectedSchedules.map((item) => item.weekday))
    if (selectedDays.size !== requiredWeeklyLessons) {
      setError(
        requiredWeeklyLessons === 1
          ? 'Escolha 1 dia da semana.'
          : `Escolha ${requiredWeeklyLessons} dias diferentes da semana para suas ${requiredWeeklyLessons} aulas.`,
      )
      return false
    }

    return true
  }

  const processProficiencyDocument = async () => {
    setError('')
    setSuccess('')

    if (!proficiencyFile) {
      setError('Anexe o documento gerado pelo teste de proficiência.')
      return
    }
    if (!proficiencyTestUrl) {
      setError('O link externo do teste de proficiência ainda não foi configurado pela AB Academy.')
      return
    }

    setProficiencyProcessing(true)
    try {
      const formData = new FormData()
      formData.append('reserva_token', reservaToken)
      formData.append('idioma', language)
      formData.append('arquivo', proficiencyFile)

      const { data, error: functionError } = await supabase.functions.invoke('processar-teste-proficiencia', {
        body: formData,
      })

      if (functionError) throw new Error(functionError.message || 'Não foi possível analisar o documento.')
      if (!data?.success || !data?.resultado) throw new Error(data?.error || 'O documento não apresentou um resultado de proficiência utilizável.')

      const result = data.resultado
      setProficiencyResult(result)
      setConversationLevel(result.nivel_conversacao || result.nivel_geral || '')
      setWritingLevel(result.nivel_escrita || result.nivel_geral || '')
      setComprehensionLevel(result.nivel_compreensao || result.nivel_geral || '')
      setSuccess('Teste de proficiência analisado com sucesso.')
    } catch (processingError) {
      console.error('Erro ao processar proficiência:', processingError)
      setProficiencyResult(null)
      setConversationLevel('')
      setWritingLevel('')
      setComprehensionLevel('')
      setError(processingError instanceof Error ? processingError.message : 'Não foi possível analisar o documento.')
    } finally {
      setProficiencyProcessing(false)
    }
  }

  const signContractInternally = async () => {
    setError('')
    setSuccess('')

    if (!contractAccepted) {
      setError('Leia e aceite o contrato antes de assinar.')
      return
    }

    const signerName = signatureName.trim()
    if (!signerName) {
      setError('Digite seu nome completo para registrar a assinatura.')
      return
    }

    if (!name.trim() || !cpf.trim() || !email.trim()) {
      setError('Complete seus dados pessoais antes de assinar o contrato.')
      return
    }

    if (signerName.toLocaleLowerCase() !== name.trim().toLocaleLowerCase()) {
      setError('O nome da assinatura deve corresponder exatamente ao nome completo informado no cadastro.')
      return
    }

    setSigningContract(true)

    try {
      const { error: startError } = await supabase.rpc('iniciar_assinatura_interna_matricula', {
        p_reserva_token: reservaToken,
        p_nome: name.trim(),
        p_cpf: cleanDigits(cpf),
        p_email: email.trim().toLowerCase(),
        p_versao_contrato: 'estrutura-interna-v1',
        p_hash_contrato: null,
      })

      if (startError) {
        throw new Error(startError.message || 'Não foi possível preparar a assinatura.')
      }

      const { error: signatureError } = await supabase.rpc('assinar_matricula_internamente', {
        p_reserva_token: reservaToken,
        p_nome_assinatura: signerName,
        p_hash_assinatura: null,
      })

      if (signatureError) {
        throw new Error(signatureError.message || 'Não foi possível registrar a assinatura.')
      }

      setContractSignatureStatus('signed')
      setSuccess('Assinatura interna registrada com sucesso.')
    } catch (signatureError) {
      console.error('Erro ao assinar contrato internamente:', signatureError)
      setContractSignatureStatus('pending')
      setError(signatureError instanceof Error ? signatureError.message : 'Não foi possível registrar a assinatura.')
    } finally {
      setSigningContract(false)
    }
  }

  const nextStep = async () => {
    setError('')
    setSuccess('')

    if (isCollectiveEnrollmentFlow) {
      if (step === 1) {
        if (!plan || !scheduleLockedFromPlanos || !validateSchedule()) {
          setError('Confirme o plano e os horários selecionados em Planos antes de continuar.')
          return
        }
        setStep(2)
        return
      }
      if (step === 2) {
        if (!validatePersonalData()) return
        setStep(3)
        return
      }
      if (step === 3) {
        if (!contractAccepted || contractSignatureStatus !== 'signed') {
          setError('Leia, aceite e assine o contrato antes de continuar.')
          return
        }
        setStep(4)
        return
      }
      return
    }

    if (step === 1) {
      if (!plan && !collectiveEnrollment) {
        setError('O plano selecionado não está disponível.')
        return
      }

      setStep(2)
      return
    }

    if (step === 2) {
      if (availabilityMode !== 'flexible' && availabilityDays.length !== requiredWeeklyLessons) {
        setError(requiredWeeklyLessons === 1
          ? 'Escolha exatamente 1 dia da semana para sua aula.'
          : `Este plano tem ${requiredWeeklyLessons} aulas por semana. Escolha exatamente ${requiredWeeklyLessons} dias diferentes.`)
        return
      }
      if (availabilityMode === 'periods' && availabilityPeriods.length === 0) {
        setError('Selecione pelo menos um período disponível.')
        return
      }
      if (availabilityMode === 'ranges' && Object.keys(availabilityRanges).length === 0) {
        setError('Informe pelo menos uma faixa de horário.')
        return
      }
      if (!language) {
        setError('O idioma da matrícula não foi definido.')
        return
      }
      const schedulesLoaded = await loadSchedules(language, true)
      if (!schedulesLoaded) return
      setAvailabilityReady(true)
      setSelectedWeekday(null)
      setStep(3)
      return
    }

    if (step === 3) {
      if (!validateSchedule()) return
      setStep(4)
      return
    }

    if (step === 4) {
      if (!proficiencyResult || !conversationLevel || !writingLevel || !comprehensionLevel) {
        setError('Conclua o teste de proficiência e envie o documento para análise antes de continuar.')
        return
      }

      if (isCollectivePlan) {
        const selectedTurma = selectedSchedule?.turma_id
          ? availableSchedules.find((item) => item.turma_id === selectedSchedule.turma_id)
          : null
        const referenceLevel = selectedTurma?.nivel_referencia
        const studentLevel = conversationLevel || writingLevel || comprehensionLevel
        if (referenceLevel && referenceLevel.toUpperCase() !== studentLevel.toUpperCase()) {
          setError(`O horário selecionado está definido para o nível ${referenceLevel}. O resultado do seu teste foi ${studentLevel}. Escolha outro horário compatível.`)
          setStep(3)
          return
        }
      }

      setStep(5)
      return
    }

    if (step === 5) {
      if (!validatePersonalData()) return
      setStep(6)
    }
  }

  const previousStep = () => {
    setError('')
    setSuccess('')

    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleSelectSchedule = async (horario: Horario) => {
    setError('')

    const aulasSemana = plan?.aulas_semana ?? (plan?.tipo === 'intensivo' ? 3 : plan?.tipo === 'personalizado' ? 2 : 1)
    const requestedType: Horario['tipo_horario'] = plan?.modalidade || 'individual'
    const alreadySelected = selectedSchedules.some((item) => item.id === horario.id)

    if (alreadySelected) {
      const next = selectedSchedules.filter((item) => item.id !== horario.id)
      setSelectedSchedules(next)
      setSelectedSchedule(next[0] ?? null)
      return
    }

    if (selectedSchedules.length >= aulasSemana) {
      setError(`Este plano tem ${aulasSemana} aula(s) por semana. Você já selecionou todas as aulas necessárias.`)
      return
    }

    if (selectedSchedules.some((item) => item.weekday === horario.dia_semana)) {
      setError('Escolha apenas um horário por dia da semana. Selecione outro dia.')
      return
    }

    if (requestedType !== 'individual') {
      if (!horario.turma_id) {
        setError('Este horário não está vinculado a uma turma coletiva válida.')
        return
      }

      if (selectedSchedule?.turma_id && horario.turma_id !== selectedSchedule.turma_id) {
        setError('Para este plano, todos os horários devem pertencer à mesma turma. Escolha os outros encontros da turma já selecionada.')
        return
      }
    }

    const schedule: SelectedSchedule = {
      id: horario.id,
      date: getDateForWeekday(horario.dia_semana),
      weekday: horario.dia_semana,
      hora_inicio: horario.hora_inicio,
      hora_fim: horario.hora_fim,
      meet_url: horario.meet_url ?? null,
      meet_space_name: horario.meet_space_name ?? null,
      turma_id: horario.turma_id ?? null,
      participante_id: horario.participante_id ?? null,
      valor_mensal: horario.valor_mensal != null ? Number(horario.valor_mensal) : null,
      participantes: horario.participantes != null ? Number(horario.participantes) : null,
      capacidade: horario.capacidade != null ? Number(horario.capacidade) : null,
      status_formacao: horario.status_formacao ?? null,
      tipo_valor: horario.tipo_valor ?? null,
      professor_id: horario.professor_id ?? null,
      nivel_referencia: horario.nivel_referencia ?? null,
    }

    const next = [...selectedSchedules, schedule]
    setSelectedSchedules(next)
    setSelectedSchedule(next[0] ?? null)
  }


  const startCollectiveFromCampaign = (campaign: CollectiveCampaign) => {
    const mapped = campaign.horarios.slice().sort((a, b) => a.ordem - b.ordem).map((item) => ({
      id: item.horario_id, date: campaign.data_inicio, weekday: item.dia_semana, hora_inicio: item.hora_inicio, hora_fim: item.hora_fim,
      meet_url: null, meet_space_name: null, turma_id: campaign.turma_id, participante_id: null,
      valor_mensal: campaign.participantes === 0 ? Math.round(Number(plan?.preco ?? 0) * 0.9 * 100) / 100 : Number(plan?.preco ?? 0),
      participantes: campaign.participantes, capacidade: campaign.capacidade, status_formacao: campaign.status_formacao,
      tipo_valor: campaign.participantes === 0 ? 'coletiva_em_formacao' : 'coletiva_formada', professor_id: campaign.professor_id, nivel_referencia: campaign.nivel_referencia,
    }))
    if (mapped.length !== campaign.aulas_semana) { setError('A turma selecionada não possui todos os encontros semanais configurados.'); return }
    setCollectiveFormationDiscount(campaign.participantes === 0)
    setSelectedSchedules(mapped); setSelectedSchedule(mapped[0] ?? null); setScheduleLockedFromPlanos(true); setSelectedWeekday(mapped[0]?.weekday ?? null); setStep(1)
    setError(''); setSuccess('Turma selecionada. Confira o plano, os horários e o valor antes de continuar.')
  }

  const reserveCollectiveLead = async () => {
    if (!collectiveLeadTarget || !language) return
    if (!name.trim() || !email.trim() || cleanDigits(phone).length < 10) {
      setError('Informe nome, e-mail e WhatsApp para reservar a vaga.')
      return
    }

    setCollectiveLeadSaving(true)
    setError('')
    setSuccess('')

    const { error: leadError } = await supabase
      .from('leads')
      .insert({
        nome: name.trim(),
        email: email.trim().toLowerCase(),
        telefone: cleanDigits(phone),
        idioma_interesse: collectiveLeadTarget.campaign.idioma,
        objetivo: null,
        nivel: collectiveLeadTarget.campaign.nivel_referencia,
        origem: 'matricula',
        landing_page: window.location.pathname,
        status: 'novo',
        observacoes: `Reserva de vaga para turma com início em ${formatDate(collectiveLeadTarget.campaign.data_inicio)}.`,
        modalidade: collectiveLeadTarget.campaign.modalidade,
        quantidade_participantes: 1,
        horario_preferido: collectiveLeadTarget.campaign.horarios.map((item) => `${WEEKDAYS.find((day) => day.value === item.dia_semana)?.short ?? ''} ${formatTime(item.hora_inicio)}-${formatTime(item.hora_fim)}`).join(' | '),
        aulas_semana: collectiveLeadTarget.campaign.aulas_semana,
        formacao_turma: 'reservar_vaga',
        horario_id: collectiveLeadTarget.horario_id,
        turma_id: collectiveLeadTarget.campaign.turma_id,
      })

    if (leadError) {
      console.error('Erro ao registrar lead da turma:', leadError)
      setError('Não foi possível registrar sua reserva de vaga. Tente novamente.')
    } else {
      setCollectiveLeadTarget(null)
      setSuccess('Sua solicitação de vaga foi registrada. A equipe da AB Academy entrará em contato para confirmar a turma e os próximos passos.')
    }

    setCollectiveLeadSaving(false)
  }

  const reserveSelectedSchedules = async () => {
    if (!language || !effectivePlan || selectedSchedules.length === 0) return false

    const modalidade = effectivePlan.modalidade
    const aulasSemana = effectivePlan.aulas_semana ?? (effectivePlan.tipo === 'intensivo' ? 3 : effectivePlan.tipo === 'personalizado' ? 2 : 1)

    if (modalidade === 'individual') return true
    if (!name.trim() || !email.trim()) {
      setError('Informe seus dados pessoais antes de reservar o horário.')
      return false
    }

    const turmaId = selectedSchedules[0]?.turma_id
    if (!turmaId || selectedSchedules.some((item) => item.turma_id !== turmaId)) {
      setError('Todos os encontros devem pertencer à mesma turma fixa.')
      return false
    }

    const { data, error: selectionError } = await supabase.rpc('reservar_turma_matricula_publico', {
      p_turma_id: turmaId,
      p_horario_ids: selectedSchedules.map((item) => item.id),
      p_idioma: language,
      p_modalidade: modalidade,
      p_aulas_semana: aulasSemana,
      p_nivel_conversacao: conversationLevel || selectedSchedule?.nivel_referencia || '',
      p_nivel_escrita: writingLevel || selectedSchedule?.nivel_referencia || '',
      p_nivel_compreensao: comprehensionLevel || selectedSchedule?.nivel_referencia || '',
      p_reserva_token: reservaToken,
      p_nome: name.trim(),
      p_email: email.trim().toLowerCase(),
    })

    if (selectionError || !data) {
      const message = selectionError?.message || 'Esta turma acabou de ser preenchida.'
      setError(message)
      await loadSchedules(language, true)
      setSelectedSchedule(null)
      setSelectedSchedules([])
      return false
    }

    const participantId = data.participante_id ?? null
    const participants = Number(data.participantes ?? 0)
    const capacity = Number(data.capacidade ?? (modalidade === 'dupla' ? 2 : 3))
    const value = data.valor_mensal != null ? Number(data.valor_mensal) : null

    setSelectedSchedules((current) => current.map((item) => ({
      ...item,
      participante_id: participantId,
      participantes: participants,
      capacidade: capacity,
      valor_mensal: value,
      status_formacao: data.status_formacao ?? item.status_formacao,
      tipo_valor: data.tipo_valor ?? item.tipo_valor,
    })))
    setSelectedSchedule((current) => current ? {
      ...current,
      participante_id: participantId,
      participantes: participants,
      capacidade: capacity,
      valor_mensal: value,
      status_formacao: data.status_formacao ?? current.status_formacao,
      tipo_valor: data.tipo_valor ?? current.tipo_valor,
    } : current)

    return true
  }

  const verifyScheduleAgain = async (): Promise<SelectedSchedule[] | null> => {
    if (!language || !effectivePlan || selectedSchedules.length === 0) return null

    const aulasSemana = effectivePlan.aulas_semana ?? (effectivePlan.tipo === 'intensivo' ? 3 : effectivePlan.tipo === 'personalizado' ? 2 : 1)
    const modalidade = effectivePlan.modalidade
    const latestSchedules: SelectedSchedule[] = []

    for (const current of selectedSchedules) {
      const { data, error } = await supabase.rpc('analisar_horario_matricula', {
        p_horario_id: current.id,
        p_idioma: language,
        p_modalidade: modalidade,
        p_aulas_semana: aulasSemana,
      })

      if (error || !data?.[0]) {
        const message = error?.message || 'Este horário não está mais disponível.'
        setError(message.toLowerCase().includes('preenchido')
          ? 'Este horário acabou de ser preenchido. Atualizamos as opções disponíveis para você.'
          : message)
        await loadSchedules(language, true)
        setSelectedSchedule(null)
        setSelectedSchedules([])
        return null
      }

      const latest = data[0]
      latestSchedules.push({
        ...current,
        turma_id: latest.turma_id ?? current.turma_id ?? null,
        participantes: latest.quantidade_atual_alunos != null ? Number(latest.quantidade_atual_alunos) : current.participantes,
        capacidade: latest.capacidade != null ? Number(latest.capacidade) : current.capacidade,
        valor_mensal: latest.valor_final != null ? Number(latest.valor_final) : current.valor_mensal,
        status_formacao: latest.status_formacao ?? current.status_formacao ?? null,
        tipo_valor: latest.tipo_valor ?? current.tipo_valor ?? null,
        professor_id: latest.professor_id ?? current.professor_id ?? null,
      })
    }

    setSelectedSchedules(latestSchedules)
    setSelectedSchedule(latestSchedules[0] ?? null)
    return latestSchedules
  }

  const createEnrollment = async () => {
    if ((!plan && !collectiveEnrollment) || !selectedSchedule || selectedSchedules.length === 0 || !language) {
      setError(
        'Complete todas as etapas da matrícula.',
      )
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      let freshSchedules: SelectedSchedule[] | null

      const reserved = await reserveSelectedSchedules()
      if (!reserved) {
        setLoading(false)
        return
      }

      freshSchedules = await verifyScheduleAgain()
      if (!freshSchedules) {
        setLoading(false)
        return
      }

      const primarySchedule = freshSchedules[0]
      if (!primarySchedule) {
        setError('Nenhum horário válido foi confirmado.')
        setLoading(false)
        return
      }

      const authoritativeValue =
        effectivePlan?.tipo === 'anual' || effectivePlan?.tipo === 'avulso'
          ? Number(effectivePlan.preco)
          : Number(primarySchedule.valor_mensal ?? effectivePlan?.preco ?? 0)

      const cleanCpf = cleanDigits(cpf)
      const cleanPhone = cleanDigits(phone)
      const cleanResponsiblePhone =
        cleanDigits(responsiblePhone)

      const dadosAluno: StudentData = {
        nome_completo: name.trim(),
        cpf: cleanCpf,
        email: email.trim(),
        data_nascimento: birthDate,
        telefone: cleanPhone,
        responsavel_nome:
          responsibleName.trim() || null,
        responsavel_contato:
          cleanResponsiblePhone || null,
        nivel_conversacao:
          conversationLevel,
        nivel_escrita:
          writingLevel,
        nivel_compreensao:
          comprehensionLevel,
      }

      const payload = {
        plano_id: effectivePlan?.id ?? null,
        modalidade: effectivePlan?.modalidade ?? 'individual',
        idioma: language,
        tipo_plano: effectivePlan?.tipo ?? 'mensal',
        turma_token: collectiveEnrollment?.token ?? null,
        turma_participante_id: collectiveEnrollment?.participanteId ?? primarySchedule.participante_id ?? null,
        turma_id: collectiveEnrollment?.turmaId ?? primarySchedule.turma_id ?? null,

        objetivos: null,

        aulas_semana: effectivePlan?.tipo === 'avulso' ? null : (effectivePlan?.aulas_semana ?? (effectivePlan?.tipo === 'intensivo' ? 3 : effectivePlan?.tipo === 'personalizado' ? 2 : 1)),

        valor_aula: collectiveEnrollment ? null : effectivePlan?.tipo === 'avulso' ? Number(effectivePlan.preco) : effectivePlan?.tipo === 'anual' ? null : Number(effectivePlan?.preco ?? 0) / (effectivePlan?.tipo === 'intensivo' ? 12 : effectivePlan?.tipo === 'personalizado' ? 8 : 4),

        valor_mensal: collectiveEnrollment?.valorMensal ?? (isCollectivePlan ? primarySchedule.valor_mensal : (effectivePlan?.tipo === 'avulso' || effectivePlan?.tipo === 'anual' ? null : Number(effectivePlan?.preco ?? 0))),

        valor_anual: collectiveEnrollment ? null : effectivePlan?.tipo === 'anual' ? Number(effectivePlan.preco) : null,

        horario_ids: freshSchedules.map((item) => item.id),

        schedules: freshSchedules,

        dados_aluno: dadosAluno,
        reserva_token: reservaToken,

        valor: collectiveEnrollment?.valorMensal ?? (isCollectivePlan ? Number(primarySchedule.valor_mensal ?? 0) : authoritativeValue),
      }

      const {
        data,
        error: functionError,
      } =
        await supabase.functions.invoke(
          'create-enrollment',
          {
            body: payload,
          },
        )

      if (functionError) {
        console.error(
          'Erro create-enrollment:',
          functionError,
        )

        throw new Error(
          functionError.message ||
            'Não foi possível criar a matrícula.',
        )
      }

      if (
        !data?.success ||
        !data?.pagamento_id
      ) {
        throw new Error(
          data?.error ||
            'A matrícula não pôde ser criada.',
        )
      }

      setSuccess(
        'Matrícula criada. Redirecionando para o pagamento...',
      )

      window.location.assign(
        `/checkout/${data.pagamento_id}`,
      )
    } catch (submitError) {
      console.error(
        'Erro ao criar matrícula:',
        submitError,
      )

      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível concluir a matrícula.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="enrollment-page">
      <header className="enrollment-header">
        <a
          href="/"
          className="enrollment-logo"
        >
          <img
            src={logo}
            alt="AB Academy"
            className="academy-header-logo"
          />
        </a>

        <a
          href="/"
          className="enrollment-back"
        >
          Voltar
        </a>
      </header>

      <main className="enrollment-main">
        <div className="enrollment-container">
          <div className="enrollment-heading">
            <span className="enrollment-eyebrow">
              MATRÍCULA
            </span>

            <h1>
              Comece sua jornada na AB Academy
            </h1>

            <p>
              Confira seu plano, preencha seus dados e escolha o horário das aulas.
            </p>
          </div>

          <div className="enrollment-progress">
            {(isCollectiveEnrollmentFlow
              ? ['Plano e horário', 'Dados pessoais', 'Contrato', 'Confirmação e pagamento']
              : ['Plano selecionado', 'Plano', 'Horários', 'Disponibilidade', 'Proficiência', 'Dados pessoais', 'Contrato']
            ).map((label, index) => {
              const number = index + 1

              return (
                <div
                  key={label}
                  className={`enrollment-progress-step ${step >= number ? 'active' : ''} ${step > number ? 'completed' : ''}`}
                >
                  <div className="enrollment-progress-number">{number}</div>
                  <span>{label}</span>
                  {number < (isCollectiveEnrollmentFlow ? 4 : 7) && (
                    <div className="enrollment-progress-line" />
                  )}
                </div>
              )
            })}
          </div>

          <div className="enrollment-grid">
            <section className="enrollment-card">
              <div className="enrollment-card-header">
                <div className="enrollment-card-number">
                  {step}
                </div>

                <div>
                  <h2>
                    {isCollectiveEnrollmentFlow
                      ? step === 1
                        ? 'Confirmação do plano e horário'
                        : step === 2
                          ? 'Seus dados pessoais'
                          : step === 3
                            ? 'Contrato de matrícula'
                            : 'Confirmação e pagamento'
                      : step === 1
                        ? 'Plano selecionado'
                        : step === 2
                          ? 'Seleção inteligente de horários'
                          : step === 3
                            ? 'Horários compatíveis com você'
                            : step === 4
                              ? 'Teste de proficiência'
                              : step === 5
                                ? 'Seus dados pessoais'
                                : 'Contrato de matrícula'}
                  </h2>

                  <p>
                    {isCollectiveEnrollmentFlow
                      ? step === 1
                        ? 'Confira a modalidade coletiva, o horário fixo escolhido em Planos e a condição comercial aplicada.'
                        : step === 2
                          ? 'Informe os dados necessários para sua matrícula.'
                          : step === 3
                            ? 'Leia o contrato, aceite as condições e registre sua assinatura eletrônica.'
                            : 'Revise tudo o que será contratado antes de confirmar e seguir para o pagamento.'
                      : step === 1
                        ? 'Confira o plano escolhido na página de planos.'
                        : step === 2
                          ? 'Informe quando você pode estudar e encontre os horários fixos disponíveis.'
                          : step === 3
                            ? 'Escolha os encontros compatíveis encontrados pelo sistema.'
                            : step === 4
                              ? 'Faça o teste externo, anexe o documento e deixe o sistema analisar seu resultado.'
                              : step === 5
                                ? 'Informe os dados necessários para sua matrícula.'
                                : 'Leia o contrato e conclua a assinatura eletrônica. Depois, você seguirá para o pagamento.'}
                  </p>
                  </div>
                </div>

              {error && (
                <div
                  className="enrollment-error"
                  role="alert"
                >
                  {error}
                </div>
              )}

              {success && (
                <div
                  className="enrollment-success"
                  role="status"
                >
                  {success}
                </div>
              )}



              {step === 1 && (
                <div className="plan-selection">
                  <div className="selection-heading">
                    <div>
                      <h3>Plano selecionado</h3>
                      <p>Confira o idioma e o plano escolhido antes de continuar.</p>
                    </div>
                  </div>

                  {plan ? (
                    <div className="plan-card selected">
                      <div className="plan-card-top">
                        <div>
                          <span className="enrollment-plan-language">{selectedLanguageLabel}</span>
                          <h3>{plan.nome}</h3>
                          {plan.descricao && <p>{plan.descricao}</p>}
                        </div>
                        <span className="selection-radio" />
                      </div>
                      <div className="plan-price">
                        {isCollectiveEnrollmentFlow && collectiveFormationDiscount
                          ? formatCurrency(Math.round(Number(plan.preco) * 0.9 * 100) / 100)
                          : formatCurrency(plan.preco)}
                        <span> / mês</span>
                      </div>
                      {getPlanPaymentDescription(plan) && (
                        <div className="plan-installment">{getPlanPaymentDescription(plan)}</div>
                      )}
                    </div>
                  ) : (
                    <div className="enrollment-empty">Carregando plano selecionado...</div>
                  )}

                  <a href="/planos" className="enrollment-change-plan">Alterar plano</a>
                </div>
              )}

    

              {isCollectiveEnrollmentFlow && scheduleLockedFromPlanos && step === 1 && (
                <div className="collective-campaign-section">
                  <div className="selection-heading"><div><h3>Plano e horário confirmados</h3><p>Estas informações foram trazidas diretamente da seleção realizada na página Planos.</p></div></div>
                  <div className="availability-selection-summary">
                    <strong>{plan?.modalidade === 'dupla' ? 'Dupla' : 'Grupo'} · {selectedLanguageLabel}</strong>
                    {selectedSchedules.slice().sort((a, b) => a.weekday - b.weekday || a.hora_inicio.localeCompare(b.hora_inicio)).map((schedule) => (
                      <span key={schedule.id}>{WEEKDAYS.find((day) => day.value === schedule.weekday)?.label}: {formatTime(schedule.hora_inicio)} — {formatTime(schedule.hora_fim)}</span>
                    ))}
                    <span>Plano: {plan?.nome ?? '—'}</span>
                    <span>Frequência: {requiredWeeklyLessons} aula{requiredWeeklyLessons === 1 ? '' : 's'} por semana</span>
                    <span>Nível da turma: {formatNivel(selectedSchedules[0]?.nivel_referencia)}</span>
                    {collectiveFormationDiscount && <span className="availability-selection-summary-highlight">Você será o primeiro participante desta turma. Condição de formação: 10% de desconto sobre o valor do próprio plano coletivo.</span>}
                    {!collectiveFormationDiscount && <span>Condição comercial: valor normal do plano coletivo.</span>}
                    <strong>Mensalidade: {formatCurrency(Number(selectedSchedule?.valor_mensal ?? plan?.preco ?? 0))}/mês</strong>
                  </div>
                  <div className="availability-actions"><a href="/planos" className="availability-edit-button">Alterar plano ou horário</a></div>
                </div>
              )}

              {isCollectivePlan && !scheduleLockedFromPlanos && (
                    <div className="collective-campaign-section">
                      <div className="selection-heading">
                        <div>
                          <h3>Turmas disponíveis</h3>
                          <p>Escolha uma turma criada pela AB Academy. O nível, o professor e a data de início já foram definidos pela administração.</p>
                        </div>
                      </div>

                      {collectiveCampaignsLoading ? (
                        <div className="enrollment-loading">Buscando turmas disponíveis...</div>
                      ) : collectiveCampaigns.length === 0 ? (
                        <div className="enrollment-empty">
                          <strong>Nenhuma turma disponível no momento.</strong>
                          <p>Você pode iniciar individualmente ou deixar seus dados para a equipe organizar uma nova turma.</p>
                        </div>
                      ) : (
                        <div className="collective-campaign-grid">
                          {collectiveCampaigns.map((campaign) => (
                            <article className="collective-campaign-card" key={campaign.turma_id}>
                              <div className="collective-campaign-top">
                                <span>{campaign.modalidade === 'dupla' ? 'Dupla' : 'Grupo'}</span>
                                <strong>{formatNivel(campaign.nivel_referencia)}</strong>
                              </div>
                              <h3>{campaign.idioma === 'ingles' ? 'Inglês' : 'Alemão'} · Nível {formatNivel(campaign.nivel_referencia)}</h3>
                              <p className="collective-campaign-date">Início: <strong>{formatDate(campaign.data_inicio)}</strong></p>
                              <div className="collective-campaign-schedule">
                                {campaign.horarios.map((item) => (
                                  <span key={item.horario_id}>
                                    {WEEKDAYS.find((day) => day.value === item.dia_semana)?.short} · {formatTime(item.hora_inicio)}–{formatTime(item.hora_fim)}
                                  </span>
                                ))}
                              </div>
                              <div className="collective-campaign-meta">
                                <span>{campaign.professor_nome || 'Professor a confirmar'}</span>
                                <span>{campaign.participantes}/{campaign.capacidade} vagas ocupadas</span>
                                <strong>{campaign.vagas_restantes} vaga{campaign.vagas_restantes === 1 ? '' : 's'} disponível{campaign.vagas_restantes === 1 ? '' : 'is'}</strong>
                              </div>
                              <div className="collective-campaign-actions">
                                <button type="button" className="enrollment-secondary-button" onClick={() => void startCollectiveFromCampaign(campaign)} disabled={loading}>
                                  Iniciar matrícula
                                </button>
                                <button type="button" className="enrollment-primary-button" onClick={() => setCollectiveLeadTarget({ campaign, horario_id: campaign.horarios[0]?.horario_id })} disabled={loading}>
                                  Reservar vaga
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {collectiveLeadTarget && (
                    <div className="collective-lead-form">
                      <div className="selection-heading">
                        <div>
                          <h3>Reserve sua vaga</h3>
                          <p>{collectiveLeadTarget.campaign.modalidade === 'dupla' ? 'Dupla' : 'Grupo'} · {formatNivel(collectiveLeadTarget.campaign.nivel_referencia)} · início {formatDate(collectiveLeadTarget.campaign.data_inicio)}</p>
                        </div>
                      </div>
                      <div className="enrollment-fields">
                        <div className="enrollment-field">
                          <label>Nome completo *</label>
                          <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome completo" autoComplete="name" />
                        </div>
                        <div className="enrollment-field">
                          <label>E-mail *</label>
                          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" autoComplete="email" />
                        </div>
                        <div className="enrollment-field">
                          <label>WhatsApp *</label>
                          <input type="tel" value={phone} onChange={(event) => setPhone(formatPhone(event.target.value))} placeholder="(00) 00000-0000" autoComplete="tel" />
                        </div>
                      </div>
                      <div className="availability-actions">
                        <button type="button" className="enrollment-back-button" onClick={() => setCollectiveLeadTarget(null)} disabled={collectiveLeadSaving}>Cancelar</button>
                        <button type="button" className="enrollment-primary-button" onClick={() => void reserveCollectiveLead()} disabled={collectiveLeadSaving}>
                          {collectiveLeadSaving ? 'Registrando...' : 'Confirmar reserva'}
                        </button>
                      </div>
                    </div>
                  )}


              {step === 4 && !isCollectiveEnrollmentFlow && (
                <div className="proficiency-section">
                  <div className="selection-heading">
                    <div>
                      <h3>Teste de proficiência</h3>
                      <p>O teste será realizado em uma página externa. Depois, anexe aqui o documento gerado para que o sistema leia e registre seu nível.</p>
                    </div>
                  </div>

                  <div className="proficiency-card">
                    <div className="proficiency-card-icon"><FileText size={22} /></div>
                    <strong>1. Faça o teste</strong>
                    <p>Abra o teste externo, conclua a avaliação e gere o documento com seu resultado.</p>
                    {proficiencyTestUrl ? (
                      <a className="enrollment-secondary-button" href={proficiencyTestUrl} target="_blank" rel="noopener noreferrer">
                        Abrir teste de proficiência <ExternalLink size={17} />
                      </a>
                    ) : (
                      <div className="enrollment-empty">O link externo ainda não foi configurado.</div>
                    )}
                  </div>

                  <div className="proficiency-card">
                    <div className="proficiency-card-icon"><FileText size={22} /></div>
                    <strong>2. Anexe o resultado</strong>
                    <p>Envie o PDF gerado pelo teste. O sistema analisará o documento e classificará o nível como iniciante, básico, intermediário ou avançado.</p>
                    <input type="file" accept="application/pdf,.pdf" onChange={(event) => setProficiencyFile(event.target.files?.[0] ?? null)} />
                    {proficiencyFile && <small>{proficiencyFile.name}</small>}
                    <button type="button" className="enrollment-primary-button" onClick={() => void processProficiencyDocument()} disabled={!proficiencyFile || proficiencyProcessing || !proficiencyTestUrl}>
                      {proficiencyProcessing ? 'Analisando documento...' : 'Analisar resultado'}
                      {!proficiencyProcessing && <ArrowRight size={18} />}
                    </button>
                  </div>

                  {proficiencyResult && (
                    <div className="proficiency-result">
                      <strong>Resultado identificado</strong>
                      <span>Nível geral: <b>{formatNivel(proficiencyResult.nivel_geral)}</b></span>
                      <span>Conversação: <b>{formatNivel(proficiencyResult.nivel_conversacao)}</b></span>
                      <span>Escrita: <b>{formatNivel(proficiencyResult.nivel_escrita)}</b></span>
                      <span>Compreensão: <b>{formatNivel(proficiencyResult.nivel_compreensao)}</b></span>
                      {proficiencyResult.observacoes && <small>{proficiencyResult.observacoes}</small>}
                    </div>
                  )}

                  <div className="availability-actions"><button type="button" className="enrollment-primary-button" onClick={nextStep} disabled={!proficiencyResult}>Continuar <ArrowRight size={18} /></button></div>
                </div>
              )}

              {step === 2 && !isCollectiveEnrollmentFlow && (
            <div className="availability-section">
              <div className="selection-heading">
                <div>
                  <h3>Quando você pode estudar?</h3>
                  <p>Este plano tem <strong>{requiredWeeklyLessons} aula{requiredWeeklyLessons === 1 ? '' : 's'} por semana</strong>. Escolha exatamente {requiredWeeklyLessons} dia{requiredWeeklyLessons === 1 ? '' : 's'} diferente{requiredWeeklyLessons === 1 ? '' : 's'} em que você pode estudar.</p>
                </div>
              </div>

              <div className="availability-mode-selector">
                <strong>Como você prefere informar sua disponibilidade?</strong>
                <div className="availability-mode-options">
                  <button type="button" className={`availability-mode-option ${availabilityMode === 'periods' ? 'selected' : ''}`} onClick={() => selectAvailabilityMode('periods')}>
                    <span>Dias e períodos</span>
                    <small>Escolha os dias e indique manhã, tarde ou noite.</small>
                  </button>
                  <button type="button" className={`availability-mode-option ${availabilityMode === 'ranges' ? 'selected' : ''}`} onClick={() => selectAvailabilityMode('ranges')}>
                    <span>Faixa de horário por dia</span>
                    <small>Escolha os dias e informe exatamente o horário disponível.</small>
                  </button>
                  <button type="button" className={`availability-mode-option ${availabilityMode === 'flexible' ? 'selected' : ''}`} onClick={() => selectAvailabilityMode('flexible')}>
                    <span>Total flexibilidade</span>
                    <small>Mostre todos os horários compatíveis com o plano.</small>
                  </button>
                </div>
              </div>

              {availabilityMode !== 'flexible' && (
                <div className="availability-days">
                  {WEEKDAYS.filter((day) => day.value !== 0 && day.value !== 6).map((day) => (
                    <button type="button" key={day.value} className={availabilityDays.includes(day.value) ? 'selected' : ''} onClick={() => toggleAvailabilityDay(day.value)}>
                      <span>✓</span>{day.label}
                    </button>
                  ))}
                </div>
              )}

              {availabilityMode === 'periods' && (
                <div className="availability-periods">
                  <strong>Período para os {requiredWeeklyLessons} dia{requiredWeeklyLessons === 1 ? '' : 's'} selecionado{requiredWeeklyLessons === 1 ? '' : 's'}</strong>
                  <div>
                    {[['manha', 'Manhã'], ['tarde', 'Tarde'], ['noite', 'Noite']].map(([value, label]) => (
                      <button type="button" key={value} className={availabilityPeriods.includes(value) ? 'selected' : ''} onClick={() => toggleAvailabilityPeriod(value)}>
                        {availabilityPeriods.includes(value) ? '✓ ' : ''}{label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {availabilityMode === 'ranges' && availabilityDays.length > 0 && (
                <div className="availability-ranges">
                  <strong>Informe a faixa de horário para cada dia</strong>
                  {availabilityDays.map((day) => (
                    <div className="availability-range" key={day}>
                      <span>{WEEKDAYS.find((item) => item.value === day)?.label}</span>
                      <label>das
                        <input type="time" value={availabilityRanges[day]?.start ?? '18:00'} onChange={(event) => setAvailabilityRange(day, 'start', event.target.value)} />
                      </label>
                      <label>até
                        <input type="time" value={availabilityRanges[day]?.end ?? '21:00'} onChange={(event) => setAvailabilityRange(day, 'end', event.target.value)} />
                      </label>
                    </div>
                  ))}
                </div>
              )}

              <div className="availability-actions">
                <button type="button" className="enrollment-primary-button" onClick={nextStep}>
                  Encontrar horários compatíveis <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && !isCollectiveEnrollmentFlow && scheduleLockedFromPlanos && (
            <div className="schedule-section">
              <div className="selection-heading">
                <div>
                  <h3>Horário definido em Planos</h3>
                  <p>Esta modalidade coletiva utiliza horários fixos. A turma e todos os encontros semanais foram trazidos da página Planos.</p>
                </div>
                <a href="/planos" className="availability-edit-button">Alterar em Planos</a>
              </div>
              <div className="availability-selection-summary">
                <strong>Turma selecionada</strong>
                {selectedSchedules
                  .slice()
                  .sort((a, b) => a.weekday - b.weekday || a.hora_inicio.localeCompare(b.hora_inicio))
                  .map((schedule) => (
                    <span key={schedule.id}>
                      {WEEKDAYS.find((day) => day.value === schedule.weekday)?.label}: {formatTime(schedule.hora_inicio)} — {formatTime(schedule.hora_fim)}
                    </span>
                  ))}
                <span>Valor regular: {formatCurrency(Number(plan?.preco ?? 0))}/mês</span>
              </div>
            </div>
          )}

          {step === 3 && !isCollectiveEnrollmentFlow && !scheduleLockedFromPlanos && (
            <div className="schedule-section">
              <div className="selection-heading">
                <div>
                  <h3>Horários compatíveis com você</h3>
                  <p>Selecione {requiredWeeklyLessons} horário{requiredWeeklyLessons === 1 ? '' : 's'}, um em cada dia da semana escolhido. <strong>{selectedSchedules.length}/{requiredWeeklyLessons} selecionado{requiredWeeklyLessons === 1 ? '' : 's'}</strong></p>
                </div>
                <button type="button" className="availability-edit-button" onClick={() => { setAvailabilityReady(false); setSelectedSchedule(null); setSelectedSchedules([]); setStep(2); }}>
                  Alterar disponibilidade
                </button>
              </div>

              {loadingSchedules ? (
                <div className="enrollment-loading">Buscando os melhores horários...</div>
              ) : availableSchedules.length === 0 ? (
                <div className="enrollment-empty">
                  <strong>Não encontramos um horário exatamente dentro da sua disponibilidade.</strong>
                  <p>Revise os dias e períodos para ver outras opções.</p>
                  <button type="button" className="availability-edit-button" onClick={() => { setAvailabilityReady(false); setStep(2); }}>
                    Ajustar disponibilidade
                  </button>
                </div>
              ) : (
                <>
                  <div className="schedule-calendar">
                    {groupedSchedules.map((weekday) => (
                      <button
                        type="button"
                        key={weekday.value}
                        className={'schedule-date ' + (activeScheduleWeekday === weekday.value ? 'selected' : '')}
                        onClick={() => setSelectedWeekday(weekday.value)}
                      >
                        <strong>{weekday.short}</strong>
                        <span>{weekday.schedules.length} opções</span>
                      </button>
                    ))}
                  </div>

                  <div className="schedule-day-heading">
                    <strong>{WEEKDAYS.find((day) => day.value === activeScheduleWeekday)?.label}</strong>
                    <span>Escolha 1 horário neste dia</span>
                  </div>

                  <div className="schedule-periods">
                    {groupedSchedulePeriods.map((group) => {
                      const periodKey = String(activeScheduleWeekday) + '-' + group.period
                      const expanded = expandedSchedulePeriods[periodKey] ?? false
                      const schedules = expanded ? group.schedules : group.schedules.slice(0, 4)
                      const hasMore = group.schedules.length > 4

                      return (
                        <section className="schedule-period" key={group.period}>
                          <div className="schedule-period-header">
                            <div>
                              <strong>{group.label}</strong>
                              <span>{group.schedules.length} horários</span>
                            </div>
                          </div>

                          <div className="schedule-times">
                            {schedules.map((horario) => {
                              const selected = selectedSchedules.some((item) => item.id === horario.id)
                              const formation = isCollectivePlan && horario.status_formacao?.includes('_em_formacao')
                              const label = horario.tipo_horario === 'dupla' ? 'Dupla' : 'Grupo'

                              return (
                                <button
                                  type="button"
                                  key={horario.id}
                                  className={'schedule-time ' + (selected ? 'selected' : '')}
                                  onClick={() => handleSelectSchedule(horario)}
                                >
                                  <strong>{formatTime(horario.hora_inicio)}</strong>
                                  <span>até {formatTime(horario.hora_fim)}</span>
                                  {isCollectivePlan && (
                                    <small>
                                      {formation
                                        ? label + " em formação • " + horario.participantes + "/" + horario.capacidade + " alunos"
                                        : horario.participantes >= horario.capacidade
                                          ? label + " formada • " + horario.participantes + "/" + horario.capacidade
                                          : "Nova " + label.toLowerCase() + " • 0/" + horario.capacidade}
                                    </small>
                                  )}
                                </button>
                              )
                            })}
                          </div>

                          {hasMore && (
                            <button
                              type="button"
                              className="schedule-show-more"
                              onClick={() => setExpandedSchedulePeriods((current) => ({ ...current, [periodKey]: !expanded }))}
                            >
                              {expanded ? 'Mostrar menos' : 'Ver mais ' + (group.schedules.length - 4) + ' horários'}
                            </button>
                          )}
                        </section>
                      )
                    })}
                  </div>

                  {selectedSchedules.length > 0 && (
                    <div className="availability-selection-summary">
                      <strong>Horários escolhidos ({selectedSchedules.length}/{requiredWeeklyLessons})</strong>
                      {selectedSchedules
                        .slice()
                        .sort((a, b) => a.weekday - b.weekday || a.hora_inicio.localeCompare(b.hora_inicio))
                        .map((schedule) => (
                          <span key={schedule.id}>
                            {WEEKDAYS.find((day) => day.value === schedule.weekday)?.label}: {formatTime(schedule.hora_inicio)} — {formatTime(schedule.hora_fim)}
                          </span>
                        ))}
                      {isCollectivePlan && selectedSchedule && (
                        <span>Situação do primeiro horário: {selectedSchedule.status_formacao === 'dupla_formada' ? 'Dupla já formada' : selectedSchedule.status_formacao === 'grupo_formado' ? 'Grupo já formado' : selectedSchedule.status_formacao === 'dupla_em_formacao' ? 'Nova dupla em formação' : 'Grupo em formação'}</span>
                      )}
                    </div>
                  )}

                  <div className="availability-actions">
                    <button type="button" className="enrollment-primary-button" onClick={nextStep} disabled={selectedSchedules.length !== requiredWeeklyLessons}>
                      Continuar <ArrowRight size={18} />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}


              {(step === 5 || (isCollectiveEnrollmentFlow && step === 2)) && (
                <div className="enrollment-fields">
                  <div className="enrollment-field">
                    <label>Nome completo *</label>
                    <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome completo" autoComplete="name" />
                  </div>
                  <div className="enrollment-field">
                    <label>CPF *</label>
                    <input type="text" value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} placeholder="000.000.000-00" maxLength={14} inputMode="numeric" />
                  </div>
                  <div className="enrollment-field">
                    <label>E-mail *</label>
                    <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" autoComplete="email" />
                  </div>
                  <div className="enrollment-field">
                    <label>Data de nascimento *</label>
                    <input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
                  </div>
                  <div className="enrollment-field">
                    <label>WhatsApp / Telefone *</label>
                    <input type="tel" value={phone} onChange={(event) => setPhone(formatPhone(event.target.value))} placeholder="(00) 00000-0000" autoComplete="tel" />
                  </div>
                  <div className="enrollment-field">
                    <label>Nome do responsável</label>
                    <input type="text" value={responsibleName} onChange={(event) => setResponsibleName(event.target.value)} placeholder="Se aplicável" />
                  </div>
                  <div className="enrollment-field">
                    <label>WhatsApp do responsável</label>
                    <input type="tel" value={responsiblePhone} onChange={(event) => setResponsiblePhone(formatPhone(event.target.value))} placeholder="(00) 00000-0000" />
                  </div>
                </div>
              )}

              {(step === 6 || (isCollectiveEnrollmentFlow && step === 3)) && (
                <div className="contract-section">
                  <div className="selection-heading"><div><h3>Contrato virtual</h3><p>Leia as condições da matrícula antes da assinatura.</p></div></div>
                  <div className="contract-card">
                    <strong>Contrato AB Academy Idiomas</strong>
                    <p>Esta etapa usa a assinatura eletrônica interna da AB Academy. O documento será vinculado à sua matrícula e ao token desta sessão, com registro de aceite, identidade do signatário e horário da assinatura.</p>

                    <div className="contract-status">
                      <ShieldCheck size={18} />
                      <span>
                        {contractSignatureStatus === 'signed'
                          ? 'Assinatura registrada nesta matrícula.'
                          : 'Aguardando sua assinatura.'}
                      </span>
                    </div>

                    <label className="contract-checkbox">
                      <input
                        type="checkbox"
                        checked={contractAccepted}
                        onChange={(event) => {
                          setContractAccepted(event.target.checked)
                          if (!event.target.checked) {
                            setContractSignatureStatus('pending')
                          }
                        }}
                        disabled={contractSignatureStatus === 'signed'}
                      />
                      <span>Li e concordo com o conteúdo do contrato.</span>
                    </label>

                    {contractAccepted && contractSignatureStatus !== 'signed' && (
                      <div className="contract-signature-field">
                        <label htmlFor="contract-signature-name">Assinatura eletrônica</label>
                        <input
                          id="contract-signature-name"
                          type="text"
                          value={signatureName}
                          onChange={(event) => setSignatureName(event.target.value)}
                          placeholder="Digite seu nome completo"
                          autoComplete="name"
                        />
                        <small>Digite exatamente o mesmo nome informado no cadastro. A assinatura é registrada internamente pela AB Academy.</small>
                      </div>
                    )}

                    {contractSignatureStatus !== 'signed' ? (
                      <button
                        type="button"
                        className="enrollment-primary-button"
                        disabled={!contractAccepted || !signatureName.trim() || signingContract}
                        onClick={signContractInternally}
                      >
                        {signingContract ? 'Registrando assinatura...' : 'Assinar contrato'}
                        {!signingContract && <ArrowRight size={18} />}
                      </button>
                    ) : (
                      <div className="contract-signed-badge">
                        <ShieldCheck size={18} />
                        Assinado por {name}
                      </div>
                    )}

                    <small className="contract-internal-note">
                      Assinatura interna — sem integração com GOV.BR ou provedor externo. O conteúdo jurídico definitivo do contrato será conectado a esta estrutura antes da publicação da versão final.
                    </small>
                  </div>
                </div>
              )}


              {isCollectiveEnrollmentFlow && step === 4 && (
                <div className="contract-section">
                  <div className="selection-heading"><div><h3>Revisão da matrícula</h3><p>Confira todos os dados, horários, contrato e valor antes de criar a matrícula e seguir para o pagamento.</p></div></div>
                  <div className="contract-card">
                    <div className="enrollment-summary-item"><span>Idioma</span><strong>{selectedLanguageLabel}</strong></div>
                    <div className="enrollment-summary-item"><span>Modalidade</span><strong>{plan?.modalidade === 'dupla' ? 'Dupla' : 'Grupo'}</strong></div>
                    <div className="enrollment-summary-item"><span>Plano</span><strong>{plan?.nome ?? '—'}</strong></div>
                    <div className="enrollment-summary-item"><span>Aluno</span><strong>{name || '—'}</strong></div>
                    <div className="enrollment-summary-item"><span>CPF</span><strong>{cpf || '—'}</strong></div>
                    <div className="enrollment-summary-item"><span>E-mail</span><strong>{email || '—'}</strong></div>
                    <div className="enrollment-summary-item"><span>WhatsApp</span><strong>{phone || '—'}</strong></div>
                    <div className="enrollment-summary-item"><span>Horários</span><strong>{selectedSchedules.map((schedule) => WEEKDAYS.find((day) => day.value === schedule.weekday)?.short + ' ' + formatTime(schedule.hora_inicio) + '–' + formatTime(schedule.hora_fim)).join(' · ')}</strong></div>
                    <div className="enrollment-summary-item"><span>Condição</span><strong>{collectiveFormationDiscount ? 'Primeiro aluno da formação · 10% de desconto' : 'Valor normal do plano coletivo'}</strong></div>
                    <div className="enrollment-summary-total"><span>Mensalidade</span><strong>{formatCurrency(Number(selectedSchedule?.valor_mensal ?? plan?.preco ?? 0))}/mês</strong></div>
                    <div className="contract-signed-badge"><ShieldCheck size={18} /> Contrato assinado por {name}</div>
                  </div>
                </div>
              )}

              <div className="enrollment-actions">
                {step > 1 && (
                  <button type="button" className="enrollment-back-button" onClick={previousStep} disabled={loading}>
                    <ChevronLeft size={18} />
                    Voltar
                  </button>
                )}
                <div />
                {isCollectiveEnrollmentFlow ? (
                  step < 4 ? (
                    <button type="button" className="enrollment-submit" onClick={nextStep} disabled={loading || (step === 1 && (!plan || !selectedSchedule))}>
                      {step === 1
                        ? 'Confirmar plano e horário'
                        : step === 2
                          ? 'Continuar para contrato'
                          : 'Continuar para confirmação'}
                      <ArrowRight size={18} />
                    </button>
                  ) : (
                    <button type="button" className="enrollment-submit" onClick={createEnrollment} disabled={loading || !plan || !selectedSchedule || !contractAccepted || contractSignatureStatus !== 'signed'}>
                      {loading ? 'Criando matrícula...' : 'Confirmar matrícula e ir para pagamento'}
                      {!loading && <ArrowRight size={18} />}
                    </button>
                  )
                ) : step < 6 ? (
                  <button type="button" className="enrollment-submit" onClick={nextStep} disabled={loading || (step === 1 && (!plan || isCollectivePlan))}>
                    Continuar
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  <button type="button" className="enrollment-submit" onClick={createEnrollment} disabled={loading || !plan || !selectedSchedule || !contractAccepted || contractSignatureStatus !== 'signed'}>
                    {loading ? 'Criando matrícula...' : 'Finalizar e ir para pagamento'}
                    {!loading && <ArrowRight size={18} />}
                  </button>
                )}
              </div>
            </section>

            <aside className="enrollment-summary">
              <div className="enrollment-summary-header">
                <h3>
                  Resumo
                </h3>
              </div>

              <div className="enrollment-summary-item">
                <span>
                  Idioma
                </span>

                <strong>
                  {selectedLanguageLabel ||
                    'Não selecionado'}
                </strong>
              </div>

              <div className="enrollment-summary-item">
                <span>
                  Plano
                </span>

                <strong>
                  {plan?.nome ||
                    'Não selecionado'}
                </strong>
              </div>

              <div className="enrollment-summary-item">
                <span>
                  Tipo
                </span>

                <strong>
                  {plan?.tipo === 'avulso'
                    ? 'Pagamento único'
                    : plan
                      ? getPlanTypeLabel(plan.tipo)
                      : '—'}
                </strong>
              </div>

              <div className="enrollment-summary-item">
                <span>
                  Horário
                </span>

                <strong>
                  {selectedSchedule
                    ? `${formatTime(
                        selectedSchedule.hora_inicio,
                      )} - ${formatTime(
                        selectedSchedule.hora_fim,
                      )}`
                    : 'Não selecionado'}
                </strong>
              </div>

              <div className="enrollment-summary-total">
                <span>Valor:</span>
                <strong>
                  {isCollectivePlan
                    ? (selectedSchedule?.valor_mensal != null
                      ? formatCurrency(selectedSchedule.valor_mensal) + '/mês'
                      : 'Calculado após a análise do horário')
                    : plan
                      ? formatCurrency(selectedSchedule?.valor_mensal ?? Number(plan.preco)) + (plan.tipo === 'avulso' ? ' pagamento único' : '')
                      : '—'}
                </strong>
              </div>

              {plan?.tipo ===
                'anual' &&
                plan.parcelas &&
                plan.valor_parcela && (
                  <div className="enrollment-summary-item">
                    <span>
                      Parcelamento
                    </span>

                    <strong>
                      {plan.parcelas}x de{' '}
                      {formatCurrency(
                        plan.valor_parcela,
                      )}
                    </strong>
                  </div>
                )}

              <div className="enrollment-summary-security">
                <ShieldCheck
                  size={18}
                />

                <span>
                  Pagamento seguro. A matrícula
                  somente será ativada após a
                  confirmação do pagamento.
                </span>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  )
}
