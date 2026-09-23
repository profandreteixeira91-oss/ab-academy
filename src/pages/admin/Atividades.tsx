import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  Eye,
  FileText,
  Image,
  Languages,
  Link,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
  UserRound,
  Video,
  X,
} from 'lucide-react'

import { supabase } from '../../lib/supabase'
import '../../styles/admin/Atividades.css'

type Idioma = 'ingles' | 'alemao'

type StatusAtividade =
  | 'rascunho'
  | 'enviada'
  | 'em_andamento'
  | 'respondida'
  | 'em_correcao'
  | 'corrigida'

type TipoExercicio =
  | 'multipla_escolha'
  | 'multipla_resposta'
  | 'verdadeiro_falso'
  | 'dissertativa'
  | 'resposta_curta'
  | 'lacunas'
  | 'ordenar'
  | 'associar'

type TipoConteudo = 'texto' | 'youtube' | 'imagem'

type Aluno = {
  id: string
  nome_completo: string
  email: string
  idioma: Idioma
}

type AlternativaForm = {
  id: string
  texto: string
  correta: boolean
  ordem: number
  isNew?: boolean
}

type ConteudoForm = {
  id: string
  tipo: TipoConteudo
  conteudo: string
  ordem: number
  isNew?: boolean
}

type ExercicioForm = {
  id: string
  tipo: TipoExercicio
  titulo: string
  enunciado: string
  ordem: number
  pontuacao: number
  alternativas: AlternativaForm[]
  conteudos: ConteudoForm[]
  isNew?: boolean
}

type AtividadeForm = {
  aluno_id: string
  titulo: string
  descricao: string
  idioma: Idioma
  prazo: string
  exercicios: ExercicioForm[]
}

type AtividadeLista = {
  id: string
  aluno_id: string
  titulo: string
  descricao: string | null
  idioma: Idioma
  status: StatusAtividade
  prazo: string | null
  nota: number | null
  created_at: string
  updated_at: string
  aluno?: {
    nome_completo: string
  } | null
}

type CorrecaoResposta = {
  id: string
  exercicio_id: string
  resposta_texto: string | null
  alternativa_id: string | null
  pontuacao: number | null
  feedback: string | null
  corrigida: boolean
}

type CorrecaoExercicio = {
  id: string
  tipo: TipoExercicio
  titulo: string | null
  enunciado: string
  ordem: number
  pontuacao: number
  alternativas: AlternativaForm[]
  conteudos: ConteudoForm[]
  resposta: CorrecaoResposta | null
}

const statusLabels: Record<StatusAtividade, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  em_andamento: 'Em andamento',
  respondida: 'Respondida',
  em_correcao: 'Em correção',
  corrigida: 'Corrigida',
}

const tipoExercicioLabels: Record<TipoExercicio, string> = {
  multipla_escolha: 'Múltipla escolha',
  multipla_resposta: 'Múltiplas respostas',
  verdadeiro_falso: 'Verdadeiro ou falso',
  dissertativa: 'Dissertativa',
  resposta_curta: 'Resposta curta',
  lacunas: 'Completar lacunas',
  ordenar: 'Ordenar',
  associar: 'Associar',
}

const tipoConteudoLabels: Record<TipoConteudo, string> = {
  texto: 'Texto',
  youtube: 'Vídeo do YouTube',
  imagem: 'Imagem',
}

function createId() {
  return crypto.randomUUID()
}

function createEmptyAlternativa(ordem = 0): AlternativaForm {
  return {
    id: createId(),
    texto: '',
    correta: false,
    ordem,
    isNew: true,
  }
}

function createEmptyConteudo(
  tipo: TipoConteudo = 'texto',
  ordem = 0,
): ConteudoForm {
  return {
    id: createId(),
    tipo,
    conteudo: '',
    ordem,
    isNew: true,
  }
}

function createEmptyExercicio(ordem = 0): ExercicioForm {
  return {
    id: createId(),
    tipo: 'multipla_escolha',
    titulo: '',
    enunciado: '',
    ordem,
    pontuacao: 1,
    alternativas: [
      createEmptyAlternativa(0),
      createEmptyAlternativa(1),
      createEmptyAlternativa(2),
      createEmptyAlternativa(3),
    ],
    conteudos: [],
    isNew: true,
  }
}

function createEmptyForm(): AtividadeForm {
  return {
    aluno_id: '',
    titulo: '',
    descricao: '',
    idioma: 'ingles',
    prazo: '',
    exercicios: [createEmptyExercicio(0)],
  }
}

function formatDateTime(value: string | null) {
  if (!value) return 'Sem prazo'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function getStatusClass(status: StatusAtividade) {
  return `atividades-status atividades-status-${status}`
}

function getYoutubeEmbedUrl(value: string) {
  try {
    const url = new URL(value)

    if (url.hostname.includes('youtube.com')) {
      const videoId = url.searchParams.get('v')

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
      const id = url.pathname.replace('/', '').split('/')[0]

      if (id) {
        return `https://www.youtube.com/embed/${id}`
      }
    }
  } catch {
    return ''
  }

  return ''
}

function isObjectiveType(tipo: TipoExercicio) {
  return (
    tipo === 'multipla_escolha' ||
    tipo === 'multipla_resposta' ||
    tipo === 'verdadeiro_falso'
  )
}

function isSingleCorrectType(tipo: TipoExercicio) {
  return (
    tipo === 'multipla_escolha' ||
    tipo === 'verdadeiro_falso'
  )
}

function normalizeNumber(value: unknown) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return 0
  }

  return number
}

function formatScore(value: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })
}

type ActivityEditData = {
  id: string
  aluno_id: string
  titulo: string
  descricao: string | null
  idioma: Idioma
  prazo: string | null
}

type ActivityEditAlternative = {
  id: string
  texto: string
  correta: boolean
  ordem: number
}

type ActivityEditContent = {
  id: string
  tipo: TipoConteudo
  conteudo: string
  ordem: number
}

type ActivityEditExercise = {
  id: string
  tipo: TipoExercicio
  titulo: string | null
  enunciado: string
  ordem: number
  pontuacao: number
  alternativas: ActivityEditAlternative[] | null
  conteudos: ActivityEditContent[] | null
}

type ActivityEditQueryResult = {
  id: string
  tipo: TipoExercicio
  titulo: string | null
  enunciado: string
  ordem: number
  pontuacao: number
  alternativas: ActivityEditAlternative[] | null
  conteudos: ActivityEditContent[] | null
}

async function fetchActivityEditData(id: string) {
  const {
    data: atividade,
    error: atividadeError,
  } = await supabase
    .from('atividades')
    .select(`
      id,
      aluno_id,
      titulo,
      descricao,
      idioma,
      prazo,
      status
    `)
    .eq('id', id)
    .single()

  if (atividadeError || !atividade) {
    throw new Error(
      `Não foi possível carregar a atividade: ${
        atividadeError?.message || 'atividade não encontrada'
      }`,
    )
  }

  const {
    data: exercicios,
    error: exerciciosError,
  } = await supabase
    .from('atividade_exercicios')
    .select(`
      id,
      tipo,
      titulo,
      enunciado,
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
    `)
    .eq('atividade_id', id)
    .order('ordem', {
      ascending: true,
    })

  if (exerciciosError) {
    throw new Error(
      `Não foi possível carregar os exercícios: ${exerciciosError.message}`,
    )
  }

  return {
    atividade: atividade as unknown as ActivityEditData,
    exercicios: (exercicios || []) as unknown as ActivityEditQueryResult[],
  }
}

function mapActivityEditExercises(
  exercicios: ActivityEditQueryResult[],
): ExercicioForm[] {
  return exercicios.map((exercicio) => ({
    id: exercicio.id,
    tipo: exercicio.tipo,
    titulo: exercicio.titulo || '',
    enunciado: exercicio.enunciado || '',
    ordem: exercicio.ordem ?? 0,
    pontuacao: Number(exercicio.pontuacao ?? 1),
    isNew: false,
    alternativas: (exercicio.alternativas || [])
      .slice()
      .sort((a, b) => a.ordem - b.ordem)
      .map((alternativa) => ({
        id: alternativa.id,
        texto: alternativa.texto,
        correta: alternativa.correta,
        ordem: alternativa.ordem,
        isNew: false,
      })),
    conteudos: (exercicio.conteudos || [])
      .slice()
      .sort((a, b) => a.ordem - b.ordem)
      .map((conteudo) => ({
        id: conteudo.id,
        tipo: conteudo.tipo,
        conteudo: conteudo.conteudo,
        ordem: conteudo.ordem,
        isNew: false,
      })),
  }))
}

function createEditActivityForm(
  atividade: ActivityEditData,
  exercicios: ExercicioForm[],
): AtividadeForm {
  const finalExercises =
    exercicios.length > 0
      ? exercicios
      : [createEmptyExercicio(0)]

  return {
    aluno_id: atividade.aluno_id,
    titulo: atividade.titulo,
    descricao: atividade.descricao || '',
    idioma: atividade.idioma,
    prazo: atividade.prazo
      ? new Date(atividade.prazo).toISOString().slice(0, 16)
      : '',
    exercicios: finalExercises,
  }
}

type ProfessorContext = {
  userId: string
  professorId: string | null
  isAdmin: boolean
}

async function loadProfessorContext(): Promise<ProfessorContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: adminUser, error: adminError } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (adminError) {
    throw new Error(
      `Não foi possível verificar o acesso administrativo: ${adminError.message}`,
    )
  }

  const { data: professor, error: professorError } = await supabase
    .from('professores')
    .select('id')
    .eq('user_id', user.id)
    .eq('ativo', true)
    .eq('acesso_portal', true)
    .maybeSingle()

  if (professorError) {
    throw new Error(
      `Não foi possível verificar o professor: ${professorError.message}`,
    )
  }

  if (!adminUser && !professor) {
    return null
  }

  return {
    userId: user.id,
    professorId: professor?.id ?? null,
    isAdmin: Boolean(adminUser),
  }
}

async function fetchAtividades(professorId: string | null) {
  let query = supabase
    .from('atividades')
    .select(`
      id,
      aluno_id,
      titulo,
      descricao,
      idioma,
      status,
      prazo,
      nota,
      created_at,
      updated_at,
      aluno:alunos (
        nome_completo
      )
    `)
    .order('created_at', { ascending: false })

  if (professorId) {
    const { data: alunosProfessor, error: alunosError } =
      await supabase
        .from('alunos')
        .select('id')
        .eq('professor_id', professorId)

    if (alunosError) throw alunosError
    const alunoIds = (alunosProfessor || []).map(
      (aluno) => aluno.id,
    )

    if (alunoIds.length === 0) return []
    query = query.in('aluno_id', alunoIds)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []) as unknown as AtividadeLista[]
}

export default function Atividades({
  professorMode = false,
}: {
  professorMode?: boolean
}) {
  const [atividades, setAtividades] = useState<AtividadeLista[]>([])
  const [alunos, setAlunos] = useState<Aluno[]>([])

  const [loading, setLoading] = useState(true)
  const [loadingAlunos, setLoadingAlunos] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'todos' | StatusAtividade
  >('todos')

  const filteredAtividades = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()

    return atividades.filter((atividade) => {
      const matchesStatus =
        statusFilter === 'todos' || atividade.status === statusFilter
      const studentName = atividade.aluno?.nome_completo || ''
      const matchesSearch =
        !normalizedSearch ||
        atividade.titulo.toLocaleLowerCase().includes(normalizedSearch) ||
        studentName.toLocaleLowerCase().includes(normalizedSearch)

      return matchesStatus && matchesSearch
    })
  }, [atividades, search, statusFilter])

  const [showBuilder, setShowBuilder] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AtividadeForm>(
    createEmptyForm(),
  )

  const [expandedExercises, setExpandedExercises] = useState<string[]>([])

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  /* =========================================================
     CORREÇÃO
  ========================================================= */

  const [showCorrection, setShowCorrection] = useState(false)
  const [correctionLoading, setCorrectionLoading] = useState(false)
  const [correctionSaving, setCorrectionSaving] = useState(false)

  const [correctionActivity, setCorrectionActivity] =
    useState<AtividadeLista | null>(null)

  const [correctionExercises, setCorrectionExercises] =
    useState<CorrecaoExercicio[]>([])

  const [correctionError, setCorrectionError] = useState('')
  const [correctionSuccess, setCorrectionSuccess] = useState('')

  const [correctionScores, setCorrectionScores] = useState<
    Record<string, number>
  >({})

  const [correctionFeedbacks, setCorrectionFeedbacks] = useState<
    Record<string, string>
  >({})

  const [correctionExpanded, setCorrectionExpanded] = useState<
    string[]
  >([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const results = await Promise.allSettled([
      loadAtividades(),
      loadAlunos(),
    ])

    const rejected = results.find(
      (result): result is PromiseRejectedResult =>
        result.status === 'rejected',
    )

    if (rejected) {
      console.error(rejected.reason)
      setError(
        'Ocorreu um erro inesperado ao carregar os dados.',
      )
    }
  }

  async function loadAtividades() {
  try {
    setLoading(true)
    setError('')

    const professorContext = await loadProfessorContext()

    if (!professorContext) {
      setIsAdmin(false)
      setAtividades([])
      return
    }

    setIsAdmin(professorContext.isAdmin)

    try {
      const atividadesProfessorId =
        professorMode
          ? professorContext.professorId
          : professorContext.isAdmin
            ? null
            : professorContext.professorId

      setAtividades(
        await fetchAtividades(atividadesProfessorId),
      )
    } catch (loadError) {
      console.error('Erro ao carregar atividades:', loadError)
      const message =
        loadError instanceof Error
          ? loadError.message
          : 'erro desconhecido'
      setError(
        `Não foi possível carregar as atividades: ${message}`,
      )
    }
  } catch (err) {
    console.error(err)

    setError(
      'Ocorreu um erro inesperado ao carregar as atividades.',
    )
  } finally {
    setLoading(false)
  }
}

    async function loadAlunos() {
  try {
    setLoadingAlunos(true)

    const professorContext = await loadProfessorContext()

    if (!professorContext) {
      setAlunos([])
      return
    }

    setIsAdmin(professorContext.isAdmin)

    let query = supabase
      .from('alunos')
      .select(`
        id,
        nome_completo,
        email,
        idioma
      `)
      .order('nome_completo', {
        ascending: true,
      })

    // No portal do professor, mostrar somente os alunos
    // vinculados ao professor autenticado.
    // No painel administrativo, administradores continuam vendo todos.
    if (professorMode) {
      if (!professorContext.professorId) {
        setAlunos([])
        return
      }

      query = query.eq(
        'professor_id',
        professorContext.professorId,
      )
    } else if (!professorContext.isAdmin && professorContext.professorId) {
      query = query.eq(
        'professor_id',
        professorContext.professorId,
      )
    }

    const { data, error: loadError } =
      await query

    if (loadError) {
      console.error(
        'Erro ao carregar alunos:',
        loadError,
      )

      setError(
        `Não foi possível carregar os alunos: ${loadError.message}`,
      )

      return
    }

    setAlunos((data || []) as Aluno[])
  } catch (err) {
    console.error(err)

    setError(
      'Ocorreu um erro inesperado ao carregar os alunos.',
    )
  } finally {
    setLoadingAlunos(false)
  }
}

  /* =========================================================
     BUILDER
  ========================================================= */

  function resetBuilder() {
    const newForm = createEmptyForm()

    setForm(newForm)
    setEditingId(null)

    setExpandedExercises([
      newForm.exercicios[0].id,
    ])

    setError('')
    setSuccess('')
    setShowPreview(false)
  }

  function openNewActivity() {
    resetBuilder()
    setShowBuilder(true)
  }

  async function openEditActivity(id: string) {
    try {
      setError('')
      setSuccess('')
      setSaving(true)

      const { atividade, exercicios } =
        await fetchActivityEditData(id)
      const mappedExercises = mapActivityEditExercises(
        exercicios,
      )
      const editForm = createEditActivityForm(
        atividade,
        mappedExercises,
      )

      setForm(editForm)
      setEditingId(atividade.id)
      setExpandedExercises([editForm.exercicios[0].id])
      setShowBuilder(true)
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Ocorreu um erro ao abrir a atividade.',
      )
    } finally {
      setSaving(false)
    }
  }

  function closeBuilder() {
    if (saving) return

    setShowBuilder(false)
    setShowPreview(false)
    setError('')
    setSuccess('')
  }

  function updateForm<K extends keyof AtividadeForm>(
    field: K,
    value: AtividadeForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function addExercise() {
    const newExercise =
      createEmptyExercicio(
        form.exercicios.length,
      )

    setForm((current) => ({
      ...current,
      exercicios: [
        ...current.exercicios,
        {
          ...newExercise,
          ordem: current.exercicios.length,
        },
      ],
    }))

    setExpandedExercises((current) => [
      ...current,
      newExercise.id,
    ])
  }

  function removeExercise(id: string) {
    if (form.exercicios.length === 1) {
      setError(
        'A atividade precisa ter pelo menos um exercício.',
      )

      return
    }

    setForm((current) => ({
      ...current,
      exercicios: current.exercicios
        .filter(
          (exercise) =>
            exercise.id !== id,
        )
        .map((exercise, index) => ({
          ...exercise,
          ordem: index,
        })),
    }))

    setExpandedExercises((current) =>
      current.filter(
        (exerciseId) =>
          exerciseId !== id,
      ),
    )
  }

  function duplicateExercise(id: string) {
    const exerciseIndex =
      form.exercicios.findIndex(
        (exercise) =>
          exercise.id === id,
      )

    if (exerciseIndex === -1) return

    const source =
      form.exercicios[exerciseIndex]

    const duplicated: ExercicioForm = {
      ...source,

      id: createId(),

      titulo: source.titulo
        ? `${source.titulo} (cópia)`
        : '',

      alternativas:
        source.alternativas.map(
          (alternative, index) => ({
            ...alternative,
            id: createId(),
            ordem: index,
            isNew: true,
          }),
        ),

      conteudos:
        source.conteudos.map(
          (content, index) => ({
            ...content,
            id: createId(),
            ordem: index,
            isNew: true,
          }),
        ),

      ordem: exerciseIndex + 1,
      isNew: true,
    }

    const exercises = [
      ...form.exercicios,
    ]

    exercises.splice(
      exerciseIndex + 1,
      0,
      duplicated,
    )

    setForm((current) => ({
      ...current,
      exercicios:
        exercises.map(
          (exercise, index) => ({
            ...exercise,
            ordem: index,
          }),
        ),
    }))

    setExpandedExercises((current) => [
      ...current,
      duplicated.id,
    ])
  }

  function moveExercise(
    id: string,
    direction: 'up' | 'down',
  ) {
    const index =
      form.exercicios.findIndex(
        (exercise) =>
          exercise.id === id,
      )

    if (index === -1) return

    const targetIndex =
      direction === 'up'
        ? index - 1
        : index + 1

    if (
      targetIndex < 0 ||
      targetIndex >=
        form.exercicios.length
    ) {
      return
    }

    const exercises = [
      ...form.exercicios,
    ]

    const [moved] =
      exercises.splice(index, 1)

    exercises.splice(
      targetIndex,
      0,
      moved,
    )

    setForm((current) => ({
      ...current,
      exercicios:
        exercises.map(
          (exercise, index) => ({
            ...exercise,
            ordem: index,
          }),
        ),
    }))
  }

  function toggleExercise(id: string) {
    setExpandedExercises((current) =>
      current.includes(id)
        ? current.filter(
            (exerciseId) =>
              exerciseId !== id,
          )
        : [...current, id],
    )
  }

  function updateExercise<K extends keyof ExercicioForm>(
    exerciseId: string,
    field: K,
    value: ExercicioForm[K],
  ) {
    setForm((current) => ({
      ...current,
      exercicios:
        current.exercicios.map(
          (exercise) =>
            exercise.id === exerciseId
              ? {
                  ...exercise,
                  [field]: value,
                }
              : exercise,
        ),
    }))
  }

  function changeExerciseType(
    exerciseId: string,
    tipo: TipoExercicio,
  ) {
    setForm((current) => ({
      ...current,

      exercicios:
        current.exercicios.map(
          (exercise) => {
            if (
              exercise.id !==
              exerciseId
            ) {
              return exercise
            }

            if (
              tipo ===
              'verdadeiro_falso'
            ) {
              return {
                ...exercise,
                tipo,
                alternativas: [
                  {
                    ...createEmptyAlternativa(
                      0,
                    ),
                    texto:
                      'Verdadeiro',
                  },
                  {
                    ...createEmptyAlternativa(
                      1,
                    ),
                    texto: 'Falso',
                  },
                ],
              }
            }

            if (
              tipo ===
                'multipla_escolha' ||
              tipo ===
                'multipla_resposta'
            ) {
              const alternatives =
                exercise.alternativas
                  .length >= 2
                  ? exercise.alternativas
                  : [
                      createEmptyAlternativa(
                        0,
                      ),
                      createEmptyAlternativa(
                        1,
                      ),
                      createEmptyAlternativa(
                        2,
                      ),
                      createEmptyAlternativa(
                        3,
                      ),
                    ]

              return {
                ...exercise,
                tipo,
                alternativas: alternatives,
              }
            }

            return {
              ...exercise,
              tipo,
              alternativas: [],
            }
          },
        ),
    }))
  }

  function addAlternative(
    exerciseId: string,
  ) {
    setForm((current) => ({
      ...current,

      exercicios:
        current.exercicios.map(
          (exercise) =>
            exercise.id ===
            exerciseId
              ? {
                  ...exercise,
                  alternativas: [
                    ...exercise.alternativas,
                    createEmptyAlternativa(
                      exercise
                        .alternativas
                        .length,
                    ),
                  ],
                }
              : exercise,
        ),
    }))
  }

  function removeAlternative(
    exerciseId: string,
    alternativeId: string,
  ) {
    setForm((current) => ({
      ...current,

      exercicios:
        current.exercicios.map(
          (exercise) => {
            if (
              exercise.id !==
              exerciseId
            ) {
              return exercise
            }

            if (
              exercise.alternativas
                .length <= 2
            ) {
              return exercise
            }

            return {
              ...exercise,

              alternativas:
                exercise.alternativas
                  .filter(
                    (alternative) =>
                      alternative.id !==
                      alternativeId,
                  )
                  .map(
                    (
                      alternative,
                      index,
                    ) => ({
                      ...alternative,
                      ordem: index,
                    }),
                  ),
            }
          },
        ),
    }))
  }

  function updateAlternative<K extends keyof AlternativaForm>(
    exerciseId: string,
    alternativeId: string,
    field: K,
    value: AlternativaForm[K],
  ) {
    setForm((current) => ({
      ...current,

      exercicios:
        current.exercicios.map(
          (exercise) => {
            if (
              exercise.id !==
              exerciseId
            ) {
              return exercise
            }

            return {
              ...exercise,

              alternativas:
                exercise.alternativas.map(
                  (alternative) =>
                    alternative.id ===
                    alternativeId
                      ? {
                          ...alternative,
                          [field]: value,
                        }
                      : alternative,
                ),
            }
          },
        ),
    }))
  }

  function setCorrectAlternative(
    exerciseId: string,
    alternativeId: string,
  ) {
    setForm((current) => ({
      ...current,

      exercicios:
        current.exercicios.map(
          (exercise) => {
            if (
              exercise.id !==
              exerciseId
            ) {
              return exercise
            }

            if (
              exercise.tipo ===
              'multipla_resposta'
            ) {
              return {
                ...exercise,

                alternativas:
                  exercise.alternativas.map(
                    (alternative) =>
                      alternative.id ===
                      alternativeId
                        ? {
                            ...alternative,
                            correta:
                              !alternative.correta,
                          }
                        : alternative,
                  ),
              }
            }

            return {
              ...exercise,

              alternativas:
                exercise.alternativas.map(
                  (alternative) => ({
                    ...alternative,
                    correta:
                      alternative.id ===
                      alternativeId,
                  }),
                ),
            }
          },
        ),
    }))
  }

  function addContent(
    exerciseId: string,
    tipo: TipoConteudo,
  ) {
    const content =
      createEmptyConteudo(tipo)

    setForm((current) => ({
      ...current,

      exercicios:
        current.exercicios.map(
          (exercise) =>
            exercise.id ===
            exerciseId
              ? {
                  ...exercise,

                  conteudos: [
                    ...exercise.conteudos,
                    {
                      ...content,
                      ordem:
                        exercise
                          .conteudos
                          .length,
                    },
                  ],
                }
              : exercise,
        ),
    }))
  }

  function removeContent(
    exerciseId: string,
    contentId: string,
  ) {
    setForm((current) => ({
      ...current,

      exercicios:
        current.exercicios.map(
          (exercise) =>
            exercise.id ===
            exerciseId
              ? {
                  ...exercise,

                  conteudos:
                    exercise.conteudos
                      .filter(
                        (content) =>
                          content.id !==
                          contentId,
                      )
                      .map(
                        (
                          content,
                          index,
                        ) => ({
                          ...content,
                          ordem: index,
                        }),
                      ),
                }
              : exercise,
        ),
    }))
  }

  function updateContent(
    exerciseId: string,
    contentId: string,
    field: keyof ConteudoForm,
    value: any,
  ) {
    setForm((current) => ({
      ...current,

      exercicios:
        current.exercicios.map(
          (exercise) =>
            exercise.id ===
            exerciseId
              ? {
                  ...exercise,

                  conteudos:
                    exercise.conteudos.map(
                      (content) =>
                        content.id ===
                        contentId
                          ? {
                              ...content,
                              [field]:
                                value,
                            }
                          : content,
                    ),
                }
              : exercise,
        ),
    }))
  }

  function validateForm() {
    if (!form.aluno_id) {
      setError(
        'Selecione o aluno da atividade.',
      )

      return false
    }

    if (!form.titulo.trim()) {
      setError(
        'Informe o título da atividade.',
      )

      return false
    }

    if (!form.exercicios.length) {
      setError(
        'Adicione pelo menos um exercício.',
      )

      return false
    }

    for (
      let index = 0;
      index < form.exercicios.length;
      index++
    ) {
      const exercise =
        form.exercicios[index]

      if (!exercise.enunciado.trim()) {
        setError(
          `Informe o enunciado do exercício ${
            index + 1
          }.`,
        )

        return false
      }

      if (exercise.pontuacao <= 0) {
        setError(
          `A pontuação do exercício ${
            index + 1
          } deve ser maior que zero.`,
        )

        return false
      }

      if (
        isObjectiveType(
          exercise.tipo,
        )
      ) {
        if (
          exercise.alternativas
            .length < 2
        ) {
          setError(
            `O exercício ${
              index + 1
            } precisa ter pelo menos duas alternativas.`,
          )

          return false
        }

        const emptyAlternative =
          exercise.alternativas.some(
            (alternative) =>
              !alternative.texto.trim(),
          )

        if (emptyAlternative) {
          setError(
            `Preencha todas as alternativas do exercício ${
              index + 1
            }.`,
          )

          return false
        }

        const correctCount =
          exercise.alternativas.filter(
            (alternative) =>
              alternative.correta,
          ).length

        if (correctCount === 0) {
          setError(
            `Defina pelo menos uma resposta correta no exercício ${
              index + 1
            }.`,
          )

          return false
        }

        if (
          isSingleCorrectType(
            exercise.tipo,
          ) &&
          correctCount > 1
        ) {
          setError(
            `O exercício ${
              index + 1
            } deve ter apenas uma resposta correta.`,
          )

          return false
        }
      }

      for (const content of exercise.conteudos) {
        if (!content.conteudo.trim()) {
          setError(
            `Preencha o conteúdo complementar do exercício ${
              index + 1
            }.`,
          )

          return false
        }

        if (
          content.tipo ===
          'youtube'
        ) {
          if (
            !getYoutubeEmbedUrl(
              content.conteudo,
            )
          ) {
            setError(
              `O endereço do YouTube no exercício ${
                index + 1
              } não é válido.`,
            )

            return false
          }
        }
      }
    }

    return true
  }

  async function getAuthenticatedProfessorId() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    throw userError
  }

  if (!user) {
    throw new Error(
      'Usuário não autenticado. Faça login novamente.',
    )
  }

  const {
    data: professor,
    error: professorError,
  } = await supabase
    .from('professores')
    .select('id')
    .eq('user_id', user.id)
    .eq('ativo', true)
    .eq('acesso_portal', true)
    .maybeSingle()

  if (professorError) {
    throw professorError
  }

  if (!professor) {
    throw new Error(
      'Professor não encontrado ou sem acesso ao portal.',
    )
  }

  return professor.id
}

  async function saveAlternatives(
    exerciseId: string,
    alternatives: AlternativaForm[],
  ) {
    if (!alternatives.length) return

    const payload = alternatives.map(
      (alternative, index) => ({
        exercicio_id: exerciseId,
        texto: alternative.texto.trim(),
        correta: alternative.correta,
        ordem: index,
      }),
    )

    const { error } = await supabase
      .from('exercicio_alternativas')
      .insert(payload)

    if (error) throw error
  }

  async function syncAlternatives(
    exerciseId: string,
    alternatives: AlternativaForm[],
  ) {
    const {
      error: deleteError,
    } = await supabase
      .from('exercicio_alternativas')
      .delete()
      .eq('exercicio_id', exerciseId)

    if (deleteError) {
      throw deleteError
    }

    await saveAlternatives(
      exerciseId,
      alternatives,
    )
  }

  async function saveContents(
    exerciseId: string,
    contents: ConteudoForm[],
  ) {
    if (!contents.length) return

    const payload = contents.map(
      (content, index) => ({
        exercicio_id: exerciseId,
        tipo: content.tipo,
        conteudo:
          content.conteudo.trim(),
        ordem: index,
      }),
    )

    const { error } = await supabase
      .from('exercicio_conteudos')
      .insert(payload)

    if (error) throw error
  }

  async function syncContents(
    exerciseId: string,
    contents: ConteudoForm[],
  ) {
    const {
      error: deleteError,
    } = await supabase
      .from('exercicio_conteudos')
      .delete()
      .eq('exercicio_id', exerciseId)

    if (deleteError) {
      throw deleteError
    }

    await saveContents(
      exerciseId,
      contents,
    )
  }

  async function saveActivity(
    status: StatusAtividade,
  ) {
    setError('')
    setSuccess('')

    if (!validateForm()) return

    setSaving(true)

    try {
      const professorId =
        await getAuthenticatedProfessorId()

      const prazo = form.prazo
        ? new Date(
            form.prazo,
          ).toISOString()
        : null

      let atividadeId = editingId

      if (atividadeId) {
        const {
          error: updateError,
        } = await supabase
          .from('atividades')
          .update({
            professor_id: professorId,
            aluno_id: form.aluno_id,
            titulo:
              form.titulo.trim(),
            descricao:
              form.descricao.trim() ||
              null,
            idioma: form.idioma,
            status,
            prazo,
            updated_at:
              new Date().toISOString(),
          })
          .eq('id', atividadeId)

        if (updateError) {
          throw updateError
        }

        const {
          data: existingExercises,
          error: existingError,
        } = await supabase
          .from('atividade_exercicios')
          .select('id')
          .eq(
            'atividade_id',
            atividadeId,
          )

        if (existingError) {
          throw existingError
        }

        const currentExerciseIds =
          form.exercicios
            .filter(
              (exercise) =>
                exercise.isNew !== true,
            )
            .map(
              (exercise) =>
                exercise.id,
            )

        const exerciseIdsToDelete = (
          existingExercises || []
        )
          .map(
            (exercise) =>
              exercise.id,
          )
          .filter(
            (id) =>
              !currentExerciseIds.includes(
                id,
              ),
          )

        if (
          exerciseIdsToDelete.length >
          0
        ) {
          const {
            error: deleteError,
          } = await supabase
            .from(
              'atividade_exercicios',
            )
            .delete()
            .in(
              'id',
              exerciseIdsToDelete,
            )

          if (deleteError) {
            throw deleteError
          }
        }
      } else {
        const {
          data: insertedActivityId,
          error: insertError,
        } = await supabase.rpc(
          'criar_atividade_professor',
          {
            p_professor_id: professorId,
            p_aluno_id: form.aluno_id,
            p_titulo: form.titulo.trim(),
            p_descricao:
              form.descricao.trim() ||
              null,
            p_idioma: form.idioma,
            p_status: status,
            p_prazo: prazo,
          },
        )

        if (insertError) {
          throw insertError
        }

        if (!insertedActivityId) {
          throw new Error(
            'Não foi possível identificar a atividade criada.',
          )
        }

        atividadeId = insertedActivityId
      }

      if (!atividadeId) {
        throw new Error(
          'Não foi possível identificar a atividade.',
        )
      }

      for (
        let index = 0;
        index < form.exercicios.length;
        index++
      ) {
        const exercise =
          form.exercicios[index]

        let exerciseId =
          exercise.id

        const existingExercise =
          exercise.isNew !== true

        if (existingExercise) {
          const {
            error:
              updateExerciseError,
          } = await supabase
            .from(
              'atividade_exercicios',
            )
            .update({
              tipo: exercise.tipo,
              titulo:
                exercise.titulo.trim() ||
                null,
              enunciado:
                exercise.enunciado.trim(),
              ordem: index,
              pontuacao:
                exercise.pontuacao,
              updated_at:
                new Date().toISOString(),
            })
            .eq(
              'id',
              exercise.id,
            )

          if (
            updateExerciseError
          ) {
            throw updateExerciseError
          }

          await syncAlternatives(
            exercise.id,
            exercise.alternativas,
          )

          await syncContents(
            exercise.id,
            exercise.conteudos,
          )
        } else {
          const {
            data:
              insertedExercise,
            error:
              insertExerciseError,
          } = await supabase
            .from(
              'atividade_exercicios',
            )
            .insert({
              atividade_id:
                atividadeId,
              tipo: exercise.tipo,
              titulo:
                exercise.titulo.trim() ||
                null,
              enunciado:
                exercise.enunciado.trim(),
              ordem: index,
              pontuacao:
                exercise.pontuacao,
            })
            .select('id')
            .single()

          if (
            insertExerciseError
          ) {
            throw insertExerciseError
          }

          exerciseId =
            insertedExercise.id

          await saveAlternatives(
            exerciseId,
            exercise.alternativas,
          )

          await saveContents(
            exerciseId,
            exercise.conteudos,
          )
        }
      }

      await loadAtividades()

      setSuccess(
        status === 'rascunho'
          ? 'Atividade salva como rascunho.'
          : 'Atividade enviada para o aluno com sucesso.',
      )

      setShowBuilder(false)
    } catch (err: any) {
      console.error(
        'Erro ao salvar atividade:',
        err,
      )

      setError(
        err?.message ||
          'Não foi possível salvar a atividade.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function duplicateActivity(
    id: string,
  ) {
    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const professorId =
        await getAuthenticatedProfessorId()

      const {
        data: activity,
        error: activityError,
      } = await supabase
        .from('atividades')
        .select(`
          aluno_id,
          titulo,
          descricao,
          idioma,
          prazo
        `)
        .eq('id', id)
        .single()

      if (
        activityError ||
        !activity
      ) {
        throw (
          activityError ||
          new Error(
            'Atividade não encontrada.',
          )
        )
      }

      const {
        data: inserted,
        error: insertError,
      } = await supabase
        .from('atividades')
        .insert({
          professor_id:
            professorId,
          aluno_id:
            activity.aluno_id,
          titulo: `${activity.titulo} (cópia)`,
          descricao:
            activity.descricao,
          idioma:
            activity.idioma,
          status: 'rascunho',
          prazo:
            activity.prazo,
        })
        .select('id')
        .single()

      if (insertError) {
        throw insertError
      }

      const {
        data: exercises,
        error: exercisesError,
      } = await supabase
        .from('atividade_exercicios')
        .select(`
          id,
          tipo,
          titulo,
          enunciado,
          ordem,
          pontuacao,
          alternativas:exercicio_alternativas (
            texto,
            correta,
            ordem
          ),
          conteudos:exercicio_conteudos (
            tipo,
            conteudo,
            ordem
          )
        `)
        .eq(
          'atividade_id',
          id,
        )
        .order('ordem', {
          ascending: true,
        })

      if (exercisesError) {
        throw exercisesError
      }

      for (
        const exercise of
        exercises || []
      ) {
        const {
          data:
            insertedExercise,
          error:
            exerciseError,
        } = await supabase
          .from(
            'atividade_exercicios',
          )
          .insert({
            atividade_id:
              inserted.id,
            tipo:
              exercise.tipo,
            titulo:
              exercise.titulo,
            enunciado:
              exercise.enunciado,
            ordem:
              exercise.ordem,
            pontuacao:
              exercise.pontuacao,
          })
          .select('id')
          .single()

        if (exerciseError) {
          throw exerciseError
        }

        if (
          exercise.alternativas
            ?.length
        ) {
          const {
            error:
              alternativeError,
          } = await supabase
            .from(
              'exercicio_alternativas',
            )
            .insert(
              exercise.alternativas.map(
                (
                  alternative: any,
                ) => ({
                  exercicio_id:
                    insertedExercise.id,
                  texto:
                    alternative.texto,
                  correta:
                    alternative.correta,
                  ordem:
                    alternative.ordem,
                }),
              ),
            )

          if (alternativeError) {
            throw alternativeError
          }
        }

        if (
          exercise.conteudos
            ?.length
        ) {
          const {
            error:
              contentError,
          } = await supabase
            .from(
              'exercicio_conteudos',
            )
            .insert(
              exercise.conteudos.map(
                (content: any) => ({
                  exercicio_id:
                    insertedExercise.id,
                  tipo:
                    content.tipo,
                  conteudo:
                    content.conteudo,
                  ordem:
                    content.ordem,
                }),
              ),
            )

          if (contentError) {
            throw contentError
          }
        }
      }

      await loadAtividades()

      setSuccess(
        'Atividade duplicada como rascunho.',
      )
    } catch (err: any) {
      console.error(err)

      setError(
        err?.message ||
          'Não foi possível duplicar a atividade.',
      )
    } finally {
      setSaving(false)
    }
  }

  /* =========================================================
     CORREÇÃO DA ATIVIDADE
  ========================================================= */

  function getSelectedAlternativeIds(
    answer: CorrecaoResposta | null,
  ) {
    if (!answer) return []

    const ids: string[] = []

    if (answer.alternativa_id) {
      ids.push(answer.alternativa_id)
    }

    if (answer.resposta_texto) {
      try {
        const parsed = JSON.parse(
          answer.resposta_texto,
        )

        if (Array.isArray(parsed)) {
          for (const id of parsed) {
            if (
              typeof id === 'string' &&
              !ids.includes(id)
            ) {
              ids.push(id)
            }
          }
        }
      } catch {
        // resposta textual normal
      }
    }

    return ids
  }

  function getStudentTextAnswer(
    answer: CorrecaoResposta | null,
  ) {
    if (!answer?.resposta_texto) {
      return ''
    }

    try {
      const parsed = JSON.parse(
        answer.resposta_texto,
      )

      if (Array.isArray(parsed)) {
        return ''
      }
    } catch {
      // resposta textual normal
    }

    return answer.resposta_texto
  }

  function isObjectiveAnswerCorrect(
    exercise: CorrecaoExercicio,
  ) {
    if (!exercise.resposta) {
      return false
    }

    const selectedIds =
      getSelectedAlternativeIds(
        exercise.resposta,
      )

    if (!selectedIds.length) {
      return false
    }

    const correctIds =
      exercise.alternativas
        .filter(
          (alternative) =>
            alternative.correta,
        )
        .map(
          (alternative) =>
            alternative.id,
        )

    if (!correctIds.length) {
      return false
    }

    const selectedSet = new Set(
      selectedIds,
    )

    const correctSet = new Set(
      correctIds,
    )

    if (
      selectedSet.size !==
      correctSet.size
    ) {
      return false
    }

    for (const id of correctSet) {
      if (!selectedSet.has(id)) {
        return false
      }
    }

    return true
  }

  function calculateObjectiveScore(
    exercise: CorrecaoExercicio,
  ) {
    return isObjectiveAnswerCorrect(
      exercise,
    )
      ? exercise.pontuacao
      : 0
  }

  async function openCorrection(
    activity: AtividadeLista,
  ) {
    try {
      setCorrectionError('')
      setCorrectionSuccess('')
      setCorrectionActivity(activity)
      setCorrectionExercises([])
      setCorrectionScores({})
      setCorrectionFeedbacks({})
      setCorrectionExpanded([])
      setShowCorrection(true)
      setCorrectionLoading(true)

      const {
        data: exercises,
        error: exercisesError,
      } = await supabase
        .from('atividade_exercicios')
        .select(`
          id,
          tipo,
          titulo,
          enunciado,
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
        `)
        .eq(
          'atividade_id',
          activity.id,
        )
        .order('ordem', {
          ascending: true,
        })

      if (exercisesError) {
        throw exercisesError
      }

      const {
        data: answers,
        error: answersError,
      } = await supabase
        .from('respostas_aluno')
        .select(`
          id,
          exercicio_id,
          resposta_texto,
          alternativa_id,
          pontuacao,
          feedback,
          corrigida
        `)
        .eq(
          'atividade_id',
          activity.id,
        )
        .eq(
          'aluno_id',
          activity.aluno_id,
        )

      if (answersError) {
        throw answersError
      }

      const answerMap = new Map<
        string,
        CorrecaoResposta
      >()

      ;(answers || []).forEach(
        (answer: any) => {
          answerMap.set(
            answer.exercicio_id,
            {
              id: answer.id,
              exercicio_id:
                answer.exercicio_id,
              resposta_texto:
                answer.resposta_texto,
              alternativa_id:
                answer.alternativa_id,
              pontuacao:
                answer.pontuacao !== null
                  ? Number(
                      answer.pontuacao,
                    )
                  : null,
              feedback:
                answer.feedback,
              corrigida:
                Boolean(
                  answer.corrigida,
                ),
            },
          )
        },
      )

      const mappedExercises: CorrecaoExercicio[] =
        (exercises || []).map(
          (exercise: any) => ({
            id: exercise.id,
            tipo: exercise.tipo,
            titulo:
              exercise.titulo || null,
            enunciado:
              exercise.enunciado || '',
            ordem:
              exercise.ordem ?? 0,
            pontuacao: Number(
              exercise.pontuacao ?? 0,
            ),

            alternativas: (
              exercise.alternativas || []
            )
              .sort(
                (
                  a: any,
                  b: any,
                ) =>
                  a.ordem -
                  b.ordem,
              )
              .map(
                (
                  alternative: any,
                ) => ({
                  id: alternative.id,
                  texto:
                    alternative.texto,
                  correta:
                    Boolean(
                      alternative.correta,
                    ),
                  ordem:
                    alternative.ordem,
                }),
              ),

            conteudos: (
              exercise.conteudos || []
            )
              .sort(
                (
                  a: any,
                  b: any,
                ) =>
                  a.ordem -
                  b.ordem,
              )
              .map(
                (
                  content: any,
                ) => ({
                  id: content.id,
                  tipo: content.tipo,
                  conteudo:
                    content.conteudo,
                  ordem:
                    content.ordem,
                }),
              ),

            resposta:
              answerMap.get(
                exercise.id,
              ) || null,
          }),
        )

      setCorrectionExercises(
        mappedExercises,
      )

      const initialScores: Record<
        string,
        number
      > = {}

      const initialFeedbacks: Record<
        string,
        string
      > = {}

      mappedExercises.forEach(
        (exercise) => {
          if (
            isObjectiveType(
              exercise.tipo,
            )
          ) {
            initialScores[
              exercise.id
            ] =
              exercise.resposta
                ?.pontuacao !== null &&
              exercise.resposta
                ?.pontuacao !==
                undefined
                ? Number(
                    exercise.resposta
                      .pontuacao,
                  )
                : calculateObjectiveScore(
                    exercise,
                  )
          } else {
            initialScores[
              exercise.id
            ] =
              exercise.resposta
                ?.pontuacao !== null &&
              exercise.resposta
                ?.pontuacao !==
                undefined
                ? Number(
                    exercise.resposta
                      .pontuacao,
                  )
                : 0
          }

          initialFeedbacks[
            exercise.id
          ] =
            exercise.resposta
              ?.feedback || ''
        },
      )

      setCorrectionScores(
        initialScores,
      )

      setCorrectionFeedbacks(
        initialFeedbacks,
      )

      if (mappedExercises.length) {
        setCorrectionExpanded([
          mappedExercises[0].id,
        ])
      }
    } catch (err: any) {
      console.error(
        'Erro ao carregar correção:',
        err,
      )

      setCorrectionError(
        err?.message ||
          'Não foi possível carregar as respostas da atividade.',
      )
    } finally {
      setCorrectionLoading(false)
    }
  }

  function closeCorrection() {
    if (correctionSaving) return

    setShowCorrection(false)
    setCorrectionActivity(null)
    setCorrectionExercises([])
    setCorrectionScores({})
    setCorrectionFeedbacks({})
    setCorrectionExpanded([])
    setCorrectionError('')
    setCorrectionSuccess('')
  }

  function updateCorrectionScore(
    exercise: CorrecaoExercicio,
    value: string,
  ) {
    let score = Number(value)

    if (!Number.isFinite(score)) {
      score = 0
    }

    score = Math.max(
      0,
      Math.min(
        exercise.pontuacao,
        score,
      ),
    )

    setCorrectionScores(
      (current) => ({
        ...current,
        [exercise.id]: score,
      }),
    )
  }

  function updateCorrectionFeedback(
    exerciseId: string,
    value: string,
  ) {
    setCorrectionFeedbacks(
      (current) => ({
        ...current,
        [exerciseId]: value,
      }),
    )
  }

  function toggleCorrectionExercise(
    id: string,
  ) {
    setCorrectionExpanded(
      (current) =>
        current.includes(id)
          ? current.filter(
              (exerciseId) =>
                exerciseId !== id,
            )
          : [...current, id],
    )
  }

  function getCorrectionTotal() {
    return correctionExercises.reduce(
      (total, exercise) =>
        total +
        Math.max(
          0,
          Math.min(
            exercise.pontuacao,
            normalizeNumber(
              correctionScores[
                exercise.id
              ],
            ),
          ),
        ),
      0,
    )
  }

  function getCorrectionMaxTotal() {
    return correctionExercises.reduce(
      (total, exercise) =>
        total + exercise.pontuacao,
      0,
    )
  }

  function getCorrectedCount() {
    return correctionExercises.filter(
      (exercise) =>
        Boolean(
          exercise.resposta
            ?.corrigida,
        ),
    ).length
  }

  async function saveCorrection() {
    if (!correctionActivity) {
      return
    }

    setCorrectionError('')
    setCorrectionSuccess('')

    if (!correctionExercises.length) {
      setCorrectionError(
        'Esta atividade não possui exercícios.',
      )

      return
    }

    const unanswered =
      correctionExercises.filter(
        (exercise) =>
          !exercise.resposta,
      )

    if (unanswered.length > 0) {
      setCorrectionError(
        `Existem ${unanswered.length} exercício(s) sem resposta registrada pelo aluno.`,
      )

      return
    }

    for (const exercise of correctionExercises) {
      const score =
        normalizeNumber(
          correctionScores[
            exercise.id
          ],
        )

      if (
        score < 0 ||
        score > exercise.pontuacao
      ) {
        setCorrectionError(
          `A pontuação do exercício ${
            exercise.ordem + 1
          } deve ficar entre 0 e ${formatScore(
            exercise.pontuacao,
          )}.`,
        )

        return
      }
    }

    setCorrectionSaving(true)

    try {
      for (const exercise of correctionExercises) {
        if (!exercise.resposta) {
          continue
        }

        const score = Math.max(
          0,
          Math.min(
            exercise.pontuacao,
            normalizeNumber(
              correctionScores[
                exercise.id
              ],
            ),
          ),
        )

        const feedback =
          correctionFeedbacks[
            exercise.id
          ]?.trim() || null

        const {
          error: updateError,
        } = await supabase
          .from('respostas_aluno')
          .update({
            pontuacao: score,
            feedback,
            corrigida: true,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            exercise.resposta.id,
          )
          .eq(
            'atividade_id',
            correctionActivity.id,
          )
          .eq(
            'aluno_id',
            correctionActivity.aluno_id,
          )

        if (updateError) {
          throw updateError
        }
      }

      const total =
        getCorrectionTotal()

      const {
        error: activityError,
      } = await supabase
        .from('atividades')
        .update({
          nota: total,
          status: 'corrigida',
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          correctionActivity.id,
        )
        .eq(
          'aluno_id',
          correctionActivity.aluno_id,
        )

      if (activityError) {
        throw activityError
      }

      setAtividades(
        (current) =>
          current.map(
            (activity) =>
              activity.id ===
              correctionActivity.id
                ? {
                    ...activity,
                    nota: total,
                    status: 'corrigida',
                    updated_at:
                      new Date().toISOString(),
                  }
                : activity,
          ),
      )

      setCorrectionExercises(
        (current) =>
          current.map(
            (exercise) => ({
              ...exercise,
              resposta:
                exercise.resposta
                  ? {
                      ...exercise.resposta,
                      pontuacao:
                        correctionScores[
                          exercise.id
                        ] ?? 0,
                      feedback:
                        correctionFeedbacks[
                          exercise.id
                        ] || null,
                      corrigida: true,
                    }
                  : null,
            }),
          ),
      )

      setCorrectionSuccess(
        `Correção salva. Nota final: ${formatScore(
          total,
        )}/${formatScore(
          getCorrectionMaxTotal(),
        )}. O resultado já foi devolvido ao aluno.`,
      )
    } catch (err: any) {
      console.error(
        'Erro ao salvar correção:',
        err,
      )

      setCorrectionError(
        err?.message ||
          'Não foi possível salvar a correção.',
      )
    } finally {
      setCorrectionSaving(false)
    }
  }

  function renderCorrectionContent(
    exercise: CorrecaoExercicio,
  ) {
    if (
      exercise.conteudos.length ===
      0
    ) {
      return null
    }

    return (
      <div className="atividades-correcao-material">
        {exercise.conteudos.map(
          (content) => (
            <div
              key={content.id}
              className="atividades-correcao-material-item"
            >
              {content.tipo ===
                'texto' && (
                <div>
                  {content.conteudo}
                </div>
              )}

              {content.tipo ===
                'youtube' &&
                getYoutubeEmbedUrl(
                  content.conteudo,
                ) && (
                  <iframe
                    src={getYoutubeEmbedUrl(
                      content.conteudo,
                    )}
                    title="Vídeo do exercício"
                    allowFullScreen
                  />
                )}

              {content.tipo ===
                'imagem' &&
                content.conteudo && (
                  <img
                    src={
                      content.conteudo
                    }
                    alt="Material da atividade"
                  />
                )}
            </div>
          ),
        )}
      </div>
    )
  }

  function renderCorrectionAnswer(
    exercise: CorrecaoExercicio,
  ) {
    const selectedIds =
      getSelectedAlternativeIds(
        exercise.resposta,
      )

    if (
      isObjectiveType(
        exercise.tipo,
      )
    ) {
      return (
        <div className="atividades-correcao-options">
          {exercise.alternativas.map(
            (
              alternative,
              index,
            ) => {
              const selected =
                selectedIds.includes(
                  alternative.id,
                )

              const correct =
                alternative.correta

              return (
                <div
                  key={
                    alternative.id
                  }
                  className={`atividades-correcao-option ${
                    selected
                      ? 'selected'
                      : ''
                  } ${
                    correct
                      ? 'correct'
                      : ''
                  } ${
                    selected &&
                    !correct
                      ? 'wrong'
                      : ''
                  }`}
                >
                  <span className="atividades-correcao-option-letter">
                    {String.fromCharCode(
                      65 +
                        index,
                    )}
                  </span>

                  <span className="atividades-correcao-option-text">
                    {
                      alternative.texto
                    }
                  </span>

                  <div className="atividades-correcao-option-status">
                    {selected && (
                      <span>
                        <CheckCircle2
                          size={
                            16
                          }
                        />
                        Resposta do aluno
                      </span>
                    )}

                    {correct && (
                      <span>
                        <Check
                          size={
                            16
                          }
                        />
                        Correta
                      </span>
                    )}
                  </div>
                </div>
              )
            },
          )}

          <div
            className={`atividades-correcao-result ${
              isObjectiveAnswerCorrect(
                exercise,
              )
                ? 'correct'
                : 'wrong'
            }`}
          >
            {isObjectiveAnswerCorrect(
              exercise,
            ) ? (
              <>
                <CheckCircle2
                  size={18}
                />
                Resposta correta
              </>
            ) : (
              <>
                <AlertCircle
                  size={18}
                />
                Resposta incorreta
              </>
            )}
          </div>
        </div>
      )
    }

    const textAnswer =
      getStudentTextAnswer(
        exercise.resposta,
      )

    return (
      <div className="atividades-correcao-text-answer">
        {textAnswer ? (
          <div className="atividades-correcao-student-answer">
            {textAnswer}
          </div>
        ) : (
          <div className="atividades-correcao-no-answer">
            O aluno não enviou uma resposta textual.
          </div>
        )}
      </div>
    )
  }

  /* =========================================================
     RENDER
  ========================================================= */

  function getActivityCount(
    status: StatusAtividade,
  ) {
    return atividades.filter(
      (atividade) =>
        atividade.status === status,
    ).length
  }

  return (
    <div className="atividades-page">
      <header className="atividades-header">
        <div>
          <div className="atividades-title-row">
            <div className="atividades-title-icon">
              <FileText size={24} />
            </div>

            <div>
              <h1>Atividades</h1>

              <p>
                Crie, envie e acompanhe atividades dos alunos.
              </p>
            </div>
          </div>
        </div>

        {(!isAdmin || professorMode) && (
          <button
            type="button"
            className="atividades-primary-button"
            onClick={openNewActivity}
            disabled={loadingAlunos}
          >
            <Plus size={18} />
            Nova atividade
          </button>
        )}
      </header>

      {error && !showBuilder && (
        <div className="atividades-alert atividades-alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && !showBuilder && (
        <div className="atividades-alert atividades-alert-success">
          <Check size={18} />
          <span>{success}</span>
        </div>
      )}

      <section className="atividades-stats">
        <div className="atividades-stat-card">
          <div className="atividades-stat-icon">
            <FileText size={20} />
          </div>

          <div>
            <span>Total</span>
            <strong>
              {atividades.length}
            </strong>
          </div>
        </div>

        <div className="atividades-stat-card">
          <div className="atividades-stat-icon">
            <Save size={20} />
          </div>

          <div>
            <span>Rascunhos</span>

            <strong>
              {getActivityCount(
                'rascunho',
              )}
            </strong>
          </div>
        </div>

        <div className="atividades-stat-card">
          <div className="atividades-stat-icon">
            <Send size={20} />
          </div>

          <div>
            <span>Enviadas</span>

            <strong>
              {getActivityCount(
                'enviada',
              )}
            </strong>
          </div>
        </div>

        <div className="atividades-stat-card">
          <div className="atividades-stat-icon">
            <Clock3 size={20} />
          </div>

          <div>
            <span>
              Aguardando correção
            </span>

            <strong>
              {getActivityCount(
                'respondida',
              ) +
                getActivityCount(
                  'em_correcao',
                )}
            </strong>
          </div>
        </div>
      </section>

      <section className="atividades-toolbar">
        <div className="atividades-search">
          <FileText size={18} />

          <input
            type="text"
            placeholder="Pesquisar por atividade ou aluno..."
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
          />
        </div>

        <select
          className="atividades-filter"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value as
                | 'todos'
                | StatusAtividade,
            )
          }
        >
          <option value="todos">
            Todos os status
          </option>

          <option value="rascunho">
            Rascunhos
          </option>

          <option value="enviada">
            Enviadas
          </option>

          <option value="em_andamento">
            Em andamento
          </option>

          <option value="respondida">
            Respondidas
          </option>

          <option value="em_correcao">
            Em correção
          </option>

          <option value="corrigida">
            Corrigidas
          </option>
        </select>
      </section>

      <section className="atividades-content">
        {loading ? (
          <div className="atividades-loading">
            <Loader2
              size={28}
              className="atividades-spin"
            />

            <span>
              Carregando atividades...
            </span>
          </div>
        ) : filteredAtividades.length ===
          0 ? (
          <div className="atividades-empty">
            <div className="atividades-empty-icon">
              <FileText size={30} />
            </div>

            <h2>
              Nenhuma atividade encontrada
            </h2>

            <p>
              {atividades.length ===
              0
                ? 'Crie a primeira atividade para um aluno.'
                : 'Nenhuma atividade corresponde aos filtros selecionados.'}
            </p>

            {atividades.length ===
              0 && (
              <button
                type="button"
                className="atividades-primary-button"
                onClick={
                  openNewActivity
                }
              >
                <Plus size={18} />
                Criar atividade
              </button>
            )}
          </div>
        ) : (
          <div className="atividades-table-wrapper">
            <table className="atividades-table">
              <thead>
                <tr>
                  <th>
                    Atividade
                  </th>

                  <th>Aluno</th>

                  <th>Idioma</th>

                  <th>Status</th>

                  <th>Prazo</th>

                  <th>Nota</th>

                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {filteredAtividades.map(
                  (atividade) => (
                    <tr
                      key={
                        atividade.id
                      }
                    >
                      <td>
                        <div className="atividades-name">
                          <strong>
                            {
                              atividade.titulo
                            }
                          </strong>

                          <span>
                            {new Date(
                              atividade.created_at,
                            ).toLocaleDateString(
                              'pt-BR',
                            )}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="atividades-student">
                          <div className="atividades-student-avatar">
                            <UserRound
                              size={16}
                            />
                          </div>

                          <span>
                            {atividade
                              .aluno
                              ?.nome_completo ||
                              'Aluno não encontrado'}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className="atividades-language">
                          <Languages
                            size={15}
                          />

                          {atividade.idioma ===
                          'ingles'
                            ? 'Inglês'
                            : 'Alemão'}
                        </span>
                      </td>

                      <td>
                        <span
                          className={getStatusClass(
                            atividade.status,
                          )}
                        >
                          {
                            statusLabels[
                              atividade.status as StatusAtividade
                            ]
                          }
                        </span>
                      </td>

                      <td>
                        {formatDateTime(
                          atividade.prazo,
                        )}
                      </td>

                      <td>
                        {atividade.nota !==
                        null
                          ? atividade.nota.toLocaleString(
                              'pt-BR',
                              {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 2,
                              },
                            )
                          : '-'}
                      </td>

                      <td>
                        <div className="atividades-actions">
                          {(atividade.status ===
                            'respondida' ||
                            atividade.status ===
                              'em_correcao') && (
                            <button
                              type="button"
                              title="Corrigir atividade"
                              onClick={() =>
                                openCorrection(
                                  atividade,
                                )
                              }
                            >
                              <CheckCircle2
                                size={
                                  17
                                }
                              />
                            </button>
                          )}

                          {atividade.status ===
                            'corrigida' && (
                            <button
                              type="button"
                              title="Visualizar correção"
                              onClick={() =>
                                openCorrection(
                                  atividade,
                                )
                              }
                            >
                              <Eye
                                size={
                                  17
                                }
                              />
                            </button>
                          )}

                          <button
                            type="button"
                            title="Editar"
                            onClick={() =>
                              openEditActivity(
                                atividade.id,
                              )
                            }
                          >
                            <FileText
                              size={17}
                            />
                          </button>

                          <button
                            type="button"
                            title="Duplicar"
                            onClick={() =>
                              duplicateActivity(
                                atividade.id,
                              )
                            }
                            disabled={
                              saving
                            }
                          >
                            <Copy
                              size={17}
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* =====================================================
          BUILDER
      ===================================================== */}

      {showBuilder && (
        <div className="atividades-builder-overlay">
          <div className="atividades-builder">
            <header className="atividades-builder-header">
              <div>
                <h2>
                  {editingId
                    ? 'Editar atividade'
                    : 'Nova atividade'}
                </h2>

                <p>
                  Monte a atividade e seus exercícios.
                </p>
              </div>

              <button
                type="button"
                className="atividades-close-button"
                onClick={
                  closeBuilder
                }
                disabled={saving}
              >
                <X size={21} />
              </button>
            </header>

            {error && (
              <div className="atividades-alert atividades-alert-error">
                <AlertCircle
                  size={18}
                />

                <span>
                  {error}
                </span>
              </div>
            )}

            {success && (
              <div className="atividades-alert atividades-alert-success">
                <Check size={18} />

                <span>
                  {success}
                </span>
              </div>
            )}

            <div className="atividades-builder-body">
              <section className="atividades-general-card">
                <div className="atividades-section-heading">
                  <div>
                    <h3>
                      Informações da atividade
                    </h3>

                    <p>
                      Defina o aluno e as informações gerais.
                    </p>
                  </div>
                </div>

                <div className="atividades-form-grid">
                  <label className="atividades-field atividades-field-full">
                    <span>
                      Aluno *
                    </span>

                    <div className="atividades-input-wrapper">
                      <UserRound
                        size={17}
                      />

                      <select
                        value={
                          form.aluno_id
                        }
                        onChange={(
                          event,
                        ) =>
                          updateForm(
                            'aluno_id',
                            event
                              .target
                              .value,
                          )
                        }
                        disabled={
                          loadingAlunos
                        }
                      >
                        <option value="">
                          {loadingAlunos
                            ? 'Carregando alunos...'
                            : 'Selecione o aluno'}
                        </option>

                        {alunos.map(
                          (
                            aluno,
                          ) => (
                            <option
                              key={
                                aluno.id
                              }
                              value={
                                aluno.id
                              }
                            >
                              {
                                aluno.nome_completo
                              }{' '}
                              —{' '}
                              {
                                aluno.email
                              }
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  </label>

                  <label className="atividades-field">
                    <span>
                      Título *
                    </span>

                    <input
                      type="text"
                      value={
                        form.titulo
                      }
                      placeholder="Ex.: Atividade de conversação"
                      onChange={(
                        event,
                      ) =>
                        updateForm(
                          'titulo',
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </label>

                  <label className="atividades-field">
                    <span>
                      Idioma *
                    </span>

                    <div className="atividades-input-wrapper">
                      <Languages
                        size={17}
                      />

                      <select
                        value={
                          form.idioma
                        }
                        onChange={(
                          event,
                        ) =>
                          updateForm(
                            'idioma',
                            event.target
                              .value as Idioma,
                          )
                        }
                      >
                        <option value="ingles">
                          Inglês
                        </option>

                        <option value="alemao">
                          Alemão
                        </option>
                      </select>
                    </div>
                  </label>

                  <label className="atividades-field">
                    <span>
                      Prazo
                    </span>

                    <div className="atividades-input-wrapper">
                      <Clock3
                        size={17}
                      />

                      <input
                        type="datetime-local"
                        value={
                          form.prazo
                        }
                        onChange={(
                          event,
                        ) =>
                          updateForm(
                            'prazo',
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </div>
                  </label>

                  <label className="atividades-field atividades-field-full">
                    <span>
                      Descrição /
                      instruções
                    </span>

                    <textarea
                      value={
                        form.descricao
                      }
                      placeholder="Digite as instruções gerais da atividade..."
                      rows={4}
                      onChange={(
                        event,
                      ) =>
                        updateForm(
                          'descricao',
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </label>
                </div>
              </section>

              <section className="atividades-exercises-section">
                <div className="atividades-section-heading">
                  <div>
                    <h3>
                      Exercícios
                    </h3>

                    <p>
                      Adicione quantos exercícios forem necessários.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="atividades-add-exercise"
                    onClick={
                      addExercise
                    }
                  >
                    <Plus
                      size={17}
                    />

                    Adicionar exercício
                  </button>
                </div>

                <div className="atividades-exercises">
                  {form.exercicios.map(
                    (
                      exercise,
                      index,
                    ) => {
                      const expanded =
                        expandedExercises.includes(
                          exercise.id,
                        )

                      return (
                        <article
                          className={`atividades-exercise-card ${
                            expanded
                              ? 'is-expanded'
                              : ''
                          }`}
                          key={
                            exercise.id
                          }
                        >
                          <div className="atividades-exercise-header">
                            <button
                              type="button"
                              className="atividades-exercise-toggle"
                              onClick={() =>
                                toggleExercise(
                                  exercise.id,
                                )
                              }
                            >
                              <span className="atividades-exercise-number">
                                {index +
                                  1}
                              </span>

                              <div>
                                <strong>
                                  {exercise.titulo ||
                                    `Exercício ${
                                      index +
                                      1
                                    }`}
                                </strong>

                                <span>
                                  {
                                    tipoExercicioLabels[
                                      exercise.tipo
                                    ]
                                  }{' '}
                                  •{' '}
                                  {
                                    exercise.pontuacao
                                  }{' '}
                                  ponto
                                  {exercise.pontuacao !==
                                  1
                                    ? 's'
                                    : ''}
                                </span>
                              </div>

                              {expanded ? (
                                <ChevronUp
                                  size={
                                    19
                                  }
                                />
                              ) : (
                                <ChevronDown
                                  size={
                                    19
                                  }
                                />
                              )}
                            </button>

                            <div className="atividades-exercise-actions">
                              <button
                                type="button"
                                title="Mover para cima"
                                onClick={() =>
                                  moveExercise(
                                    exercise.id,
                                    'up',
                                  )
                                }
                                disabled={
                                  index ===
                                  0
                                }
                              >
                                <ArrowUp
                                  size={
                                    16
                                  }
                                />
                              </button>

                              <button
                                type="button"
                                title="Mover para baixo"
                                onClick={() =>
                                  moveExercise(
                                    exercise.id,
                                    'down',
                                  )
                                }
                                disabled={
                                  index ===
                                  form
                                    .exercicios
                                    .length - 1
                                }
                              >
                                <ArrowDown
                                  size={
                                    16
                                  }
                                />
                              </button>

                              <button
                                type="button"
                                title="Duplicar exercício"
                                onClick={() =>
                                  duplicateExercise(
                                    exercise.id,
                                  )
                                }
                              >
                                <Copy
                                  size={
                                    16
                                  }
                                />
                              </button>

                              <button
                                type="button"
                                title="Excluir exercício"
                                className="danger"
                                onClick={() =>
                                  removeExercise(
                                    exercise.id,
                                  )
                                }
                              >
                                <Trash2
                                  size={
                                    16
                                  }
                                />
                              </button>
                            </div>
                          </div>

                          {expanded && (
                            <div className="atividades-exercise-body">
                              <div className="atividades-form-grid">
                                <label className="atividades-field">
                                  <span>
                                    Título do exercício
                                  </span>

                                  <input
                                    type="text"
                                    placeholder="Ex.: Vocabulary"
                                    value={
                                      exercise.titulo
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      updateExercise(
                                        exercise.id,
                                        'titulo',
                                        event
                                          .target
                                          .value,
                                      )
                                    }
                                  />
                                </label>

                                <label className="atividades-field">
                                  <span>
                                    Tipo de exercício *
                                  </span>

                                  <select
                                    value={
                                      exercise.tipo
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      changeExerciseType(
                                        exercise.id,
                                        event
                                          .target
                                          .value as TipoExercicio,
                                      )
                                    }
                                  >
                                    {Object.entries(
                                      tipoExercicioLabels,
                                    ).map(
                                      ([
                                        value,
                                        label,
                                      ]) => (
                                        <option
                                          key={
                                            value
                                          }
                                          value={
                                            value
                                          }
                                        >
                                          {
                                            label
                                          }
                                        </option>
                                      ),
                                    )}
                                  </select>
                                </label>

                                <label className="atividades-field">
                                  <span>
                                    Pontuação *
                                  </span>

                                  <input
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    value={
                                      exercise.pontuacao
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      updateExercise(
                                        exercise.id,
                                        'pontuacao',
                                        Number(
                                          event
                                            .target
                                            .value,
                                        ),
                                      )
                                    }
                                  />
                                </label>

                                <label className="atividades-field atividades-field-full">
                                  <span>
                                    Enunciado *
                                  </span>

                                  <textarea
                                    rows={
                                      4
                                    }
                                    placeholder="Digite o enunciado da questão..."
                                    value={
                                      exercise.enunciado
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      updateExercise(
                                        exercise.id,
                                        'enunciado',
                                        event
                                          .target
                                          .value,
                                      )
                                    }
                                  />
                                </label>
                              </div>

                              {isObjectiveType(
                                exercise.tipo,
                              ) && (
                                <div className="atividades-subsection">
                                  <div className="atividades-subsection-header">
                                    <div>
                                      <h4>
                                        Alternativas
                                      </h4>

                                      <span>
                                        Marque a resposta correta.
                                      </span>
                                    </div>

                                    {exercise.tipo !==
                                      'verdadeiro_falso' && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          addAlternative(
                                            exercise.id,
                                          )
                                        }
                                      >
                                        <Plus
                                          size={
                                            16
                                          }
                                        />

                                        Adicionar
                                      </button>
                                    )}
                                  </div>

                                  <div className="atividades-alternatives">
                                    {exercise.alternativas.map(
                                      (
                                        alternative,
                                        alternativeIndex,
                                      ) => (
                                        <div
                                          className="atividades-alternative"
                                          key={
                                            alternative.id
                                          }
                                        >
                                          <button
                                            type="button"
                                            className={`atividades-correct-button ${
                                              alternative.correta
                                                ? 'correct'
                                                : ''
                                            }`}
                                            onClick={() =>
                                              setCorrectAlternative(
                                                exercise.id,
                                                alternative.id,
                                              )
                                            }
                                            title="Marcar como correta"
                                          >
                                            <Check
                                              size={
                                                16
                                              }
                                            />
                                          </button>

                                          <span className="atividades-alternative-letter">
                                            {String.fromCharCode(
                                              65 +
                                                alternativeIndex,
                                            )}
                                          </span>

                                          <input
                                            type="text"
                                            value={
                                              alternative.texto
                                            }
                                            disabled={
                                              exercise.tipo ===
                                              'verdadeiro_falso'
                                            }
                                            onChange={(
                                              event,
                                            ) =>
                                              updateAlternative(
                                                exercise.id,
                                                alternative.id,
                                                'texto',
                                                event
                                                  .target
                                                  .value,
                                              )
                                            }
                                          />

                                          {exercise.tipo !==
                                            'verdadeiro_falso' && (
                                            <button
                                              type="button"
                                              className="atividades-delete-small"
                                              onClick={() =>
                                                removeAlternative(
                                                  exercise.id,
                                                  alternative.id,
                                                )
                                              }
                                              disabled={
                                                exercise
                                                  .alternativas
                                                  .length <=
                                                2
                                              }
                                            >
                                              <Trash2
                                                size={
                                                  16
                                                }
                                              />
                                            </button>
                                          )}
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="atividades-subsection">
                                <div className="atividades-subsection-header">
                                  <div>
                                    <h4>
                                      Conteúdo complementar
                                    </h4>

                                    <span>
                                      Adicione materiais para auxiliar o aluno.
                                    </span>
                                  </div>

                                  <div className="atividades-content-buttons">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        addContent(
                                          exercise.id,
                                          'texto',
                                        )
                                      }
                                    >
                                      <FileText
                                        size={
                                          15
                                        }
                                      />

                                      Texto
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        addContent(
                                          exercise.id,
                                          'youtube',
                                        )
                                      }
                                    >
                                      <Video
                                        size={
                                          15
                                        }
                                      />

                                      YouTube
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        addContent(
                                          exercise.id,
                                          'imagem',
                                        )
                                      }
                                    >
                                      <Image
                                        size={
                                          15
                                        }
                                      />

                                      Imagem
                                    </button>
                                  </div>
                                </div>

                                {exercise
                                  .conteudos
                                  .length >
                                  0 && (
                                  <div className="atividades-contents">
                                    {exercise.conteudos.map(
                                      (
                                        content,
                                        contentIndex,
                                      ) => (
                                        <div
                                          className="atividades-content-item"
                                          key={
                                            content.id
                                          }
                                        >
                                          <div className="atividades-content-item-header">
                                            <span>
                                              {
                                                tipoConteudoLabels[
                                                  content
                                                    .tipo
                                                ]
                                              }
                                            </span>

                                            <button
                                              type="button"
                                              onClick={() =>
                                                removeContent(
                                                  exercise.id,
                                                  content.id,
                                                )
                                              }
                                            >
                                              <Trash2
                                                size={
                                                  16
                                                }
                                              />
                                            </button>
                                          </div>

                                          {content.tipo ===
                                            'texto' && (
                                            <textarea
                                              rows={
                                                4
                                              }
                                              placeholder="Digite o texto de apoio..."
                                              value={
                                                content.conteudo
                                              }
                                              onChange={(
                                                event,
                                              ) =>
                                                updateContent(
                                                  exercise.id,
                                                  content.id,
                                                  'conteudo',
                                                  event
                                                    .target
                                                    .value,
                                                )
                                              }
                                            />
                                          )}

                                          {content.tipo ===
                                            'youtube' && (
                                            <>
                                              <div className="atividades-input-wrapper">
                                                <Link
                                                  size={
                                                    17
                                                  }
                                                />

                                                <input
                                                  type="url"
                                                  placeholder="https://www.youtube.com/watch?v=..."
                                                  value={
                                                    content.conteudo
                                                  }
                                                  onChange={(
                                                    event,
                                                  ) =>
                                                    updateContent(
                                                      exercise.id,
                                                      content.id,
                                                      'conteudo',
                                                      event
                                                        .target
                                                        .value,
                                                    )
                                                  }
                                                />
                                              </div>

                                              {getYoutubeEmbedUrl(
                                                content.conteudo,
                                              ) && (
                                                <div className="atividades-video-preview">
                                                  <iframe
                                                    src={getYoutubeEmbedUrl(
                                                      content.conteudo,
                                                    )}
                                                    title={`Vídeo do exercício ${
                                                      index +
                                                      1
                                                    }`}
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                    allowFullScreen
                                                  />
                                                </div>
                                              )}
                                            </>
                                          )}

                                          {content.tipo ===
                                            'imagem' && (
                                            <>
                                              <div className="atividades-input-wrapper">
                                                <Image
                                                  size={
                                                    17
                                                  }
                                                />

                                                <input
                                                  type="url"
                                                  placeholder="URL da imagem"
                                                  value={
                                                    content.conteudo
                                                  }
                                                  onChange={(
                                                    event,
                                                  ) =>
                                                    updateContent(
                                                      exercise.id,
                                                      content.id,
                                                      'conteudo',
                                                      event
                                                        .target
                                                        .value,
                                                    )
                                                  }
                                                />
                                              </div>

                                              {content.conteudo && (
                                                <div className="atividades-image-preview">
                                                  <img
                                                    src={
                                                      content.conteudo
                                                    }
                                                    alt={`Conteúdo ${
                                                      contentIndex +
                                                      1
                                                    }`}
                                                  />
                                                </div>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      ),
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </article>
                      )
                    },
                  )}
                </div>

                <button
                  type="button"
                  className="atividades-add-exercise-large"
                  onClick={
                    addExercise
                  }
                >
                  <Plus
                    size={19}
                  />

                  Adicionar outro exercício
                </button>
              </section>
            </div>

            <footer className="atividades-builder-footer">
              <button
                type="button"
                className="atividades-secondary-button"
                onClick={
                  closeBuilder
                }
                disabled={saving}
              >
                Cancelar
              </button>

              <div className="atividades-footer-actions">
                <button
                  type="button"
                  className="atividades-outline-button"
                  onClick={() =>
                    setShowPreview(
                      true,
                    )
                  }
                  disabled={saving}
                >
                  <Eye size={17} />
                  Visualizar
                </button>

                <button
                  type="button"
                  className="atividades-outline-button"
                  onClick={() =>
                    saveActivity(
                      'rascunho',
                    )
                  }
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2
                      size={17}
                      className="atividades-spin"
                    />
                  ) : (
                    <Save
                      size={17}
                    />
                  )}

                  Salvar rascunho
                </button>

                <button
                  type="button"
                  className="atividades-primary-button"
                  onClick={() =>
                    saveActivity(
                      'enviada',
                    )
                  }
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2
                      size={17}
                      className="atividades-spin"
                    />
                  ) : (
                    <Send
                      size={17}
                    />
                  )}

                  Enviar para aluno
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* =====================================================
          PREVIEW
      ===================================================== */}

      {showPreview && (
        <div className="atividades-preview-overlay">
          <div className="atividades-preview-modal">
            <header className="atividades-preview-header">
              <div>
                <span>
                  Pré-visualização
                </span>

                <h2>
                  {form.titulo ||
                    'Atividade sem título'}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowPreview(
                    false,
                  )
                }
              >
                <X size={20} />
              </button>
            </header>

            <div className="atividades-preview-body">
              {form.descricao && (
                <div className="atividades-preview-description">
                  <p>
                    {
                      form.descricao
                    }
                  </p>
                </div>
              )}

              {form.exercicios.map(
                (
                  exercise,
                  index,
                ) => (
                  <article
                    className="atividades-preview-exercise"
                    key={
                      exercise.id
                    }
                  >
                    <div className="atividades-preview-number">
                      {index + 1}
                    </div>

                    <div className="atividades-preview-content">
                      <span className="atividades-preview-type">
                        {
                          tipoExercicioLabels[
                            exercise
                              .tipo
                          ]
                        }{' '}
                        •{' '}
                        {
                          exercise.pontuacao
                        }{' '}
                        ponto
                        {exercise.pontuacao !==
                        1
                          ? 's'
                          : ''}
                      </span>

                      {exercise.titulo && (
                        <h3>
                          {
                            exercise.titulo
                          }
                        </h3>
                      )}

                      <p className="atividades-preview-enunciado">
                        {
                          exercise.enunciado
                        }
                      </p>

                      {exercise.conteudos.map(
                        (
                          content,
                        ) => (
                          <div
                            className="atividades-preview-material"
                            key={
                              content.id
                            }
                          >
                            {content.tipo ===
                              'texto' && (
                              <div>
                                {
                                  content.conteudo
                                }
                              </div>
                            )}

                            {content.tipo ===
                              'youtube' &&
                              getYoutubeEmbedUrl(
                                content.conteudo,
                              ) && (
                                <iframe
                                  src={getYoutubeEmbedUrl(
                                    content.conteudo,
                                  )}
                                  title="Vídeo"
                                  allowFullScreen
                                />
                              )}

                            {content.tipo ===
                              'imagem' &&
                              content.conteudo && (
                                <img
                                  src={
                                    content.conteudo
                                  }
                                  alt="Material da atividade"
                                />
                              )}
                          </div>
                        ),
                      )}

                      {isObjectiveType(
                        exercise.tipo,
                      ) && (
                        <div className="atividades-preview-options">
                          {exercise.alternativas.map(
                            (
                              alternative,
                              alternativeIndex,
                            ) => (
                              <div
                                className="atividades-preview-option"
                                key={
                                  alternative.id
                                }
                              >
                                <span>
                                  {String.fromCharCode(
                                    65 +
                                      alternativeIndex,
                                  )}
                                </span>

                                {
                                  alternative.texto
                                }
                              </div>
                            ),
                          )}
                        </div>
                      )}

                      {!isObjectiveType(
                        exercise.tipo,
                      ) && (
                        <div className="atividades-preview-answer">
                          Área de resposta do aluno
                        </div>
                      )}
                    </div>
                  </article>
                ),
              )}
            </div>

            <footer className="atividades-preview-footer">
              <button
                type="button"
                className="atividades-secondary-button"
                onClick={() =>
                  setShowPreview(
                    false,
                  )
                }
              >
                Voltar para edição
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* =====================================================
          PAINEL DE CORREÇÃO
      ===================================================== */}

      {showCorrection && (
        <div
          className="atividades-correction-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3000,
            background:
              'rgba(15, 23, 42, 0.62)',
            display: 'flex',
            justifyContent:
              'flex-end',
          }}
        >
          <div
            className="atividades-correction-panel"
            style={{
              width:
                'min(960px, 100vw)',
              height: '100vh',
              background:
                '#ffffff',
              display: 'flex',
              flexDirection:
                'column',
              boxShadow:
                '-20px 0 60px rgba(15, 23, 42, 0.18)',
              overflow: 'hidden',
            }}
          >
            <header
              style={{
                padding:
                  '24px 28px',
                borderBottom:
                  '1px solid #e5e7eb',
                display: 'flex',
                alignItems:
                  'center',
                justifyContent:
                  'space-between',
                gap: '20px',
                flexShrink: 0,
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems:
                      'center',
                    gap: '10px',
                    marginBottom:
                      '6px',
                  }}
                >
                  <CheckCircle2
                    size={22}
                    style={{
                      color:
                        '#2563eb',
                    }}
                  />

                  <span
                    style={{
                      fontSize:
                        '12px',
                      fontWeight:
                        700,
                      textTransform:
                        'uppercase',
                      letterSpacing:
                        '0.08em',
                      color:
                        '#64748b',
                    }}
                  >
                    Correção de atividade
                  </span>
                </div>

                <h2
                  style={{
                    margin: 0,
                    fontSize:
                      '22px',
                    color:
                      '#0f172a',
                  }}
                >
                  {correctionActivity?.titulo ||
                    'Atividade'}
                </h2>

                <p
                  style={{
                    margin:
                      '6px 0 0',
                    color:
                      '#64748b',
                    fontSize:
                      '14px',
                  }}
                >
                  Aluno:{' '}
                  <strong>
                    {correctionActivity
                      ?.aluno
                      ?.nome_completo ||
                      'Aluno'}
                  </strong>
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeCorrection
                }
                disabled={
                  correctionSaving
                }
                style={{
                  width: 40,
                  height: 40,
                  borderRadius:
                    '10px',
                  border:
                    '1px solid #e5e7eb',
                  background:
                    '#f8fafc',
                  color:
                    '#475569',
                  display:
                    'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                  cursor:
                    correctionSaving
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                <X size={20} />
              </button>
            </header>

            <div
              style={{
                flex: 1,
                overflowY:
                  'auto',
                padding:
                  '24px 28px 40px',
              }}
            >
              {correctionError && (
                <div
                  style={{
                    marginBottom:
                      '18px',
                    padding:
                      '13px 15px',
                    borderRadius:
                      '10px',
                    background:
                      '#fef2f2',
                    border:
                      '1px solid #fecaca',
                    color:
                      '#b91c1c',
                    display:
                      'flex',
                    alignItems:
                      'center',
                    gap: '9px',
                    fontSize:
                      '14px',
                  }}
                >
                  <AlertCircle
                    size={18}
                  />

                  <span>
                    {
                      correctionError
                    }
                  </span>
                </div>
              )}

              {correctionSuccess && (
                <div
                  style={{
                    marginBottom:
                      '18px',
                    padding:
                      '14px 16px',
                    borderRadius:
                      '10px',
                    background:
                      '#f0fdf4',
                    border:
                      '1px solid #bbf7d0',
                    color:
                      '#166534',
                    display:
                      'flex',
                    alignItems:
                      'center',
                    gap: '9px',
                    fontSize:
                      '14px',
                  }}
                >
                  <CheckCircle2
                    size={18}
                  />

                  <span>
                    {
                      correctionSuccess
                    }
                  </span>
                </div>
              )}

              {correctionLoading ? (
                <div
                  style={{
                    minHeight:
                      '360px',
                    display:
                      'flex',
                    alignItems:
                      'center',
                    justifyContent:
                      'center',
                    flexDirection:
                      'column',
                    gap: '12px',
                    color:
                      '#64748b',
                  }}
                >
                  <Loader2
                    size={30}
                    className="atividades-spin"
                  />

                  <span>
                    Carregando respostas do aluno...
                  </span>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display:
                        'grid',
                      gridTemplateColumns:
                        'repeat(3, minmax(0, 1fr))',
                      gap: '12px',
                      marginBottom:
                        '22px',
                    }}
                  >
                    <div
                      style={{
                        border:
                          '1px solid #e2e8f0',
                        borderRadius:
                          '12px',
                        padding:
                          '15px',
                        background:
                          '#f8fafc',
                      }}
                    >
                      <span
                        style={{
                          display:
                            'block',
                          fontSize:
                            '12px',
                          color:
                            '#64748b',
                          marginBottom:
                            '5px',
                        }}
                      >
                        Exercícios
                      </span>

                      <strong
                        style={{
                          fontSize:
                            '20px',
                          color:
                            '#0f172a',
                        }}
                      >
                        {
                          correctionExercises.length
                        }
                      </strong>
                    </div>

                    <div
                      style={{
                        border:
                          '1px solid #e2e8f0',
                        borderRadius:
                          '12px',
                        padding:
                          '15px',
                        background:
                          '#f8fafc',
                      }}
                    >
                      <span
                        style={{
                          display:
                            'block',
                          fontSize:
                            '12px',
                          color:
                            '#64748b',
                          marginBottom:
                            '5px',
                        }}
                      >
                        Nota
                      </span>

                      <strong
                        style={{
                          fontSize:
                            '20px',
                          color:
                            '#2563eb',
                        }}
                      >
                        {formatScore(
                          getCorrectionTotal(),
                        )}
                        <span
                          style={{
                            color:
                              '#94a3b8',
                            fontSize:
                              '14px',
                            fontWeight:
                              500,
                          }}
                        >
                          {' '}
                          /{' '}
                          {formatScore(
                            getCorrectionMaxTotal(),
                          )}
                        </span>
                      </strong>
                    </div>

                    <div
                      style={{
                        border:
                          '1px solid #e2e8f0',
                        borderRadius:
                          '12px',
                        padding:
                          '15px',
                        background:
                          '#f8fafc',
                      }}
                    >
                      <span
                        style={{
                          display:
                            'block',
                          fontSize:
                            '12px',
                          color:
                            '#64748b',
                          marginBottom:
                            '5px',
                        }}
                      >
                        Corrigidos
                      </span>

                      <strong
                        style={{
                          fontSize:
                            '20px',
                          color:
                            '#0f172a',
                        }}
                      >
                        {
                          getCorrectedCount()
                        }
                        <span
                          style={{
                            color:
                              '#94a3b8',
                            fontSize:
                              '14px',
                            fontWeight:
                              500,
                          }}
                        >
                          {' '}
                          /{' '}
                          {
                            correctionExercises.length
                          }
                        </span>
                      </strong>
                    </div>
                  </div>

                  {correctionExercises.map(
                    (
                      exercise,
                      index,
                    ) => {
                      const expanded =
                        correctionExpanded.includes(
                          exercise.id,
                        )

                      const objective =
                        isObjectiveType(
                          exercise.tipo,
                        )

                      const autoScore =
                        objective
                          ? calculateObjectiveScore(
                              exercise,
                            )
                          : null

                      return (
                        <article
                          key={
                            exercise.id
                          }
                          style={{
                            border:
                              '1px solid #e2e8f0',
                            borderRadius:
                              '14px',
                            marginBottom:
                              '14px',
                            overflow:
                              'hidden',
                            background:
                              '#ffffff',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              toggleCorrectionExercise(
                                exercise.id,
                              )
                            }
                            style={{
                              width:
                                '100%',
                              border:
                                'none',
                              background:
                                '#f8fafc',
                              padding:
                                '16px 18px',
                              display:
                                'flex',
                              alignItems:
                                'center',
                              gap: '13px',
                              textAlign:
                                'left',
                              cursor:
                                'pointer',
                            }}
                          >
                            <span
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius:
                                  '9px',
                                background:
                                  '#e2e8f0',
                                display:
                                  'flex',
                                alignItems:
                                  'center',
                                justifyContent:
                                  'center',
                                fontWeight:
                                  700,
                                color:
                                  '#334155',
                                flexShrink: 0,
                              }}
                            >
                              {index +
                                1}
                            </span>

                            <div
                              style={{
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              <strong
                                style={{
                                  display:
                                    'block',
                                  color:
                                    '#0f172a',
                                  fontSize:
                                    '14px',
                                  marginBottom:
                                    '4px',
                                }}
                              >
                                {exercise.titulo ||
                                  `Exercício ${
                                    index +
                                    1
                                  }`}
                              </strong>

                              <span
                                style={{
                                  color:
                                    '#64748b',
                                  fontSize:
                                    '12px',
                                }}
                              >
                                {
                                  tipoExercicioLabels[
                                    exercise
                                      .tipo
                                  ]
                                }{' '}
                                •{' '}
                                {
                                  exercise.pontuacao
                                }{' '}
                                pontos
                              </span>
                            </div>

                            <strong
                              style={{
                                color:
                                  '#2563eb',
                                fontSize:
                                  '14px',
                              }}
                            >
                              {formatScore(
                                normalizeNumber(
                                  correctionScores[
                                    exercise.id
                                  ],
                                ),
                              )}
                              /
                              {formatScore(
                                exercise.pontuacao,
                              )}
                            </strong>

                            {expanded ? (
                              <ChevronUp
                                size={
                                  19
                                }
                              />
                            ) : (
                              <ChevronDown
                                size={
                                  19
                                }
                              />
                            )}
                          </button>

                          {expanded && (
                            <div
                              style={{
                                padding:
                                  '20px',
                                borderTop:
                                  '1px solid #e2e8f0',
                              }}
                            >
                              <div
                                style={{
                                  marginBottom:
                                    '18px',
                                }}
                              >
                                <span
                                  style={{
                                    display:
                                      'block',
                                    fontSize:
                                      '11px',
                                    fontWeight:
                                      700,
                                    textTransform:
                                      'uppercase',
                                    letterSpacing:
                                      '0.07em',
                                    color:
                                      '#64748b',
                                    marginBottom:
                                      '7px',
                                  }}
                                >
                                  Enunciado
                                </span>

                                <p
                                  style={{
                                    margin:
                                      0,
                                    color:
                                      '#1e293b',
                                    lineHeight:
                                      1.6,
                                    whiteSpace:
                                      'pre-wrap',
                                  }}
                                >
                                  {
                                    exercise.enunciado
                                  }
                                </p>
                              </div>

                              {renderCorrectionContent(
                                exercise,
                              )}

                              <div
                                style={{
                                  marginTop:
                                    '20px',
                                  padding:
                                    '17px',
                                  borderRadius:
                                    '12px',
                                  background:
                                    '#f8fafc',
                                  border:
                                    '1px solid #e2e8f0',
                                }}
                              >
                                <span
                                  style={{
                                    display:
                                      'block',
                                    fontSize:
                                      '11px',
                                    fontWeight:
                                      700,
                                    textTransform:
                                      'uppercase',
                                    letterSpacing:
                                      '0.07em',
                                    color:
                                      '#64748b',
                                    marginBottom:
                                      '10px',
                                  }}
                                >
                                  Resposta do aluno
                                </span>

                                {renderCorrectionAnswer(
                                  exercise,
                                )}
                              </div>

                              {objective &&
                                autoScore !==
                                  null && (
                                  <div
                                    style={{
                                      marginTop:
                                        '12px',
                                      padding:
                                        '12px 14px',
                                      borderRadius:
                                        '10px',
                                      background:
                                        isObjectiveAnswerCorrect(
                                          exercise,
                                        )
                                          ? '#f0fdf4'
                                          : '#fef2f2',
                                      color:
                                        isObjectiveAnswerCorrect(
                                          exercise,
                                        )
                                          ? '#166534'
                                          : '#b91c1c',
                                      fontSize:
                                        '13px',
                                      display:
                                        'flex',
                                      alignItems:
                                        'center',
                                      gap: '8px',
                                    }}
                                  >
                                    {isObjectiveAnswerCorrect(
                                      exercise,
                                    ) ? (
                                      <CheckCircle2
                                        size={
                                          17
                                        }
                                      />
                                    ) : (
                                      <AlertCircle
                                        size={
                                          17
                                        }
                                      />
                                    )}

                                    <span>
                                      Correção automática:
                                      {' '}
                                      <strong>
                                        {formatScore(
                                          autoScore,
                                        )}{' '}
                                        /{' '}
                                        {formatScore(
                                          exercise.pontuacao,
                                        )}
                                      </strong>
                                    </span>
                                  </div>
                                )}

                              <div
                                style={{
                                  marginTop:
                                    '18px',
                                  display:
                                    'grid',
                                  gridTemplateColumns:
                                    '180px 1fr',
                                  gap: '16px',
                                  alignItems:
                                    'start',
                                }}
                              >
                                <label
                                  style={{
                                    display:
                                      'flex',
                                    flexDirection:
                                      'column',
                                    gap: '7px',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize:
                                        '12px',
                                      fontWeight:
                                        700,
                                      color:
                                        '#334155',
                                    }}
                                  >
                                    Pontuação
                                  </span>

                                  <div
                                    style={{
                                      position:
                                        'relative',
                                    }}
                                  >
                                    <input
                                      type="number"
                                      min="0"
                                      max={
                                        exercise.pontuacao
                                      }
                                      step="0.1"
                                      value={
                                        correctionScores[
                                          exercise
                                            .id
                                        ] ??
                                        0
                                      }
                                      onChange={(
                                        event,
                                      ) =>
                                        updateCorrectionScore(
                                          exercise,
                                          event
                                            .target
                                            .value,
                                        )
                                      }
                                      style={{
                                        width:
                                          '100%',
                                        boxSizing:
                                          'border-box',
                                        height:
                                          '44px',
                                        border:
                                          '1px solid #cbd5e1',
                                        borderRadius:
                                          '9px',
                                        padding:
                                          '0 60px 0 12px',
                                        fontSize:
                                          '14px',
                                        color:
                                          '#0f172a',
                                        outline:
                                          'none',
                                      }}
                                    />

                                    <span
                                      style={{
                                        position:
                                          'absolute',
                                        right:
                                          '12px',
                                        top:
                                          '50%',
                                        transform:
                                          'translateY(-50%)',
                                        color:
                                          '#64748b',
                                        fontSize:
                                          '12px',
                                      }}
                                    >
                                      /{' '}
                                      {formatScore(
                                        exercise.pontuacao,
                                      )}
                                    </span>
                                  </div>
                                </label>

                                <label
                                  style={{
                                    display:
                                      'flex',
                                    flexDirection:
                                      'column',
                                    gap: '7px',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize:
                                        '12px',
                                      fontWeight:
                                        700,
                                      color:
                                        '#334155',
                                    }}
                                  >
                                    Feedback para o aluno
                                  </span>

                                  <textarea
                                    rows={3}
                                    value={
                                      correctionFeedbacks[
                                        exercise
                                          .id
                                      ] ??
                                      ''
                                    }
                                    placeholder="Escreva um comentário sobre a resposta..."
                                    onChange={(
                                      event,
                                    ) =>
                                      updateCorrectionFeedback(
                                        exercise.id,
                                        event
                                          .target
                                          .value,
                                      )
                                    }
                                    style={{
                                      width:
                                        '100%',
                                      boxSizing:
                                        'border-box',
                                      resize:
                                        'vertical',
                                      border:
                                        '1px solid #cbd5e1',
                                      borderRadius:
                                        '9px',
                                      padding:
                                        '11px 12px',
                                      fontSize:
                                        '14px',
                                      lineHeight:
                                        1.5,
                                      color:
                                        '#0f172a',
                                      outline:
                                        'none',
                                      fontFamily:
                                        'inherit',
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          )}
                        </article>
                      )
                    },
                  )}
                </>
              )}
            </div>

            <footer
              style={{
                padding:
                  '16px 28px',
                borderTop:
                  '1px solid #e5e7eb',
                display:
                  'flex',
                alignItems:
                  'center',
                justifyContent:
                  'space-between',
                gap: '16px',
                background:
                  '#ffffff',
                flexShrink: 0,
              }}
            >
              <div>
                <span
                  style={{
                    display:
                      'block',
                    fontSize:
                      '12px',
                    color:
                      '#64748b',
                    marginBottom:
                      '3px',
                  }}
                >
                  Nota final
                </span>

                <strong
                  style={{
                    fontSize:
                      '21px',
                    color:
                      '#0f172a',
                  }}
                >
                  {formatScore(
                    getCorrectionTotal(),
                  )}
                  <span
                    style={{
                      color:
                        '#94a3b8',
                      fontSize:
                        '14px',
                      fontWeight:
                        500,
                    }}
                  >
                    {' '}
                    /{' '}
                    {formatScore(
                      getCorrectionMaxTotal(),
                    )}
                  </span>
                </strong>
              </div>

              <div
                style={{
                  display:
                    'flex',
                  alignItems:
                    'center',
                  gap: '10px',
                }}
              >
                <button
                  type="button"
                  onClick={
                    closeCorrection
                  }
                  disabled={
                    correctionSaving
                  }
                  style={{
                    height:
                      '42px',
                    padding:
                      '0 17px',
                    borderRadius:
                      '9px',
                    border:
                      '1px solid #cbd5e1',
                    background:
                      '#ffffff',
                    color:
                      '#334155',
                    fontWeight:
                      600,
                    cursor:
                      correctionSaving
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  Fechar
                </button>

                <button
                  type="button"
                  onClick={
                    saveCorrection
                  }
                  disabled={
                    correctionSaving ||
                    correctionLoading ||
                    correctionExercises.length ===
                      0
                  }
                  style={{
                    height:
                      '42px',
                    padding:
                      '0 20px',
                    borderRadius:
                      '9px',
                    border:
                      'none',
                    background:
                      '#2563eb',
                    color:
                      '#ffffff',
                    fontWeight:
                      700,
                    display:
                      'flex',
                    alignItems:
                      'center',
                    gap: '8px',
                    cursor:
                      correctionSaving
                        ? 'not-allowed'
                        : 'pointer',
                    opacity:
                      correctionSaving ||
                      correctionLoading
                        ? 0.7
                        : 1,
                  }}
                >
                  {correctionSaving ? (
                    <Loader2
                      size={17}
                      className="atividades-spin"
                    />
                  ) : (
                    <CheckCircle2
                      size={17}
                    />
                  )}

                  {correctionActivity?.status ===
                  'corrigida'
                    ? 'Salvar correção novamente'
                    : 'Finalizar correção e devolver ao aluno'}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}