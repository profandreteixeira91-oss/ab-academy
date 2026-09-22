import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  Plus,
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
 * =========================================================
 * DIAS DA SEMANA
 * =========================================================
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
 * FORMULÁRIO INICIAL
 * =========================================================
 */

const initialForm: HorarioForm = {
  idioma: 'ingles',
  dia_semana: 1,
  hora_inicio: '08:00',
  hora_fim: '09:00',
  disponivel: true,
  aluno_id: '',
}

/*
 * =========================================================
 * DIA ATUAL
 * =========================================================
 */

function getCurrentWeekday() {
  return new Date().getDay()
}

/*
 * =========================================================
 * COMPONENTE
 * =========================================================
 */

export default function Agenda() {
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [alunos, setAlunos] = useState<Aluno[]>([])

  const [selectedDay, setSelectedDay] =
    useState<number>(getCurrentWeekday())

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)

  const [editingId, setEditingId] =
    useState<string | null>(null)

  const [form, setForm] =
    useState<HorarioForm>(initialForm)

  /*
   * =======================================================
   * CARREGAR AGENDA
   * =======================================================
   */

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
   * HORÁRIOS DO DIA SELECIONADO
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
    })

    setModalOpen(true)
  }

  /*
   * =======================================================
   * FECHAR MODAL
   * =======================================================
   */

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
   * SALVAR HORÁRIO
   * =======================================================
   */

  async function handleSave() {
    try {
      setSaving(true)
      setError(null)

      /*
       * Validação do horário inicial
       */

      if (!form.hora_inicio) {
        throw new Error(
          'Informe o horário inicial.',
        )
      }

      /*
       * Validação do horário final
       */

      if (!form.hora_fim) {
        throw new Error(
          'Informe o horário final.',
        )
      }

      /*
       * O horário final precisa ser maior
       * que o horário inicial.
       */

      if (
        form.hora_inicio >=
        form.hora_fim
      ) {
        throw new Error(
          'O horário final deve ser maior que o horário inicial.',
        )
      }

      /*
       * Quando existe aluno vinculado,
       * o horário fica automaticamente
       * indisponível para novas matrículas.
       */

      const payload = {
        idioma: form.idioma,
        dia_semana: form.dia_semana,
        hora_inicio: form.hora_inicio,
        hora_fim: form.hora_fim,
        aluno_id:
          form.aluno_id || null,
        disponivel:
          form.aluno_id
            ? false
            : form.disponivel,
      }

      /*
       * EDITAR
       */

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
      }

      /*
       * CRIAR
       */

      else {
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

      setModalOpen(false)
      setEditingId(null)

      setForm({
        ...initialForm,
        dia_semana: selectedDay,
      })

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
   * DISPONIBILIDADE
   * =======================================================
   */

  async function toggleAvailability(
    horario: Horario,
  ) {
    /*
     * Horário ocupado não pode ser
     * alterado para disponibilidade.
     */

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
          disponivel: novoStatus,
        })
        .eq('id', horario.id)

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
        .eq('id', horario.id)

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
   *
   * A sala agora é interna da AB Academy.
   *
   * O professor entra em:
   *
   * /admin/aula/{horario.id}
   *
   * O componente SalaProfessor será responsável
   * pela autenticação do LiveKit.
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
   * TRATAMENTO DE ERROS
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

      {/* =================================================
          HEADER
          ================================================= */}

      <div className="agenda-page-header">
        <div>
          <h1>Agenda</h1>

          <p>
            Gerencie horários, aulas e
            disponibilidade.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
          }}
        >
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

      {/* =================================================
          ERRO
          ================================================= */}

      {error && (
        <div className="agenda-error">
          {error}
        </div>
      )}

      {/* =================================================
          DIAS DA SEMANA
          ================================================= */}

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
                onClick={() =>
                  setSelectedDay(
                    dia.value,
                  )
                }
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

      {/* =================================================
          RESUMO
          ================================================= */}

      <div className="agenda-summary">

        {/* DIA */}

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

        {/* DISPONÍVEIS */}

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

        {/* OCUPADOS */}

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

      {/* =================================================
          PAINEL DE HORÁRIOS
          ================================================= */}

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

          <Clock3
            size={20}
          />

        </div>

        <div className="agenda-panel-content">

          {/* =================================================
              LOADING
              ================================================= */}

          {loading ? (
            <div className="agenda-loading">

              <div className="agenda-loading-spinner" />

              <p>
                Carregando horários...
              </p>

            </div>
          ) : horariosDoDia.length ===
            0 ? (

            /* ===============================================
               VAZIO
               =============================================== */

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
                <Plus
                  size={17}
                />

                Criar horário
              </button>

            </div>

          ) : (

            /* ===============================================
               LISTA
               =============================================== */

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

                      {/* =================================
                          HORÁRIO
                          ================================= */}

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

                      {/* =================================
                          INFORMAÇÕES
                          ================================= */}

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

                        {/* ALUNO */}

                        <div className="agenda-student">

                          <UserRound
                            size={16}
                          />

                          <span>
                            {alunoNome ||
                              'Nenhum aluno vinculado'}
                          </span>

                        </div>

                        {/* STATUS DA AULA */}

                        <div
                          style={{
                            display:
                              'flex',
                            alignItems:
                              'center',
                            gap:
                              '8px',
                            marginTop:
                              '8px',
                          }}
                        >

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

                      {/* =================================
                          AÇÕES
                          ================================= */}

                      <div className="agenda-actions">

                        {/* =================================
                            ENTRAR NA AULA
                            ================================= */}

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

                        {/* =================================
                            DESVINCULAR ALUNO
                            ================================= */}

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
                            <X
                              size={17}
                            />
                          </button>
                        )}

                        {/* =================================
                            DISPONIBILIDADE
                            ================================= */}

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

                        {/* =================================
                            EDITAR
                            ================================= */}

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
          MODAL
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

            {/* =============================================
                HEADER
                ============================================= */}

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
                disabled={
                  saving
                }
              >
                <X
                  size={19}
                />
              </button>

            </div>

            {/* =============================================
                FORMULÁRIO
                ============================================= */}

            <div className="agenda-form">

              {/* =========================================
                  IDIOMA
                  ========================================= */}

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

              {/* =========================================
                  DIA DA SEMANA
                  ========================================= */}

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

              {/* =========================================
                  HORÁRIOS
                  ========================================= */}

              <div className="agenda-form-row">

                {/* INÍCIO */}

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

                {/* FIM */}

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

              {/* =========================================
                  ALUNO
                  ========================================= */}

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

              {/* =========================================
                  DISPONIBILIDADE
                  ========================================= */}

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

            {/* =============================================
                FOOTER
                ============================================= */}

            <div className="agenda-modal-footer">

              <button
                type="button"
                className="agenda-cancel-button"
                onClick={
                  closeModal
                }
                disabled={
                  saving
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className="agenda-save-button"
                onClick={
                  handleSave
                }
                disabled={
                  saving
                }
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