import { useEffect, useMemo, useState } from 'react'
import { Archive, CheckCircle2, Eye, Filter, Loader2, Pencil, RefreshCw, Save, Sparkles, X } from 'lucide-react'
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
        <button type="button" className="central-admin-refresh" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={17}/>Atualizar
        </button>
      </div>

      <div className="central-admin-stats">
        <div><span>Total</span><strong>{totals.total}</strong></div>
        <div><span>Publicadas</span><strong>{totals.published}</strong></div>
        <div><span>Rascunhos</span><strong>{totals.drafts}</strong></div>
        <div><span>Geradas por IA</span><strong>{totals.ai}</strong></div>
      </div>

      <div className="central-admin-goals">
        <div><strong>Meta da biblioteca</strong><span>100 atividades para cada combinação de idioma + nível.</span></div>
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
        <div className="central-admin-list-head"><span>{filtered.length} atividade(s)</span><span><Filter size={15}/> Filtros aplicados</span></div>
        {loading ? (
          <div className="central-admin-empty"><Loader2 size={25} className="central-admin-spin"/>Carregando biblioteca...</div>
        ) : filtered.length === 0 ? (
          <div className="central-admin-empty"><Sparkles size={25}/><strong>Nenhuma atividade encontrada</strong><span>As atividades geradas pela IA aparecerão aqui como rascunhos.</span></div>
        ) : filtered.map(a => (
          <article key={a.id} className="central-admin-row">
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
