import { useEffect, useMemo, useState } from 'react'
import { Archive, CheckCircle2, Filter, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Activity = {
  id:string; idioma:'ingles'|'alemao'; nivel:string; categoria:string; titulo:string
  status:'rascunho'|'publicada'|'arquivada'; origem:'manual'|'ia'; dificuldade:number
  tempo_estimado:number; mes_referencia:string|null; created_at:string
}

const LEVELS=[['iniciante','Iniciante'],['basico','Básico'],['intermediario','Intermediário'],['avancado','Avançado'],['fluente','Fluente']]
const CATEGORIES=[['todas','Todas'],['vocabulario','Vocabulário'],['gramatica','Gramática'],['leitura','Leitura'],['compreensao','Compreensão'],['escrita','Escrita'],['cotidiano','Cotidiano'],['revisao','Revisão']]

export default function CentralAtividadesAdmin(){
  const [activities,setActivities]=useState<Activity[]>([])
  const [loading,setLoading]=useState(true)
  const [actionLoading,setActionLoading]=useState<string|null>(null)
  const [language,setLanguage]=useState('todos')
  const [level,setLevel]=useState('todos')
  const [category,setCategory]=useState('todas')
  const [status,setStatus]=useState('todos')
  const [search,setSearch]=useState('')

  async function load(){
    setLoading(true)
    let query=supabase.from('central_atividades').select('id,idioma,nivel,categoria,titulo,status,origem,dificuldade,tempo_estimado,mes_referencia,created_at').order('created_at',{ascending:false})
    if(language!=='todos')query=query.eq('idioma',language)
    if(level!=='todos')query=query.eq('nivel',level)
    if(category!=='todas')query=query.eq('categoria',category)
    if(status!=='todos')query=query.eq('status',status)
    const {data,error}=await query
    if(error){console.error(error);setActivities([])}else setActivities((data||[]) as Activity[])
    setLoading(false)
  }

  useEffect(()=>{void load()},[language,level,category,status])

  const filtered=useMemo(()=>{
    const term=search.trim().toLocaleLowerCase()
    if(!term)return activities
    return activities.filter(a=>a.titulo.toLocaleLowerCase().includes(term))
  },[activities,search])

  const totals=useMemo(()=>({
    total:activities.length,
    published:activities.filter(a=>a.status==='publicada').length,
    drafts:activities.filter(a=>a.status==='rascunho').length,
    ai:activities.filter(a=>a.origem==='ia').length,
  }),[activities])

  async function changeStatus(id:string,next:'publicada'|'arquivada'){
    setActionLoading(id)
    const {error}=await supabase.from('central_atividades').update({status:next}).eq('id',id)
    if(error)console.error(error)
    await load()
    setActionLoading(null)
  }

  return <div className="central-admin-page">
    <div className="central-admin-intro">
      <div>
        <div className="central-admin-kicker"><Sparkles size={15}/> CENTRAL DE ATIVIDADES</div>
        <h2>Biblioteca de prática</h2>
        <p>Gerencie atividades por idioma, nível, categoria e ciclo de conteúdo.</p>
      </div>
      <button type="button" className="central-admin-refresh" onClick={()=>void load()} disabled={loading}><RefreshCw size={17}/>Atualizar</button>
    </div>

    <div className="central-admin-stats">
      <div><span>Total</span><strong>{totals.total}</strong></div>
      <div><span>Publicadas</span><strong>{totals.published}</strong></div>
      <div><span>Rascunhos</span><strong>{totals.drafts}</strong></div>
      <div><span>Geradas por IA</span><strong>{totals.ai}</strong></div>
    </div>

    <div className="central-admin-goals">
      <div><strong>Meta da biblioteca</strong><span>100 atividades para cada combinação de idioma + nível.</span></div>
      <div className="central-admin-goal-grid">{LEVELS.map(([value,label])=><div key={value}><span>{label}</span><strong>{activities.filter(a=>a.nivel===value&&a.status==='publicada').length}/100</strong></div>)}</div>
    </div>

    <div className="central-admin-filters">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar atividade..." />
      <select value={language} onChange={e=>setLanguage(e.target.value)}><option value="todos">Todos os idiomas</option><option value="ingles">Inglês</option><option value="alemao">Alemão</option></select>
      <select value={level} onChange={e=>setLevel(e.target.value)}><option value="todos">Todos os níveis</option>{LEVELS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
      <select value={category} onChange={e=>setCategory(e.target.value)}>{CATEGORIES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
      <select value={status} onChange={e=>setStatus(e.target.value)}><option value="todos">Todos os status</option><option value="rascunho">Rascunhos</option><option value="publicada">Publicadas</option><option value="arquivada">Arquivadas</option></select>
    </div>

    <div className="central-admin-list">
      <div className="central-admin-list-head"><span>{filtered.length} atividade(s)</span><span><Filter size={15}/>Filtros aplicados</span></div>
      {loading?<div className="central-admin-empty"><Loader2 size={25} className="central-admin-spin"/>Carregando biblioteca...</div>:filtered.length===0?<div className="central-admin-empty"><Sparkles size={25}/><strong>Nenhuma atividade encontrada</strong><span>As atividades geradas pela IA aparecerão aqui como rascunhos.</span></div>:filtered.map(a=><article key={a.id} className="central-admin-row">
        <div className="central-admin-row-main">
          <div className="central-admin-tags"><span>{a.idioma==='ingles'?'Inglês':'Alemão'}</span><span>{LEVELS.find(x=>x[0]===a.nivel)?.[1]||a.nivel}</span><span>{a.categoria}</span><span className={'central-admin-status '+a.status}>{a.status}</span></div>
          <h3>{a.titulo}</h3>
          <p>{a.origem==='ia'?'Gerada por IA':'Criada manualmente'} · dificuldade {a.dificuldade}/5 · {a.tempo_estimado} min</p>
        </div>
        <div className="central-admin-row-actions">
          {a.status==='rascunho'&&<button type="button" onClick={()=>void changeStatus(a.id,'publicada')} disabled={actionLoading===a.id}>{actionLoading===a.id?<Loader2 size={16} className="central-admin-spin"/>:<CheckCircle2 size={16}/>}Publicar</button>}
          {a.status==='publicada'&&<button type="button" onClick={()=>void changeStatus(a.id,'arquivada')} disabled={actionLoading===a.id}>{actionLoading===a.id?<Loader2 size={16} className="central-admin-spin"/>:<Archive size={16}/>}Arquivar</button>}
        </div>
      </article>)}
    </div>
  </div>
}
