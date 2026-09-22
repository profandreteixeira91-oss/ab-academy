import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, Loader2, RotateCcw } from 'lucide-react'
import logo from '../assets/logo_abacademy.png'
import { supabase } from '../lib/supabase'
import '../styles/central-atividade.css'

type ExerciseType = 'multipla_escolha'|'multipla_resposta'|'verdadeiro_falso'|'dissertativa'|'resposta_curta'|'lacunas'|'ordenar'|'associar'
type Activity = {
  id:string; idioma:'ingles'|'alemao'; nivel:string; categoria:string; tipo_exercicio:ExerciseType
  titulo:string; descricao:string|null; instrucoes:string|null; conteudo:Content; explicacao:string|null
  dificuldade:number; tempo_estimado:number
}
type Content = {
  question?:string; text?:string; options?:{id:string;text:string}[]
  correctAnswer?:string; correctAnswers?:string[]; acceptableAnswers?:string[]
  sentences?:string[]; correctOrder?:string[]
  pairs?:{id:string;left:string;right:string}[]
  blanks?:{id:string;answer:string;acceptableAnswers?:string[]}[]
}
type Student={id:string;nome_completo:string}
type Result={correct:boolean;score:number;message:string}
const LANGUAGE_LABELS={ingles:'Inglês',alemao:'Alemão'}

function normalize(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase()}

function CentralAtividade(){
  const [user,setUser]=useState<User|null>(null)
  const [student,setStudent]=useState<Student|null>(null)
  const [activity,setActivity]=useState<Activity|null>(null)
  const [answers,setAnswers]=useState<Record<string,unknown>>({})
  const [loading,setLoading]=useState(true)
  const [submitting,setSubmitting]=useState(false)
  const [error,setError]=useState('')
  const [result,setResult]=useState<Result|null>(null)
  const activityId=useMemo(()=>window.location.pathname.split('/').filter(Boolean).pop()||'',[])

  useEffect(()=>{
    let mounted=true
    async function load(){
      const {data:{session}}=await supabase.auth.getSession()
      if(!mounted)return
      if(!session?.user){window.location.replace('/aluno');return}
      setUser(session.user)
      const {data:studentData,error:studentError}=await supabase.from('alunos').select('id,nome_completo').eq('user_id',session.user.id).maybeSingle()
      if(studentError||!studentData){setError('Não foi possível identificar o aluno.');setLoading(false);return}
      setStudent(studentData as Student)
      const {data:activityData,error:activityError}=await supabase.from('central_atividades').select('id,idioma,nivel,categoria,tipo_exercicio,titulo,descricao,instrucoes,conteudo,explicacao,dificuldade,tempo_estimado').eq('id',activityId).eq('status','publicada').maybeSingle()
      if(activityError||!activityData){setError('Atividade não encontrada ou indisponível.');setLoading(false);return}
      setActivity(activityData as Activity)
      const {data:responseData}=await supabase.from('central_respostas').select('respostas,pontuacao,concluida').eq('atividade_id',activityId).eq('aluno_id',studentData.id).maybeSingle()
      if(responseData?.respostas)setAnswers(responseData.respostas as Record<string,unknown>)
      if(responseData?.concluida&&typeof responseData.pontuacao==='number')setResult({correct:responseData.pontuacao>=100,score:responseData.pontuacao,message:responseData.pontuacao>=100?'Resposta correta!':'Atividade concluída. Revise a explicação.'})
      setLoading(false)
    }
    void load()
    return()=>{mounted=false}
  },[activityId])

  function isCorrect(){
    if(!activity)return false
    const c=activity.conteudo||{},a=answers.answer
    switch(activity.tipo_exercicio){
      case 'multipla_escolha':case 'verdadeiro_falso':return String(a||'')===String(c.correctAnswer||'')
      case 'multipla_resposta':{
        const expected=[...(c.correctAnswers||[])].map(String).sort(),actual=Array.isArray(a)?a.map(String).sort():[]
        return JSON.stringify(actual)===JSON.stringify(expected)
      }
      case 'resposta_curta':{
        const accepted=[c.correctAnswer||'',...(c.acceptableAnswers||[])].map(normalize)
        return accepted.includes(normalize(String(a||'')))
      }
      case 'lacunas':{
        const values=Array.isArray(a)?a.map(String):[]
        return (c.blanks||[]).every((b,i)=>[b.answer,...(b.acceptableAnswers||[])].map(normalize).includes(normalize(values[i]||'')))
      }
      case 'ordenar':return JSON.stringify(Array.isArray(a)?a:[])===JSON.stringify(c.correctOrder||[])
      case 'associar':{
        const pairs=(a&&typeof a==='object'&&!Array.isArray(a)?a:{}) as Record<string,string>
        return (c.pairs||[]).every(p=>pairs[p.id]===p.right)
      }
      default:return false
    }
  }

  async function submit(){
    if(!activity||!student||!user)return
    setSubmitting(true);setError('')
    const auto=['multipla_escolha','multipla_resposta','verdadeiro_falso','resposta_curta','lacunas','ordenar','associar'].includes(activity.tipo_exercicio)
    const correct=auto&&isCorrect(),score=auto?(correct?100:0):0
    const {error:saveError}=await supabase.from('central_respostas').upsert({atividade_id:activity.id,aluno_id:student.id,respostas:answers,pontuacao:score,concluida:true},{onConflict:'atividade_id,aluno_id'})
    if(saveError){console.error(saveError);setError('Não foi possível salvar sua resposta. Tente novamente.');setSubmitting(false);return}
    setResult({correct,score,message:auto?(correct?'Muito bem! Você acertou a atividade.':'Resposta registrada. Revise a explicação e tente novamente.'): 'Resposta registrada para análise.'})
    setSubmitting(false)
  }

  function toggleMultiple(id:string){
    const current=Array.isArray(answers.answer)?answers.answer as string[]:[]
    setAnswers({...answers,answer:current.includes(id)?current.filter(x=>x!==id):[...current,id]})
  }

  function moveOrder(index:number,direction:-1|1){
    if(!activity)return
    const current=Array.isArray(answers.answer)?[...(answers.answer as string[])]:[...(activity.conteudo.sentences||[])]
    const target=index+direction
    if(target<0||target>=current.length)return
    ;[current[index],current[target]]=[current[target],current[index]]
    setAnswers({...answers,answer:current})
  }

  function renderExercise(){
    if(!activity)return null
    const c=activity.conteudo||{}
    if(c.text)<div></div>
    if(activity.tipo_exercicio==='multipla_escolha'||activity.tipo_exercicio==='verdadeiro_falso')return <div className="central-options">{(c.options||[]).map(o=><label key={o.id} className={answers.answer===o.id?'central-option selected':'central-option'}><input type="radio" name="answer" checked={answers.answer===o.id} onChange={()=>setAnswers({...answers,answer:o.id})}/><span>{o.text}</span></label>)}</div>
    if(activity.tipo_exercicio==='multipla_resposta')return <div className="central-options">{(c.options||[]).map(o=>{const selected=Array.isArray(answers.answer)&&answers.answer.includes(o.id);return <label key={o.id} className={selected?'central-option selected':'central-option'}><input type="checkbox" checked={selected} onChange={()=>toggleMultiple(o.id)}/><span>{o.text}</span></label>})}</div>
    if(activity.tipo_exercicio==='resposta_curta')return <input className="central-answer-input" value={String(answers.answer||'')} onChange={e=>setAnswers({...answers,answer:e.target.value})} placeholder="Digite sua resposta..."/>
    if(activity.tipo_exercicio==='dissertativa')return <textarea className="central-answer-textarea" value={String(answers.answer||'')} onChange={e=>setAnswers({...answers,answer:e.target.value})} placeholder="Escreva sua resposta..." rows={7}/>
    if(activity.tipo_exercicio==='lacunas')return <div className="central-blanks">{(c.blanks||[]).map((b,i)=><input key={b.id} className="central-answer-input" value={Array.isArray(answers.answer)?String(answers.answer[i]||''):''} onChange={e=>{const v=Array.isArray(answers.answer)?[...(answers.answer as string[])]:[];v[i]=e.target.value;setAnswers({...answers,answer:v})}} placeholder={`Resposta ${i+1}`}/>)}</div>
    if(activity.tipo_exercicio==='ordenar'){const items=Array.isArray(answers.answer)?answers.answer as string[]:[...(c.sentences||[])];return <div className="central-order-list">{items.map((item,i)=><div key={item+i} className="central-order-item"><span>{i+1}</span><strong>{item}</strong><div><button type="button" onClick={()=>moveOrder(i,-1)} disabled={i===0}>↑</button><button type="button" onClick={()=>moveOrder(i,1)} disabled={i===items.length-1}>↓</button></div></div>)}</div>}
    if(activity.tipo_exercicio==='associar')return <div className="central-pairs">{(c.pairs||[]).map(p=><div key={p.id} className="central-pair"><span>{p.left}</span><select value={String((answers.pairs as Record<string,string>|undefined)?.[p.id]||'')} onChange={e=>setAnswers({...answers,pairs:{...(answers.pairs as Record<string,string>|undefined),[p.id]:e.target.value}})}><option value="">Selecione</option>{(c.pairs||[]).map(x=><option key={x.id} value={x.right}>{x.right}</option>)}</select></div>)}</div>
    return <div className="central-unsupported"><CircleHelp size={22}/>Este tipo de atividade ainda não está disponível.</div>
  }

  if(loading)return <div className="central-activity-loading"><Loader2 size={28} className="central-activity-spin"/><span>Carregando atividade...</span></div>
  if(!activity)return <div className="central-activity-page"><div className="central-activity-error"><CircleHelp size={22}/><strong>{error||'Atividade indisponível.'}</strong><a href="/aluno/central">Voltar para a Central</a></div></div>

  return <div className="central-activity-page">
    <header className="central-activity-header"><a href="/aluno/central" className="central-activity-back"><ArrowLeft size={18}/>Central de Atividades</a><img src={logo} alt="AB Academy"/></header>
    <main className="central-activity-main">
      <div className="central-activity-breadcrumb">{LANGUAGE_LABELS[activity.idioma]} · {activity.nivel} · {activity.categoria}</div>
      <section className="central-activity-card">
        <div className="central-activity-heading"><div><span>ATIVIDADE DE PRÁTICA</span><h1>{activity.titulo}</h1>{activity.descricao&&<p>{activity.descricao}</p>}</div><div className="central-activity-time">{activity.tempo_estimado} min · dificuldade {activity.dificuldade}/5</div></div>
        {activity.instrucoes&&<div className="central-instructions"><strong>Instruções</strong><p>{activity.instrucoes}</p></div>}
        {activity.conteudo.text&&<div className="central-exercise-text">{activity.conteudo.text}</div>}
        {activity.conteudo.question&&<div className="central-question">{activity.conteudo.question}</div>}
        {renderExercise()}
        {error&&<div className="central-form-error">{error}</div>}
        {result?<div className={result.correct?'central-result success':'central-result'}><div>{result.correct?<CheckCircle2 size={23}/>:<CircleHelp size={23}/>}<strong>{result.message}</strong></div><span>Resultado: {result.score}/100</span>{activity.explicacao&&<p>{activity.explicacao}</p>}<button type="button" onClick={()=>{setAnswers({});setResult(null)}}><RotateCcw size={17}/>Refazer</button></div>:<div className="central-activity-actions"><button type="button" className="central-secondary-button" onClick={()=>window.location.href='/aluno/central'}><ChevronLeft size={18}/>Voltar</button><button type="button" className="central-primary-button" onClick={()=>void submit()} disabled={submitting}>{submitting?<><Loader2 size={18} className="central-activity-spin"/>Salvando...</>:<>Concluir atividade <ChevronRight size={18}/></>}</button></div>}
      </section>
    </main>
  </div>
}
export default CentralAtividade
