import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  Home,
  Image as ImageIcon,
  Loader2,
  LogOut,
  Menu,
  Play,
  UserCircle,
  Video,
  X,
} from 'lucide-react'

import logo from '../assets/logo_abacademy.png'
import { supabase } from '../lib/supabase'
import '../styles/aluno.css'

type StudentSection =
  | 'inicio'
  | 'aulas'
  | 'materiais'
  | 'atividades'
  | 'progresso'
  | 'perfil'

type AuthStep =
  | 'email'
  | 'password'
  | 'create-password'

type LessonStatus =
  | 'agendada'
  | 'realizada'
  | 'cancelada'

type Lesson = {
  id: string
  language: string
  date: string
  time: string
  teacher: string
  status: LessonStatus
  meetUrl?: string
  meetSpaceName?: string
  startAt: string
  endAt: string
}

type Material = {
  id: string
  title: string
  type: string
  date: string
}

type ActivityStatus =
  | 'rascunho'
  | 'enviada'
  | 'em_andamento'
  | 'respondida'
  | 'em_correcao'
  | 'corrigida'

type Activity = {
  id: string
  aluno_id: string
  title: string
  description: string | null
  language: 'ingles' | 'alemao'
  dueDate: string | null
  status: ActivityStatus
  nota: number | null
  createdAt: string
}

type ExerciseType =
  | 'multipla_escolha'
  | 'multipla_resposta'
  | 'verdadeiro_falso'
  | 'dissertativa'
  | 'resposta_curta'
  | 'lacunas'
  | 'ordenar'
  | 'associar'

type ExerciseAlternative = {
  id: string
  texto: string
  correta: boolean
  ordem: number
}

type ExerciseContent = {
  id: string
  tipo: 'texto' | 'youtube' | 'imagem'
  conteudo: string
  ordem: number
}

type Exercise = {
  id: string
  atividade_id: string
  titulo: string | null
  enunciado: string
  tipo: ExerciseType
  ordem: number
  pontuacao: number
  alternativas: ExerciseAlternative[]
  conteudos: ExerciseContent[]
}

type StudentAnswer = {
  exerciseId: string
  respostaTexto: string
  alternativaIds: string[]
}

const activityStatusLabels: Record<
  ActivityStatus,
  string
> = {
  rascunho: 'Rascunho',
  enviada: 'Disponível',
  em_andamento: 'Em andamento',
  respondida: 'Respondida',
  em_correcao: 'Em correção',
  corrigida: 'Corrigida',
}

const exerciseTypeLabels: Record<
  ExerciseType,
  string
> = {
  multipla_escolha: 'Múltipla escolha',
  multipla_resposta: 'Múltiplas respostas',
  verdadeiro_falso: 'Verdadeiro ou falso',
  dissertativa: 'Dissertativa',
  resposta_curta: 'Resposta curta',
  lacunas: 'Completar lacunas',
  ordenar: 'Ordenar',
  associar: 'Associar',
}

const languageLabels = {
  ingles: 'Inglês',
  alemao: 'Alemão',
}

const openVirtualClassroom = (lessonId: string) => {
  const classroomUrl = `${window.location.origin}/aluno/aula/${lessonId}`

  window.open(
    classroomUrl,
    '_blank',
    'noopener,noreferrer,width=1440,height=900',
  )
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Sem prazo'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('pt-BR')
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Sem prazo'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function isObjectiveType(type: ExerciseType) {
  return (
    type === 'multipla_escolha' ||
    type === 'multipla_resposta' ||
    type === 'verdadeiro_falso'
  )
}

function isSingleChoiceType(type: ExerciseType) {
  return (
    type === 'multipla_escolha' ||
    type === 'verdadeiro_falso'
  )
}

function getYoutubeEmbedUrl(value: string) {
  try {
    const url = new URL(value)

    if (url.hostname.includes('youtube.com')) {
      const videoId =
        url.searchParams.get('v')

      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`
      }

      if (url.pathname.startsWith('/shorts/')) {
        const id = url.pathname
          .split('/shorts/')[1]
          ?.split('/')[0]

        if (id) {
          return `https://www.youtube.com/embed/${id}`
        }
      }

      if (url.pathname.startsWith('/embed/')) {
        return value
      }
    }

    if (url.hostname === 'youtu.be') {
      const id = url.pathname
        .replace('/', '')
        .split('/')[0]

      if (id) {
        return `https://www.youtube.com/embed/${id}`
      }
    }
  } catch {
    return ''
  }

  return ''
}

function createEmptyAnswer(
  exerciseId: string,
): StudentAnswer {
  return {
    exerciseId,
    respostaTexto: '',
    alternativaIds: [],
  }
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!parts.length) {
    return 'AL'
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase()
  }

  return `${parts[0][0]}${
    parts[parts.length - 1][0]
  }`.toUpperCase()
}

function getStatusClass(
  status: ActivityStatus,
) {
  return `student-activity-status ${status}`
}

function validatePassword(password: string) {
  if (password.length < 8) {
    return 'A senha deve possuir pelo menos 8 caracteres.'
  }

  if (!/[A-Z]/.test(password)) {
    return 'A senha deve possuir pelo menos uma letra maiúscula.'
  }

  if (!/[a-z]/.test(password)) {
    return 'A senha deve possuir pelo menos uma letra minúscula.'
  }

  if (!/[0-9]/.test(password)) {
    return 'A senha deve possuir pelo menos um número.'
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'A senha deve possuir pelo menos um caractere especial.'
  }

  return ''
}

function Aluno() {
  const [user, setUser] =
    useState<User | null>(null)

  const [loading, setLoading] =
    useState(true)

  /*
   * =========================================================
   * AUTENTICAÇÃO DO ALUNO
   * =========================================================
   *
   * Fluxo:
   *
   * 1. E-mail
   * 2. student-auth verifica o cadastro
   * 3. Primeiro acesso:
   *      cria senha
   * 4. Acessos seguintes:
   *      informa senha
   * 5. Supabase Auth cria a sessão
   * 6. Portal é liberado
   */

  const [authStep, setAuthStep] =
    useState<AuthStep>('email')

  const [authEmail, setAuthEmail] =
    useState('')

  const [authPassword, setAuthPassword] =
    useState('')

  const [
    authPasswordConfirmation,
    setAuthPasswordConfirmation,
  ] = useState('')

  const [
    authStudentName,
    setAuthStudentName,
  ] = useState('')

  const [authLoading, setAuthLoading] =
    useState(false)

  const [authError, setAuthError] =
    useState('')

  const [authInfo, setAuthInfo] =
    useState('')

  const [section, setSection] =
    useState<StudentSection>('inicio')

  const [
    mobileMenuOpen,
    setMobileMenuOpen,
  ] = useState(false)

  const [lessons, setLessons] =
    useState<Lesson[]>([])

  const [
    lessonsLoading,
    setLessonsLoading,
  ] = useState(false)

  const [currentTime, setCurrentTime] =
    useState(() => Date.now())

  const [materials] = useState<
    Material[]
  >([
    {
      id: '1',
      title: 'Material da aula',
      type: 'PDF',
      date: '18/09/2026',
    },
  ])

  const [activities, setActivities] =
    useState<Activity[]>([])

  const [
    activitiesLoading,
    setActivitiesLoading,
  ] = useState(false)

  const [
    activitiesError,
    setActivitiesError,
  ] = useState('')

  const [
    selectedActivity,
    setSelectedActivity,
  ] = useState<Activity | null>(null)

  const [
    selectedExercises,
    setSelectedExercises,
  ] = useState<Exercise[]>([])

  const [
    activityLoading,
    setActivityLoading,
  ] = useState(false)

  const [
    activityError,
    setActivityError,
  ] = useState('')

  const [answers, setAnswers] =
    useState<StudentAnswer[]>([])

  const [
    submittingActivity,
    setSubmittingActivity,
  ] = useState(false)

  const passwordRules = {
  minLength: authPassword.length >= 8,
  uppercase: /[A-Z]/.test(authPassword),
  lowercase: /[a-z]/.test(authPassword),
  number: /[0-9]/.test(authPassword),
  special: /[^A-Za-z0-9]/.test(authPassword),
}

  /*
   * =========================================================
   * VERIFICAR E-MAIL
   * =========================================================
   */

  async function handleCheckEmail() {
    const email =
      authEmail.trim().toLowerCase()

    if (!email) {
      setAuthError(
        'Informe seu e-mail.',
      )
      return
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email,
      )
    ) {
      setAuthError(
        'Informe um e-mail válido.',
      )
      return
    }

    try {
      setAuthLoading(true)
      setAuthError('')
      setAuthInfo('')

      const { data, error } =
        await supabase.functions.invoke(
          'student-auth',
          {
            body: {
              action: 'check-email',
              email,
            },
          },
        )

      if (error) {
        throw error
      }

      if (!data?.success) {
        throw new Error(
          data?.error ||
            data?.message ||
            'Não foi possível verificar seu cadastro.',
        )
      }

      if (!data.exists) {
        setAuthError(
          'Este e-mail não está cadastrado como aluno.',
        )
        return
      }

      setAuthEmail(email)

      setAuthStudentName(
        data.nome_completo ||
          '',
      )

      if (data.first_access) {
        setAuthPassword('')
        setAuthPasswordConfirmation('')
        setAuthStep(
          'create-password',
        )

        setAuthInfo(
          'Este é seu primeiro acesso. Crie uma senha para entrar no portal.',
        )
      } else {
        setAuthPassword('')
        setAuthStep('password')

        setAuthInfo(
          'Digite sua senha para acessar o portal.',
        )
      }
    } catch (error) {
      console.error(
        'Erro ao verificar e-mail do aluno:',
        error,
      )

      setAuthError(
        error instanceof Error
          ? error.message
          : 'Não foi possível verificar seu e-mail.',
      )
    } finally {
      setAuthLoading(false)
    }
  }

  /*
   * =========================================================
   * CRIAR SENHA
   * =========================================================
   */

  async function handleCreatePassword() {
    const password = authPassword
    const confirmation =
      authPasswordConfirmation

    if (!password) {
      setAuthError(
        'Digite uma senha.',
      )
      return
    }

    const passwordError =
      validatePassword(password)

    if (passwordError) {
      setAuthError(passwordError)
      return
    }

    if (password !== confirmation) {
      setAuthError(
        'As senhas não coincidem.',
      )
      return
    }

    try {
      setAuthLoading(true)
      setAuthError('')
      setAuthInfo('')

      const { data, error } =
        await supabase.functions.invoke(
          'student-auth',
          {
            body: {
              action: 'create-password',
              email:
                authEmail
                  .trim()
                  .toLowerCase(),
              password,
            },
          },
        )

      if (error) {
        throw error
      }

      if (!data?.success) {
        throw new Error(
          data?.error ||
            data?.message ||
            'Não foi possível criar sua senha.',
        )
      }

      /*
       * O Edge Function já criou:
       *
       * auth.users
       * +
       * alunos.user_id
       *
       * Agora fazemos o login normal para receber
       * a sessão oficial do Supabase.
       */

      const {
        error: loginError,
      } =
        await supabase.auth.signInWithPassword(
          {
            email:
              authEmail
                .trim()
                .toLowerCase(),
            password,
          },
        )

      if (loginError) {
        throw loginError
      }

      setAuthPassword('')
      setAuthPasswordConfirmation('')
      setAuthInfo('')
      setAuthError('')
    } catch (error) {
      console.error(
        'Erro ao criar senha do aluno:',
        error,
      )

      setAuthError(
        error instanceof Error
          ? error.message
          : 'Não foi possível criar sua senha.',
      )
    } finally {
      setAuthLoading(false)
    }
  }

  /*
   * =========================================================
   * LOGIN DO ALUNO
   * =========================================================
   */

  async function handleStudentLogin() {
    const email =
      authEmail.trim().toLowerCase()

    if (!email) {
      setAuthError(
        'Informe seu e-mail.',
      )
      return
    }

    if (!authPassword) {
      setAuthError(
        'Informe sua senha.',
      )
      return
    }

    try {
      setAuthLoading(true)
      setAuthError('')
      setAuthInfo('')

      const { error } =
        await supabase.auth.signInWithPassword(
          {
            email,
            password: authPassword,
          },
        )

      if (error) {
        throw error
      }

      setAuthPassword('')
    } catch (error) {
      console.error(
        'Erro no login do aluno:',
        error,
      )

      setAuthError(
        'E-mail ou senha inválidos.',
      )
    } finally {
      setAuthLoading(false)
    }
  }

  function resetAuthToEmail() {
    setAuthStep('email')
    setAuthPassword('')
    setAuthPasswordConfirmation('')
    setAuthError('')
    setAuthInfo('')
    setAuthStudentName('')
  }

  useEffect(() => {
    const interval =
      window.setInterval(() => {
        setCurrentTime(
          Date.now(),
        )
      }, 30_000)

    return () => {
      window.clearInterval(
        interval,
      )
    }
  }, [])

  function getNextLessonOccurrence(
  dayOfWeek: number,
  startTime: string,
  endTime: string,
) {
  const now = new Date()

  const [startHours, startMinutes] = startTime.slice(0, 5).split(':').map(Number)
  const [endHours, endMinutes] = endTime.slice(0, 5).split(':').map(Number)

  if (
    [startHours, startMinutes, endHours, endMinutes].some((value) =>
      Number.isNaN(value),
    )
  ) {
    throw new Error('Horário de aula inválido.')
  }

  const currentDay = now.getDay()
  let daysUntil = dayOfWeek - currentDay
  if (daysUntil < 0) daysUntil += 7

  // só pula pra semana que vem se o TÉRMINO de hoje já passou
  if (
    daysUntil === 0 &&
    (now.getHours() > endHours ||
      (now.getHours() === endHours && now.getMinutes() >= endMinutes))
  ) {
    daysUntil = 7
  }

  const startAt = new Date(now)
  startAt.setDate(now.getDate() + daysUntil)
  startAt.setHours(startHours, startMinutes, 0, 0)

  const endAt = new Date(startAt)
  endAt.setHours(endHours, endMinutes, 0, 0)

  return { startAt, endAt }
}


  function canEnterLesson(startAt: string, endAt: string) {
  const start = new Date(startAt)
  const end = new Date(endAt)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false
  }

  const fiveMinutesBefore = start.getTime() - 5 * 60 * 1000

  return currentTime >= fiveMinutesBefore && currentTime <= end.getTime()
}

 function getLessonAccessMessage(startAt: string, endAt: string) {
  const start = new Date(startAt)
  const end = new Date(endAt)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Acesso indisponível'
  }

  if (currentTime > end.getTime()) {
    return 'Aula encerrada'
  }

  const fiveMinutesBefore = start.getTime() - 5 * 60 * 1000

  if (currentTime >= fiveMinutesBefore) {
    return 'Entrar na aula'
  }

  const difference = fiveMinutesBefore - currentTime
  const totalMinutes = Math.ceil(difference / 60000)

  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return minutes > 0 ? `Disponível em ${hours}h ${minutes}min` : `Disponível em ${hours}h`
  }

  return `Disponível em ${totalMinutes} min`
}

  function openLesson(lesson: Lesson) {
  if (!canEnterLesson(lesson.startAt, lesson.endAt)) {
    window.alert(
      getLessonAccessMessage(
        lesson.startAt,
        lesson.endAt,
      ),
    )

    return
  }

  window.location.href =
    `/aluno/aula/${lesson.id}`
}

  /*
   * =========================================================
   * VALIDAR ACESSO DO ALUNO
   * =========================================================
   *
   * O vínculo principal agora é:
   *
   * alunos.user_id = auth.users.id
   *
   * A matrícula/pagamento já precisa ter sido confirmada
   * para que o registro em alunos exista.
   */

  async function getStudentId(
    userId: string,
  ) {
    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      throw authError
    }

    const authenticatedUser =
      authData.user

    if (
      !authenticatedUser ||
      authenticatedUser.id !== userId
    ) {
      throw new Error(
        'Sessão do aluno inválida.',
      )
    }

    const email =
      authenticatedUser.email
        ?.trim()
        .toLowerCase()

    if (!email) {
      throw new Error(
        'O usuário autenticado não possui e-mail.',
      )
    }

    /*
     * A consulta ao cadastro é feita pelo Edge Function.
     * Isso evita depender das políticas RLS de alunos para
     * descobrir o ID interno do aluno.
     */
    const {
      data,
      error,
    } = await supabase.functions.invoke(
      'student-auth',
      {
        body: {
          action: 'check-email',
          email,
        },
      },
    )

    if (error) {
      throw error
    }

    if (
      !data?.success ||
      !data?.exists ||
      !data?.aluno_id
    ) {
      throw new Error(
        data?.error ||
          'Cadastro do aluno não encontrado.',
      )
    }

    return data.aluno_id as string
  }

  /*
   * =========================================================
   * CARREGAR AULAS
   * =========================================================
   */

  async function loadStudentLessons(userId: string) {
  try {
    setLessonsLoading(true)

    const studentId = await getStudentId(userId)

    const {
      data: horarios,
      error: horariosError,
    } = await supabase
      .from('horarios')
      .select(`
        id,
        idioma,
        dia_semana,
        hora_inicio,
        hora_fim,
        disponivel,
        aluno_id,
        meet_url,
        meet_space_name
      `)
      .eq('aluno_id', studentId)
      .order('dia_semana', { ascending: true })
      .order('hora_inicio', { ascending: true })

    if (horariosError) {
      throw horariosError
    }

    const normalizedLessons: Lesson[] = (horarios || []).map((horario) => {
      const { startAt, endAt } = getNextLessonOccurrence(
        Number(horario.dia_semana),
        horario.hora_inicio,
        horario.hora_fim,
      )

      return {
        id: horario.id,
        language:
          horario.idioma === 'ingles'
            ? 'Inglês'
            : 'Alemão',
        date: startAt.toLocaleDateString('pt-BR'),
        time: horario.hora_inicio.slice(0, 5),
        teacher: 'Professor',
        status: 'agendada',
        meetUrl: horario.meet_url || undefined,
        meetSpaceName: horario.meet_space_name || undefined,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      }
    })

    setLessons(normalizedLessons)
  } catch (error) {
    console.error(
      'Erro ao carregar aulas do aluno:',
      error,
    )

    setLessons([])
  } finally {
    setLessonsLoading(false)
  }
}

  /*
   * =========================================================
   * CARREGAR ATIVIDADES
   * =========================================================
   */

  async function loadStudentActivities(
    userId: string,
  ) {
    try {
      setActivitiesLoading(true)
      setActivitiesError('')

      const studentId =
        await getStudentId(
          userId,
        )

      const {
        data,
        error,
      } = await supabase
        .from('atividades')
        .select(
          `
            id,
            aluno_id,
            titulo,
            descricao,
            idioma,
            status,
            prazo,
            nota,
            created_at
          `,
        )
        .eq(
          'aluno_id',
          studentId,
        )
        .neq(
          'status',
          'rascunho',
        )
        .order(
          'created_at',
          {
            ascending: false,
          },
        )

      if (error) {
        throw error
      }

      const normalizedActivities: Activity[] =
        (data || []).map(
          (activity) => ({
            id: activity.id,
            aluno_id:
              activity.aluno_id,
            title:
              activity.titulo,
            description:
              activity.descricao,
            language:
              activity.idioma as
                | 'ingles'
                | 'alemao',
            dueDate:
              activity.prazo,
            status:
              activity.status as ActivityStatus,
            nota:
              activity.nota,
            createdAt:
              activity.created_at,
          }),
        )

      setActivities(
        normalizedActivities,
      )
    } catch (error) {
      console.error(
        'Erro ao carregar atividades do aluno:',
        error,
      )

      setActivitiesError(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar suas atividades.',
      )
    } finally {
      setActivitiesLoading(false)
    }
  }

  /*
   * =========================================================
   * AUTENTICAÇÃO / SESSÃO SUPABASE
   * =========================================================
   */

  useEffect(() => {
    let mounted = true

    const loadAuthenticatedUser =
      async (authenticatedUser: User) => {
        try {
          /*
           * O student-auth valida o cadastro usando service role.
           * Não dependemos de uma consulta direta à tabela alunos
           * para liberar a sessão do portal.
           */
          await getStudentId(
            authenticatedUser.id,
          )

          if (!mounted) {
            return
          }

          setAuthError('')
          setUser(authenticatedUser)
          setLoading(false)

          await Promise.all([
            loadStudentLessons(
              authenticatedUser.id,
            ),
            loadStudentActivities(
              authenticatedUser.id,
            ),
          ])
        } catch (error) {
          console.error(
            'Erro ao carregar acesso do aluno:',
            error,
          )

          if (!mounted) {
            return
          }

          setUser(null)
          setLoading(false)
          setAuthError(
            error instanceof Error
              ? error.message
              : 'Não foi possível validar o cadastro do aluno.',
          )
        }
      }

    const loadUser = async () => {
      try {
        const {
          data: { user: currentUser },
          error,
        } = await supabase.auth.getUser()

        if (error) {
          throw error
        }

        if (!mounted) {
          return
        }

        if (!currentUser) {
          setUser(null)
          setLoading(false)
          return
        }

        await loadAuthenticatedUser(
          currentUser,
        )
      } catch (error) {
        console.error(
          'Erro ao carregar sessão do aluno:',
          error,
        )

        if (!mounted) {
          return
        }

        setUser(null)
        setLoading(false)
        setAuthError(
          'Não foi possível carregar sua sessão.',
        )
      }
    }

    void loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) {
          return
        }

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setLoading(false)
          setLessons([])
          setActivities([])
          return
        }

        if (
          (event === 'SIGNED_IN' ||
            event === 'TOKEN_REFRESHED' ||
            event === 'USER_UPDATED') &&
          session?.user
        ) {
          /*
           * Não fazemos consultas Supabase diretamente dentro
           * do callback de autenticação. O setTimeout evita
           * bloqueio/concorrência com a atualização da sessão.
           */
          window.setTimeout(() => {
            if (mounted) {
              void loadAuthenticatedUser(
                session.user,
              )
            }
          }, 0)
        }
      },
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  /*
   * =========================================================
   * ATIVIDADES
   * =========================================================
   */

  async function openActivity(
    activity: Activity,
  ) {
    try {
      setSelectedActivity(
        activity,
      )

      setActivityLoading(true)
      setActivityError('')
      setSelectedExercises([])
      setAnswers([])

      const {
        data,
        error,
      } = await supabase
        .from(
          'atividade_exercicios',
        )
        .select(
          `
            id,
            atividade_id,
            titulo,
            enunciado,
            tipo,
            ordem,
            pontuacao,
            alternativas:exercicio_alternativas (
              id,
              texto,
              correta,
              ordem
            ),
            conteudos:exercicio_conteudos (
              id,
              tipo,
              conteudo,
              ordem
            )
          `,
        )
        .eq(
          'atividade_id',
          activity.id,
        )
        .order(
          'ordem',
          {
            ascending: true,
          },
        )

      if (error) {
        throw error
      }

      const exercises: Exercise[] =
        (data || []).map(
          (exercise) => ({
            id: exercise.id,
            atividade_id:
              exercise.atividade_id,
            titulo:
              exercise.titulo,
            enunciado:
              exercise.enunciado,
            tipo:
              exercise.tipo as ExerciseType,
            ordem:
              exercise.ordem,
            pontuacao:
              Number(
                exercise.pontuacao,
              ) || 0,
            alternativas: (
              exercise.alternativas ||
              []
            ).sort(
              (
                a: ExerciseAlternative,
                b: ExerciseAlternative,
              ) =>
                a.ordem -
                b.ordem,
            ),
            conteudos: (
              exercise.conteudos ||
              []
            ).sort(
              (
                a: ExerciseContent,
                b: ExerciseContent,
              ) =>
                a.ordem -
                b.ordem,
            ),
          }),
        )

      setSelectedExercises(
        exercises,
      )

      const initialAnswers =
        exercises.map(
          (exercise) =>
            createEmptyAnswer(
              exercise.id,
            ),
        )

      if (
        activity.status ===
          'respondida' ||
        activity.status ===
          'em_correcao' ||
        activity.status ===
          'corrigida'
      ) {
        const studentId =
          await getStudentId(
            user?.id || '',
          )

        const {
          data:
            existingAnswers,
          error:
            answersError,
        } = await supabase
          .from(
            'respostas_aluno',
          )
          .select(
            `
              id,
              exercicio_id,
              resposta_texto,
              alternativa_id,
              pontuacao,
              feedback,
              corrigida
            `,
          )
          .eq(
            'atividade_id',
            activity.id,
          )
          .eq(
            'aluno_id',
            studentId,
          )

        if (answersError) {
          throw answersError
        }

        for (const answer of
          existingAnswers || []) {
          const target =
            initialAnswers.find(
              (item) =>
                item.exerciseId ===
                answer.exercicio_id,
            )

          if (!target) {
            continue
          }

          target.respostaTexto =
            answer.resposta_texto ||
            ''

          if (answer.alternativa_id) {
            target.alternativaIds = [answer.alternativa_id]
          } else if (answer.resposta_texto) {
            try {
              const parsed = JSON.parse(answer.resposta_texto)
              if (Array.isArray(parsed)) {
                target.alternativaIds = parsed.filter(
                  (id): id is string => typeof id === 'string',
                )
              }
            } catch {
              // resposta textual normal
            }
          }
        }
      }

      setAnswers(
        initialAnswers,
      )
    } catch (error) {
      console.error(
        'Erro ao abrir atividade:',
        error,
      )

      setActivityError(
        error instanceof Error
          ? error.message
          : 'Não foi possível abrir a atividade.',
      )
    } finally {
      setActivityLoading(false)
    }
  }

  function closeActivity() {
    if (submittingActivity) {
      return
    }

    setSelectedActivity(null)
    setSelectedExercises([])
    setAnswers([])
    setActivityError('')
  }

  function updateTextAnswer(
    exerciseId: string,
    value: string,
  ) {
    setAnswers((current) =>
      current.map(
        (answer) =>
          answer.exerciseId ===
          exerciseId
            ? {
                ...answer,
                respostaTexto:
                  value,
              }
            : answer,
      ),
    )
  }

  function toggleAlternative(
    exercise: Exercise,
    alternativeId: string,
  ) {
    setAnswers((current) =>
      current.map((answer) => {
        if (
          answer.exerciseId !==
          exercise.id
        ) {
          return answer
        }

        if (
          isSingleChoiceType(
            exercise.tipo,
          )
        ) {
          return {
            ...answer,
            alternativaIds: [
              alternativeId,
            ],
          }
        }

        const exists =
          answer.alternativaIds.includes(
            alternativeId,
          )

        return {
          ...answer,
          alternativaIds: exists
            ? answer.alternativaIds.filter(
                (id) =>
                  id !==
                  alternativeId,
              )
            : [
                ...answer.alternativaIds,
                alternativeId,
              ],
        }
      }),
    )
  }

  function getAnswer(
    exerciseId: string,
  ) {
    return (
      answers.find(
        (answer) =>
          answer.exerciseId ===
          exerciseId,
      ) ||
      createEmptyAnswer(
        exerciseId,
      )
    )
  }

  function validateAnswers() {
    for (const exercise of
      selectedExercises) {
      const answer =
        getAnswer(exercise.id)

      if (
        isObjectiveType(
          exercise.tipo,
        ) &&
        answer.alternativaIds
          .length === 0
      ) {
        return `Responda o exercício ${exercise.ordem + 1}.`
      }

      if (
        !isObjectiveType(
          exercise.tipo,
        ) &&
        !answer.respostaTexto.trim()
      ) {
        return `Responda o exercício ${exercise.ordem + 1}.`
      }
    }

    return ''
  }

  async function submitActivity() {
    if (!selectedActivity || !user) {
      return
    }

    const validation =
      validateAnswers()

    if (validation) {
      setActivityError(
        validation,
      )
      return
    }

    const confirmed =
      window.confirm(
        'Deseja realmente enviar esta atividade? Depois do envio, as respostas não poderão ser alteradas.',
      )

    if (!confirmed) {
      return
    }

    try {
      setSubmittingActivity(true)
      setActivityError('')

      const studentId =
        await getStudentId(
          user.id,
        )

      const {
        data:
          currentAnswers,
        error:
          currentAnswersError,
      } = await supabase
        .from(
          'respostas_aluno',
        )
        .select('id')
        .eq(
          'atividade_id',
          selectedActivity.id,
        )
        .eq(
          'aluno_id',
          studentId,
        )

      if (currentAnswersError) {
        throw currentAnswersError
      }

      const existingAnswerIds =
        (currentAnswers || []).map(
          (answer) =>
            answer.id,
        )

      if (
        existingAnswerIds.length >
        0
      ) {
        const {
          error: deleteError,
        } = await supabase
          .from(
            'respostas_aluno',
          )
          .delete()
          .in(
            'id',
            existingAnswerIds,
          )

        if (deleteError) {
          throw deleteError
        }
      }

      const answerRows =
        selectedExercises.map(
          (exercise) => {
            const answer =
              getAnswer(
                exercise.id,
              )

            return {
              atividade_id:
                selectedActivity.id,
              exercicio_id:
                exercise.id,
              aluno_id:
                studentId,
              resposta_texto:
                isObjectiveType(exercise.tipo)
                  ? (
                      answer.alternativaIds.length > 1
                        ? JSON.stringify(answer.alternativaIds)
                        : null
                    )
                  : (answer.respostaTexto.trim() || null),
              alternativa_id:
                isObjectiveType(exercise.tipo) &&
                isSingleChoiceType(exercise.tipo)
                  ? answer.alternativaIds[0] || null
                  : null,
              pontuacao: null,
              feedback: null,
              corrigida: false,
            }
          },
        )

      const {
        error: insertError,
      } = await supabase
        .from(
          'respostas_aluno',
        )
        .insert(
          answerRows,
        )

      if (insertError) {
        throw insertError
      }

      const {
        error: updateError,
      } = await supabase
        .from('atividades')
        .update({
          status:
            'respondida',
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          selectedActivity.id,
        )
        .eq(
          'aluno_id',
          studentId,
        )

      if (updateError) {
        throw updateError
      }

      setActivities((current) =>
        current.map(
          (activity) =>
            activity.id ===
            selectedActivity.id
              ? {
                  ...activity,
                  status:
                    'respondida',
                }
              : activity,
        ),
      )

      setSelectedActivity(
        (current) =>
          current
            ? {
                ...current,
                status:
                  'respondida',
              }
            : current,
      )

      setActivityError('')

      window.alert(
        'Atividade enviada com sucesso!',
      )

      closeActivity()
    } catch (error) {
      console.error(
        'Erro ao enviar atividade:',
        error,
      )

      setActivityError(
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar a atividade.',
      )
    } finally {
      setSubmittingActivity(false)
    }
  }

  const handleLogout =
    async () => {
      await supabase.auth.signOut()

      setUser(null)
      setSection('inicio')
      setAuthError('')
      setAuthInfo('')
      setAuthEmail('')
      setAuthPassword('')
      setAuthPasswordConfirmation('')
      setAuthStudentName('')
      setAuthStep('email')
    }

  const navigateTo = (
    nextSection: StudentSection,
  ) => {
    setSection(nextSection)
    setMobileMenuOpen(false)
  }

  const pendingActivities =
    useMemo(
      () =>
        activities.filter(
          (activity) =>
            activity.status ===
              'enviada' ||
            activity.status ===
              'em_andamento',
        ),
      [activities],
    )

  const nextLesson =
    lessons.find(
      (lesson) =>
        lesson.status ===
        'agendada',
    )

  const sectionTitles: Record<
    StudentSection,
    string
  > = {
    inicio: 'Início',
    aulas: 'Minhas aulas',
    materiais: 'Materiais',
    atividades: 'Atividades',
    progresso: 'Meu progresso',
    perfil: 'Meu perfil',
  }

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (loading) {
    return (
      <div className="student-loading">
        <span>
          Carregando portal...
        </span>
      </div>
    )
  }

  /*
   * =========================================================
   * LOGIN
   * =========================================================
   */

  if (!user) {
    return (
      <div className="student-login-page">
        <div className="student-login-card">
          <img
            src={logo}
            alt="AB Academy"
            className="student-login-logo"
          />

          <span className="student-login-label">
            PORTAL DO ALUNO
          </span>

          {authStep ===
            'email' && (
            <>
              <h1>
                Acesse sua conta
              </h1>

              <p>
                Informe o e-mail
                utilizado na sua
                matrícula.
              </p>
            </>
          )}

          {authStep ===
            'password' && (
            <>
              <h1>
                Bem-vindo
                {authStudentName
                  ? `, ${
                      authStudentName.split(
                        ' ',
                      )[0]
                    }`
                  : ''}
                !
              </h1>

              <p>
                Digite sua senha
                para acessar o
                portal do aluno.
              </p>
            </>
          )}

          {authStep ===
            'create-password' && (
            <>
              <h1>
                Primeiro acesso
              </h1>

              <p>
                Crie sua senha para
                acessar o portal
                sempre que quiser.
              </p>
            </>
          )}

          {authError && (
            <div className="student-login-error">
              {authError}
            </div>
          )}

          {authInfo && (
            <div className="student-login-info">
              {authInfo}
            </div>
          )}

          {authStep ===
            'email' && (
            <>
              <div className="student-login-field">
                <label htmlFor="student-email">