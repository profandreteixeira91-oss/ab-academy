import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Edit3,
  Plus,
  Search,
  X,
} from 'lucide-react'

import '../../styles/admin/planos.css'
import { supabase } from '../../lib/supabase'

type Idioma = 'ingles' | 'alemao'
type TipoPlano = 'mensal' | 'anual' | 'personalizado' | 'intensivo' | 'avulso'

type Plano = {
  id: string
  idioma: Idioma
  tipo: TipoPlano
  nome: string
  descricao: string | null
  preco: number
  parcelas: number | null
  valor_parcela: number | null
  ativo: boolean
  created_at: string
  updated_at: string
}

type PlanoForm = {
  idioma: Idioma
  tipo: TipoPlano
  nome: string
  descricao: string
  preco: string
  parcelas: string
  valor_parcela: string
  ativo: boolean
}

const emptyForm: PlanoForm = {
  idioma: 'ingles',
  tipo: 'mensal',
  nome: '',
  descricao: '',
  preco: '',
  parcelas: '',
  valor_parcela: '',
  ativo: true,
}

function formatCurrency(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return '-'
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatIdioma(idioma: Idioma) {
  return idioma === 'ingles' ? 'Inglês' : 'Alemão'
}

function formatTipo(tipo: TipoPlano) {
  if (tipo === 'mensal') return 'Mensal'
  if (tipo === 'anual') return 'Anual'
  if (tipo === 'personalizado') return 'Personalizado'
  if (tipo === 'intensivo') return 'Intensivo'
  return 'Avulso'
}

function parseMoney(value: string) {
  const normalized = value
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')

  const number = Number(normalized)

  return Number.isFinite(number) ? number : NaN
}

export default function Planos() {
  const [planos, setPlanos] = useState<Plano[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [filterIdioma, setFilterIdioma] = useState<'todos' | Idioma>(
    'todos',
  )
  const [filterTipo, setFilterTipo] = useState<'todos' | TipoPlano>('todos')
  const [filterStatus, setFilterStatus] = useState<
    'todos' | 'ativo' | 'inativo'
  >('todos')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingPlano, setEditingPlano] = useState<Plano | null>(null)

  const [form, setForm] = useState<PlanoForm>(emptyForm)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function loadPlanos() {
    try {
      setLoading(true)
      setError('')

      const { data, error: supabaseError } = await supabase
        .from('planos')
        .select('*')
        .order('idioma', { ascending: true })
        .order('tipo', { ascending: true })

      if (supabaseError) {
        throw supabaseError
      }

      setPlanos((data ?? []) as Plano[])
    } catch (err) {
      console.error('Erro ao carregar planos:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar os planos.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlanos()
  }, [])

  const filteredPlanos = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return planos.filter((plano) => {
      const matchesSearch =
        !normalizedSearch ||
        plano.nome.toLowerCase().includes(normalizedSearch) ||
        (plano.descricao ?? '').toLowerCase().includes(normalizedSearch)

      const matchesIdioma =
        filterIdioma === 'todos' || plano.idioma === filterIdioma

      const matchesTipo =
        filterTipo === 'todos' || plano.tipo === filterTipo

      const matchesStatus =
        filterStatus === 'todos' ||
        (filterStatus === 'ativo' && plano.ativo) ||
        (filterStatus === 'inativo' && !plano.ativo)

      return (
        matchesSearch &&
        matchesIdioma &&
        matchesTipo &&
        matchesStatus
      )
    })
  }, [
    planos,
    search,
    filterIdioma,
    filterTipo,
    filterStatus,
  ])

  const activeCount = planos.filter((plano) => plano.ativo).length
  const inactiveCount = planos.filter((plano) => !plano.ativo).length

  function openCreateModal() {
    setEditingPlano(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  function openEditModal(plano: Plano) {
    setEditingPlano(plano)

    setForm({
      idioma: plano.idioma,
      tipo: plano.tipo,
      nome: plano.nome,
      descricao: plano.descricao ?? '',
      preco: String(plano.preco ?? ''),
      parcelas:
        plano.parcelas !== null
          ? String(plano.parcelas)
          : '',
      valor_parcela:
        plano.valor_parcela !== null
          ? String(plano.valor_parcela)
          : '',
      ativo: plano.ativo,
    })

    setError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (saving) {
      return
    }

    setModalOpen(false)
    setEditingPlano(null)
    setForm(emptyForm)
    setError('')
  }

  function updateForm<K extends keyof PlanoForm>(
    field: K,
    value: PlanoForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handlePrecoChange(value: string) {
    updateForm('preco', value)

    const preco = parseMoney(value)

    if (
      Number.isFinite(preco) &&
      preco >= 0 &&
      form.parcelas
    ) {
      const parcelas = Number(form.parcelas)

      if (parcelas > 0) {
        updateForm(
          'valor_parcela',
          (preco / parcelas).toFixed(2),
        )
      }
    }
  }

  function handleParcelasChange(value: string) {
    updateForm('parcelas', value)

    const parcelas = Number(value)
    const preco = parseMoney(form.preco)

    if (
      Number.isFinite(preco) &&
      preco >= 0 &&
      parcelas > 0
    ) {
      updateForm(
        'valor_parcela',
        (preco / parcelas).toFixed(2),
      )
    }
  }

  function validateForm() {
    const nome = form.nome.trim()
    const preco = parseMoney(form.preco)

    if (!nome) {
      return 'Informe o nome do plano.'
    }

    if (!Number.isFinite(preco)) {
      return 'Informe um preço válido.'
    }

    if (preco < 0) {
      return 'O preço não pode ser negativo.'
    }

    if (form.parcelas.trim()) {
      const parcelas = Number(form.parcelas)

      if (!Number.isInteger(parcelas) || parcelas <= 0) {
        return 'O número de parcelas deve ser um número inteiro maior que zero.'
      }
    }

    return ''
  }

  async function handleSave() {
    const validationError = validateForm()

    if (validationError) {
      setError(validationError)
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const preco = parseMoney(form.preco)

      const parcelas = form.parcelas.trim()
        ? Number(form.parcelas)
        : null

      let valorParcela: number | null = null

      if (parcelas && parcelas > 0) {
        valorParcela = Number(
          (preco / parcelas).toFixed(2),
        )
      } else if (form.valor_parcela.trim()) {
        const parsed = parseMoney(form.valor_parcela)

        if (Number.isFinite(parsed)) {
          valorParcela = parsed
        }
      }

      if (form.tipo === 'avulso') {
        parcelas = null
        valorParcela = null
      }

      const { data: planoExistente, error: duplicateError } = await supabase
        .from('planos')
        .select('id')
        .eq('idioma', form.idioma)
        .eq('tipo', form.tipo)
        .neq('id', editingPlano?.id ?? '')
        .maybeSingle()

      if (duplicateError) {
        throw duplicateError
      }

      if (planoExistente) {
        setError('Já existe um plano para este idioma e tipo. Edite o plano existente.')
        return
      }

      const payload = {
        idioma: form.idioma,
        tipo: form.tipo,
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        preco,
        parcelas,
        valor_parcela: valorParcela,
        ativo: form.ativo,
        updated_at: new Date().toISOString(),
      }

      if (editingPlano) {
        const { error: updateError } = await supabase
          .from('planos')
          .update(payload)
          .eq('id', editingPlano.id)

        if (updateError) {
          throw updateError
        }

        setSuccess('Plano atualizado com sucesso.')
      } else {
        const { error: insertError } = await supabase
          .from('planos')
          .insert(payload)

        if (insertError) {
          throw insertError
        }

        setSuccess('Plano criado com sucesso.')
      }

      await loadPlanos()

      setModalOpen(false)
      setEditingPlano(null)
      setForm(emptyForm)
    } catch (err: any) {
      console.error('Erro ao salvar plano:', err)

      if (err?.code === '23505') {
        setError(
          'Já existe um plano para este idioma e tipo.',
        )
      } else {
        setError(
          err?.message ||
            'Não foi possível salvar o plano.',
        )
      }
    } finally {
      setSaving(false)
    }
  }

  function handleTipoChange(value: TipoPlano) {
    setForm((current) => ({
      ...current,
      tipo: value,
      ...(value === 'avulso'
        ? { parcelas: '', valor_parcela: '' }
        : {}),
    }))
  }

  async function toggleStatus(plano: Plano) {
    try {
      setError('')
      setSuccess('')

      const { error: updateError } = await supabase
        .from('planos')
        .update({
          ativo: !plano.ativo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', plano.id)

      if (updateError) {
        throw updateError
      }

      setPlanos((current) =>
        current.map((item) =>
          item.id === plano.id
            ? {
                ...item,
                ativo: !item.ativo,
              }
            : item,
        ),
      )

      setSuccess(
        !plano.ativo
          ? 'Plano ativado com sucesso.'
          : 'Plano desativado com sucesso.',
      )
    } catch (err) {
      console.error('Erro ao alterar status:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível alterar o status do plano.',
      )
    }
  }

  return (
    <div className="planos-page">
      <header className="planos-header">
        <div>
          <h1>Planos</h1>
          <p>
            Gerencie os planos oferecidos pela AB Academy.
          </p>
        </div>

        <button
          type="button"
          className="planos-primary-button"
          onClick={openCreateModal}
        >
          <Plus size={17} />
          Novo plano
        </button>
      </header>

      {error && !modalOpen && (
        <div className="planos-alert planos-alert-error">
          <AlertCircle size={17} />
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError('')}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="planos-alert planos-alert-success">
          <CheckCircle2 size={17} />
          <span>{success}</span>

          <button
            type="button"
            onClick={() => setSuccess('')}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="planos-stats">
        <div className="planos-stat-card">
          <span>Total de planos</span>
          <strong>{planos.length}</strong>
        </div>

        <div className="planos-stat-card">
          <span>Planos ativos</span>
          <strong>{activeCount}</strong>
        </div>

        <div className="planos-stat-card">
          <span>Planos inativos</span>
          <strong>{inactiveCount}</strong>
        </div>
      </section>

      <section className="planos-toolbar">
        <div className="planos-search">
          <Search size={17} />

          <input
            type="text"
            placeholder="Buscar plano..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <div className="planos-filter">
          <select
            value={filterIdioma}
            onChange={(event) =>
              setFilterIdioma(
                event.target.value as
                  | 'todos'
                  | Idioma,
              )
            }
          >
            <option value="todos">
              Todos os idiomas
            </option>
            <option value="ingles">Inglês</option>
            <option value="alemao">Alemão</option>
          </select>

          <ChevronDown size={15} />
        </div>

        <div className="planos-filter">
          <select
            value={filterTipo}
            onChange={(event) =>
              setFilterTipo(
                event.target.value as
                  | 'todos'
                  | TipoPlano,
              )
            }
          >
            <option value="todos">
              Todos os tipos
            </option>
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
            <option value="personalizado">Personalizado</option>
            <option value="intensivo">Intensivo</option>
            <option value="avulso">Avulso / Aula diagnóstica</option>
          </select>

          <ChevronDown size={15} />
        </div>

        <div className="planos-filter">
          <select
            value={filterStatus}
            onChange={(event) =>
              setFilterStatus(
                event.target.value as
                  | 'todos'
                  | 'ativo'
                  | 'inativo',
              )
            }
          >
            <option value="todos">
              Todos os status
            </option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </select>

          <ChevronDown size={15} />
        </div>
      </section>

      <section className="planos-table-card">
        {loading ? (
          <div className="planos-loading">
            <div className="planos-spinner" />
            <span>Carregando planos...</span>
          </div>
        ) : filteredPlanos.length === 0 ? (
          <div className="planos-empty">
            <div className="planos-empty-icon">
              <Search size={22} />
            </div>

            <h3>Nenhum plano encontrado</h3>

            <p>
              Não encontramos planos com os filtros
              selecionados.
            </p>

            <button
              type="button"
              className="planos-secondary-button"
              onClick={() => {
                setSearch('')
                setFilterIdioma('todos')
                setFilterTipo('todos')
                setFilterStatus('todos')
              }}
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <div className="planos-table-wrapper">
            <table className="planos-table">
              <thead>
                <tr>
                  <th>Plano</th>
                  <th>Idioma</th>
                  <th>Tipo</th>
                  <th>Preço</th>
                  <th>Parcelamento</th>
                  <th>Status</th>
                  <th className="planos-actions-column">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredPlanos.map((plano) => (
                  <tr key={plano.id}>
                    <td>
                      <div className="planos-name-cell">
                        <strong>{plano.nome}</strong>

                        {plano.descricao && (
                          <span>
                            {plano.descricao}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className="planos-language">
                        {plano.idioma === 'ingles'
                            }

                        {formatIdioma(plano.idioma)}
                      </span>
                    </td>

                    <td>
                      <span className="planos-type">
                        {formatTipo(plano.tipo)}
                      </span>
                    </td>

                    <td>
                      <strong className="planos-price">
                        {formatCurrency(
                          plano.preco,
                        )}
                      </strong>
                    </td>

                    <td>
                      {plano.parcelas ? (
                        <div className="planos-installments">
                          <strong>
                            {plano.parcelas}x
                          </strong>

                          <span>
                            {formatCurrency(
                              plano.valor_parcela,
                            )}
                          </span>
                        </div>
                      ) : (
                        <span className="planos-no-value">
                          —
                        </span>
                      )}
                    </td>

                    <td>
                      <button
                        type="button"
                        className={`planos-status ${
                          plano.ativo
                            ? 'active'
                            : 'inactive'
                        }`}
                        onClick={() =>
                          toggleStatus(plano)
                        }
                        title={
                          plano.ativo
                            ? 'Desativar plano'
                            : 'Ativar plano'
                        }
                      >
                        <span />
                        {plano.ativo
                          ? 'Ativo'
                          : 'Inativo'}
                      </button>
                    </td>

                    <td>
                      <div className="planos-row-actions">
                        <button
                          type="button"
                          className="planos-icon-button"
                          onClick={() =>
                            openEditModal(plano)
                          }
                          title="Editar plano"
                        >
                          <Edit3 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalOpen && (
        <div
          className="planos-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeModal()
            }
          }}
        >
          <div className="planos-modal">
            <header className="planos-modal-header">
              <div>
                <h2>
                  {editingPlano
                    ? 'Editar plano'
                    : 'Novo plano'}
                </h2>

                <p>
                  {editingPlano
                    ? 'Atualize as informações do plano.'
                    : 'Cadastre um novo plano para a academia.'}
                </p>
              </div>

              <button
                type="button"
                className="planos-modal-close"
                onClick={closeModal}
                disabled={saving}
              >
                <X size={19} />
              </button>
            </header>

            <div className="planos-modal-body">
              {error && (
                <div className="planos-alert planos-alert-error">
                  <AlertCircle size={17} />
                  <span>{error}</span>
                </div>
              )}

              <div className="planos-form-grid">
                <div className="planos-field">
                  <label htmlFor="plano-idioma">
                    Idioma
                  </label>

                  <select
                    id="plano-idioma"
                    value={form.idioma}
                    onChange={(event) =>
                      updateForm(
                        'idioma',
                        event.target.value as Idioma,
                      )
                    }
                    disabled={saving}
                  >
                    <option value="ingles">
                      Inglês
                    </option>
                    <option value="alemao">
                      Alemão
                    </option>
                  </select>
                </div>

                <div className="planos-field">
                  <label htmlFor="plano-tipo">
                    Tipo
                  </label>

                  <select
                    id="plano-tipo"
                    value={form.tipo}
                    onChange={(event) =>
                      handleTipoChange(
                        event.target.value as TipoPlano,
                      )
                    }
                    disabled={saving}
                  >
                    <option value="mensal">
                      Mensal
                    </option>
                    <option value="anual">
                      Anual
                    </option>
                    <option value="personalizado">
                      Personalizado
                    </option>
                    <option value="intensivo">
                      Intensivo
                    </option>
                    <option value="avulso">
                      Avulso / Aula diagnóstica
                    </option>
                  </select>
                </div>

                <div className="planos-field planos-field-full">
                  <label htmlFor="plano-nome">
                    Nome do plano
                  </label>

                  <input
                    id="plano-nome"
                    type="text"
                    value={form.nome}
                    onChange={(event) =>
                      updateForm(
                        'nome',
                        event.target.value,
                      )
                    }
                    placeholder="Ex.: Inglês Premium"
                    disabled={saving}
                  />
                </div>

                <div className="planos-field planos-field-full">
                  <label htmlFor="plano-descricao">
                    Descrição
                  </label>

                  <textarea
                    id="plano-descricao"
                    value={form.descricao}
                    onChange={(event) =>
                      updateForm(
                        'descricao',
                        event.target.value,
                      )
                    }
                    placeholder="Descreva os principais benefícios do plano..."
                    rows={4}
                    disabled={saving}
                  />
                </div>

                <div className="planos-field">
                  <label htmlFor="plano-preco">
                    Preço total
                  </label>

                  <input
                    id="plano-preco"
                    type="text"
                    inputMode="decimal"
                    value={form.preco}
                    onChange={(event) =>
                      handlePrecoChange(
                        event.target.value,
                      )
                    }
                    placeholder="0,00"
                    disabled={saving}
                  />
                </div>

                <div className="planos-field">
                  <label htmlFor="plano-parcelas">
                    Parcelas
                  </label>

                  <input
                    id="plano-parcelas"
                    type="number"
                    min="1"
                    step="1"
                    value={form.parcelas}
                    onChange={(event) =>
                      handleParcelasChange(
                        event.target.value,
                      )
                    }
                    placeholder="Ex.: 12"
                    disabled={saving}
                  />
                </div>

                <div className="planos-field">
                  <label htmlFor="plano-valor-parcela">
                    Valor da parcela
                  </label>

                  <input
                    id="plano-valor-parcela"
                    type="text"
                    inputMode="decimal"
                    value={form.valor_parcela}
                    onChange={(event) =>
                      updateForm(
                        'valor_parcela',
                        event.target.value,
                      )
                    }
                    placeholder="0,00"
                    disabled={saving}
                  />

                  <small>
                    Calculado automaticamente quando as
                    parcelas forem informadas.
                  </small>
                </div>

                <div className="planos-field planos-field-status">
                  <label>Status</label>

                  <label className="planos-switch">
                    <input
                      type="checkbox"
                      checked={form.ativo}
                      onChange={(event) =>
                        updateForm(
                          'ativo',
                          event.target.checked,
                        )
                      }
                      disabled={saving}
                    />

                    <span className="planos-switch-track">
                      <span className="planos-switch-thumb" />
                    </span>

                    <span className="planos-switch-label">
                      {form.ativo
                        ? 'Plano ativo'
                        : 'Plano inativo'}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <footer className="planos-modal-footer">
              <button
                type="button"
                className="planos-secondary-button"
                onClick={closeModal}
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="planos-primary-button"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="planos-button-spinner" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check size={17} />
                    {editingPlano
                      ? 'Salvar alterações'
                      : 'Criar plano'}
                  </>
                )}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}