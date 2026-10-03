import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  LogOut,
  UserRound,
  BookOpen,
  ClipboardList,
  Users,
  LayoutDashboard,
  Clock3,
  Languages,
  Video,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  Circle,
  XCircle,
  ChevronRight,
  Loader2,
} from 'lucide-react'

import logo from '../assets/logo_abacademy.png'
import { supabase } from '../lib/supabase'
import '../styles/professor.css'
import '../styles/aluno.css'

import AtividadesAdmin from './admin/Atividades'
import MateriaisProfessor from './professor/Materiais'

type ProfessorData = {
  id: string
  user_id: string | null
  nome_completo: string
  email: string
  telefone: string | null
  ativo: boolean
  acesso_portal: boolean
}

type ProfessorIdioma = {
  idioma: 'ingles' | 'alemao'
}

type Horario = {
  id: string
  idioma: 'ingles' | 'alemao'
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  disponivel: boolean
  aluno_id: string | null
}

type Aluno = {
  id: string
  nome_completo: string
}

type Atividade = {
  id: string
  aluno_id: string
  titulo: string
  descricao: string | null
  idioma: 'ingles' | 'alemao'
  status: string
  prazo: string | null
  nota: number | null
  created_at: string
}

type RegistroAula = {
  id: string
  horario_id: string
  aluno_id: string
  professor_id: string
  data_aula: string
  status: 'agendada' | 'presente' | 'falta'
  data_aula_override?: string | null
  hora_inicio_override?: string | null
  hora_fim_override?: string | null
}

type PortalSection =
  | 'dashboard'
  | 'agenda'
  | 'aulas'
  | 'alunos'
  | 'atividades'
  | 'materiais'

const diasSemana = [
  { value: 1, label: 'Segunda-feira', short: 'SEG' },
  { value: 2, label: 'Terça-feira', short: 'TER' },
  { value: 3, label: 'Quarta-feira', short: 'QUA' },
  { value: 4, label: 'Quinta-feira', short: 'QUI' },
  { value: 5, label: 'Sexta-feira', short: 'SEX' },
  { value: 6, label: 'Sábado', short: 'SÁB' },
  { value: 0, label: 'Domingo', short: 'DOM' },
]

const statusLabels: Record<string, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  em_andamento: 'Em andamento',
  respondida: 'Respondida',
  em_correcao: 'Em correção',
  corrigida: 'Corrigida',
}

function Professor() {
  const [loading, setLoading] = useState(true)
  const [loginLoading, setLoginLoading] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)

  const [professor, setProfessor] =
    useState<ProfessorData | null>(null)

  const [idiomas, setIdiomas] =
    useState<ProfessorIdioma[]>([])

  const [horarios, setHorarios] =
    useState<Horario[]>([])

  const [alunos, setAlunos] =
    useState<Aluno[]>([])

  const [atividades, setAtividades] =
    useState<Atividade[]>([])

  const [registrosAulas, setRegistrosAulas] =
    useState<RegistroAula[]>([])

  // Mantém a disponibilidade de entrada na aula sincronizada com o relógio.
  const [currentTime, setCurrentTime] = useState(() => new Date())

  const [registroFaltaLoading, setRegistroFaltaLoading] =
    useState<string | null>(null)

  const [activeSection, setActiveSection] =
    useState<PortalSection>(() => {
      try {
        const saved = sessionStorage.getItem('abacademy_professor_section')
        if (
          saved === 'dashboard' ||
          saved === 'agenda' ||
          saved === 'aulas' ||
          saved === 'alunos' ||
          saved === 'atividades' ||
          saved === 'materiais'
        ) {
          return saved
        }
      } catch {
        // A indisponibilidade do storage nunca deve impedir o portal de abrir.
      }

      return 'dashboard'
    })

  const [email, setEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const loadingProfessorRef = useRef(false)

  /*
   * Mantém o estado de autenticação fora do closure do listener do
   * Supabase. O useEffect de autenticação é registrado uma única vez,
   * portanto ler "professor" diretamente dentro dele pode usar o valor
   * inicial (null) e provocar um novo carregamento quando o navegador
   * apenas sincroniza a sessão ao voltar para a aba.
   */
  const professorUserIdRef = useRef<string | null>(null)
  const initialAuthLoadFinishedRef = useRef(false)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date())
    }, 30_000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  /*
   * ============================================================
   * CARREGAR PROFESSOR
   * ============================================================
   */

  async function loadProfessor() {
    if (loadingProfessorRef.current) {
      return
    }

    loadingProfessorRef.current = true

    try {
      setLoading(true)
      setError('')

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        professorUserIdRef.current = null
        setProfessor(null)
        setIdiomas([])
        setHorarios([])
        setAlunos([])
        setAtividades([])

        return
      }

      const {
        data: professorData,
        error: professorError,
      } = await supabase
        .from('professores')
        .select(
          `
          id,
          user_id,
          nome_completo,
          email,
          telefone,
          ativo,
          acesso_portal
          `,
        )
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (professorError) {
        console.error(
          '[Professor] Erro ao carregar professor:',
          professorError,
        )

        setError(
          'Não foi possível carregar os dados do professor.',
        )

        setProfessor(null)

        return
      }

      if (!professorData) {
        await supabase.auth.signOut()

        setProfessor(null)

        setError(
          'Esta conta não está vinculada a um professor cadastrado.',
        )

        return
      }

      if (!professorData.ativo) {
        await supabase.auth.signOut()

        setProfessor(null)

        setError(
          'O cadastro deste professor está inativo.',
        )

        return
      }

      if (!professorData.acesso_portal) {
        await supabase.auth.signOut()

        setProfessor(null)

        setError(
          'O acesso ao portal deste professor está bloqueado.',
        )

        return
      }

      professorUserIdRef.current = session.user.id
      setProfessor(professorData)

      await loadProfessorData(professorData.id)
    } catch (err) {
      console.error(
        '[Professor] Erro ao carregar portal:',
        err,
      )

      setError(
        'Ocorreu um erro ao carregar o portal.',
      )

      setProfessor(null)
    } finally {
      setLoading(false)
      loadingProfessorRef.current = false
      initialAuthLoadFinishedRef.current = true
    }
  }

  /*
   * ============================================================
   * CARREGAR DADOS DO PROFESSOR
   * ============================================================
   *
   * ALUNOS:
   *
   * Agora são encontrados diretamente através de:
   *
   * alunos.professor_id = professor.id
   *
   * HORÁRIOS:
   *
   * Continuam sendo encontrados através de:
   *
   * horarios.professor_id = professor.id
   *
   * Dessa forma, o vínculo do aluno não depende mais
   * de existir um horário cadastrado.
   */

  async function loadProfessorData(
    professorId: string,
  ) {
    try {
      /*
       * ==========================================================
       * IDIOMAS, HORÁRIOS E ALUNOS EM PARALELO
       * ==========================================================
       */

      const [
        idiomasResult,
        horariosResult,
        alunosResult,
        registrosResult,
      ] = await Promise.all([
        /*
         * --------------------------------------------------------
         * IDIOMAS
         * --------------------------------------------------------
         */

        supabase
          .from('professor_idiomas')
          .select('idioma')
          .eq('professor_id', professorId)
          .order('idioma'),

        /*
         * --------------------------------------------------------
         * HORÁRIOS
         * --------------------------------------------------------
         */

        supabase
          .from('horarios')
          .select(
            `
            id,
            idioma,
            dia_semana,
            hora_inicio,
            hora_fim,
            disponivel,
            aluno_id
            `,
          )
          .eq('professor_id', professorId)
          .order('dia_semana', {
            ascending: true,
          })
          .order('hora_inicio', {
            ascending: true,
          }),

        /*
         * --------------------------------------------------------
         * ALUNOS VINCULADOS DIRETAMENTE
         * --------------------------------------------------------
         */

        supabase
          .from('alunos')
          .select(
            `
            id,
            nome_completo
            `,
          )
          .eq('professor_id', professorId)
          .order('nome_completo', {
            ascending: true,
          }),

        /*
         * --------------------------------------------------------
         * REGISTROS DE AULAS
         * --------------------------------------------------------
         */

        supabase
          .from('registros_aulas')
          .select(
            `
            id,
            horario_id,
            aluno_id,
            professor_id,
            data_aula,
            data_aula_override,
            hora_inicio_override,
            hora_fim_override,
            status
            `,
          )
          .eq('professor_id', professorId)
          .order('data_aula', {
            ascending: false,
          }),
      ])

      /*
       * ==========================================================
       * IDIOMAS
       * ==========================================================
       */

      if (idiomasResult.error) {
        console.error(
          '[Professor] Erro ao carregar idiomas:',
          idiomasResult.error,
        )

        setIdiomas([])
      } else {
        setIdiomas(
          (idiomasResult.data ??
            []) as ProfessorIdioma[],
        )
      }

      /*
       * ==========================================================
       * HORÁRIOS
       * ==========================================================
       */

      if (horariosResult.error) {
        console.error(
          '[Professor] Erro ao carregar horários:',
          horariosResult.error,
        )

        setHorarios([])
      } else {
        setHorarios(
          (horariosResult.data ??
            []) as Horario[],
        )
      }

      /*
       * ==========================================================
       * REGISTROS DE AULAS
       * ==========================================================
       */

      if (registrosResult.error) {
        console.error(
          '[Professor] Erro ao carregar registros de aulas:',
          registrosResult.error,
        )

        setRegistrosAulas([])
      } else {
        setRegistrosAulas(
          (registrosResult.data ??
            []) as RegistroAula[],
        )
      }

      /*
       * ==========================================================
       * ALUNOS
       * ==========================================================
       */

      if (alunosResult.error) {
        console.error(
          '[Professor] Erro ao carregar alunos vinculados:',
          alunosResult.error,
        )

        setAlunos([])
        setAtividades([])

        return
      }

      const alunosCarregados =
        (alunosResult.data ?? []) as Aluno[]

      setAlunos(alunosCarregados)

      /*
       * ==========================================================
       * IDS DOS ALUNOS
       * ==========================================================
       */

      const alunoIds =
        alunosCarregados
          .map((aluno) => aluno.id)
          .filter(
            (id): id is string =>
              typeof id === 'string' &&
              id.trim().length > 0,
          )

      /*
       * ==========================================================
       * NENHUM ALUNO VINCULADO
       * ==========================================================
       */

      if (alunoIds.length === 0) {
        setAtividades([])
        return
      }

      /*
       * ==========================================================
       * ATIVIDADES DOS ALUNOS
       * ==========================================================
       */

      const {
        data: atividadesData,
        error: atividadesError,
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
        .in('aluno_id', alunoIds)
        .neq('status', 'rascunho')
        .order('created_at', {
          ascending: false,
        })

      if (atividadesError) {
        console.error(
          '[Professor] Erro ao carregar atividades:',
          atividadesError,
        )

        setAtividades([])
      } else {
        setAtividades(
          (atividadesData ??
            []) as Atividade[],
        )
      }
    } catch (error) {
      console.error(
        '[Professor] Erro inesperado ao carregar dados:',
        error,
      )

      setIdiomas([])
      setHorarios([])
      setAlunos([])
      setAtividades([])
      setRegistrosAulas([])
    }
  }

  /*
   * ============================================================
   * AUTENTICAÇÃO
   * ============================================================
   */

  useEffect(() => {
    loadProfessor()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event) => {
        /*
         * O Supabase pode emitir SIGNED_IN novamente quando a sessão
         * é sincronizada ao retornar para uma aba que ficou em segundo
         * plano. Isso NÃO representa um novo login e não pode reconstruir
         * o Portal do Professor.
         *
         * SIGNED_IN só é tratado aqui quando ainda não existe um
         * professor carregado. Depois que o portal está autenticado,
         * a troca de abas não dispara nova consulta nem reset de estado.
         */
        if (event === 'SIGNED_IN') {
          /*
           * Primeiro login: carregar o portal.
           *
           * Sessão já conhecida: não fazer absolutamente nada. O
           * Supabase pode emitir SIGNED_IN novamente durante a
           * sincronização automática da sessão quando uma aba volta
           * a ficar ativa. Isso não é um novo login e não deve resetar
           * loading, consultas, seção ativa ou qualquer tarefa em curso.
           */
          if (loadingProfessorRef.current) {
            return
          }

          void supabase.auth.getSession().then(({ data }) => {
            const userId = data.session?.user?.id ?? null

            if (!userId) {
              return
            }

            if (
              initialAuthLoadFinishedRef.current &&
              professorUserIdRef.current === userId
            ) {
              return
            }

            void loadProfessor()
          })

          return
        }

        if (event === 'SIGNED_OUT') {
          professorUserIdRef.current = null
          setProfessor(null)
          setIdiomas([])
          setHorarios([])
          setAlunos([])
          setAtividades([])
          setRegistrosAulas([])
          setActiveSection('dashboard')

          try {
            sessionStorage.removeItem(
              'abacademy_professor_section',
            )
          } catch {
            // O logout continua funcionando sem sessionStorage.
          }
        }
      },
    )

    const handleVisibilityChange = () => {
      // Intencionalmente não chamamos loadProfessor() aqui.
      // O retorno à aba deve preservar a tarefa em andamento.
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  /*
   * ============================================================
   * LOGIN
   * ============================================================
   */

  async function handleLogin(
    event: React.FormEvent,
  ) {
    event.preventDefault()

    if (
      !email.trim() ||
      !password.trim()
    ) {
      setError(
        'Informe seu e-mail e sua senha.',
      )

      return
    }

    try {
      setLoginLoading(true)
      setError('')

      const {
        error: loginError,
      } = await supabase.auth.signInWithPassword(
        {
          email: email.trim(),
          password,
        },
      )

      if (loginError) {
        setError(
          'E-mail ou senha inválidos.',
        )

        return
      }

      setPassword('')

      /*
       * O evento SIGNED_IN do Supabase
       * fará o carregamento do portal.
       */
    } catch (err) {
      console.error(
        '[Professor] Erro no login:',
        err,
      )

      setError(
        'Não foi possível realizar o login.',
      )
    } finally {
      setLoginLoading(false)
    }
  }

  /*
   * ============================================================
   * LOGOUT
   * ============================================================
   */

  async function handleLogout() {
    try {
      setLogoutLoading(true)
      setError('')

      const { error: logoutError } = await supabase.auth.signOut()

      if (logoutError) {
        throw logoutError
      }

      professorUserIdRef.current = null
      setProfessor(null)
      setIdiomas([])
      setHorarios([])
      setAlunos([])
      setAtividades([])
      setActiveSection('dashboard')
    } catch (err) {
      console.error('[Professor] Erro ao sair do portal:', err)
      setError('Não foi possível sair do portal. Tente novamente.')
    } finally {
      setLogoutLoading(false)
    }
  }

  /*
   * ============================================================
   * HELPERS
   * ============================================================
   */

  function getIdiomaLabel(
    idioma: 'ingles' | 'alemao',
  ) {
    return idioma === 'ingles'
      ? 'Inglês'
      : 'Alemão'
  }

  function getDiaLabel(dia: number) {
    return (
      diasSemana.find(
        (item) => item.value === dia,
      )?.label ??
      'Dia não definido'
    )
  }

  function getDiaShort(dia: number) {
    return (
      diasSemana.find(
        (item) => item.value === dia,
      )?.short ?? '---'
    )
  }

  function getAlunoNome(
    alunoId: string | null,
  ) {
    if (!alunoId) {
      return 'Horário disponível'
    }

    return (
      alunos.find(
        (aluno) =>
          aluno.id === alunoId,
      )?.nome_completo ??
      'Aluno'
    )
  }

  function formatHour(value: string) {
    return value.slice(0, 5)
  }

  /*
   * ============================================================
   * PRÓXIMA AULA / REPOSIÇÕES
   * ============================================================
   *
   * Uma reposição não altera o dia da semana do horário original.
   * Ela é uma ocorrência excepcional registrada em
   * data_aula_override/hora_*_override.
   *
   * O portal precisa considerar:
   * 1. a ocorrência semanal normal;
   * 2. qualquer reposição futura ou em andamento;
   * 3. uma reposição como substituição da ocorrência original,
   *    evitando mostrar duas aulas para o mesmo horário.
   */

  function getDateKey(date: Date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')
  }

  function buildLessonDate(
    dateKey: string,
    time: string,
  ) {
    const [year, month, day] =
      dateKey.split('-').map(Number)
    const [hours, minutes] =
      time.slice(0, 5).split(':').map(Number)

    return new Date(
      year,
      month - 1,
      day,
      hours,
      minutes,
      0,
      0,
    )
  }

  function getLessonOccurrence(
    horario: Horario,
  ) {
    const now = currentTime
    const registros = registrosAulas.filter(
      (registro) =>
        registro.horario_id === horario.id,
    )

    const candidates: Array<{
      startAt: Date
      endAt: Date
      replacement: boolean
    }> = []

    const addCandidate = (
      dateKey: string,
      startTime: string,
      endTime: string,
      replacement: boolean,
    ) => {
      const startAt = buildLessonDate(
        dateKey,
        startTime,
      )
      const endAt = buildLessonDate(
        dateKey,
        endTime,
      )

      if (endAt.getTime() < startAt.getTime()) {
        endAt.setDate(endAt.getDate() + 1)
      }

      candidates.push({
        startAt,
        endAt,
        replacement,
      })
    }

    // Reposições têm prioridade e devem ser consideradas
    // independentemente do dia original da aula.
    registros.forEach((registro) => {
      if (
        registro.data_aula_override &&
        registro.hora_inicio_override &&
        registro.hora_fim_override
      ) {
        addCandidate(
          registro.data_aula_override,
          registro.hora_inicio_override,
          registro.hora_fim_override,
          true,
        )
      }
    })

    // Procura a ocorrência semanal atual e a próxima.
    // Quando existe uma reposição para aquela ocorrência,
    // a ocorrência normal é substituída pela reposição.
    for (let offset = 0; offset <= 7; offset += 1) {
      const date = new Date(now)
      date.setHours(0, 0, 0, 0)
      date.setDate(
        date.getDate() + offset,
      )

      if (
        date.getDay() !==
        horario.dia_semana
      ) {
        continue
      }

      const dateKey = getDateKey(date)
      const registroDaOcorrencia =
        registros.find(
          (registro) =>
            registro.data_aula ===
            dateKey,
        )

      if (
        registroDaOcorrencia?.data_aula_override
      ) {
        continue
      }

      addCandidate(
        dateKey,
        horario.hora_inicio,
        horario.hora_fim,
        false,
      )
    }

    const activeOrFuture =
      candidates
        .filter(
          (candidate) =>
            candidate.endAt.getTime() >=
            now.getTime(),
        )
        .sort(
          (a, b) =>
            a.startAt.getTime() -
            b.startAt.getTime(),
        )

    return (
      activeOrFuture[0] ??
      null
    )
  }

  function podeEntrarNaAula(
    horario: Horario,
  ) {
    const occurrence =
      getLessonOccurrence(horario)

    if (!occurrence) {
      return false
    }

    const accessStart =
      new Date(
        occurrence.startAt.getTime() -
          5 * 60 * 1000,
      )

    return (
      currentTime.getTime() >=
        accessStart.getTime() &&
      currentTime.getTime() <=
        occurrence.endAt.getTime()
    )
  }

  function getTodayDateKey() {
    return getDateKey(currentTime)
  }

  function getRegistroAulaAtual(
    horario: Horario,
  ) {
    const today =
      getTodayDateKey()

    return registrosAulas.find(
      (registro) =>
        registro.horario_id ===
          horario.id &&
        (
          registro.data_aula === today ||
          registro.data_aula_override ===
            today
        ),
    )
  }

  function hasAttendanceRegistered(
    horario: Horario,
  ) {
    const registro =
      getRegistroAulaAtual(horario)

    return (
      registro?.status === 'presente' ||
      registro?.status === 'falta'
    )
  }

  async function registrarFalta(
    horario: Horario,
  ) {
    if (
      !professor ||
      !horario.aluno_id
    ) {
      return
    }

    if (hasAttendanceRegistered(horario)) {
      return
    }

    const dataAula = getTodayDateKey()

    try {
      setRegistroFaltaLoading(horario.id)

      const { data, error } = await supabase
        .from('registros_aulas')
        .insert({
          horario_id: horario.id,
          aluno_id: horario.aluno_id,
          professor_id: professor.id,
          data_aula: dataAula,
          status: 'falta',
        })
        .select(
          `
          id,
          horario_id,
          aluno_id,
          professor_id,
          data_aula,
          status
          `,
        )
        .single()

      if (error) {
        if (error.code === '23505') {
          const { data: registroAtual } =
            await supabase
              .from('registros_aulas')
              .select(
                `
                id,
                horario_id,
                aluno_id,
                professor_id,
                data_aula,
                status
                `,
              )
              .eq('horario_id', horario.id)
              .eq('data_aula', dataAula)
              .maybeSingle()

          if (registroAtual) {
            setRegistrosAulas((current) => [
              registroAtual as RegistroAula,
              ...current.filter(
                (registro) =>
                  registro.id !==
                  registroAtual.id,
              ),
            ])
          }

          return
        }

        throw error
      }

      if (data) {
        setRegistrosAulas((current) => [
          data as RegistroAula,
          ...current,
        ])
      }
    } catch (error) {
      console.error(
        '[Professor] Erro ao registrar falta:',
        error,
      )

      window.alert(
        'Não foi possível registrar a falta. Tente novamente.',
      )
    } finally {
      setRegistroFaltaLoading(null)
    }
  }

  function getNextLesson(
    horario: Horario,
  ) {
    const occurrence =
      getLessonOccurrence(horario)

    if (occurrence) {
      return occurrence.startAt
    }

    // Fallback apenas para horários sem uma ocorrência futura
    // carregável no estado atual.
    const fallback = new Date(currentTime)
    fallback.setHours(0, 0, 0, 0)

    for (let offset = 0; offset <= 7; offset += 1) {
      const date = new Date(fallback)
      date.setDate(
        fallback.getDate() + offset,
      )

      if (
        date.getDay() ===
        horario.dia_semana
      ) {
        const dateKey = getDateKey(date)
        return buildLessonDate(
          dateKey,
          horario.hora_inicio,
        )
      }
    }

    return fallback
  }

  function formatNextLesson(
    horario: Horario,
  ) {
    return getNextLesson(
      horario,
    ).toLocaleDateString(
      'pt-BR',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      },
    )
  }

  function getNextLessonTime(
    horario: Horario,
  ) {
    return getNextLesson(
      horario,
    ).toLocaleTimeString(
      'pt-BR',
      {
        hour: '2-digit',
        minute: '2-digit',
      },
    )
  }

  /*
   * ============================================================
   * MEMOS
   * ============================================================
   */

  const horariosOcupados =
    useMemo(
      () =>
        horarios.filter(
          (horario) =>
            Boolean(
              horario.aluno_id,
            ),
        ),
      [horarios],
    )

  const horariosLivres =
    useMemo(
      () =>
        horarios.filter(
          (horario) =>
            !horario.aluno_id,
        ),
      [horarios],
    )

  const diasComAula =
    useMemo(
      () =>
        new Set(
          horariosOcupados.map(
            (horario) =>
              horario.dia_semana,
          ),
        ).size,
      [horariosOcupados],
    )

  const proximaAula =
    useMemo(() => {
      if (
        horariosOcupados.length ===
        0
      ) {
        return null
      }

      return [
        ...horariosOcupados,
      ].sort(
        (a, b) =>
          getNextLesson(
            a,
          ).getTime() -
          getNextLesson(
            b,
          ).getTime(),
      )[0]
    }, [horariosOcupados])

  const alunosComAulas =
    useMemo(() => {
      return alunos.map(
        (aluno) => {
          const alunoHorarios =
            horariosOcupados.filter(
              (horario) =>
                horario.aluno_id ===
                aluno.id,
            )

          const alunoAtividades =
            atividades.filter(
              (atividade) =>
                atividade.aluno_id ===
                aluno.id,
            )

          return {
            ...aluno,
            horarios:
              alunoHorarios,
            atividades:
              alunoAtividades,
          }
        },
      )
    }, [
      alunos,
      horariosOcupados,
      atividades,
    ])

  /*
   * ============================================================
   * NAVEGAÇÃO
   * ============================================================
   */

  function goTo(
    section: PortalSection,
  ) {
    setActiveSection(section)

    try {
      sessionStorage.setItem('abacademy_professor_section', section)
    } catch {
      // A navegação interna continua funcionando mesmo sem sessionStorage.
    }
  }

  /*
   * ============================================================
   * DASHBOARD
   * ============================================================
   */

  function renderDashboard() {
    return (
      <div className="professor-content professor-dashboard-page">
        <div className="professor-page-header">
          <div>
            <span className="professor-eyebrow">
              Portal do Professor
            </span>

            <h1>
              Olá,{' '}
              {professor?.nome_completo.split(
                ' ',
              )[0]}
              !
            </h1>

            <p>
              Acompanhe suas aulas,
              alunos e atividades em
              um só lugar.
            </p>
          </div>
        </div>

        <div className="professor-stats">
          <button
            className="professor-stat-card"
            onClick={() =>
              goTo('agenda')
            }
          >
            <div className="professor-stat-icon">
              <CalendarDays
                size={22}
              />
            </div>

            <div>
              <span>
                Horários cadastrados
              </span>

              <strong>
                {horarios.length}
              </strong>
            </div>
          </button>

          <button
            className="professor-stat-card"
            onClick={() =>
              goTo('alunos')
            }
          >
            <div className="professor-stat-icon">
              <Users size={22} />
            </div>

            <div>
              <span>Alunos</span>

              <strong>
                {alunos.length}
              </strong>
            </div>
          </button>

          <button
            className="professor-stat-card"
            onClick={() =>
              goTo('agenda')
            }
          >
            <div className="professor-stat-icon">
              <Clock3 size={22} />
            </div>

            <div>
              <span>
                Dias com aulas
              </span>

              <strong>
                {diasComAula}
              </strong>
            </div>
          </button>

          <button
            className="professor-stat-card"
            onClick={() =>
              goTo('atividades')
            }
          >
            <div className="professor-stat-icon">
              <ClipboardList
                size={22}
              />
            </div>

            <div>
              <span>
                Atividades
              </span>

              <strong>
                {atividades.length}
              </strong>
            </div>
          </button>
        </div>

        <div className="professor-dashboard-grid">
          <section className="professor-panel professor-next-lesson">
            <div className="professor-panel-header">
              <div>
                <span className="professor-eyebrow">
                  Próxima aula
                </span>

                <h2>Agenda</h2>
              </div>

              <CalendarDays size={20} />
            </div>

            {proximaAula ? (
              <div className="professor-next-lesson-card">
                <div className="professor-next-lesson-date">
                  <strong>
                    {getDiaShort(
                      proximaAula.dia_semana,
                    )}
                  </strong>

                  <span>
                    {formatNextLesson(
                      proximaAula,
                    )}
                  </span>
                </div>

                <div className="professor-next-lesson-info">
                  <strong>
                    {getAlunoNome(
                      proximaAula.aluno_id,
                    )}
                  </strong>

                  <span>
                    {getIdiomaLabel(
                      proximaAula.idioma,
                    )}
                  </span>

                  <span>
                    {getNextLessonTime(
                      proximaAula,
                    )}{' '}
                    às{' '}
                    {formatHour(
                      proximaAula.hora_fim,
                    )}
                  </span>
                </div>

                <button
                  type="button"
                  className="professor-primary-button"
                  onClick={() =>
                    goTo('aulas')
                  }
                >
                  Ver aula
                  <ArrowRight
                    size={17}
                  />
                </button>
              </div>
            ) : (
              <div className="professor-empty-state">
                <CalendarDays
                  size={36}
                />

                <strong>
                  Nenhuma aula
                  agendada
                </strong>

                <span>
                  Quando um aluno for
                  vinculado a um dos
                  seus horários, a
                  próxima aula
                  aparecerá aqui.
                </span>
              </div>
            )}
          </section>

          <section className="professor-panel">
            <div className="professor-panel-header">
              <div>
                <span className="professor-eyebrow">
                  Seus idiomas
                </span>

                <h2>
                  Disciplinas
                </h2>
              </div>

              <Languages size={20} />
            </div>

            {idiomas.length > 0 ? (
              <div className="professor-language-list">
                {idiomas.map(
                  (item) => (
                    <div
                      className="professor-language-item"
                      key={
                        item.idioma
                      }
                    >
                      <div className="professor-language-icon">
                        <Languages
                          size={19}
                        />
                      </div>

                      <div>
                        <strong>
                          {getIdiomaLabel(
                            item.idioma,
                          )}
                        </strong>

                        <span>
                          {
                            horarios.filter(
                              (
                                horario,
                              ) =>
                                horario.idioma ===
                                item.idioma,
                            ).length
                          }{' '}
                          horário(s)
                        </span>
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <div className="professor-empty-state small">
                <span>
                  Nenhum idioma
                  vinculado.
                </span>
              </div>
            )}
          </section>
        </div>

        <section className="professor-panel">
          <div className="professor-panel-header">
            <div>
              <span className="professor-eyebrow">
                Próximos horários
              </span>

              <h2>
                Minha semana
              </h2>
            </div>

            <button
              type="button"
              className="professor-link-button"
              onClick={() =>
                goTo('agenda')
              }
            >
              Ver agenda
              <ArrowRight size={16} />
            </button>
          </div>

          {horariosOcupados.length >
          0 ? (
            <div className="professor-schedule-list">
              {[
                ...horariosOcupados,
              ]
                .sort(
                  (a, b) =>
                    getNextLesson(
                      a,
                    ).getTime() -
                    getNextLesson(
                      b,
                    ).getTime(),
                )
                .slice(0, 5)
                .map(
                  (horario) => (
                    <div
                      className="professor-schedule-row"
                      key={
                        horario.id
                      }
                    >
                      <div className="professor-schedule-day">
                        <strong>
                          {getDiaShort(
                            horario.dia_semana,
                          )}
                        </strong>
                      </div>

                      <div className="professor-schedule-main">
                        <strong>
                          {getAlunoNome(
                            horario.aluno_id,
                          )}
                        </strong>

                        <span>
                          {getIdiomaLabel(
                            horario.idioma,
                          )}
                        </span>
                      </div>

                      <div className="professor-schedule-time">
                        <Clock3
                          size={16}
                        />

                        <span>
                          {formatHour(
                            horario.hora_inicio,
                          )}{' '}
                          -{' '}
                          {formatHour(
                            horario.hora_fim,
                          )}
                        </span>
                      </div>
                    </div>
                  ),
                )}
            </div>
          ) : (
            <div className="professor-empty-state">
              <CalendarDays
                size={36}
              />

              <strong>
                Nenhum horário
                ocupado
              </strong>
            </div>
          )}
        </section>
      </div>
    )
  }

  /*
   * ============================================================
   * AGENDA
   * ============================================================
   */

  function renderAgenda() {
    return (
      <div className="professor-content">
        <div className="professor-page-header">
          <div>
            <span className="professor-eyebrow">
              Organização
            </span>

            <h1>
              Minha Agenda
            </h1>

            <p>
              Visualize todos os
              horários atribuídos
              a você.
            </p>
          </div>
        </div>

        <div className="professor-stats">
          <div className="professor-stat-card static">
            <div className="professor-stat-icon">
              <CalendarDays
                size={22}
              />
            </div>

            <div>
              <span>
                Total de horários
              </span>

              <strong>
                {horarios.length}
              </strong>
            </div>
          </div>

          <div className="professor-stat-card static">
            <div className="professor-stat-icon">
              <Users size={22} />
            </div>

            <div>
              <span>Com aluno</span>

              <strong>
                {
                  horariosOcupados.length
                }
              </strong>
            </div>
          </div>

          <div className="professor-stat-card static">
            <div className="professor-stat-icon">
              <Circle size={22} />
            </div>

            <div>
              <span>
                Disponíveis
              </span>

              <strong>
                {horariosLivres.length}
              </strong>
            </div>
          </div>
        </div>

        <section className="professor-panel">
          <div className="professor-panel-header">
            <div>
              <span className="professor-eyebrow">
                Horários
              </span>

              <h2>
                Todos os horários
              </h2>
            </div>
          </div>

          {horarios.length > 0 ? (
            <div className="professor-agenda-list">
              {horarios.map(
                (horario) => (
                  <div
                    className="professor-agenda-card"
                    key={
                      horario.id
                    }
                  >
                    <div className="professor-agenda-day">
                      <strong>
                        {getDiaShort(
                          horario.dia_semana,
                        )}
                      </strong>

                      <span>
                        {getDiaLabel(
                          horario.dia_semana,
                        )}
                      </span>
                    </div>

                    <div className="professor-agenda-time">
                      <Clock3
                        size={18}
                      />

                      <strong>
                        {formatHour(
                          horario.hora_inicio,
                        )}{' '}
                        -{' '}
                        {formatHour(
                          horario.hora_fim,
                        )}
                      </strong>
                    </div>

                    <div className="professor-agenda-language">
                      <Languages
                        size={17}
                      />

                      <span>
                        {getIdiomaLabel(
                          horario.idioma,
                        )}
                      </span>
                    </div>

                    <div className="professor-agenda-student">
                      <UserRound
                        size={17}
                      />

                      <span>
                        {getAlunoNome(
                          horario.aluno_id,
                        )}
                      </span>
                    </div>

                    <div className="professor-agenda-status">
                      {horario.aluno_id ? (
                        <>
                          <CheckCircle2
                            size={16}
                          />

                          <span>
                            Aula
                            agendada
                          </span>
                        </>
                      ) : (
                        <>
                          <Circle
                            size={16}
                          />

                          <span>
                            Disponível
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          ) : (
            <div className="professor-empty-state">
              <CalendarDays
                size={40}
              />

              <strong>
                Nenhum horário
                encontrado
              </strong>

              <span>
                Você ainda não
                possui horários
                atribuídos.
              </span>
            </div>
          )}
        </section>
      </div>
    )
  }

  /*
   * ============================================================
   * AULAS
   * ============================================================
   */

  function renderAulas() {
    return (
      <div className="professor-content">
        <div className="professor-page-header">
          <div>
            <span className="professor-eyebrow">
              Ensino
            </span>

            <h1>
              Minhas Aulas
            </h1>

            <p>
              Acesse suas aulas e
              entre na sala virtual
              quando estiver
              disponível.
            </p>
          </div>
        </div>

        <section className="professor-panel">
          <div className="professor-panel-header">
            <div>
              <span className="professor-eyebrow">
                Aulas agendadas
              </span>

              <h2>
                {
                  horariosOcupados.length
                }{' '}
                aula(s)
              </h2>
            </div>

            <BookOpen size={20} />
          </div>

          {horariosOcupados.length >
          0 ? (
            <div className="professor-class-list">
              {[
                ...horariosOcupados,
              ]
                .sort(
                  (a, b) =>
                    getNextLesson(
                      a,
                    ).getTime() -
                    getNextLesson(
                      b,
                    ).getTime(),
                )
                .map(
                  (horario) => (
                    <div
                      className="professor-class-card"
                      key={
                        horario.id
                      }
                    >
                      <div className="professor-class-icon">
                        <Video
                          size={22}
                        />
                      </div>

                      <div className="professor-class-info">
                        <strong>
                          {getAlunoNome(
                            horario.aluno_id,
                          )}
                        </strong>

                        <span>
                          {getIdiomaLabel(
                            horario.idioma,
                          )}
                        </span>

                        <span>
                          {getNextLesson(horario).toLocaleDateString('pt-BR')}{' '}
                          •{' '}
                          {getNextLesson(horario).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{' '}
                          -{' '}
                          {(() => {
                            const occurrence = getLessonOccurrence(horario)
                            return occurrence
                              ? occurrence.endAt.toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : formatHour(horario.hora_fim)
                          })()}
                        </span>

                        <small>
                          Próxima aula:{' '}
                          {formatNextLesson(
                            horario,
                          )}{' '}
                          às{' '}
                          {getNextLessonTime(
                            horario,
                          )}
                        </small>
                      </div>

                      <div className="professor-class-actions">
                        <button
                          type="button"
                          className="professor-primary-button"
                          onClick={() => {
                            if (!podeEntrarNaAula(horario)) {
                              return
                            }

                            window.location.href =
                              `/professor/aula/${horario.id}`
                          }}
                          disabled={
                            !podeEntrarNaAula(horario) ||
                            hasAttendanceRegistered(horario)
                          }
                        >
                          <Video
                            size={17}
                          />

                          Entrar na aula
                        </button>

                        <button
                          type="button"
                          className="professor-secondary-button professor-absence-button"
                          onClick={() => {
                            void registrarFalta(horario)
                          }}
                          disabled={
                            hasAttendanceRegistered(horario) ||
                            registroFaltaLoading ===
                              horario.id
                          }
                        >
                          <XCircle
                            size={17}
                          />

                          {registroFaltaLoading ===
                          horario.id
                            ? 'Registrando...'
                            : getRegistroAulaAtual(
                                  horario,
                                )?.status === 'falta'
                              ? 'Falta registrada'
                              : 'Registrar Falta'}
                        </button>
                      </div>
                    </div>
                  ),
                )}
            </div>
          ) : (
            <div className="professor-empty-state">
              <Video size={40} />

              <strong>
                Nenhuma aula
                agendada
              </strong>

              <span>
                Quando um horário
                receber um aluno, a
                aula aparecerá aqui.
              </span>
            </div>
          )}
        </section>
      </div>
    )
  }

  /*
   * ============================================================
   * ALUNOS
   * ============================================================
   */

  function renderAlunos() {
    return (
      <div className="professor-content">
        <div className="professor-page-header">
          <div>
            <span className="professor-eyebrow">
              Turmas
            </span>

            <h1>
              Meus Alunos
            </h1>

            <p>
              Alunos vinculados
              diretamente ao seu
              perfil de professor.
            </p>
          </div>
        </div>

        <section className="professor-panel">
          <div className="professor-panel-header">
            <div>
              <span className="professor-eyebrow">
                Alunos vinculados
              </span>

              <h2>
                {alunos.length} aluno(s)
              </h2>
            </div>

            <Users size={20} />
          </div>

          {alunosComAulas.length >
          0 ? (
            <div className="professor-student-grid">
              {alunosComAulas.map(
                (aluno) => {
                  const idiomasAluno =
                    [
                      ...new Set(
                        aluno.horarios.map(
                          (
                            horario,
                          ) =>
                            getIdiomaLabel(
                              horario.idioma,
                            ),
                        ),
                      ),
                    ]

                  return (
                    <div
                      className="professor-student-card"
                      key={
                        aluno.id
                      }
                    >
                      <div className="professor-student-avatar">
                        <UserRound
                          size={22}
                        />
                      </div>

                      <div className="professor-student-content">
                        <strong>
                          {
                            aluno.nome_completo
                          }
                        </strong>

                        <span>
                          {idiomasAluno.join(
                            ' • ',
                          ) ||
                            'Nenhuma aula cadastrada'}
                        </span>

                        <div className="professor-student-meta">
                          <span>
                            {
                              aluno
                                .horarios
                                .length
                            }{' '}
                            horário(s)
                          </span>

                          <span>
                            {
                              aluno
                                .atividades
                                .length
                            }{' '}
                            atividade(s)
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                },
              )}
            </div>
          ) : (
            <div className="professor-empty-state">
              <Users size={40} />

              <strong>
                Nenhum aluno
                vinculado
              </strong>

              <span>
                Os alunos aparecerão
                aqui quando forem
                associados diretamente
                ao seu perfil pelo
                administrador.
              </span>
            </div>
          )}
        </section>
      </div>
    )
  }

  /*
   * ============================================================
   * ATIVIDADES
   * ============================================================
   */

  function renderAtividades() {
    return (
      <div className="professor-content">

        <section className="professor-panel">
          <div className="professor-panel-header">
            <div>
              <span className="professor-eyebrow">
                Atividades dos
                alunos
              </span>

              <h2>
                {atividades.length}{' '}
                atividade(s)
              </h2>
            </div>

            <ClipboardList
              size={20}
            />
          </div>

          {atividades.length > 0 ? (
            <div className="professor-activity-list">
              {atividades.map(
                (atividade) => (
                  <div
                    className="professor-activity-card"
                    key={
                      atividade.id
                    }
                  >
                    <div className="professor-activity-icon">
                      <ClipboardList
                        size={21}
                      />
                    </div>

                    <div className="professor-activity-info">
                      <strong>
                        {
                          atividade.titulo
                        }
                      </strong>

                      <span>
                        {getAlunoNome(
                          atividade.aluno_id,
                        )}
                      </span>

                      <span>
                        {getIdiomaLabel(
                          atividade.idioma,
                        )}
                      </span>

                      {atividade.descricao && (
                        <p>
                          {
                            atividade.descricao
                          }
                        </p>
                      )}
                    </div>

                    <div className="professor-activity-status">
                      <span>
                        {statusLabels[
                          atividade.status
                        ] ??
                          atividade.status}
                      </span>

                      {atividade.nota !==
                        null && (
                        <strong>
                          Nota:{' '}
                          {
                            atividade.nota
                          }
                        </strong>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          ) : (
            <div className="professor-empty-state">
              <ClipboardList
                size={40}
              />

              <strong>
                Nenhuma atividade
                encontrada
              </strong>

              <span>
                As atividades dos
                seus alunos
                aparecerão aqui.
              </span>
            </div>
          )}
        </section>
      </div>
    )
  }

  /*
   * ============================================================
   * CONTEÚDO
   * ============================================================
   */

  function renderContent() {
  switch (activeSection) {
    case 'dashboard':
      return renderDashboard()

    case 'agenda':
      return renderAgenda()

    case 'aulas':
      return renderAulas()

    case 'alunos':
      return renderAlunos()

    case 'atividades':
      return <AtividadesAdmin professorMode />

    case 'materiais':
      return <MateriaisProfessor professorId={professor!.id} />

    default:
      return renderDashboard()
  }
}

  /*
   * ============================================================
   * LOADING
   * ============================================================
   */

  if (loading) {
    return (
      <div className="professor-loading-page">
        <div className="professor-loading-card">
          <div className="professor-loading-spinner" />

          <span>
            Carregando portal...
          </span>
        </div>
      </div>
    )
  }

  /*
   * ============================================================
   * LOGIN
   * ============================================================
   */

  if (!professor) {
    return (
      <div className="student-login-page">
        <div className="student-login-card">
          <div className="student-login-brand-panel">
            <img
              src={logo}
              alt="AB Academy"
              className="student-login-logo"
            />
            <div className="student-login-brand-copy">
              <strong>AB ACADEMY</strong>
              <span>IDIOMAS QUE TRANSFORMAM</span>
              <span>CONEXÕES QUE PERMANECEM</span>
            </div>
          </div>

          <div className="student-login-form-area">

          <span className="student-login-label">
            PORTAL DO PROFESSOR
          </span>

          <h1>
            Acesse sua conta
          </h1>

          <p>
            Informe o e-mail utilizado para
            acessar o portal do professor.
          </p>

          <form onSubmit={handleLogin}>
            <div className="student-login-field">
              <label htmlFor="professor-email">
                E-mail
              </label>

              <input
                id="professor-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setError('')
                }}
                placeholder="seu@email.com"
                autoComplete="email"
                disabled={loginLoading}
              />
            </div>

            <div className="student-login-field">
              <label htmlFor="professor-password">
                Senha
              </label>

              <input
                id="professor-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setError('')
                }}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                disabled={loginLoading}
              />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Visualizar senha'}
                  aria-pressed={showPassword}
                  title={showPassword ? 'Ocultar senha' : 'Visualizar senha'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>

            {error && (
              <div className="student-login-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="student-primary-button student-auth-button"
              disabled={loginLoading}
            >
              {loginLoading ? (
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
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="student-login-footer">
            <span>
              AB Academy
            </span>

            <span>
              Portal exclusivo para professores
            </span>
          </div>
          </div>
        </div>
      </div>
    )
  }

  /*
   * ============================================================
   * PORTAL
   * ============================================================
   */

  return (
    <div className="professor-portal">
      <header className="professor-header">
        <div className="professor-header-brand">
          <div className="professor-brand-icon">
            <BookOpen size={22} />
          </div>

          <div>
            <strong>
              AB Academy
            </strong>

            <span>
              Portal do Professor
            </span>
          </div>
        </div>

        <div className="professor-header-user">
          <div className="professor-header-user-info">
            <strong>
              {
                professor.nome_completo
              }
            </strong>

            <span>
              {professor.email}
            </span>
          </div>

          <div className="professor-header-avatar">
            <UserRound size={20} />
          </div>

          <button
            type="button"
            className="professor-logout-button"
            onClick={
              handleLogout
            }
            disabled={
              logoutLoading
            }
            title="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="professor-body">
        <aside className="professor-sidebar">
          <nav className="professor-nav">
            <button
              type="button"
              className={
                activeSection ===
                'dashboard'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                goTo('dashboard')
              }
            >
              <LayoutDashboard
                size={19}
              />

              <span>
                Dashboard
              </span>
            </button>

            <button
              type="button"
              className={
                activeSection ===
                'agenda'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                goTo('agenda')
              }
            >
              <CalendarDays
                size={19}
              />

              <span>
                Minha Agenda
              </span>
            </button>

            <button
              type="button"
              className={
                activeSection ===
                'aulas'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                goTo('aulas')
              }
            >
              <Video size={19} />

              <span>
                Minhas Aulas
              </span>
            </button>

            <button
              type="button"
              className={
                activeSection ===
                'alunos'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                goTo('alunos')
              }
            >
              <Users size={19} />

              <span>
                Meus Alunos
              </span>
            </button>

            <button
              type="button"
              className={
                activeSection ===
                'materiais'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                goTo('materiais')
              }
            >
              <BookOpen size={19} />

              <span>
                Materiais
              </span>
            </button>

            <button
              type="button"
              className={
                activeSection ===
                'atividades'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                goTo('atividades')
              }
            >
              <ClipboardList
                size={19}
              />

              <span>
                Atividades
              </span>
            </button>
          </nav>

          <div className="professor-sidebar-footer">
            <div>
              <span>
                Professor
              </span>

              <strong>
                {
                  professor.nome_completo
                }
              </strong>
            </div>

            <button
              type="button"
              onClick={
                handleLogout
              }
              disabled={
                logoutLoading
              }
            >
              <LogOut size={17} />
              Sair
            </button>
          </div>
        </aside>

        <main className="professor-main">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

export default Professor