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
import { cacheMaterialImage, resolveMaterialImage } from '../../lib/materialImageCache'
import { generateMaterialPdf } from '../../lib/materialPdf'

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
  const [actionDialog, setActionDialog] = useState<'rascunho' | 'publicado' | 'excluir' | null>(null)
  const [pendingMaterial, setPendingMaterial] = useState<MaterialRecord | null>(null)
  const [activeTable, setActiveTable] = useState<HTMLTableElement | null>(null)

  const filtered = useMemo(
    () => students.filter((student) =>
      student.nome_completo.toLowerCase().includes(search.trim().toLowerCase()),
    ),
    [students, search],
  )

  async function load(showLoading = true) {
    if (showLoading) setLoading(true)
    try {
      const [materialsResult, studentsResult] = await Promise.all([
        supabase
          .from('materiais')
          .select('id,titulo,idioma,conteudo_html,imagens,videos,status,created_at,updated_at,publicado_em,pdf_publicado_path,pdf_publicado_em')
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
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [professorId])

  useEffect(() => {
    if (!open || !editor.id || !dirty || editor.status !== 'rascunho') return
    const timer = window.setInterval(() => {
      void save('rascunho', true)
    }, 30000)
    return () => window.clearInterval(timer)
  }, [open, editor.id, editor.status, dirty])

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
    const normalized = /^https?:\/\//i.test(url) ? url : 'https://' + url
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
    const source = editorRef.current?.innerHTML ?? editor.conteudo_html
    const wrapper = document.createElement('div')
    wrapper.innerHTML = source

    wrapper.querySelectorAll('img').forEach((image) => {
      const path = image.getAttribute('data-material-image')?.trim()
      if (path) {
        image.setAttribute('src', `{{MATERIAL_IMAGE:${path}}}`)
      }
    })

    return wrapper.innerHTML
  }

  function getEditorSnapshot() {
    const html = serializeEditorHtml()
    const imagePaths = getEditorImagePaths()
    return {
      html,
      imagePaths,
      // O snapshot é obtido diretamente do editor visível, nunca de um
      // estado React potencialmente defasado.
      isEmpty: !html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() &&
        !/<img\b/i.test(html) &&
        !/<table\b/i.test(html),
    }
  }

  function getEditorImagePaths() {
    if (!editorRef.current) return editor.imagens

    const paths = Array.from(
      editorRef.current.querySelectorAll('img[data-material-image]'),
    )
      .map((image) => image.getAttribute('data-material-image')?.trim())
      .filter((path): path is string => Boolean(path))

    return Array.from(new Set(paths))
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
      const snapshot = getEditorSnapshot()
      const html = snapshot.html
      const imagePaths = snapshot.imagePaths
      if (editor.id && snapshot.isEmpty && editor.conteudo_html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()) {
        throw new Error('O conteúdo do editor não pôde ser capturado com segurança. O documento não foi alterado.')
      }
      let id = editor.id
      if (status === 'publicado' && !silent && !id) {
        const { data, error: insertError } = await supabase.from('materiais').insert({
          professor_id: professorId,
          titulo: editor.titulo.trim(),
          idioma: editor.idioma || null,
          conteudo_html: html,
          imagens: imagePaths,
          videos: editor.videos,
          status: 'rascunho',
          updated_at: new Date().toISOString(),
        }).select('id').single()
        if (insertError) throw insertError
        id = data.id
      }
      let pdfPath: string | null = null
      let publishedAt: string | null = null
      if (status === 'publicado' && !silent) {
        if (!id) throw new Error('Não foi possível identificar o material para gerar a publicação.')
        const pdfBlob = await generateMaterialPdf({
          editor: editorRef.current,
          title: editor.titulo.trim(),
          language: editor.idioma || null,
          imagePaths,
        })
        publishedAt = new Date().toISOString()
        pdfPath = `${professorId}/${id}/publicado-${Date.now()}.pdf`
        const { error: pdfUploadError } = await supabase.storage.from('materiais').upload(pdfPath, pdfBlob, {
          contentType: 'application/pdf',
          cacheControl: '31536000',
          upsert: false,
        })
        if (pdfUploadError) throw new Error(`O PDF não pôde ser armazenado: ${pdfUploadError.message}`)
      }
      const payload: Record<string, unknown> = {
        professor_id: professorId,
        titulo: editor.titulo.trim(),
        idioma: editor.idioma || null,
        conteudo_html: html,
        imagens: imagePaths,
        videos: editor.videos,
        status,
        updated_at: new Date().toISOString(),
      }
      if (status === 'publicado' && !silent) {
        payload.conteudo_publicado_html = html
        payload.imagens_publicadas = imagePaths
        payload.videos_publicados = editor.videos
        payload.titulo_publicado = editor.titulo.trim()
        payload.idioma_publicado = editor.idioma || null
        payload.publicado_em = publishedAt
        payload.pdf_publicado_path = pdfPath
        payload.pdf_publicado_em = publishedAt
      }
      if (id) {
        const { error: updateError } = await supabase.from('materiais').update(payload).eq('id', id)
        if (updateError) throw updateError
      } else {
        const { data, error: insertError } = await supabase.from('materiais').insert(payload).select('id').single()
        if (insertError) throw insertError
        id = data.id
      }
      const { error: recipientsDeleteError } = await supabase.from('material_alunos').delete().eq('material_id', id)
      if (recipientsDeleteError) throw recipientsDeleteError
      if (selected.length) {
        const recipientRows = selected.map((aluno_id) => ({ material_id: id, aluno_id }))
        const { data: insertedRecipients, error: recipientsInsertError } = await supabase.from('material_alunos').insert(recipientRows).select('aluno_id')
        if (recipientsInsertError) throw recipientsInsertError
        const insertedIds = new Set((insertedRecipients || []).map((row) => row.aluno_id))
        const missingRecipients = selected.filter((aluno_id) => !insertedIds.has(aluno_id))
        if (missingRecipients.length) throw new Error('Nem todos os alunos selecionados foram vinculados ao material.')
      }
      setEditor((value) => ({ ...value, id, status, conteudo_html: html, imagens: imagePaths }))
      setDirty(false)
      await load(false)
      if (!silent) setMessage(status === 'publicado' ? 'Material publicado em PDF para os alunos selecionados.' : 'Rascunho salvo com sucesso.')
      return id
    } catch (cause) {
      const details = cause && typeof cause === 'object' ? cause as { message?: string; code?: string; details?: string; hint?: string } : null
      const reason = details?.message || (cause instanceof Error ? cause.message : '')
      const extra = [details?.code, details?.details, details?.hint].filter(Boolean).join(' · ')
      setError(reason ? `Não foi possível salvar o material: ${reason}${extra ? ` — ${extra}` : ''}` : 'Não foi possível salvar o material.')
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
      setError(`Não foi possível enviar a imagem: ${uploadError.message}`)
      return
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from('materiais')
      .createSignedUrl(path, 3600)

    if (signedError || !signed?.signedUrl) {
      await supabase.storage.from('materiais').remove([path])
      setError(`A imagem foi enviada, mas não foi possível gerar o acesso temporário: ${signedError?.message || 'URL assinada indisponível.'}`)
      return
    }

    try {
      await cacheMaterialImage(path, file)
    } catch {
      // O armazenamento persistente no Supabase continua sendo a fonte oficial.
      // O cache local é uma otimização e não deve impedir o salvamento do material.
    }

    const signedUrl = await resolveMaterialImage(path, async () => signed.signedUrl) || signed.signedUrl

    setEditor((value) => ({
      ...value,
      id: materialId,
      imagens: Array.from(new Set([...value.imagens, path])),
    }))

    // A imagem precisa entrar no DOM antes de qualquer salvamento. Assim,
    // tanto o salvamento manual quanto o autosave sempre serializam a referência
    // persistente {{MATERIAL_IMAGE:path}}, mesmo que o estado React ainda esteja
    // sendo atualizado.
    if (!editorRef.current) return

    editorRef.current.focus()
    restoreSelection()
    const image = document.createElement('img')
    image.src = signedUrl
    image.alt = file.name
    image.setAttribute('data-material-image', path)
    image.style.maxWidth = '100%'
    const paragraph = document.createElement('p')
    paragraph.appendChild(image)
    document.execCommand('insertHTML', false, paragraph.outerHTML)
    sync()
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
    // A lista de materiais é apenas uma visão resumida e pode estar defasada
    // quando o professor salva e reabre rapidamente. Sempre buscamos o
    // documento atual antes de montar novamente o editor.
    const [{ data: currentMaterial, error: materialError }, { data: recipients, error: recipientsError }] = await Promise.all([
      supabase
        .from('materiais')
        .select('id,titulo,idioma,conteudo_html,imagens,videos,status,created_at,updated_at,publicado_em')
        .eq('id', material.id)
        .eq('professor_id', professorId)
        .single(),
      supabase
        .from('material_alunos')
        .select('aluno_id')
        .eq('material_id', material.id),
    ])

    if (materialError) {
      setError(materialError.message)
      return
    }

    if (recipientsError) {
      setError(recipientsError.message)
      return
    }

    // O HTML é a fonte primária do documento. O manifesto "imagens" é usado
    // como redundância para documentos criados por versões anteriores do editor.
    const persistedImagePaths = Array.from(new Set([
      ...(currentMaterial.imagens || []),
      ...Array.from(currentMaterial.conteudo_html?.matchAll(/{{MATERIAL_IMAGE:([^}]+)}}/g) || [], (match) => match[1]),
      ...Array.from(currentMaterial.conteudo_html?.matchAll(/data-material-image=[\"']([^\"']+)[\"']/g) || [], (match) => match[1]),
    ].filter((path): path is string => Boolean(path?.trim()))))

    const entries = await Promise.all(
      persistedImagePaths.map(async (path) => {
        const url = await resolveMaterialImage(path, async () => {
          const { data: signed } = await supabase.storage
            .from('materiais')
            .createSignedUrl(path, 3600)
          return signed?.signedUrl || null
        })
        return [path, url || ''] as const
      }),
    )
    const urls = Object.fromEntries(entries.filter(([, url]) => url))
    let html = currentMaterial.conteudo_html || empty.conteudo_html

    // Reidratação feita pelo DOM, não por substituição textual.
    // O placeholder normalmente aparece como src="{{MATERIAL_IMAGE:path}}".
    // Substituir o placeholder por uma string que também contém "src=" cria
    // HTML inválido (src="src=..."), fazendo a imagem desaparecer ao reabrir.
    const wrapper = document.createElement('div')
    wrapper.innerHTML = html
    wrapper.querySelectorAll('img').forEach((image) => {
      const rawSource = image.getAttribute('src')?.trim() || ''
      const path = image.getAttribute('data-material-image')?.trim() ||
        rawSource.match(/^{{MATERIAL_IMAGE:(.+)}}$/)?.[1]?.trim()

      if (!path) return
      const url = urls[path]
      if (!url) return

      image.setAttribute('src', url)
      image.setAttribute('data-material-image', path)
    })
    html = wrapper.innerHTML

    // Se uma imagem foi persistida, mas uma versão antiga do HTML a perdeu,
    // recuperamos a imagem ao final do documento em vez de descartá-la.
    const missingImages = Object.entries(urls).filter(([path]) => {
      return !html.includes(`data-material-image="${escapeHtml(path)}"`) &&
        !html.includes(`data-material-image='${escapeHtml(path)}'`)
    })

    if (missingImages.length) {
      const recoveredImages = missingImages
        .map(([path, url]) =>
          `<p><img src="${escapeHtml(url)}" alt="Imagem do material" data-material-image="${escapeHtml(path)}" style="max-width:100%" /></p>`,
        )
        .join('')
      html = `${html}${recoveredImages}`
    }

    if (persistedImagePaths.length && Object.keys(urls).length !== persistedImagePaths.length) {
      const missingPaths = persistedImagePaths.filter((path) => !urls[path])
      setError(`Não foi possível carregar ${missingPaths.length} imagem(ns) persistida(s). O documento foi mantido intacto; verifique o acesso ao armazenamento.`)
    } else {
      setError('')
    }

    setSelected((recipients || []).map((row) => row.aluno_id))
    setEditor({
      id: currentMaterial.id,
      titulo: currentMaterial.titulo,
      idioma: currentMaterial.idioma || '',
      conteudo_html: html,
      imagens: persistedImagePaths,
      videos: currentMaterial.videos || [],
      status: currentMaterial.status,
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

  function requestSave(status: 'rascunho' | 'publicado') {
    if (saving) return
    setActionDialog(status)
  }

  async function confirmAction() {
    if (!actionDialog) return

    if (actionDialog === 'excluir') {
      const material = pendingMaterial
      setActionDialog(null)
      setPendingMaterial(null)
      if (!material) return

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
      setMessage('Material excluído com sucesso.')
      return
    }

    const status = actionDialog
    setActionDialog(null)
    await save(status)
  }

  async function exit(saveDraft: boolean) {
    if (saveDraft && !(await save('rascunho'))) return
    setExitDialog(false)
    setOpen(false)
    setDirty(false)
  }

  async function view(material: MaterialRecord) {
    setImageUrls({})
    setViewer(material)
  }

  function remove(material: MaterialRecord) {
    setPendingMaterial(material)
    setActionDialog('excluir')
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
              <button type="button" className="professor-secondary-button" disabled={saving} onClick={() => requestSave('rascunho')}>
                <Save size={17} /> {saving ? 'Salvando...' : 'Salvar rascunho'}
              </button>
              <button type="button" className="professor-primary-button" disabled={saving} onClick={() => requestSave('publicado')}>
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

        {actionDialog && (
          <div className="professor-material-dialog-backdrop">
            <div className="professor-material-dialog" role="dialog" aria-modal="true" aria-labelledby="material-action-dialog-title">
              {actionDialog === 'excluir' ? <Trash2 size={28} /> : actionDialog === 'publicado' ? <Send size={28} /> : <Save size={28} />}
              <h3 id="material-action-dialog-title">
                {actionDialog === 'excluir'
                  ? 'Excluir material?'
                  : actionDialog === 'publicado'
                    ? 'Publicar material?'
                    : 'Salvar rascunho?'}
              </h3>
              <p>
                {actionDialog === 'excluir'
                  ? 'O material "' + (pendingMaterial?.titulo || '') + '" será excluído e suas imagens armazenadas serão removidas.'
                  : actionDialog === 'publicado'
                    ? 'O conteúdo atual será salvo e publicado para os alunos selecionados.'
                    : 'Todo o conteúdo digitado, incluindo alterações de texto, tabelas, imagens e destinatários, será salvo como rascunho para continuar depois.'}
              </p>
              <div>
                <button type="button" className="professor-secondary-button" onClick={() => { setActionDialog(null); setPendingMaterial(null) }} disabled={saving}>
                  Cancelar
                </button>
                <button type="button" className={actionDialog === 'excluir' ? 'professor-secondary-button professor-absence-button' : 'professor-primary-button'} onClick={() => void confirmAction()} disabled={saving}>
                  {actionDialog === 'excluir' ? 'Excluir material' : actionDialog === 'publicado' ? 'Publicar' : 'Salvar rascunho'}
                </button>
              </div>
            </div>
          </div>
        )}

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
                <button type="button" className="professor-icon-danger" onClick={() => remove(material)} title="Excluir material"><Trash2 size={17} /></button>
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
