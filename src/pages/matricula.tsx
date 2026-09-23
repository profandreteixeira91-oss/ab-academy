import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Languages,
  ShieldCheck,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'

import '../styles/matricula.css'
import logo from '../assets/logo_abacademy.png'
import usaFlag from '../assets/flag-usa.svg'
import germanyFlag from '../assets/flag-germany.svg'
import { supabase } from '../lib/supabase'

type Language = 'ingles' | 'alemao'

type Plan = {
  id: string
  idioma: Language
  tipo: 'mensal' | 'anual' | 'personalizado' | 'intensivo'
  nome: string
  descricao: string | null
  preco: number
  parcelas: number | null
  valor_parcela: number | null
  ativo: boolean
  created_at: string
  updated_at: string
}

type Horario = {
  id: string
  idioma: Language
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  disponivel: boolean
  aluno_id: string | null
  created_at: string
  meet_url: string | null
  meet_space_name: string | null
}

type SelectedSchedule = {
  id: string
  date: string
  weekday: number
  hora_inicio: string
  hora_fim: string
  meet_url: string | null
  meet_space_name: string | null
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
  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [loadingSchedules, setLoadingSchedules] =
    useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [email, setEmail] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [phone, setPhone] = useState('')
  const [responsibleName, setResponsibleName] =
    useState('')
  const [responsiblePhone, setResponsiblePhone] =
    useState('')

  const [language, setLanguage] =
    useState<Language | ''>('')

  const [conversationLevel, setConversationLevel] =
    useState('')
  const [writingLevel, setWritingLevel] = useState('')
  const [comprehensionLevel, setComprehensionLevel] =
    useState('')

  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlanId, setSelectedPlanId] =
    useState<string | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [diagnosticRequested, setDiagnosticRequested] = useState(false)

  const [availableSchedules, setAvailableSchedules] =
    useState<Horario[]>([])

  const [selectedSchedule, setSelectedSchedule] =
    useState<SelectedSchedule | null>(null)

  const [selectedWeekday, setSelectedWeekday] =
    useState<number | null>(null)

  const selectedLanguageLabel =
    language === 'ingles'
      ? 'Inglês'
      : language === 'alemao'
        ? 'Alemão'
        : ''

  const selectedPlanPrice = useMemo(() => {
    return plan?.preco ?? 0
  }, [plan])

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
    const loadUser = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        setUser(session?.user ?? null)

        if (session?.user) {
          const metadata =
            session.user.user_metadata || {}

          setName(
            metadata.full_name ||
              metadata.name ||
              '',
          )

          setEmail(
            session.user.email || '',
          )
        }
      } finally {
        setLoadingUser(false)
      }
    }

    loadUser()

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          setUser(session?.user ?? null)

          if (session?.user) {
            const metadata =
              session.user.user_metadata || {}

            setName(
              metadata.full_name ||
                metadata.name ||
                '',
            )

            setEmail(
              session.user.email || '',
            )
          }
        },
      )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedLanguage = params.get('idioma')
    const requestedDiagnostic = params.get('diagnostica') === '1'

    if (requestedLanguage === 'ingles' || requestedLanguage === 'alemao') {
      setLanguage(requestedLanguage)
    }

    setDiagnosticRequested(requestedDiagnostic)
  }, [])

  useEffect(() => {
    if (!language) {
      setPlans([])
      setPlan(null)
      setSelectedPlanId(null)
      setAvailableSchedules([])
      setSelectedSchedule(null)
      return
    }

    loadPlans(language)
    loadSchedules(language)
  }, [language])

  const loadPlans = async (
    selectedLanguage: Language,
  ) => {
    setLoadingPlans(true)
    setError('')

    const { data, error: plansError } =
      await supabase
        .from('planos')
        .select(
          `
            id,
            idioma,
            tipo,
            nome,
            descricao,
            preco,
            parcelas,
            valor_parcela,
            ativo,
            created_at,
            updated_at
          `,
        )
        .eq('idioma', selectedLanguage)
        .eq('ativo', true)
        .order('preco', {
          ascending: true,
        })

    if (plansError) {
      console.error(
        'Erro ao carregar planos:',
        plansError,
      )

      setError(
        'Não foi possível carregar os planos disponíveis.',
      )

      setPlans([])
    } else {
      const loadedPlans = (data || []) as Plan[]
      setPlans(loadedPlans)

      const requestedPlanId = new URLSearchParams(window.location.search).get('plano')
      if (requestedPlanId) {
        const requestedPlan = loadedPlans.find((item) => item.id === requestedPlanId)
        if (requestedPlan) {
          setSelectedPlanId(requestedPlan.id)
          setPlan(requestedPlan)
        }
      }
    }

    setLoadingPlans(false)
  }

  const loadSchedules = async (
    selectedLanguage: Language,
  ) => {
    setLoadingSchedules(true)
    setError('')

    const { data, error: schedulesError } =
      await supabase
        .from('horarios')
        .select(
          `
            id,
            idioma,
            dia_semana,
            hora_inicio,
            hora_fim,
            disponivel,
            aluno_id,
            created_at,
            meet_url,
            meet_space_name
          `,
        )
        .eq('idioma', selectedLanguage)
        .eq('disponivel', true)
        .is('aluno_id', null)
        .order('dia_semana', {
          ascending: true,
        })
        .order('hora_inicio', {
          ascending: true,
        })

    if (schedulesError) {
      console.error(
        'Erro ao carregar horários:',
        schedulesError,
      )

      setError(
        'Não foi possível carregar os horários disponíveis.',
      )

      setAvailableSchedules([])
    } else {
      setAvailableSchedules(
        (data || []) as Horario[],
      )
    }

    setLoadingSchedules(false)
  }

  const handleGoogleLogin = async () => {
    setError('')

    const { error: authError } =
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo:
            `${window.location.origin}/matricula`,
        },
      })

    if (authError) {
      console.error(authError)

      setError(
        'Não foi possível iniciar o login com Google.',
      )
    }
  }

  const validatePersonalData = () => {
    const cleanCpf = cleanDigits(cpf)
    const cleanPhone = cleanDigits(phone)
    const cleanResponsiblePhone =
      cleanDigits(responsiblePhone)

    if (!user) {
      setError(
        'Faça login com sua conta Google para continuar.',
      )
      return false
    }

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

  const validateLanguage = () => {
    if (!language) {
      setError(
        'Selecione um idioma.',
      )
      return false
    }

    if (
      !conversationLevel ||
      !writingLevel ||
      !comprehensionLevel
    ) {
      setError(
        'Informe seus níveis no idioma.',
      )
      return false
    }

    return true
  }

  const validatePlan = () => {
    if (!selectedPlanId || !plan) {
      setError(
        'Selecione um plano.',
      )
      return false
    }

    if (plan.id !== selectedPlanId) {
      setError(
        'O plano selecionado é inválido.',
      )
      return false
    }

    if (plan.idioma !== language) {
      setError(
        'O plano selecionado não corresponde ao idioma escolhido.',
      )
      return false
    }

    if (!plan.ativo) {
      setError(
        'Este plano não está mais disponível.',
      )
      return false
    }

    return true
  }

  const validateSchedule = () => {
    if (!selectedSchedule) {
      setError(
        'Selecione um horário disponível.',
      )
      return false
    }

    return true
  }

  const nextStep = () => {
    setError('')
    setSuccess('')

    if (step === 1) {
      if (!validatePersonalData()) return

      setStep(2)
      return
    }

    if (step === 2) {
      if (!validateLanguage()) return

      setStep(3)
      return
    }

    if (step === 3) {
      if (!validatePlan()) return

      setSelectedWeekday(null)
      setStep(4)
      return
    }

    if (step === 4) {
      if (!validateSchedule()) return

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

  const handleSelectPlan = (
    selected: Plan,
  ) => {
    setError('')

    setSelectedPlanId(selected.id)
    setPlan(selected)
  }

  const handleSelectSchedule = (
    horario: Horario,
  ) => {
    setError('')

    if (
      selectedSchedule?.id === horario.id
    ) {
      setSelectedSchedule(null)
      return
    }

    const schedule: SelectedSchedule = {
      id: horario.id,
      date: getDateForWeekday(
        horario.dia_semana,
      ),
      weekday: horario.dia_semana,
      hora_inicio: horario.hora_inicio,
      hora_fim: horario.hora_fim,
      meet_url: horario.meet_url,
      meet_space_name:
        horario.meet_space_name,
    }

    setSelectedSchedule(schedule)
  }

  const verifyScheduleAgain = async () => {
    if (!language || !selectedSchedule) {
      return false
    }

    const { data, error: verifyError } =
      await supabase
        .from('horarios')
        .select(
          `
            id,
            idioma,
            dia_semana,
            hora_inicio,
            hora_fim,
            disponivel,
            aluno_id,
            created_at,
            meet_url,
            meet_space_name
          `,
        )
        .eq('id', selectedSchedule.id)
        .eq('idioma', language)
        .eq('disponivel', true)
        .is('aluno_id', null)
        .maybeSingle()

    if (verifyError) {
      console.error(
        'Erro ao validar horário:',
        verifyError,
      )

      setError(
        'Não foi possível confirmar a disponibilidade do horário.',
      )

      return false
    }

    if (!data) {
      setError(
        'Este horário acabou de ser reservado. Escolha outro horário.',
      )

      await loadSchedules(language)

      setSelectedSchedule(null)

      return false
    }

    return true
  }

  const createEnrollment = async () => {
    if (!user) {
      setError(
        'Sua sessão expirou. Faça login novamente.',
      )
      return
    }

    if (!plan || !selectedSchedule || !language) {
      setError(
        'Complete todas as etapas da matrícula.',
      )
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const scheduleIsAvailable =
        await verifyScheduleAgain()

      if (!scheduleIsAvailable) {
        setLoading(false)
        return
      }

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
        plano_id: plan.id,
        idioma: plan.idioma,
        tipo_plano: plan.tipo,

        objetivos: null,

        aulas_semana:
          plan.tipo === 'intensivo'
            ? 3
            : plan.tipo === 'personalizado'
              ? 2
              : 1,

        valor_aula:
          plan.tipo === 'anual'
            ? null
            : Number(plan.preco) /
              (plan.tipo === 'intensivo' ? 12 : plan.tipo === 'personalizado' ? 8 : 4),

        valor_mensal:
          plan.tipo === 'anual'
            ? null
            : Number(plan.preco),

        valor_anual:
          plan.tipo === 'anual'
            ? Number(plan.preco)
            : null,

        horario_ids: [
          selectedSchedule.id,
        ],

        schedules: [
          selectedSchedule,
        ],

        dados_aluno: dadosAluno,

        valor: Number(plan.preco),
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

  if (loadingUser) {
    return (
      <div className="enrollment-page">
        <div className="enrollment-main">
          <div className="enrollment-container">
            <div className="enrollment-card">
              Carregando...
            </div>
          </div>
        </div>
      </div>
    )
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
              Preencha seus dados, escolha o
              idioma, plano e horário das aulas.
            </p>
          </div>

          <div className="enrollment-progress">
            {[
              'Dados pessoais',
              'Idioma',
              'Plano',
              'Horários',
              'Confirmação',
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
                    <div className="enrollment-progress-number">
                      {step > number ? (
                        <CheckCircle2
                          size={18}
                        />
                      ) : (
                        number
                      )}
                    </div>

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
                      'Seus dados pessoais'}

                    {step === 2 &&
                      'Escolha seu idioma'}

                    {step === 3 &&
                      'Escolha seu plano'}

                    {step === 4 &&
                      'Escolha seu horário'}

                    {step === 5 &&
                      'Confirme sua matrícula'}
                  </h2>

                  <p>
                    {step === 1 &&
                      'Informe os dados necessários para sua matrícula.'}

                    {step === 2 &&
                      'Selecione o idioma e informe seu nível atual.'}

                    {step === 3 &&
                      'Escolha o plano que deseja contratar.'}

                    {step === 4 &&
                      'Selecione um horário disponível para sua aula.'}

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

              {!user && step === 1 && (
                <>
                  <button
                    type="button"
                    className="google-login-button"
                    onClick={
                      handleGoogleLogin
                    }
                  >
                    <span className="google-icon">
                      G
                    </span>

                    Entrar com Google
                  </button>

                  <div className="enrollment-divider">
                    <span>
                      Depois do login, continue sua matrícula abaixo.
                    </span>
                  </div>
                </>
              )}

              {step === 1 && (
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
                      disabled={!user}
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
                      disabled={!user}
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
                      disabled={!user}
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
                      disabled={!user}
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
                      disabled={!user}
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
                      disabled={!user}
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
                      disabled={!user}
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <>
                  <div className="language-selection">
                    <button
                      type="button"
                      className={`language-selection-card ${
                        language === 'ingles'
                          ? 'selected'
                          : ''
                      }`}
                      onClick={() =>
                        setLanguage(
                          'ingles',
                        )
                      }
                    >
                      <img
                        src={usaFlag}
                        alt="Inglês"
                      />

                      <div>
                        <strong>
                          Inglês
                        </strong>

                        <span>
                          Aulas de inglês
                        </span>
                      </div>

                      <span className="selection-radio">
                        {language ===
                          'ingles' && (
                          <CheckCircle2
                            size={20}
                          />
                        )}
                      </span>
                    </button>

                    <button
                      type="button"
                      className={`language-selection-card ${
                        language === 'alemao'
                          ? 'selected'
                          : ''
                      }`}
                      onClick={() =>
                        setLanguage(
                          'alemao',
                        )
                      }
                    >
                      <img
                        src={germanyFlag}
                        alt="Alemão"
                      />

                      <div>
                        <strong>
                          Alemão
                        </strong>

                        <span>
                          Aulas de alemão
                        </span>
                      </div>

                      <span className="selection-radio">
                        {language ===
                          'alemao' && (
                          <CheckCircle2
                            size={20}
                          />
                        )}
                      </span>
                    </button>
                  </div>

                  {language && (
                    <div className="language-levels">
                      <div className="selection-heading">
                        <Languages
                          size={20}
                        />

                        <div>
                          <h3>
                            Seu nível atual
                          </h3>

                          <p>
                            Essas informações ajudam a direcionar suas aulas.
                          </p>
                        </div>
                      </div>

                      <div className="enrollment-field">
                        <label>
                          Conversação *
                        </label>

                        <select
                          value={
                            conversationLevel
                          }
                          onChange={(event) =>
                            setConversationLevel(
                              event.target.value,
                            )
                          }
                        >
                          <option value="">
                            Selecione
                          </option>
                          <option value="iniciante">
                            Iniciante
                          </option>
                          <option value="basico">
                            Básico
                          </option>
                          <option value="intermediario">
                            Intermediário
                          </option>
                          <option value="avancado">
                            Avançado
                          </option>
                          <option value="fluente">
                            Fluente
                          </option>
                        </select>
                      </div>

                      <div className="enrollment-field">
                        <label>
                          Escrita *
                        </label>

                        <select
                          value={
                            writingLevel
                          }
                          onChange={(event) =>
                            setWritingLevel(
                              event.target.value,
                            )
                          }
                        >
                          <option value="">
                            Selecione
                          </option>
                          <option value="iniciante">
                            Iniciante
                          </option>
                          <option value="basico">
                            Básico
                          </option>
                          <option value="intermediario">
                            Intermediário
                          </option>
                          <option value="avancado">
                            Avançado
                          </option>
                          <option value="fluente">
                            Fluente
                          </option>
                        </select>
                      </div>

                      <div className="enrollment-field">
                        <label>
                          Compreensão *
                        </label>

                        <select
                          value={
                            comprehensionLevel
                          }
                          onChange={(event) =>
                            setComprehensionLevel(
                              event.target.value,
                            )
                          }
                        >
                          <option value="">
                            Selecione
                          </option>
                          <option value="iniciante">
                            Iniciante
                          </option>
                          <option value="basico">
                            Básico
                          </option>
                          <option value="intermediario">
                            Intermediário
                          </option>
                          <option value="avancado">
                            Avançado
                          </option>
                          <option value="fluente">
                            Fluente
                          </option>
                        </select>
                      </div>
                    </div>
                  )}
                </>
              )}

              {step === 3 && (
                <div className="plan-selection">
                  {diagnosticRequested && (
                    <div className="diagnostic-offer">
                      <strong>Aula diagnóstica — R$ 50</strong>
                      <p>
                        Aula individual de 60 minutos em Inglês ou Alemão.
                        O valor é descontado da primeira mensalidade caso você se matricule.
                      </p>
                    </div>
                  )}

                  {!diagnosticRequested && (
                    <div className="diagnostic-offer">
                      <strong>Aula diagnóstica — R$ 50</strong>
                      <p>
                        Faça uma aula individual de 60 minutos em Inglês ou Alemão.
                        Em caso de matrícula, os R$ 50 são descontados da primeira mensalidade.
                      </p>
                    </div>
                  )}
                    <strong>Aula diagnóstica — R$ 50</strong>
                    <p>
                      Aula individual de 60 minutos para Inglês ou Alemão.
                      Se você se matricular, os R$ 50 são descontados da primeira mensalidade.
                    </p>
                  </div>

                  {loadingPlans ? (
                    <div className="enrollment-loading">
                      Carregando planos...
                    </div>
                  ) : plans.length === 0 ? (
                    <div className="enrollment-empty">
                      Nenhum plano disponível para{' '}
                      {selectedLanguageLabel}.
                    </div>
                  ) : (
                    plans.map((item) => {
                      const selected =
                        selectedPlanId ===
                        item.id

                      const installment =
                        getPlanPaymentDescription(
                          item,
                        )

                      return (
                        <button
                          type="button"
                          key={item.id}
                          className={`plan-card ${
                            selected
                              ? 'selected'
                              : ''
                          }`}
                          onClick={() =>
                            handleSelectPlan(
                              item,
                            )
                          }
                        >
                          <div className="plan-card-top">
                            <div>
                              <h3>
                                {item.nome}
                              </h3>

                              {item.descricao && (
                                <p>
                                  {
                                    item.descricao
                                  }
                                </p>
                              )}
                            </div>

                            <span className="selection-radio">
                              {selected && (
                                <CheckCircle2
                                  size={20}
                                />
                              )}
                            </span>
                          </div>

                          <div className="plan-price">
                            {formatCurrency(
                              item.preco,
                            )}

                            <span>
                              {item.tipo === 'anual'
                                ? ' / mês'
                                : ' / mês'}
                            </span>
                          </div>

                          {installment && (
                            <div className="plan-installment">
                              {installment}
                            </div>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="schedule-section">
                  <div className="selection-heading">
                    <div>
                      <h3>
                        Escolha seu horário
                      </h3>

                      <p>
                        Selecione{' '}
                        <strong>
                          1
                        </strong>{' '}
                        horário disponível.
                      </p>
                    </div>

                    <span>
                      {selectedSchedule
                        ? 1
                        : 0}
                      /1
                    </span>
                  </div>

                  {loadingSchedules ? (
                    <div className="enrollment-loading">
                      Carregando horários...
                    </div>
                  ) : availableSchedules.length ===
                    0 ? (
                    <div className="enrollment-empty">
                      Nenhum horário disponível para{' '}
                      {selectedLanguageLabel}.
                    </div>
                  ) : (
                    <>
                      <div className="schedule-calendar">
                        <button
                          type="button"
                          className={`schedule-date ${
                            selectedWeekday ===
                            null
                              ? 'selected'
                              : ''
                          }`}
                          onClick={() =>
                            setSelectedWeekday(
                              null,
                            )
                          }
                        >
                          <strong>
                            Todos
                          </strong>

                          <span>
                            horários
                          </span>
                        </button>

                        {groupedSchedules.map(
                          (weekday) => (
                            <button
                              type="button"
                              key={
                                weekday.value
                              }
                              className={`schedule-date ${
                                selectedWeekday ===
                                weekday.value
                                  ? 'selected'
                                  : ''
                              }`}
                              onClick={() =>
                                setSelectedWeekday(
                                  weekday.value,
                                )
                              }
                            >
                              <strong>
                                {
                                  weekday.short
                                }
                              </strong>

                              <span>
                                {
                                  weekday.schedules
                                    .length
                                }{' '}
                                opções
                              </span>
                            </button>
                          ),
                        )}
                      </div>

                      <div className="schedule-times">
                        {visibleSchedules.map(
                          (horario) => {
                            const selected =
                              selectedSchedule?.id ===
                              horario.id

                            return (
                              <button
                                type="button"
                                key={
                                  horario.id
                                }
                                className={`schedule-time ${
                                  selected
                                    ? 'selected'
                                    : ''
                                }`}
                                onClick={() =>
                                  handleSelectSchedule(
                                    horario,
                                  )
                                }
                              >
                                <strong>
                                  {formatTime(
                                    horario.hora_inicio,
                                  )}
                                </strong>

                                <span>
                                  até{' '}
                                  {formatTime(
                                    horario.hora_fim,
                                  )}
                                </span>

                                {selected && (
                                  <CheckCircle2
                                    size={18}
                                  />
                                )}
                              </button>
                            )
                          },
                        )}
                      </div>

                      {selectedSchedule && (
                        <div className="schedule-selected-summary">
                          <strong>
                            Horário selecionado
                          </strong>

                          <div>
                            <span>
                              {
                                WEEKDAYS.find(
                                  (day) =>
                                    day.value ===
                                    selectedSchedule.weekday,
                                )?.label
                              }
                            </span>

                            <span>
                              {formatTime(
                                selectedSchedule.hora_inicio,
                              )}{' '}
                              -{' '}
                              {formatTime(
                                selectedSchedule.hora_fim,
                              )}
                            </span>

                            <span>
                              {formatDate(
                                selectedSchedule.date,
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
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
                        Plano: {' '}
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
                        {plan
                          ? getPlanTypeLabel(
                              plan.tipo,
                            )
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
                        Valor:{' '}
                      </span>

                      <strong>
                        {formatCurrency(
                          selectedPlanPrice,
                        )}
                      </strong>
                    </div>

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

                  {selectedSchedule && (
                    <div className="schedule-selected-summary">
                      <strong>
                        Horário
                      </strong>

                      <div>
                        <span>
                          {
                            WEEKDAYS.find(
                              (day) =>
                                day.value ===
                                selectedSchedule.weekday,
                            )?.label
                          }
                        </span>

                        <span>
                          {formatTime(
                            selectedSchedule.hora_inicio,
                          )}{' '}
                          -{' '}
                          {formatTime(
                            selectedSchedule.hora_fim,
                          )}
                        </span>

                        <span>
                          {formatDate(
                            selectedSchedule.date,
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="enrollment-security">
                    <ShieldCheck
                      size={20}
                    />

                    <p>
                      Sua matrícula será criada
                      como <strong>pendente</strong>.
                      O cadastro do aluno somente
                      será criado após a confirmação
                      do pagamento.
                    </p>
                  </div>
                </div>
              )}

              <div className="enrollment-actions">
                {step > 1 && (
                  <button
                    type="button"
                    className="enrollment-back-button"
                    onClick={
                      previousStep
                    }
                    disabled={loading}
                  >
                    <ChevronLeft
                      size={18}
                    />

                    Voltar
                  </button>
                )}

                <div />

                {step < 5 ? (
                  <button
                    type="button"
                    className="enrollment-submit"
                    onClick={nextStep}
                    disabled={
                      loading ||
                      (step === 1 &&
                        !user)
                    }
                  >
                    Continuar

                    <ArrowRight
                      size={18}
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="enrollment-submit"
                    onClick={
                      createEnrollment
                    }
                    disabled={
                      loading ||
                      !plan ||
                      !selectedSchedule
                    }
                  >
                    {loading
                      ? 'Criando matrícula...'
                      : 'Continuar para pagamento'}

                    {!loading && (
                      <ArrowRight
                        size={18}
                      />
                    )}
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
                  {plan
                    ? getPlanTypeLabel(
                        plan.tipo,
                      )
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
                <span>
                  Valor: 
                </span>

                <strong>
                  {plan
                    ? formatCurrency(
                        selectedPlanPrice,
                      )
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
