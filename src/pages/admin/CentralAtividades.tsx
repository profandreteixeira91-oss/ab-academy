import { useEffect, useMemo, useState } from 'react'
import { Archive, CheckCircle2, Eye, Filter, Loader2, Pencil, RefreshCw, Save, Sparkles, WandSparkles, X, CheckSquare, Plus, Square, UploadCloud } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Activity = {
  id: string
  idioma: 'ingles' | 'alemao'
  nivel: string
  categoria: string
  tipo_exercicio: string
  titulo: string
  descricao: string | null
  instrucoes: string | null
  conteudo: Record<string, unknown>
  explicacao: string | null
  dificuldade: number
  tempo_estimado: number
  status: 'rascunho' | 'publicada' | 'arquivada'
  origem: 'manual' | 'ia'
  mes_referencia: string | null
  versao: number
  created_at: string
  updated_at: string
}

const LEVELS = [['iniciante','Iniciante'],['basico','Básico'],['intermediario','Intermediário'],['avancado','Avançado'],['fluente','Fluente']]
const CATEGORIES = [['todas','Todas'],['vocabulario','Vocabulário'],['gramatica','Gramática'],['leitura','Leitura'],['compreensao','Compreensão'],['escrita','Escrita'],['cotidiano','Cotidiano'],['revisao','Revisão']]
const TYPES = [['multipla_escolha','Múltipla escolha'],['multipla_resposta','Múltipla resposta'],['verdadeiro_falso','Verdadeiro ou falso'],['dissertativa','Dissertativa'],['resposta_curta','Resposta curta'],['lacunas','Lacunas'],['ordenar','Ordenar'],['associar','Associar']]

function label(items: string[][], value: string) {
  return items.find(x => x[0] === value)?.[1] || value
}

export default function CentralAtividadesAdmin() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [language, setLanguage] = useState('todos')
  const [level, setLevel] = useState('todos')
  const [category, setCategory] = useState('todas')
  const [status, setStatus] = useState('todos')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Activity | null>(null)
  const [editing, setEditing] = useState(false)
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Activity | null>(null)
  const [jsonText, setJsonText] = useState('')
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number; bucket: string } | null>(null)
  const [generatorMode, setGeneratorMode] = useState<'lote' | 'meta' | 'biblioteca'>('meta')
  const [generator, setGenerator] = useState({ idioma: 'ingles', nivel: 'iniciante', categoria: 'vocabulario', tipo_exercicio: 'multipla_escolha', quantidade: 10 })
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  async function load() {
    setLoading(true)
    let query = supabase.from('central_atividades')
      .select('id,idioma,nivel,categoria,tipo_exercicio,titulo,descricao,instrucoes,conteudo,explicacao,dificuldade,tempo_estimado,status,origem,mes_referencia,versao,created_at,updated_at')
      .order('created_at', { ascending: false })
    if (language !== 'todos') query = query.eq('idioma', language)
    if (level !== 'todos') query = query.eq('nivel', level)
    if (category !== 'todas') query = query.eq('categoria', category)
    if (status !== 'todos') query = query.eq('status', status)
    const { data, error } = await query
    if (error) {
      console.error(error)
      setActivities([])
    } else {
      setActivities((data || []) as Activity[])
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [language, level, category, status])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    if (!term) return activities
    return activities.filter(a =>
      a.titulo.toLocaleLowerCase().includes(term) ||
      (a.descricao || '').toLocaleLowerCase().includes(term)
    )
  }, [activities, search])

  const totals = useMemo(() => ({
    total: activities.length,
    published: activities.filter(a => a.status === 'publicada').length,
    drafts: activities.filter(a => a.status === 'rascunho').length,
    ai: activities.filter(a => a.origem === 'ia').length,
  }), [activities])

  async function invokeGeneration(payload: typeof generator) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Sua sessão administrativa expirou. Faça login novamente.')
    const { data, error } = await supabase.functions.invoke('gerar-central-atividades', {
      body: payload,
      headers: { Authorization: 'Bearer ' + session.access_token },
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    return Number(data?.generated || 0)
  }

  async function generateActivities() {
    setGenerating(true)
    setGenerationProgress(null)
    try {
      if (generatorMode === 'lote') {
        const generated = await invokeGeneration(generator)
        window.alert(`${generated} atividade(s) gerada(s) como rascunho.`)
      } else {
        const buckets = generatorMode === 'meta'
          ? [{ idioma: generator.idioma, nivel: generator.nivel }]
          : ['ingles','alemao'].flatMap(idioma => LEVELS.map(([nivel]) => ({ idioma, nivel })))

        let totalGenerated = 0
        let totalTarget = 0
        for (const bucket of buckets) {
          const { count } = await supabase
            .from('central_atividades')
            .select('id', { count: 'exact', head: true })
            .eq('idioma', bucket.idioma)
            .eq('nivel', bucket.nivel)
            .neq('status', 'arquivada')

          const existing = count || 0
          const missing = Math.max(0, 100 - existing)
          totalTarget += missing
        }

        if (totalTarget === 0) {
          window.alert('A biblioteca já atingiu a meta de 100 atividades em todos os blocos selecionados.')
          return
        }

        let completed = 0
        for (const bucket of buckets) {
          const { count } = await supabase
            .from('central_atividades')
            .select('id', { count: 'exact', head: true })
            .eq('idioma', bucket.idioma)
            .eq('nivel', bucket.nivel)
            .neq('status', 'arquivada')

          let remaining = Math.max(0, 100 - (count || 0))
          let batchIndex = 0
          while (remaining > 0) {
            const categoria = CATEGORIES.filter(x => x[0] !== 'todas')[batchIndex % 7][0]
            const type = TYPES[batchIndex % TYPES.length][0]
            const quantidade = Math.min(20, remaining)
            setGenerationProgress({
              current: completed,
              total: totalTarget,
              bucket: `${bucket.idioma === 'ingles' ? 'Inglês' : 'Alemão'} · ${label(LEVELS, bucket.nivel)}`,
            })
            const generated = await invokeGeneration({
              idioma: bucket.idioma,
              nivel: bucket.nivel,
              categoria,
              tipo_exercicio: type,
              quantidade,
            })
            if (generated <= 0) throw new Error('A IA não gerou novas atividades neste lote.')
            totalGenerated += generated
            completed += generated
            remaining -= generated
            batchIndex += 1
            setGenerationProgress({
              current: Math.min(completed, totalTarget),
              total: totalTarget,
              bucket: `${bucket.idioma === 'ingles' ? 'Inglês' : 'Alemão'} · ${label(LEVELS, bucket.nivel)}`,
            })
          }
        }

        window.alert(`${totalGenerated} atividade(s) gerada(s) como rascunho. A biblioteca foi preenchida até a meta dos blocos selecionados.`)
      }
      setGeneratorOpen(false)
      await load()
    } catch (error) {
      console.error(error)
      window.alert(error instanceof Error ? error.message : 'Não foi possível gerar as atividades.')
    } finally {
      setGenerating(false)
      setGenerationProgress(null)
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  function toggleVisibleSelection() {
    const visibleDraftIds = filtered.filter(a => a.status === 'rascunho').map(a => a.id)
    if (!visibleDraftIds.length) return
    setSelectedIds(current => {
      const allSelected = visibleDraftIds.every(id => current.includes(id))
      return allSelected
        ? current.filter(id => !visibleDraftIds.includes(id))
        : Array.from(new Set([...current, ...visibleDraftIds]))
    })
  }

  async function publishIds(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids))
    if (!uniqueIds.length) return
    setActionLoading('bulk')
    const { error } = await supabase
      .from('central_atividades')
      .update({ status: 'publicada' })
      .in('id', uniqueIds)
      .eq('status', 'rascunho')

    if (error) {
      console.error(error)
      window.alert('Não foi possível publicar as atividades selecionadas.')
    } else {
      setSelectedIds([])
      await load()
    }
    setActionLoading(null)
  }

  async function publishAllVisibleDrafts() {
    const ids = filtered.filter(a => a.status === 'rascunho').map(a => a.id)
    if (!ids.length) {
      window.alert('Não há rascunhos no filtro atual.')
      return
    }
    if (!window.confirm(`Publicar ${ids.length} rascunho(s) de uma vez?`)) return
    await publishIds(ids)
  }

  const openEditor = (activity: Activity) => {
    setSelected(activity)
    setForm({ ...activity })
    setJsonText(JSON.stringify(activity.conteudo || {}, null, 2))
    setEditing(false)
    setPreview(false)
  }

  const closeEditor = () => {
    if (saving) return
    setSelected(null)
    setForm(null)
    setEditing(false)
    setPreview(false)
  }

  const updateForm = <K extends keyof Activity>(key: K, value: Activity[K]) => {
    setForm(current => current ? { ...current, [key]: value } : current)
  }

  async function saveActivity(nextStatus?: Activity['status']) {
    if (!form) return
    let parsedContent: Record<string, unknown>
    try {
      parsedContent = JSON.parse(jsonText)
    } catch {
      window.alert('O conteúdo JSON está inválido. Corrija antes de salvar.')
      return
    }

    if (!form.titulo.trim()) {
      window.alert('Informe um título para a atividade.')
      return
    }

    setSaving(true)
    const payload = {
      idioma: form.idioma,
      nivel: form.nivel,
      categoria: form.categoria,
      tipo_exercicio: form.tipo_exercicio,
      titulo: form.titulo.trim(),
      descricao: form.descricao?.trim() || null,
      instrucoes: form.instrucoes?.trim() || null,
      conteudo: parsedContent,
      explicacao: form.explicacao?.trim() || null,
      dificuldade: Math.max(1, Math.min(5, Number(form.dificuldade) || 1)),
      tempo_estimado: Math.max(1, Number(form.tempo_estimado) || 5),
      mes_referencia: form.mes_referencia || null,
      status: nextStatus || form.status,
      versao: Math.max(1, Number(form.versao) || 1) + (nextStatus ? 0 : 1),
    }

    const { data, error } = await supabase.from('central_atividades')
      .update(payload)
      .eq('id', form.id)
      .select('id,idioma,nivel,categoria,tipo_exercicio,titulo,descricao,instrucoes,conteudo,explicacao,dificuldade,tempo_estimado,status,origem,mes_referencia,versao,created_at,updated_at')
      .single()

    if (error) {
      console.error(error)
      window.alert('Não foi possível salvar a atividade.')
    } else {
      const updated = data as Activity
      setSelected(updated)
      setForm(updated)
      setJsonText(JSON.stringify(updated.conteudo || {}, null, 2))
      setEditing(false)
      setPreview(false)
      await load()
    }
    setSaving(false)
  }

  async function changeStatus(id: string, next: 'publicada' | 'arquivada') {
    setActionLoading(id)
    const { error } = await supabase.from('central_atividades').update({ status: next }).eq('id', id)
    if (error) {
      console.error(error)
      window.alert('Não foi possível alterar o status.')
    } else {
      if (selected?.id === id) {
        setSelected(current => current ? { ...current, status: next } : current)
        setForm(current => current ? { ...current, status: next } : current)
      }
      await load()
    }
    setActionLoading(null)
  }

  return (
    <div className="central-admin-page">
      <div className="central-admin-intro">
        <div>
          <div className="central-admin-kicker"><Sparkles size={15}/> CENTRAL DE ATIVIDADES</div>
          <h2>Biblioteca de prática</h2>
          <p>Gerencie, revise e publique atividades por idioma, nível e categoria.</p>
        </div>
        <div className="central-admin-intro-actions">
          <button type="button" className="central-admin-generate" onClick={() => { setGeneratorMode('meta'); setGeneratorOpen(true) }}><WandSparkles size={17}/>Gerar com IA</button>
          <button type="button" className="central-admin-auto" onClick={() => { setGeneratorMode('biblioteca'); setGeneratorOpen(true) }}><Sparkles size={17}/>Completar biblioteca</button>
          <button type="button" className="central-admin-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={17}/>Atualizar</button>
        </div>
      </div>

      <div className="central-admin-stats">
        <div><span>Total</span><strong>{totals.total}</strong></div>
        <div><span>Publicadas</span><strong>{totals.published}</strong></div>
        <div><span>Rascunhos</span><strong>{totals.drafts}</strong></div>
        <div><span>Geradas por IA</span><strong>{totals.ai}</strong></div>
      </div>

      <div className="central-admin-goals">
        <div className="central-admin-goals-head"><div><strong>Meta da biblioteca</strong><span>100 atividades para cada combinação de idioma + nível.</span></div><div className="central-admin-goal-actions"><button type="button" onClick={() => { setGeneratorMode('biblioteca'); setGeneratorOpen(true) }}><Sparkles size={15}/>Completar tudo</button><button type="button" onClick={() => void publishAllVisibleDrafts()} disabled={actionLoading === 'bulk'}><UploadCloud size={15}/>Publicar rascunhos</button></div></div>
        <div className="central-admin-goal-grid">
          {['ingles','alemao'].flatMap(lang => LEVELS.map(([value, name]) => (
            <div key={lang + value}>
              <span>{lang === 'ingles' ? 'Inglês' : 'Alemão'} · {name}</span>
              <strong>{activities.filter(a => a.idioma === lang && a.nivel === value && a.status === 'publicada').length}/100</strong>
            </div>
          )))}
        </div>
      </div>

      <div className="central-admin-filters">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar atividade..." />
        <select value={language} onChange={e => setLanguage(e.target.value)}><option value="todos">Todos os idiomas</option><option value="ingles">Inglês</option><option value="alemao">Alemão</option></select>
        <select value={level} onChange={e => setLevel(e.target.value)}><option value="todos">Todos os níveis</option>{LEVELS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select value={status} onChange={e => setStatus(e.target.value)}><option value="todos">Todos os status</option><option value="rascunho">Rascunhos</option><option value="publicada">Publicadas</option><option value="arquivada">Arquivadas</option></select>
      </div>

      <div className="central-admin-list">
        <div className="central-admin-list-head">
          <span>{filtered.length} atividade(s)</span>
          <div className="central-admin-list-head-actions">
            {filtered.some(a => a.status === 'rascunho') && <button type="button" onClick={toggleVisibleSelection}><CheckSquare size={15}/>Selecionar rascunhos</button>}
            {selectedIds.length > 0 && <button type="button" className="central-admin-bulk-publish" onClick={() => void publishIds(selectedIds)} disabled={actionLoading === 'bulk'}>{actionLoading === 'bulk' ? <Loader2 size={15} className="central-admin-spin"/> : <UploadCloud size={15}/>}Publicar selecionadas ({selectedIds.length})</button>}
            <span><Filter size={15}/> Filtros aplicados</span>
          </div>
        </div>
        {loading ? (
          <div className="central-admin-empty"><Loader2 size={25} className="central-admin-spin"/>Carregando biblioteca...</div>
        ) : filtered.length === 0 ? (
          <div className="central-admin-empty"><Sparkles size={25}/><strong>Nenhuma atividade encontrada</strong><span>As atividades geradas pela IA aparecerão aqui como rascunhos.</span></div>
        ) : filtered.map(a => (
          <article key={a.id} className={`central-admin-row ${selectedIds.includes(a.id) ? 'selected' : ''}`}>
            {a.status === 'rascunho' && <button type="button" className="central-admin-select" onClick={() => toggleSelection(a.id)} aria-label={selectedIds.includes(a.id) ? 'Desmarcar atividade' : 'Selecionar atividade'}>{selectedIds.includes(a.id) ? <CheckSquare size={18}/> : <Square size={18}/>}</button>}
            <button type="button" className="central-admin-row-open" onClick={() => openEditor(a)}>
              <div className="central-admin-row-main">
                <div className="central-admin-tags">
                  <span>{a.idioma === 'ingles' ? 'Inglês' : 'Alemão'}</span>
                  <span>{label(LEVELS, a.nivel)}</span>
                  <span>{label(CATEGORIES, a.categoria)}</span>
                  <span className={'central-admin-status ' + a.status}>{a.status}</span>
                </div>
                <h3>{a.titulo}</h3>
                <p>{a.origem === 'ia' ? 'Gerada por IA' : 'Criada manualmente'} · {label(TYPES, a.tipo_exercicio)} · dificuldade {a.dificuldade}/5 · {a.tempo_estimado} min</p>
              </div>
              <Eye size={17}/>
            </button>
            <div className="central-admin-row-actions">
              <button type="button" onClick={() => openEditor(a)}><Pencil size={16}/>Editar</button>
              {a.status === 'rascunho' && <button type="button" onClick={() => void changeStatus(a.id, 'publicada')} disabled={actionLoading === a.id}>{actionLoading === a.id ? <Loader2 size={16} className="central-admin-spin"/> : <CheckCircle2 size={16}/>}Publicar</button>}
              {a.status === 'publicada' && <button type="button" onClick={() => void changeStatus(a.id, 'arquivada')} disabled={actionLoading === a.id}>{actionLoading === a.id ? <Loader2 size={16} className="central-admin-spin"/> : <Archive size={16}/>}Arquivar</button>}
            </div>
          </article>
        ))}
      </div>

      {generatorOpen && (
        <div className="central-admin-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !generating) setGeneratorOpen(false) }}>
          <section className="central-admin-modal central-admin-generator-modal">
            <header className="central-admin-modal-head"><div><span>GERAÇÃO AUTOMÁTICA</span><h3>Gerar atividades com IA</h3></div><button type="button" onClick={() => setGeneratorOpen(false)} disabled={generating}><X size={20}/></button></header>
            <div className="central-admin-generator">
              <div className="central-admin-generator-mode">
                <button type="button" className={generatorMode === 'meta' ? 'active' : ''} onClick={() => setGeneratorMode('meta')} disabled={generating}><Sparkles size={16}/>Completar nível</button>
                <button type="button" className={generatorMode === 'biblioteca' ? 'active' : ''} onClick={() => setGeneratorMode('biblioteca')} disabled={generating}><WandSparkles size={16}/>Completar biblioteca</button>
                <button type="button" className={generatorMode === 'lote' ? 'active' : ''} onClick={() => setGeneratorMode('lote')} disabled={generating}><Plus size={16}/>Gerar lote</button>
              </div>

              <div className="central-admin-generator-hero">
                <div className="central-admin-generator-icon"><WandSparkles size={22}/></div>
                <div>
                  <strong>{generatorMode === 'biblioteca' ? 'Preenchimento automático da biblioteca' : generatorMode === 'meta' ? 'Preencher automaticamente até 100' : 'Gerar um lote personalizado'}</strong>
                  <p>{generatorMode === 'biblioteca' ? 'O sistema identifica automaticamente os blocos abaixo da meta e gera lotes de até 20 atividades, alternando categorias e tipos para manter a biblioteca diversificada.' : generatorMode === 'meta' ? 'Escolha idioma e nível. A IA calcula quantas atividades faltam para chegar a 100 e gera os lotes automaticamente.' : 'Use um lote pontual quando quiser produzir uma quantidade específica para uma categoria.'}</p>
                </div>
              </div>

              <div className="central-admin-form-grid">
                <label>Idioma<select value={generator.idioma} onChange={e => setGenerator(g => ({...g, idioma:e.target.value}))} disabled={generatorMode === 'biblioteca' || generating}><option value="ingles">Inglês</option><option value="alemao">Alemão</option></select></label>
                <label>Nível<select value={generator.nivel} onChange={e => setGenerator(g => ({...g, nivel:e.target.value}))} disabled={generatorMode === 'biblioteca' || generating}>{LEVELS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label>Categoria<select value={generator.categoria} onChange={e => setGenerator(g => ({...g, categoria:e.target.value}))} disabled={generatorMode !== 'lote' || generating}>{CATEGORIES.filter(x => x[0] !== 'todas').map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label>Tipo de exercício<select value={generator.tipo_exercicio} onChange={e => setGenerator(g => ({...g, tipo_exercicio:e.target.value}))} disabled={generatorMode !== 'lote' || generating}>{TYPES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                {generatorMode === 'lote' && <label>Quantidade<select value={generator.quantidade} onChange={e => setGenerator(g => ({...g, quantidade:Number(e.target.value)}))} disabled={generating}>{[5,10,15,20].map(v => <option key={v} value={v}>{v} atividades</option>)}</select></label>}
              </div>

              {generationProgress && <div className="central-admin-generation-progress"><div className="central-admin-generation-progress-top"><span>{generationProgress.bucket}</span><strong>{generationProgress.current} / {generationProgress.total}</strong></div><div className="central-admin-progress-track"><span style={{ width: `${generationProgress.total ? Math.min(100, generationProgress.current / generationProgress.total * 100) : 0}%` }}/></div><small>Gerando atividades automaticamente. Não feche esta janela.</small></div>}

              <div className="central-admin-generator-note"><Sparkles size={17}/><span>As novas atividades entram como <strong>rascunhos</strong>. A geração automática nunca publica conteúdo sem sua revisão.</span></div>
            </div>
            <footer className="central-admin-modal-foot"><span>{generatorMode === 'biblioteca' ? 'Até 100 por bloco · geração automática' : generatorMode === 'meta' ? 'A quantidade é calculada automaticamente' : 'Máximo de 20 por lote'}</span><div><button type="button" className="central-admin-secondary" onClick={() => setGeneratorOpen(false)} disabled={generating}>Cancelar</button><button type="button" className="central-admin-publish" onClick={() => void generateActivities()} disabled={generating}>{generating ? <Loader2 size={16} className="central-admin-spin"/> : <WandSparkles size={16}/>} {generating ? 'Gerando automaticamente...' : generatorMode === 'biblioteca' ? 'Completar biblioteca' : generatorMode === 'meta' ? 'Completar até 100' : 'Gerar lote'}</button></div></footer>
          </section>
        </div>
      )}

      {selected && form && (
        <div className="central-admin-overlay" onMouseDown={e => { if (e.target === e.currentTarget) closeEditor() }}>
          <section className="central-admin-modal">
            <header className="central-admin-modal-head">
              <div><span>ATIVIDADE · {form.origem === 'ia' ? 'GERADA POR IA' : 'MANUAL'}</span><h3>{form.titulo || 'Editar atividade'}</h3></div>
              <button type="button" onClick={closeEditor}><X size={20}/></button>
            </header>

            <div className="central-admin-modal-tabs">
              <button className={!preview ? 'active' : ''} type="button" onClick={() => setPreview(false)}><Pencil size={15}/>Editor</button>
              <button className={preview ? 'active' : ''} type="button" onClick={() => setPreview(true)}><Eye size={15}/>Pré-visualização</button>
            </div>

            {!preview ? (
              <div className="central-admin-editor">
                <div className="central-admin-form-grid">
                  <label>Título<input value={form.titulo} onChange={e => updateForm('titulo', e.target.value)} /></label>
                  <label>Tipo<select value={form.tipo_exercicio} onChange={e => updateForm('tipo_exercicio', e.target.value)}>{TYPES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                  <label>Idioma<select value={form.idioma} onChange={e => updateForm('idioma', e.target.value as Activity['idioma'])}><option value="ingles">Inglês</option><option value="alemao">Alemão</option></select></label>
                  <label>Nível<select value={form.nivel} onChange={e => updateForm('nivel', e.target.value)}>{LEVELS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                  <label>Categoria<select value={form.categoria} onChange={e => updateForm('categoria', e.target.value)}>{CATEGORIES.filter(x => x[0] !== 'todas').map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                  <label>Dificuldade<select value={form.dificuldade} onChange={e => updateForm('dificuldade', Number(e.target.value))}>{[1,2,3,4,5].map(v => <option key={v} value={v}>{v}/5</option>)}</select></label>
                  <label>Tempo estimado (min)<input type="number" min="1" value={form.tempo_estimado} onChange={e => updateForm('tempo_estimado', Number(e.target.value))} /></label>
                  <label>Mês de referência<input type="date" value={form.mes_referencia || ''} onChange={e => updateForm('mes_referencia', e.target.value || null)} /></label>
                </div>
                <label className="central-admin-field-full">Descrição<textarea rows={3} value={form.descricao || ''} onChange={e => updateForm('descricao', e.target.value)} /></label>
                <label className="central-admin-field-full">Instruções<textarea rows={3} value={form.instrucoes || ''} onChange={e => updateForm('instrucoes', e.target.value)} /></label>
                <label className="central-admin-field-full">Conteúdo da atividade (JSON)<textarea className="central-admin-json" rows={13} value={jsonText} onChange={e => setJsonText(e.target.value)} spellCheck={false} /></label>
                <label className="central-admin-field-full">Explicação / feedback<textarea rows={4} value={form.explicacao || ''} onChange={e => updateForm('explicacao', e.target.value)} /></label>
              </div>
            ) : (
              <div className="central-admin-preview">
                <span className="central-admin-preview-level">{form.idioma === 'ingles' ? 'Inglês' : 'Alemão'} · {label(LEVELS, form.nivel)}</span>
                <h2>{form.titulo}</h2>
                {form.descricao && <p>{form.descricao}</p>}
                {form.instrucoes && <div className="central-admin-preview-box"><strong>Instruções</strong><p>{form.instrucoes}</p></div>}
                <div className="central-admin-preview-box"><strong>Conteúdo</strong><pre>{jsonText}</pre></div>
                {form.explicacao && <div className="central-admin-preview-box"><strong>Explicação</strong><p>{form.explicacao}</p></div>}
              </div>
            )}

            <footer className="central-admin-modal-foot">
              <span>Versão {form.versao} · {form.status}</span>
              <div>
                <button type="button" className="central-admin-secondary" onClick={closeEditor}>Fechar</button>
                {form.status === 'rascunho' && <button type="button" className="central-admin-primary" onClick={() => void saveActivity()} disabled={saving}>{saving ? <Loader2 size={16} className="central-admin-spin"/> : <Save size={16}/>}Salvar rascunho</button>}
                {form.status === 'rascunho' && <button type="button" className="central-admin-publish" onClick={() => void saveActivity('publicada')} disabled={saving}>{saving ? <Loader2 size={16} className="central-admin-spin"/> : <CheckCircle2 size={16}/>}Salvar e publicar</button>}
                {form.status === 'publicada' && editing && <button type="button" className="central-admin-primary" onClick={() => void saveActivity()} disabled={saving}>{saving ? <Loader2 size={16} className="central-admin-spin"/> : <Save size={16}/>}Salvar alterações</button>}
                {form.status === 'arquivada' && editing && <button type="button" className="central-admin-primary" onClick={() => void saveActivity()} disabled={saving}>{saving ? <Loader2 size={16} className="central-admin-spin"/> : <Save size={16}/>}Salvar alterações</button>}
                {!editing && form.status !== 'rascunho' && <button type="button" className="central-admin-primary" onClick={() => setEditing(true)}><Pencil size={16}/>Editar</button>}
              </div>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
