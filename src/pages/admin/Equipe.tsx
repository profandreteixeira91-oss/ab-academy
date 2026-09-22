import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  Mail,
  Plus,
  Search,
  UserRound,
  X,
  XCircle,
} from 'lucide-react'

import { supabase } from '../../lib/supabase'
import '../../styles/admin/Equipe.css'

type Idioma = 'ingles' | 'alemao'

type Professor = {
  id: string
  user_id: string | null
  nome_completo: string
  email: string
  telefone: string | null
  ativo: boolean
  acesso_portal: boolean
  created_at: string
  updated_at: string
}

type ProfessorIdioma = {
  id: string
  professor_id: string
  idioma: Idioma
}

type ProfessorForm = {
  nome_completo: string
  email: string
  telefone: string
  idiomas: Idioma[]
  ativo: boolean
}

type FiltroStatus = 'todos' | 'ativos' | 'inativos'

const initialForm: ProfessorForm = {
  nome_completo: '',
  email: '',
  telefone: '',
  idiomas: ['ingles'],
  ativo: true,
}

const idiomas: {
  value: Idioma
  label: string
}[] = [
  {
    value: 'ingles',
    label: 'Inglês',
  },
  {
    value: 'alemao',
    label: 'Alemão',
  },
]

function getErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error
  ) {
    return String(
      (error as { message?: unknown }).message ||
        'Ocorreu um erro.',
    )
  }

  return 'Ocorreu um erro inesperado.'
}

function formatPhone(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 11)

  if (numbers.length <= 2) {
    return numbers
  }

  if (numbers.length <= 7) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
  }

  return `(${numbers.slice(0, 2)}) ${numbers.slice(
    2,
    7,
  )}-${numbers.slice(7)}`
}

function getIdiomaLabel(idioma: Idioma) {
  return idioma === 'ingles' ? 'Inglês' : 'Alemão'
}

export default function Equipe() {
  const [professores, setProfessores] = useState<Professor[]>([])
  const [professorIdiomas, setProfessorIdiomas] = useState<
    ProfessorIdioma[]
  >([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [accessLoadingId, setAccessLoadingId] = useState<
    string | null
  >(null)

  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] =
    useState<FiltroStatus>('todos')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [accessModalOpen, setAccessModalOpen] = useState(false)

  const [accessProfessor, setAccessProfessor] =
    useState<Professor | null>(null)

  const [accessEmail, setAccessEmail] = useState('')
  const [accessPassword, setAccessPassword] = useState('')
  const [accessPasswordConfirmation, setAccessPasswordConfirmation] =
    useState('')

  const [showAccessPassword, setShowAccessPassword] =
    useState(false)

  const [
    showAccessPasswordConfirmation,
    setShowAccessPasswordConfirmation,
  ] = useState(false)

  const [form, setForm] = useState<ProfessorForm>(initialForm)

  useEffect(() => {
    loadEquipe()
  }, [])

  async function loadEquipe() {
    try {
      setLoading(true)
      setError('')

      const [
        professoresResponse,
        idiomasResponse,
      ] = await Promise.all([
        supabase
          .from('professores')
          .select(`
            id,
            user_id,
            nome_completo,
            email,
            telefone,
            ativo,
            acesso_portal,
            created_at,
            updated_at
          `)
          .order('nome_completo', {
            ascending: true,
          }),

        supabase
          .from('professor_idiomas')
          .select(`
            id,
            professor_id,
            idioma
          `),
      ])

      if (professoresResponse.error) {
        throw professoresResponse.error
      }

      if (idiomasResponse.error) {
        throw idiomasResponse.error
      }

      setProfessores(
        (professoresResponse.data || []) as Professor[],
      )

      setProfessorIdiomas(
        (idiomasResponse.data || []) as ProfessorIdioma[],
      )
    } catch (error) {
      console.error(
        'Erro ao carregar equipe:',
        error,
      )

      setError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const professoresFiltrados = useMemo(() => {
    const termo = search.trim().toLowerCase()

    return professores.filter((professor) => {
      const correspondeStatus =
        filtroStatus === 'todos' ||
        (filtroStatus === 'ativos' &&
          professor.ativo) ||
        (filtroStatus === 'inativos' &&
          !professor.ativo)

      if (!correspondeStatus) {
        return false
      }

      if (!termo) {
        return true
      }

      return (
        professor.nome_completo
          .toLowerCase()
          .includes(termo) ||
        professor.email
          .toLowerCase()
          .includes(termo) ||
        (professor.telefone || '')
          .toLowerCase()
          .includes(termo)
      )
    })
  }, [professores, search, filtroStatus])

  const professoresAtivos = professores.filter(
    (professor) => professor.ativo,
  ).length

  const professoresInativos = professores.filter(
    (professor) => !professor.ativo,
  ).length

  function getIdiomasProfessor(professorId: string) {
    return professorIdiomas
      .filter(
        (item) => item.professor_id === professorId,
      )
      .map((item) => item.idioma)
  }

  function openCreateModal() {
    setEditingId(null)
    setForm({
      ...initialForm,
      idiomas: [...initialForm.idiomas],
    })
    setError('')
    setModalOpen(true)
  }

  function openEditModal(professor: Professor) {
    const idiomasProfessor =
      getIdiomasProfessor(professor.id)

    setEditingId(professor.id)

    setForm({
      nome_completo: professor.nome_completo,
      email: professor.email,
      telefone: professor.telefone || '',
      idiomas:
        idiomasProfessor.length > 0
          ? idiomasProfessor
          : ['ingles'],
      ativo: professor.ativo,
    })

    setError('')
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
      idiomas: [...initialForm.idiomas],
    })
  }

  function openAccessModal(professor: Professor) {
    setError('')

    setAccessProfessor(professor)
    setAccessEmail(professor.email)
    setAccessPassword('')
    setAccessPasswordConfirmation('')
    setShowAccessPassword(false)
    setShowAccessPasswordConfirmation(false)
    setAccessModalOpen(true)
  }

  function closeAccessModal() {
    if (accessLoadingId) {
      return
    }

    setAccessModalOpen(false)
    setAccessProfessor(null)
    setAccessEmail('')
    setAccessPassword('')
    setAccessPasswordConfirmation('')
    setShowAccessPassword(false)
    setShowAccessPasswordConfirmation(false)
  }

  function toggleIdioma(idioma: Idioma) {
    setForm((current) => {
      const alreadySelected =
        current.idiomas.includes(idioma)

      if (alreadySelected) {
        if (current.idiomas.length === 1) {
          return current
        }

        return {
          ...current,
          idiomas: current.idiomas.filter(
            (item) => item !== idioma,
          ),
        }
      }

      return {
        ...current,
        idiomas: [
          ...current.idiomas,
          idioma,
        ],
      }
    })
  }

  async function handleSave() {
    try {
      setSaving(true)
      setError('')

      const nome = form.nome_completo.trim()
      const email = form.email.trim().toLowerCase()
      const telefone = form.telefone.trim()

      if (!nome) {
        throw new Error(
          'Informe o nome completo do professor.',
        )
      }

      if (!email) {
        throw new Error(
          'Informe o e-mail do professor.',
        )
      }

      if (form.idiomas.length === 0) {
        throw new Error(
          'Selecione pelo menos um idioma.',
        )
      }

      let professorId = editingId

      if (editingId) {
        const { error: updateError } =
          await supabase
            .from('professores')
            .update({
              nome_completo: nome,
              email,
              telefone: telefone || null,
              ativo: form.ativo,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingId)

        if (updateError) {
          throw updateError
        }

        const { error: deleteIdiomasError } =
          await supabase
            .from('professor_idiomas')
            .delete()
            .eq('professor_id', editingId)

        if (deleteIdiomasError) {
          throw deleteIdiomasError
        }
      } else {
        const { data, error: insertError } =
          await supabase
            .from('professores')
            .insert({
              nome_completo: nome,
              email,
              telefone: telefone || null,
              ativo: form.ativo,
            })
            .select('id')
            .single()

        if (insertError) {
          throw insertError
        }

        professorId = data.id
      }

      if (!professorId) {
        throw new Error(
          'Não foi possível identificar o professor.',
        )
      }

      const idiomasPayload =
        form.idiomas.map((idioma) => ({
          professor_id: professorId,
          idioma,
        }))

      const { error: idiomasError } =
        await supabase
          .from('professor_idiomas')
          .insert(idiomasPayload)

      if (idiomasError) {
        throw idiomasError
      }

      await loadEquipe()
      closeModal()
    } catch (error) {
      console.error(
        'Erro ao salvar professor:',
        error,
      )

      setError(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function toggleProfessor(
    professor: Professor,
  ) {
    const novoStatus = !professor.ativo

    try {
      setError('')

      const { error } = await supabase
        .from('professores')
        .update({
          ativo: novoStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', professor.id)

      if (error) {
        throw error
      }

      setProfessores((current) =>
        current.map((item) =>
          item.id === professor.id
            ? {
                ...item,
                ativo: novoStatus,
              }
            : item,
        ),
      )
    } catch (error) {
      console.error(
        'Erro ao alterar status do professor:',
        error,
      )

      setError(getErrorMessage(error))
    }
  }

  async function handlePortalAccess(
    professor: Professor,
    action: 'disable' | 'enable',
  ) {
    try {
      setAccessLoadingId(professor.id)
      setError('')

      const { data, error } =
        await supabase.functions.invoke(
          'professor-access',
          {
            body: {
              professor_id: professor.id,
              action,
            },
          },
        )

      if (error) {
        throw error
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      await loadEquipe()
    } catch (error) {
      console.error(
        'Erro ao alterar acesso do professor:',
        error,
      )

      setError(getErrorMessage(error))
    } finally {
      setAccessLoadingId(null)
    }
  }

  async function handleCreateAccess() {
    if (!accessProfessor) {
      return
    }

    try {
      setAccessLoadingId(accessProfessor.id)
      setError('')

      const email = accessEmail.trim().toLowerCase()
      const password = accessPassword
      const confirmation =
        accessPasswordConfirmation

      if (!email) {
        throw new Error(
          'Informe o e-mail de acesso.',
        )
      }

      if (password.length < 6) {
        throw new Error(
          'A senha deve possuir pelo menos 6 caracteres.',
        )
      }

      if (password !== confirmation) {
        throw new Error(
          'A confirmação da senha não confere.',
        )
      }

      const { data, error } =
        await supabase.functions.invoke(
          'professor-access',
          {
            body: {
              professor_id:
                accessProfessor.id,
              action: 'create',
              email,
              password,
            },
          },
        )

      if (error) {
        throw error
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      await loadEquipe()
      closeAccessModal()
    } catch (error) {
      console.error(
        'Erro ao criar acesso do professor:',
        error,
      )

      setError(getErrorMessage(error))
    } finally {
      setAccessLoadingId(null)
    }
  }

  function handleDisableAccess(
    professor: Professor,
  ) {
    const confirmed = window.confirm(
      `Deseja desativar o acesso ao portal de ${professor.nome_completo}?`,
    )

    if (!confirmed) {
      return
    }

    handlePortalAccess(professor, 'disable')
  }

  function handleEnableAccess(
    professor: Professor,
  ) {
    const confirmed = window.confirm(
      `Deseja reativar o acesso ao portal de ${professor.nome_completo}?`,
    )

    if (!confirmed) {
      return
    }

    handlePortalAccess(professor, 'enable')
  }

  function renderPortalAccess(
    professor: Professor,
  ) {
    const loadingAccess =
      accessLoadingId === professor.id

    if (
      professor.user_id &&
      professor.acesso_portal
    ) {
      return (
        <div className="equipe-access-content">
          <strong className="equipe-access-active">
            Acesso ativo
          </strong>

          <button
            type="button"
            className="equipe-access-button equipe-access-button-danger"
            disabled={loadingAccess}
            onClick={() =>
              handleDisableAccess(
                professor,
              )
            }
          >
            {loadingAccess
              ? 'Processando...'
              : 'Desativar acesso'}
          </button>
        </div>
      )
    }

    if (professor.user_id) {
      return (
        <div className="equipe-access-content">
          <strong className="equipe-access-blocked">
            Acesso bloqueado
          </strong>

          <button
            type="button"
            className="equipe-access-button"
            disabled={loadingAccess}
            onClick={() =>
              handleEnableAccess(
                professor,
              )
            }
          >
            {loadingAccess
              ? 'Processando...'
              : 'Reativar acesso'}
          </button>
        </div>
      )
    }

    return (
      <div className="equipe-access-content">
        <strong className="equipe-access-pending">
          Não configurado
        </strong>

        <button
          type="button"
          className="equipe-access-button"
          disabled={loadingAccess}
          onClick={() =>
            openAccessModal(professor)
          }
        >
          Configurar acesso
        </button>
      </div>
    )
  }

  return (
    <div className="equipe-page">
      <header className="equipe-header">
        <div className="equipe-header-info">
          <div>
            <h1>Equipe</h1>

            <p>
              Gerencie os professores, acessos e
              permissões da equipe.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="equipe-primary-button"
          onClick={openCreateModal}
        >
          <Plus size={18} />
          Novo professor
        </button>
      </header>

      {error &&
        !modalOpen &&
        !accessModalOpen && (
          <div className="equipe-error">
            <XCircle size={18} />

            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError('')}
              aria-label="Fechar mensagem de erro"
            >
              <X size={16} />
            </button>
          </div>
        )}

      <section className="equipe-summary">
        <button
          type="button"
          className={
            filtroStatus === 'todos'
              ? 'equipe-summary-card active'
              : 'equipe-summary-card'
          }
          onClick={() =>
            setFiltroStatus('todos')
          }
        >
          <span className="equipe-summary-label">
            Total
          </span>

          <strong>{professores.length}</strong>
        </button>

        <button
          type="button"
          className={
            filtroStatus === 'ativos'
              ? 'equipe-summary-card active'
              : 'equipe-summary-card'
          }
          onClick={() =>
            setFiltroStatus('ativos')
          }
        >
          <span className="equipe-summary-label">
            Ativos
          </span>

          <strong>{professoresAtivos}</strong>
        </button>

        <button
          type="button"
          className={
            filtroStatus === 'inativos'
              ? 'equipe-summary-card active'
              : 'equipe-summary-card'
          }
          onClick={() =>
            setFiltroStatus('inativos')
          }
        >
          <span className="equipe-summary-label">
            Inativos
          </span>

          <strong>{professoresInativos}</strong>
        </button>
      </section>

      <section className="equipe-content">
        <div className="equipe-toolbar">
          <div className="equipe-search">
            <Search size={18} />

            <input
              type="text"
              placeholder="Buscar professor..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <select
            value={filtroStatus}
            onChange={(event) =>
              setFiltroStatus(
                event.target.value as FiltroStatus,
              )
            }
            className="equipe-filter"
          >
            <option value="todos">
              Todos os professores
            </option>

            <option value="ativos">
              Ativos
            </option>

            <option value="inativos">
              Inativos
            </option>
          </select>
        </div>

        {loading ? (
          <div className="equipe-empty">
            <p>Carregando equipe...</p>
          </div>
        ) : professoresFiltrados.length === 0 ? (
          <div className="equipe-empty">
            <div className="equipe-empty-icon">
              <UserRound size={26} />
            </div>

            <h3>
              {professores.length === 0
                ? 'Nenhum professor cadastrado'
                : 'Nenhum professor encontrado'}
            </h3>

            <p>
              {professores.length === 0
                ? 'Cadastre o primeiro professor da equipe.'
                : 'Tente alterar os filtros ou a busca.'}
            </p>

            {professores.length === 0 && (
              <button
                type="button"
                className="equipe-primary-button"
                onClick={openCreateModal}
              >
                <Plus size={18} />
                Cadastrar professor
              </button>
            )}
          </div>
        ) : (
          <div className="equipe-list">
            {professoresFiltrados.map(
              (professor) => {
                const idiomasProfessor =
                  getIdiomasProfessor(
                    professor.id,
                  )

                return (
                  <article
                    key={professor.id}
                    className="equipe-card"
                  >
                    <div className="equipe-avatar">
                      {professor.nome_completo
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="equipe-main">
                      <div className="equipe-name-row">
                        <h3>
                          {professor.nome_completo}
                        </h3>

                        <span
                          className={
                            professor.ativo
                              ? 'equipe-status active'
                              : 'equipe-status inactive'
                          }
                        >
                          {professor.ativo ? (
                            <>
                              <CheckCircle2
                                size={14}
                              />
                              Ativo
                            </>
                          ) : (
                            <>
                              <XCircle
                                size={14}
                              />
                              Inativo
                            </>
                          )}
                        </span>
                      </div>

                      <div className="equipe-contact">
                        <span>
                          <Mail size={15} />
                          {professor.email}
                        </span>

                        {professor.telefone && (
                          <span>
                            {professor.telefone}
                          </span>
                        )}
                      </div>

                      <div className="equipe-tags">
                        {idiomasProfessor.length >
                        0 ? (
                          idiomasProfessor.map(
                            (idioma) => (
                              <span
                                key={idioma}
                                className="equipe-tag"
                              >
                                {getIdiomaLabel(
                                  idioma,
                                )}
                              </span>
                            ),
                          )
                        ) : (
                          <span className="equipe-tag muted">
                            Idioma não definido
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="equipe-access">
                      <span className="equipe-access-label">
                        Acesso ao portal
                      </span>

                      {renderPortalAccess(
                        professor,
                      )}
                    </div>

                    <div className="equipe-actions">
                      <button
                        type="button"
                        className="equipe-action-button"
                        title="Editar professor"
                        onClick={() =>
                          openEditModal(
                            professor,
                          )
                        }
                      >
                        <Edit3 size={17} />
                      </button>

                      <button
                        type="button"
                        className={
                          professor.ativo
                            ? 'equipe-action-button danger'
                            : 'equipe-action-button success'
                        }
                        title={
                          professor.ativo
                            ? 'Desativar professor'
                            : 'Ativar professor'
                        }
                        onClick={() =>
                          toggleProfessor(
                            professor,
                          )
                        }
                      >
                        {professor.ativo ? (
                          <XCircle size={17} />
                        ) : (
                          <CheckCircle2
                            size={17}
                          />
                        )}
                      </button>
                    </div>
                  </article>
                )
              },
            )}
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="equipe-modal-overlay">
          <div className="equipe-modal">
            <div className="equipe-modal-header">
              <div>
                <h2>
                  {editingId
                    ? 'Editar professor'
                    : 'Novo professor'}
                </h2>

                <p>
                  {editingId
                    ? 'Atualize os dados do professor.'
                    : 'Cadastre um novo integrante da equipe.'}
                </p>
              </div>

              <button
                type="button"
                className="equipe-modal-close"
                onClick={closeModal}
                disabled={saving}
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="equipe-modal-error">
                <XCircle size={17} />
                {error}
              </div>
            )}

            <div className="equipe-form">
              <label>
                <span>Nome completo</span>

                <input
                  type="text"
                  value={form.nome_completo}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      nome_completo:
                        event.target.value,
                    }))
                  }
                  placeholder="Nome do professor"
                  autoFocus
                />
              </label>

              <label>
                <span>E-mail</span>

                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email:
                        event.target.value,
                    }))
                  }
                  placeholder="professor@email.com"
                />
              </label>

              <label>
                <span>Telefone</span>

                <input
                  type="tel"
                  value={form.telefone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      telefone:
                        formatPhone(
                          event.target.value,
                        ),
                    }))
                  }
                  placeholder="(00) 00000-0000"
                />
              </label>

              <div className="equipe-field">
                <span className="equipe-field-label">
                  Idiomas que leciona
                </span>

                <div className="equipe-language-options">
                  {idiomas.map((idioma) => {
                    const selected =
                      form.idiomas.includes(
                        idioma.value,
                      )

                    return (
                      <button
                        key={idioma.value}
                        type="button"
                        className={
                          selected
                            ? 'equipe-language-option selected'
                            : 'equipe-language-option'
                        }
                        onClick={() =>
                          toggleIdioma(
                            idioma.value,
                          )
                        }
                      >
                        <span className="equipe-checkbox">
                          {selected && (
                            <CheckCircle2
                              size={16}
                            />
                          )}
                        </span>

                        {idioma.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <label className="equipe-toggle-field">
                <span>
                  <strong>
                    Professor ativo
                  </strong>

                  <small>
                    Professor disponível para
                    receber horários e acessar o
                    sistema.
                  </small>
                </span>

                <button
                  type="button"
                  className={
                    form.ativo
                      ? 'equipe-switch on'
                      : 'equipe-switch'
                  }
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      ativo: !current.ativo,
                    }))
                  }
                  aria-label="Alterar status"
                >
                  <span />
                </button>
              </label>
            </div>

            <div className="equipe-modal-footer">
              <button
                type="button"
                className="equipe-secondary-button"
                onClick={closeModal}
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="equipe-primary-button"
                onClick={handleSave}
                disabled={saving}
              >
                {saving
                  ? 'Salvando...'
                  : editingId
                    ? 'Salvar alterações'
                    : 'Cadastrar professor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {accessModalOpen &&
        accessProfessor && (
          <div className="equipe-modal-overlay">
            <div className="equipe-modal">
              <div className="equipe-modal-header">
                <div>
                  <h2>
                    Configurar acesso
                  </h2>

                  <p>
                    Crie o acesso ao portal para{' '}
                    <strong>
                      {
                        accessProfessor.nome_completo
                      }
                    </strong>
                    .
                  </p>
                </div>

                <button
                  type="button"
                  className="equipe-modal-close"
                  onClick={closeAccessModal}
                  disabled={
                    accessLoadingId ===
                    accessProfessor.id
                  }
                  aria-label="Fechar"
                >
                  <X size={20} />
                </button>
              </div>

              {error && (
                <div className="equipe-modal-error">
                  <XCircle size={17} />
                  {error}
                </div>
              )}

              <div className="equipe-form">
                <label>
                  <span>
                    E-mail de acesso
                  </span>

                  <input
                    type="email"
                    value={accessEmail}
                    onChange={(event) =>
                      setAccessEmail(
                        event.target.value,
                      )
                    }
                    placeholder="professor@email.com"
                    autoFocus
                  />

                  <small>
                    Este será o e-mail utilizado
                    para entrar no portal do
                    professor.
                  </small>
                </label>

                <label>
                  <span>Senha</span>

                  <div className="equipe-password-field">
                    <input
                      type={
                        showAccessPassword
                          ? 'text'
                          : 'password'
                      }
                      value={accessPassword}
                      onChange={(event) =>
                        setAccessPassword(
                          event.target.value,
                        )
                      }
                      placeholder="Mínimo de 6 caracteres"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowAccessPassword(
                          (current) =>
                            !current,
                        )
                      }
                      aria-label={
                        showAccessPassword
                          ? 'Ocultar senha'
                          : 'Mostrar senha'
                      }
                    >
                      {showAccessPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </label>

                <label>
                  <span>
                    Confirmar senha
                  </span>

                  <div className="equipe-password-field">
                    <input
                      type={
                        showAccessPasswordConfirmation
                          ? 'text'
                          : 'password'
                      }
                      value={
                        accessPasswordConfirmation
                      }
                      onChange={(event) =>
                        setAccessPasswordConfirmation(
                          event.target.value,
                        )
                      }
                      placeholder="Digite a senha novamente"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowAccessPasswordConfirmation(
                          (current) =>
                            !current,
                        )
                      }
                      aria-label={
                        showAccessPasswordConfirmation
                          ? 'Ocultar confirmação'
                          : 'Mostrar confirmação'
                      }
                    >
                      {showAccessPasswordConfirmation ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </label>

                <div className="equipe-access-security-note">
                  <strong>
                    Acesso interno
                  </strong>

                  <span>
                    A conta será criada diretamente
                    pelo sistema. Nenhum convite ou
                    senha será enviado por e-mail.
                  </span>
                </div>
              </div>

              <div className="equipe-modal-footer">
                <button
                  type="button"
                  className="equipe-secondary-button"
                  onClick={closeAccessModal}
                  disabled={
                    accessLoadingId ===
                    accessProfessor.id
                  }
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  className="equipe-primary-button"
                  onClick={
                    handleCreateAccess
                  }
                  disabled={
                    accessLoadingId ===
                    accessProfessor.id
                  }
                >
                  {accessLoadingId ===
                  accessProfessor.id
                    ? 'Criando acesso...'
                    : 'Criar acesso'}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
