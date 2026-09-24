import { useEffect, useMemo, useState } from 'react'
import {
  Search,
  Eye,
  Pencil,
  X,
  Save,
  UserRound,
  Mail,
  Phone,
  CalendarDays,
  FileText,
  Languages,
  GraduationCap,
  UsersRound,
  RefreshCw,
  UserCog,
  Clock3,
  CheckCircle2,
} from 'lucide-react'

import { supabase } from '../../lib/supabase'
import '../../styles/admin/Alunos.css'

type Idioma = 'ingles' | 'alemao'

type Nivel =
  | 'basico'
  | 'intermediario'
  | 'avancado'

type Professor = {
  id: string
  nome_completo: string
  email: string
  ativo: boolean
  acesso_portal: boolean
}

type Aluno = {
  id: string
  user_id: string
  nome_completo: string
  cpf: string
  email: string
  data_nascimento: string
  telefone: string
  responsavel_nome: string | null
  responsavel_contato: string | null
  idioma: Idioma
  nivel_conversacao: Nivel
  nivel_escrita: Nivel
  nivel_compreensao: Nivel
  professor_id: string | null
  created_at: string
  updated_at: string
}

type Horario = {
  id: string
  idioma: Idioma
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  disponivel: boolean
  aluno_id: string | null
  professor_id: string | null
}

type AlunoForm = {
  nome_completo: string
  cpf: string
  email: string
  data_nascimento: string
  telefone: string
  responsavel_nome: string
  responsavel_contato: string
  idioma: Idioma
  nivel_conversacao: Nivel
  nivel_escrita: Nivel
  nivel_compreensao: Nivel
  professor_id: string | null
}

const idiomaLabels: Record<Idioma, string> = {
  ingles: 'Inglês',
  alemao: 'Alemão',
}

const nivelLabels: Record<Nivel, string> = {
  basico: 'Básico',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
}

const emptyForm: AlunoForm = {
  nome_completo: '',
  cpf: '',
  email: '',
  data_nascimento: '',
  telefone: '',
  responsavel_nome: '',
  responsavel_contato: '',
  idioma: 'ingles',
  nivel_conversacao: 'basico',
  nivel_escrita: 'basico',
  nivel_compreensao: 'basico',
  professor_id: null,
}

function formatCpf(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 11)

  if (numbers.length <= 3) {
    return numbers
  }

  if (numbers.length <= 6) {
    return `${numbers.slice(0, 3)}.${numbers.slice(3)}`
  }

  if (numbers.length <= 9) {
    return `${numbers.slice(0, 3)}.${numbers.slice(
      3,
      6,
    )}.${numbers.slice(6)}`
  }

  return `${numbers.slice(0, 3)}.${numbers.slice(
    3,
    6,
  )}.${numbers.slice(6, 9)}-${numbers.slice(9)}`
}

function formatPhone(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 11)

  if (numbers.length <= 2) {
    return numbers
  }

  if (numbers.length <= 7) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
  }

  if (numbers.length <= 10) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(
      2,
      6,
    )}-${numbers.slice(6)}`
  }

  return `(${numbers.slice(0, 2)}) ${numbers.slice(
    2,
    7,
  )}-${numbers.slice(7)}`
}

function formatDate(value: string) {
  if (!value) {
    return '-'
  }

  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('pt-BR')
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
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function createFormFromAluno(aluno: Aluno): AlunoForm {
  return {
    nome_completo: aluno.nome_completo || '',

    cpf: aluno.cpf
      ? formatCpf(aluno.cpf)
      : '',

    email: aluno.email || '',

    data_nascimento:
      aluno.data_nascimento || '',

    telefone: aluno.telefone
      ? formatPhone(aluno.telefone)
      : '',

    responsavel_nome:
      aluno.responsavel_nome || '',

    responsavel_contato:
      aluno.responsavel_contato
        ? formatPhone(aluno.responsavel_contato)
        : '',

    idioma: aluno.idioma,

    nivel_conversacao:
      aluno.nivel_conversacao,

    nivel_escrita:
      aluno.nivel_escrita,

    nivel_compreensao:
      aluno.nivel_compreensao,

    professor_id:
      aluno.professor_id || null,
  }
}

export default function Alunos() {
  const [alunos, setAlunos] =
    useState<Aluno[]>([])

  const [professores, setProfessores] =
    useState<Professor[]>([])

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [search, setSearch] =
    useState('')

  const [idiomaFilter, setIdiomaFilter] =
    useState<'todos' | Idioma>('todos')

  const [nivelFilter, setNivelFilter] =
    useState<'todos' | Nivel>('todos')

  const [selectedAluno, setSelectedAluno] =
    useState<Aluno | null>(null)

  const [editingAluno, setEditingAluno] =
    useState<Aluno | null>(null)

  const [form, setForm] =
    useState<AlunoForm>(emptyForm)

  const [saving, setSaving] =
    useState(false)

  const [horarios, setHorarios] =
    useState<Horario[]>([])

  const [selectedHorarioIds, setSelectedHorarioIds] =
    useState<string[]>([])

  const [loadingHorarios, setLoadingHorarios] =
    useState(false)

  const [error, setError] =
    useState('')

  const [success, setSuccess] =
    useState('')

  useEffect(() => {
    loadAlunos()
  }, [])

  /*
   * ============================================================
   * CARREGAR ALUNOS E PROFESSORES
   * ============================================================
   */

  async function loadAlunos(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError('')

      const [
        alunosResult,
        professoresResult,
      ] = await Promise.all([
        supabase
          .from('alunos')
          .select(`
            id,
            user_id,
            nome_completo,
            cpf,
            email,
            data_nascimento,
            telefone,
            responsavel_nome,
            responsavel_contato,
            idioma,
            nivel_conversacao,
            nivel_escrita,
            nivel_compreensao,
            professor_id,
            created_at,
            updated_at
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
            ativo,
            acesso_portal
          `)
          .eq('ativo', true)
          .order('nome_completo', {
            ascending: true,
          }),
      ])

      /*
       * ==========================================================
       * ALUNOS
       * ==========================================================
       */

      if (alunosResult.error) {
        console.error(
          '[Alunos] Erro ao carregar alunos:',
          alunosResult.error,
        )

        setError(
          `Não foi possível carregar os alunos: ${alunosResult.error.message}`,
        )

        return
      }

      setAlunos(
        (alunosResult.data ?? []) as Aluno[],
      )

      /*
       * ==========================================================
       * PROFESSORES
       * ==========================================================
       */

      if (professoresResult.error) {
        console.error(
          '[Alunos] Erro ao carregar professores:',
          professoresResult.error,
        )

        setProfessores([])

        setError(
          `Não foi possível carregar os professores: ${professoresResult.error.message}`,
        )

        return
      }

      setProfessores(
        (professoresResult.data ?? []) as Professor[],
      )
    } catch (err) {
      console.error(
        '[Alunos] Erro inesperado:',
        err,
      )

      setError(
        'Ocorreu um erro inesperado ao carregar os alunos.',
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  /*
   * ============================================================
   * NOME DO PROFESSOR
   * ============================================================
   */

  function getProfessorNome(
    professorId: string | null,
  ) {
    if (!professorId) {
      return 'Nenhum professor'
    }

    const professor = professores.find(
      (item) => item.id === professorId,
    )

    return (
      professor?.nome_completo ??
      'Professor não encontrado'
    )
  }

  /*
   * ============================================================
   * FILTROS
   * ============================================================
   */

  const filteredAlunos = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase()

    return alunos.filter((aluno) => {
      const professorNome =
        getProfessorNome(
          aluno.professor_id,
        ).toLowerCase()

      const matchesSearch =
        !normalizedSearch ||
        aluno.nome_completo
          .toLowerCase()
          .includes(normalizedSearch) ||
        aluno.cpf
          .toLowerCase()
          .includes(normalizedSearch) ||
        aluno.email
          .toLowerCase()
          .includes(normalizedSearch) ||
        aluno.telefone
          .toLowerCase()
          .includes(normalizedSearch) ||
        professorNome.includes(
          normalizedSearch,
        )

      const matchesIdioma =
        idiomaFilter === 'todos' ||
        aluno.idioma === idiomaFilter

      const matchesNivel =
        nivelFilter === 'todos' ||
        aluno.nivel_conversacao ===
          nivelFilter ||
        aluno.nivel_escrita ===
          nivelFilter ||
        aluno.nivel_compreensao ===
          nivelFilter

      return (
        matchesSearch &&
        matchesIdioma &&
        matchesNivel
      )
    })
  }, [
    alunos,
    search,
    idiomaFilter,
    nivelFilter,
    professores,
  ])

  /*
   * ============================================================
   * MODAIS
   * ============================================================
   */

  function openDetails(aluno: Aluno) {
    setSelectedAluno(aluno)
    setEditingAluno(null)
    setError('')
    setSuccess('')
  }

  async function openEdit(aluno: Aluno) {
    setEditingAluno(aluno)
    setSelectedAluno(null)

    setForm(
      createFormFromAluno(aluno),
    )

    setSelectedHorarioIds([])
    setHorarios([])
    setError('')
    setSuccess('')
    setLoadingHorarios(true)

    try {
      const { data, error: horariosError } =
        await supabase
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
          .eq('idioma', aluno.idioma)
          .order('dia_semana', {
            ascending: true,
          })
          .order('hora_inicio', {
            ascending: true,
          })

      if (horariosError) {
        throw horariosError
      }

      const loadedHorarios =
        (data ?? []) as Horario[]

      setHorarios(loadedHorarios)

      setSelectedHorarioIds(
        loadedHorarios
          .filter(
            (horario) =>
              horario.aluno_id === aluno.id,
          )
          .map(
            (horario) => horario.id,
          ),
      )
    } catch (err) {
      console.error(
        '[Alunos] Erro ao carregar horários:',
        err,
      )

      setError(
        'Não foi possível carregar os horários: ' +
          (err instanceof Error
            ? err.message
            : 'erro desconhecido'),
      )
    } finally {
      setLoadingHorarios(false)
    }
  }

  function closeModal() {
    if (saving) {
      return
    }

    setSelectedAluno(null)
    setEditingAluno(null)
    setError('')
    setSuccess('')
  }

  /*
   * ============================================================
   * FORMULÁRIO
   * ============================================================
   */

  function toggleHorario(horarioId: string) {
    setSelectedHorarioIds((current) =>
      current.includes(horarioId)
        ? current.filter(
            (id) => id !== horarioId,
          )
        : [...current, horarioId],
    )
  }

  function getDayLabel(day: number) {
    const labels: Record<number, string> = {
      0: 'Domingo',
      1: 'Segunda',
      2: 'Terça',
      3: 'Quarta',
      4: 'Quinta',
      5: 'Sexta',
      6: 'Sábado',
    }

    return labels[day] ?? 'Dia'
  }

  function formatHorario(horario: Horario) {
    return (
      getDayLabel(horario.dia_semana) +
      ' • ' +
      horario.hora_inicio.slice(0, 5) +
      '–' +
      horario.hora_fim.slice(0, 5)
    )
  }

  function updateForm(
    field: keyof AlunoForm,
    value: string | null,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  /*
   * ============================================================
   * SALVAR ALUNO
   * ============================================================
   */

  async function handleSave() {
    if (!editingAluno) {
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      /*
       * IMPORTANTE:
       *
       * Normalizamos o valor antes de enviar.
       * Se nenhum professor estiver selecionado,
       * o banco recebe NULL.
       */
      const professorId =
        form.professor_id?.trim() || null

      const payload = {
        nome_completo:
          form.nome_completo.trim(),

        cpf:
          form.cpf.replace(/\D/g, ''),

        email:
          form.email.trim(),

        data_nascimento:
          form.data_nascimento || null,

        telefone:
          form.telefone.replace(/\D/g, ''),

        responsavel_nome:
          form.responsavel_nome.trim() ||
          null,

        responsavel_contato:
          form.responsavel_contato.replace(
            /\D/g,
            '',
          ) || null,

        idioma:
          form.idioma,

        nivel_conversacao:
          form.nivel_conversacao,

        nivel_escrita:
          form.nivel_escrita,

        nivel_compreensao:
          form.nivel_compreensao,

        professor_id:
          professorId,
      }

      console.log(
        '[Alunos] ID do aluno:',
        editingAluno.id,
      )

      console.log(
        '[Alunos] Professor selecionado:',
        professorId,
      )

      console.log(
        '[Alunos] Payload enviado:',
        payload,
      )

      /*
       * ========================================================
       * ATUALIZAÇÃO
       * ========================================================
       *
       * Não usamos .single().
       *
       * O .select() retorna o registro atualizado para
       * confirmarmos que o professor_id realmente foi
       * gravado no banco.
       */

      const {
        data: updatedRows,
        error: updateError,
      } = await supabase
        .from('alunos')
        .update(payload)
        .eq('id', editingAluno.id)
        .select('id, professor_id')

      /*
       * ========================================================
       * ERRO DO SUPABASE
       * ========================================================
       */

      if (updateError) {
        console.error(
          '[Alunos] Erro no UPDATE:',
          updateError,
        )

        setError(
          `Não foi possível atualizar o aluno: ${updateError.message}`,
        )

        return
      }

      /*
       * ========================================================
       * VERIFICAR SE O UPDATE REALMENTE ALTEROU UMA LINHA
       * ========================================================
       */

      if (
        !updatedRows ||
        updatedRows.length === 0
      ) {
        console.error(
          '[Alunos] Nenhuma linha foi atualizada.',
        )

        setError(
          'O aluno não foi atualizado no Supabase. Verifique as políticas RLS da tabela alunos.',
        )

        return
      }

      const updatedAluno =
        updatedRows[0]

      console.log(
        '[Alunos] Registro retornado pelo Supabase:',
        updatedAluno,
      )

      /*
       * ========================================================
       * CONFIRMAR PROFESSOR_ID
       * ========================================================
       */

      if (
        updatedAluno.professor_id !==
        professorId
      ) {
        console.error(
          '[Alunos] professor_id diferente do esperado:',
          {
            esperado: professorId,
            recebido:
              updatedAluno.professor_id,
          },
        )

        setError(
          'O aluno foi atualizado, mas o professor não foi vinculado corretamente no Supabase.',
        )

        return
      }

      /*
       * ========================================================
       * RECARREGAR DADOS DO BANCO
       * ========================================================
       */

      /*
       * ========================================================
       * VINCULAR HORÁRIOS
       * ========================================================
       *
       * Os horários selecionados passam a pertencer ao aluno.
       * Os que foram desmarcados são liberados novamente.
       */
      const horarioUpdates = horarios.map(
        (horario) => {
          const shouldBeLinked =
            selectedHorarioIds.includes(
              horario.id,
            )

          const wasLinked =
            horario.aluno_id ===
            editingAluno.id

          if (
            shouldBeLinked ===
            wasLinked
          ) {
            return null
          }

          return supabase
            .from('horarios')
            .update({
              aluno_id:
                shouldBeLinked
                  ? editingAluno.id
                  : null,
              disponivel:
                shouldBeLinked
                  ? false
                  : true,
            })
            .eq('id', horario.id)
        },
      )

      const horarioResults =
        await Promise.all(
          horarioUpdates.filter(
            (
              result,
            ): result is PromiseLike<{
              error: any
            }> =>
              Boolean(result),
          ),
        )

      const horarioError =
        horarioResults.find(
          (result) => result.error,
        )?.error

      if (horarioError) {
        throw horarioError
      }

      await loadAlunos()

      /*
       * ========================================================
       * SUCESSO
       * ========================================================
       */

      setSuccess(
        professorId
          ? 'Aluno atualizado e professor vinculado com sucesso.'
          : 'Aluno atualizado com sucesso.',
      )

      setEditingAluno(null)
      setSelectedAluno(null)
    } catch (err) {
      console.error(
        '[Alunos] Erro inesperado ao salvar:',
        err,
      )

      setError(
        'Ocorreu um erro inesperado ao atualizar o aluno.',
      )
    } finally {
      setSaving(false)
    }
  }

  /*
   * ============================================================
   * LIMPAR FILTROS
   * ============================================================
   */

  function clearFilters() {
    setSearch('')
    setIdiomaFilter('todos')
    setNivelFilter('todos')
  }

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <div className="alunos-page">
      <div className="alunos-header">
        <div>
          <div className="alunos-title-row">
            <div className="alunos-title-icon">
              <GraduationCap size={24} />
            </div>

            <div>
              <h1>Alunos</h1>

              <p>
                Gerencie os alunos
                cadastrados na AB
                Academy.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="alunos-refresh-button"
          onClick={() =>
            loadAlunos(true)
          }
          disabled={
            loading ||
            refreshing
          }
        >
          <RefreshCw
            size={17}
            className={
              refreshing
                ? 'alunos-spin'
                : ''
            }
          />

          Atualizar
        </button>
      </div>

      {error &&
        !selectedAluno &&
        !editingAluno && (
          <div className="alunos-alert alunos-alert-error">
            {error}
          </div>
        )}

      {success &&
        !editingAluno && (
          <div className="alunos-alert alunos-alert-success">
            {success}
          </div>
        )}

      <div className="alunos-stats">
        <div className="alunos-stat-card">
          <div className="alunos-stat-icon">
            <UsersRound size={20} />
          </div>

          <div>
            <span>Total de alunos</span>

            <strong>
              {alunos.length}
            </strong>
          </div>
        </div>

        <div className="alunos-stat-card">
          <div className="alunos-stat-icon">
            <Languages size={20} />
          </div>

          <div>
            <span>Inglês</span>

            <strong>
              {
                alunos.filter(
                  (aluno) =>
                    aluno.idioma ===
                    'ingles',
                ).length
              }
            </strong>
          </div>
        </div>

        <div className="alunos-stat-card">
          <div className="alunos-stat-icon">
            <Languages size={20} />
          </div>

          <div>
            <span>Alemão</span>

            <strong>
              {
                alunos.filter(
                  (aluno) =>
                    aluno.idioma ===
                    'alemao',
                ).length
              }
            </strong>
          </div>
        </div>

        <div className="alunos-stat-card">
          <div className="alunos-stat-icon">
            <GraduationCap size={20} />
          </div>

          <div>
            <span>Exibindo</span>

            <strong>
              {filteredAlunos.length}
            </strong>
          </div>
        </div>
      </div>

      <div className="alunos-toolbar">
        <div className="alunos-search">
          <Search size={18} />

          <input
            type="text"
            placeholder="Pesquisar por nome, CPF, e-mail, telefone ou professor..."
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
          />
        </div>

        <select
          value={idiomaFilter}
          onChange={(event) =>
            setIdiomaFilter(
              event.target
                .value as
                | 'todos'
                | Idioma,
            )
          }
          className="alunos-filter"
        >
          <option value="todos">
            Todos os idiomas
          </option>

          <option value="ingles">
            Inglês
          </option>

          <option value="alemao">
            Alemão
          </option>
        </select>

        <select
          value={nivelFilter}
          onChange={(event) =>
            setNivelFilter(
              event.target
                .value as
                | 'todos'
                | Nivel,
            )
          }
          className="alunos-filter"
        >
          <option value="todos">
            Todos os níveis
          </option>

          <option value="basico">
            Básico
          </option>

          <option value="intermediario">
            Intermediário
          </option>

          <option value="avancado">
            Avançado
          </option>
        </select>

        {(search ||
          idiomaFilter !== 'todos' ||
          nivelFilter !== 'todos') && (
          <button
            type="button"
            className="alunos-clear-filters"
            onClick={clearFilters}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="alunos-content">
        {loading ? (
          <div className="alunos-loading">
            <div className="alunos-loading-spinner" />

            <span>
              Carregando alunos...
            </span>
          </div>
        ) : filteredAlunos.length === 0 ? (
          <div className="alunos-empty">
            <div className="alunos-empty-icon">
              <UsersRound size={30} />
            </div>

            <h2>
              Nenhum aluno encontrado
            </h2>

            <p>
              {alunos.length === 0
                ? 'Ainda não existem alunos cadastrados.'
                : 'Nenhum aluno corresponde aos filtros selecionados.'}
            </p>

            {alunos.length > 0 && (
              <button
                type="button"
                onClick={clearFilters}
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="alunos-table-wrapper">
            <table className="alunos-table">
              <thead>
                <tr>
                  <th>Aluno</th>

                  <th>CPF</th>

                  <th>Contato</th>

                  <th>Idioma</th>

                  <th>Professor</th>

                  <th>Níveis</th>

                  <th className="alunos-actions-column">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredAlunos.map(
                  (aluno) => (
                    <tr key={aluno.id}>
                      <td>
                        <div className="alunos-person">
                          <div className="alunos-avatar">
                            {getInitials(
                              aluno.nome_completo,
                            )}
                          </div>

                          <div>
                            <strong>
                              {
                                aluno.nome_completo
                              }
                            </strong>

                            <span>
                              Nascimento:{' '}
                              {formatDate(
                                aluno.data_nascimento,
                              )}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        {formatCpf(
                          aluno.cpf,
                        )}
                      </td>

                      <td>
                        <div className="alunos-contact">
                          <span>
                            {
                              aluno.email
                            }
                          </span>

                          <span>
                            {formatPhone(
                              aluno.telefone,
                            )}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`alunos-language alunos-language-${aluno.idioma}`}
                        >
                          {
                            idiomaLabels[
                              aluno.idioma
                            ]
                          }
                        </span>
                      </td>

                      <td>
                        <div className="alunos-professor-cell">
                          <UserCog size={16} />

                          <span>
                            {getProfessorNome(
                              aluno.professor_id,
                            )}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="alunos-levels">
                          <span>
                            C:{' '}
                            {
                              nivelLabels[
                                aluno
                                  .nivel_conversacao
                              ]
                            }
                          </span>

                          <span>
                            E:{' '}
                            {
                              nivelLabels[
                                aluno
                                  .nivel_escrita
                              ]
                            }
                          </span>

                          <span>
                            Cmp:{' '}
                            {
                              nivelLabels[
                                aluno
                                  .nivel_compreensao
                              ]
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="alunos-actions">
                          <button
                            type="button"
                            title="Visualizar aluno"
                            onClick={() =>
                              openDetails(
                                aluno,
                              )
                            }
                          >
                            <Eye size={17} />
                          </button>

                          <button
                            type="button"
                            title="Editar aluno"
                            onClick={() =>
                              void openEdit(
                                aluno,
                              )
                            }
                          >
                            <Pencil size={17} />
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
      </div>

      {/* ========================================================
          MODAL — VISUALIZAÇÃO
          ======================================================== */}

      {selectedAluno && (
        <div
          className="alunos-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal()
            }
          }}
        >
          <div className="alunos-modal alunos-view-modal">
            <div className="alunos-modal-header">
              <div>
                <h2>
                  Dados do aluno
                </h2>

                <p>
                  Informações cadastrais
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="alunos-modal-close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="alunos-profile-header">
              <div className="alunos-profile-avatar">
                {getInitials(
                  selectedAluno.nome_completo,
                )}
              </div>

              <div>
                <h3>
                  {
                    selectedAluno.nome_completo
                  }
                </h3>

                <span>
                  {
                    idiomaLabels[
                      selectedAluno.idioma
                    ]
                  }
                </span>
              </div>
            </div>

            <div className="alunos-detail-section">
              <h3>Dados pessoais</h3>

              <div className="alunos-detail-grid">
                <div className="alunos-detail-item">
                  <span>
                    <UserRound size={16} />
                    Nome completo
                  </span>

                  <strong>
                    {
                      selectedAluno.nome_completo
                    }
                  </strong>
                </div>

                <div className="alunos-detail-item">
                  <span>
                    <FileText size={16} />
                    CPF
                  </span>

                  <strong>
                    {formatCpf(
                      selectedAluno.cpf,
                    )}
                  </strong>
                </div>

                <div className="alunos-detail-item">
                  <span>
                    <Mail size={16} />
                    E-mail
                  </span>

                  <strong>
                    {
                      selectedAluno.email
                    }
                  </strong>
                </div>

                <div className="alunos-detail-item">
                  <span>
                    <Phone size={16} />
                    Telefone
                  </span>

                  <strong>
                    {formatPhone(
                      selectedAluno.telefone,
                    )}
                  </strong>
                </div>

                <div className="alunos-detail-item">
                  <span>
                    <CalendarDays size={16} />
                    Data de nascimento
                  </span>

                  <strong>
                    {formatDate(
                      selectedAluno.data_nascimento,
                    )}
                  </strong>
                </div>
              </div>
            </div>

            <div className="alunos-detail-section">
              <h3>
                Professor responsável
              </h3>

              <div className="alunos-detail-grid">
                <div className="alunos-detail-item">
                  <span>
                    <UserCog size={16} />
                    Professor
                  </span>

                  <strong>
                    {getProfessorNome(
                      selectedAluno.professor_id,
                    )}
                  </strong>
                </div>
              </div>
            </div>

            <div className="alunos-detail-section">
              <h3>Responsável</h3>

              <div className="alunos-detail-grid">
                <div className="alunos-detail-item">
                  <span>
                    <UserRound size={16} />
                    Nome
                  </span>

                  <strong>
                    {selectedAluno.responsavel_nome ||
                      'Não informado'}
                  </strong>
                </div>

                <div className="alunos-detail-item">
                  <span>
                    <Phone size={16} />
                    Contato
                  </span>

                  <strong>
                    {selectedAluno.responsavel_contato
                      ? formatPhone(
                          selectedAluno.responsavel_contato,
                        )
                      : 'Não informado'}
                  </strong>
                </div>
              </div>
            </div>

            <div className="alunos-detail-section">
              <h3>
                Formação no idioma
              </h3>

              <div className="alunos-detail-grid alunos-level-grid">
                <div className="alunos-level-card">
                  <span>
                    Conversação
                  </span>

                  <strong>
                    {
                      nivelLabels[
                        selectedAluno
                          .nivel_conversacao
                      ]
                    }
                  </strong>
                </div>

                <div className="alunos-level-card">
                  <span>Escrita</span>

                  <strong>
                    {
                      nivelLabels[
                        selectedAluno
                          .nivel_escrita
                      ]
                    }
                  </strong>
                </div>

                <div className="alunos-level-card">
                  <span>
                    Compreensão
                  </span>

                  <strong>
                    {
                      nivelLabels[
                        selectedAluno
                          .nivel_compreensao
                      ]
                    }
                  </strong>
                </div>
              </div>
            </div>

            <div className="alunos-modal-footer">
              <button
                type="button"
                className="alunos-secondary-button"
                onClick={closeModal}
              >
                Fechar
              </button>

              <button
                type="button"
                className="alunos-primary-button"
                onClick={() =>
                  void openEdit(
                    selectedAluno,
                  )
                }
              >
                <Pencil size={17} />
                Editar aluno
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL — EDIÇÃO
          ======================================================== */}

      {editingAluno && (
        <div
          className="alunos-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal()
            }
          }}
        >
          <div className="alunos-modal alunos-edit-modal">
            <div className="alunos-modal-header">
              <div>
                <h2>Editar aluno</h2>

                <p>
                  Atualize os dados
                  cadastrais do aluno.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="alunos-modal-close"
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="alunos-alert alunos-alert-error">
                {error}
              </div>
            )}

            {success && (
              <div className="alunos-alert alunos-alert-success">
                {success}
              </div>
            )}

            <div className="alunos-form">
              {/* ==================================================
                  DADOS PESSOAIS
                  ================================================== */}

              <div className="alunos-form-section">
                <h3>Dados pessoais</h3>

                <div className="alunos-form-grid">
                  <label className="alunos-field alunos-field-full">
                    <span>
                      Nome completo
                    </span>

                    <div className="alunos-input-wrapper">
                      <UserRound size={17} />

                      <input
                        type="text"
                        value={
                          form.nome_completo
                        }
                        onChange={(event) =>
                          updateForm(
                            'nome_completo',
                            event.target.value,
                          )
                        }
                      />
                    </div>
                  </label>

                  <label className="alunos-field">
                    <span>CPF</span>

                    <div className="alunos-input-wrapper">
                      <FileText size={17} />

                      <input
                        type="text"
                        value={form.cpf}
                        onChange={(event) =>
                          updateForm(
                            'cpf',
                            formatCpf(
                              event.target.value,
                            ),
                          )
                        }
                      />
                    </div>
                  </label>

                  <label className="alunos-field">
                    <span>
                      Data de nascimento
                    </span>

                    <div className="alunos-input-wrapper">
                      <CalendarDays size={17} />

                      <input
                        type="date"
                        value={
                          form.data_nascimento
                        }
                        onChange={(event) =>
                          updateForm(
                            'data_nascimento',
                            event.target.value,
                          )
                        }
                      />
                    </div>
                  </label>

                  <label className="alunos-field">
                    <span>E-mail</span>

                    <div className="alunos-input-wrapper">
                      <Mail size={17} />

                      <input
                        type="email"
                        value={form.email}
                        onChange={(event) =>
                          updateForm(
                            'email',
                            event.target.value,
                          )
                        }
                      />
                    </div>
                  </label>

                  <label className="alunos-field">
                    <span>Telefone</span>

                    <div className="alunos-input-wrapper">
                      <Phone size={17} />

                      <input
                        type="text"
                        value={
                          form.telefone
                        }
                        onChange={(event) =>
                          updateForm(
                            'telefone',
                            formatPhone(
                              event.target.value,
                            ),
                          )
                        }
                      />
                    </div>
                  </label>
                </div>
              </div>

              {/* ==================================================
                  PROFESSOR
                  ================================================== */}

              <div className="alunos-form-section">
                <h3>
                  Professor responsável
                </h3>

                <div className="alunos-form-grid">
                  <label className="alunos-field alunos-field-full">
                    <span>
                      Professor
                    </span>

                    <div className="alunos-input-wrapper">
                      <UserCog size={17} />

                      <select
                        value={
                          form.professor_id ??
                          ''
                        }
                        onChange={(event) =>
                          updateForm(
                            'professor_id',
                            event.target.value ||
                              null,
                          )
                        }
                        disabled={saving}
                      >
                        <option value="">
                          Nenhum professor
                        </option>

                        {professores.map(
                          (professor) => (
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
                              {' — '}
                              {
                                professor.email
                              }
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  </label>
                </div>

                <p className="alunos-professor-help">
                  O professor selecionado
                  poderá visualizar este
                  aluno no portal do
                  professor.
                </p>
              </div>

              {/* ==================================================
                  HORÁRIOS DO ALUNO
                  ================================================== */}

              <div className="alunos-form-section">
                <div className="alunos-section-heading">
                  <div>
                    <h3>Horários do aluno</h3>
                    <p>
                      Vincule diretamente os horários recorrentes deste aluno.
                    </p>
                  </div>

                  <span className="alunos-schedule-count">
                    {selectedHorarioIds.length} selecionado(s)
                  </span>
                </div>

                {loadingHorarios ? (
                  <div className="alunos-schedule-loading">
                    <RefreshCw
                      size={17}
                      className="alunos-spin"
                    />
                    Carregando horários...
                  </div>
                ) : horarios.length === 0 ? (
                  <div className="alunos-schedule-empty">
                    <Clock3 size={20} />
                    <div>
                      <strong>
                        Nenhum horário cadastrado
                      </strong>
                      <span>
                        Crie os horários deste idioma em Agenda para vinculá-los aqui.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="alunos-schedule-list">
                    {horarios.map((horario) => {
                      const linkedToAnother =
                        Boolean(
                          horario.aluno_id &&
                          horario.aluno_id !==
                            editingAluno.id,
                        )

                      const checked =
                        selectedHorarioIds.includes(
                          horario.id,
                        )

                      const optionClass =
                        'alunos-schedule-option' +
                        (checked ? ' selected' : '') +
                        (linkedToAnother ? ' disabled' : '')

                      return (
                        <label
                          key={horario.id}
                          className={optionClass}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={
                              saving ||
                              linkedToAnother
                            }
                            onChange={() =>
                              toggleHorario(
                                horario.id,
                              )
                            }
                          />

                          <span className="alunos-schedule-check">
                            {checked ? (
                              <CheckCircle2
                                size={18}
                              />
                            ) : (
                              <Clock3
                                size={18}
                              />
                            )}
                          </span>

                          <span className="alunos-schedule-info">
                            <strong>
                              {formatHorario(
                                horario,
                              )}
                            </strong>

                            <span>
                              {idiomaLabels[
                                horario.idioma
                              ]}
                              {horario.professor_id
                                ? ' • Professor vinculado'
                                : ' • Sem professor'}
                            </span>
                          </span>

                          {linkedToAnother && (
                            <span className="alunos-schedule-busy">
                              Ocupado
                            </span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                )}

                <p className="alunos-schedule-hint">
                  Ao salvar, os horários marcados serão vinculados a este aluno e
                  ficarão indisponíveis para novas matrículas. Os horários
                  desmarcados serão liberados novamente.
                </p>
              </div>

              {/* ==================================================
                  RESPONSÁVEL
                  ================================================== */}

              <div className="alunos-form-section">
                <h3>Responsável</h3>

                <div className="alunos-form-grid">
                  <label className="alunos-field">
                    <span>
                      Nome do responsável
                    </span>

                    <div className="alunos-input-wrapper">
                      <UserRound size={17} />

                      <input
                        type="text"
                        value={
                          form.responsavel_nome
                        }
                        onChange={(event) =>
                          updateForm(
                            'responsavel_nome',
                            event.target.value,
                          )
                        }
                      />
                    </div>
                  </label>

                  <label className="alunos-field">
                    <span>
                      Contato do responsável
                    </span>

                    <div className="alunos-input-wrapper">
                      <Phone size={17} />

                      <input
                        type="text"
                        value={
                          form.responsavel_contato
                        }
                        onChange={(event) =>
                          updateForm(
                            'responsavel_contato',
                            formatPhone(
                              event.target.value,
                            ),
                          )
                        }
                      />
                    </div>
                  </label>
                </div>
              </div>

              {/* ==================================================
                  IDIOMA E NÍVEIS
                  ================================================== */}

              <div className="alunos-form-section">
                <h3>
                  Idioma e níveis
                </h3>

                <div className="alunos-form-grid alunos-level-form-grid">
                  <label className="alunos-field">
                    <span>Idioma</span>

                    <div className="alunos-input-wrapper">
                      <Languages size={17} />

                      <select
                        value={
                          form.idioma
                        }
                        onChange={(event) =>
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

                  <label className="alunos-field">
                    <span>
                      Conversação
                    </span>

                    <select
                      value={
                        form.nivel_conversacao
                      }
                      onChange={(event) =>
                        updateForm(
                          'nivel_conversacao',
                          event.target
                            .value as Nivel,
                        )
                      }
                    >
                      <option value="basico">
                        Básico
                      </option>

                      <option value="intermediario">
                        Intermediário
                      </option>

                      <option value="avancado">
                        Avançado
                      </option>
                    </select>
                  </label>

                  <label className="alunos-field">
                    <span>Escrita</span>

                    <select
                      value={
                        form.nivel_escrita
                      }
                      onChange={(event) =>
                        updateForm(
                          'nivel_escrita',
                          event.target
                            .value as Nivel,
                        )
                      }
                    >
                      <option value="basico">
                        Básico
                      </option>

                      <option value="intermediario">
                        Intermediário
                      </option>

                      <option value="avancado">
                        Avançado
                      </option>
                    </select>
                  </label>

                  <label className="alunos-field">
                    <span>
                      Compreensão
                    </span>

                    <select
                      value={
                        form.nivel_compreensao
                      }
                      onChange={(event) =>
                        updateForm(
                          'nivel_compreensao',
                          event.target
                            .value as Nivel,
                        )
                      }
                    >
                      <option value="basico">
                        Básico
                      </option>

                      <option value="intermediario">
                        Intermediário
                      </option>

                      <option value="avancado">
                        Avançado
                      </option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            {/* ====================================================
                RODAPÉ DO MODAL
                ==================================================== */}

            <div className="alunos-modal-footer">
              <button
                type="button"
                className="alunos-secondary-button"
                onClick={closeModal}
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="alunos-primary-button"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <RefreshCw
                      size={17}
                      className="alunos-spin"
                    />

                    Salvando...
                  </>
                ) : (
                  <>
                    <Save size={17} />

                    Salvar alterações
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}