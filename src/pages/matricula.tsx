import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import type {
  ChangeEvent,
} from 'react'

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Languages,
  ShieldCheck,
} from 'lucide-react'

import type {
  User,
} from '@supabase/supabase-js'

import '../styles/matricula.css'

import logo from '../assets/logo_abacademy.png'
import usaFlag from '../assets/flag-usa.svg'
import germanyFlag from '../assets/flag-germany.svg'

import {
  supabase,
} from '../lib/supabase'


type Language =
  | 'ingles'
  | 'alemao'
  | null


type Plan =
  | 'mensal'
  | 'anual'
  | 'personalizado'
  | null


type BillingPeriod =
  | 'mensal'
  | 'anual'


type EnrollmentStep =
  | 1
  | 3


type Level =
  | 'basico'
  | 'intermediario'
  | 'avancado'
  | ''


type PersonalizedClassesPerWeek =
  | 1
  | 2
  | 3


type PlanData = {
  id: string
  idioma: 'ingles' | 'alemao'
  tipo: 'mensal' | 'anual' | 'personalizado'
  nome: string
  descricao: string
  preco: number
  parcelas: number | null
  valor_parcela: number | null
  ativo: boolean
}


type ScheduleSlot = {
  id: string
  time: string
  available: boolean
}


type SelectedSchedule = {
  id: string
  date: string
  time: string
  weekday: number
  weekdayName: string
}


/* =========================================================
   FUNÇÕES AUXILIARES
========================================================= */

function formatPrice(
  value: number | null | undefined,
) {
  const numericValue =
    Number(value)

  if (!Number.isFinite(numericValue)) {
    return 'R$ 0,00'
  }

  return `R$ ${numericValue
    .toFixed(2)
    .replace('.', ',')}`
}


function normalizeText(
  value: unknown,
) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
}


function normalizeLanguage(
  value: unknown,
): 'ingles' | 'alemao' | null {

  const normalized =
    normalizeText(value)

  if (
    normalized === 'ingles' ||
    normalized === 'english' ||
    normalized === 'ing'
  ) {
    return 'ingles'
  }

  if (
    normalized === 'alemao' ||
    normalized === 'german' ||
    normalized === 'deutsch' ||
    normalized === 'ale'
  ) {
    return 'alemao'
  }

  return null
}


function normalizePlanType(
  value: unknown,
):
  | 'mensal'
  | 'anual'
  | 'personalizado'
  | null {

  const normalized =
    normalizeText(value)

  if (
    normalized === 'mensal' ||
    normalized === 'monthly' ||
    normalized === 'month' ||
    normalized === 'mes' ||
    normalized === 'm'
  ) {
    return 'mensal'
  }

  if (
    normalized === 'anual' ||
    normalized === 'annual' ||
    normalized === 'yearly' ||
    normalized === 'year' ||
    normalized === 'ano' ||
    normalized === 'a'
  ) {
    return 'anual'
  }

  if (
    normalized === 'personalizado' ||
    normalized === 'personalizada' ||
    normalized === 'custom'
  ) {
    return 'personalizado'
  }

  return null
}


function getLocalDateString(
  date = new Date(),
) {

  const year =
    date.getFullYear()

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(2, '0')

  const day =
    String(
      date.getDate(),
    ).padStart(2, '0')

  return `${year}-${month}-${day}`
}


function formatSelectedDate(
  date: string,
) {

  if (!date) {
    return ''
  }

  return new Date(
    `${date}T12:00:00`,
  ).toLocaleDateString(
    'pt-BR',
    {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    },
  )
}

function getWeekdayNumber(
  date: string,
) {

  return new Date(
    `${date}T12:00:00`,
  ).getDay()
}


function formatWeekdayName(
  weekday: number,
) {

  const referenceDate =
    new Date(
      2024,
      0,
      7 + weekday,
    )

  const name =
    referenceDate.toLocaleDateString(
      'pt-BR',
      {
        weekday: 'long',
      },
    )

  return (
    name.charAt(0).toUpperCase() +
    name.slice(1)
  )
}


/* =========================================================
   MÁSCARAS
========================================================= */

function formatCpf(
  value: string,
) {

  const numbers =
    value
      .replace(/\D/g, '')
      .slice(0, 11)

  return numbers
    .replace(
      /(\d{3})(\d)/,
      '$1.$2',
    )
    .replace(
      /(\d{3})(\d)/,
      '$1.$2',
    )
    .replace(
      /(\d{3})(\d{1,2})$/,
      '$1-$2',
    )
}


function formatPhone(
  value: string,
) {

  const numbers =
    value
      .replace(/\D/g, '')
      .slice(0, 11)

  if (
    numbers.length <= 2
  ) {
    return numbers
  }

  if (
    numbers.length <= 7
  ) {
    return numbers.replace(
      /(\d{2})(\d+)/,
      '($1) $2',
    )
  }

  return numbers.replace(
    /(\d{2})(\d{5})(\d{1,4})/,
    '($1) $2-$3',
  )
}


/* =========================================================
   COMPONENTE
========================================================= */

function Matricula() {

  /* =========================================================
     AUTENTICAÇÃO
  ========================================================= */

  const [user, setUser] =
    useState<User | null>(null)

  const [loadingAuth, setLoadingAuth] =
    useState(true)

  const [name, setName] =
    useState('')

  const [email, setEmail] =
    useState('')


  /* =========================================================
     CADASTRO
  ========================================================= */

  const [cpf, setCpf] =
    useState('')

  const [birthDate, setBirthDate] =
    useState('')

  const [phone, setPhone] =
    useState('')

  const [responsibleName, setResponsibleName] =
    useState('')

  const [responsiblePhone, setResponsiblePhone] =
    useState('')

  const [studentId, setStudentId] =
    useState('')

  const [profileLoaded, setProfileLoaded] =
    useState(false)

  const [profileLoading, setProfileLoading] =
    useState(false)

  const [profileSaving, setProfileSaving] =
    useState(false)

  const [profileError, setProfileError] =
    useState('')


  /* =========================================================
     NÍVEIS
  ========================================================= */

  const [conversationLevel, setConversationLevel] =
    useState<Level>('')

  const [writingLevel, setWritingLevel] =
    useState<Level>('')

  const [comprehensionLevel, setComprehensionLevel] =
    useState<Level>('')


  /* =========================================================
     CURSO / PLANO
  ========================================================= */

  const [language, setLanguage] =
    useState<Language>('ingles')

  const [plan, setPlan] =
    useState<Plan>(null)

  const [plans, setPlans] =
    useState<PlanData[]>([])

  const [loadingPlans, setLoadingPlans] =
    useState(true)

  const [plansError, setPlansError] =
    useState('')


  /* =========================================================
     PLANO PERSONALIZADO
  ========================================================= */

  const [
    personalizedObjective,
    setPersonalizedObjective,
  ] =
    useState('')

  const [
    personalizedClassesPerWeek,
    setPersonalizedClassesPerWeek,
  ] =
    useState<PersonalizedClassesPerWeek>(1)

  const [
    personalizedBillingPeriod,
    setPersonalizedBillingPeriod,
  ] =
    useState<BillingPeriod>('mensal')


  /* =========================================================
     ETAPA
  ========================================================= */

  const [step, setStep] =
    useState<EnrollmentStep>(1)


  /* =========================================================
     AGENDA
  ========================================================= */

  const [selectedDate, setSelectedDate] =
    useState('')

  const [selectedTime, setSelectedTime] =
    useState('')

  const [availableTimes, setAvailableTimes] =
    useState<ScheduleSlot[]>([])

  const [loadingTimes, setLoadingTimes] =
    useState(false)

  const [scheduleError, setScheduleError] =
    useState('')

  const [bookingConfirmed, setBookingConfirmed] =
    useState(false)

  const [bookingLoading, setBookingLoading] =
    useState(false)

  const [
    selectedSchedules,
    setSelectedSchedules,
  ] =
    useState<SelectedSchedule[]>([])


  /* =========================================================
     DATA MÍNIMA
  ========================================================= */

  const minimumStartDate =
    useMemo(
      () =>
        getLocalDateString(),
      [],
    )


  /* =========================================================
     CARREGAR PLANOS
  ========================================================= */

  useEffect(() => {

    let mounted = true

    const loadPlans =
      async () => {

        setLoadingPlans(true)
        setPlansError('')

        const {
          data,
          error,
        } =
          await supabase
            .from('planos')
            .select(
              'id, idioma, tipo, nome, descricao, preco, parcelas, valor_parcela, ativo',
            )
            .eq(
              'ativo',
              true,
            )
            .order(
              'idioma',
            )
            .order(
              'tipo',
            )

        if (!mounted) {
          return
        }

        if (error) {

          console.error(
            'Erro ao carregar planos:',
            error,
          )

          setPlans([])
          setPlansError(
            'Não foi possível carregar os planos.',
          )
          setLoadingPlans(false)

          return
        }

        const normalizedPlans:
          PlanData[] = []

        for (
          const item of data || []
        ) {

          const idioma =
            normalizeLanguage(
              item.idioma,
            )

          const tipo =
            normalizePlanType(
              item.tipo,
            )

          if (
            !idioma ||
            !tipo ||
            tipo === 'personalizado'
          ) {
            continue
          }

          const preco =
            Number(
              item.preco,
            )

          if (
            !Number.isFinite(
              preco,
            )
          ) {
            continue
          }

          const parcelas =
            item.parcelas === null ||
            item.parcelas === undefined
              ? null
              : Number(
                  item.parcelas,
                )

          const valorParcela =
            item.valor_parcela === null ||
            item.valor_parcela === undefined
              ? null
              : Number(
                  item.valor_parcela,
                )

          normalizedPlans.push({
            id: String(
              item.id,
            ),

            idioma,

            tipo,

            nome:
              String(
                item.nome ??
                  (
                    tipo === 'mensal'
                      ? 'Plano Mensal'
                      : 'Plano Anual'
                  ),
              ),

            descricao:
              String(
                item.descricao ??
                  '',
              ),

            preco,

            parcelas:
              parcelas !== null &&
              Number.isFinite(
                parcelas,
              )
                ? parcelas
                : null,

            valor_parcela:
              valorParcela !== null &&
              Number.isFinite(
                valorParcela,
              )
                ? valorParcela
                : null,

            ativo:
              item.ativo !== false,
          })
        }

        setPlans(
          normalizedPlans,
        )

        if (
          normalizedPlans.length === 0
        ) {

          setPlansError(
            'Nenhum plano disponível foi encontrado.',
          )
        }

        setLoadingPlans(false)
      }

    loadPlans()

    return () => {
      mounted = false
    }

  }, [])


  /* =========================================================
     AUTENTICAÇÃO
  ========================================================= */

  useEffect(() => {

    let mounted = true

    const applyUser =
      (
        authenticatedUser:
          User | null,
      ) => {

        if (!mounted) {
          return
        }

        setUser(
          authenticatedUser,
        )

        if (
          authenticatedUser
        ) {

          setName(
            authenticatedUser
              .user_metadata
              ?.full_name ||
            authenticatedUser
              .user_metadata
              ?.name ||
            '',
          )

          setEmail(
            authenticatedUser.email ||
              '',
          )

        } else {

          setName('')
          setEmail('')
          setCpf('')
          setBirthDate('')
          setPhone('')
          setResponsibleName('')
          setResponsiblePhone('')
          setStudentId('')
          setProfileLoaded(false)

          setPersonalizedObjective('')
          setPersonalizedClassesPerWeek(1)
          setPersonalizedBillingPeriod('mensal')

          setSelectedSchedules([])
        }
      }


    const loadUser =
      async () => {

        const {
          data: {
            user:
              authenticatedUser,
          },
        } =
          await supabase.auth.getUser()

        if (!mounted) {
          return
        }

        applyUser(
          authenticatedUser,
        )

        setLoadingAuth(false)
      }


    loadUser()


    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (
          _event,
          session,
        ) => {

          if (!mounted) {
            return
          }

          applyUser(
            session?.user ||
              null,
          )

          setLoadingAuth(false)
        },
      )


    return () => {

      mounted = false

      subscription.unsubscribe()
    }

  }, [])


  /* =========================================================
     CARREGAR ALUNO
  ========================================================= */

  useEffect(() => {

    if (!user) {
      return
    }

    let mounted = true

    const loadStudentProfile =
      async () => {

        setProfileLoading(true)
        setProfileError('')

        const {
          data,
          error,
        } =
          await supabase
            .from('alunos')
            .select(
              `
                id,
                nome_completo,
                cpf,
                email,
                data_nascimento,
                telefone,
                responsavel_nome,
                responsavel_contato,
                idioma,
                nivel_conversacao,
                nivel_escrita,
                nivel_compreensao
              `,
            )
            .eq(
              'user_id',
              user.id,
            )
            .maybeSingle()

        if (!mounted) {
          return
        }

        if (error) {

          console.error(
            'Erro ao carregar cadastro:',
            error,
          )

          setProfileError(
            `Não foi possível carregar seus dados: ${error.message}`,
          )

          setProfileLoaded(false)
          setProfileLoading(false)

          return
        }

        if (data) {

          setStudentId(
            data.id,
          )

          setName(
            data.nome_completo ||
              '',
          )

          setCpf(
            data.cpf
              ? formatCpf(data.cpf)
              : '',
          )

          setEmail(
            data.email ||
              user.email ||
              '',
          )

          setBirthDate(
            data.data_nascimento ||
              '',
          )

          setPhone(
            data.telefone
              ? formatPhone(data.telefone)
              : '',
          )

          setResponsibleName(
            data.responsavel_nome ||
              '',
          )

          setResponsiblePhone(
            data.responsavel_contato
              ? formatPhone(
                  data.responsavel_contato,
                )
              : '',
          )

          const savedLanguage =
            normalizeLanguage(
              data.idioma,
            )

          if (
            savedLanguage
          ) {
            setLanguage(
              savedLanguage,
            )
          }

          setConversationLevel(
            (
              data.nivel_conversacao ||
              ''
            ) as Level,
          )

          setWritingLevel(
            (
              data.nivel_escrita ||
              ''
            ) as Level,
          )

          setComprehensionLevel(
            (
              data.nivel_compreensao ||
              ''
            ) as Level,
          )

          setProfileLoaded(true)

        } else {

          setProfileLoaded(false)
        }

        setProfileLoading(false)
      }


    loadStudentProfile()

    return () => {
      mounted = false
    }

  }, [user])


  /* =========================================================
     LOGIN GOOGLE
  ========================================================= */

  const handleGoogleLogin =
    async () => {

      try {

        setLoadingAuth(true)

        const {
          error,
        } =
          await supabase.auth
            .signInWithOAuth({
              provider:
                'google',

              options: {
                redirectTo:
                  `${window.location.origin}/matricula`,
              },
            })

        if (error) {

          console.error(
            'Erro no login Google:',
            error,
          )

          alert(
            `Não foi possível iniciar o login com Google: ${error.message}`,
          )

          setLoadingAuth(false)
        }

      } catch (error) {

        console.error(
          'Erro inesperado no login Google:',
          error,
        )

        alert(
          'Não foi possível iniciar o login com Google.',
        )

        setLoadingAuth(false)
      }
    }


  /* =========================================================
     SALVAR / ATUALIZAR ALUNO
  ========================================================= */

  const handleSaveProfile =
    async () => {

      if (!user) {

        alert(
          'Faça login com sua conta Google para continuar.',
        )

        return false
      }

      const cleanCpf =
        cpf.replace(
          /\D/g,
          '',
        )

      const cleanPhone =
        phone.replace(
          /\D/g,
          '',
        )

      const cleanResponsiblePhone =
        responsiblePhone.replace(
          /\D/g,
          '',
        )

      if (!name.trim()) {

        alert(
          'Informe seu nome completo.',
        )

        return false
      }

      if (
        cleanCpf.length !== 11
      ) {

        alert(
          'Informe um CPF válido.',
        )

        return false
      }

      if (!email.trim()) {

        alert(
          'Informe seu e-mail.',
        )

        return false
      }

      if (!birthDate) {

        alert(
          'Informe sua data de nascimento.',
        )

        return false
      }

      if (
        cleanPhone.length < 10
      ) {

        alert(
          'Informe um telefone/WhatsApp válido.',
        )

        return false
      }

      if (
        responsibleName.trim() &&
        cleanResponsiblePhone.length < 10
      ) {

        alert(
          'Informe um contato válido para o responsável.',
        )

        return false
      }

      if (!language) {

        alert(
          'Selecione um idioma.',
        )

        return false
      }

      if (
        !conversationLevel ||
        !writingLevel ||
        !comprehensionLevel
      ) {

        alert(
          'Informe seus níveis no idioma.',
        )

        return false
      }

      try {

        setProfileSaving(true)
        setProfileError('')

        const studentData = {
          user_id:
            user.id,

          nome_completo:
            name.trim(),

          cpf:
            cleanCpf,

          email:
            email.trim(),

          data_nascimento:
            birthDate,

          telefone:
            cleanPhone,

          responsavel_nome:
            responsibleName.trim() ||
            null,

          responsavel_contato:
            cleanResponsiblePhone ||
            null,

          idioma:
            language,

          nivel_conversacao:
            conversationLevel,

          nivel_escrita:
            writingLevel,

          nivel_compreensao:
            comprehensionLevel,

          updated_at:
            new Date().toISOString(),
        }


        const {
          data: existingStudent,
          error: findError,
        } =
          await supabase
            .from('alunos')
            .select('id')
            .eq(
              'user_id',
              user.id,
            )
            .maybeSingle()

        if (findError) {

          console.error(
            'Erro ao localizar aluno:',
            findError,
          )

          setProfileError(
            `Não foi possível localizar seu cadastro: ${findError.message}`,
          )

          return false
        }


        let savedStudentId =
          existingStudent?.id ||
          studentId


        if (
          savedStudentId
        ) {

          const {
            error: updateError,
          } =
            await supabase
              .from('alunos')
              .update(
                studentData,
              )
              .eq(
                'id',
                savedStudentId,
              )
              .eq(
                'user_id',
                user.id,
              )

          if (updateError) {

            console.error(
              'Erro ao atualizar aluno:',
              updateError,
            )

            setProfileError(
              `Não foi possível atualizar seu cadastro: ${updateError.message}`,
            )

            return false
          }

        } else {

          const {
            data: insertedStudent,
            error: insertError,
          } =
            await supabase
              .from('alunos')
              .insert(
                studentData,
              )
              .select('id')
              .single()

          if (insertError) {

            console.error(
              'Erro ao inserir aluno:',
              insertError,
            )

            if (
              insertError.code ===
              '23505'
            ) {

              setProfileError(
                'Este CPF ou esta conta Google já está cadastrada.',
              )

            } else {

              setProfileError(
                `Não foi possível salvar seu cadastro: ${insertError.message}`,
              )
            }

            return false
          }

          savedStudentId =
            insertedStudent.id
        }


        setStudentId(
          savedStudentId,
        )

        setProfileLoaded(
          true,
        )

        return true

      } catch (error) {

        console.error(
          'Erro inesperado ao salvar aluno:',
          error,
        )

        setProfileError(
          'Ocorreu um erro inesperado ao salvar seus dados.',
        )

        return false

      } finally {

        setProfileSaving(false)
      }
    }


  /* =========================================================
     PLANO
  ========================================================= */

  const getPlan =
    (
      selectedLanguage:
        Language,
      selectedPlan:
        Plan,
    ): PlanData | null => {

      if (
        !selectedLanguage ||
        !selectedPlan
      ) {
        return null
      }

      if (
        selectedPlan ===
        'personalizado'
      ) {

        return {
          id:
            `personalizado-${selectedLanguage}`,

          idioma:
            selectedLanguage,

          tipo:
            'personalizado',

          nome:
            'Plano Personalizado',

          descricao:
            'Aulas adaptadas aos seus objetivos',

          preco:
            0,

          parcelas:
            null,

          valor_parcela:
            null,

          ativo:
            true,
        }
      }

      return (
        plans.find(
          (
            item,
          ) =>
            item.idioma ===
              selectedLanguage &&
            item.tipo ===
              selectedPlan,
        ) ||
        null
      )
    }


  const monthlyPlan =
    getPlan(
      language,
      'mensal',
    )

  const annualPlan =
    getPlan(
      language,
      'anual',
    )

  const selectedPlan =
    getPlan(
      language,
      plan,
    )


  const languageName =
    language === 'ingles'
      ? 'Inglês'
      : language === 'alemao'
        ? 'Alemão'
        : null


  /* =========================================================
     PREÇOS DO PLANO PERSONALIZADO
  ========================================================= */

  const personalizedHourlyPrice =
    useMemo(() => {

      if (!language) {
        return 0
      }

      const prices = {
        ingles: {
          1: 100,
          2: 90,
          3: 80,
        },

        alemao: {
          1: 120,
          2: 110,
          3: 100,
        },
      }

      return prices[
        language
      ][
        personalizedClassesPerWeek
      ]

    }, [
      language,
      personalizedClassesPerWeek,
    ])


  const personalizedMonthlyPrice =
    useMemo(() => {

      return (
        personalizedHourlyPrice *
        personalizedClassesPerWeek *
        4
      )

    }, [
      personalizedHourlyPrice,
      personalizedClassesPerWeek,
    ])


  const personalizedAnnualFullPrice =
    useMemo(() => {

      return (
        personalizedMonthlyPrice *
        12
      )

    }, [
      personalizedMonthlyPrice,
    ])


  const personalizedAnnualDiscount =
    useMemo(() => {

      return (
        personalizedAnnualFullPrice *
        0.05
      )

    }, [
      personalizedAnnualFullPrice,
    ])


  const personalizedAnnualPrice =
    useMemo(() => {

      return (
        personalizedAnnualFullPrice -
        personalizedAnnualDiscount
      )

    }, [
      personalizedAnnualFullPrice,
      personalizedAnnualDiscount,
    ])


  const personalizedCurrentPrice =
    personalizedBillingPeriod ===
    'anual'
      ? personalizedAnnualPrice
      : personalizedMonthlyPrice


  const personalizedCurrentPeriod =
    personalizedBillingPeriod ===
    'anual'
      ? '/ano'
      : '/mês'


  /* =========================================================
     DATAS
  ========================================================= */

  const availableDates =
    useMemo(() => {

      const dates: {
        value: string
        day: string
        weekday: string
      }[] = []

      const today =
        new Date()

      for (
        let i = 0;
        i < 14;
        i++
      ) {

        const date =
          new Date(
            today,
          )

        date.setDate(
          today.getDate() +
            i,
        )

        const value =
          getLocalDateString(
            date,
          )

        const day =
          date.toLocaleDateString(
            'pt-BR',
            {
              day: '2-digit',
            },
          )

        const weekday =
          date
            .toLocaleDateString(
              'pt-BR',
              {
                weekday: 'short',
              },
            )
            .replace(
              '.',
              '',
            )

        dates.push({
          value,
          day,
          weekday:
            weekday
              .charAt(0)
              .toUpperCase() +
            weekday.slice(1),
        })
      }

      return dates

    }, [])


  /* =========================================================
     CARREGAR HORÁRIOS REAIS
========================================================= */

  useEffect(() => {

    if (
      !selectedDate ||
      !language
    ) {

      setAvailableTimes([])

      return
    }

    let mounted = true

    const loadAvailableTimes =
      async () => {

        setLoadingTimes(true)
        setScheduleError('')
        setAvailableTimes([])
        setSelectedTime('')

        const weekday =
          getWeekdayNumber(
            selectedDate,
          )

        const {
          data,
          error,
        } =
          await supabase
            .from('horarios')
            .select(
              'id, hora_inicio, hora_fim, disponivel, aluno_id',
            )
            .eq(
              'idioma',
              language,
            )
            .eq(
              'dia_semana',
              weekday,
            )
            .eq(
              'disponivel',
              true,
            )
            .is(
              'aluno_id',
              null,
            )
            .order(
              'hora_inicio',
            )

        if (!mounted) {
          return
        }

        if (error) {

          console.error(
            'Erro ao carregar horários:',
            error,
          )

          setScheduleError(
            `Não foi possível carregar os horários: ${error.message}`,
          )

          setLoadingTimes(false)

          return
        }

        const slots:
          ScheduleSlot[] =
          (data || []).map(
            (
              item,
            ) => ({
              id:
                String(
                  item.id,
                ),

              time:
                String(
                  item.hora_inicio,
                ).slice(
                  0,
                  5,
                ),

              available:
                item.disponivel ===
                  true &&
                item.aluno_id ===
                  null,
            }),
          )

        setAvailableTimes(
          slots,
        )

        if (
          slots.length === 0
        ) {

          setScheduleError(
            'Não há horários disponíveis para este dia.',
          )
        }

        setLoadingTimes(false)
      }

    loadAvailableTimes()

    return () => {
      mounted = false
    }

  }, [
    selectedDate,
    language,
  ])


  /* =========================================================
     DATA SELECIONADA
  ========================================================= */

  /* =========================================================
     SELECIONAR DATA
  ========================================================= */

  const handleDateChange =
    (
      date: string,
    ) => {

      if (!date) {
        return
      }

      if (
        date <
        minimumStartDate
      ) {

        alert(
          'A data de início não pode ser anterior a hoje.',
        )

        return
      }

      setSelectedDate(
        date,
      )

      setSelectedTime('')

      setBookingConfirmed(
        false,
      )

      setScheduleError('')
    }


  /* =========================================================
     DATA MANUAL
  ========================================================= */

  const handleManualDateChange =
    (
      event:
        ChangeEvent<HTMLInputElement>,
    ) => {

      handleDateChange(
        event.target.value,
      )
    }


  /* =========================================================
     ADICIONAR / REMOVER HORÁRIO
  ========================================================= */

  const handleTimeChange =
    (
      time: string,
    ) => {

      if (!selectedDate) {
        return
      }

      const slot =
        availableTimes.find(
          item =>
            item.time ===
            time,
        )

      if (!slot) {
        return
      }

      const weekday =
        getWeekdayNumber(
          selectedDate,
        )

      const weekdayName =
        formatWeekdayName(
          weekday,
        )

      const existingIndex =
        selectedSchedules.findIndex(
          item =>
            item.date ===
              selectedDate &&
            item.time ===
              time,
        )

      if (
        existingIndex >= 0
      ) {

        setSelectedSchedules(
          current =>
            current.filter(
              (
                _item,
                index,
              ) =>
                index !==
                existingIndex,
            ),
        )

        setSelectedTime('')

        setBookingConfirmed(
          false,
        )

        return
      }


      const maximumSchedules =
        plan ===
        'personalizado'
          ? personalizedClassesPerWeek
          : 1


      if (
        selectedSchedules.length >=
        maximumSchedules
      ) {

        if (
          maximumSchedules === 1
        ) {

          setSelectedSchedules([
            {
              id:
                slot.id,

              date:
                selectedDate,

              time,

              weekday,

              weekdayName,
            },
          ])

          setSelectedTime(
            time,
          )

        } else {

          alert(
            `Seu plano permite até ${maximumSchedules} aulas por semana.`,
          )
        }

        setBookingConfirmed(
          false,
        )

        return
      }


      setSelectedSchedules(
        current => [
          ...current,
          {
            id:
              slot.id,

            date:
              selectedDate,

            time,

            weekday,

            weekdayName,
          },
        ],
      )

      setSelectedTime(
        time,
      )

      setBookingConfirmed(
        false,
      )
    }


  /* =========================================================
     REMOVER HORÁRIO SELECIONADO
  ========================================================= */

  const removeSelectedSchedule =
    (
      schedule:
        SelectedSchedule,
    ) => {

      setSelectedSchedules(
        current =>
          current.filter(
            item =>
              !(
                item.date ===
                  schedule.date &&
                item.time ===
                  schedule.time
              ),
          ),
      )

      if (
        selectedDate ===
          schedule.date &&
        selectedTime ===
          schedule.time
      ) {
        setSelectedTime('')
      }

      setBookingConfirmed(
        false,
      )
    }


  /* =========================================================
     CONFIRMAR MATRÍCULA / HORÁRIOS
  ========================================================= */

  const handleConfirmBooking = async () => {
  console.log('handleConfirmBooking iniciou')

  if (!user) {
    alert(
      'Faça login com sua conta Google para continuar.',
    )
    return
  }

  const requiredSchedules =
    plan === 'personalizado'
      ? personalizedClassesPerWeek
      : 1

  if (
    selectedSchedules.length !==
    requiredSchedules
  ) {
    alert(
      plan === 'personalizado'
        ? `Selecione exatamente ${requiredSchedules} horários semanais.`
        : 'Escolha um horário para suas aulas.',
    )
    return
  }

  if (!selectedPlan) {
    alert(
      'Selecione um plano antes de continuar.',
    )
    return
  }

  if (
    plan === 'personalizado' &&
    !personalizedObjective.trim()
  ) {
    alert(
      'Informe seus objetivos para o plano personalizado.',
    )
    return
  }

  try {
    setBookingLoading(true)
    setScheduleError('')

    /*
     * VALIDA OS HORÁRIOS
     *
     * Nenhum horário é reservado neste momento.
     */
    const scheduleIds =
      selectedSchedules.map(
        item => item.id,
      )

    const {
      data: freshSlots,
      error: freshSlotsError,
    } =
      await supabase
        .from('horarios')
        .select(
          'id, hora_inicio, hora_fim, disponivel, aluno_id, dia_semana',
        )
        .in(
          'id',
          scheduleIds,
        )
        .eq(
          'idioma',
          language,
        )
        .eq(
          'disponivel',
          true,
        )
        .is(
          'aluno_id',
          null,
        )

    if (freshSlotsError) {
      console.error(
        'Erro ao verificar horários:',
        freshSlotsError,
      )

      setScheduleError(
        `Não foi possível verificar os horários: ${freshSlotsError.message}`,
      )

      return
    }

    if (
      !freshSlots ||
      freshSlots.length !==
        selectedSchedules.length
    ) {
      setScheduleError(
        'Um ou mais horários acabaram de ser reservados. Atualize sua seleção e tente novamente.',
      )

      setSelectedSchedules([])
      setSelectedTime('')

      return
    }

    

    /*
     * VALOR DO PAGAMENTO
     *
     * Plano normal:
     * usa o preço do plano.
     *
     * Plano personalizado:
     * usa o valor mensal calculado.
     */
    const paymentValue =
      plan === 'personalizado'
        ? personalizedMonthlyPrice
        : selectedPlan.preco

    /*
     * DADOS DA FUTURA MATRÍCULA
     *
     * Nada disso é gravado em alunos/matriculas ainda.
     */
    const enrollmentData = {
      user_id:
        user.id,

      nome_completo:
        name.trim(),

      cpf:
        cpf.replace(
          /\D/g,
          '',
        ),

      email:
        email.trim(),

      data_nascimento:
        birthDate,

      telefone:
        phone.replace(
          /\D/g,
          '',
        ),

      responsavel_nome:
        responsibleName.trim() ||
        null,

      responsavel_contato:
        responsiblePhone.replace(
          /\D/g,
          '',
        ) || null,

      idioma:
        language,

      nivel_conversacao:
        conversationLevel,

      nivel_escrita:
        writingLevel,

      nivel_compreensao:
        comprehensionLevel,

      data_inicio:
        selectedSchedules[0].date,

      dia_semana:
        selectedSchedules[0].weekday,

      horario:
        `${selectedSchedules[0].time}:00`,

      tipo_plano:
        plan === 'personalizado'
          ? 'personalizado'
          : selectedPlan.tipo,

      plano_id:
        plan === 'personalizado'
          ? null
          : selectedPlan.id,

      objetivos:
        plan === 'personalizado'
          ? personalizedObjective.trim()
          : null,

      aulas_semana:
        plan === 'personalizado'
          ? personalizedClassesPerWeek
          : 1,

      valor_aula:
        plan === 'personalizado'
          ? personalizedHourlyPrice
          : null,

      valor_mensal:
        plan === 'personalizado'
          ? personalizedMonthlyPrice
          : null,

      valor_anual:
        plan === 'personalizado'
          ? personalizedAnnualPrice
          : null,

      schedules:
        selectedSchedules,
    }

        /*
     * CRIA A INTENÇÃO DE PAGAMENTO.
     */
    const {
      data: paymentIntent,
      error: paymentIntentError,
    } =
      await supabase
        .from('pagamentos')
        .insert({
          user_id:
            user.id,

          plano_id:
            plan === 'personalizado'
              ? null
              : selectedPlan.id,

          idioma:
            language,

          tipo_plano:
            plan === 'personalizado'
              ? 'personalizado'
              : selectedPlan.tipo,

          metodo:
            'pix',

          status:
            'pendente',

          valor:
            paymentValue,

          parcelas:
            null,

          dados_matricula:
            enrollmentData,

          horario_ids:
            scheduleIds,
        })
        .select('id')
        .single()

    /*
     * VERIFICA SE HOUVE ERRO NO SUPABASE.
     */
    if (paymentIntentError) {
      console.error(
        'Erro ao criar intenção de pagamento:',
        paymentIntentError,
      )

      setScheduleError(
        `Não foi possível iniciar o pagamento: ${paymentIntentError.message}`,
      )

      return
    }

    /*
     * GARANTE QUE O SUPABASE RETORNOU A INTENÇÃO.
     */
    if (
      !paymentIntent ||
      !paymentIntent.id
    ) {
      console.error(
        'Intenção de pagamento criada, mas o ID não foi retornado:',
        paymentIntent,
      )

      setScheduleError(
        'O pagamento foi iniciado, mas não foi possível identificar a cobrança. Tente novamente.',
      )

      return
    }

    /*
     * GUARDA O ID DO PAGAMENTO.
     */
    const pagamentoId =
      paymentIntent.id

    console.log(
      'Intenção de pagamento criada:',
      paymentIntent,
    )

    console.log(
      'ID do pagamento:',
      pagamentoId,
    )

    /*
     * VAI PARA O CHECKOUT.
     */
    window.location.assign(
      `/checkout/${pagamentoId}`,
    )

  } catch (error) {

    console.error(
      'Erro inesperado ao confirmar matrícula:',
      error,
    )

    setScheduleError(
      'Ocorreu um erro inesperado ao iniciar o pagamento.',
    )

  } finally {

    setBookingLoading(false)
  }
}


  /* =========================================================
     IDIOMA
  ========================================================= */

  const handleLanguageChange =
    (
      selectedLanguage:
        Language,
    ) => {

      if (
        !selectedLanguage
      ) {
        return
      }

      setLanguage(
        selectedLanguage,
      )

      setPlan(null)

      setPersonalizedObjective('')
      setPersonalizedClassesPerWeek(1)
      setPersonalizedBillingPeriod('mensal')

      setConversationLevel('')
      setWritingLevel('')
      setComprehensionLevel('')

      setSelectedDate('')
      setSelectedTime('')

      setAvailableTimes([])

      setSelectedSchedules([])

      setBookingConfirmed(
        false,
      )

      setStep(1)
    }


  /* =========================================================
     PLANO
  ========================================================= */

  const handlePlanChange =
    (
      selectedPlan:
        Plan,
    ) => {

      if (
        loadingPlans ||
        !selectedPlan
      ) {
        return
      }

      setPlan(
        selectedPlan,
      )

      if (
        selectedPlan !==
        'personalizado'
      ) {

        setPersonalizedObjective('')
        setPersonalizedClassesPerWeek(1)
        setPersonalizedBillingPeriod('mensal')
      }

      setSelectedDate('')
      setSelectedTime('')

      setAvailableTimes([])

      setSelectedSchedules([])

      setBookingConfirmed(
        false,
      )
    }


  /* =========================================================
     CONTINUAR
  ========================================================= */

  const handleContinue =
    async () => {

      if (!user) {

        alert(
          'Faça login com sua conta Google para continuar.',
        )

        return
      }

      const saved =
        await handleSaveProfile()

      if (!saved) {
        return
      }

      if (!language) {

        alert(
          'Selecione um idioma para continuar.',
        )

        return
      }

      if (
        !conversationLevel ||
        !writingLevel ||
        !comprehensionLevel
      ) {

        alert(
          'Informe seu nível de conversação, escrita e compreensão.',
        )

        return
      }

      if (!plan) {

        alert(
          'Selecione um plano para continuar.',
        )

        return
      }

      if (
        plan ===
        'personalizado' &&
        !personalizedObjective.trim()
      ) {

        alert(
          'Informe seus objetivos para o plano personalizado.',
        )

        return
      }

      if (
        plan ===
        'personalizado' &&
        !personalizedClassesPerWeek
      ) {

        alert(
          'Selecione a quantidade de aulas por semana.',
        )

        return
      }

      if (!selectedPlan) {

        alert(
          'Não foi possível localizar o plano selecionado.',
        )

        return
      }

      setStep(3)

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    }


  /* =========================================================
     VOLTAR
  ========================================================= */

  const handleBackToPlans =
    () => {

      setStep(1)

      setSelectedDate('')
      setSelectedTime('')

      setAvailableTimes([])

      setSelectedSchedules([])

      setBookingConfirmed(
        false,
      )

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    }


  /* =========================================================
     PAGAMENTO
  ========================================================= */

  const handleContinueToPayment =
    () => {

      if (!bookingConfirmed) {

        alert(
          'Confirme sua data de início e horário para continuar.',
        )

        return
      }

      alert(
        'Horário semanal confirmado. Vamos configurar o pagamento na próxima etapa.',
      )
    }


  /* =========================================================
     RENDER
  ========================================================= */

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
          <ChevronLeft size={18} />
          Voltar para o site
        </a>

      </header>


      <main className="enrollment-main">

        <div className="enrollment-container">

          <div className="enrollment-heading">

            <div className="section-label">
              <Languages size={16} />
              Matrícula
            </div>

            <h1>
              Comece sua jornada
              <br />
              na <span>AB Academy.</span>
            </h1>

            <p>
              Preencha seus dados, escolha
              seu idioma e plano e depois
              defina a data e o horário da
              sua primeira aula.
            </p>

          </div>


          {/* =====================================================
              PROGRESSO
          ===================================================== */}

          <div className="enrollment-progress">

            <div className="enrollment-progress-step active">

              <span>1</span>

              <div>
                <strong>
                  Cadastro
                </strong>

                <small>
                  Seus dados
                </small>
              </div>

            </div>


            <div className="enrollment-progress-line" />


            <div className="enrollment-progress-step active">

              <span>2</span>

              <div>
                <strong>
                  Curso e plano
                </strong>

                <small>
                  Escolha sua matrícula
                </small>
              </div>

            </div>


            <div className="enrollment-progress-line" />


            <div
              className={
                `enrollment-progress-step ${
                  step >= 3
                    ? 'active'
                    : ''
                }`
              }
            >

              <span>3</span>

              <div>
                <strong>
                  Horário
                </strong>

                <small>
                  Data e horário de início
                </small>
              </div>

            </div>


            <div className="enrollment-progress-line" />


            <div className="enrollment-progress-step">

              <span>4</span>

              <div>
                <strong>
                  Pagamento
                </strong>

                <small>
                  Finalize sua matrícula
                </small>
              </div>

            </div>

          </div>


          {/* =====================================================
              ETAPA 1
          ===================================================== */}

          {step === 1 && (

            <div className="enrollment-grid">

              <section className="enrollment-card">

                <div className="enrollment-card-header">

                  <span className="enrollment-card-number">
                    01
                  </span>

                  <div>

                    <h2>
                      Seus dados
                    </h2>

                    <p>
                      Precisamos dessas informações
                      para criar seu cadastro de aluno.
                    </p>

                  </div>

                </div>


                {!user && (

                  <button
                    type="button"
                    className="google-login-button"
                    onClick={
                      handleGoogleLogin
                    }
                    disabled={
                      loadingAuth
                    }
                  >

                    <span className="google-icon">
                      G
                    </span>

                    <span>
                      {loadingAuth
                        ? 'Verificando...'
                        : 'Continuar com Google'}
                    </span>

                  </button>

                )}


                {user && (

                  <div className="google-login-button">

                    <span className="google-icon">
                      ✓
                    </span>

                    <span>
                      Conta Google conectada
                    </span>

                  </div>

                )}


                {user && (

                  <>

                    <div className="enrollment-divider">
                      <span>
                        cadastro
                      </span>
                    </div>


                    {profileLoading ? (

                      <div className="profile-loading">
                        Carregando seus dados...
                      </div>

                    ) : (

                      <>

                        <div className="enrollment-fields">

                          <div className="enrollment-field">

                            <label htmlFor="name">
                              Nome completo *
                            </label>

                            <input
                              id="name"
                              type="text"
                              placeholder="Seu nome completo"
                              value={name}
                              onChange={
                                event =>
                                  setName(
                                    event.target.value,
                                  )
                              }
                            />

                          </div>


                          <div className="enrollment-field">

                            <label htmlFor="cpf">
                              CPF *
                            </label>

                            <input
                              id="cpf"
                              type="text"
                              inputMode="numeric"
                              placeholder="000.000.000-00"
                              value={cpf}
                              onChange={
                                event =>
                                  setCpf(
                                    formatCpf(
                                      event.target.value,
                                    ),
                                  )
                              }
                            />

                          </div>


                          <div className="enrollment-field">

                            <label htmlFor="email">
                              E-mail *
                            </label>

                            <input
                              id="email"
                              type="email"
                              placeholder="seu@email.com"
                              value={email}
                              onChange={
                                event =>
                                  setEmail(
                                    event.target.value,
                                  )
                              }
                            />

                          </div>


                          <div className="enrollment-field">

                            <label htmlFor="birth-date">
                              Data de nascimento *
                            </label>

                            <input
                              id="birth-date"
                              type="date"
                              value={
                                birthDate
                              }
                              onChange={
                                event =>
                                  setBirthDate(
                                    event.target.value,
                                  )
                              }
                            />

                          </div>


                          <div className="enrollment-field">

                            <label htmlFor="phone">
                              Telefone (WhatsApp) *
                            </label>

                            <input
                              id="phone"
                              type="tel"
                              inputMode="tel"
                              placeholder="(00) 00000-0000"
                              value={phone}
                              onChange={
                                event =>
                                  setPhone(
                                    formatPhone(
                                      event.target.value,
                                    ),
                                  )
                              }
                            />

                          </div>


                          <div className="enrollment-field">

                            <label htmlFor="responsible-name">
                              Nome do responsável
                            </label>

                            <input
                              id="responsible-name"
                              type="text"
                              placeholder="Se houver"
                              value={
                                responsibleName
                              }
                              onChange={
                                event =>
                                  setResponsibleName(
                                    event.target.value,
                                  )
                              }
                            />

                          </div>


                          <div className="enrollment-field">

                            <label htmlFor="responsible-phone">
                              Contato do responsável
                            </label>

                            <input
                              id="responsible-phone"
                              type="tel"
                              inputMode="tel"
                              placeholder="(00) 00000-0000"
                              value={
                                responsiblePhone
                              }
                              onChange={
                                event =>
                                  setResponsiblePhone(
                                    formatPhone(
                                      event.target.value,
                                    ),
                                  )
                              }
                            />

                          </div>

                        </div>


                        {profileError && (

                          <div className="profile-error">
                            {profileError}
                          </div>

                        )}


                        <button
                          type="button"
                          className="btn btn-primary enrollment-submit profile-save-button"
                          onClick={
                            handleSaveProfile
                          }
                          disabled={
                            profileSaving
                          }
                        >

                          {profileSaving
                            ? 'Salvando seus dados...'
                            : profileLoaded
                              ? 'Atualizar cadastro'
                              : 'Salvar cadastro'}

                          {!profileSaving && (
                            <CheckCircle2
                              size={18}
                            />
                          )}

                        </button>


                        {profileLoaded && (

                          <div className="profile-saved-message">

                            <CheckCircle2
                              size={17}
                            />

                            <span>
                              Cadastro salvo. Você
                              pode continuar abaixo.
                            </span>

                          </div>

                        )}

                      </>

                    )}

                  </>

                )}


                {/* =================================================
                    IDIOMA
                ================================================= */}

                {user &&
                  !profileLoading && (

                  <div className="enrollment-selection">

                    <div className="selection-heading">

                      <div>

                        <span>
                          02
                        </span>

                        <div>

                          <h2>
                            Escolha seu idioma
                          </h2>

                          <p>
                            Selecione o idioma que
                            deseja estudar.
                          </p>

                        </div>

                      </div>

                    </div>


                    <div className="language-selection">

                      <button
                        type="button"
                        className={
                          `language-selection-card ${
                            language === 'ingles'
                              ? 'selected'
                              : ''
                          }`
                        }
                        onClick={() =>
                          handleLanguageChange(
                            'ingles',
                          )
                        }
                      >

                        <img
                          src={usaFlag}
                          alt="Estados Unidos"
                        />

                        <div>

                          <strong>
                            Inglês
                          </strong>

                          <span>
                            English
                          </span>

                        </div>

                        <span
                          className={
                            `selection-radio ${
                              language === 'ingles'
                                ? 'checked'
                                : ''
                            }`
                          }
                          aria-hidden="true"
                        />

                      </button>


                      <button
                        type="button"
                        className={
                          `language-selection-card ${
                            language === 'alemao'
                              ? 'selected'
                              : ''
                          }`
                        }
                        onClick={() =>
                          handleLanguageChange(
                            'alemao',
                          )
                        }
                      >

                        <img
                          src={germanyFlag}
                          alt="Alemanha"
                        />

                        <div>

                          <strong>
                            Alemão
                          </strong>

                          <span>
                            Deutsch
                          </span>

                        </div>

                        <span
                          className={
                            `selection-radio ${
                              language === 'alemao'
                                ? 'checked'
                                : ''
                            }`
                          }
                          aria-hidden="true"
                        />

                      </button>

                    </div>

                  </div>

                )}


                {/* =================================================
                    NÍVEIS
                ================================================= */}

                {user &&
                  !profileLoading &&
                  language && (

                  <div className="enrollment-selection">

                    <div className="selection-heading">

                      <div>

                        <span>
                          03
                        </span>

                        <div>

                          <h2>
                            Seu nível de{' '}
                            {languageName?.toLowerCase() ||
                              'idioma'}
                          </h2>

                          <p>
                            Informe seu nível atual
                            em cada habilidade.
                          </p>

                        </div>

                      </div>

                    </div>


                    <div className="language-levels">

                      <div className="language-level-card">

                        <div className="language-level-card-header">

                          <div className="language-level-card-icon">
                            C
                          </div>

                          <strong>
                            Conversação *
                          </strong>

                        </div>

                        <p className="language-level-card-description">
                          Sua capacidade de se comunicar
                          e conversar no idioma.
                        </p>

                        <select
                          value={
                            conversationLevel
                          }
                          onChange={
                            event =>
                              setConversationLevel(
                                event.target
                                  .value as Level,
                              )
                          }
                        >

                          <option value="">
                            Selecione seu nível
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

                        </select>

                      </div>


                      <div className="language-level-card">

                        <div className="language-level-card-header">

                          <div className="language-level-card-icon">
                            E
                          </div>

                          <strong>
                            Escrita *
                          </strong>

                        </div>

                        <p className="language-level-card-description">
                          Sua capacidade de escrever textos
                          e se expressar por escrito.
                        </p>

                        <select
                          value={
                            writingLevel
                          }
                          onChange={
                            event =>
                              setWritingLevel(
                                event.target
                                  .value as Level,
                              )
                          }
                        >

                          <option value="">
                            Selecione seu nível
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

                        </select>

                      </div>


                      <div className="language-level-card">

                        <div className="language-level-card-header">

                          <div className="language-level-card-icon">
                            C
                          </div>

                          <strong>
                            Compreensão *
                          </strong>

                        </div>

                        <p className="language-level-card-description">
                          Sua capacidade de compreender
                          textos, áudios e conversas.
                        </p>

                        <select
                          value={
                            comprehensionLevel
                          }
                          onChange={
                            event =>
                              setComprehensionLevel(
                                event.target
                                  .value as Level,
                              )
                          }
                        >

                          <option value="">
                            Selecione seu nível
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

                        </select>

                      </div>

                    </div>

                  </div>

                )}


                {/* =================================================
                    PLANO
                ================================================= */}

                {user &&
                  !profileLoading &&
                  language && (

                  <div className="enrollment-selection">

                    <div className="selection-heading">

                      <div>

                        <span>
                          04
                        </span>

                        <div>

                          <h2>
                            Escolha seu plano
                          </h2>

                          <p>
                            Selecione o plano que
                            melhor atende aos seus
                            objetivos.
                          </p>

                        </div>

                      </div>

                    </div>


                    {plansError && (

                      <div className="plans-error">
                        {plansError}
                      </div>

                    )}


                    <div className="plan-selection">

  {/* =====================================================
      PLANO MENSAL
  ===================================================== */}

  <button
    type="button"
    className={`plan-card ${
      plan === 'mensal' ? 'selected' : ''
    }`}
    onClick={() => handlePlanChange('mensal')}
    disabled={loadingPlans || !monthlyPlan}
  >
    <div className="plan-card-top">
      <div>
        <strong>
          {monthlyPlan?.nome || 'Plano Mensal'}
        </strong>

        <span>
          {monthlyPlan?.descricao ||
            'Flexibilidade para começar'}
        </span>
      </div>

      <span
        className={`selection-radio ${
          plan === 'mensal' ? 'checked' : ''
        }`}
        aria-hidden="true"
      />
    </div>

    <div className="plan-price">
      <strong>
        {loadingPlans
          ? 'Carregando...'
          : monthlyPlan
            ? formatPrice(monthlyPlan.preco)
            : 'Plano indisponível'}
      </strong>

      {monthlyPlan && <span>/mês</span>}
    </div>

    <ul>
      <li>
        <CheckCircle2 size={16} />
        Aulas particulares
      </li>

      <li>
        <CheckCircle2 size={16} />
        Área do aluno
      </li>

      <li>
        <CheckCircle2 size={16} />
        Materiais de apoio
      </li>
    </ul>
  </button>


  {/* =====================================================
      PLANO ANUAL
  ===================================================== */}

  <button
    type="button"
    className={`plan-card ${
      plan === 'anual' ? 'selected' : ''
    }`}
    onClick={() => handlePlanChange('anual')}
    disabled={loadingPlans || !annualPlan}
  >
    <div className="plan-card-top">
      <div>
        <strong>
          {annualPlan?.nome || 'Plano Anual'}
        </strong>

        <span>
          {annualPlan?.descricao ||
            'Para quem quer evoluir continuamente'}
        </span>
      </div>

      <span
        className={`selection-radio ${
          plan === 'anual' ? 'checked' : ''
        }`}
        aria-hidden="true"
      />
    </div>

    <div className="plan-price">
      <strong>
        {loadingPlans
          ? 'Carregando...'
          : annualPlan
            ? formatPrice(annualPlan.preco)
            : 'Plano indisponível'}
      </strong>

      {annualPlan && <span>/ano</span>}
    </div>

    {annualPlan &&
      annualPlan.parcelas !== null &&
      annualPlan.valor_parcela !== null && (
        <div className="plan-installment">
          ou {annualPlan.parcelas}x de{' '}
          {formatPrice(annualPlan.valor_parcela)}
        </div>
      )}

    <ul>
      <li>
        <CheckCircle2 size={16} />
        Aulas particulares
      </li>

      <li>
        <CheckCircle2 size={16} />
        Área do aluno
      </li>

      <li>
        <CheckCircle2 size={16} />
        Materiais de apoio
      </li>
    </ul>
  </button>


  {/* =====================================================
      PLANO PERSONALIZADO
  ===================================================== */}

  <button
    type="button"
    className={`plan-card ${
      plan === 'personalizado' ? 'selected' : ''
    }`}
    onClick={() => handlePlanChange('personalizado')}
    disabled={!language}
  >
    <div className="plan-card-top">
      <div>
        <strong>
          Plano Personalizado
        </strong>

        <span>
          Monte seu plano de acordo com seus
          objetivos e sua rotina.
        </span>
      </div>

      <span
        className={`selection-radio ${
          plan === 'personalizado' ? 'checked' : ''
        }`}
        aria-hidden="true"
      />
    </div>

    <div className="plan-price">
      <strong>
        {language === 'ingles'
          ? 'A partir de R$ 100'
          : language === 'alemao'
            ? 'A partir de R$ 120'
            : 'Selecione o idioma'}
      </strong>

      {language && (
        <span>
          /aula
        </span>
      )}
    </div>

    <ul>
      <li>
        <CheckCircle2 size={16} />
        Objetivos personalizados
      </li>

      <li>
        <CheckCircle2 size={16} />
        De 1 a 3 aulas por semana
      </li>

      <li>
        <CheckCircle2 size={16} />
        Valor conforme a frequência
      </li>
    </ul>
  </button>

</div>


                    {/* CONFIGURAÇÃO PERSONALIZADO */}

                    {plan ===
                      'personalizado' && (

                      <div className="personalized-plan-config">

                        <div className="selection-heading">

                          <div>

                            <span>
                              <Languages size={16} />
                            </span>

                            <div>

                              <h2>
                                Personalize seu plano
                              </h2>

                              <p>
                                Conte-nos o que você
                                deseja alcançar e escolha
                                sua frequência semanal.
                              </p>

                            </div>

                          </div>

                        </div>


                        <div className="enrollment-field">

                          <label htmlFor="personalized-objective">
                            Quais são seus objetivos? *
                          </label>

                          <textarea
                            id="personalized-objective"
                            placeholder={
                              language === 'ingles'
                                ? 'Ex.: Quero melhorar minha conversação para trabalhar em uma empresa internacional...'
                                : 'Ex.: Quero aprender alemão para trabalhar na Alemanha e desenvolver minha conversação...'
                            }
                            value={
                              personalizedObjective
                            }
                            onChange={
                              event =>
                                setPersonalizedObjective(
                                  event.target.value,
                                )
                            }
                            rows={5}
                          />

                        </div>


                        <div className="personalized-frequency">

                          <div className="personalized-frequency-heading">

                            <strong>
                              Quantas aulas por semana?
                            </strong>

                            <span>
                              {languageName}
                            </span>

                          </div>


                          <div className="personalized-frequency-options">

                            {[1, 2, 3].map(
                              quantity => {

                                const classesPerWeek =
                                  quantity as PersonalizedClassesPerWeek

                                const hourlyPrice =
                                  language ===
                                  'ingles'
                                    ? (
                                        {
                                          1: 100,
                                          2: 90,
                                          3: 80,
                                        } as const
                                      )[
                                        classesPerWeek
                                      ]
                                    : (
                                        {
                                          1: 120,
                                          2: 110,
                                          3: 100,
                                        } as const
                                      )[
                                        classesPerWeek
                                      ]

                                const monthlyPrice =
                                  hourlyPrice *
                                  classesPerWeek *
                                  4

                                const annualPrice =
                                  monthlyPrice *
                                  12 *
                                  0.95

                                return (

                                  <button
                                    key={
                                      classesPerWeek
                                    }
                                    type="button"
                                    className={
                                      `personalized-frequency-card ${
                                        personalizedClassesPerWeek ===
                                        classesPerWeek
                                          ? 'selected'
                                          : ''
                                      }`
                                    }
                                    onClick={() => {

                                      setPersonalizedClassesPerWeek(
                                        classesPerWeek,
                                      )

                                      setSelectedSchedules(
                                        current =>
                                          current.slice(
                                            0,
                                            classesPerWeek,
                                          ),
                                      )

                                      setBookingConfirmed(
                                        false,
                                      )

                                    }}
                                  >

                                    <span
                                      className={
                                        `selection-radio ${
                                          personalizedClassesPerWeek ===
                                          classesPerWeek
                                            ? 'checked'
                                            : ''
                                        }`
                                      }
                                      aria-hidden="true"
                                    />

                                    <div>

                                      <strong>
                                        {classesPerWeek}{' '}
                                        {classesPerWeek ===
                                        1
                                          ? 'aula'
                                          : 'aulas'}{' '}
                                        por semana
                                      </strong>

                                      <span>
                                        {formatPrice(
                                          hourlyPrice,
                                        )}{' '}
                                        por aula
                                      </span>

                                      <small>
                                        {formatPrice(
                                          monthlyPrice,
                                        )}
                                        /mês
                                      </small>

                                      <small>
                                        {formatPrice(
                                          annualPrice,
                                        )}
                                        /ano com 5% de desconto
                                      </small>

                                    </div>

                                  </button>

                                )
                              },
                            )}

                          </div>

                        </div>


                        <div className="personalized-billing">

                          <strong>
                            Como deseja contratar?
                          </strong>


                          <div className="personalized-billing-options">

                            <button
                              type="button"
                              className={
                                `personalized-billing-card ${
                                  personalizedBillingPeriod ===
                                  'mensal'
                                    ? 'selected'
                                    : ''
                                }`
                              }
                              onClick={() =>
                                setPersonalizedBillingPeriod(
                                  'mensal',
                                )
                              }
                            >

                              <span
                                className={
                                  `selection-radio ${
                                    personalizedBillingPeriod ===
                                    'mensal'
                                      ? 'checked'
                                      : ''
                                  }`
                                }
                                aria-hidden="true"
                              />

                              <div>

                                <strong>
                                  Mensal
                                </strong>

                                <span>
                                  {formatPrice(
                                    personalizedMonthlyPrice,
                                  )}
                                  /mês
                                </span>

                              </div>

                            </button>


                            <button
                              type="button"
                              className={
                                `personalized-billing-card ${
                                  personalizedBillingPeriod ===
                                  'anual'
                                    ? 'selected'
                                    : ''
                                }`
                              }
                              onClick={() =>
                                setPersonalizedBillingPeriod(
                                  'anual',
                                )
                              }
                            >

                              <span
                                className={
                                  `selection-radio ${
                                    personalizedBillingPeriod ===
                                    'anual'
                                      ? 'checked'
                                      : ''
                                  }`
                                }
                                aria-hidden="true"
                              />

                              <div>

                                <strong>
                                  Anual
                                </strong>

                                <span>
                                  {formatPrice(
                                    personalizedAnnualPrice,
                                  )}
                                  /ano
                                </span>

                                <small>
                                  5% de desconto
                                </small>

                              </div>

                            </button>

                          </div>

                        </div>


                        <div className="personalized-price-summary">

                          <div>

                            <span>
                              Valor por aula
                            </span>

                            <strong>
                              {formatPrice(
                                personalizedHourlyPrice,
                              )}
                            </strong>

                          </div>


                          <div>

                            <span>
                              Aulas por semana
                            </span>

                            <strong>
                              {personalizedClassesPerWeek}
                            </strong>

                          </div>


                          <div>

                            <span>
                              Valor mensal
                            </span>

                            <strong>
                              {formatPrice(
                                personalizedMonthlyPrice,
                              )}
                            </strong>

                          </div>


                          <div>

                            <span>
                              Valor anual
                            </span>

                            <strong>
                              {formatPrice(
                                personalizedAnnualPrice,
                              )}
                            </strong>

                          </div>


                          <div>

                            <span>
                              Desconto anual
                            </span>

                            <strong>
                              5%
                            </strong>

                          </div>

                        </div>

                      </div>

                    )}

                  </div>

                )}


                {user &&
                  !profileLoading && (

                  <button
                    type="button"
                    className="btn btn-primary enrollment-submit"
                    onClick={
                      handleContinue
                    }
                    disabled={
                      profileSaving ||
                      !language ||
                      !conversationLevel ||
                      !writingLevel ||
                      !comprehensionLevel ||
                      !plan ||
                      !selectedPlan ||
                      (
                        plan ===
                        'personalizado' &&
                        !personalizedObjective.trim()
                      )
                    }
                  >

                    Escolher horário

                    <ArrowRight size={18} />

                  </button>

                )}


                <div className="enrollment-security">

                  <ShieldCheck size={18} />

                  <span>
                    Seus dados são protegidos
                    e utilizados apenas para o
                    processo de matrícula.
                  </span>

                </div>

              </section>


              {/* RESUMO */}

              <aside className="enrollment-summary">

                <div className="summary-header">

                  <span>
                    RESUMO
                  </span>

                  <h2>
                    Sua matrícula
                  </h2>

                </div>


                <div className="summary-course">

                  <div className="summary-course-icon">
                    <Languages size={24} />
                  </div>

                  <div>

                    <span>
                      Idioma
                    </span>

                    <strong>
                      {languageName ||
                        'Selecione um idioma'}
                    </strong>

                  </div>

                </div>


                <div className="summary-item">

                  <span>
                    Plano
                  </span>

                  <strong>
                    {selectedPlan?.nome ||
                      'Selecione um plano'}
                  </strong>

                </div>


                {language && (

                  <div className="summary-item">

                    <span>
                      Nível
                    </span>

                    <strong>

                      {conversationLevel
                        ? conversationLevel ===
                          'basico'
                          ? 'Conversação: Básico'
                          : conversationLevel ===
                            'intermediario'
                            ? 'Conversação: Intermediário'
                            : 'Conversação: Avançado'
                        : 'Informe seus níveis'}

                    </strong>

                  </div>

                )}


                {plan ===
                  'personalizado' && (

                  <>

                    <div className="summary-item">

                      <span>
                        Aulas por semana
                      </span>

                      <strong>
                        {personalizedClassesPerWeek}{' '}
                        {personalizedClassesPerWeek ===
                        1
                          ? 'aula'
                          : 'aulas'}
                      </strong>

                    </div>


                    <div className="summary-item">

                      <span>
                        Contratação
                      </span>

                      <strong>
                        {personalizedBillingPeriod ===
                        'anual'
                          ? 'Plano anual'
                          : 'Plano mensal'}
                      </strong>

                    </div>


                    <div className="summary-item">

                      <span>
                        Objetivo
                      </span>

                      <strong>
                        {personalizedObjective ||
                          'Informe seus objetivos'}
                      </strong>

                    </div>

                  </>

                )}


                <div className="summary-divider" />


                <div className="summary-total">

                  <span>
                    Total
                  </span>

                  <strong>
                    {plan ===
                    'personalizado'
                      ? formatPrice(
                          personalizedCurrentPrice,
                        )
                      : selectedPlan
                        ? formatPrice(
                            selectedPlan.preco,
                          )
                        : 'R$ 0,00'}
                  </strong>

                </div>


                {plan ===
                  'personalizado' ? (

                  <div className="summary-period">
                    {personalizedCurrentPeriod}
                  </div>

                ) : selectedPlan && (

                  <div className="summary-period">

                    {selectedPlan.tipo ===
                    'mensal'
                      ? '/mês'
                      : '/ano'}

                  </div>

                )}


                {plan ===
                  'personalizado' &&
                  personalizedBillingPeriod ===
                    'anual' && (

                  <div className="summary-installment">

                    Economia de{' '}
                    {formatPrice(
                      personalizedAnnualDiscount,
                    )}{' '}
                    com 5% de desconto

                  </div>

                )}


                {selectedPlan &&
                  plan !== 'personalizado' &&
                  selectedPlan.parcelas !== null &&
                  selectedPlan.valor_parcela !== null && (

                  <div className="summary-installment">

                    ou{' '}
                    {selectedPlan.parcelas}
                    x de{' '}
                    {formatPrice(
                      selectedPlan.valor_parcela,
                    )}

                  </div>

                )}


                <div className="summary-note">

                  <CheckCircle2 size={17} />

                  <span>
                    O acesso à área do aluno será
                    liberado após a confirmação do
                    pagamento.
                  </span>

                </div>

              </aside>

            </div>

          )}


          {/* =====================================================
              ETAPA 3
          ===================================================== */}

          {step === 3 && (

            <div className="enrollment-grid">

              <section className="enrollment-card">

                <div className="enrollment-card-header">

                  <span className="enrollment-card-number">
                    05
                  </span>

                  <div>

                    <h2>
                      Escolha seus horários
                    </h2>

                    <p>
                      {plan === 'personalizado'
                        ? `Escolha ${personalizedClassesPerWeek} ${
                            personalizedClassesPerWeek === 1
                              ? 'horário'
                              : 'horários'
                          } semanais para suas aulas.`
                        : 'Defina o dia e horário da sua primeira aula.'}
                    </p>

                  </div>

                </div>


                {!bookingConfirmed ? (

                  <div className="schedule-section">

                    <div className="selection-heading">

                      <div>

                        <span>
                          <CalendarDays size={16} />
                        </span>

                        <div>

                          <h2>
                            {plan === 'personalizado'
                              ? 'Selecione os horários'
                              : 'Escolha sua data de início'}
                          </h2>

                          <p>
                            Selecione uma data para
                            consultar os horários disponíveis.
                          </p>

                        </div>

                      </div>

                    </div>


                    <div className="schedule-calendar">

                      {availableDates.map(
                        date => (

                          <button
                            key={
                              date.value
                            }
                            type="button"
                            className={
                              `schedule-date ${
                                selectedDate ===
                                date.value
                                  ? 'selected'
                                  : ''
                              }`
                            }
                            onClick={() =>
                              handleDateChange(
                                date.value,
                              )
                            }
                          >

                            <small>
                              {date.weekday}
                            </small>

                            <strong>
                              {date.day}
                            </strong>

                          </button>

                        ),
                      )}

                    </div>


                    <div className="future-date-selection">

                      <label htmlFor="custom-start-date">
                        Ou escolha outra data
                      </label>

                      <p>
                        Você pode escolher qualquer
                        data futura.
                      </p>

                      <input
                        id="custom-start-date"
                        type="date"
                        min={
                          minimumStartDate
                        }
                        value={
                          selectedDate
                        }
                        onChange={
                          handleManualDateChange
                        }
                      />

                    </div>


                    {selectedDate && (

                      <div className="schedule-selected-summary">

                        <CalendarDays size={19} />

                        <div>

                          <strong>
                            Data selecionada
                          </strong>

                          <p>
                            {
                              formatSelectedDate(
                                selectedDate,
                              )
                            }
                          </p>

                        </div>

                      </div>

                    )}


                    {selectedDate && (

                      <div className="schedule-section">

                        <div className="selection-heading">

                          <div>

                            <span>
                              <Clock3 size={16} />
                            </span>

                            <div>

                              <h2>
                                Horários disponíveis
                              </h2>

                              <p>
                                Clique nos horários
                                para adicioná-los à sua
                                grade semanal.
                              </p>

                            </div>

                          </div>

                        </div>


                        {loadingTimes ? (

                          <div className="profile-loading">
                            Carregando horários disponíveis...
                          </div>

                        ) : scheduleError &&
                          availableTimes.length === 0 ? (

                          <div className="profile-error">
                            {scheduleError}
                          </div>

                        ) : (

                          <div className="schedule-times">

                            {availableTimes.map(
                              slot => {

                                const isSelected =
                                  selectedSchedules.some(
                                    item =>
                                      item.date ===
                                        selectedDate &&
                                      item.time ===
                                        slot.time,
                                  )

                                return (

                                  <button
                                    key={
                                      slot.id
                                    }
                                    type="button"
                                    className={
                                      `schedule-time ${
                                        isSelected
                                          ? 'selected'
                                          : ''
                                      }`
                                    }
                                    disabled={
                                      !slot.available
                                    }
                                    onClick={() =>
                                      handleTimeChange(
                                        slot.time,
                                      )
                                    }
                                  >

                                    {slot.time}

                                  </button>

                                )
                              },
                            )}

                          </div>

                        )}

                      </div>

                    )}


                    {/* =================================================
                        HORÁRIOS SELECIONADOS
                    ================================================= */}

                    {selectedSchedules.length > 0 && (

                      <div className="schedule-selected-summary">

                        <Clock3 size={19} />

                        <div>

                          <strong>
                            {plan === 'personalizado'
                              ? `Horários selecionados (${selectedSchedules.length}/${personalizedClassesPerWeek})`
                              : 'Horário selecionado'}
                          </strong>

                          <div>

                            {selectedSchedules
                              .slice()
                              .sort(
                                (
                                  a,
                                  b,
                                ) =>
                                  a.weekday -
                                  b.weekday ||
                                  a.time.localeCompare(
                                    b.time,
                                  ),
                              )
                              .map(
                                schedule => (

                                  <div
                                    key={
                                      `${schedule.date}-${schedule.time}`
                                    }
                                    style={{
                                      display:
                                        'flex',

                                      alignItems:
                                        'center',

                                      justifyContent:
                                        'space-between',

                                      gap:
                                        '12px',

                                      marginTop:
                                        '8px',
                                    }}
                                  >

                                    <span>
                                      {schedule.weekdayName},{' '}
                                      às{' '}
                                      {schedule.time}
                                      <br />
                                      <small>
                                        Início:{' '}
                                        {formatSelectedDate(
                                          schedule.date,
                                        )}
                                      </small>
                                    </span>

                                    <button
                                      type="button"
                                      className="btn"
                                      onClick={() =>
                                        removeSelectedSchedule(
                                          schedule,
                                        )
                                      }
                                    >
                                      Remover
                                    </button>

                                  </div>

                                ),
                              )}

                          </div>

                        </div>

                      </div>

                    )}


                    {plan ===
                      'personalizado' && (

                      <div className="schedule-selected-summary">

                        <Languages size={19} />

                        <div>

                          <strong>
                            Plano personalizado
                          </strong>

                          <p>
                            {personalizedClassesPerWeek}{' '}
                            {personalizedClassesPerWeek ===
                            1
                              ? 'aula semanal'
                              : 'aulas semanais'}.
                            <br />
                            Selecione todos os horários
                            antes de confirmar.
                          </p>

                        </div>

                      </div>

                    )}


                    <button
                      type="button"
                      className="btn btn-primary enrollment-submit"
                      onClick={
                        handleConfirmBooking
                      }
                      disabled={
                        bookingLoading ||
                        selectedSchedules.length !==
                          (
                            plan ===
                            'personalizado'
                              ? personalizedClassesPerWeek
                              : 1
                          )
                      }
                    >

                      {bookingLoading
                        ? 'Reservando...'
                        : 'Confirmar horários'}

                      {!bookingLoading && (
                        <CheckCircle2 size={18} />
                      )}

                    </button>

                  </div>

                ) : (

                  <div className="schedule-confirmation">

                    <div className="schedule-confirmation-header">

                      <CheckCircle2 size={28} />

                      <strong>
                        Horários semanais reservados
                      </strong>

                    </div>


                    <p>
                      Seja bem-vindo(a) à
                      AB Academy!
                    </p>


                    {selectedSchedules
                      .slice()
                      .sort(
                        (
                          a,
                          b,
                        ) =>
                          a.weekday -
                          b.weekday ||
                          a.time.localeCompare(
                            b.time,
                          ),
                      )
                      .map(
                        schedule => (

                          <div
                            key={
                              `${schedule.date}-${schedule.time}`
                            }
                            className="schedule-confirmation-date"
                          >

                            <CalendarDays size={19} />

                            <strong>
                              {schedule.weekdayName}
                              {' — '}
                              {schedule.time}
                              <br />
                              <small>
                                Primeira aula:{' '}
                                {formatSelectedDate(
                                  schedule.date,
                                )}
                              </small>
                            </strong>

                          </div>

                        ),
                      )}


                    <p>
                      Esses horários ficarão
                      reservados semanalmente para
                      sua matrícula.
                    </p>


                    <p>
                      Para concluir sua matrícula,
                      clique em{' '}
                      <strong>
                        "Continuar para pagamento"
                      </strong>
                      .
                    </p>

                  </div>

                )}


                <div className="schedule-navigation">

                  <button
                    type="button"
                    className="btn"
                    onClick={
                      handleBackToPlans
                    }
                  >

                    <ChevronLeft size={18} />

                    Voltar

                  </button>


                  <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleContinueToPayment}
                  disabled={bookingLoading || !bookingConfirmed}
                >

                    Continuar para pagamento

                    <ArrowRight size={18} />

                  </button>

                </div>

              </section>


              {/* =================================================
                  RESUMO ETAPA 3
              ================================================= */}

              <aside className="enrollment-summary">

                <div className="summary-header">

                  <span>
                    RESUMO
                  </span>

                  <h2>
                    Sua matrícula
                  </h2>

                </div>


                <div className="summary-course">

                  <div className="summary-course-icon">
                    <Languages size={24} />
                  </div>

                  <div>

                    <span>
                      Idioma
                    </span>

                    <strong>
                      {languageName ||
                        'Selecione um idioma'}
                    </strong>

                  </div>

                </div>


                <div className="summary-item">

                  <span>
                    Plano
                  </span>

                  <strong>
                    {selectedPlan?.nome ||
                      'Selecione um plano'}
                  </strong>

                </div>


                {plan ===
                  'personalizado' && (

                  <>

                    <div className="summary-item">

                      <span>
                        Frequência
                      </span>

                      <strong>
                        {personalizedClassesPerWeek}{' '}
                        {personalizedClassesPerWeek ===
                        1
                          ? 'aula por semana'
                          : 'aulas por semana'}
                      </strong>

                    </div>


                    <div className="summary-item">

                      <span>
                        Contratação
                      </span>

                      <strong>
                        {personalizedBillingPeriod ===
                        'anual'
                          ? 'Plano anual'
                          : 'Plano mensal'}
                      </strong>

                    </div>

                  </>

                )}


                {selectedSchedules.length > 0 && (

                  <div className="summary-item">

                    <span>
                      Horários
                    </span>

                    <strong>

                      {selectedSchedules
                        .slice()
                        .sort(
                          (
                            a,
                            b,
                          ) =>
                            a.weekday -
                            b.weekday ||
                            a.time.localeCompare(
                              b.time,
                            ),
                        )
                        .map(
                          schedule =>
                            `${schedule.weekdayName}, ${schedule.time}`,
                        )
                        .join(
                          ' • ',
                        )}

                    </strong>

                  </div>

                )}


                <div className="summary-divider" />


                <div className="summary-total">

                  <span>
                    Total
                  </span>

                  <strong>
                    {plan ===
                    'personalizado'
                      ? formatPrice(
                          personalizedCurrentPrice,
                        )
                      : selectedPlan
                        ? formatPrice(
                            selectedPlan.preco,
                          )
                        : 'R$ 0,00'}
                  </strong>

                </div>


                {plan ===
                  'personalizado' ? (

                  <div className="summary-period">
                    {personalizedCurrentPeriod}
                  </div>

                ) : selectedPlan && (

                  <div className="summary-period">

                    {selectedPlan.tipo ===
                    'mensal'
                      ? '/mês'
                      : '/ano'}

                  </div>

                )}


                {plan ===
                  'personalizado' &&
                  personalizedBillingPeriod ===
                    'anual' && (

                  <div className="summary-installment">

                    Economia de{' '}
                    {formatPrice(
                      personalizedAnnualDiscount,
                    )}{' '}
                    com 5% de desconto

                  </div>

                )}


                {selectedPlan &&
                  plan !== 'personalizado' &&
                  selectedPlan.parcelas !== null &&
                  selectedPlan.valor_parcela !== null && (

                  <div className="summary-installment">

                    ou{' '}
                    {selectedPlan.parcelas}
                    x de{' '}
                    {formatPrice(
                      selectedPlan.valor_parcela,
                    )}

                  </div>

                )}


                <div className="summary-note">

                  <CheckCircle2 size={17} />

                  <span>
                    O acesso à área do aluno
                    será liberado após a
                    confirmação do pagamento.
                  </span>

                </div>

              </aside>

            </div>

          )}

        </div>

      </main>

    </div>
  )
}


export default Matricula