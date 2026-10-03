import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import {
  captureEditorSelection,
  createEditorOperation,
  domToEditorModel,
  editorModelToHtml,
  restoreEditorSelection,
  type EditorModelNode,
  type EditorOperation,
  type EditorSelectionState,
} from '../../lib/materialEditorModel'
import { listLocalMaterialDrafts, loadLocalMaterialDraft, removeLocalMaterialDraft, saveLocalMaterialDraft } from '../../lib/materialEditorDraftStore'

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

const hasMeaningfulContent = (html: string) =>
  Boolean(html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()) || /<(img|table)\b/i.test(html)

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
  const [viewerPdfUrl, setViewerPdfUrl] = useState('')
  const [exitDialog, setExitDialog] = useState(false)
  const [actionDialog, setActionDialog] = useState<'rascunho' | 'publicado' | 'excluir' | null>(null)
  const [pendingMaterial, setPendingMaterial] = useState<MaterialRecord | null>(null)
  const [activeTable, setActiveTable] = useState<HTMLTableElement | null>(null)
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [remoteStatus, setRemoteStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  const editorVersionRef = useRef(0)
  const operationsRef = useRef<EditorOperation[]>([])
  const localDraftKeyRef = useRef<string>('')
  const localAutosaveTimerRef = useRef<number | null>(null)

  // Refs que sempre refletem o estado mais recente (evitam closures velhas no autosave).
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const recipientsDirtyRef = useRef(false)
  const materialIdRef = useRef<string | null>(null)
  const saveRef = useRef<typeof save | null>(null)
  // Conteúdo que deve ser injetado no editor assim que ele for montado no DOM.
  const pendingContentRef = useRef<{ html: string; selection: EditorSelectionState | null } | null>(null)

  const filtered = useMemo(
    () => students.filter((student) =>
      student.nome_completo.toLowerCase().includes(search.trim().toLowerCase()),
    ),
    [students, search],
  )

  async function load(showLoading = true, recoverDraft = false) {
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

      const loadedMaterials = (materialsResult.data || []) as MaterialRecord[]
      setMaterials(loadedMaterials)
      setStudents(studentsResult.data || [])

      // Se o navegador caiu antes do primeiro salvamento remoto, recuperamos
      // automaticamente o rascunho local mais recente criado na sessão anterior.
      // Só ocorre na abertura da tela, nunca durante a edição.
      const localDrafts = recoverDraft ? await listLocalMaterialDrafts() : []
      const orphanDraft = localDrafts.find((draft) =>
        draft.materialId.startsWith('new-') &&
        !loadedMaterials.some((material) => material.id === draft.materialId),
      )
      if (orphanDraft?.model) {
        const recoveredHtml = await rehydrateEditorImages(editorModelToHtml(orphanDraft.model))
        localDraftKeyRef.current = orphanDraft.materialId
        materialIdRef.current = null
        recipientsDirtyRef.current = false
        editorVersionRef.current = orphanDraft.version
        operationsRef.current = orphanDraft.operations || []
        setEditor({
          id: null,
          titulo: orphanDraft.titulo,
          idioma: orphanDraft.idioma,
          conteudo_html: recoveredHtml || empty.conteudo_html,
          imagens: [],
          videos: [],
          status: 'rascunho',
        })
        setSelected([])
        pendingContentRef.current = {
          html: recoveredHtml || empty.conteudo_html,
          selection: orphanDraft.selection,
        }
        setOpen(true)
        dirtyRef.current = true
        setDirty(true)
        setMessage('Rascunho local recuperado automaticamente após a última sessão.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os materiais.')
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    void load(true, true)
  }, [professorId])

  // Autosave local (IndexedDB) a cada alteração, com debounce curto.
  useEffect(() => {
    if (!open || !dirty) return

    if (localAutosaveTimerRef.current) {
      window.clearTimeout(localAutosaveTimerRef.current)
    }

    localAutosaveTimerRef.current = window.setTimeout(() => {
      void saveLocalEditorState()
    }, 700)

    return () => {
      if (localAutosaveTimerRef.current) {
        window.clearTimeout(localAutosaveTimerRef.current)
        localAutosaveTimerRef.current = null
      }
    }
  }, [open, dirty, editor.titulo, editor.id])

  // Autosave remoto (Supabase) estilo Google Docs: funciona para materiais novos,
  // rascunhos e publicados, e usa refs para nunca trabalhar com estado defasado.
  useEffect(() => {
    if (!open) return

    const timer = window.setInterval(() => {
      if (!dirtyRef.current || savingRef.current) return
      void saveRef.current?.('rascunho', true)
    }, 3000)

    const flush = () => {
      if (document.visibilityState === 'hidden' && dirtyRef.current && !savingRef.current) {
        void saveRef.current?.('rascunho', true)
      }
    }
    document.addEventListener('visibilitychange', flush)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', flush)
    }
  }, [open])

  // Injeta o conteúdo salvo no editor assim que ele é montado. Substitui os antigos
  // setTimeout(0), que podiam disparar antes do React montar o editor e deixar a página vazia.
  useLayoutEffect(() => {
    if (!open || loading || !editorRef.current || !pendingContentRef.current) return
    const { html, selection } = pendingContentRef.current
    pendingContentRef.current = null
    editorRef.current.innerHTML = html
    try {
      restoreEditorSelection(editorRef.current, selection)
    } catch (cause) {
      console.warn('Não foi possível restaurar o cursor:', cause)
    }
  }, [open, loading])

  function markChanged() {
    editorVersionRef.current += 1
    dirtyRef.current = true
    setDirty(true)
  }

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

  async function saveLocalEditorState() {
    if (!editorRef.current || !dirtyRef.current) return

    const model = domToEditorModel(editorRef.current)
    const selection = captureEditorSelection(editorRef.current)
    setAutosaveStatus('saving')

    try {
      await saveLocalMaterialDraft({
        materialId: localDraftKeyRef.current || editor.id || 'new',
        titulo: editor.titulo,
        idioma: editor.idioma,
        model,
        selection,
        operations: operationsRef.current,
        version: editorVersionRef.current,
        savedAt: new Date().toISOString(),
      })
      setAutosaveStatus('saved')
    } catch (cause) {
      setAutosaveStatus('error')
      console.error('Falha no autosave local do material:', cause)
    }
  }

  function sync(operationType = 'document_changed') {
    const html = editorRef.current?.innerHTML || editor.conteudo_html
    if (editorRef.current) {
      const model = domToEditorModel(editorRef.current)
      const selection = captureEditorSelection(editorRef.current)
      const version = ++editorVersionRef.current
      operationsRef.current = [
        ...operationsRef.current,
        createEditorOperation(operationType, version),
      ].slice(-200)
      void saveLocalMaterialDraft({
        materialId: localDraftKeyRef.current || editor.id || 'new',
        titulo: editor.titulo,
        idioma: editor.idioma,
        model,
        selection,
        operations: operationsRef.current,
        version,
        savedAt: new Date().toISOString(),
      }).catch((cause) => console.error('Falha no autosave local do material:', cause))
    }
    setEditor((value) => ({ ...value, conteudo_html: html }))
    dirtyRef.current = true
    setDirty(true)
    saveSelection()
  }

  function exec(command: string, value?: string) {
    editorRef.current?.focus()
    restoreSelection()
    document.execCommand(command, false, value)
    sync(`command:${command}`)
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

  async function rehydrateEditorImages(sourceHtml: string, fallbackPaths: string[] = []) {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = sourceHtml

    const paths = Array.from(new Set([
      ...fallbackPaths,
      ...Array.from(wrapper.querySelectorAll('img'), (image) =>
        image.getAttribute('data-material-image')?.trim() ||
        image.getAttribute('src')?.match(/^{{MATERIAL_IMAGE:(.+)}}$/)?.[1]?.trim() ||
        '',
      ),
    ].filter(Boolean)))

    const entries = await Promise.all(paths.map(async (path) => {
      const url = await resolveMaterialImage(path, async () => {
        const { data: signed } = await supabase.storage
          .from('materiais')
          .createSignedUrl(path, 3600)
        return signed?.signedUrl || null
      })
      return [path, url || ''] as const
    }))

    const urls = Object.fromEntries(entries.filter(([, url]) => url))

    wrapper.querySelectorAll('img').forEach((image) => {
      const path = image.getAttribute('data-material-image')?.trim() ||
        image.getAttribute('src')?.match(/^{{MATERIAL_IMAGE:(.+)}}$/)?.[1]?.trim()
      if (!path || !urls[path]) return
      image.setAttribute('src', urls[path])
      image.setAttribute('data-material-image', path)
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

  async function save(
    status: 'rascunho' | 'publicado',
    silent = false,
    forceCreate = false,
  ): Promise<string | false> {
    // Nunca dois salvamentos ao mesmo tempo (evita duplicar materiais novos).
    while (savingRef.current) {
      await new Promise((resolve) => window.setTimeout(resolve, 100))
    }

    const snapshot = getEditorSnapshot()
    const titulo = editor.titulo.trim() || (silent ? 'Material sem título' : '')

    if (!titulo) {
      setError('Informe um título para o material.')
      return false
    }

    // Autosave não cria material novo totalmente vazio.
    if (silent && !forceCreate && !materialIdRef.current && !editor.titulo.trim() && snapshot.isEmpty) {
      return false
    }

    if (status === 'publicado' && !selected.length) {
      setError('Selecione pelo menos um aluno para publicar.')
      return false
    }

    savingRef.current = true
    if (silent) {
      setRemoteStatus('saving')
    } else {
      setSaving(true)
      setError('')
    }
    const versionAtStart = editorVersionRef.current

    try {
      const html = snapshot.html
      const imagePaths = snapshot.imagePaths

      // Modelo gerado de um DOM destacado do React, a partir do HTML já serializado
      // (com placeholders, sem URLs assinadas que expiram). Nós DOM do editor visível
      // carregam referências internas do React e nunca devem ir para o Supabase.
      let model: EditorModelNode | null = null
      if (editorRef.current) {
        const detachedEditor = document.createElement('div')
        detachedEditor.innerHTML = html
        model = domToEditorModel(detachedEditor)
      }
      const selection: EditorSelectionState | null = editorRef.current
        ? captureEditorSelection(editorRef.current)
        : null
      const safeOperations: EditorOperation[] = operationsRef.current.map((operation) => ({
        id: String(operation.id),
        type: String(operation.type),
        at: String(operation.at),
        version: Number(operation.version),
      }))
      const safeVideos = editor.videos.map((url) => String(url))

      if (materialIdRef.current && snapshot.isEmpty && editor.conteudo_html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()) {
        throw new Error('O conteúdo do editor não pôde ser capturado com segurança. O documento não foi alterado.')
      }

      const basePayload: Record<string, unknown> = {
        professor_id: professorId,
        titulo,
        idioma: editor.idioma || null,
        conteudo_html: html,
        imagens: imagePaths,
        videos: safeVideos,
        conteudo_modelo: model,
        operacoes_editor: safeOperations,
        cursor_estado: selection,
        versao_editor: editorVersionRef.current,
        updated_at: new Date().toISOString(),
      }

      let id = materialIdRef.current

      if (id) {
        // Não altera o status: material publicado continua publicado
        // (com alterações pendentes) até o professor publicar novamente.
        const { data: updatedRows, error: updateError } = await supabase
          .from('materiais')
          .update(basePayload)
          .eq('id', id)
          .select('id')

        if (updateError) throw updateError
        if (!updatedRows?.length) {
          throw new Error('O banco não atualizou o material (nenhuma linha alterada). Verifique as políticas de acesso (RLS) da tabela materiais.')
        }
      } else {
        const { data, error: insertError } = await supabase
          .from('materiais')
          .insert({ ...basePayload, status: 'rascunho' })
          .select('id')
          .single()

        if (insertError) throw insertError
        id = data.id as string
        materialIdRef.current = id
      }

      const currentId: string = id

      if (status === 'publicado' && !silent) {
        if (!editorRef.current) {
          throw new Error('O editor não está disponível para gerar o PDF da publicação.')
        }

        setMessage('Gerando o PDF final da publicação...')

        const language = editor.idioma === 'ingles'
          ? 'Inglês'
          : editor.idioma === 'alemao'
            ? 'Alemão'
            : 'Material de apoio'

        const pdfBlob = await generateMaterialPdf(titulo, language, editorRef.current)
        const pdfPath = `${professorId}/${currentId}/publicado-${Date.now()}.pdf`

        const { error: pdfUploadError } = await supabase.storage
          .from('materiais')
          .upload(pdfPath, pdfBlob, {
            contentType: 'application/pdf',
            cacheControl: '31536000',
            upsert: false,
          })

        if (pdfUploadError) throw new Error(`Não foi possível armazenar o PDF publicado: ${pdfUploadError.message}`)

        const { data: pdfCheck, error: pdfCheckError } = await supabase.storage
          .from('materiais')
          .createSignedUrl(pdfPath, 60)

        if (pdfCheckError || !pdfCheck?.signedUrl) {
          await supabase.storage.from('materiais').remove([pdfPath])
          throw new Error(`O PDF foi enviado, mas não pôde ser verificado no Storage: ${pdfCheckError?.message || 'arquivo indisponível'}`)
        }

        const publishedAt = new Date().toISOString()
        const { data: publishedRows, error: publishError } = await supabase
          .from('materiais')
          .update({
            ...basePayload,
            status: 'publicado',
            conteudo_publicado_html: html,
            imagens_publicadas: imagePaths,
            videos_publicados: safeVideos,
            titulo_publicado: titulo,
            idioma_publicado: editor.idioma || null,
            publicado_em: publishedAt,
            pdf_publicado_path: pdfPath,
            pdf_publicado_em: publishedAt,
            // Igual ao pdf_publicado_em: o PDF é considerado "atual" até a próxima edição.
            updated_at: publishedAt,
          })
          .eq('id', currentId)
          .select('id')

        if (publishError || !publishedRows?.length) {
          await supabase.storage.from('materiais').remove([pdfPath])
          throw publishError || new Error('O banco não registrou a publicação (nenhuma linha alterada). Verifique as políticas de acesso (RLS).')
        }
      }

      // Destinatários: no autosave só são regravados quando mudaram,
      // evitando apagar e reinserir a cada ciclo.
      if (status === 'publicado' || !silent || recipientsDirtyRef.current) {
        const { error: recipientsDeleteError } = await supabase
          .from('material_alunos')
          .delete()
          .eq('material_id', currentId)

        if (recipientsDeleteError) throw recipientsDeleteError

        if (selected.length) {
          const recipientRows = selected.map((aluno_id) => ({ material_id: currentId, aluno_id }))
          const { data: insertedRecipients, error: recipientsInsertError } = await supabase
            .from('material_alunos')
            .insert(recipientRows)
            .select('aluno_id')

          if (recipientsInsertError) throw recipientsInsertError

          const insertedIds = new Set((insertedRecipients || []).map((row) => row.aluno_id))
          const missingRecipients = selected.filter((aluno_id) => !insertedIds.has(aluno_id))

          if (missingRecipients.length) {
            throw new Error('Nem todos os alunos selecionados foram vinculados ao material.')
          }
        }
        recipientsDirtyRef.current = false
      }

      setEditor((value) => ({
        ...value,
        id: currentId,
        status: status === 'publicado' ? 'publicado' : value.status,
        imagens: imagePaths,
      }))

      // Só marca como salvo se nada foi digitado enquanto o salvamento rodava.
      const unchanged = editorVersionRef.current === versionAtStart
      const oldKey = localDraftKeyRef.current
      localDraftKeyRef.current = currentId

      if (unchanged) {
        dirtyRef.current = false
        setDirty(false)
        await removeLocalMaterialDraft(currentId)
      } else {
        // Guarda localmente o que foi digitado durante o salvamento.
        await saveLocalEditorState()
      }
      if (oldKey && oldKey !== currentId) await removeLocalMaterialDraft(oldKey)

      setRemoteStatus('saved')
      setLastSavedAt(new Date())

      if (!silent) {
        await load(false)
        setMessage(
          status === 'publicado'
            ? 'Material publicado em PDF para os alunos selecionados.'
            : 'Rascunho salvo com sucesso.',
        )
      }

      return currentId
    } catch (cause) {
      setRemoteStatus('error')
      console.error('Falha ao salvar material:', cause)

      if (!silent) {
        const details = cause && typeof cause === 'object'
          ? cause as { message?: string; code?: string; details?: string; hint?: string }
          : null
        const reason = details?.message || (cause instanceof Error ? cause.message : '')
        const extra = [details?.code, details?.details, details?.hint].filter(Boolean).join(' · ')
        setError(reason ? `Não foi possível salvar o material: ${reason}${extra ? ` — ${extra}` : ''}` : 'Não foi possível salvar o material.')
      }
      return false
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  // Mantém sempre a versão mais recente da função disponível para o autosave.
  saveRef.current = save

  async function ensureDraft(): Promise<string | false> {
    if (materialIdRef.current) return materialIdRef.current
    return save('rascunho', true, true)
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
    sync('insert_image')
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
    localDraftKeyRef.current = `new-${crypto.randomUUID()}`
    materialIdRef.current = null
    recipientsDirtyRef.current = false
    dirtyRef.current = false
    editorVersionRef.current = 0
    operationsRef.current = []
    setRemoteStatus('idle')
    setLastSavedAt(null)
    setEditor({ ...empty })
    setSelected([])
    setSearch('')
    setDirty(false)
    setError('')
    setMessage('')
    setActiveTable(null)
    pendingContentRef.current = { html: empty.conteudo_html, selection: null }
    setOpen(true)
  }

  async function edit(material: MaterialRecord) {
    // A lista de materiais é apenas uma visão resumida e pode estar defasada
    // quando o professor salva e reabre rapidamente. Sempre buscamos o
    // documento atual antes de montar novamente o editor.
    const [{ data: currentMaterial, error: materialError }, { data: recipients, error: recipientsError }] = await Promise.all([
      supabase
        .from('materiais')
        .select('id,titulo,idioma,conteudo_html,imagens,videos,status,created_at,updated_at,publicado_em,pdf_publicado_path,conteudo_modelo,operacoes_editor,cursor_estado,versao_editor')
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

    localDraftKeyRef.current = currentMaterial.id
    materialIdRef.current = currentMaterial.id
    recipientsDirtyRef.current = false
    setRemoteStatus('idle')
    setLastSavedAt(null)

    const localDraft = await loadLocalMaterialDraft(currentMaterial.id)
    const remoteUpdatedAt = new Date(currentMaterial.updated_at || 0).getTime()
    const localUpdatedAt = new Date(localDraft?.savedAt || 0).getTime()
    // O rascunho local só vence o remoto se for mais novo, tiver versão maior (alterações
    // que nunca chegaram ao banco) e tiver conteúdo real. Caso contrário é lixo de sessões
    // anteriores e é descartado, para nunca sobrepor o documento salvo com uma página vazia.
    const hasNewerLocalDraft = Boolean(
      localDraft &&
      localUpdatedAt > remoteUpdatedAt &&
      Number(localDraft.version || 0) > Number(currentMaterial.versao_editor || 0),
    )

    let restoredLocalHtml = ''
    if (hasNewerLocalDraft && localDraft?.model) {
      const localHtml = editorModelToHtml(localDraft.model)
      restoredLocalHtml = await rehydrateEditorImages(localHtml, currentMaterial.imagens || [])
    }

    const useLocalDraft = Boolean(localDraft && hasNewerLocalDraft && hasMeaningfulContent(restoredLocalHtml))

    if (localDraft && !useLocalDraft) {
      await removeLocalMaterialDraft(currentMaterial.id)
    }

    if (useLocalDraft && localDraft) {
      setSelected((recipients || []).map((row) => row.aluno_id))
      setEditor({
        id: currentMaterial.id,
        titulo: localDraft.titulo || currentMaterial.titulo,
        idioma: localDraft.idioma || currentMaterial.idioma || '',
        conteudo_html: restoredLocalHtml || empty.conteudo_html,
        imagens: currentMaterial.imagens || [],
        videos: currentMaterial.videos || [],
        status: currentMaterial.status,
      })
      editorVersionRef.current = localDraft.version
      operationsRef.current = localDraft.operations || []
      pendingContentRef.current = {
        html: restoredLocalHtml || empty.conteudo_html,
        selection: localDraft.selection,
      }
      setOpen(true)
      dirtyRef.current = true
      setDirty(true)
      setActiveTable(null)
      setMessage('Rascunho local mais recente recuperado automaticamente.')
      return
    }

    // O HTML salvo é a fonte da verdade do documento (o mesmo usado pelo
    // botão Visualizar), garantindo que editor e visualização sejam idênticos.
    const remoteHtml = currentMaterial.conteudo_html || empty.conteudo_html
    editorVersionRef.current = Number(currentMaterial.versao_editor || 0)
    operationsRef.current = (currentMaterial.operacoes_editor || []) as EditorOperation[]

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
    let html = remoteHtml

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
    pendingContentRef.current = {
      html,
      selection: currentMaterial.cursor_estado as EditorSelectionState | null,
    }
    setOpen(true)
    dirtyRef.current = false
    setDirty(false)
    setActiveTable(null)
  }

  // Estilo Google Docs: ao sair, salva automaticamente. O diálogo só aparece se o salvamento falhar.
  async function close() {
    if (dirtyRef.current) {
      const nothingToKeep = !materialIdRef.current && !editor.titulo.trim() && getEditorSnapshot().isEmpty

      if (nothingToKeep) {
        if (localDraftKeyRef.current) await removeLocalMaterialDraft(localDraftKeyRef.current)
      } else {
        const id = await save('rascunho', true)
        if (!id) {
          setExitDialog(true)
          return
        }
      }
    }

    dirtyRef.current = false
    setDirty(false)
    setOpen(false)
    await load(false)
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

      await removeLocalMaterialDraft(material.id)
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
    if (!saveDraft && localDraftKeyRef.current) {
      await removeLocalMaterialDraft(localDraftKeyRef.current)
    }
    setExitDialog(false)
    dirtyRef.current = false
    setDirty(false)
    setOpen(false)
    await load(false)
  }

  // Visualizar sempre mostra exatamente o último conteúdo salvo (rascunho ou publicado).
  async function view(material: MaterialRecord) {
    try {
      const { data: current, error: currentError } = await supabase
        .from('materiais')
        .select('id,titulo,idioma,conteudo_html,imagens,videos,status,created_at,updated_at,publicado_em,pdf_publicado_path,pdf_publicado_em')
        .eq('id', material.id)
        .eq('professor_id', professorId)
        .single()

      if (currentError) throw currentError

      const hydratedHtml = await rehydrateEditorImages(current.conteudo_html || '', current.imagens || [])

      // O PDF publicado só é exibido se nenhuma edição foi salva depois da publicação.
      const pdfIsCurrent = Boolean(current.pdf_publicado_path && current.pdf_publicado_em) &&
        new Date(current.updated_at).getTime() <= new Date(current.pdf_publicado_em).getTime()

      let pdfUrl = ''
      if (pdfIsCurrent) {
        const { data, error: pdfError } = await supabase.storage
          .from('materiais')
          .createSignedUrl(current.pdf_publicado_path, 3600)

        if (pdfError || !data?.signedUrl) {
          throw pdfError || new Error('Não foi possível gerar o acesso temporário ao PDF publicado.')
        }
        pdfUrl = data.signedUrl
      }

      setViewerPdfUrl(pdfUrl)
      setViewer({ ...(current as MaterialRecord), conteudo_html: hydratedHtml })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o material.')
    }
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
    recipientsDirtyRef.current = true
    markChanged()
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
          <button type="button" className="professor-secondary-button" onClick={() => void close()}>
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
                  markChanged()
                }}
                placeholder="Título do material"
              />
              <select
                value={editor.idioma}
                onChange={(event) => {
                  setEditor((value) => ({ ...value, idioma: event.target.value as EditorState['idioma'] }))
                  markChanged()
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
              onInput={() => sync('input')}
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
                {remoteStatus === 'saving'
                  ? 'Salvando...'
                  : remoteStatus === 'error'
                    ? 'Não foi possível salvar na nuvem · alterações guardadas neste navegador'
                    : autosaveStatus === 'error'
                      ? 'Autosave local indisponível'
                      : dirty
                        ? 'Alterações pendentes...'
                        : lastSavedAt
                          ? `Todas as alterações salvas às ${lastSavedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                          : 'Todas as alterações estão salvas'}
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
                <button
                  type="button"
                  onClick={() => {
                    setSelected([])
                    recipientsDirtyRef.current = true
                    markChanged()
                  }}
                  disabled={!selected.length}
                >
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
                          recipientsDirtyRef.current = true
                          markChanged()
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
              <h3>Não foi possível salvar automaticamente</h3>
              <p>Suas alterações ainda não foram enviadas. Deseja tentar salvar o rascunho antes de sair?</p>
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
                <span>
                  {material.status === 'publicado'
                    ? (material.publicado_em && new Date(material.updated_at) > new Date(material.publicado_em)
                      ? 'Publicado · alterações não publicadas'
                      : 'Publicado')
                    : 'Rascunho'}
                  {material.idioma ? ` · ${material.idioma === 'ingles' ? 'Inglês' : 'Alemão'}` : ''}
                </span>
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
          <MaterialViewer material={viewer} pdfUrl={viewerPdfUrl} onClose={() => { setViewer(null); setViewerPdfUrl('') }} />
        </div>
      )}
    </div>
  )
}
