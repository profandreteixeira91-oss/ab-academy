import { useEffect, useMemo, useState } from 'react'
import { BriefcaseBusiness, Check, ChevronRight, Download, ExternalLink, FileText, Search, UserRound, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import '../../styles/admin/Candidaturas.css'

type Status = 'recebida' | 'em_analise' | 'contatada' | 'aprovada' | 'arquivada'
type Candidatura = {
  id:string; nome:string; email:string; telefone:string|null; cidade:string|null; idiomas:string
  nivel:'fluente'|'avancado'|'nativo'; experiencia:string|null; linkedin_url:string; portfolio_url:string|null
  motivacao:string|null; curriculo_path:string|null; status:Status; created_at:string; updated_at:string
}
const statusLabels:Record<Status,string>={recebida:'Recebida',em_analise:'Em análise',contatada:'Contatada',aprovada:'Aprovada',arquivada:'Arquivada'}
const statusOptions:Array<{value:Status;label:string}>=[
 {value:'recebida',label:'Recebida'},{value:'em_analise',label:'Em análise'},{value:'contatada',label:'Contatada'},{value:'aprovada',label:'Aprovada'},{value:'arquivada',label:'Arquivada'}
]
function formatDate(value:string){return new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}
function levelLabel(level:Candidatura['nivel']){return level==='nativo'?'Nativo':level==='avancado'?'Avançado':'Fluente'}

export default function Candidaturas(){
 const [items,setItems]=useState<Candidatura[]>([]),[selected,setSelected]=useState<Candidatura|null>(null)
 const [search,setSearch]=useState(''),[filter,setFilter]=useState<'todos'|Status>('todos')
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[success,setSuccess]=useState(''),[openingResume,setOpeningResume]=useState(false)

 async function load(){
  try{setLoading(true);setError('')
   const {data,error:e}=await supabase.from('candidaturas_professores').select('id,nome,email,telefone,cidade,idiomas,nivel,experiencia,linkedin_url,portfolio_url,motivacao,curriculo_path,status,created_at,updated_at').order('created_at',{ascending:false})
   if(e)throw e;setItems((data??[]) as Candidatura[])
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar as candidaturas.')}finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[])

 async function changeStatus(item:Candidatura,status:Status){
  try{setError('');const {error:e}=await supabase.from('candidaturas_professores').update({status}).eq('id',item.id);if(e)throw e
   const updated={...item,status,updated_at:new Date().toISOString()};setItems(c=>c.map(i=>i.id===item.id?updated:i));setSelected(c=>c?.id===item.id?updated:c);setSuccess('Status da candidatura atualizado.')
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível atualizar o status.')}
 }
 async function openResume(item:Candidatura){
  if(!item.curriculo_path){setError('Esta candidatura não possui currículo anexado.');return}
  try{setOpeningResume(true);setError('');const {data,error:e}=await supabase.storage.from('curriculos-professores').createSignedUrl(item.curriculo_path,120);if(e)throw e;if(!data?.signedUrl)throw new Error('Não foi possível gerar o acesso ao currículo.');window.open(data.signedUrl,'_blank','noopener,noreferrer')}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível abrir o currículo.')}finally{setOpeningResume(false)}
 }
 const filtered=useMemo(()=>{const q=search.trim().toLowerCase();return items.filter(i=>(filter==='todos'||i.status===filter)&&(!q||[i.nome,i.email,i.cidade??'',i.idiomas,i.experiencia??''].join(' ').toLowerCase().includes(q)))},[items,search,filter])
 const counts=useMemo(()=>({recebidas:items.filter(i=>i.status==='recebida').length,analise:items.filter(i=>i.status==='em_analise').length,contatadas:items.filter(i=>i.status==='contatada').length,aprovadas:items.filter(i=>i.status==='aprovada').length}),[items])

 return <div className="candidaturas-page">
  <header className="candidaturas-header"><div><span className="candidaturas-eyebrow">RECRUTAMENTO</span><h2>Candidaturas</h2><p>Receba e acompanhe os profissionais interessados em fazer parte da AB Academy.</p></div></header>
  {error&&<div className="candidaturas-alert error">{error}<button type="button" onClick={()=>setError('')}><X size={15}/></button></div>}
  {success&&<div className="candidaturas-alert success">{success}<button type="button" onClick={()=>setSuccess('')}><Check size={15}/></button></div>}
  <section className="candidaturas-stats"><div><span>Novas</span><strong>{counts.recebidas}</strong></div><div><span>Em análise</span><strong>{counts.analise}</strong></div><div><span>Contatadas</span><strong>{counts.contatadas}</strong></div><div><span>Aprovadas</span><strong>{counts.aprovadas}</strong></div></section>
  <section className="candidaturas-layout">
   <div className="candidaturas-list-card">
    <div className="candidaturas-toolbar"><label><Search size={16}/><input placeholder="Buscar candidato..." value={search} onChange={e=>setSearch(e.target.value)}/></label><select value={filter} onChange={e=>setFilter(e.target.value as 'todos'|Status)}><option value="todos">Todos os status</option>{statusOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
    {loading?<div className="candidaturas-empty">Carregando candidaturas...</div>:filtered.length===0?<div className="candidaturas-empty"><BriefcaseBusiness size={30}/><h3>Nenhuma candidatura encontrada</h3><p>As candidaturas enviadas pela página Trabalhe conosco aparecerão aqui.</p></div>:<div className="candidaturas-list">{filtered.map(item=><button type="button" className={'candidatura-item'+(selected?.id===item.id?' active':'')} key={item.id} onClick={()=>setSelected(item)}><span className="candidatura-avatar"><UserRound size={18}/></span><span className="candidatura-item-main"><strong>{item.nome}</strong><small>{item.idiomas} · {item.cidade||'Localização não informada'}</small><small>{formatDate(item.created_at)}</small></span><span className={'candidatura-status '+item.status}>{statusLabels[item.status]}</span><ChevronRight size={16} className="candidatura-item-arrow"/></button>)}</div>}
   </div>
   <div className="candidaturas-detail-card">
    {!selected?<div className="candidaturas-empty"><FileText size={34}/><h3>Selecione uma candidatura</h3><p>Os dados profissionais e o currículo serão exibidos aqui.</p></div>:<>
     <header className="candidatura-detail-header"><div><span className="candidaturas-eyebrow">CANDIDATO</span><h3>{selected.nome}</h3><p>{selected.email}{selected.telefone?' · '+selected.telefone:''}</p></div><button type="button" className="candidatura-close" onClick={()=>setSelected(null)} aria-label="Fechar candidatura"><X size={18}/></button></header>
     <div className="candidatura-detail-body">
      <div className="candidatura-detail-grid"><div><span>Localização</span><strong>{selected.cidade||'Não informado'}</strong></div><div><span>Idiomas</span><strong>{selected.idiomas}</strong></div><div><span>Proficiência</span><strong>{levelLabel(selected.nivel)}</strong></div><div><span>Recebida em</span><strong>{formatDate(selected.created_at)}</strong></div></div>
      <section className="candidatura-section"><h4>Experiência</h4><p>{selected.experiencia||'Não informado.'}</p></section>
      <section className="candidatura-section"><h4>Motivação</h4><p>{selected.motivacao||'Não informado.'}</p></section>
      <section className="candidatura-links"><a href={selected.linkedin_url} target="_blank" rel="noreferrer">LinkedIn <ExternalLink size={14}/></a>{selected.portfolio_url&&<a href={selected.portfolio_url} target="_blank" rel="noreferrer">Portfólio <ExternalLink size={14}/></a>}<button type="button" onClick={()=>void openResume(selected)} disabled={!selected.curriculo_path||openingResume}><Download size={14}/>{openingResume?'Abrindo...':'Abrir currículo'}</button></section>
      <section className="candidatura-status-section"><span>Status da candidatura</span><div>{statusOptions.map(o=><button key={o.value} type="button" className={selected.status===o.value?'selected':''} onClick={()=>void changeStatus(selected,o.value)}>{o.label}</button>)}</div></section>
     </div>
    </>}
   </div>
  </section>
 </div>
}
