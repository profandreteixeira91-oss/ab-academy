import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link2,
  Quote,
  Highlighter,
  Image as ImageIcon,
  Plus,
  Save,
  Send,
  Table2,
  Trash2,
  Video,
  FileText,
  Users,
  X,
  Minus,
  Columns3,
  CheckSquare,
  Square,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import MaterialViewer, { type MaterialRecord } from '../../components/MaterialViewer'

type Props = { professorId: string }
type Student = { id: string; nome_completo: string }
type EditorState = {
  id: string | null
  titulo: string
  idioma: 'ingles' | 'alemao' | ''
  conteudo_html: string
  imagens: string[]
  videos: string[]
  status: 'rascunho' | 'publicado'
}

const empty: EditorState = {
  id: null,
  titulo: '',
  idioma: '',
  conteudo_html: '<p><br /></p>',
  imagens: [],
  videos: [],
  status: 'rascunho',
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export default function Materiais({ professorId }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const savedRangeRef = useRef<Range | null>(null)

  const [materials, setMaterials] = useState<MaterialRecord[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [editor, setEditor] = useState<EditorState>(empty)
  const [open, setOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [viewer, setViewer] = useState<MaterialRecord | null>(null)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [exitDialog, setExitDialog] = useState(false)
  const [activeTable, setActiveTable] = useState<HTMLTableElement | null>(null)

  const filtered = useMemo(
    () => students.filter((student) =>
      student.nome_completo.toLowerCase().includes(search.trim().toLowerCase()),
    ),
    [students, search],
  )

  async function load() {
    setLoading(true)
    try {
      const [materialsResult, studentsResult] = await Promise.all([
        supabase
          .from('materiais')
          .select('id,titulo,idioma,conteudo_html,imagens,videos,status,created_at,updated_at,publicado_em')
          .eq('professor_id', professorId)
          .order('updated_at', { ascending: false }),
        supabase
          .from('alunos')
          .select('id,nome_completo')
          .eq('professor_id', professorId)
          .order('nome_completo'),
      ])

      if (materialsResult.error) throw materialsResult.error
      if (studentsResult.error) throw studentsResult.error

      setMaterials((materialsResult.data || []) as MaterialRecord[])
      setStudents(studentsResult.data || [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os materiais.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [professorId])

  useEffect(() => {
    if (!open || !editor.id || !dirty) return
    const timer = window.setInterval(() => {
      void save('rascunho', true)
    }, 30000)
    return () => window.clearInterval(timer)
  }, [open, editor.id, dirty])

  function saveSelection() {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return
    const range = selection.getRangeAt(0)
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange()
    }
  }

  function restoreSelection() {
    const selection = window.getSelection()
    if (!selection || !savedRangeRef.current) return
    selection.removeAllRanges()
    selection.addRange(savedRangeRef.current)
  }

  function sync() {
    const html = editorRef.current?.innerHTML || editor.conteudo_html
    setEditor((value) => ({ ...value, conteudo_html: html }))
    setDirty(true)
    saveSelection()
  }

  function exec(command: string, value?: string) {
    editorRef.current?.focus()
    restoreSelection()
    document.execCommand(command, false, value)
    sync()
  }

  function insertLink() {
    const url = window.prompt('Cole o endereço do link:')
    if (!url) return
    const normalized = /^https?:\\/\\//i.test(url) ? url : 'https://' + url
    exec('createLink', normalized)
  }

  function insertHorizontalRule() {
    exec('insertHorizontalRule')
  }

  function findTableFromSelection() {
    const selection = window.getSelection()
    const node = selection?.anchorNode
    const element = node instanceof Element ? node : node?.parentElement
    const table = element?.closest('table')
    return table instanceof HTMLTableElement ? table : null
  }

  function updateActiveTable() {
    setActiveTable(findTableFromSelection())
  }

  function insertTable() {
    exec(
      'insertHTML',
      '<table><thead><tr><th>Coluna 1</th><th>Coluna 2</th></tr></thead><tbody><tr><td></td><td></td></tr></tbody></table><p><br /></p>',
    )
    window.setTimeout(updateActiveTable, 0)
  }

  function addTableRow() {
    const table = activeTable || findTableFromSelection()
    if (!table) {
      setError('Clique dentro de uma tabela antes de adicionar uma linha.')
      return
    }
    const body = table.tBodies[0] || table.createTBody()
    const reference = table.rows[table.rows.length - 1]
    const cells = reference?.cells.length || 1
    const row = body.insertRow()
    for (let index = 0; index < cells; index += 1) row.insertCell().innerHTML = ''
    sync()
    setActiveTable(table)
  }

  function addTableColumn() {
    const table = activeTable || findTableFromSelection()
    if (!table) {
      setError('Clique dentro de uma tabela antes de adicionar uma coluna.')
      return
    }
    const rows = Array.from(table.rows)
    rows.forEach((row, index) => {
      const cell = row.insertCell()
      cell.innerHTML = index === 0 ? `Coluna ${row.cells.length}` : ''
      if (index === 0) cell.outerHTML = `<th>${escapeHtml(cell.textContent || '')}</th>`
    })
    sync()
    setActiveTable(table)
  }

  function removeTableRow() {
    const table = activeTable || findTableFromSelection()
    if (!table || table.rows.length <= 2) {
      setError('A tabela precisa manter pelo menos uma linha de cabeçalho e uma linha de conteúdo.')
      return
    }
    const selection = window.getSelection()
    const node = selection?.anchorNode
    const element = node instanceof Element ? node : node?.parentElement
    const row = element?.closest('tr')
    if (row && row.parentElement) row.remove()
    else table.rows[table.rows.length - 1]?.remove()
    sync()
    setActiveTable(table)
  }

  function removeTableColumn() {
    const table = activeTable || findTableFromSelection()
    if (!table || table.rows[0]?.cells.length <= 1) {
      setError('A tabela precisa manter pelo menos uma coluna.')
      return
    }
    const selection = window.getSelection()
    const node = selection?.anchorNode
    const element = node instanceof Element ? node : node?.parentElement
    const cell = element?.closest('th,td')
    const columnIndex = cell?.cellIndex ?? table.rows[0].cells.length - 1
    Array.from(table.rows).forEach((row) => row.cells[columnIndex]?.remove())
    sync()
    setActiveTable(table)
  }

  function serializeEditorHtml() {
    if (!editorRef.current) return editor.conteudo_html
    const clone = editorRef.current.cloneNode(true) as HTMLDivElement
    clone.querySelectorAll('img[data-material-image]').forEach((image) => {
      const path = image.getAttribute('data-material-image')
      if (path) image.setAttribute('src', `{{MATERIAL_IMAGE:${path}}}`)
    })
    return clone.innerHTML
  }

  async function save(status: 'rascunho' | 'publicado', silent = false): Promise<string | false> {
    if (!editor.titulo.trim()) {
      if (!silent) setError('Informe um título para o material.')
      return false
    }

    if (status === 'publicado' && !selected.length) {
      setError('Selecione pelo menos um aluno para publicar.')
      return false
    }

    setSaving(true)
    setError('')

    try {
      const html = serializeEditorHtml()
      const payload = {
        professor_id: professorId,
        titulo: editor.titulo.trim(),
        idioma: editor.idioma || null,
        conteudo_html: html,
        imagens: editor.imagens,
        videos: editor.videos,
        status,
        publicado_em: status === 'publicado' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }

      let id = editor.id
      if (id) {
        const { error: updateError } = await supabase.from('materiais').update(payload).eq('id', id)
        if (updateError) throw updateError
      } else {
        const { data, error: insertError } = await supabase
          .from('materiais')
          .insert(payload)
          .select('id')
          .single()
        if (insertError) throw insertError
        id = data.id
      }

      const { error: recipientsDeleteError } = await supabase
        .from('material_alunos')
        .delete()
        .eq('material_id', id)
      if (recipientsDeleteError) throw recipientsDeleteError

      if (selected.length) {
        const { error: recipientsInsertError } = await supabase
          .from('material_alunos')
          .insert(selected.map((aluno_id) => ({ material_id: id, aluno_id })))
        if (recipientsInsertError) throw recipientsInsertError
      }

      setEditor((value) => ({ ...value, id, status }))
      setDirty(false)
      await load()

      if (!silent) {
        setMessage(status === 'publicado' ? 'Material publicado para os alunos selecionados.' : 'Rascunho salvo com sucesso.')
      }

      return id
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o material.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function ensureDraft(): Promise<string | false> {
    if (editor.id) return editor.id
    return save('rascunho', true)
  }

  async function upload(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Selecione uma imagem válida.')
      return
    }

    setError('')
    const materialId = await ensureDraft()
    if (!materialId) return

    const name = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
    const path = `${professorId}/${materialId}/${crypto.randomUUID()}-${name}`

    const { error: uploadError } = await supabase.storage.from('materiais').upload(path, file, {
      contentType: file.type,
      upsert: false,
    })

    if (uploadError) {
      setError(uploadError.message)
      return
    }

    const { data: signed } = await supabase.storage.from('materiais').createSignedUrl(path, 3600)
    const signedUrl = signed?.signedUrl

    setEditor((value) => ({
      ...value,
      id: materialId,
      imagens: [...value.imagens, path],
    }))

    window.setTimeout(() => {
      if (!editorRef.current) return
      editorRef.current.focus()
      restoreSelection()
      const image = document.createElement('img')
      image.src = signedUrl || path
      image.alt = file.name
      image.setAttribute('data-material-image', path)
      image.style.maxWidth = '100%'
      const paragraph = document.createElement('p')
      paragraph.appendChild(image)
      document.execCommand('insertHTML', false, paragraph.outerHTML)
      sync()
    }, 0)
  }

  function video() {
    const url = window.prompt('Cole o link do vídeo (YouTube, Vimeo ou outro endereço HTTPS):')
    if (!url) return
    if (!/^https:\/\//i.test(url)) {
      setError('Informe um link HTTPS válido.')
      return
    }

    exec(
      'insertHTML',
      `<p><a href="${url.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">▶ Assistir vídeo</a></p>`,
    )
    setEditor((value) => ({ ...value, videos: Array.from(new Set([...value.videos, url])) }))
  }

  function newMaterial() {
    setEditor({ ...empty })
    setSelected([])
    setSearch('')
    setDirty(false)
    setError('')
    setMessage('')
    setActiveTable(null)
    setOpen(true)
    window.setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = empty.conteudo_html
    }, 0)
  }

  async function edit(material: MaterialRecord) {
    const { data, error: recipientsError } = await supabase
      .from('material_alunos')
      .select('aluno_id')
      .eq('material_id', material.id)

    if (recipientsError) {
      setError(recipientsError.message)
      return
    }

    const entries = await Promise.all(
      (material.imagens || []).map(async (path) => {
        const { data: signed } = await supabase.storage.from('materiais').createSignedUrl(path, 3600)
        return [path, signed?.signedUrl || ''] as const
      }),
    )
    const urls = Object.fromEntries(entries.filter(([, url]) => url))
    let html = material.conteudo_html || empty.conteudo_html
    Object.entries(urls).forEach(([path, url]) => {
      html = html.split(`{{MATERIAL_IMAGE:${path}}}`).join(url)
      html = html.split(`src="${path}"`).join(`src="${url}"`)
    })

    setSelected((data || []).map((row) => row.aluno_id))
    setEditor({
      id: material.id,
      titulo: material.titulo,
      idioma: material.idioma || '',
      conteudo_html: html,
      imagens: material.imagens || [],
      videos: material.videos || [],
      status: material.status,
    })
    setOpen(true)
    setDirty(false)
    setActiveTable(null)
    window.setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = html
    }, 0)
  }

  function close() {
    if (dirty) {
      setExitDialog(true)
      return
    }
    setOpen(false)
  }

  async function exit(saveDraft: boolean) {
    if (saveDraft && !(await save('rascunho'))) return
    setExitDialog(false)
    setOpen(false)
    setDirty(false)
  }

  async function view(material: MaterialRecord) {
    const entries = await Promise.all(
      (material.imagens || []).map(async (path) => {
        const { data } = await supabase.storage.from('materiais').createSignedUrl(path, 3600)
        return [path, data?.signedUrl || ''] as const
      }),
    )
    setImageUrls(Object.fromEntries(entries.filter(([, url]) => url)))
    setViewer(material)
  }

  async function remove(material: MaterialRecord) {
    if (!window.confirm(`Excluir "${material.titulo}"? As imagens anexadas também serão removidas.`)) return

    const { error: deleteError } = await supabase.from('materiais').delete().eq('id', material.id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }

    const { data: objects } = await supabase.storage.from('materiais').list(`${professorId}/${material.id}`, { limit: 1000 })
    if (objects?.length) {
      await supabase.storage.from('materiais').remove(objects.map((object) => `${professorId}/${material.id}/${object.name}`))
    }

    await load()
  }

  function toggleAllVisible() {
    const visibleIds = filtered.map((student) => student.id)
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id))
    setSelected((current) =>
      allSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    )
    setDirty(true)
  }

  if (loading) return <div className="professor-materials-empty">Carregando materiais...</div>

  if (open) {
    return (
      <div className="professor-material-editor-page">
        <div className="professor-material-editor-header">
          <div>
            <span className="professor-eyebrow">Material pedagógico</span>
            <h1>{editor.id ? 'Editar material' : 'Novo material'}</h1>
            <p>Crie materiais ricos, organize tabelas e direcione o conteúdo para seus alunos.</p>
          </div>
          <button type="button" className="professor-secondary-button" onClick={close}>
            <X size={17} /> Sair
          </button>
        </div>

        <div className="professor-material-editor-grid">
          <main className="professor-material-editor-main">
            <div className="professor-material-editor-meta">
              <input
                className="professor-material-title-input"
                value={editor.titulo}
                onChange={(event) => {
                  setEditor((value) => ({ ...value, titulo: event.target.value }))
                  setDirty(true)
                }}
                placeholder="Título do material"
              />
              <select
                value={editor.idioma}
                onChange={(event) => {
                  setEditor((value) => ({ ...value, idioma: event.target.value as EditorState['idioma'] }))
                  setDirty(true)
                }}
              >
                <option value="">Idioma do material</option>
                <option value="ingles">Inglês</option>
                <option value="alemao">Alemão</option>
              </select>
            </div>

            <div className="professor-material-toolbar" onMouseDown={(event) => event.preventDefault()}>
              <div className="professor-material-toolbar-group">
                <button type="button" onClick={() => exec('undo')} title="Desfazer"><Undo2 size={17} /></button>
                <button type="button" onClick={() => exec('redo')} title="Refazer"><Redo2 size={17} /></button>
              </div>
              <span className="professor-material-toolbar-divider" />
              <select className="professor-material-format-select" defaultValue="p" onChange={(event) => exec('formatBlock', event.target.value)} title="Estilo do texto">
                <option value="p">Texto normal</option><option value="h1">Título 1</option><option value="h2">Título 2</option><option value="h3">Título 3</option><option value="blockquote">Citação</option>
              </select>
              <select className="professor-material-font-select" defaultValue="3" onChange={(event) => exec('fontSize', event.target.value)} title="Tamanho da fonte">
                <option value="2">10</option><option value="3">12</option><option value="4">14</option><option value="5">18</option><option value="6">24</option><option value="7">32</option>
              </select>
              <span className="professor-material-toolbar-divider" />
              <button type="button" onClick={() => exec('bold')} title="Negrito"><Bold size={17} /></button>
              <button type="button" onClick={() => exec('italic')} title="Itálico"><Italic size={17} /></button>
              <button type="button" onClick={() => exec('underline')} title="Sublinhado"><span className="toolbar-text-button">U</span></button>
              <button type="button" onClick={() => exec('strikeThrough')} title="Tachado"><span className="toolbar-text-button strike">S</span></button>
              <button type="button" onClick={() => exec('hiliteColor', '#fff2cc')} title="Destacar texto"><Highlighter size={17} /></button>
              <span className="professor-material-toolbar-divider" />
              <button type="button" onClick={() => exec('justifyLeft')} title="Alinhar à esquerda"><AlignLeft size={17} /></button>
              <button type="button" onClick={() => exec('justifyCenter')} title="Centralizar"><AlignCenter size={17} /></button>
              <button type="button" onClick={() => exec('justifyRight')} title="Alinhar à direita"><AlignRight size={17} /></button>
              <button type="button" onClick={() => exec('justifyFull')} title="Justificar"><AlignJustify size={17} /></button>
              <span className="professor-material-toolbar-divider" />
              <button type="button" onClick={() => exec('insertUnorderedList')} title="Lista"><List size={17} /></button>
              <button type="button" onClick={() => exec('insertOrderedList')} title="Lista numerada"><ListOrdered size={17} /></button>
              <button type="button" onClick={() => exec('formatBlock', 'blockquote')} title="Citação"><Quote size={17} /></button>
              <span className="professor-material-toolbar-divider" />
              <button type="button" onClick={insertLink} title="Inserir link"><Link2 size={17} /></button>
              <button type="button" onClick={insertHorizontalRule} title="Linha horizontal"><Minus size={17} /></button>
              <button type="button" onClick={insertTable} title="Inserir tabela"><Table2 size={17} /></button>
              {activeTable && (
                <>
                  <button type="button" onClick={addTableRow} title="Adicionar linha"><Plus size={17} /><span className="toolbar-label">Linha</span></button>
                  <button type="button" onClick={addTableColumn} title="Adicionar coluna"><Columns3 size={17} /><span className="toolbar-label">Coluna</span></button>
                  <button type="button" onClick={removeTableRow} title="Excluir linha"><Minus size={17} /><span className="toolbar-label">Linha</span></button>
                  <button type="button" onClick={removeTableColumn} title="Excluir coluna"><Minus size={17} /><span className="toolbar-label">Coluna</span></button>
                </>
              )}
              <span className="professor-material-toolbar-divider" />
              <button type="button" onClick={() => fileRef.current?.click()} title="Inserir imagem"><ImageIcon size={17} /></button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = '' }} />
              <button type="button" onClick={video} title="Inserir vídeo"><Video size={17} /></button>
            </div>

            <div
              ref={editorRef}
              className="professor-material-rich-editor"
              contentEditable
              suppressContentEditableWarning
              onInput={sync}
              onKeyUp={() => {
                saveSelection()
                updateActiveTable()
              }}
              onMouseUp={() => {
                saveSelection()
                updateActiveTable()
              }}
              onFocus={updateActiveTable}
            />

            <div className="professor-material-editor-footer">
              <span className="professor-material-draft-status">
                {dirty ? 'Alterações não salvas' : 'Todas as alterações estão salvas'}
              </span>
              <button type="button" className="professor-secondary-button" disabled={saving} onClick={() => void save('rascunho')}>
                <Save size={17} /> {saving ? 'Salvando...' : 'Salvar rascunho'}
              </button>
              <button type="button" className="professor-primary-button" disabled={saving} onClick={() => void save('publicado')}>
                <Send size={17} /> Publicar material
              </button>
            </div>
          </main>

          <aside className="professor-material-editor-side">
            <div className="professor-material-side-card">
              <div className="professor-panel-header">
                <div>
                  <span className="professor-eyebrow">Direcionamento</span>
                  <h2>Alunos</h2>
                </div>
                <Users size={19} />
              </div>

              <div className="professor-material-recipient-summary">
                <strong>{selected.length}</strong>
                <span>selecionado(s)</span>
              </div>

              <input
                className="professor-material-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar aluno por nome..."
              />

              <div className="professor-material-recipient-actions">
                <button type="button" onClick={toggleAllVisible} disabled={!filtered.length}>
                  <CheckSquare size={15} /> Selecionar visíveis
                </button>
                <button type="button" onClick={() => { setSelected([]); setDirty(true) }} disabled={!selected.length}>
                  <Square size={15} /> Limpar
                </button>
              </div>

              <div className="professor-material-student-list">
                {filtered.length ? filtered.map((student) => {
                  const checked = selected.includes(student.id)
                  return (
                    <label key={student.id} className={`professor-material-student-option${checked ? ' selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setSelected((value) => event.target.checked
                            ? Array.from(new Set([...value, student.id]))
                            : value.filter((id) => id !== student.id))
                          setDirty(true)
                        }}
                      />
                      <span>{student.nome_completo}</span>
                    </label>
                  )
                }) : (
                  <div className="professor-material-students-empty">Nenhum aluno encontrado.</div>
                )}
              </div>

              <small>Os destinatários ficam salvos também no rascunho e podem ser alterados antes da publicação.</small>
            </div>
          </aside>
        </div>

        {error && <div className="professor-material-error professor-material-editor-alert">{error}</div>}

        {exitDialog && (
          <div className="professor-material-dialog-backdrop">
            <div className="professor-material-dialog">
              <Save size={28} />
              <h3>Salvar rascunho antes de sair?</h3>
              <p>Suas alterações ainda não foram salvas.</p>
              <div>
                <button type="button" className="professor-secondary-button" onClick={() => void exit(false)}>Sair sem salvar</button>
                <button type="button" className="professor-primary-button" onClick={() => void exit(true)}>Salvar rascunho e sair</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="professor-materials-page">
      <div className="professor-page-header">
        <div>
          <span className="professor-eyebrow">Ensino</span>
          <h1>Materiais</h1>
          <p>Crie, edite, salve rascunhos e direcione materiais para um ou mais alunos.</p>
        </div>
        <button type="button" className="professor-primary-button" onClick={newMaterial}>
          <Plus size={18} /> Novo material
        </button>
      </div>

      {message && <div className="professor-material-success">{message}</div>}
      {error && <div className="professor-material-error">{error}</div>}

      {materials.length === 0 ? (
        <div className="professor-materials-empty">
          <FileText size={40} />
          <strong>Nenhum material criado</strong>
          <span>Crie seu primeiro material pedagógico.</span>
        </div>
      ) : (
        <div className="professor-material-grid">
          {materials.map((material) => (
            <article key={material.id} className="professor-material-card">
              <div className="professor-material-card-icon"><FileText size={22} /></div>
              <div className="professor-material-card-body">
                <span>{material.status === 'publicado' ? 'Publicado' : 'Rascunho'}{material.idioma ? ` · ${material.idioma === 'ingles' ? 'Inglês' : 'Alemão'}` : ''}</span>
                <h3>{material.titulo}</h3>
                <p>Atualizado em {new Date(material.updated_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <div className="professor-material-card-actions">
                <button type="button" className="professor-secondary-button" onClick={() => void edit(material)}>Editar</button>
                <button type="button" className="professor-secondary-button" onClick={() => void view(material)}>Visualizar</button>
                <button type="button" className="professor-icon-danger" onClick={() => void remove(material)} title="Excluir material"><Trash2 size={17} /></button>
              </div>
            </article>
          ))}
        </div>
      )}

      {viewer && (
        <div className="professor-material-viewer-modal">
          <MaterialViewer material={viewer} imageUrls={imageUrls} onClose={() => setViewer(null)} />
        </div>
      )}
    </div>
  )
}
