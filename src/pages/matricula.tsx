import { useEffect, useState } from 'react'
import {
  ArrowRight,
  ChevronLeft,
  ShieldCheck,
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
  const [conversationLevel] = useState('')
  const [writingLevel] = useState('')
  const [comprehensionLevel] = useState('')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [collectiveEnrollment, setCollectiveEnrollment] = useState<{ token: string; turmaId: string; participanteId: string; valorMensal: number; condicaoMeses: number | null; condicaoInicio: string | null; condicaoFim: string | null } | null>(null)
  const [availableSchedules, setAvailableSchedules] = useState<Horario[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState<SelectedSchedule | null>(null)
  const [selectedSchedules, setSelectedSchedules] = useState<SelectedSchedule[]>([])
  const [selectedWeekday, setSelectedWeekday] = useState<number | null>(null)
  const [availabilityMode, setAvailabilityMode] = useState<'periods' | 'ranges' | 'flexible'>('periods')
  const [availabilityDays, setAvailabilityDays] = useState<number[]>([])
  const [availabilityPeriods, setAvailabilityPeriods] = useState<string[]>([])
  const [availabilityRanges, setAvailabilityRanges] = useState<Record<number, { start: string; end: string }>>({})
  const [availabilityReady, setAvailabilityReady] = useState(false)
   const [formationSlotId] = useState(() => new URLSearchParams(window.location.search).get('horario_id'))
  const [waitingFormation] = useState(() => new URLSearchParams(window.location.search).get('aguardando_formacao') === '1')
  const [reservaToken] = useState(() => crypto.randomUUID())
  const selectedLanguageLabel =
    language === 'ingles'
      ? 'Inglês'
      : language === 'alemao'
        ? 'Alemão'
        : ''

  const isCollectivePlan = plan?.modalidade === 'dupla' || plan?.modalidade === 'grupo'
  const isWaitingFormation = waitingFormation
  const effectivePlan = plan


  const visibleSchedules =
    selectedWeekday === null
      ? availableSchedules
      : availableSchedules.filter(
          (item) =>
            item.dia_semana === selectedWeekday,
        )

  const groupedSchedules = WEEKDAYS.map(
    (weekday) => ({
      ...weekday,
      schedules: availableSchedules.filter(
        (item) =>
          item.dia_semana === weekday.value,
      ),
    }),
  ).filter(
    (weekday) =>
      weekday.schedules.length > 0,
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const diagnosticRequested = params.get('diagnostica') === '1'
    const requestedLanguage = params.get('idioma')
    const requestedPlanId = params.get('plano')
    const requestedModality = params.get('modalidade')
    const turmaToken = params.get('turma_token')

    const loadCollectiveEnrollment = async (token: string) => {
      const { data, error } = await supabase
        .from('turma_matriculas')
        .select('token,turma_id,participante_id,valor_mensal,condicao_meses,condicao_inicio,condicao_fim,status,turma:turmas(id,idioma,aulas_semana,status),participante:turma_participantes(id,nome,email,status)')
        .eq('token', token)
        .eq('status', 'liberada')
        .maybeSingle()
      if (error || !data || !data.turma || !data.participante || data.turma.status !== 'pronta' || data.participante.status !== 'confirmado') {
        setError('Este link de matrícula coletiva não está mais disponível.')
        return false
      }
      const turma = data.turma as { id: string; idioma: Language; aulas_semana: number; status: string }
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
      setSuccess('Sua turma foi formada. Complete seus dados para iniciar a matrícula coletiva.')
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
        await loadSelectedPlan(requestedLanguage, requestedPlanId)
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


  const loadSelectedPlan = async (selectedLanguage: Language, selectedPlanId: string) => {
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
      return
    }

    if (!data) {
      setError('O plano selecionado não está mais disponível. Volte à página de planos e escolha outro.')
      return
    }

    setPlan(data as Plan)
  }

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
        }])
        return true
      }

      const modalidade = plan.modalidade
      const aulasSemana = plan.aulas_semana ?? (plan.tipo === 'intensivo' ? 3 : plan.tipo === 'personalizado' ? 2 : 1)

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

      return [...current, day]
    })
  }

  const toggleAvailabilityPeriod = (period: string) => {
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

  const nextStep = async () => {
    setError('')
    setSuccess('')

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
        setError(
          requiredWeeklyLessons === 1
            ? 'Escolha exatamente 1 dia da semana para sua aula.'
            : `Este plano tem ${requiredWeeklyLessons} aulas por semana. Escolha exatamente ${requiredWeeklyLessons} dias diferentes.`,
        )
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
      if (!validatePersonalData()) return
      setLoadingSchedules(true)
      const reserved = await reserveSelectedSchedules()
      if (!reserved) {
        setLoadingSchedules(false)
        return
      }
      const confirmed = await verifyScheduleAgain()
      setLoadingSchedules(false)
      if (!confirmed) return
      setStep(5)
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

    if (requestedType !== 'individual' && selectedSchedule?.turma_id && horario.turma_id && horario.turma_id !== selectedSchedule.turma_id) {
      setError('Para este plano, todos os horários devem pertencer à mesma turma.')
      return
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
    }

    const next = [...selectedSchedules, schedule]
    setSelectedSchedules(next)
    setSelectedSchedule(next[0] ?? null)
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

    const reservedSchedules: SelectedSchedule[] = []

    for (const current of selectedSchedules) {
      const { data, error: selectionError } = await supabase.rpc('selecionar_horario_matricula_v2', {
        p_horario_id: current.id,
        p_idioma: language,
        p_modalidade: modalidade,
        p_aulas_semana: aulasSemana,
        p_turma_id: current.turma_id ?? null,
        p_reserva_token: reservaToken,
        p_nome: name.trim(),
        p_email: email.trim().toLowerCase(),
      })

      if (selectionError || !data) {
        const message = selectionError?.message || 'Este horário acabou de ser preenchido.'
        setError(message.toLowerCase().includes('preenchido') || message.toLowerCase().includes('completa')
          ? 'Este horário acabou de ser preenchido. Encontramos novas opções para você.'
          : message)
        await loadSchedules(language)
        setSelectedSchedule(null)
        setSelectedSchedules([])
        return false
      }

      reservedSchedules.push({
        id: data.id,
        date: getDateForWeekday(Number(data.dia_semana)),
        weekday: Number(data.dia_semana),
        hora_inicio: data.hora_inicio,
        hora_fim: data.hora_fim,
        meet_url: data.meet_url ?? null,
        meet_space_name: data.meet_space_name ?? null,
        turma_id: data.turma_id ?? null,
        participante_id: data.participante_id ?? null,
        valor_mensal: data.valor_mensal != null ? Number(data.valor_mensal) : null,
        participantes: data.participantes != null ? Number(data.participantes) : null,
        capacidade: data.capacidade != null ? Number(data.capacidade) : null,
        status_formacao: data.status_formacao ?? null,
        tipo_valor: data.tipo_valor ?? null,
        professor_id: data.professor_id ?? null,
      })
    }

    setSelectedSchedules(reservedSchedules)
    setSelectedSchedule(reservedSchedules[0] ?? null)
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
      const freshSchedules = await verifyScheduleAgain()

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
        horario_formacao_id: isWaitingFormation ? (formationSlotId || primarySchedule.id) : null,
        aguardando_formacao: isWaitingFormation,

        objetivos: null,

        aulas_semana: effectivePlan?.tipo === 'avulso' ? null : (effectivePlan?.aulas_semana ?? (effectivePlan?.tipo === 'intensivo' ? 3 : effectivePlan?.tipo === 'personalizado' ? 2 : 1)),

        valor_aula: collectiveEnrollment ? null : effectivePlan?.tipo === 'avulso' ? Number(effectivePlan.preco) : effectivePlan?.tipo === 'anual' ? null : Number(effectivePlan?.preco ?? 0) / (effectivePlan?.tipo === 'intensivo' ? 12 : effectivePlan?.tipo === 'personalizado' ? 8 : 4),

        valor_mensal: collectiveEnrollment?.valorMensal ?? (isCollectivePlan ? primarySchedule.valor_mensal : (isWaitingFormation ? primarySchedule.valor_mensal : (effectivePlan?.tipo === 'avulso' || effectivePlan?.tipo === 'anual' ? null : Number(effectivePlan?.preco ?? 0)))),

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
            {[
              'Plano selecionado',
              'Disponibilidade',
              'Horário',
              'Dados pessoais',
              'Pagamento',
            ].map(
              (label, index) => {
                const number =
                  index + 1

                return (
                  <div
                    key={label}
                    className={`enrollment-progress-step ${
                      step >= number
                        ? 'active'
                        : ''
                    } ${
                      step > number
                        ? 'completed'
                        : ''
                    }`}
                  >
                    <div className="enrollment-progress-number">{number}</div>

                    <span>
                      {label}
                    </span>

                    {number < 5 && (
                      <div className="enrollment-progress-line" />
                    )}
                  </div>
                )
              },
            )}
          </div>

          <div className="enrollment-grid">
            <section className="enrollment-card">
              <div className="enrollment-card-header">
                <div className="enrollment-card-number">
                  {step}
                </div>

                <div>
                  <h2>
                    {step === 1 &&
                      'Plano selecionado'}

                    {step === 2 &&
                      'Quando você pode estudar?'}

                    {step === 3 &&
                      'Horários compatíveis com você'}

                    {step === 4 &&
                      'Seus dados pessoais'}

                    {step === 5 &&
                      'Revise sua matrícula'}
                  </h2>

                  <p>
                    {step === 1 &&
                      'Confira o plano escolhido na página de planos.'}

                    {step === 2 &&
                      'Escolha uma única forma de informar sua disponibilidade: dias e períodos, faixas de horário por dia ou flexibilidade total.'}

                    {step === 3 &&
                      'Escolha entre os horários reais compatíveis com sua disponibilidade.'}

                    {step === 4 &&
                      'Informe os dados necessários para sua matrícula.'}

                    {step === 5 &&
                      'Revise todas as informações antes de continuar para o pagamento.'}
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
                        {formatCurrency(plan.preco)}
                        <span>{plan.tipo === 'avulso' ? ' pagamento único' : ' / mês'}</span>
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

              {step === 2 && (
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

          {step === 3 && (
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
                    <button type="button" className={`schedule-date ${selectedWeekday === null ? 'selected' : ''}`} onClick={() => setSelectedWeekday(null)}>
                      <strong>Todos</strong><span>horários</span>
                    </button>
                    {groupedSchedules.map((weekday) => (
                      <button type="button" key={weekday.value} className={`schedule-date ${selectedWeekday === weekday.value ? 'selected' : ''}`} onClick={() => setSelectedWeekday(weekday.value)}>
                        <strong>{weekday.short}</strong><span>{weekday.schedules.length} opções</span>
                      </button>
                    ))}
                  </div>

                  <div className="schedule-times">
                    {visibleSchedules
                      .slice()
                      .sort((a, b) => {
                        const formationA = a.participantes > 0 && a.participantes < a.capacidade ? 0 : a.participantes === a.capacidade ? 1 : 2
                        const formationB = b.participantes > 0 && b.participantes < b.capacidade ? 0 : b.participantes === b.capacidade ? 1 : 2
                        return formationA - formationB || a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio)
                      })
                      .map((horario) => {
                        const selected = selectedSchedules.some((item) => item.id === horario.id)
                        const formation = isCollectivePlan && horario.status_formacao?.includes('_em_formacao')
                        const label = horario.tipo_horario === 'dupla' ? 'Dupla' : 'Grupo'
                        return (
                          <button type="button" key={horario.id} className={`schedule-time ${selected ? 'selected' : ''}`} onClick={() => handleSelectSchedule(horario)}>
                            <strong>{formatTime(horario.hora_inicio)}</strong>
                            <span>até {formatTime(horario.hora_fim)}</span>
                            {isCollectivePlan && (
                              <small>
                                {formation ? `${label} em formação • ${horario.participantes}/${horario.capacidade} alunos` : horario.participantes >= horario.capacidade ? `${label} formada • ${horario.participantes}/${horario.capacidade}` : `Nova ${label.toLowerCase()} • 0/${horario.capacidade}`}
                              </small>
                            )}
                          </button>
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


              {step === 4 && (
                <div className="enrollment-fields">
                  <div className="enrollment-field">
                    <label>
                      Nome completo *
                    </label>

                    <input
                      type="text"
                      value={name}
                      onChange={(event) =>
                        setName(
                          event.target.value,
                        )
                      }
                      placeholder="Seu nome completo"
                    />
                  </div>

                  <div className="enrollment-field">
                    <label>
                      CPF *
                    </label>

                    <input
                      type="text"
                      value={cpf}
                      onChange={(event) =>
                        setCpf(
                          formatCpf(
                            event.target.value,
                          ),
                        )
                      }
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                  </div>

                  <div className="enrollment-field">
                    <label>
                      E-mail *
                    </label>

                    <input
                      type="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(
                          event.target.value,
                        )
                      }
                      placeholder="seu@email.com"
                    />
                  </div>

                  <div className="enrollment-field">
                    <label>
                      Data de nascimento *
                    </label>

                    <input
                      type="date"
                      value={birthDate}
                      onChange={(event) =>
                        setBirthDate(
                          event.target.value,
                        )
                      }
                    />
                  </div>

                  <div className="enrollment-field">
                    <label>
                      WhatsApp / Telefone *
                    </label>

                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) =>
                        setPhone(
                          formatPhone(
                            event.target.value,
                          ),
                        )
                      }
                      placeholder="(00) 00000-0000"
                    />
                  </div>

                  <div className="enrollment-field">
                    <label>
                      Nome do responsável
                    </label>

                    <input
                      type="text"
                      value={
                        responsibleName
                      }
                      onChange={(event) =>
                        setResponsibleName(
                          event.target.value,
                        )
                      }
                      placeholder="Se aplicável"
                    />
                  </div>

                  <div className="enrollment-field">
                    <label>
                      WhatsApp do responsável
                    </label>

                    <input
                      type="tel"
                      value={
                        responsiblePhone
                      }
                      onChange={(event) =>
                        setResponsiblePhone(
                          formatPhone(
                            event.target.value,
                          ),
                        )
                      }
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
              )}
          {step === 5 && (
                <div className="schedule-confirmation">
                  <div className="selection-heading">
                    <ShieldCheck
                      size={24}
                    />

                    <div>
                      <h3>
                        Tudo pronto
                      </h3>

                      <p>
                        Confira os dados da sua matrícula antes de prosseguir.
                      </p>
                    </div>
                  </div>

                  <div className="enrollment-summary-item">
                    <div>
                      <span>
                        Aluno:{' '}
                      </span>

                      <strong>
                        {name}
                      </strong>
                    </div>

                    <div>
                      <span>
                        E-mail: {' '}
                      </span>

                      <strong>
                        {email}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Idioma:{' '}
                      </span>

                      <strong>
                        {selectedLanguageLabel}
                      </strong>
                    </div>

                    <div>
                      <span>
                        {plan?.tipo === 'avulso' ? 'Serviço: ' : 'Plano: '}
                      </span>

                      <strong>
                        {plan?.nome ||
                          'Não selecionado'}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Tipo: {' '}
                      </span>

                      <strong>
                        {plan?.tipo === 'avulso'
                          ? 'Pagamento único'
                          : plan
                            ? getPlanTypeLabel(plan.tipo)
                            : '—'}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Horário:{' '}
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

                    <div>
                      <span>
                        {isCollectivePlan ? 'Investimento atual:' : 'Valor:'}{' '}
                      </span>
                      <strong>
                        {selectedSchedule?.valor_mensal != null
                          ? formatCurrency(selectedSchedule.valor_mensal) + (isCollectivePlan ? '/mês' : '')
                          : '—'}
                      </strong>
                    </div>
                    {isCollectivePlan && selectedSchedule && (
                      <div>
                        <span>Situação:</span>
                        <strong>
                          {selectedSchedule.status_formacao === 'dupla_formada'
                            ? 'Dupla já formada'
                            : selectedSchedule.status_formacao === 'grupo_formado'
                              ? 'Grupo já formado'
                              : selectedSchedule.status_formacao === 'dupla_em_formacao'
                                ? 'Nova dupla em formação'
                                : 'Grupo em formação'}
                        </strong>
                      </div>
                    )}
                    {isCollectivePlan && selectedSchedule?.tipo_valor === 'coletiva_em_formacao' && (
                      <div className="collective-formation-note">
                        <strong>Valor durante a formação</strong>
                        <p>
                          Este valor corresponde ao valor individual de 1 aula por semana com 10% de desconto enquanto a turma estiver em formação.
                          Quando a turma atingir sua capacidade, o valor regular da modalidade será aplicado somente a partir do próximo ciclo de cobrança, sem cobrança retroativa.
                        </p>
                      </div>
                    )}

                    {plan?.tipo ===
                      'anual' &&
                      plan.parcelas &&
                      plan.valor_parcela && (
                        <div>
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
                  </div>

                  {selectedSchedules.length > 0 && (
                    <div className="schedule-selected-summary">
                      <strong>Horários ({selectedSchedules.length}/{requiredWeeklyLessons})</strong>
                      <div>
                        {selectedSchedules
                          .slice()
                          .sort((a, b) => a.weekday - b.weekday || a.hora_inicio.localeCompare(b.hora_inicio))
                          .map((schedule) => (
                            <span key={schedule.id}>
                              {WEEKDAYS.find((day) => day.value === schedule.weekday)?.label} • {formatTime(schedule.hora_inicio)} - {formatTime(schedule.hora_fim)} • {formatDate(schedule.date)}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="enrollment-security">
                    <ShieldCheck
                      size={20}
                    />

                    <p>
                      {plan?.tipo === 'avulso'
                        ? <>Seu agendamento será criado como <strong>pendente</strong>. A aula diagnóstica será confirmada após o pagamento.</>
                        : <>Sua matrícula será criada como <strong>pendente</strong>. O cadastro do aluno somente será criado após a confirmação do pagamento.</>}
                    </p>
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
                {step < 5 ? (
                  <button type="button" className="enrollment-submit" onClick={nextStep} disabled={loading || (step === 1 && !plan)}>
                    Continuar
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  <button type="button" className="enrollment-submit" onClick={createEnrollment} disabled={loading || !plan || !selectedSchedule}>
                    {loading ? 'Criando matrícula...' : 'Continuar para pagamento'}
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
                    ? (step === 5 && selectedSchedule?.valor_mensal != null
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
