import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Clock3,
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

type Horario = {
  id: string
  idioma: 'ingles' | 'alemao'
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  disponivel: boolean
  aluno_id: string | null
  professor_id: string | null
}

type HorarioForm = {
  idioma: 'ingles' | 'alemao'
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  disponivel: boolean
  aluno_id: string
  professor_id: string
}

type BulkCreateForm = {
  idioma: 'ingles' | 'alemao'
  dias: number[]
  hora_inicio: string
  hora_fim: string
  duracao: number
  disponivel: boolean
  professor_id: string
}

type BulkEditForm = {
  idioma: '' | 'ingles' | 'alemao'
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

/*
 * =========================================================
 * FORMULÁRIOS
 * =========================================================
 */

const initialForm: HorarioForm = {
  idioma: 'ingles',
  dia_semana: 1,
  hora_inicio: '08:00',
  hora_fim: '09:00',
  disponivel: true,
  aluno_id: '',
  professor_id: '',
}

const initialBulkCreateForm: BulkCreateForm = {
  idioma: 'ingles',
  dias: [1],
  hora_inicio: '08:00',
  hora_fim: '18:00',
  duracao: 60,
  disponivel: true,
  professor_id: '',
}

const initialBulkEditForm: BulkEditForm = {
  idioma: '',
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

  const [selectedDay, setSelectedDay] =
    useState<number>(new Date().getDay())

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

  /*
   * MODAIS EM MASSA
   */

  const [bulkCreateOpen, setBulkCreateOpen] =
    useState(false)

  const [bulkEditOpen, setBulkEditOpen] =
    useState(false)

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
      ] = await Promise.all([
        supabase
          .from('horarios')
          .select(`
            id,
            idioma,
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

      setHorarios(
        (horariosResult.data || []) as Horario[],
      )

      setAlunos(
        (alunosResult.data || []) as Aluno[],
      )

      setProfessores(
        (professoresResult.data || []) as Professor[],
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
          horario.dia_semana === selectedDay,
      )
      .sort((a, b) =>
        a.hora_inicio.localeCompare(
          b.hora_inicio,
        ),
      )
  }, [horarios, selectedDay])

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

      return true
    })
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
        idioma: form.idioma,
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
            )

          if (conflict) {
            conflicts.push(
              `${getDayLabel(
                day,
              )} ${startTime}–${endTime}`,
            )
          } else {
            newSlots.push({
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

        if (
          bulkEditForm.idioma
        ) {
          payload.idioma =
            bulkEditForm.idioma
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
                  horario.dia_semana ===
                  dia.value,
              ).length

            return (
              <button
                key={
                  dia.value
                }
                type="button"
                className={`agenda-day-button ${
                  active
                    ? 'active'
                    : ''
                }`}
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

            <div className="agenda-list">

              {horariosDoDia.map(
                (horario) => {
                  const alunoNome =
                    getAlunoNome(
                      horario.aluno_id,
                    )

                  const professorNome =
                    getProfessorNome(
                      horario.professor_id,
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
                      className={`agenda-item ${
                        ocupado
                          ? 'occupied'
                          : 'available'
                      } ${
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

