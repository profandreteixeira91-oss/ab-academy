import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
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
  tipo: 'mensal' | 'anual' | 'personalizado' | 'intensivo' | 'avulso'
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
  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

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
  const [plan, setPlan] = useState<Plan | null>(null)
  const [availableSchedules, setAvailableSchedules] = useState<Horario[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState<SelectedSchedule | null>(null)
  const [selectedWeekday, setSelectedWeekday] = useState<number | null>(null)

  const selectedLanguageLabel =
    language === 'ingles'
      ? 'Inglês'
      : language === 'alemao'
        ? 'Alemão'
        : ''

  const selectedPlanPrice = useMemo(() => {
    return plan?.preco ?? 0
  }, [plan])

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      setUser(session?.user ?? null)
      setLoadingUser(false)
    }

    initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      setLoadingUser(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])


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

    const initializeEnrollment = async () => {
      const selectedLanguage: Language =
        requestedLanguage === 'alemao' ? 'alemao' : 'ingles'

      if (diagnosticRequested) {
        setLanguage(selectedLanguage)

        if (requestedPlanId) {
          await loadSelectedPlan(selectedLanguage, requestedPlanId)
        } else {
          const { data, error: diagnosticError } = await supabase
            .from('planos')
            .select('id, idioma, tipo, nome, descricao, preco, parcelas, valor_parcela, ativo, created_at, updated_at')
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

      if (!requestedPlanId) {
        setError('Nenhum plano foi selecionado. Volte à página de planos e escolha uma opção.')
        return
      }

      setLanguage(requestedLanguage)
      await loadSelectedPlan(requestedLanguage, requestedPlanId)
    }

    void initializeEnrollment()
  }, [])

  useEffect(() => {
    if (language) loadSchedules(language)
  }, [language])

  const loadSelectedPlan = async (selectedLanguage: Language, selectedPlanId: string) => {
    const { data, error: planError } = await supabase
      .from('planos')
      .select('id, idioma, tipo, nome, descricao, preco, parcelas, valor_parcela, ativo, created_at, updated_at')
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
            `${window.location.origin}${window.location.pathname}${window.location.search}`,
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
      if (!plan) {
        setError('O plano selecionado não está disponível.')
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
      if (!validateSchedule()) return
      setStep(4)
    }
  }

  const previousStep = () => {
    setError('')
    setSuccess('')

    if (step > 1) {
      setStep(step - 1)
    }
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
          plan.tipo === 'avulso'
            ? null
            : plan.tipo === 'intensivo'
              ? 3
              : plan.tipo === 'personalizado'
                ? 2
                : 1,

        valor_aula:
          plan.tipo === 'avulso'
            ? Number(plan.preco)
            : plan.tipo === 'anual'
              ? null
              : Number(plan.preco) /
                (plan.tipo === 'intensivo' ? 12 : plan.tipo === 'personalizado' ? 8 : 4),

        valor_mensal:
          plan.tipo === 'avulso' || plan.tipo === 'anual'
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
              'Dados pessoais',
              'Horário',
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
                    <div className="enrollment-progress-number">{number}</div>

                    <span>
                      {label}
                    </span>

                    {number < 4 && (
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
                      'Seus dados pessoais'}

                    {step === 3 &&
                      'Escolha seu horário'}

                    {step === 4 &&
                      'Confirme sua matrícula'}
                  </h2>

                  <p>
                    {step === 1 &&
                      'Confira o plano escolhido na página de planos.'}

                    {step === 2 &&
                      'Informe os dados necessários para sua matrícula.'}

                    {step === 3 &&
                      'Selecione um horário disponível para sua aula.'}

                    {step === 4 &&
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

              {!user && step === 2 && (
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

              {step === 3 && (
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

              {step === 4 && (
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
                {step < 4 ? (
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
                <span>
                  Valor: 
                </span>

                <strong>
                  {plan
                    ? formatCurrency(selectedPlanPrice) + (plan.tipo === 'avulso' ? ' pagamento único' : '')
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
