import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Clock3,
  CalendarClock,
  Edit3,
  Plus,
  Square,
  Trash2,
  UserRound,
  Video,
  X,
} from 'lucide-react'

import { supabase } from '../../lib/supabase'
import '../../styles/admin/Agenda.css'

/*
 * =========================================================
 * TIPOS
 * =========================================================
 */

type Aluno = {
  id: string
  nome_completo: string
}

type Professor = {
  id: string
  nome_completo: string
  email: string
  ativo: boolean
}

type Nivel = 'iniciante' | 'basico' | 'intermediario' | 'avancado'

type Horario = {
  id: string
  tipo_horario: 'individual' | 'dupla' | 'grupo'
  idioma: 'ingles' | 'alemao'
  nivel_referencia: Nivel | null
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  disponivel: boolean
  aluno_id: string | null
  professor_id: string | null
}

type RegistroAula = {
  id: string
  horario_id: string
  aluno_id: string
  professor_id: string | null
  data_aula: string
  data_aula_override: string | null
  hora_inicio_override: string | null
  hora_fim_override: string | null
  status: 'agendada' | 'presente' | 'falta'
}

type HorarioForm = {
  tipo_horario: 'individual' | 'dupla' | 'grupo'
  idioma: 'ingles' | 'alemao'
  nivel_referencia: Nivel | ''
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  disponivel: boolean
  aluno_id: string
  professor_id: string
}

type BulkCreateForm = {
  tipo_horario: 'individual' | 'dupla' | 'grupo'
  idioma: 'ingles' | 'alemao'
  nivel_referencia: Nivel | ''
  dias: number[]
  hora_inicio: string
  hora_fim: string
  duracao: number
  disponivel: boolean
  professor_id: string
}

type BulkEditForm = {
  tipo_horario: '' | 'individual' | 'dupla' | 'grupo'
  idioma: '' | 'ingles' | 'alemao'
  nivel_referencia: '' | Nivel
  dia_semana: '' | number
  hora_inicio: string
  hora_fim: string
  disponivel: '' | 'true' | 'false'
  professor_id: '' | '__none__' | string
}

/*
 * =========================================================
 * DIAS DA SEMANA
 * =========================================================
 */

const diasSemana = [
  {
    value: 1,
    label: 'Segunda',
    short: 'SEG',
  },
  {
    value: 2,
    label: 'Terça',
    short: 'TER',
  },
  {
    value: 3,
    label: 'Quarta',
    short: 'QUA',
  },
  {
    value: 4,
    label: 'Quinta',
    short: 'QUI',
  },
  {
    value: 5,
    label: 'Sexta',
    short: 'SEX',
  },
  {
    value: 6,
    label: 'Sábado',
    short: 'SÁB',
  },
  {
    value: 0,
    label: 'Domingo',
    short: 'DOM',
  },
]

/*
 * =========================================================
 * IDIOMAS
 * =========================================================
 */

const idiomas = [
  {
    value: 'ingles' as const,
    label: 'Inglês',
  },
  {
    value: 'alemao' as const,
    label: 'Alemão',
  },
]

const niveis: { value: Nivel; label: string }[] = [
  { value: 'iniciante', label: 'Iniciante' },
  { value: 'basico', label: 'Básico' },
  { value: 'intermediario', label: 'Intermediário' },
  { value: 'avancado', label: 'Avançado' },
]

/*
 * =========================================================
 * FORMULÁRIOS
 * =========================================================
 */

const initialForm: HorarioForm = {
  tipo_horario: 'individual',
  idioma: 'ingles',
  nivel_referencia: '',
  dia_semana: 1,
  hora_inicio: '08:00',
  hora_fim: '09:00',
  disponivel: true,
  aluno_id: '',
  professor_id: '',
}

const initialBulkCreateForm: BulkCreateForm = {
  tipo_horario: 'individual',
  idioma: 'ingles',
  nivel_referencia: '',
  dias: [1],
  hora_inicio: '08:00',
  hora_fim: '18:00',
  duracao: 60,
  disponivel: true,
  professor_id: '',
}

const initialBulkEditForm: BulkEditForm = {
  tipo_horario: '',
  idioma: '',
  nivel_referencia: '',
  dia_semana: '',
  hora_inicio: '',
  hora_fim: '',
  disponivel: '',
  professor_id: '',
}

/*
 * =========================================================
 * COMPONENTE
 * =========================================================
 */

export default function Agenda() {
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [professores, setProfessores] = useState<Professor[]>([])
  const [registrosAulas, setRegistrosAulas] = useState<RegistroAula[]>([])

  const [selectedDay, setSelectedDay] =
    useState<number>(new Date().getDay())

  const [openPeriod, setOpenPeriod] =
    useState<'manha' | 'tarde' | 'noite'>(() => {
      const hour = new Date().getHours()
      return hour < 12 ? 'manha' : hour < 20 ? 'tarde' : 'noite'
    })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /*
   * MODAL INDIVIDUAL
   */

  const [modalOpen, setModalOpen] = useState(false)

  const [editingId, setEditingId] =
    useState<string | null>(null)

  const [form, setForm] =
    useState<HorarioForm>(initialForm)

  /*
   * SELEÇÃO
   */

  const [selectedIds, setSelectedIds] =
    useState<string[]>([])

  const [filterTipo, setFilterTipo] = useState<'' | 'individual' | 'dupla' | 'grupo'>('')
  const [filterProfessor, setFilterProfessor] = useState('')
  const [filterNivel, setFilterNivel] = useState<'' | Nivel>('')

  /*
   * MODAIS EM MASSA
   */

  const [bulkCreateOpen, setBulkCreateOpen] =
    useState(false)

  const [bulkEditOpen, setBulkEditOpen] =
    useState(false)

  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [rescheduleSource, setRescheduleSource] = useState<Horario | null>(null)
  const [rescheduleMode, setRescheduleMode] = useState<'permanente' | 'reposicao'>('reposicao')
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [reschedulePermanentDay, setReschedulePermanentDay] = useState<number>(selectedDay)
  const [rescheduleStart, setRescheduleStart] = useState('')
  const [rescheduleEnd, setRescheduleEnd] = useState('')
  const [bulkReorganizeOpen, setBulkReorganizeOpen] = useState(false)
  const [bulkReorganizeDay, setBulkReorganizeDay] = useState<number>(selectedDay)
  const [bulkReorganizeStart, setBulkReorganizeStart] = useState('08:00')

  const [bulkCreateForm, setBulkCreateForm] =
    useState<BulkCreateForm>(
      initialBulkCreateForm,
    )

  const [bulkEditForm, setBulkEditForm] =
    useState<BulkEditForm>(
      initialBulkEditForm,
    )

  /*
   * =======================================================
   * CARREGAR AGENDA
   * =======================================================
   */

  useEffect(() => {
    void loadAgenda()
  }, [])

  async function loadAgenda() {
    try {
      setLoading(true)
      setError(null)

      const [
        horariosResult,
        alunosResult,
        professoresResult,
        registrosResult,
      ] = await Promise.all([
        supabase
          .from('horarios')
          .select(`
            id,
            tipo_horario,
            idioma,
            nivel_referencia,
            dia_semana,
            hora_inicio,
            hora_fim,
            disponivel,
            aluno_id,
            professor_id
          `)
          .order('dia_semana', {
            ascending: true,
          })
          .order('hora_inicio', {
            ascending: true,
          }),

        supabase
          .from('alunos')
          .select(`
            id,
            nome_completo
          `)
          .order('nome_completo', {
            ascending: true,
          }),

        supabase
          .from('professores')
          .select(`
            id,
            nome_completo,
            email,
            ativo
          `)
          .eq('ativo', true)
          .order('nome_completo', {
            ascending: true,
          }),

        supabase
          .from('registros_aulas')
          .select('id, horario_id, aluno_id, professor_id, data_aula, data_aula_override, hora_inicio_override, hora_fim_override, status')
          .order('data_aula', { ascending: true }),
      ])

      if (horariosResult.error) {
        throw horariosResult.error
      }

      if (alunosResult.error) {
        throw alunosResult.error
      }

      if (professoresResult.error) {
        throw professoresResult.error
      }

      if (registrosResult.error) {
        throw registrosResult.error
      }

      setHorarios(
        (horariosResult.data || []) as Horario[],
      )

      setAlunos(
        (alunosResult.data || []) as Aluno[],
      )

      setProfessores(
        (professoresResult.data || []) as Professor[],
      )

      setRegistrosAulas(
        (registrosResult.data || []) as RegistroAula[],
      )

      setSelectedIds((current) =>
        current.filter((id) =>
          (horariosResult.data || []).some(
            (horario) => horario.id === id,
          ),
        ),
      )
    } catch (err) {
      console.error(
        'Erro ao carregar agenda:',
        err,
      )

      setError(
        `Não foi possível carregar a agenda.\n${getErrorMessage(
          err,
        )}`,
      )
    } finally {
      setLoading(false)
    }
  }

  /*
   * =======================================================
   * HORÁRIOS DO DIA
   * =======================================================
   */

  const horariosDoDia = useMemo(() => {
    return horarios
      .filter(
        (horario) =>
          horario.dia_semana === selectedDay &&
          (filterTipo === '' || horario.tipo_horario === filterTipo) &&
          (filterProfessor === '' || horario.professor_id === filterProfessor) &&
          (filterNivel === '' || horario.nivel_referencia === filterNivel),
      )
      .sort((a, b) =>
        a.hora_inicio.localeCompare(
          b.hora_inicio,
        ),
      )
  }, [horarios, selectedDay, filterTipo, filterProfessor, filterNivel])

  const reposicoesDoDia = useMemo(() => {
    return registrosAulas.filter((registro) =>
      Boolean(registro.data_aula_override) &&
      new Date(registro.data_aula_override + 'T12:00:00').getDay() === selectedDay &&
      Boolean(registro.hora_inicio_override) &&
      Boolean(registro.hora_fim_override) &&
      horarios.some((horario) =>
        horario.id === registro.horario_id &&
        horario.aluno_id === registro.aluno_id &&
        (filterTipo === '' || horario.tipo_horario === filterTipo) &&
        (filterProfessor === '' || horario.professor_id === filterProfessor) &&
        (filterNivel === '' || horario.nivel_referencia === filterNivel)
      ),
    )
  }, [registrosAulas, horarios, selectedDay, filterTipo, filterProfessor, filterNivel])

  const agendaNow = new Date()
  const agendaToday = agendaNow.getDay()
  const agendaNowMinutes = agendaNow.getHours() * 60 + agendaNow.getMinutes()

  const proximoHorarioId =
    selectedDay === agendaToday
      ? horariosDoDia.find((horario) => {
          const inicio = timeToMinutes(formatHour(horario.hora_inicio))
          const fim = timeToMinutes(formatHour(horario.hora_fim))
          return fim > agendaNowMinutes && inicio >= agendaNowMinutes
        })?.id || null
      : null

  const horarioAtualId =
    selectedDay === agendaToday
      ? horariosDoDia.find((horario) => {
          const inicio = timeToMinutes(formatHour(horario.hora_inicio))
          const fim = timeToMinutes(formatHour(horario.hora_fim))
          return inicio <= agendaNowMinutes && fim > agendaNowMinutes
        })?.id || null
      : null

  /*
   * =======================================================
   * SELEÇÃO
   * =======================================================
   */

  const selectedHorarios = useMemo(() => {
    return horarios.filter((horario) =>
      selectedIds.includes(horario.id),
    )
  }, [horarios, selectedIds])

  const allDaySelected =
    horariosDoDia.length > 0 &&
    horariosDoDia.every((horario) =>
      selectedIds.includes(horario.id),
    )

  function toggleSelection(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter(
            (selectedId) =>
              selectedId !== id,
          )
        : [...current, id],
    )
  }

  function toggleSelectAllDay() {
    const dayIds = horariosDoDia.map(
      (horario) => horario.id,
    )

    if (allDaySelected) {
      setSelectedIds((current) =>
        current.filter(
          (id) => !dayIds.includes(id),
        ),
      )
    } else {
      setSelectedIds((current) => [
        ...new Set([
          ...current,
          ...dayIds,
        ]),
      ])
    }
  }

  function clearSelection() {
    setSelectedIds([])
  }

  /*
   * =======================================================
   * AUXILIARES
   * =======================================================
   */

  function getAlunoNome(
    alunoId: string | null,
  ) {
    if (!alunoId) {
      return null
    }

    return (
      alunos.find(
        (aluno) => aluno.id === alunoId,
      )?.nome_completo || null
    )
  }

  function getProfessorNome(
    professorId: string | null,
  ) {
    if (!professorId) {
      return null
    }

    return (
      professores.find(
        (professor) =>
          professor.id === professorId,
      )?.nome_completo || null
    )
  }

  function getIdiomaLabel(
    idioma: string,
  ) {
    return (
      idiomas.find(
        (item) => item.value === idioma,
      )?.label || idioma
    )
  }

  function getDayLabel(day: number) {
    return (
      diasSemana.find(
        (dia) => dia.value === day,
      )?.label || ''
    )
  }

  function formatHour(value: string) {
    return value?.slice(0, 5) || '--:--'
  }

  function getNextOccurrence(dayOfWeek: number, startTime: string, endTime: string) {
    const now = new Date()
    const startParts = startTime.slice(0, 5).split(':').map(Number)
    const endParts = endTime.slice(0, 5).split(':').map(Number)
    let daysUntil = dayOfWeek - now.getDay()
    if (daysUntil < 0) daysUntil += 7
    if (daysUntil === 0 && (now.getHours() > endParts[0] || (now.getHours() === endParts[0] && now.getMinutes() >= endParts[1]))) daysUntil = 7
    const startAt = new Date(now)
    startAt.setDate(now.getDate() + daysUntil)
    startAt.setHours(startParts[0], startParts[1], 0, 0)
    const endAt = new Date(startAt)
    endAt.setHours(endParts[0], endParts[1], 0, 0)
    return { startAt, endAt }
  }

  function dateKey(date: Date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
  }

  function formatDateKey(value: string) {
    const parts = value.split('-')
    return parts[2] + '/' + parts[1] + '/' + parts[0]
  }

  function timeToMinutes(value: string) {
    const [hours, minutes] =
      value.split(':').map(Number)

    return (
      hours * 60 + minutes
    )
  }

  function minutesToTime(
    totalMinutes: number,
  ) {
    const hours = Math.floor(
      totalMinutes / 60,
    )

    const minutes =
      totalMinutes % 60

    return `${String(hours).padStart(
      2,
      '0',
    )}:${String(minutes).padStart(
      2,
      '0',
    )}`
  }

  function getConflictingHorario(
    day: number,
    start: string,
    end: string,
    ignoredIds: string[] = [],
    idioma?: 'ingles' | 'alemao',
    professorId?: string | null,
    tipoHorario?: 'individual' | 'dupla' | 'grupo',
  ) {
    const startMinutes = timeToMinutes(start)
    const endMinutes = timeToMinutes(end)

    return horarios.find((horario) => {
      if (horario.dia_semana !== day) return false
      if (ignoredIds.includes(horario.id)) return false

      const existingStart = timeToMinutes(horario.hora_inicio.slice(0, 5))
      const existingEnd = timeToMinutes(horario.hora_fim.slice(0, 5))

      if (
        startMinutes >= existingEnd ||
        endMinutes <= existingStart
      ) {
        return false
      }

      // Idiomas diferentes podem ocupar o mesmo intervalo.
      if (idioma && horario.idioma !== idioma) {
        return false
      }

      // Para o mesmo idioma, professores diferentes podem ter
      // horários coincidentes.
      if (
        professorId &&
        horario.professor_id &&
        professorId !== horario.professor_id
      ) {
        return false
      }

      // Individual, dupla e grupo podem compartilhar o mesmo intervalo.
      // Apenas o mesmo tipo de horário é considerado duplicado no cadastro.
      if (tipoHorario && horario.tipo_horario !== tipoHorario) {
        return false
      }

      return true
    })
  }

  function openRescheduleModal(horario: Horario) {
    if (!horario.aluno_id) return

    const occurrence = getNextOccurrence(
      horario.dia_semana,
      horario.hora_inicio,
      horario.hora_fim,
    )

    setRescheduleSource(horario)
    setRescheduleMode('reposicao')
    setRescheduleDate(dateKey(occurrence.startAt))
    setReschedulePermanentDay(horario.dia_semana)
    setRescheduleStart(formatHour(horario.hora_inicio))
    setRescheduleEnd(formatHour(horario.hora_fim))
    setRescheduleOpen(true)
  }

  function closeRescheduleModal() {
    if (saving) return
    setRescheduleOpen(false)
    setRescheduleSource(null)
    setRescheduleMode('reposicao')
    setRescheduleDate('')
    setReschedulePermanentDay(selectedDay)
    setRescheduleStart('')
    setRescheduleEnd('')
  }

  async function handleReschedule() {
    if (
      !rescheduleSource ||
      !rescheduleStart ||
      !rescheduleEnd ||
      (rescheduleMode === 'reposicao' && !rescheduleDate)
    ) {
      return
    }

    try {
      setSaving(true)

      const startMinutes = timeToMinutes(rescheduleStart)
      const endMinutes = timeToMinutes(rescheduleEnd)

      if (endMinutes <= startMinutes) {
        throw new Error('O horário final deve ser posterior ao horário inicial.')
      }

      const sourceOccurrence = getNextOccurrence(
        rescheduleSource.dia_semana,
        rescheduleSource.hora_inicio,
        rescheduleSource.hora_fim,
      )

      const targetDay =
        rescheduleMode === 'permanente'
          ? reschedulePermanentDay
          : new Date(rescheduleDate + 'T' + rescheduleStart + ':00').getDay()

      if (rescheduleMode === 'reposicao') {
        const targetDateObject = new Date(
          rescheduleDate + 'T' + rescheduleStart + ':00',
        )

        if (Number.isNaN(targetDateObject.getTime())) {
          throw new Error('A data escolhida é inválida.')
        }

        if (targetDateObject.getTime() <= Date.now()) {
          throw new Error('Escolha uma data e horário futuros.')
        }
      }

      if (rescheduleMode === 'permanente') {
        const conflictingHorario = horarios.find((horario) => {
          if (
            horario.id === rescheduleSource.id ||
            horario.dia_semana !== targetDay ||
            horario.professor_id !== rescheduleSource.professor_id ||
            horario.idioma !== rescheduleSource.idioma
          ) {
            return false
          }

          const existingStart = timeToMinutes(horario.hora_inicio.slice(0, 5))
          const existingEnd = timeToMinutes(horario.hora_fim.slice(0, 5))

          return (
            startMinutes < existingEnd &&
            endMinutes > existingStart
          )
        })

        if (conflictingHorario) {
          throw new Error(
            'O professor já possui um horário cadastrado no período escolhido: ' +
              formatHour(conflictingHorario.hora_inicio) +
              '–' +
              formatHour(conflictingHorario.hora_fim) +
              '.',
          )
        }

        const { error } = await supabase
          .from('horarios')
          .update({
            dia_semana: targetDay,
            hora_inicio: rescheduleStart,
            hora_fim: rescheduleEnd,
          })
          .eq('id', rescheduleSource.id)

        if (error) throw error

        closeRescheduleModal()
        await loadAgenda()

        window.alert(
          'Horário alterado definitivamente para ' +
            getDayLabel(targetDay) +
            ' das ' +
            rescheduleStart +
            ' às ' +
            rescheduleEnd +
            '.',
        )

        return
      }

      const isFreeHorario = (horario: Horario) =>
        horario.aluno_id === null && horario.disponivel === true

      const conflictingHorario = rescheduleSource.professor_id
        ? horarios.find((horario) => {
            if (
              horario.id === rescheduleSource.id ||
              horario.dia_semana !== targetDay ||
              horario.professor_id !== rescheduleSource.professor_id
            ) {
              return false
            }

            if (isFreeHorario(horario)) {
              return false
            }

            const existingStart = timeToMinutes(horario.hora_inicio.slice(0, 5))
            const existingEnd = timeToMinutes(horario.hora_fim.slice(0, 5))

            return (
              startMinutes < existingEnd &&
              endMinutes > existingStart
            )
          })
        : horarios.find((horario) => {
            if (
              horario.id === rescheduleSource.id ||
              horario.dia_semana !== targetDay ||
              horario.idioma !== rescheduleSource.idioma
            ) {
              return false
            }

            if (isFreeHorario(horario)) {
              return false
            }

            const existingStart = timeToMinutes(horario.hora_inicio.slice(0, 5))
            const existingEnd = timeToMinutes(horario.hora_fim.slice(0, 5))

            return (
              startMinutes < existingEnd &&
              endMinutes > existingStart
            )
          })

      if (conflictingHorario) {
        throw new Error(
          'O professor já possui um horário no período escolhido: ' +
            formatHour(conflictingHorario.hora_inicio) +
            '–' +
            formatHour(conflictingHorario.hora_fim) +
            '.',
        )
      }

      const { data: existingTargets, error: targetError } =
        await supabase
          .from('registros_aulas')
          .select(
            'id, horario_id, aluno_id, hora_inicio_override, hora_fim_override',
          )
          .eq('data_aula_override', rescheduleDate)

      if (targetError) throw targetError

      const overrideConflict = (existingTargets || []).some((registro) => {
        if (
          registro.horario_id === rescheduleSource.id ||
          registro.aluno_id === rescheduleSource.aluno_id
        ) {
          return false
        }

        if (!registro.hora_inicio_override || !registro.hora_fim_override) {
          return false
        }

        const existingStart = timeToMinutes(
          registro.hora_inicio_override.slice(0, 5),
        )
        const existingEnd = timeToMinutes(
          registro.hora_fim_override.slice(0, 5),
        )

        return startMinutes < existingEnd && endMinutes > existingStart
      })

      if (overrideConflict) {
        throw new Error(
          'O horário escolhido já está reservado para outra aula reagendada.',
        )
      }

      const { data: existingSource, error: sourceError } =
        await supabase
          .from('registros_aulas')
          .select('id, status')
          .eq('horario_id', rescheduleSource.id)
          .eq('data_aula', dateKey(sourceOccurrence.startAt))
          .limit(1)
          .maybeSingle()

      if (sourceError) throw sourceError

      if (
        existingSource &&
        (existingSource.status === 'presente' ||
          existingSource.status === 'falta')
      ) {
        throw new Error(
          'A próxima ocorrência já possui presença registrada e não pode ser reagendada.',
        )
      }

      const payload = {
        horario_id: rescheduleSource.id,
        aluno_id: rescheduleSource.aluno_id,
        professor_id: rescheduleSource.professor_id,
        data_aula: dateKey(sourceOccurrence.startAt),
        data_aula_override: rescheduleDate,
        hora_inicio_override: rescheduleStart,
        hora_fim_override: rescheduleEnd,
        status: existingSource?.status || 'agendada',
      }

      if (existingSource) {
        const { error } = await supabase
          .from('registros_aulas')
          .update(payload)
          .eq('id', existingSource.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('registros_aulas')
          .insert(payload)

        if (error) throw error
      }

      closeRescheduleModal()
      await loadAgenda()

      window.alert(
        'Reposição agendada para ' +
          formatDateKey(rescheduleDate) +
          ' das ' +
          rescheduleStart +
          ' às ' +
          rescheduleEnd +
          '. O horário recorrente original não foi alterado.',
      )
    } catch (err) {
      console.error('Erro ao ajustar aula:', err)
      window.alert(
        'Não foi possível ajustar a aula.\\n\\n' +
          getErrorMessage(err),
      )
    } finally {
      setSaving(false)
    }
  }

  /*
   * =======================================================
   * MODAL - CRIAR
   * =======================================================
   */

  function openCreateModal() {
    setEditingId(null)

    setForm({
      ...initialForm,
      dia_semana: selectedDay,
    })

    setModalOpen(true)
  }

  /*
   * =======================================================
   * MODAL - EDITAR
   * =======================================================
   */

  function openEditModal(
    horario: Horario,
  ) {
    setEditingId(horario.id)

    setForm({
      tipo_horario: horario.tipo_horario || 'individual',
      nivel_referencia: horario.nivel_referencia || '',
      idioma:
        horario.idioma === 'alemao'
          ? 'alemao'
          : 'ingles',

      dia_semana:
        horario.dia_semana,

      hora_inicio:
        formatHour(
          horario.hora_inicio,
        ),

      hora_fim:
        formatHour(
          horario.hora_fim,
        ),

      disponivel:
        horario.disponivel,

      aluno_id:
        horario.aluno_id || '',

      professor_id:
        horario.professor_id || '',
    })

    setModalOpen(true)
  }

  function closeModal() {
    if (saving) {
      return
    }

    setModalOpen(false)
    setEditingId(null)

    setForm({
      ...initialForm,
      dia_semana: selectedDay,
    })
  }

  /*
   * =======================================================
   * SALVAR HORÁRIO INDIVIDUAL
   * =======================================================
   */

  async function handleSave() {
    try {
      setSaving(true)
      setError(null)

      if (!form.hora_inicio) {
        throw new Error(
          'Informe o horário inicial.',
        )
      }

      if (!form.hora_fim) {
        throw new Error(
          'Informe o horário final.',
        )
      }

      if (
        form.hora_inicio >=
        form.hora_fim
      ) {
        throw new Error(
          'O horário final deve ser maior que o horário inicial.',
        )
      }

      if (form.aluno_id && form.tipo_horario !== 'individual') {
        throw new Error('Um horário já matriculado individualmente deve permanecer como Individual. Para transformá-lo em dupla ou grupo, primeiro remova a matrícula deste horário.')
      }

      const conflict =
        getConflictingHorario(
          form.dia_semana,
          form.hora_inicio,
          form.hora_fim,
          editingId
            ? [editingId]
            : [],
                    form.idioma,
            form.professor_id || null,
            form.tipo_horario,
          )

      if (conflict) {
        throw new Error(
          `Já existe um horário entre ${formatHour(
            conflict.hora_inicio,
          )} e ${formatHour(
            conflict.hora_fim,
          )} neste dia.`,
        )
      }

      const payload = {
        tipo_horario: form.tipo_horario,
        idioma: form.idioma,
        nivel_referencia: form.nivel_referencia || null,
        dia_semana: form.dia_semana,
        hora_inicio:
          form.hora_inicio,
        hora_fim:
          form.hora_fim,
        aluno_id:
          form.aluno_id || null,
        professor_id:
          form.professor_id || null,
        disponivel:
          form.aluno_id
            ? false
            : form.disponivel,
      }

      if (editingId) {
        const {
          error: updateError,
        } = await supabase
          .from('horarios')
          .update(payload)
          .eq('id', editingId)

        if (updateError) {
          throw updateError
        }

        window.alert(
          'Horário atualizado com sucesso.',
        )
      } else {
        const {
          error: insertError,
        } = await supabase
          .from('horarios')
          .insert(payload)

        if (insertError) {
          throw insertError
        }

        window.alert(
          'Horário criado com sucesso.',
        )
      }

      closeModal()
      await loadAgenda()
    } catch (err) {
      console.error(
        'Erro ao salvar horário:',
        err,
      )

      window.alert(
        `Não foi possível salvar o horário.\n\n${getErrorMessage(
          err,
        )}`,
      )
    } finally {
      setSaving(false)
    }
  }

  /*
   * =======================================================
   * CRIAÇÃO EM MASSA
   * =======================================================
   */

  function openBulkCreateModal() {
    setBulkCreateForm({
      ...initialBulkCreateForm,
      dias: [selectedDay],
    })

    setBulkCreateOpen(true)
  }

  function closeBulkCreateModal() {
    if (saving) {
      return
    }

    setBulkCreateOpen(false)

    setBulkCreateForm({
      ...initialBulkCreateForm,
      dias: [selectedDay],
    })
  }

  function toggleBulkCreateDay(
    day: number,
  ) {
    setBulkCreateForm((current) => {
      const exists =
        current.dias.includes(day)

      return {
        ...current,
        dias: exists
          ? current.dias.filter(
              (item) => item !== day,
            )
          : [
              ...current.dias,
              day,
            ],
      }
    })
  }

  async function handleBulkCreate() {
    try {
      setSaving(true)
      setError(null)

      if (
        bulkCreateForm.dias.length ===
        0
      ) {
        throw new Error(
          'Selecione pelo menos um dia da semana.',
        )
      }

      if (
        !bulkCreateForm.hora_inicio ||
        !bulkCreateForm.hora_fim
      ) {
        throw new Error(
          'Informe o intervalo de horários.',
        )
      }

      const start =
        timeToMinutes(
          bulkCreateForm.hora_inicio,
        )

      const end =
        timeToMinutes(
          bulkCreateForm.hora_fim,
        )

      if (start >= end) {
        throw new Error(
          'O horário final deve ser maior que o horário inicial.',
        )
      }

      if (
        bulkCreateForm.duracao <=
        0
      ) {
        throw new Error(
          'A duração da aula deve ser maior que zero.',
        )
      }

      const newSlots: {
        tipo_horario: 'individual' | 'dupla' | 'grupo'
        nivel_referencia: Nivel | null
        idioma:
          | 'ingles'
          | 'alemao'
        dia_semana: number
        hora_inicio: string
        hora_fim: string
        disponivel: boolean
        aluno_id: null
        professor_id: string | null
      }[] = []

      const conflicts: string[] = []

      for (const day of bulkCreateForm.dias) {
        let currentStart = start

        while (
          currentStart +
            bulkCreateForm.duracao <=
          end
        ) {
          const currentEnd =
            currentStart +
            bulkCreateForm.duracao

          const startTime =
            minutesToTime(
              currentStart,
            )

          const endTime =
            minutesToTime(
              currentEnd,
            )

          const conflict =
            getConflictingHorario(
              day,
              startTime,
              endTime,
              [],
              bulkCreateForm.idioma,
              bulkCreateForm.professor_id || null,
              bulkCreateForm.tipo_horario,
            )

          if (conflict) {
            conflicts.push(
              `${getDayLabel(
                day,
              )} ${startTime}–${endTime}`,
            )
          } else {
            newSlots.push({
              tipo_horario: bulkCreateForm.tipo_horario,
              nivel_referencia: bulkCreateForm.nivel_referencia || null,
              idioma:
                bulkCreateForm.idioma,
              dia_semana: day,
              hora_inicio:
                startTime,
              hora_fim:
                endTime,
              disponivel:
                bulkCreateForm.disponivel,
              aluno_id: null,
              professor_id:
                bulkCreateForm.professor_id ||
                null,
            })
          }

          currentStart =
            currentEnd
        }
      }

      if (
        newSlots.length === 0
      ) {
        if (
          conflicts.length > 0
        ) {
          throw new Error(
            'Nenhum novo horário foi criado porque todos os horários gerados já existem.',
          )
        }

        throw new Error(
          'Nenhum horário válido foi gerado para o intervalo informado.',
        )
      }

      const {
        error: insertError,
      } = await supabase
        .from('horarios')
        .insert(newSlots)

      if (insertError) {
        throw insertError
      }

      let message =
        `${newSlots.length} horário(s) criado(s) com sucesso.`

      if (conflicts.length > 0) {
        message += `\n\n${conflicts.length} horário(s) já existente(s) foram ignorado(s).`
      }

      closeBulkCreateModal()
      await loadAgenda()

      window.alert(message)
    } catch (err) {
      console.error(
        'Erro ao criar horários em massa:',
        err,
      )

      window.alert(
        `Não foi possível criar os horários.\n\n${getErrorMessage(
          err,
        )}`,
      )
    } finally {
      setSaving(false)
    }
  }

  /*
   * =======================================================
   * EDIÇÃO EM MASSA
   * =======================================================
   */

  function openBulkEditModal() {
    if (
      selectedIds.length === 0
    ) {
      return
    }

    setBulkEditForm(
      initialBulkEditForm,
    )

    setBulkEditOpen(true)
  }

  function closeBulkEditModal() {
    if (saving) {
      return
    }

    setBulkEditOpen(false)

    setBulkEditForm(
      initialBulkEditForm,
    )
  }

  async function handleBulkEdit() {
    try {
      setSaving(true)
      setError(null)

      if (
        selectedIds.length === 0
      ) {
        throw new Error(
          'Selecione pelo menos um horário.',
        )
      }

      const selected =
        selectedHorarios

      if (bulkEditForm.tipo_horario) {
        const { data: turmaLinks, error: turmaLinksError } = await supabase
          .from('turma_horarios')
          .select('horario_id')
          .in('horario_id', selectedIds)

        if (turmaLinksError) throw turmaLinksError

        if ((turmaLinks || []).length > 0) {
          const linkedIds = new Set((turmaLinks || []).map((link) => link.horario_id))
          const incompatible = selected.filter(
            (horario) =>
              linkedIds.has(horario.id) &&
              horario.tipo_horario !== bulkEditForm.tipo_horario,
          )

          if (incompatible.length > 0) {
            throw new Error(
              'Um ou mais horários selecionados estão vinculados a turmas fixas. Remova o vínculo com a turma antes de alterar o tipo de horário.',
            )
          }
        }
      }

      /*
       * Validar os novos horários
       * antes de alterar qualquer registro.
       */

      for (const horario of selected) {
        const nextDay =
          bulkEditForm.dia_semana === ''
            ? horario.dia_semana
            : Number(
                bulkEditForm.dia_semana,
              )

        const nextStart =
          bulkEditForm.hora_inicio ||
          formatHour(
            horario.hora_inicio,
          )

        const nextEnd =
          bulkEditForm.hora_fim ||
          formatHour(
            horario.hora_fim,
          )

        if (
          nextStart >= nextEnd
        ) {
          throw new Error(
            `O horário ${formatHour(
              horario.hora_inicio,
            )}–${formatHour(
              horario.hora_fim,
            )} possui horário final inválido.`,
          )
        }

        const nextTipo =
          bulkEditForm.tipo_horario || horario.tipo_horario

        if (horario.aluno_id && nextTipo !== horario.tipo_horario) {
          throw new Error(
            'O horário ' +
              formatHour(horario.hora_inicio) +
              ' possui aluno vinculado e não pode mudar de tipo.',
          )
        }

        const nextIdioma =
          bulkEditForm.idioma || horario.idioma

        const nextProfessor =
          bulkEditForm.professor_id === ''
            ? horario.professor_id
            : bulkEditForm.professor_id === '__none__'
              ? null
              : bulkEditForm.professor_id

        const conflict =
          getConflictingHorario(
            nextDay,
            nextStart,
            nextEnd,
            selectedIds,
            nextIdioma,
            nextProfessor,
            nextTipo,
          )

        if (conflict) {
          throw new Error(
            `A alteração criaria conflito em ${getDayLabel(
              nextDay,
            )} ${nextStart}–${nextEnd}.`,
          )
        }
      }

      /*
       * Atualização individual dos
       * registros selecionados.
       */

      for (const horario of selected) {
        const payload: Partial<Horario> =
          {}

        if (bulkEditForm.tipo_horario) {
          payload.tipo_horario = bulkEditForm.tipo_horario
        }

        if (bulkEditForm.idioma) {
          payload.idioma = bulkEditForm.idioma
        }

        if (bulkEditForm.nivel_referencia) {
          payload.nivel_referencia = bulkEditForm.nivel_referencia
        }

        if (
          bulkEditForm.dia_semana !==
          ''
        ) {
          payload.dia_semana =
            Number(
              bulkEditForm.dia_semana,
            )
        }

        if (
          bulkEditForm.hora_inicio
        ) {
          payload.hora_inicio =
            bulkEditForm.hora_inicio
        }

        if (
          bulkEditForm.hora_fim
        ) {
          payload.hora_fim =
            bulkEditForm.hora_fim
        }

        if (
          bulkEditForm.disponivel !==
          ''
        ) {
          payload.disponivel =
            horario.aluno_id
              ? false
              : bulkEditForm.disponivel ===
                  'true'
                ? true
                : false
        }

        if (
          bulkEditForm.professor_id !==
          ''
        ) {
          payload.professor_id =
            bulkEditForm.professor_id ===
            '__none__'
              ? null
              : bulkEditForm.professor_id
        }

        if (
          Object.keys(payload)
            .length === 0
        ) {
          continue
        }

        const {
          error: updateError,
        } = await supabase
          .from('horarios')
          .update(payload)
          .eq('id', horario.id)

        if (updateError) {
          throw updateError
        }
      }

      closeBulkEditModal()
      clearSelection()

      await loadAgenda()

      window.alert(
        `${selected.length} horário(s) atualizado(s) com sucesso.`,
      )
    } catch (err) {
      console.error(
        'Erro ao editar horários em massa:',
        err,
      )

      window.alert(
        `Não foi possível editar os horários.\n\n${getErrorMessage(
          err,
        )}`,
      )
    } finally {
      setSaving(false)
    }
  }

  /*
   * =======================================================
   * REORGANIZAÇÃO EM MASSA
   * =======================================================
   */

  function closeBulkReorganizeModal() {
    if (saving) return
    setBulkReorganizeOpen(false)
  }

  async function handleBulkReorganize() {
    try {
      setSaving(true)
      setError(null)

      if (selectedHorarios.length === 0) throw new Error('Selecione pelo menos um horário.')

      const ordered = [...selectedHorarios].sort(
        (a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio),
      )
      const baseOldStart = timeToMinutes(formatHour(ordered[0].hora_inicio))
      const baseNewStart = timeToMinutes(bulkReorganizeStart)
      const updates = ordered.map((horario) => {
        const offset = timeToMinutes(formatHour(horario.hora_inicio)) - baseOldStart
        const duration = timeToMinutes(formatHour(horario.hora_fim)) - timeToMinutes(formatHour(horario.hora_inicio))
        const start = baseNewStart + offset
        return {
          horario,
          dia: bulkReorganizeDay,
          inicio: minutesToTime(start),
          fim: minutesToTime(start + duration),
        }
      })

      if (updates.some((item) => timeToMinutes(item.inicio) >= timeToMinutes(item.fim) || timeToMinutes(item.fim) > 24 * 60)) {
        throw new Error('A reorganização gera um horário inválido ou ultrapassa 24:00.')
      }

      for (let index = 0; index < updates.length; index += 1) {
        const current = updates[index]
        for (let otherIndex = index + 1; otherIndex < updates.length; otherIndex += 1) {
          const other = updates[otherIndex]
          if (
            current.dia === other.dia &&
            current.horario.idioma === other.horario.idioma &&
            current.horario.professor_id &&
            current.horario.professor_id === other.horario.professor_id &&
            current.horario.tipo_horario === other.horario.tipo_horario &&
            timeToMinutes(current.inicio) < timeToMinutes(other.fim) &&
            timeToMinutes(current.fim) > timeToMinutes(other.inicio)
          ) {
            throw new Error(
              'A reorganização criaria conflito entre os próprios horários selecionados em ' +
                getDayLabel(current.dia) +
                '.',
            )
          }
        }
      }

      for (const item of updates) {
        const conflict = getConflictingHorario(
          item.dia,
          item.inicio,
          item.fim,
          selectedIds,
          item.horario.idioma,
          item.horario.professor_id,
          item.horario.tipo_horario,
        )
        if (conflict) {
          throw new Error(
            'A reorganização criaria conflito em ' +
              getDayLabel(item.dia) + ' ' + item.inicio + '–' + item.fim + '.',
          )
        }
      }

      for (const item of updates) {
        const { error: updateError } = await supabase
          .from('horarios')
          .update({ dia_semana: item.dia, hora_inicio: item.inicio, hora_fim: item.fim })
          .eq('id', item.horario.id)
        if (updateError) throw updateError
      }

      closeBulkReorganizeModal()
      clearSelection()
      await loadAgenda()
      window.alert(
        updates.length +
          ' horário(s) reorganizado(s) com sucesso. Duração e espaçamento entre horários foram preservados.',
      )
    } catch (err) {
      console.error('Erro ao reorganizar horários em massa:', err)
      window.alert('Não foi possível reorganizar os horários.\n\n' + getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  /*
   * =======================================================
   * EXCLUSÃO EM MASSA
   * =======================================================
   */

  async function handleBulkDelete() {
    if (
      selectedIds.length === 0
    ) {
      return
    }

    const selected =
      selectedHorarios

    const occupied =
      selected.filter(
        (horario) =>
          !!horario.aluno_id,
      )

    const deletable =
      selected.filter(
        (horario) =>
          !horario.aluno_id,
      )

    if (
      deletable.length === 0
    ) {
      window.alert(
        'Nenhum dos horários selecionados pode ser excluído porque todos possuem alunos vinculados.',
      )

      return
    }

    const confirmed =
      window.confirm(
        `Você selecionou ${selected.length} horário(s).\n\n` +
          `${deletable.length} será(ão) excluído(s).\n` +
          `${occupied.length} será(ão) preservado(s) porque possuem aluno vinculado.\n\n` +
          `Deseja continuar?`,
      )

    if (!confirmed) {
      return
    }

    try {
      setSaving(true)
      setError(null)

      const deletableIds =
        deletable.map(
          (horario) =>
            horario.id,
        )

      const {
        error: deleteError,
      } = await supabase
        .from('horarios')
        .delete()
        .in(
          'id',
          deletableIds,
        )

      if (deleteError) {
        throw deleteError
      }

      clearSelection()
      await loadAgenda()

      window.alert(
        `${deletable.length} horário(s) excluído(s) com sucesso.` +
          (occupied.length > 0
            ? `\n\n${occupied.length} horário(s) ocupado(s) foram preservados.`
            : ''),
      )
    } catch (err) {
      console.error(
        'Erro ao excluir horários em massa:',
        err,
      )

      window.alert(
        `Não foi possível excluir os horários.\n\n${getErrorMessage(
          err,
        )}`,
      )
    } finally {
      setSaving(false)
    }
  }

  /*
   * =======================================================
   * DISPONIBILIDADE
   * =======================================================
   */

  async function toggleAvailability(
    horario: Horario,
  ) {
    if (horario.aluno_id) {
      return
    }

    try {
      setError(null)

      const novoStatus =
        !horario.disponivel

      const {
        error: updateError,
      } = await supabase
        .from('horarios')
        .update({
          disponivel:
            novoStatus,
        })
        .eq(
          'id',
          horario.id,
        )

      if (updateError) {
        throw updateError
      }

      await loadAgenda()
    } catch (err) {
      console.error(
        'Erro ao alterar disponibilidade:',
        err,
      )

      window.alert(
        `Não foi possível alterar a disponibilidade.\n\n${getErrorMessage(
          err,
        )}`,
      )
    }
  }

  /*
   * =======================================================
   * DESVINCULAR ALUNO
   * =======================================================
   */

  async function unlinkStudent(
    horario: Horario,
  ) {
    if (!horario.aluno_id) {
      return
    }

    const confirmed =
      window.confirm(
        'Deseja realmente desvincular o aluno deste horário?',
      )

    if (!confirmed) {
      return
    }

    try {
      setError(null)

      const {
        error: updateError,
      } = await supabase
        .from('horarios')
        .update({
          aluno_id: null,
          disponivel: true,
        })
        .eq(
          'id',
          horario.id,
        )

      if (updateError) {
        throw updateError
      }

      await loadAgenda()
    } catch (err) {
      console.error(
        'Erro ao desvincular aluno:',
        err,
      )

      window.alert(
        `Não foi possível desvincular o aluno.\n\n${getErrorMessage(
          err,
        )}`,
      )
    }
  }

  /*
   * =======================================================
   * ENTRAR NA AULA
   * =======================================================
   */

  function openTeacherRoom(
    horario: Horario,
  ) {
    if (!horario.aluno_id) {
      window.alert(
        'Este horário ainda não possui um aluno vinculado.',
      )

      return
    }

    window.location.href =
      `/admin/aula/${horario.id}`
  }

  /*
   * =======================================================
   * ERROS
   * =======================================================
   */

  function getErrorMessage(
    err: unknown,
  ) {
    if (
      err &&
      typeof err === 'object'
    ) {
      const error =
        err as {
          message?: string
          details?: string
          hint?: string
          code?: string
        }

      const parts = [
        error.message,
        error.details,
        error.hint,
        error.code
          ? `Código: ${error.code}`
          : null,
      ].filter(Boolean)

      if (parts.length > 0) {
        return parts.join('\n')
      }
    }

    if (
      err instanceof Error
    ) {
      return err.message
    }

    return 'Erro desconhecido.'
  }

  /*
   * =======================================================
   * RENDER
   * =======================================================
   */

  return (
    <section className="agenda-page">

      {/* HEADER */}

      <div className="agenda-page-header">
        <div>
          <h1>Agenda</h1>

          <p>
            Gerencie horários, aulas e
            disponibilidade.
          </p>
        </div>

        <div className="agenda-header-actions">

          <button
            type="button"
            className="agenda-secondary-header-button"
            onClick={
              openBulkCreateModal
            }
          >
            <CalendarDays size={17} />

            Adicionar em massa
          </button>

          <button
            type="button"
            className="agenda-primary-button"
            onClick={
              openCreateModal
            }
          >
            <Plus size={18} />

            Novo horário
          </button>

        </div>
      </div>

      {/* ERRO */}

      {error && (
        <div className="agenda-error">
          {error}
        </div>
      )}

      {/* FILTROS */}

      <div className="agenda-filters">
        <div className="agenda-form-field"><label>Tipo de horário</label><select value={filterTipo} onChange={(event) => { setFilterTipo(event.target.value as '' | 'individual' | 'dupla' | 'grupo'); clearSelection() }}><option value="">Todos os tipos</option><option value="individual">Individual</option><option value="dupla">Dupla</option><option value="grupo">Grupo</option></select></div>
        <div className="agenda-form-field"><label>Nível</label><select value={filterNivel} onChange={(event) => { setFilterNivel(event.target.value as '' | Nivel); clearSelection() }}><option value="">Todos os níveis</option>{niveis.map((nivel) => <option key={nivel.value} value={nivel.value}>{nivel.label}</option>)}</select></div>
        <div className="agenda-form-field"><label>Professor</label><select value={filterProfessor} onChange={(event) => { setFilterProfessor(event.target.value); clearSelection() }}><option value="">Todos os professores</option>{professores.map((professor) => <option key={professor.id} value={professor.id}>{professor.nome_completo}</option>)}</select></div>
        {(filterTipo || filterProfessor || filterNivel) && <button type="button" className="agenda-secondary-button" onClick={() => { setFilterTipo(''); setFilterProfessor(''); setFilterNivel(''); clearSelection() }}>Limpar filtros</button>}
      </div>

      {/* DIAS */}

      <div className="agenda-day-selector">

        {diasSemana.map(
          (dia) => {
            const active =
              selectedDay ===
              dia.value

            const count =
              horarios.filter(
                (horario) =>
                  horario.dia_semana === dia.value &&
                  (filterTipo === '' || horario.tipo_horario === filterTipo) &&
                  (filterProfessor === '' || horario.professor_id === filterProfessor) &&
                  (filterNivel === '' || horario.nivel_referencia === filterNivel),
              ).length

            return (
              <button
                key={
                  dia.value
                }
                type="button"
                className={`agenda-day-button ${dia.value === agendaToday ? 'today ' : ''}${active ? 'active' : ''}`}
                onClick={() => {
                  setSelectedDay(
                    dia.value,
                  )
                  clearSelection()
                }}
              >
                <span className="agenda-day-short">
                  {
                    dia.short
                  }
                </span>

                <span className="agenda-day-name">
                  {
                    dia.label
                  }
                </span>

                <span className="agenda-day-count">
                  {
                    count
                  }
                </span>
              </button>
            )
          },
        )}

      </div>

      {/* RESUMO */}

      <div className="agenda-summary">

        <div className="agenda-summary-item">

          <CalendarDays
            size={18}
          />

          <div>
            <strong>
              {
                diasSemana.find(
                  (dia) =>
                    dia.value ===
                    selectedDay,
                )?.label
              }
            </strong>

            <span>
              {
                horariosDoDia.length
              }{' '}
              {
                horariosDoDia.length ===
                1
                  ? 'horário'
                  : 'horários'
              }
            </span>
          </div>

        </div>

        <div className="agenda-summary-item">

          <CheckCircle2
            size={18}
          />

          <div>
            <strong>
              {
                horariosDoDia.filter(
                  (horario) =>
                    horario.disponivel &&
                    !horario.aluno_id,
                ).length
              }
            </strong>

            <span>
              Disponíveis
            </span>
          </div>

        </div>

        <div className="agenda-summary-item agenda-summary-next">
          <CalendarClock size={18} />
          <div>
            <strong>
              {horarioAtualId
                ? 'Em andamento'
                : proximoHorarioId
                  ? formatHour(horariosDoDia.find((horario) => horario.id === proximoHorarioId)?.hora_inicio || '')
                  : '—'}
            </strong>
            <span>
              {horarioAtualId
                ? 'Aula atual'
                : proximoHorarioId
                  ? 'Próxima aula'
                  : selectedDay === agendaToday
                    ? 'Sem próxima aula'
                    : 'Selecione hoje'}
            </span>
          </div>
        </div>

        <div className="agenda-summary-item">

          <UserRound
            size={18}
          />

          <div>
            <strong>
              {
                horariosDoDia.filter(
                  (horario) =>
                    !!horario.aluno_id,
                ).length
              }
            </strong>

            <span>
              Ocupados
            </span>
          </div>

        </div>

      </div>

      {/* PAINEL */}

      <div className="agenda-panel">

        <div className="agenda-panel-header">

          <div>
            <h2>
              Horários de{' '}
              {
                diasSemana.find(
                  (dia) =>
                    dia.value ===
                    selectedDay,
                )?.label
              }
            </h2>

            <p>
              Consulte e gerencie os
              horários deste dia.
            </p>
          </div>

          <div className="agenda-panel-header-right">

            {horariosDoDia.length >
              0 && (
              <button
                type="button"
                className="agenda-select-all-button"
                onClick={
                  toggleSelectAllDay
                }
              >
                {allDaySelected ? (
                  <CheckSquare
                    size={17}
                  />
                ) : (
                  <Square
                    size={17}
                  />
                )}

                {allDaySelected
                  ? 'Desmarcar todos'
                  : 'Selecionar todos'}
              </button>
            )}

            <div className="agenda-panel-legend" aria-label="Legenda da agenda">
              <span><i className="agenda-legend-dot occupied" />Ocupado</span>
              <span><i className="agenda-legend-dot available" />Livre</span>
              <span><i className="agenda-legend-dot replacement" />Reposição</span>
              {selectedDay === agendaToday && (
                <span><i className="agenda-legend-dot current" />Agora</span>
              )}
            </div>

            <Clock3
              size={20}
            />

          </div>

        </div>

        {/* BARRA EM MASSA */}

        {selectedIds.length >
          0 && (
          <div className="agenda-bulk-toolbar">

            <div className="agenda-bulk-info">

              <CheckSquare
                size={18}
              />

              <strong>
                {selectedIds.length}{' '}
                selecionado(s)
              </strong>

              <button
                type="button"
                onClick={
                  clearSelection
                }
              >
                Limpar seleção
              </button>

            </div>

            <div className="agenda-bulk-actions">

              <button
                type="button"
                className="agenda-bulk-edit-button"
                onClick={
                  openBulkEditModal
                }
                disabled={saving}
              >
                <Edit3
                  size={16}
                />

                Editar selecionados
              </button>

              <button
                type="button"
                className="agenda-bulk-edit-button"
                onClick={() => {
                  const first = [...selectedHorarios].sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio))[0]
                  setBulkReorganizeDay(first?.dia_semana ?? selectedDay)
                  setBulkReorganizeStart(first ? formatHour(first.hora_inicio) : '08:00')
                  setBulkReorganizeOpen(true)
                }}
                disabled={saving}
              >
                <Clock3 size={16} />
                Reorganizar horários
              </button>

              <button
                type="button"
                className="agenda-bulk-delete-button"
                onClick={() =>
                  void handleBulkDelete()
                }
                disabled={saving}
              >
                <Trash2
                  size={16}
                />

                Excluir selecionados
              </button>

            </div>

          </div>
        )}

        <div className="agenda-panel-content">

          {loading ? (

            <div className="agenda-loading">

              <div className="agenda-loading-spinner" />

              <p>
                Carregando horários...
              </p>

            </div>

          ) : horariosDoDia.length ===
            0 ? (

            <div className="agenda-empty">

              <div className="agenda-empty-icon">
                <CalendarDays
                  size={28}
                />
              </div>

              <h3>
                Nenhum horário
                cadastrado
              </h3>

              <p>
                Não existem horários
                cadastrados para
                este dia.
              </p>

              <div className="agenda-empty-actions">

                <button
                  type="button"
                  className="agenda-secondary-button"
                  onClick={
                    openCreateModal
                  }
                >
                  <Plus
                    size={17}
                  />

                  Criar horário
                </button>

                <button
                  type="button"
                  className="agenda-secondary-button"
                  onClick={
                    openBulkCreateModal
                  }
                >
                  <CalendarDays
                    size={17}
                  />

                  Criar em massa
                </button>

              </div>

            </div>

          ) : (

            <div className="agenda-periods">
              {([
                { key: 'manha' as const, label: 'Manhã', range: '08:00 — 12:00', start: 8 * 60, end: 12 * 60 },
                { key: 'tarde' as const, label: 'Tarde', range: '14:00 — 20:00', start: 14 * 60, end: 20 * 60 },
                { key: 'noite' as const, label: 'Noite', range: '20:00 — 22:00', start: 20 * 60, end: 24 * 60 },
              ]).map((period) => {
                const periodHorarios = horariosDoDia.filter((horario) => {
                  const inicio = timeToMinutes(formatHour(horario.hora_inicio))
                  return inicio >= period.start && inicio < period.end
                })
                const periodReposicoes = reposicoesDoDia.filter((registro) => {
                  if (!registro.hora_inicio_override) return false
                  const inicio = timeToMinutes(formatHour(registro.hora_inicio_override))
                  return inicio >= period.start && inicio < period.end
                })

                return (
                  <div key={period.key} className="agenda-period">
                    <button
                      type="button"
                      className={`agenda-period-menu ${openPeriod === period.key ? 'active' : ''}`}
                      onClick={() => setOpenPeriod(openPeriod === period.key ? period.key : period.key)}
                      aria-expanded={openPeriod === period.key}
                    >
                      <span className="agenda-period-menu-main">
                        <strong>{period.label}</strong>
                        <small>{period.range}</small>
                      </span>
                      <span className="agenda-period-menu-count">
                        {periodHorarios.length + periodReposicoes.length}
                      </span>
                      <span className="agenda-period-chevron">{openPeriod === period.key ? '−' : '+'}</span>
                    </button>

                    {openPeriod === period.key && (
                      <div className="agenda-period-content">
                        {periodHorarios.length > 0 ? (
                          <div className="agenda-card-grid">
              {periodHorarios.map(
                (horario) => {
                  const alunoNome =
                    getAlunoNome(
                      horario.aluno_id,
                    )

                  const professorNome =
                    getProfessorNome(
                      horario.professor_id,
                    )

                  const todayDate = dateKey(new Date())
                  const reagendamentoOriginal = registrosAulas.find(
                    (registro) =>
                      registro.horario_id === horario.id &&
                      registro.data_aula >= todayDate &&
                      Boolean(registro.data_aula_override),
                  )

                  const ocupado =
                    !!horario.aluno_id

                  const selected =
                    selectedIds.includes(
                      horario.id,
                    )

                  return (
                    <div
                      key={
                        horario.id
                      }
                      className={`agenda-item ${horario.id === horarioAtualId ? 'current ' : ''}${horario.id === proximoHorarioId ? 'next ' : ''}${ocupado ? 'occupied' : 'available'} ${
                        selected
                          ? 'selected'
                          : ''
                      }`}
                    >

                      <button
                        type="button"
                        className={`agenda-select-checkbox ${
                          selected
                            ? 'checked'
                            : ''
                        }`}
                        onClick={() =>
                          toggleSelection(
                            horario.id,
                          )
                        }
                        aria-label={
                          selected
                            ? 'Desmarcar horário'
                            : 'Selecionar horário'
                        }
                      >
                        {selected ? (
                          <CheckSquare
                            size={19}
                          />
                        ) : (
                          <Square
                            size={19}
                          />
                        )}
                      </button>

                      <div className="agenda-time">

                        <strong>
                          {formatHour(
                            horario.hora_inicio,
                          )}
                        </strong>

                        <span>
                          {formatHour(
                            horario.hora_fim,
                          )}
                        </span>

                      </div>

                      <div className="agenda-item-main">

                        <div className="agenda-item-top">

                          <span className="agenda-language">
                            {getIdiomaLabel(
                              horario.idioma,
                            )}
                          </span>
                          <span className="agenda-language">
                            {horario.tipo_horario === 'dupla' ? 'Dupla' : horario.tipo_horario === 'grupo' ? 'Grupo' : 'Individual'}
                          </span>
                          {horario.nivel_referencia && (
                            <span className="agenda-status available">{horario.nivel_referencia === 'iniciante' ? 'Iniciante' : horario.nivel_referencia === 'basico' ? 'Básico' : horario.nivel_referencia === 'intermediario' ? 'Intermediário' : horario.nivel_referencia === 'avancado' ? 'Avançado' : horario.nivel_referencia}</span>
                          )}

                          {reagendamentoOriginal && (
                            <span className="agenda-status unavailable">REAGENDADA</span>
                          )}

                          <span
                            className={`agenda-status ${
                              ocupado
                                ? 'occupied'
                                : horario.disponivel
                                  ? 'available'
                                  : 'unavailable'
                            }`}
                          >
                            {ocupado
                              ? 'Ocupado'
                              : horario.disponivel
                                ? 'Disponível'
                                : 'Indisponível'}
                          </span>

                        </div>

                        <div className="agenda-student">

                          <UserRound
                            size={16}
                          />

                          <span>
                            {alunoNome ||
                              'Nenhum aluno vinculado'}
                          </span>

                        </div>

                        <div className="agenda-student">

                          <UserRound
                            size={16}
                          />

                          <span>
                            {professorNome
                              ? `Professor: ${professorNome}`
                              : 'Nenhum professor atribuído'}
                          </span>

                        </div>

                        <div className="agenda-lesson-status">

                          <Video
                            size={15}
                          />

                          <span>
                            {ocupado
                              ? 'Aula disponível na AB Academy'
                              : 'Aguardando matrícula'}
                          </span>

                        </div>

                      </div>

                      <div className="agenda-actions">

                        {ocupado && (
                          <button
                            type="button"
                            className="agenda-action-button"
                            onClick={() =>
                              openTeacherRoom(
                                horario,
                              )
                            }
                            title="Entrar na aula"
                          >
                            <Video
                              size={17}
                            />
                          </button>
                        )}

                        {ocupado && (
                          <button
                            type="button"
                            className="agenda-action-button"
                            onClick={() => openRescheduleModal(horario)}
                            title="Reagendar aula"
                          >
                            <Clock3 size={17} />
                          </button>
                        )}

                        {ocupado && (
                          <button
                            type="button"
                            className="agenda-action-button"
                            onClick={() =>
                              void unlinkStudent(
                                horario,
                              )
                            }
                            title="Desvincular aluno"
                          >
                            <X
                              size={17}
                            />
                          </button>
                        )}

                        {!ocupado && (
                          <button
                            type="button"
                            className="agenda-action-button"
                            onClick={() =>
                              void toggleAvailability(
                                horario,
                              )
                            }
                            title={
                              horario.disponivel
                                ? 'Marcar como indisponível'
                                : 'Marcar como disponível'
                            }
                          >
                            <CheckCircle2
                              size={17}
                            />
                          </button>
                        )}

                        <button
                          type="button"
                          className="agenda-action-button"
                          onClick={() =>
                            openEditModal(
                              horario,
                            )
                          }
                          title="Editar horário"
                        >
                          <Edit3
                            size={17}
                          />
                        </button>

                      </div>

                    </div>
                  )
                },
              )}

                          </div>
                        ) : null}

              {periodReposicoes.length > 0 && (
                <div className="agenda-replacement-section">
                  <div className="agenda-replacement-heading">
                    <div>
                      <h3>Reposições agendadas</h3>
                      <p>Aulas remanejadas para este período.</p>
                    </div>
                    <span>{periodReposicoes.length}</span>
                  </div>

                  <div className="agenda-card-grid">
                  {periodReposicoes.map((registro) => {
                    const horario = horarios.find((item) => item.id === registro.horario_id)
                    if (!horario || !registro.data_aula_override || !registro.hora_inicio_override || !registro.hora_fim_override) return null

                    return (
                      <div key={'reposicao-' + registro.id} className="agenda-item occupied">
                        <div className="agenda-time">
                          <strong>{formatHour(registro.hora_inicio_override)}</strong>
                          <span>{formatHour(registro.hora_fim_override)}</span>
                        </div>

                        <div className="agenda-item-main">
                          <div className="agenda-item-top">
                            <span className="agenda-language">{getIdiomaLabel(horario.idioma)}</span>
                            <span className="agenda-language">
                              {horario.tipo_horario === 'dupla' ? 'Dupla' : horario.tipo_horario === 'grupo' ? 'Grupo' : 'Individual'}
                            </span>
                            <span className="agenda-status unavailable">REPOSIÇÃO</span>
                          </div>

                          <div className="agenda-student">
                            <UserRound size={16} />
                            <span>{getAlunoNome(registro.aluno_id) || 'Aluno'}</span>
                          </div>

                          <div className="agenda-student">
                            <UserRound size={16} />
                            <span>{getProfessorNome(horario.professor_id) ? 'Professor: ' + getProfessorNome(horario.professor_id) : 'Nenhum professor atribuído'}</span>
                          </div>

                          <div className="agenda-lesson-status">
                            <Video size={15} />
                            <span>Aula disponível na AB Academy</span>
                          </div>
                        </div>

                        <div className="agenda-actions">
                          <button
                            type="button"
                            className="agenda-action-button"
                            onClick={() => openTeacherRoom(horario)}
                            title="Entrar na reposição"
                          >
                            <Video size={17} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  </div>
                </div>
              )}
                    )}
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </div>

      {/* =================================================
          MODAL INDIVIDUAL
          ================================================= */}

      {modalOpen && (
        <div
          className="agenda-modal-overlay"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal()
            }
          }}
        >
          <div className="agenda-modal">

            <div className="agenda-modal-header">

              <div>
                <h2>
                  {editingId
                    ? 'Editar horário'
                    : 'Novo horário'}
                </h2>

                <p>
                  Configure o horário da
                  agenda.
                </p>
              </div>

              <button
                type="button"
                className="agenda-modal-close"
                onClick={
                  closeModal
                }
                disabled={saving}
              >
                <X
                  size={19}
                />
              </button>

            </div>

            <div className="agenda-form">

              <div className="agenda-form-field">
                <label htmlFor="agenda-tipo">Tipo de horário</label>
                <select
                  id="agenda-tipo"
                  value={form.tipo_horario}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      tipo_horario: event.target.value as 'individual' | 'dupla' | 'grupo',
                    }))
                  }
                >
                  <option value="individual">Individual</option>
                  <option value="dupla">Dupla</option>
                  <option value="grupo">Grupo</option>
                </select>
                <small>Define como este horário poderá ser utilizado na matrícula e na formação de turmas.</small>
              </div>

              <div className="agenda-form-field">
                <label htmlFor="agenda-nivel">Nível de referência</label>
                <select id="agenda-nivel" value={form.nivel_referencia} onChange={(event) => setForm((current) => ({ ...current, nivel_referencia: event.target.value as Nivel | '' }))}>
                  <option value="">Sem nível definido</option>
                  {niveis.map((nivel) => <option key={nivel.value} value={nivel.value}>{nivel.label}</option>)}
                </select>
                <small>Use o nível CEFR para organizar horários e futuras campanhas coletivas.</small>
              </div>

              <div className="agenda-form-field">

                <label htmlFor="agenda-idioma">
                  Idioma
                </label>

                <select
                  id="agenda-idioma"
                  value={
                    form.idioma
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        idioma:
                          event
                            .target
                            .value as
                            | 'ingles'
                            | 'alemao',
                      }),
                    )
                  }
                >
                  {idiomas.map(
                    (
                      idioma,
                    ) => (
                      <option
                        key={
                          idioma.value
                        }
                        value={
                          idioma.value
                        }
                      >
                        {
                          idioma.label
                        }
                      </option>
                    ),
                  )}
                </select>

              </div>

              <div className="agenda-form-field">

                <label htmlFor="agenda-dia">
                  Dia da semana
                </label>

                <select
                  id="agenda-dia"
                  value={
                    form.dia_semana
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        dia_semana:
                          Number(
                            event
                              .target
                              .value,
                          ),
                      }),
                    )
                  }
                >
                  {diasSemana.map(
                    (
                      dia,
                    ) => (
                      <option
                        key={
                          dia.value
                        }
                        value={
                          dia.value
                        }
                      >
                        {
                          dia.label
                        }
                      </option>
                    ),
                  )}
                </select>

              </div>

              <div className="agenda-form-row">

                <div className="agenda-form-field">

                  <label htmlFor="agenda-inicio">
                    Horário inicial
                  </label>

                  <input
                    id="agenda-inicio"
                    type="time"
                    value={
                      form.hora_inicio
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          hora_inicio:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />

                </div>

                <div className="agenda-form-field">

                  <label htmlFor="agenda-fim">
                    Horário final
                  </label>

                  <input
                    id="agenda-fim"
                    type="time"
                    value={
                      form.hora_fim
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          hora_fim:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />

                </div>

              </div>

              <div className="agenda-form-field">

                <label htmlFor="agenda-professor">
                  Professor responsável
                </label>

                <select
                  id="agenda-professor"
                  value={
                    form.professor_id
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        professor_id:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                >
                  <option value="">
                    Nenhum professor
                  </option>

                  {professores.map(
                    (
                      professor,
                    ) => (
                      <option
                        key={
                          professor.id
                        }
                        value={
                          professor.id
                        }
                      >
                        {
                          professor.nome_completo
                        }
                      </option>
                    ),
                  )}
                </select>

              </div>

              <div className="agenda-form-field">

                <label htmlFor="agenda-aluno">
                  Aluno
                </label>

                <select
                  id="agenda-aluno"
                  value={
                    form.aluno_id
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        aluno_id:
                          event.target
                            .value,
                        disponivel:
                          event.target
                            .value
                            ? false
                            : current.disponivel,
                      }),
                    )
                  }
                >
                  <option value="">
                    Nenhum aluno
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
                        }
                      </option>
                    ),
                  )}
                </select>

              </div>

              <label className="agenda-toggle">

                <input
                  type="checkbox"
                  checked={
                    form.disponivel &&
                    !form.aluno_id
                  }
                  disabled={
                    !!form.aluno_id
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        disponivel:
                          event
                            .target
                            .checked,
                      }),
                    )
                  }
                />

                <span>
                  Horário disponível
                  para matrícula
                </span>

              </label>

            </div>

            <div className="agenda-modal-footer">

              <button
                type="button"
                className="agenda-cancel-button"
                onClick={
                  closeModal
                }
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="agenda-save-button"
                onClick={() =>
                  void handleSave()
                }
                disabled={saving}
              >
                {saving
                  ? 'Salvando...'
                  : editingId
                    ? 'Salvar alterações'
                    : 'Criar horário'}
              </button>

            </div>

          </div>
        </div>
      )}

      {rescheduleOpen && rescheduleSource && (
        <div
          className="agenda-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeRescheduleModal()
            }
          }}
        >
          <div className="agenda-modal agenda-reschedule-modal">
            <div className="agenda-modal-header agenda-reschedule-header">
              <div>
                <span className="agenda-modal-kicker">
                  <CalendarClock size={14} />
                  Ajuste de uma única ocorrência
                </span>
                <h2>Reagendar aula</h2>
                <p>
                  {rescheduleMode === 'permanente'
                    ? 'Altere definitivamente o dia e o horário desta aula.'
                    : 'Escolha a data e o horário da reposição. O horário recorrente original continuará intacto.'}
                </p>
              </div>

              <button
                type="button"
                className="agenda-modal-close"
                onClick={closeRescheduleModal}
                disabled={saving}
              >
                <X size={19} />
              </button>
            </div>

            <div className="agenda-form">
              <div className="agenda-reschedule-modes">
                <button
                  type="button"
                  className={`agenda-reschedule-mode ${rescheduleMode === 'permanente' ? 'active' : ''}`}
                  onClick={() => setRescheduleMode('permanente')}
                  disabled={saving}
                >
                  <strong>Opção 1 · Reagendamento permanente</strong>
                  <span>O dia e horário desta aula mudam definitivamente.</span>
                </button>

                <button
                  type="button"
                  className={`agenda-reschedule-mode ${rescheduleMode === 'reposicao' ? 'active' : ''}`}
                  onClick={() => setRescheduleMode('reposicao')}
                  disabled={saving}
                >
                  <strong>Opção 2 · Reposição de aula</strong>
                  <span>Muda somente uma ocorrência. O horário recorrente permanece.</span>
                </button>
              </div>

              <div className="agenda-reschedule-summary">
                <div className="agenda-reschedule-summary-icon">
                  <UserRound size={18} />
                </div>
                <div>
                  <strong>
                    {getAlunoNome(rescheduleSource.aluno_id) || 'Aluno'}
                  </strong>
                  <span>
                    {getProfessorNome(rescheduleSource.professor_id) ||
                      'Professor'}{' '}
                    · {getIdiomaLabel(rescheduleSource.idioma)}
                  </span>
                </div>
                <div className="agenda-reschedule-original">
                  <small>Aula atual</small>
                  <b>
                    {getDayLabel(rescheduleSource.dia_semana)} ·{' '}
                    {formatHour(rescheduleSource.hora_inicio)}–
                    {formatHour(rescheduleSource.hora_fim)}
                  </b>
                </div>
              </div>

              <div className="agenda-reschedule-fields">
                {rescheduleMode === 'permanente' ? (
                  <div className="agenda-form-field">
                    <label>Novo dia da semana</label>
                    <select
                      value={reschedulePermanentDay}
                      onChange={(event) =>
                        setReschedulePermanentDay(Number(event.target.value))
                      }
                    >
                      {diasSemana.map((dia) => (
                        <option key={dia.value} value={dia.value}>
                          {dia.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="agenda-form-field">
                    <label>Nova data da reposição</label>
                    <input
                      type="date"
                      value={rescheduleDate}
                      min={dateKey(new Date())}
                      onChange={(event) => setRescheduleDate(event.target.value)}
                    />
                  </div>
                )}

                <div className="agenda-form-field">
                  <label>Horário inicial</label>
                  <input
                    type="time"
                    value={rescheduleStart}
                    onChange={(event) => setRescheduleStart(event.target.value)}
                  />
                </div>

                <div className="agenda-form-field">
                  <label>Horário final</label>
                  <input
                    type="time"
                    value={rescheduleEnd}
                    onChange={(event) => setRescheduleEnd(event.target.value)}
                  />
                </div>
              </div>

              <div className="agenda-reschedule-note">
                <CheckCircle2 size={17} />
                <div>
                  <strong>Validação automática</strong>
                  <span>
                    {rescheduleMode === 'permanente'
                      ? 'O sistema verifica conflitos do professor antes de alterar o horário recorrente.'
                      : 'O sistema verifica conflito com a agenda do professor e com outras reposições antes de salvar.'}
                  </span>
                </div>
              </div>
            </div>

            <div className="agenda-modal-footer">
              <button
                type="button"
                className="agenda-cancel-button"
                onClick={closeRescheduleModal}
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="agenda-save-button"
                onClick={() => void handleReschedule()}
                disabled={
                  saving ||
                  (rescheduleMode === 'reposicao' && !rescheduleDate) ||
                  !rescheduleStart ||
                  !rescheduleEnd
                }
              >
                {saving
                  ? 'Salvando...'
                  : rescheduleMode === 'permanente'
                    ? 'Confirmar mudança permanente'
                    : 'Confirmar reposição'}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkReorganizeOpen && (
        <div className="agenda-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeBulkReorganizeModal() }}>
          <div className="agenda-modal agenda-bulk-modal">
            <div className="agenda-modal-header">
              <div>
                <h2>Reorganizar horários em massa</h2>
                <p>Move os horários selecionados para um novo dia e horário inicial, preservando duração e espaçamento.</p>
              </div>
              <button type="button" className="agenda-modal-close" onClick={closeBulkReorganizeModal} disabled={saving}><X size={19} /></button>
            </div>
            <div className="agenda-form">
              <div className="agenda-form-field">
                <label>Novo dia</label>
                <select value={bulkReorganizeDay} onChange={(event) => setBulkReorganizeDay(Number(event.target.value))}>
                  {diasSemana.map((dia) => <option key={dia.value} value={dia.value}>{dia.label}</option>)}
                </select>
              </div>
              <div className="agenda-form-field">
                <label>Novo horário inicial</label>
                <input type="time" value={bulkReorganizeStart} onChange={(event) => setBulkReorganizeStart(event.target.value)} />
                <small>Os horários serão ordenados e deslocados como um bloco. A duração de cada aula será preservada.</small>
              </div>
              <div className="agenda-bulk-preview">
                <strong>{selectedHorarios.length} horário(s) selecionado(s)</strong>
                <span>O sistema valida conflitos antes de salvar e não altera os horários que não foram selecionados.</span>
              </div>
            </div>
            <div className="agenda-modal-footer">
              <button type="button" className="agenda-cancel-button" onClick={closeBulkReorganizeModal} disabled={saving}>Cancelar</button>
              <button type="button" className="agenda-save-button" onClick={() => void handleBulkReorganize()} disabled={saving}>{saving ? 'Reorganizando...' : 'Reorganizar horários'}</button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          MODAL CRIAÇÃO EM MASSA
          ================================================= */}

      {bulkCreateOpen && (
        <div
          className="agenda-modal-overlay"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeBulkCreateModal()
            }
          }}
        >
          <div className="agenda-modal agenda-bulk-modal">

            <div className="agenda-modal-header">

              <div>
                <h2>
                  Adicionar horários em massa
                </h2>

                <p>
                  Gere vários horários
                  automaticamente.
                </p>
              </div>

              <button
                type="button"
                className="agenda-modal-close"
                onClick={
                  closeBulkCreateModal
                }
                disabled={saving}
              >
                <X
                  size={19}
                />
              </button>

            </div>

            <div className="agenda-form">

              <div className="agenda-form-field"><label>Tipo de horário</label><select value={bulkCreateForm.tipo_horario} onChange={(event) => setBulkCreateForm((current) => ({ ...current, tipo_horario: event.target.value as 'individual' | 'dupla' | 'grupo' }))}><option value="individual">Individual</option><option value="dupla">Dupla</option><option value="grupo">Grupo</option></select></div>
              <div className="agenda-form-field"><label>Nível de referência</label><select value={bulkCreateForm.nivel_referencia} onChange={(event) => setBulkCreateForm((current) => ({ ...current, nivel_referencia: event.target.value as Nivel | '' }))}><option value="">Sem nível definido</option>{niveis.map((nivel) => <option key={nivel.value} value={nivel.value}>{nivel.label}</option>)}</select></div>

              <div className="agenda-form-field">
                <label>Tipo de horário</label>
                <select value={bulkEditForm.tipo_horario} onChange={(event) => setBulkEditForm((current) => ({ ...current, tipo_horario: event.target.value as BulkEditForm['tipo_horario'] }))}>
                  <option value="">Manter atual</option>
                  <option value="individual">Individual</option>
                  <option value="dupla">Dupla</option>
                  <option value="grupo">Grupo</option>
                </select>
              </div>

              <div className="agenda-form-field">
                <label>Nível de referência</label>
                <select value={bulkEditForm.nivel_referencia} onChange={(event) => setBulkEditForm((current) => ({ ...current, nivel_referencia: event.target.value as BulkEditForm['nivel_referencia'] }))}>
                  <option value="">Manter atual</option>
                  {niveis.map((nivel) => <option key={nivel.value} value={nivel.value}>{nivel.label}</option>)}
                </select>
              </div>

              <div className="agenda-form-field">

                <label>
                  Idioma
                </label>

                <select
                  value={
                    bulkCreateForm.idioma
                  }
                  onChange={(
                    event,
                  ) =>
                    setBulkCreateForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        idioma:
                          event
                            .target
                            .value as
                            | 'ingles'
                            | 'alemao',
                      }),
                    )
                  }
                >
                  {idiomas.map(
                    (
                      idioma,
                    ) => (
                      <option
                        key={
                          idioma.value
                        }
                        value={
                          idioma.value
                        }
                      >
                        {
                          idioma.label
                        }
                      </option>
                    ),
                  )}
                </select>

              </div>

              <div className="agenda-form-field">

                <label>
                  Professor responsável
                </label>

                <select
                  value={
                    bulkCreateForm.professor_id
                  }
                  onChange={(
                    event,
                  ) =>
                    setBulkCreateForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        professor_id:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                >
                  <option value="">
                    Nenhum professor
                  </option>

                  {professores.map(
                    (
                      professor,
                    ) => (
                      <option
                        key={
                          professor.id
                        }
                        value={
                          professor.id
                        }
                      >
                        {
                          professor.nome_completo
                        }
                      </option>
                    ),
                  )}
                </select>

              </div>

              <div className="agenda-form-field">

                <label>
                  Dias da semana
                </label>

                <div className="agenda-weekday-grid">

                  {diasSemana.map(
                    (
                      dia,
                    ) => {
                      const checked =
                        bulkCreateForm.dias.includes(
                          dia.value,
                        )

                      return (
                        <button
                          key={
                            dia.value
                          }
                          type="button"
                          className={`agenda-weekday-option ${
                            checked
                              ? 'active'
                              : ''
                          }`}
                          onClick={() =>
                            toggleBulkCreateDay(
                              dia.value,
                            )
                          }
                        >
                          {checked ? (
                            <CheckSquare
                              size={16}
                            />
                          ) : (
                            <Square
                              size={16}
                            />
                          )}

                          {
                            dia.label
                          }
                        </button>
                      )
                    },
                  )}

                </div>

              </div>

              <div className="agenda-form-row">

                <div className="agenda-form-field">

                  <label>
                    Começar às
                  </label>

                  <input
                    type="time"
                    value={
                      bulkCreateForm.hora_inicio
                    }
                    onChange={(
                      event,
                    ) =>
                      setBulkCreateForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          hora_inicio:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />

                </div>

                <div className="agenda-form-field">

                  <label>
                    Encerrar às
                  </label>

                  <input
                    type="time"
                    value={
                      bulkCreateForm.hora_fim
                    }
                    onChange={(
                      event,
                    ) =>
                      setBulkCreateForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          hora_fim:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />

                </div>

              </div>

              <div className="agenda-form-field">

                <label>
                  Duração de cada aula
                </label>

                <select
                  value={
                    bulkCreateForm.duracao
                  }
                  onChange={(
                    event,
                  ) =>
                    setBulkCreateForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        duracao:
                          Number(
                            event
                              .target
                              .value,
                          ),
                      }),
                    )
                  }
                >
                  <option value={30}>
                    30 minutos
                  </option>

                  <option value={45}>
                    45 minutos
                  </option>

                  <option value={60}>
                    1 hora
                  </option>

                  <option value={90}>
                    1 hora e 30 minutos
                  </option>

                  <option value={120}>
                    2 horas
                  </option>
                </select>

              </div>

              <label className="agenda-toggle">

                <input
                  type="checkbox"
                  checked={
                    bulkCreateForm.disponivel
                  }
                  onChange={(
                    event,
                  ) =>
                    setBulkCreateForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        disponivel:
                          event
                            .target
                            .checked,
                      }),
                    )
                  }
                />

                <span>
                  Criar horários disponíveis
                  para matrícula
                </span>

              </label>

              <div className="agenda-bulk-preview">

                <strong>
                  Geração automática
                </strong>

                <span>
                  Os horários existentes
                  serão ignorados. Apenas
                  novos horários serão
                  criados.
                </span>

              </div>

            </div>

            <div className="agenda-modal-footer">

              <button
                type="button"
                className="agenda-cancel-button"
                onClick={
                  closeBulkCreateModal
                }
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="agenda-save-button"
                onClick={() =>
                  void handleBulkCreate()
                }
                disabled={saving}
              >
                {saving
                  ? 'Criando...'
                  : 'Criar horários'}
              </button>

            </div>

          </div>
        </div>
      )}

      {/* =================================================
          MODAL EDIÇÃO EM MASSA
          ================================================= */}

      {bulkEditOpen && (
        <div
          className="agenda-modal-overlay"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeBulkEditModal()
            }
          }}
        >
          <div className="agenda-modal agenda-bulk-modal">

            <div className="agenda-modal-header">

              <div>
                <h2>
                  Editar horários selecionados
                </h2>

                <p>
                  {selectedIds.length}{' '}
                  horário(s) selecionado(s).
                </p>
              </div>

              <button
                type="button"
                className="agenda-modal-close"
                onClick={
                  closeBulkEditModal
                }
                disabled={saving}
              >
                <X
                  size={19}
                />
              </button>

            </div>

            <div className="agenda-form">

              <div className="agenda-bulk-edit-warning">

                <Edit3 size={17} />

                <span>
                  Altere somente os campos
                  que deseja modificar.
                  Campos em "Manter atual"
                  permanecerão iguais.
                </span>

              </div>

              <div className="agenda-form-field">

                <label>
                  Idioma
                </label>

                <select
                  value={
                    bulkEditForm.idioma
                  }
                  onChange={(
                    event,
                  ) =>
                    setBulkEditForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        idioma:
                          event
                            .target
                            .value as
                            | ''
                            | 'ingles'
                            | 'alemao',
                      }),
                    )
                  }
                >
                  <option value="">
                    Manter atual
                  </option>

                  {idiomas.map(
                    (
                      idioma,
                    ) => (
                      <option
                        key={
                          idioma.value
                        }
                        value={
                          idioma.value
                        }
                      >
                        {
                          idioma.label
                        }
                      </option>
                    ),
                  )}
                </select>

              </div>

              <div className="agenda-form-field">

                <label>
                  Professor responsável
                </label>

                <select
                  value={
                    bulkEditForm.professor_id
                  }
                  onChange={(
                    event,
                  ) =>
                    setBulkEditForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        professor_id:
                          event
                            .target
                            .value as
                            | ''
                            | '__none__'
                            | string,
                      }),
                    )
                  }
                >
                  <option value="">
                    Manter atual
                  </option>

                  <option value="__none__">
                    Remover professor
                  </option>

                  {professores.map(
                    (
                      professor,
                    ) => (
                      <option
                        key={
                          professor.id
                        }
                        value={
                          professor.id
                        }
                      >
                        {
                          professor.nome_completo
                        }
                      </option>
                    ),
                  )}
                </select>

              </div>

              <div className="agenda-form-field">

                <label>
                  Dia da semana
                </label>

                <select
                  value={
                    bulkEditForm.dia_semana
                  }
                  onChange={(
                    event,
                  ) =>
                    setBulkEditForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        dia_semana:
                          event.target
                            .value ===
                          ''
                            ? ''
                            : Number(
                                event
                                  .target
                                  .value,
                              ),
                      }),
                    )
                  }
                >
                  <option value="">
                    Manter atual
                  </option>

                  {diasSemana.map(
                    (
                      dia,
                    ) => (
                      <option
                        key={
                          dia.value
                        }
                        value={
                          dia.value
                        }
                      >
                        {
                          dia.label
                        }
                      </option>
                    ),
                  )}
                </select>

              </div>

              <div className="agenda-form-row">

                <div className="agenda-form-field">

                  <label>
                    Novo horário inicial
                  </label>

                  <input
                    type="time"
                    value={
                      bulkEditForm.hora_inicio
                    }
                    onChange={(
                      event,
                    ) =>
                      setBulkEditForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          hora_inicio:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />

                  <small>
                    Deixe vazio para manter.
                  </small>

                </div>

                <div className="agenda-form-field">

                  <label>
                    Novo horário final
                  </label>

                  <input
                    type="time"
                    value={
                      bulkEditForm.hora_fim
                    }
                    onChange={(
                      event,
                    ) =>
                      setBulkEditForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          hora_fim:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />

                  <small>
                    Deixe vazio para manter.
                  </small>

                </div>

              </div>

              <div className="agenda-form-field">

                <label>
                  Disponibilidade
                </label>

                <select
                  value={
                    bulkEditForm.disponivel
                  }
                  onChange={(
                    event,
                  ) =>
                    setBulkEditForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        disponivel:
                          event
                            .target
                            .value as
                            | ''
                            | 'true'
                            | 'false',
                      }),
                    )
                  }
                >
                  <option value="">
                    Manter atual
                  </option>

                  <option value="true">
                    Disponível
                  </option>

                  <option value="false">
                    Indisponível
                  </option>
                </select>

              </div>

            </div>

            <div className="agenda-modal-footer">

              <button
                type="button"
                className="agenda-cancel-button"
                onClick={
                  closeBulkEditModal
                }
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="agenda-save-button"
                onClick={() =>
                  void handleBulkEdit()
                }
                disabled={saving}
              >
                {saving
                  ? 'Salvando...'
                  : 'Salvar alterações'}
              </button>

            </div>

          </div>
        </div>
      )}

    </section>
  )
}

