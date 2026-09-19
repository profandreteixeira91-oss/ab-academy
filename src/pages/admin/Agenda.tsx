import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  Plus,
  UserRound,
  X,
} from 'lucide-react'

import { supabase } from '../../lib/supabase'
import '../../styles/admin/Agenda.css'

type Aluno = {
  id: string
  nome_completo: string
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

type HorarioForm = {
  idioma: 'ingles' | 'alemao'
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  disponivel: boolean
  aluno_id: string
}

/*
 * IMPORTANTE:
 * A tabela horarios utiliza:
 *
 * 0 = Domingo
 * 1 = Segunda
 * 2 = Terça
 * 3 = Quarta
 * 4 = Quinta
 * 5 = Sexta
 * 6 = Sábado
 */
const diasSemana = [
  { value: 1, label: 'Segunda', short: 'SEG' },
  { value: 2, label: 'Terça', short: 'TER' },
  { value: 3, label: 'Quarta', short: 'QUA' },
  { value: 4, label: 'Quinta', short: 'QUI' },
  { value: 5, label: 'Sexta', short: 'SEX' },
  { value: 6, label: 'Sábado', short: 'SÁB' },
  { value: 0, label: 'Domingo', short: 'DOM' },
]

/*
 * A tabela horarios possui CHECK:
 *
 * idioma IN ('ingles', 'alemao')
 *
 * Portanto, os valores enviados ao banco precisam
 * ser exatamente estes.
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

const initialForm: HorarioForm = {
  idioma: 'ingles',
  dia_semana: 1,
  hora_inicio: '08:00',
  hora_fim: '09:00',
  disponivel: true,
  aluno_id: '',
}

function getCurrentWeekday() {
  return new Date().getDay()
}

export default function Agenda() {
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [alunos, setAlunos] = useState<Aluno[]>([])

  const [selectedDay, setSelectedDay] = useState(
    getCurrentWeekday(),
  )

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] =
    useState<string | null>(null)

  const [form, setForm] =
    useState<HorarioForm>(initialForm)

  useEffect(() => {
    loadAgenda()
  }, [])

  async function loadAgenda() {
    try {
      setLoading(true)
      setError(null)

      const [
        horariosResult,
        alunosResult,
      ] = await Promise.all([
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
          .order('dia_semana', {
            ascending: true,
          })
          .order('hora_inicio', {
            ascending: true,
          }),

        supabase
          .from('alunos')
          .select(
            `
              id,
              nome_completo
            `,
          )
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

      setHorarios(
        (horariosResult.data || []) as Horario[],
      )

      setAlunos(
        (alunosResult.data || []) as Aluno[],
      )
    } catch (err) {
      console.error(
        'Erro ao carregar agenda:',
        err,
      )

      setError(
        `Não foi possível carregar a agenda. ${getErrorMessage(err)}`,
      )
    } finally {
      setLoading(false)
    }
  }

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

  function getIdiomaLabel(
    idioma: string,
  ) {
    return (
      idiomas.find(
        (item) => item.value === idioma,
      )?.label || idioma
    )
  }

  function formatHour(value: string) {
    return value?.slice(0, 5) || '--:--'
  }

  function openCreateModal() {
    setEditingId(null)

    setForm({
      ...initialForm,
      dia_semana: selectedDay,
    })

    setModalOpen(true)
  }

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
    })

    setModalOpen(true)
  }

  function closeModal() {
    if (saving) {
      return
    }

    setModalOpen(false)
    setEditingId(null)
  }

  async function handleSave() {
    if (saving) {
      return
    }

    if (
      form.idioma !== 'ingles' &&
      form.idioma !== 'alemao'
    ) {
      alert(
        'Selecione um idioma válido.',
      )
      return
    }

    if (
      form.hora_inicio ===
      form.hora_fim
    ) {
      alert(
        'O horário inicial e final não podem ser iguais.',
      )
      return
    }

    if (
      !form.hora_inicio ||
      !form.hora_fim
    ) {
      alert(
        'Informe o horário inicial e o horário final.',
      )
      return
    }

    if (
      form.hora_fim <=
      form.hora_inicio
    ) {
      alert(
        'O horário final deve ser posterior ao horário inicial.',
      )
      return
    }

    try {
      setSaving(true)

      /*
       * Verifica duplicidade de horário.
       *
       * O idioma também participa da validação,
       * permitindo por exemplo:
       *
       * Segunda 08:00 Inglês
       * Segunda 08:00 Alemão
       *
       * como horários diferentes.
       */
      let duplicateQuery = supabase
        .from('horarios')
        .select('id')
        .eq(
          'idioma',
          form.idioma,
        )
        .eq(
          'dia_semana',
          form.dia_semana,
        )
        .eq(
          'hora_inicio',
          form.hora_inicio,
        )
        .eq(
          'hora_fim',
          form.hora_fim,
        )
        .limit(1)

      if (editingId) {
        duplicateQuery =
          duplicateQuery.neq(
            'id',
            editingId,
          )
      }

      const {
        data: duplicate,
        error: duplicateError,
      } = await duplicateQuery.maybeSingle()

      if (duplicateError) {
        throw duplicateError
      }

      if (duplicate) {
        alert(
          'Já existe um horário cadastrado para este idioma, dia e período.',
        )

        return
      }

      const alunoId =
        form.aluno_id || null

      /*
       * Quando existe aluno vinculado,
       * o horário deixa de estar disponível
       * para nova matrícula.
       */
      const payload = {
        idioma: form.idioma,

        /*
         * A tabela utiliza 0–6.
         */
        dia_semana:
          Number(form.dia_semana),

        hora_inicio:
          form.hora_inicio,

        hora_fim:
          form.hora_fim,

        disponivel: alunoId
          ? false
          : Boolean(
              form.disponivel,
            ),

        aluno_id: alunoId,
      }

      console.log(
        'Salvando horário:',
        payload,
      )

      if (editingId) {
        const {
          data,
          error,
        } = await supabase
          .from('horarios')
          .update(payload)
          .eq('id', editingId)
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
          .maybeSingle()

        if (error) {
          throw error
        }

        if (!data) {
          throw new Error(
            'O horário não foi encontrado ou não foi possível atualizar o registro.',
          )
        }
      } else {
        const {
          data,
          error,
        } = await supabase
          .from('horarios')
          .insert(payload)
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
          .single()

        if (error) {
          throw error
        }

        if (!data) {
          throw new Error(
            'O horário não foi criado.',
          )
        }
      }

      const savedDay =
        form.dia_semana

      setModalOpen(false)
      setEditingId(null)

      setForm({
        ...initialForm,
        dia_semana:
          savedDay,
      })

      await loadAgenda()

      setSelectedDay(
        savedDay,
      )
    } catch (err) {
      console.error(
        'Erro ao salvar horário:',
        err,
      )

      alert(
        `Não foi possível salvar o horário.\n\n${getErrorMessage(err)}`,
      )
    } finally {
      setSaving(false)
    }
  }

  async function toggleAvailability(
    horario: Horario,
  ) {
    if (horario.aluno_id) {
      alert(
        'Este horário possui um aluno vinculado. Desvincule o aluno antes de alterar a disponibilidade.',
      )

      return
    }

    try {
      const newAvailability =
        !horario.disponivel

      const {
        error,
      } = await supabase
        .from('horarios')
        .update({
          disponivel:
            newAvailability,
        })
        .eq(
          'id',
          horario.id,
        )

      if (error) {
        throw error
      }

      await loadAgenda()
    } catch (err) {
      console.error(
        'Erro ao alterar disponibilidade:',
        err,
      )

      alert(
        `Não foi possível alterar a disponibilidade.\n\n${getErrorMessage(err)}`,
      )
    }
  }

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
      const {
        error,
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

      if (error) {
        throw error
      }

      await loadAgenda()
    } catch (err) {
      console.error(
        'Erro ao desvincular aluno:',
        err,
      )

      alert(
        `Não foi possível desvincular o aluno.\n\n${getErrorMessage(err)}`,
      )
    }
  }

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

    if (err instanceof Error) {
      return err.message
    }

    return 'Erro desconhecido.'
  }

  return (
    <section className="agenda-page">
      <div className="agenda-page-header">
        <div>
          <h1>Agenda</h1>

          <p>
            Gerencie horários, aulas e
            disponibilidade.
          </p>
        </div>

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

      {error && (
        <div className="agenda-error">
          {error}
        </div>
      )}

      <div className="agenda-day-selector">
        {diasSemana.map((dia) => {
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
              key={dia.value}
              type="button"
              className={`agenda-day-button ${
                active
                  ? 'active'
                  : ''
              }`}
              onClick={() =>
                setSelectedDay(
                  dia.value,
                )
              }
            >
              <span className="agenda-day-short">
                {dia.short}
              </span>

              <span className="agenda-day-name">
                {dia.label}
              </span>

              <span className="agenda-day-count">
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="agenda-summary">
        <div className="agenda-summary-item">
          <CalendarDays size={18} />

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
              {horariosDoDia.length}{' '}
              {horariosDoDia.length ===
              1
                ? 'horário'
                : 'horários'}
            </span>
          </div>
        </div>

        <div className="agenda-summary-item">
          <CheckCircle2 size={18} />

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
          <UserRound size={18} />

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

          <Clock3 size={20} />
        </div>

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

              <button
                type="button"
                className="agenda-secondary-button"
                onClick={
                  openCreateModal
                }
              >
                <Plus size={17} />
                Criar horário
              </button>
            </div>
          ) : (
            <div className="agenda-list">
              {horariosDoDia.map(
                (horario) => {
                  const alunoNome =
                    getAlunoNome(
                      horario.aluno_id,
                    )

                  const ocupado =
                    !!horario.aluno_id

                  return (
                    <div
                      key={
                        horario.id
                      }
                      className={`agenda-item ${
                        ocupado
                          ? 'occupied'
                          : 'available'
                      }`}
                    >
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
                      </div>

                      <div className="agenda-actions">
                        {ocupado && (
                          <button
                            type="button"
                            className="agenda-action-button"
                            onClick={() =>
                              unlinkStudent(
                                horario,
                              )
                            }
                            title="Desvincular aluno"
                          >
                            <X size={17} />
                          </button>
                        )}

                        {!ocupado && (
                          <button
                            type="button"
                            className="agenda-action-button"
                            onClick={() =>
                              toggleAvailability(
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
                          <Edit3 size={17} />
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

      {modalOpen && (
        <div
          className="agenda-modal-overlay"
          onMouseDown={(event) => {
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
                <X size={19} />
              </button>
            </div>

            <div className="agenda-form">
              <div className="agenda-form-field">
                <label htmlFor="agenda-idioma">
                  Idioma
                </label>

                <select
                  id="agenda-idioma"
                  value={form.idioma}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        idioma:
                          event.target
                            .value as
                            | 'ingles'
                            | 'alemao',
                      }),
                    )
                  }
                >
                  {idiomas.map(
                    (idioma) => (
                      <option
                        key={
                          idioma.value
                        }
                        value={
                          idioma.value
                        }
                      >
                        {idioma.label}
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
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        dia_semana:
                          Number(
                            event.target
                              .value,
                          ),
                      }),
                    )
                  }
                >
                  {diasSemana.map(
                    (dia) => (
                      <option
                        key={
                          dia.value
                        }
                        value={
                          dia.value
                        }
                      >
                        {dia.label}
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
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          hora_inicio:
                            event.target
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
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          hora_fim:
                            event.target
                              .value,
                        }),
                      )
                    }
                  />
                </div>
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
                  onChange={(event) =>
                    setForm(
                      (current) => ({
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
                    (aluno) => (
                      <option
                        key={aluno.id}
                        value={aluno.id}
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
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        disponivel:
                          event.target
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
                onClick={
                  handleSave
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
    </section>
  )
}