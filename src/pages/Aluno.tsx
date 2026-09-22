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

          if (
            answer.alternativa_id
          ) {
            target.alternativaIds =
              [
                answer.alternativa_id,
              ]
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
                answer.respostaTexto.trim() ||
                null,
              alternativa_id:
                answer
                  .alternativaIds[0] ||
                null,
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
                  E-mail
                </label>

                <input
                  id="student-email"
                  type="email"
                  value={authEmail}
                  onChange={(
                    event,
                  ) => {
                    setAuthEmail(
                      event.target
                        .value,
                    )
                    setAuthError('')
                  }}
                  onKeyDown={(
                    event,
                  ) => {
                    if (
                      event.key ===
                      'Enter'
                    ) {
                      void handleCheckEmail()
                    }
                  }}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  disabled={
                    authLoading
                  }
                />
              </div>

              <button
                type="button"
                className="student-primary-button student-auth-button"
                onClick={
                  handleCheckEmail
                }
                disabled={
                  authLoading
                }
              >
                {authLoading ? (
                  <>
                    <Loader2
                      size={19}
                      className="student-spin"
                    />

                    Verificando...
                  </>
                ) : (
                  <>
                    Continuar
                    <ChevronRight
                      size={18}
                    />
                  </>
                )}
              </button>
            </>
          )}

          {authStep ===
            'password' && (
            <>
              <div className="student-login-field">
                <label htmlFor="student-email-login">
                  E-mail
                </label>

                <input
                  id="student-email-login"
                  type="email"
                  value={authEmail}
                  onChange={(
                    event,
                  ) =>
                    setAuthEmail(
                      event.target
                        .value,
                    )
                  }
                  autoComplete="email"
                  disabled={
                    authLoading
                  }
                />
              </div>

              <div className="student-login-field">
                <label htmlFor="student-password">
                  Senha
                </label>

                <input
                  id="student-password"
                  type="password"
                  value={authPassword}
                  onChange={(
                    event,
                  ) => {
                    setAuthPassword(
                      event.target
                        .value,
                    )
                    setAuthError('')
                  }}
                  onKeyDown={(
                    event,
                  ) => {
                    if (
                      event.key ===
                      'Enter'
                    ) {
                      void handleStudentLogin()
                    }
                  }}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  disabled={
                    authLoading
                  }
                />
              </div>

              <button
                type="button"
                className="student-primary-button student-auth-button"
                onClick={
                  handleStudentLogin
                }
                disabled={
                  authLoading
                }
              >
                {authLoading ? (
                  <>
                    <Loader2
                      size={19}
                      className="student-spin"
                    />

                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <ChevronRight
                      size={18}
                    />
                  </>
                )}
              </button>

              <button
                type="button"
                className="student-primary-button student-auth-button"
                onClick={
                  resetAuthToEmail
                }
                disabled={
                  authLoading
                }
              >
                ← Usar outro e-mail
              </button>
            </>
          )}

          {authStep ===
            'create-password' && (
            <>
              <div className="student-login-field">
                <label htmlFor="student-email-create">
                  E-mail
                </label>

                <input
                  id="student-email-create"
                  type="email"
                  value={authEmail}
                  disabled
                  autoComplete="email"
                />
              </div>

              <div className="student-login-field">
                <label htmlFor="student-new-password">
                  Criar senha
                </label>

                <input
                  id="student-new-password"
                  type="password"
                  value={authPassword}
                  onChange={(
                    event,
                  ) => {
                    setAuthPassword(
                      event.target
                        .value,
                    )
                    setAuthError('')
                  }}
                  placeholder="Crie uma senha segura"
                  autoComplete="new-password"
                  disabled={
                    authLoading
                  }
                />
              </div>

              <div className="student-login-field">
                <label htmlFor="student-password-confirmation">
                  Confirmar senha
                </label>

                <input
                  id="student-password-confirmation"
                  type="password"
                  value={
                    authPasswordConfirmation
                  }
                  onChange={(
                    event,
                  ) => {
                    setAuthPasswordConfirmation(
                      event.target
                        .value,
                    )
                    setAuthError('')
                  }}
                  onKeyDown={(
                    event,
                  ) => {
                    if (
                      event.key ===
                      'Enter'
                    ) {
                      void handleCreatePassword()
                    }
                  }}
                  placeholder="Digite a senha novamente"
                  autoComplete="new-password"
                  disabled={
                    authLoading
                  }
                />
              </div>

              <div className="student-password-rules">
                <span>
                  Sua senha deve conter:
                </span>

                <span className={passwordRules.minLength ? 'valid' : ''}>
                  • mínimo de 8 caracteres
                </span>

                <span className={passwordRules.uppercase ? 'valid' : ''}>
                  • uma letra maiúscula
                </span>

                <span className={passwordRules.lowercase ? 'valid' : ''}>
                  • uma letra minúscula
                </span>

                <span className={passwordRules.number ? 'valid' : ''}>
                  • um número
                </span>

                <span className={passwordRules.special ? 'valid' : ''}>
                  • um caractere especial
                </span>
              </div>

              <button
                type="button"
                className="student-primary-button student-auth-button"
                onClick={
                  handleCreatePassword
                }
                disabled={
                  authLoading
                }
              >
                {authLoading ? (
                  <>
                    <Loader2
                      size={19}
                      className="student-spin"
                    />

                    Criando senha...
                  </>
                ) : (
                  <>
                    Criar senha e entrar
                    <CheckCircle2
                      size={18}
                    />
                  </>
                )}
              </button>

              <button
                type="button"
                className="student-primary-button student-auth-button"
                onClick={
                  resetAuthToEmail
                }
                disabled={
                  authLoading
                }
              >
                ← Usar outro e-mail
              </button>
            </>
          )}

          <div className="student-login-footer">
            <span>
              AB Academy
            </span>

            <span>
              Portal exclusivo para alunos
            </span>
          </div>
        </div>
      </div>
    )
  }

  /*
   * =========================================================
   * DADOS DO USUÁRIO
   * =========================================================
   */

  const name =
    user.user_metadata
      ?.full_name ||
    user.user_metadata
      ?.name ||
    authStudentName ||
    'Aluno'

  const avatar =
    user.user_metadata
      ?.avatar_url ||
    user.user_metadata
      ?.picture ||
    ''

  const firstName =
    name.split(' ')[0]

  return (
    <div className="student-portal">
      {mobileMenuOpen && (
        <button
          type="button"
          className="student-mobile-overlay"
          aria-label="Fechar menu"
          onClick={() =>
            setMobileMenuOpen(false)
          }
        />
      )}

      <aside
        className={`student-sidebar ${
          mobileMenuOpen
            ? 'open'
            : ''
        }`}
      >
        <div className="student-brand">
          <img
            src={logo}
            alt="AB Academy"
          />

          <button
            type="button"
            className="student-sidebar-close"
            onClick={() =>
              setMobileMenuOpen(false)
            }
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="student-navigation">
          <button
            type="button"
            className={`student-nav-item ${
              section ===
              'inicio'
                ? 'active'
                : ''
            }`}
            onClick={() =>
              navigateTo('inicio')
            }
          >
            <Home size={19} />
            <span>Início</span>
          </button>

          <button
            type="button"
            className={`student-nav-item ${
              section ===
              'aulas'
                ? 'active'
                : ''
            }`}
            onClick={() =>
              navigateTo('aulas')
            }
          >
            <CalendarDays
              size={19}
            />
            <span>Minhas aulas</span>
          </button>

          <button
            type="button"
            className={`student-nav-item ${
              section ===
              'materiais'
                ? 'active'
                : ''
            }`}
            onClick={() =>
              navigateTo(
                'materiais',
              )
            }
          >
            <BookOpen size={19} />
            <span>Materiais</span>
          </button>

          <button
            type="button"
            className={`student-nav-item ${
              section ===
              'atividades'
                ? 'active'
                : ''
            }`}
            onClick={() =>
              navigateTo(
                'atividades',
              )
            }
          >
            <ClipboardList
              size={19}
            />

            <span>
              Atividades
            </span>

            {pendingActivities.length >
              0 && (
              <span className="student-nav-badge">
                {
                  pendingActivities.length
                }
              </span>
            )}
          </button>

          <button
            type="button"
            className={`student-nav-item ${
              section ===
              'progresso'
                ? 'active'
                : ''
            }`}
            onClick={() =>
              navigateTo(
                'progresso',
              )
            }
          >
            <CheckCircle2
              size={19}
            />

            <span>
              Meu progresso
            </span>
          </button>

          <button
            type="button"
            className={`student-nav-item ${
              section ===
              'perfil'
                ? 'active'
                : ''
            }`}
            onClick={() =>
              navigateTo(
                'perfil',
              )
            }
          >
            <UserCircle
              size={19}
            />

            <span>
              Meu perfil
            </span>
          </button>
        </nav>

        <button
          type="button"
          className="student-logout"
          onClick={
            handleLogout
          }
        >
          <LogOut size={18} />
          <span>Sair</span>
        </button>
      </aside>

      <main className="student-main">
        <header className="student-header">
          <div className="student-header-left">
            <button
              type="button"
              className="student-mobile-menu"
              onClick={() =>
                setMobileMenuOpen(
                  true,
                )
              }
              aria-label="Abrir menu"
            >
              <Menu size={22} />
            </button>

            <div>
              <span className="student-header-label">
                PORTAL DO ALUNO
              </span>

              <h1>
                {section ===
                'inicio'
                  ? `Olá, ${firstName}!`
                  : sectionTitles[
                      section
                    ]}
              </h1>

              <p>
                {section ===
                'inicio'
                  ? 'Continue sua jornada de aprendizado.'
                  : 'AB Academy'}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="student-user"
            onClick={() =>
              navigateTo(
                'perfil',
              )
            }
          >
            {avatar ? (
              <img
                src={avatar}
                alt={name}
              />
            ) : (
              <div className="student-avatar-placeholder">
                {getInitials(name)}
              </div>
            )}

            <div>
              <strong>
                {name}
              </strong>

              <span>
                {user.email}
              </span>
            </div>
          </button>
        </header>

        <section className="student-content">
          {section ===
            'inicio' && (
            <Inicio
              name={firstName}
              nextLesson={
                nextLesson
              }
              pendingActivities={
                pendingActivities.length
              }
              materialsCount={
                materials.length
              }
              onNavigate={
                navigateTo
              }
              onOpenLesson={
                openLesson
              }
              canEnterLesson={
                canEnterLesson
              }
              getLessonAccessMessage={
                getLessonAccessMessage
              }
              currentTime={
                currentTime
              }
            />
          )}

          {section ===
            'aulas' && (
            <MinhasAulas
              lessons={lessons}
              lessonsLoading={
                lessonsLoading
              }
              onOpenLesson={
                openLesson
              }
              canEnterLesson={
                canEnterLesson
              }
              getLessonAccessMessage={
                getLessonAccessMessage
              }
              currentTime={
                currentTime
              }
            />
          )}

          {section ===
            'materiais' && (
            <Materiais
              materials={
                materials
              }
            />
          )}

          {section ===
            'atividades' && (
            <Atividades
              activities={
                activities
              }
              loading={
                activitiesLoading
              }
              error={
                activitiesError
              }
              onOpen={
                openActivity
              }
            />
          )}

          {section ===
            'progresso' && (
            <Progresso
              activities={
                activities
              }
            />
          )}

          {section ===
            'perfil' && (
            <Perfil
              user={user}
              name={name}
              avatar={avatar}
            />
          )}
        </section>
      </main>

      {selectedActivity && (
        <ActivityModal
          activity={
            selectedActivity
          }
          exercises={
            selectedExercises
          }
          answers={answers}
          loading={
            activityLoading
          }
          error={
            activityError
          }
          submitting={
            submittingActivity
          }
          onClose={
            closeActivity
          }
          onTextChange={
            updateTextAnswer
          }
          onAlternativeChange={
            toggleAlternative
          }
          onSubmit={
            submitActivity
          }
        />
      )}
    </div>
  )
}

type InicioProps = {
  name: string
  nextLesson?: Lesson
  pendingActivities: number
  materialsCount: number
  onNavigate: (
    section: StudentSection,
  ) => void
  onOpenLesson: (
    lesson: Lesson,
  ) => void
  canEnterLesson: (
    startAt: string,
    endAt: string,
  ) => boolean
  getLessonAccessMessage: (
    startAt: string,
    endAt: string,
  ) => string
  currentTime: number
}

function Inicio({
  name,
  nextLesson,
  pendingActivities,
  materialsCount,
  onNavigate,
  onOpenLesson,
  canEnterLesson,
  getLessonAccessMessage,
  currentTime,
}: InicioProps) {
  void currentTime

  return (
    <>
      <div className="student-welcome-card">
        <div>
          <span className="student-card-label">
            AB ACADEMY
          </span>

          <h2>
            Bem-vindo, {name}!
          </h2>

          <p>
            Acompanhe suas aulas,
            materiais e atividades
            em um só lugar.
          </p>
        </div>
      </div>

      <div className="student-section-title">
        <div>
          <span>
            PRÓXIMO COMPROMISSO
          </span>

          <h2>
            Minha próxima aula
          </h2>
        </div>
      </div>

      {nextLesson ? (
        <div className="student-next-lesson">
          <div className="student-next-lesson-info">
            <div className="student-lesson-icon">
              <CalendarDays
                size={24}
              />
            </div>

            <div>
              <span>
                {
                  nextLesson.language
                }
              </span>

              <h3>
                {nextLesson.date}{' '}
                às{' '}
                {nextLesson.time}
              </h3>

              <p>
                {
                  nextLesson.teacher
                }
              </p>
            </div>
          </div>

          <button
            type="button"
            className="student-primary-button"
            onClick={() => onOpenLesson(nextLesson)}
            disabled={
              !canEnterLesson(
                nextLesson.startAt,
                nextLesson.endAt,
              )
            }
            title={getLessonAccessMessage(
              nextLesson.startAt,
              nextLesson.endAt,
            )}
          >
            <Play size={17} />

            {getLessonAccessMessage(
              nextLesson.startAt,
              nextLesson.endAt,
            )}
          </button>
        </div>
      ) : (
        <div className="student-empty-state">
          <CalendarDays
            size={28}
          />

          <h3>
            Nenhuma aula agendada
          </h3>

          <p>
            Suas próximas aulas
            aparecerão aqui.
          </p>
        </div>
      )}

      <div className="student-section-title">
        <div>
          <span>
            ACOMPANHAMENTO
          </span>

          <h2>
            Seu espaço de
            aprendizagem
          </h2>
        </div>
      </div>

      <div className="student-dashboard-grid">
        <button
          type="button"
          className="student-dashboard-card"
          onClick={() =>
            onNavigate('aulas')
          }
        >
          <span>AULAS</span>

          <strong>
            Minhas aulas
          </strong>

          <p>
            Consulte suas aulas
            agendadas e seu
            histórico.
          </p>

          <ChevronRight
            size={18}
          />
        </button>

        <button
          type="button"
          className="student-dashboard-card"
          onClick={() =>
            onNavigate(
              'atividades',
            )
          }
        >
          <span>
            ATIVIDADES
          </span>

          <strong>
            {pendingActivities}{' '}
            pendente(s)
          </strong>

          <p>
            Acesse as atividades
            enviadas pelo
            professor.
          </p>

          <ChevronRight
            size={18}
          />
        </button>

        <button
          type="button"
          className="student-dashboard-card"
          onClick={() =>
            onNavigate(
              'materiais',
            )
          }
        >
          <span>
            MATERIAIS
          </span>

          <strong>
            {materialsCount}
          </strong>

          <p>
            Consulte seus
            materiais de estudo.
          </p>

          <ChevronRight
            size={18}
          />
        </button>
      </div>
    </>
  )
}

type MinhasAulasProps = {
  lessons: Lesson[]
  lessonsLoading: boolean
  onOpenLesson: (
    lesson: Lesson,
  ) => void
  canEnterLesson: (
    startAt: string,
    endAt: string,
  ) => boolean
  getLessonAccessMessage: (
    startAt: string,
    endAt: string,
  ) => string
  currentTime: number
}

function MinhasAulas({
  lessons,
  lessonsLoading,
  onOpenLesson,
  canEnterLesson,
  getLessonAccessMessage,
  currentTime,
}: MinhasAulasProps) {
  void currentTime

  return (
    <>
      <div className="student-section-title">
        <div>
          <span>AULAS</span>

          <h2>
            Minhas aulas
          </h2>
        </div>
      </div>

      {lessonsLoading ? (
        <div className="student-empty-state">
          <Loader2
            size={28}
            className="student-spin"
          />

          <h3>
            Carregando suas aulas...
          </h3>

          <p>
            Aguarde enquanto
            buscamos sua agenda.
          </p>
        </div>
      ) : lessons.length ===
        0 ? (
        <div className="student-empty-state">
          <CalendarDays
            size={28}
          />

          <h3>
            Nenhuma aula agendada
          </h3>

          <p>
            Suas aulas aparecerão
            aqui.
          </p>
        </div>
      ) : (
        <div className="student-lessons-list">
          {lessons.map(
            (lesson) => {
              const hasMeet =
                Boolean(
                  lesson.meetUrl,
                )

              const canEnter =
                canEnterLesson(
                  lesson.startAt,
                  lesson.endAt,
                )

              return (
                <div
                  className="student-lesson-card"
                  key={lesson.id}
                >
                  <div className="student-lesson-date">
                    <CalendarDays
                      size={20}
                    />

                    <strong>
                      {lesson.date}
                    </strong>

                    <span>
                      {lesson.time}
                    </span>
                  </div>

                  <div className="student-lesson-details">
                    <span>
                      {
                        lesson.language
                      }
                    </span>

                    <h3>
                      Aula particular
                    </h3>

                    <p>
                      {lesson.teacher}
                    </p>
                  </div>

                  <div className="student-lesson-status">
                    {lesson.status ===
                    'agendada'
                      ? 'Agendada'
                      : lesson.status ===
                          'realizada'
                        ? 'Realizada'
                        : 'Cancelada'}
                  </div>

                  {lesson.status ===
                    'agendada' && (
                    <button
                      type="button"
                      className="student-primary-button"
                      onClick={() =>
                        onOpenLesson(
                          lesson,
                        )
                      }
                      disabled={
                        !hasMeet ||
                        !canEnter
                      }
                      title={
                        !hasMeet
                          ? 'A sala ainda não foi criada pelo professor'
                          : getLessonAccessMessage(
                              lesson.startAt,
                              lesson.endAt,
                            )
                      }
                    >
                      <Play
                        size={17}
                      />

                      {!hasMeet
                        ? 'Sala não criada'
                        : getLessonAccessMessage(
                            lesson.startAt,
                            lesson.endAt,
                          )}
                    </button>
                  )}
                </div>
              )
            },
          )}
        </div>
      )}
    </>
  )
}

type MateriaisProps = {
  materials: Material[]
}

function Materiais({
  materials,
}: MateriaisProps) {
  return (
    <>
      <div className="student-section-title">
        <div>
          <span>ESTUDO</span>

          <h2>
            Materiais
          </h2>
        </div>
      </div>

      <div className="student-materials-list">
        {materials.map(
          (material) => (
            <div
              className="student-material-card"
              key={material.id}
            >
              <div className="student-material-icon">
                <FileText
                  size={22}
                />
              </div>

              <div>
                <span>
                  {material.type}
                </span>

                <h3>
                  {material.title}
                </h3>

                <p>
                  Disponibilizado
                  em{' '}
                  {material.date}
                </p>
              </div>

              <button
                type="button"
                className="student-secondary-button"
              >
                Abrir
              </button>
            </div>
          ),
        )}
      </div>
    </>
  )
}

type AtividadesProps = {
  activities: Activity[]
  loading: boolean
  error: string
  onOpen: (
    activity: Activity,
  ) => void
}

function Atividades({
  activities,
  loading,
  error,
  onOpen,
}: AtividadesProps) {
  return (
    <>
      <div className="student-section-title">
        <div>
          <span>
            APRENDIZAGEM
          </span>

          <h2>
            Atividades
          </h2>
        </div>
      </div>

      {error && (
        <div className="student-empty-state">
          <ClipboardList
            size={28}
          />

          <h3>
            Não foi possível
            carregar suas
            atividades
          </h3>

          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="student-empty-state">
          <Loader2
            size={28}
            className="student-spin"
          />

          <h3>
            Carregando
            atividades...
          </h3>

          <p>
            Aguarde enquanto
            buscamos suas
            atividades.
          </p>
        </div>
      ) : !error &&
        activities.length ===
          0 ? (
        <div className="student-empty-state">
          <ClipboardList
            size={28}
          />

          <h3>
            Nenhuma atividade
          </h3>

          <p>
            Quando seu professor
            enviar uma atividade,
            ela aparecerá aqui.
          </p>
        </div>
      ) : (
        <div className="student-activities-list">
          {activities.map(
            (activity) => {
              const canAnswer =
                activity.status ===
                  'enviada' ||
                activity.status ===
                  'em_andamento'

              return (
                <div
                  className="student-activity-card"
                  key={
                    activity.id
                  }
                >
                  <div>
                    <span>
                      {
                        languageLabels[
                          activity.language
                        ]
                      }
                    </span>

                    <h3>
                      {
                        activity.title
                      }
                    </h3>

                    {activity.description && (
                      <p>
                        {
                          activity.description
                        }
                      </p>
                    )}

                    <p>
                      Prazo:{' '}
                      {formatDate(
                        activity.dueDate,
                      )}
                    </p>
                  </div>

                  <div className="student-activity-right">
                    <span
                      className={getStatusClass(
                        activity.status,
                      )}
                    >
                      {
                        activityStatusLabels[
                          activity.status
                        ]
                      }
                    </span>

                    {activity.nota !==
                      null && (
                      <strong>
                        Nota:{' '}
                        {activity.nota}
                      </strong>
                    )}

                    <button
                      type="button"
                      className={
                        canAnswer
                          ? 'student-primary-button'
                          : 'student-secondary-button'
                      }
                      onClick={() =>
                        onOpen(
                          activity,
                        )
                      }
                    >
                      {canAnswer
                        ? 'Acessar'
                        : 'Visualizar'}

                      <ChevronRight
                        size={17}
                      />
                    </button>
                  </div>
                </div>
              )
            },
          )}
        </div>
      )}
    </>
  )
}

type ActivityModalProps = {
  activity: Activity
  exercises: Exercise[]
  answers: StudentAnswer[]
  loading: boolean
  error: string
  submitting: boolean
  onClose: () => void
  onTextChange: (
    exerciseId: string,
    value: string,
  ) => void
  onAlternativeChange: (
    exercise: Exercise,
    alternativeId: string,
  ) => void
  onSubmit: () => void
}

function ActivityModal({
  activity,
  exercises,
  answers,
  loading,
  error,
  submitting,
  onClose,
  onTextChange,
  onAlternativeChange,
  onSubmit,
}: ActivityModalProps) {
  const readOnly =
    activity.status ===
      'respondida' ||
    activity.status ===
      'em_correcao' ||
    activity.status ===
      'corrigida'

  return (
    <div
      className="student-activity-modal-overlay"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose()
        }
      }}
    >
      <div className="student-activity-modal">
        <div className="student-activity-modal-header">
          <div>
            <span>
              {
                languageLabels[
                  activity.language
                ]
              }
            </span>

            <h2>
              {activity.title}
            </h2>

            <p>
              Prazo:{' '}
              {formatDateTime(
                activity.dueDate,
              )}
            </p>
          </div>

          <button
            type="button"
            className="student-modal-close"
            onClick={onClose}
            disabled={submitting}
          >
            <X size={20} />
          </button>
        </div>

        {activity.description && (
          <div className="student-activity-description">
            <p>
              {
                activity.description
              }
            </p>
          </div>
        )}

        {error && (
          <div className="student-activity-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="student-empty-state">
            <Loader2
              size={30}
              className="student-spin"
            />

            <h3>
              Carregando atividade...
            </h3>

            <p>
              Preparando os
              exercícios.
            </p>
          </div>
        ) : (
          <>
            <div className="student-exercises">
              {exercises.map(
                (
                  exercise,
                  index,
                ) => {
                  const answer =
                    answers.find(
                      (item) =>
                        item.exerciseId ===
                        exercise.id,
                    ) ||
                    createEmptyAnswer(
                      exercise.id,
                    )

                  return (
                    <div
                      className="student-exercise-card"
                      key={
                        exercise.id
                      }
                    >
                      <div className="student-exercise-header">
                        <div>
                          <span>
                            Exercício{' '}
                            {index +
                              1}
                          </span>

                          <h3>
                            {exercise.titulo ||
                              `Exercício ${
                                index +
                                1
                              }`}
                          </h3>
                        </div>

                        <div>
                          <span>
                            {
                              exerciseTypeLabels[
                                exercise.tipo
                              ]
                            }
                          </span>

                          <strong>
                            {
                              exercise.pontuacao
                            }{' '}
                            pt
                          </strong>
                        </div>
                      </div>

                      {exercise.conteudos
                        .length >
                        0 && (
                        <div className="student-exercise-contents">
                          {exercise.conteudos.map(
                            (
                              content,
                            ) => (
                              <ExerciseContentView
                                content={
                                  content
                                }
                                key={
                                  content.id
                                }
                              />
                            ),
                          )}
                        </div>
                      )}

                      <div className="student-exercise-question">
                        <p>
                          {
                            exercise.enunciado
                          }
                        </p>
                      </div>

                      {isObjectiveType(
                        exercise.tipo,
                      ) ? (
                        <div className="student-alternatives">
                          {exercise.alternativas.map(
                            (
                              alternative,
                              alternativeIndex,
                            ) => {
                              const selected =
                                answer.alternativaIds.includes(
                                  alternative.id,
                                )

                              return (
                                <button
                                  type="button"
                                  key={
                                    alternative.id
                                  }
                                  className={`student-alternative ${
                                    selected
                                      ? 'selected'
                                      : ''
                                  } ${
                                    readOnly &&
                                    alternative.correta
                                      ? 'correct'
                                      : ''
                                  }`}
                                  disabled={
                                    readOnly
                                  }
                                  onClick={() =>
                                    onAlternativeChange(
                                      exercise,
                                      alternative.id,
                                    )
                                  }
                                >
                                  <span className="student-alternative-letter">
                                    {String.fromCharCode(
                                      65 +
                                        alternativeIndex,
                                    )}
                                  </span>

                                  <span>
                                    {
                                      alternative.texto
                                    }
                                  </span>

                                  {selected && (
                                    <Check
                                      size={
                                        17
                                      }
                                    />
                                  )}
                                </button>
                              )
                            },
                          )}
                        </div>
                      ) : (
                        <textarea
                          className="student-answer-textarea"
                          value={
                            answer.respostaTexto
                          }
                          disabled={
                            readOnly
                          }
                          placeholder={
                            readOnly
                              ? 'Resposta enviada'
                              : 'Digite sua resposta...'
                          }
                          onChange={(
                            event,
                          ) =>
                            onTextChange(
                              exercise.id,
                              event
                                .target
                                .value,
                            )
                          }
                        />
                      )}
                    </div>
                  )
                },
              )}
            </div>

            {!readOnly &&
              exercises.length >
                0 && (
                <div className="student-activity-modal-footer">
                  <button
                    type="button"
                    className="student-secondary-button"
                    onClick={
                      onClose
                    }
                    disabled={
                      submitting
                    }
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    className="student-primary-button"
                    onClick={
                      onSubmit
                    }
                    disabled={
                      submitting
                    }
                  >
                    {submitting ? (
                      <>
                        <Loader2
                          size={17}
                          className="student-spin"
                        />

                        Enviando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2
                          size={17}
                        />

                        Enviar atividade
                      </>
                    )}
                  </button>
                </div>
              )}

            {readOnly && (
              <div className="student-activity-modal-footer">
                <button
                  type="button"
                  className="student-secondary-button"
                  onClick={
                    onClose
                  }
                >
                  Fechar
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

type ExerciseContentViewProps = {
  content: ExerciseContent
}

function ExerciseContentView({
  content,
}: ExerciseContentViewProps) {
  if (
    content.tipo ===
    'youtube'
  ) {
    const embedUrl =
      getYoutubeEmbedUrl(
        content.conteudo,
      )

    return (
      <div className="student-content-item">
        <div className="student-content-label">
          <Video size={16} />
          Vídeo
        </div>

        {embedUrl ? (
          <div className="student-video-wrapper">
            <iframe
              src={embedUrl}
              title="Vídeo da atividade"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : (
          <a
            href={
              content.conteudo
            }
            target="_blank"
            rel="noreferrer"
          >
            Assistir vídeo
          </a>
        )}
      </div>
    )
  }

  if (
    content.tipo ===
    'imagem'
  ) {
    return (
      <div className="student-content-item">
        <div className="student-content-label">
          <ImageIcon
            size={16}
          />
          Imagem
        </div>

        <img
          src={content.conteudo}
          alt="Material da atividade"
          className="student-activity-image"
        />
      </div>
    )
  }

  return (
    <div className="student-content-item">
      <div className="student-content-label">
        <FileText size={16} />
        Material
      </div>

      <div className="student-content-text">
        {content.conteudo}
      </div>
    </div>
  )
}

type ProgressoProps = {
  activities: Activity[]
}

function Progresso({
  activities,
}: ProgressoProps) {
  const completed =
    activities.filter(
      (activity) =>
        activity.status ===
          'corrigida' ||
        activity.status ===
          'respondida',
    ).length

  const total =
    activities.length

  const percentage =
    total > 0
      ? Math.round(
          (completed / total) *
            100,
        )
      : 0

  return (
    <>
      <div className="student-section-title">
        <div>
          <span>
            ACOMPANHAMENTO
          </span>

          <h2>
            Meu progresso
          </h2>
        </div>
      </div>

      <div className="student-progress-main-card">
        <div className="student-progress-main-value">
          <strong>
            {percentage}%
          </strong>

          <span>
            progresso geral
          </span>
        </div>

        <div className="student-progress-main-bar">
          <div
            className="student-progress-main-fill"
            style={{
              width: `${percentage}%`,
            }}
          />
        </div>

        <p>
          Seu progresso será
          atualizado conforme
          suas aulas e
          atividades forem
          realizadas.
        </p>
      </div>

      <div className="student-dashboard-grid">
        <div className="student-dashboard-card">
          <span>AULAS</span>

          <strong>0</strong>

          <p>
            Aulas realizadas.
          </p>
        </div>

        <div className="student-dashboard-card">
          <span>
            ATIVIDADES
          </span>

          <strong>
            {completed}
          </strong>

          <p>
            Atividades concluídas.
          </p>
        </div>

        <div className="student-dashboard-card">
          <span>
            ATIVIDADES TOTAIS
          </span>

          <strong>
            {total}
          </strong>

          <p>
            Atividades recebidas.
          </p>
        </div>
      </div>
    </>
  )
}

type PerfilProps = {
  user: User
  name: string
  avatar: string
}

function Perfil({
  user,
  name,
  avatar,
}: PerfilProps) {
  return (
    <>
      <div className="student-section-title">
        <div>
          <span>CONTA</span>

          <h2>
            Meu perfil
          </h2>
        </div>
      </div>

      <div className="student-profile-card">
        <div className="student-profile-header">
          {avatar ? (
            <img
              src={avatar}
              alt={name}
            />
          ) : (
            <div className="student-profile-avatar">
              {getInitials(name)}
            </div>
          )}

          <div>
            <h3>
              {name}
            </h3>

            <p>
              {user.email}
            </p>
          </div>
        </div>

        <div className="student-profile-fields">
          <div>
            <span>NOME</span>

            <strong>
              {name}
            </strong>
          </div>

          <div>
            <span>E-MAIL</span>

            <strong>
              {user.email}
            </strong>
          </div>
        </div>
      </div>
    </>
  )
}

export default Aluno