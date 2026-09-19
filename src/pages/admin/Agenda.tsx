import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  ExternalLink,
  Plus,
  Video,
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
  meet_url: string | null
  meet_space_name: string | null
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
  { value: 1, label: 'Segunda', short: 'SEG' },
  { value: 2, label: 'Terça', short: 'TER' },
  { value: 3, label: 'Quarta', short: 'QUA' },
  { value: 4, label: 'Quinta', short: 'QUI' },
  { value: 5, label: 'Sexta', short: 'SEX' },
  { value: 6, label: 'Sábado', short: 'SÁB' },
  { value: 0, label: 'Domingo', short: 'DOM' },
]

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

  const [connectingGoogle, setConnectingGoogle] =
    useState(false)

  const [creatingMeetId, setCreatingMeetId] =
    useState<string | null>(null)

  /*
   * =========================================================
   * CARREGAR AGENDA
   * =========================================================
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
              aluno_id,
              meet_url,
              meet_space_name
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
        `Não foi possível carregar a agenda.\n${getErrorMessage(err)}`,
      )
    } finally {
      setLoading(false)
    }
  }

  /*
   * =========================================================
   * HORÁRIOS DO DIA
   * =========================================================
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
   * =========================================================
   * AUXILIARES
   * =========================================================
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
   * =========================================================
   * MODAL - CRIAR
   * =========================================================
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
   * =========================================================
   * MODAL - EDITAR
   * =========================================================
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

  function closeModal() {
    if (saving) {
      return
    }

    setModalOpen(false)
    setEditingId(null)
    setForm(initialForm)
  }

  /*
   * =========================================================
   * SALVAR HORÁRIO
   * =========================================================
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

        alert(
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

        alert(
          'Horário criado com sucesso.',
        )
      }

      setModalOpen(false)
      setEditingId(null)
      setForm(initialForm)

      await loadAgenda()
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

  /*
   * =========================================================
   * DISPONIBILIDADE
   * =========================================================
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

      alert(
        `Não foi possível alterar a disponibilidade.\n\n${getErrorMessage(err)}`,
      )
    }
  }

  /*
   * =========================================================
   * DESVINCULAR ALUNO
   * =========================================================
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

      alert(
        `Não foi possível desvincular o aluno.\n\n${getErrorMessage(err)}`,
      )
    }
  }

  /*
   * =========================================================
   * GOOGLE MEET - CONEXÃO OAUTH
   * =========================================================
   */

  async function connectGoogleMeet() {
    if (connectingGoogle) {
      return
    }

    try {
      setConnectingGoogle(true)
      setError(null)

      const {
        data: {
          session,
        },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        throw sessionError
      }

      if (!session?.access_token) {
        throw new Error(
          'Sua sessão expirou. Faça login novamente.',
        )
      }

      const response =
        await fetch(
          'https://vwmrxdzskvwojyfddjwd.supabase.co/functions/v1/google-meet-auth',
          {
            method: 'GET',
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
              apikey:
                import.meta.env
                  .VITE_SUPABASE_ANON_KEY,
              'Content-Type':
                'application/json',
            },
          },
        )

      const responseText =
        await response.text()

      let data: any = null

      try {
        data = responseText
          ? JSON.parse(responseText)
          : null
      } catch {
        data = {
          error:
            responseText ||
            'Resposta inválida da Edge Function.',
        }
      }

      console.log(
        'google-meet-auth:',
        {
          status: response.status,
          ok: response.ok,
          data,
        },
      )

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.details ||
            'Não foi possível iniciar a conexão com o Google.',
        )
      }

      if (!data?.authorization_url) {
        throw new Error(
          'O Google não retornou a URL de autorização.',
        )
      }

      window.location.href =
        data.authorization_url
    } catch (err) {
      console.error(
        'Erro ao conectar Google Meet:',
        err,
      )

      alert(
        `Não foi possível conectar o Google Meet.\n\n${getErrorMessage(err)}`,
      )

      setConnectingGoogle(false)
    }
  }

  /*
   * =========================================================
   * GOOGLE MEET - CRIAR SALA
   * =========================================================
   */

  async function createMeet(
    horario: Horario,
  ) {
    if (creatingMeetId) {
      return
    }

    try {
      setCreatingMeetId(horario.id)
      setError(null)

      const {
        data: {
          session,
        },
        error: sessionError,
      } =
        await supabase.auth.getSession()

      if (sessionError) {
        console.error(
          'Erro ao obter sessão:',
          sessionError,
        )

        throw sessionError
      }

      if (!session?.access_token) {
        throw new Error(
          'Sua sessão expirou. Faça login novamente.',
        )
      }

      console.log(
        'Sessão encontrada. Chamando google-meet-create...',
      )

      const response =
        await fetch(
          'https://vwmrxdzskvwojyfddjwd.supabase.co/functions/v1/google-meet-create',
          {
            method: 'POST',

            headers: {
              Authorization:
                `Bearer ${session.access_token}`,

              apikey:
                import.meta.env
                  .VITE_SUPABASE_ANON_KEY,

              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              horario_id:
                horario.id,
            }),
          },
        )

      const responseText =
        await response.text()

      let data: any = null

      try {
        data = responseText
          ? JSON.parse(responseText)
          : null
      } catch {
        data = {
          error:
            responseText ||
            'Resposta inválida da Edge Function.',
        }
      }

      console.log(
        'google-meet-create:',
        {
          status: response.status,
          ok: response.ok,
          data,
        },
      )

      if (!response.ok) {
        if (
          data?.code ===
          'GOOGLE_NOT_CONNECTED'
        ) {
          const shouldConnect =
            window.confirm(
              'Nenhuma conta Google Meet está conectada.\n\nDeseja conectar agora?',
            )

          if (shouldConnect) {
            await connectGoogleMeet()
          }

          return
        }

        throw new Error(
          data?.error ||
            data?.google_error ||
            data?.details ||
            'Não foi possível criar a sala Google Meet.',
        )
      }

      if (!data?.meet_url) {
        throw new Error(
          'O Google não retornou o link da sala.',
        )
      }

      await loadAgenda()

      alert(
        data.existing
          ? 'Este horário já possui uma sala Google Meet.'
          : 'Sala Google Meet criada com sucesso.',
      )
    } catch (err) {
      console.error(
        'Erro ao criar Google Meet:',
        err,
      )

      alert(
        `Não foi possível criar a sala Google Meet.\n\n${getErrorMessage(err)}`,
      )
    } finally {
      setCreatingMeetId(null)
    }
  }

  /*
   * =========================================================
   * ABRIR GOOGLE MEET
   * =========================================================
   */

  function openMeet(
    meetUrl: string | null,
  ) {
    if (!meetUrl) {
      return
    }

    window.open(
      meetUrl,
      '_blank',
      'noopener,noreferrer',
    )
  }

  /*
   * =========================================================
   * TRATAMENTO DE ERROS
   * =========================================================
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
   * =========================================================
   * RENDER
   * =========================================================
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

        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            className="agenda-secondary-button"
            onClick={
              connectGoogleMeet
            }
            disabled={
              connectingGoogle
            }
          >
            <Video size={18} />

            {connectingGoogle
              ? 'Conectando...'
              : 'Conectar Google Meet'}
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

          <Clock3
            size={20}
          />
        </div>

        <div className="agenda-panel-content">

          {/* LOADING */}

          {loading ? (
            <div className="agenda-loading">
              <div className="agenda-loading-spinner" />

              <p>
                Carregando horários...
              </p>
            </div>

          ) : horariosDoDia.length ===
            0 ? (

            /* VAZIO */

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

            /* LISTA */

            <div className="agenda-list">

              {horariosDoDia.map(
                (horario) => {
                  const alunoNome =
                    getAlunoNome(
                      horario.aluno_id,
                    )

                  const ocupado =
                    !!horario.aluno_id

                  const creatingMeet =
                    creatingMeetId ===
                    horario.id

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

                      {/* HORÁRIO */}

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

                      {/* INFORMAÇÕES */}

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
                            {horario.meet_url
                              ? 'Google Meet configurado'
                              : 'Google Meet não configurado'}
                          </span>

                        </div>

                      </div>

                      {/* AÇÕES */}

                      <div className="agenda-actions">

                        {/* GOOGLE MEET */}

                        {horario.meet_url ? (

                          <button
                            type="button"
                            className="agenda-action-button"
                            onClick={() =>
                              openMeet(
                                horario.meet_url,
                              )
                            }
                            title="Abrir aula no Google Meet"
                          >
                            <ExternalLink
                              size={17}
                            />
                          </button>

                        ) : (

                          <button
                            type="button"
                            className="agenda-action-button"
                            onClick={() =>
                              createMeet(
                                horario,
                              )
                            }
                            disabled={
                              creatingMeet
                            }
                            title="Criar sala Google Meet"
                          >
                            <Video
                              size={17}
                            />
                          </button>

                        )}

                        {/* DESVINCULAR ALUNO */}

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

                        {/* DISPONIBILIDADE */}

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

                        {/* EDITAR */}

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

                      {/* STATUS CRIAÇÃO MEET */}

                      {creatingMeet && (
                        <div
                          style={{
                            position:
                              'absolute',
                            right:
                              '20px',
                            bottom:
                              '-28px',
                            fontSize:
                              '12px',
                            opacity:
                              0.7,
                          }}
                        >
                          Criando sala...
                        </div>
                      )}

                    </div>
                  )
                },
              )}

            </div>
          )}

        </div>
      </div>

      {/* MODAL */}

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

            {/* HEADER */}

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

            {/* FORMULÁRIO */}

            <div className="agenda-form">

              {/* IDIOMA */}

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

              {/* DIA */}

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

              {/* HORÁRIOS */}

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

              {/* ALUNO */}

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

              {/* DISPONIBILIDADE */}

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

            {/* FOOTER */}

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