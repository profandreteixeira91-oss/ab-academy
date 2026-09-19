import { useEffect, useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Users,
} from 'lucide-react'

import { supabase } from '../../lib/supabase'
import '../../styles/admin/Dashboard.css'

type DashboardStats = {
  alunos: number
  matriculas: number
  horariosHoje: number
  planosAtivos: number
}

type MatriculaRecente = {
  id: string
  idioma: string
  status: string
  data_inicio: string
  aluno: {
    nome_completo: string
  }[] | null
  plano: {
    nome: string
  }[] | null
}

type HorarioHoje = {
  id: string
  idioma: string
  hora_inicio: string
  hora_fim: string
  aluno: {
    nome_completo: string
  } | null
}

export default function Dashboard() {
  const [loading, setLoading] =
    useState(true)

  const [stats, setStats] =
    useState<DashboardStats>({
      alunos: 0,
      matriculas: 0,
      horariosHoje: 0,
      planosAtivos: 0,
    })

  const [matriculasRecentes, setMatriculasRecentes] =
    useState<MatriculaRecente[]>([])

  const [horariosHoje, setHorariosHoje] =
    useState<HorarioHoje[]>([])

  const [error, setError] =
    useState<string | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      setLoading(true)
      setError(null)

      const today = new Date()

      const weekday = today.getDay()

      const diaSemana =
        weekday === 0 ? 7 : weekday

      const [
        alunosResult,
        matriculasResult,
        horariosResult,
        planosResult,
        matriculasRecentesResult,
      ] = await Promise.all([
        /* =====================================================
           ALUNOS
        ===================================================== */

        supabase
          .from('alunos')
          .select('id', {
            count: 'exact',
            head: true,
          }),

        /* =====================================================
           MATRÍCULAS ATIVAS
        ===================================================== */

        supabase
          .from('matriculas')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('status', 'ativa'),

        /* =====================================================
           HORÁRIOS DE HOJE
        ===================================================== */

        supabase
          .from('horarios')
          .select(`
            id,
            idioma,
            hora_inicio,
            hora_fim,
            aluno_id
          `)
          .eq('dia_semana', diaSemana)
          .eq('disponivel', true)
          .order('hora_inicio', {
            ascending: true,
          }),

        /* =====================================================
           PLANOS ATIVOS
        ===================================================== */

        supabase
          .from('planos')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('ativo', true),

        /* =====================================================
           MATRÍCULAS RECENTES
        ===================================================== */

        supabase
          .from('matriculas')
          .select(`
            id,
            idioma,
            status,
            data_inicio,
            aluno:alunos (
              nome_completo
            ),
            plano:planos (
              nome
            )
          `)
          .order('created_at', {
            ascending: false,
          })
          .limit(5),
      ])

      /* =======================================================
         VALIDAÇÃO DOS RESULTADOS
      ======================================================= */

      if (alunosResult.error) {
        throw alunosResult.error
      }

      if (matriculasResult.error) {
        throw matriculasResult.error
      }

      if (horariosResult.error) {
        throw horariosResult.error
      }

      if (planosResult.error) {
        throw planosResult.error
      }

      if (matriculasRecentesResult.error) {
        throw matriculasRecentesResult.error
      }

      /* =======================================================
         HORÁRIOS + ALUNOS
      ======================================================= */

      const horariosComAluno: HorarioHoje[] =
        await Promise.all(
          (horariosResult.data || []).map(
            async (horario) => {
              if (!horario.aluno_id) {
                return {
                  id: horario.id,
                  idioma: horario.idioma,
                  hora_inicio:
                    horario.hora_inicio,
                  hora_fim:
                    horario.hora_fim,
                  aluno: null,
                }
              }

              const {
                data: aluno,
                error: alunoError,
              } = await supabase
                .from('alunos')
                .select('nome_completo')
                .eq(
                  'id',
                  horario.aluno_id,
                )
                .maybeSingle()

              if (alunoError) {
                console.error(
                  'Erro ao buscar aluno do horário:',
                  alunoError,
                )
              }

              return {
                id: horario.id,
                idioma: horario.idioma,
                hora_inicio:
                  horario.hora_inicio,
                hora_fim:
                  horario.hora_fim,
                aluno: aluno || null,
              }
            },
          ),
        )

      /* =======================================================
         NORMALIZAÇÃO DAS MATRÍCULAS
      ======================================================= */

      const matriculasNormalizadas: MatriculaRecente[] =
        (matriculasRecentesResult.data || []).map(
          (matricula) => ({
            id: matricula.id,
            idioma: matricula.idioma,
            status: matricula.status,
            data_inicio:
              matricula.data_inicio,

            aluno:
              Array.isArray(matricula.aluno)
                ? matricula.aluno
                : matricula.aluno
                  ? [matricula.aluno]
                  : [],

            plano:
              Array.isArray(matricula.plano)
                ? matricula.plano
                : matricula.plano
                  ? [matricula.plano]
                  : [],
          }),
        )

      /* =======================================================
         ESTATÍSTICAS
      ======================================================= */

      setStats({
        alunos:
          alunosResult.count || 0,

        matriculas:
          matriculasResult.count || 0,

        horariosHoje:
          horariosComAluno.length,

        planosAtivos:
          planosResult.count || 0,
      })

      setHorariosHoje(
        horariosComAluno,
      )

      setMatriculasRecentes(
        matriculasNormalizadas,
      )
    } catch (err) {
      console.error(
        'Erro ao carregar dashboard:',
        err,
      )

      setError(
        'Não foi possível carregar os dados do dashboard.',
      )
    } finally {
      setLoading(false)
    }
  }

  /* =========================================================
     FORMATAÇÕES
  ========================================================= */

  function formatHour(
    value: string,
  ) {
    if (!value) {
      return '-'
    }

    return value.slice(0, 5)
  }

  function formatDate(
    value: string,
  ) {
    if (!value) {
      return '-'
    }

    const [
      year,
      month,
      day,
    ] = value.split('-')

    if (
      !year ||
      !month ||
      !day
    ) {
      return value
    }

    return `${day}/${month}/${year}`
  }

  function formatStatus(
    status: string,
  ) {
    switch (status) {
      case 'ativa':
        return 'Ativa'

      case 'pendente':
        return 'Pendente'

      case 'cancelada':
        return 'Cancelada'

      default:
        return status
    }
  }

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <section className="dashboard-page">
        <div className="dashboard-loading">
          <div className="dashboard-loading-spinner" />

          <p>
            Carregando informações do
            dashboard...
          </p>
        </div>
      </section>
    )
  }

  /* =========================================================
     DASHBOARD
  ========================================================= */

  return (
    <section className="dashboard-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="dashboard-page-header">
        <div>
          <h1>
            Dashboard
          </h1>

          <p>
            Visão geral da AB Academy.
          </p>
        </div>

        <button
          type="button"
          className="dashboard-refresh-button"
          onClick={loadDashboard}
        >
          Atualizar
        </button>
      </div>

      {/* =====================================================
          ERRO
      ===================================================== */}

      {error && (
        <div className="dashboard-error">
          <AlertCircle size={18} />

          <span>
            {error}
          </span>
        </div>
      )}

      {/* =====================================================
          INDICADORES
      ===================================================== */}

      <div className="dashboard-stats-grid">

        {/* ALUNOS */}

        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon">
            <Users size={20} />
          </div>

          <div>
            <span className="dashboard-stat-label">
              Alunos
            </span>

            <strong className="dashboard-stat-value">
              {stats.alunos}
            </strong>
          </div>
        </div>

        {/* MATRÍCULAS */}

        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon">
            <GraduationCap size={20} />
          </div>

          <div>
            <span className="dashboard-stat-label">
              Matrículas ativas
            </span>

            <strong className="dashboard-stat-value">
              {stats.matriculas}
            </strong>
          </div>
        </div>

        {/* HORÁRIOS */}

        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon">
            <CalendarDays size={20} />
          </div>

          <div>
            <span className="dashboard-stat-label">
              Horários hoje
            </span>

            <strong className="dashboard-stat-value">
              {stats.horariosHoje}
            </strong>
          </div>
        </div>

        {/* PLANOS */}

        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon">
            <ClipboardList size={20} />
          </div>

          <div>
            <span className="dashboard-stat-label">
              Planos ativos
            </span>

            <strong className="dashboard-stat-value">
              {stats.planosAtivos}
            </strong>
          </div>
        </div>

      </div>

      {/* =====================================================
          CONTEÚDO
      ===================================================== */}

      <div className="dashboard-content-grid">

        {/* ===================================================
            HORÁRIOS DE HOJE
        =================================================== */}

        <div className="dashboard-panel">

          <div className="dashboard-panel-header">

            <div>
              <h2>
                Horários de hoje
              </h2>

              <p>
                Horários disponíveis para o dia.
              </p>
            </div>

            <CalendarDays size={19} />

          </div>

          <div className="dashboard-panel-content">

            {horariosHoje.length === 0 ? (
              <div className="dashboard-empty">

                <CalendarDays size={28} />

                <strong>
                  Nenhum horário encontrado
                </strong>

                <span>
                  Não existem horários disponíveis
                  para hoje.
                </span>

              </div>
            ) : (
              <div className="dashboard-schedule-list">

                {horariosHoje.map(
                  (horario) => (
                    <div
                      key={horario.id}
                      className="dashboard-schedule-item"
                    >

                      <div className="dashboard-schedule-time">

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

                      <div className="dashboard-schedule-info">

                        <strong>
                          {horario.idioma ||
                            'Idioma não informado'}
                        </strong>

                        <span>
                          {horario.aluno
                            ?.nome_completo ||
                            'Horário disponível'}
                        </span>

                      </div>

                      {horario.aluno && (
                        <CheckCircle2
                          size={18}
                          className="dashboard-schedule-status"
                        />
                      )}

                    </div>
                  ),
                )}

              </div>
            )}

          </div>

        </div>

        {/* ===================================================
            MATRÍCULAS RECENTES
        =================================================== */}

        <div className="dashboard-panel">

          <div className="dashboard-panel-header">

            <div>
              <h2>
                Matrículas recentes
              </h2>

              <p>
                Últimas matrículas registradas.
              </p>
            </div>

            <GraduationCap size={19} />

          </div>

          <div className="dashboard-panel-content">

            {matriculasRecentes.length === 0 ? (
              <div className="dashboard-empty">

                <GraduationCap size={28} />

                <strong>
                  Nenhuma matrícula
                </strong>

                <span>
                  Ainda não existem matrículas
                  registradas.
                </span>

              </div>
            ) : (
              <div className="dashboard-enrollment-list">

                {matriculasRecentes.map(
                  (matricula) => {

                    const aluno =
                      matricula.aluno?.[0]

                    const plano =
                      matricula.plano?.[0]

                    return (
                      <div
                        key={matricula.id}
                        className="dashboard-enrollment-item"
                      >

                        {/* AVATAR */}

                        <div className="dashboard-enrollment-avatar">

                          {aluno?.nome_completo
                            ?.charAt(0)
                            .toUpperCase() ||
                            '?'}

                        </div>

                        {/* INFORMAÇÕES */}

                        <div className="dashboard-enrollment-info">

                          <strong>
                            {aluno?.nome_completo ||
                              'Aluno'}
                          </strong>

                          <span>
                            {plano?.nome ||
                              'Plano não informado'}
                          </span>

                          <small>
                            {matricula.idioma ||
                              'Idioma não informado'}{' '}
                            ·{' '}
                            {formatDate(
                              matricula.data_inicio,
                            )}
                          </small>

                        </div>

                        {/* STATUS */}

                        <span
                          className={`dashboard-status dashboard-status-${matricula.status}`}
                        >
                          {formatStatus(
                            matricula.status,
                          )}
                        </span>

                      </div>
                    )
                  },
                )}

              </div>
            )}

          </div>

        </div>

      </div>

    </section>
  )
}