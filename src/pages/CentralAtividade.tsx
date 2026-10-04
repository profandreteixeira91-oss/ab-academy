import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, Clock3, Loader2, Menu, RotateCcw } from 'lucide-react'
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
  pergunta?:string; afirmacao?:string
  alternativas?:{id:string;text?:string;texto?:string}[]
  correta?:string|boolean; corretas?:string[]
  resposta_correta?:string
  lacunas?:{resposta:string;id?:string;acceptableAnswers?:string[]}[]
  itens?:string[]; ordem_correta?:number[]
  esquerda?:{id:string;texto?:string;text?:string}[]
  direita?:{id:string;texto?:string;text?:string}[]
}
type Student={id:string;nome_completo:string}
type Result={correct:boolean;score:number;message:string}
type ActivityDraft={answers:Record<string,unknown>;savedAt:number}
const LANGUAGE_LABELS={ingles:'Inglês',alemao:'Alemão'}
const EXERCISE_TYPE_LABELS:Record<ExerciseType,string>={multipla_escolha:'Múltipla escolha',multipla_resposta:'Múltiplas respostas',verdadeiro_falso:'Verdadeiro ou falso',dissertativa:'Dissertativa',resposta_curta:'Resposta curta',lacunas:'Complete as lacunas',ordenar:'Ordenar',associar:'Associar'}

function normalize(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase()}

function normalizeContent(raw: Record<string, unknown>): Content {
  const c = raw as Content
  const options = c.options?.length
    ? c.options
    : (c.alternativas || []).map(option => ({
        id: option.id,
        text: option.text ?? option.texto ?? '',
      }))

  return {
    ...c,
    question: c.question || c.pergunta,
    options,
    correctAnswer: c.correctAnswer ?? (c.correta !== undefined ? String(c.correta) : undefined),
    correctAnswers: c.correctAnswers || c.corretas,
    acceptableAnswers: c.acceptableAnswers || (c.resposta_correta ? [c.resposta_correta] : undefined),
    sentences: c.sentences || c.itens,
    correctOrder: c.correctOrder || c.ordem_correta?.map(String),
    blanks: c.blanks || c.lacunas?.map((blank, index) => ({
      id: blank.id || String(index),
      answer: blank.answer || blank.resposta,
      acceptableAnswers: blank.acceptableAnswers,
    })),
  }
}

function removeLocalDraftIfSaved(draftKey:string,savedAnswers:Record<string,unknown>){
  try{
    const rawDraft=window.localStorage.getItem(draftKey)
    if(!rawDraft)return
    const parsed=JSON.parse(rawDraft) as ActivityDraft|Record<string,unknown>
    const latestAnswers='answers' in parsed&&typeof parsed.savedAt==='number'
      ? parsed.answers
      : parsed
    if(JSON.stringify(latestAnswers)===JSON.stringify(savedAnswers)){
      window.localStorage.removeItem(draftKey)
    }
  }catch(error){console.error('Central draft cleanup:',error)}
}

function clearLocalDraft(draftKey:string){
  try{
    window.localStorage.removeItem(draftKey)
  }catch(error){console.error('Central draft cleanup:',error)}
}

function CentralAtividade(){
  const [user,setUser]=useState<User|null>(null)
  const [student,setStudent]=useState<Student|null>(null)
  const [activity,setActivity]=useState<Activity|null>(null)
  const [answers,setAnswers]=useState<Record<string,unknown>>({})
  const [loading,setLoading]=useState(true)
  const [submitting,setSubmitting]=useState(false)
  const [error,setError]=useState('')
  const [result,setResult]=useState<Result|null>(null)
  const [saveState,setSaveState]=useState<'idle'|'saving'|'saved'|'error'>('idle')
  const [elapsedSeconds,setElapsedSeconds]=useState(0)
  const [startedAt,setStartedAt]=useState<number|null>(null)
  const [translation,setTranslation]=useState<Content|null>(null)
  const [translating,setTranslating]=useState(false)
  const [translationError,setTranslationError]=useState('')
  const [showInstructions,setShowInstructions]=useState(false)
  const [nextActivity,setNextActivity]=useState<{id:string;titulo:string}|null>(null)
  const [activityNumber,setActivityNumber]=useState<number|null>(null)
  const [activityTotal,setActivityTotal]=useState<number|null>(null)
  const [studentFirstName,setStudentFirstName]=useState('Aluno')
  const answersLoadedRef=useRef(false)
  const answersRef=useRef<Record<string,unknown>>({})
  const submittingRef=useRef(false)
  const saveTimerRef=useRef<number|null>(null)
  const remoteSaveQueueRef=useRef<Promise<void>>(Promise.resolve())
  const activityId=useMemo(()=>window.location.pathname.split('/').filter(Boolean).pop()||'',[])

  const persistLocalDraft=useCallback((nextAnswers:Record<string,unknown>)=>{
    if(!activityId)return
    try{
      const draft:ActivityDraft={answers:nextAnswers,savedAt:Date.now()}
      window.localStorage.setItem(`ab-academy-activity-draft-${activityId}`,JSON.stringify(draft))
    }catch(error){console.error('Central draft local save:',error)}
  },[activityId])

  const persistRemoteDraft=useCallback((nextAnswers:Record<string,unknown>)=>{
    if(!answersLoadedRef.current||!activity||!student||!user||result||submittingRef.current)return
    const currentActivity=activity
    const currentStudent=student
    const draftKey=`ab-academy-activity-draft-${currentActivity.id}`
    setSaveState('saving')
    remoteSaveQueueRef.current=remoteSaveQueueRef.current.catch(()=>undefined).then(async()=>{
      const {error:saveError}=await supabase.from('central_respostas').upsert({
        atividade_id:currentActivity.id,
        aluno_id:currentStudent.id,
        respostas:nextAnswers,
        pontuacao:null,
        concluida:false,
      },{onConflict:'atividade_id,aluno_id'})
      if(saveError){
        console.error('Central progresso save:',saveError)
        setSaveState('error')
        return
      }
      removeLocalDraftIfSaved(draftKey,nextAnswers)
      setSaveState('saved')
    }).catch(saveError=>{
      console.error('Central progresso save:',saveError)
      setSaveState('error')
    })
  },[activity,student,user,result])

  function scheduleRemoteSave(nextAnswers:Record<string,unknown>,immediate=false){
    if(!answersLoadedRef.current||!activity||!student||!user||result||submittingRef.current)return
    if(saveTimerRef.current!==null){
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current=null
    }
    if(immediate){
      persistRemoteDraft(nextAnswers)
      return
    }
    setSaveState('saving')
    saveTimerRef.current=window.setTimeout(()=>{
      saveTimerRef.current=null
      persistRemoteDraft(nextAnswers)
    },500)
  }

  function updateAnswers(nextAnswers:Record<string,unknown>|((current:Record<string,unknown>)=>Record<string,unknown>),immediate=false){
    if(submittingRef.current)return
    const resolved=typeof nextAnswers==='function'?nextAnswers(answersRef.current):nextAnswers
    answersRef.current=resolved
    setAnswers(resolved)
    if(answersLoadedRef.current&&!result){
      persistLocalDraft(resolved)
      scheduleRemoteSave(resolved,immediate)
    }
  }

  useEffect(()=>{
    let mounted=true
    async function load(){
      try{
        const {data:{session},error:sessionError}=await supabase.auth.getSession()
        if(sessionError)throw sessionError
        if(!mounted)return
        if(!session?.user){window.location.replace('/aluno');return}
        setUser(session.user)

        const {data:studentData,error:studentError}=await supabase.from('alunos').select('id,nome_completo').eq('user_id',session.user.id).maybeSingle()
        if(studentError)throw studentError
        if(!studentData){setError('Não foi possível identificar o aluno.');return}
        const currentStudent=studentData as Student

        const {data:activityData,error:activityError}=await supabase.from('central_atividades').select('id,idioma,nivel,categoria,tipo_exercicio,titulo,descricao,instrucoes,conteudo,explicacao,dificuldade,tempo_estimado').eq('id',activityId).eq('status','publicada').maybeSingle()
        if(activityError)throw activityError
        if(!activityData){setError('Atividade não encontrada ou indisponível.');return}
        const currentActivity={...(activityData as Activity),conteudo:normalizeContent((activityData as Activity).conteudo||{})}

        const [{data:sequence,error:sequenceError},{data:completedResponses,error:completedError}]=await Promise.all([
          supabase.from('central_atividades').select('id,titulo,created_at').eq('idioma',currentActivity.idioma).eq('nivel',currentActivity.nivel).eq('status','publicada').order('created_at',{ascending:true}).order('id',{ascending:true}),
          supabase.from('central_respostas').select('atividade_id').eq('aluno_id',currentStudent.id).eq('concluida',true),
        ])
        if(sequenceError){
          console.error('Central activity sequence load:',sequenceError)
          setError('Não foi possível carregar a sequência completa de atividades.')
        }
        if(completedError){
          console.error('Central completed activities load:',completedError)
          setError('Não foi possível carregar seu progresso completo.')
        }

        const {data:responseData,error:responseError}=await supabase.from('central_respostas').select('respostas,pontuacao,concluida,updated_at').eq('atividade_id',activityId).eq('aluno_id',currentStudent.id).maybeSingle()
        if(responseError)throw responseError
        if(!mounted)return

        const completedIds=new Set((completedResponses||[]).map(response=>response.atividade_id))
        if(!completedError)setActivityNumber(completedIds.size)
        if(!sequenceError)setActivityTotal((sequence||[]).length)
        const availableSequence=(sequence||[]).filter(item=>!completedIds.has(item.id))
        const sequenceIndex=availableSequence.findIndex(item=>item.id===currentActivity.id)
        if(sequenceIndex>=0&&availableSequence[sequenceIndex+1]){
          setNextActivity({id:availableSequence[sequenceIndex+1].id,titulo:availableSequence[sequenceIndex+1].titulo})
        }

        const draftKey=`ab-academy-activity-draft-${activityId}`
        let localDraft:ActivityDraft|null=null
        try{
          const rawLocalDraft=window.localStorage.getItem(draftKey)
          if(rawLocalDraft){
            const parsed=JSON.parse(rawLocalDraft) as ActivityDraft|Record<string,unknown>
            localDraft=parsed&&typeof parsed==='object'&&'answers' in parsed&&typeof parsed.savedAt==='number'
              ? parsed as ActivityDraft
              : {answers:parsed as Record<string,unknown>,savedAt:0}
          }
        }catch(storageError){
          console.error('Central draft read:',storageError)
        }

        let start=Date.now()
        try{
          const storedStart=window.sessionStorage.getItem(`ab-academy-activity-start-${activityId}`)
          const parsedStart=Number(storedStart)
          if(storedStart&&Number.isFinite(parsedStart)&&parsedStart>0){
            start=parsedStart
          }else{
            window.sessionStorage.setItem(`ab-academy-activity-start-${activityId}`,String(start))
          }
        }catch(storageError){
          console.error('Central activity timer restore:',storageError)
        }

        setStudent(currentStudent)
        setStudentFirstName(currentStudent.nome_completo?.trim().split(/\s+/)[0]||'Aluno')
        setActivity(currentActivity)
        setStartedAt(start)
        setElapsedSeconds(Math.max(0,Math.floor((Date.now()-start)/1000)))
        if(responseData?.concluida){
          clearLocalDraft(draftKey)
          if(responseData.respostas)setAnswers(responseData.respostas as Record<string,unknown>)
        }else if(localDraft&&(localDraft.savedAt>=new Date(responseData?.updated_at||0).getTime())){
          setAnswers(localDraft.answers)
        }else if(responseData?.respostas){
          setAnswers(responseData.respostas as Record<string,unknown>)
        }else if(localDraft){
          setAnswers(localDraft.answers)
        }
        answersLoadedRef.current=true
        if(responseData?.concluida){
          const score=typeof responseData.pontuacao==='number'?responseData.pontuacao:0
          setResult({correct:score>=100,score,message:score>=100?'Resposta correta!':'Atividade concluída. Revise a explicação.'})
        }
      }catch(loadError){
        console.error('Central activity load:',loadError)
        if(mounted)setError('Não foi possível carregar a atividade. Verifique sua conexão e tente novamente.')
      }finally{
        if(mounted)setLoading(false)
      }
    }
    void load()
    return()=>{mounted=false}
  },[activityId])

  useEffect(()=>{
    answersRef.current=answers
  },[answers])

  useEffect(()=>{
    if(!activity||!student||!user||result)return
    const flushPendingRemoteSave=()=>{
      if(saveTimerRef.current===null)return
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current=null
      persistRemoteDraft(answersRef.current)
    }
    const handlePageExit=()=>{
      persistLocalDraft(answersRef.current)
      flushPendingRemoteSave()
    }
    const handleVisibilityChange=()=>{
      if(document.visibilityState==='hidden')handlePageExit()
    }
    window.addEventListener('pagehide',handlePageExit)
    window.addEventListener('beforeunload',handlePageExit)
    document.addEventListener('visibilitychange',handleVisibilityChange)
    return()=>{
      window.removeEventListener('pagehide',handlePageExit)
      window.removeEventListener('beforeunload',handlePageExit)
      document.removeEventListener('visibilitychange',handleVisibilityChange)
      flushPendingRemoteSave()
    }
  },[activity,student,user,result,persistLocalDraft,persistRemoteDraft])
  useEffect(()=>{
    if(!startedAt||result)return
    const tick=window.setInterval(()=>{
      setElapsedSeconds(Math.max(0,Math.floor((Date.now()-startedAt)/1000)))
    },1000)
    return()=>window.clearInterval(tick)
  },[startedAt,result])

  function formatTime(total:number){
    const minutes=Math.floor(total/60).toString().padStart(2,'0')
    const seconds=(total%60).toString().padStart(2,'0')
    return `${minutes}:${seconds}`
  }

  function hasAnswer(){
    const a=answers.answer
    if(Array.isArray(a)) return a.some(value=>String(value||'').trim()!=='')
    if(String(a??'').trim()!=='')return true
    if(answers.pairs&&typeof answers.pairs==='object')return Object.values(answers.pairs as Record<string,string>).some(value=>String(value||'').trim()!=='')
    return false
  }

  async function translateActivity(){
    if(!activity||!user)return
    if(translation){setTranslation(null);return}
    setTranslating(true);setTranslationError('')
    try{
      const {data:{session},error:sessionError}=await supabase.auth.getSession()
      if(sessionError)throw sessionError
      if(!session){
        setTranslationError('Sua sessão expirou.')
        return
      }
      const {data,error:translationInvokeError}=await supabase.functions.invoke('traduzir-central-atividade',{
        body:{idioma:activity.idioma,content:activity.conteudo,target:'pt'},
        headers:{Authorization:'Bearer '+session.access_token},
      })
      if(translationInvokeError)throw translationInvokeError
      if(!data?.translation)throw new Error('A tradução não retornou conteúdo.')
      setTranslation(normalizeContent(data.translation as Record<string,unknown>))
    }catch(translationError){
      console.error('Central activity translation:',translationError)
      setTranslationError('Não foi possível traduzir agora. Tente novamente.')
    }finally{
      setTranslating(false)
    }
  }
  function isCorrect(answerSet=answers){
    if(!activity)return false
    const c=activity.conteudo||{},a=answerSet.answer
    switch(activity.tipo_exercicio){
      case 'multipla_escolha':return String(a||'')===String(c.correctAnswer||'')
      case 'verdadeiro_falso':{
        const expected = typeof c.correta === 'boolean' ? String(c.correta) : String(c.correctAnswer || '')
        return String(a||'') === expected
      }
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
    if(!activity||!student||!user||submittingRef.current)return
    submittingRef.current=true
    const submittedAnswers=answersRef.current
    setSubmitting(true);setError('');setSaveState('saving')
    try {
    if(saveTimerRef.current!==null){
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current=null
    }
    await remoteSaveQueueRef.current.catch(()=>undefined)
    const auto=['multipla_escolha','multipla_resposta','verdadeiro_falso','resposta_curta','lacunas','ordenar','associar'].includes(activity.tipo_exercicio)
    const correct=auto&&isCorrect(submittedAnswers),score=auto?(correct?100:0):0
    const payload={atividade_id:activity.id,aluno_id:student.id,respostas:submittedAnswers,pontuacao:score,concluida:true}
    const {data:existingResponse,error:lookupError}=await supabase
      .from('central_respostas')
      .select('id')
      .eq('atividade_id',activity.id)
      .eq('aluno_id',student.id)
      .maybeSingle()
    if(lookupError){console.error('Central resposta lookup:',lookupError);setError(`Não foi possível verificar sua resposta. ${lookupError.message||''}`.trim());setSubmitting(false);return}
    let saveError:null|{message:string}=null
    if(existingResponse?.id){
      const {error:updateError}=await supabase.from('central_respostas').update(payload).eq('id',existingResponse.id)
      saveError=updateError
    }else{
      const {error:insertError}=await supabase.from('central_respostas').insert(payload)
      saveError=insertError
    }
    if(saveError){console.error('Central resposta save:',saveError);setError(`Não foi possível salvar sua resposta. ${saveError.message||''}`.trim());setSubmitting(false);return}
    clearLocalDraft(`ab-academy-activity-draft-${activity.id}`)
    setResult({correct,score,message:auto?(correct?'Muito bem! Você acertou a atividade.':'Resposta registrada. Revise a explicação e tente novamente.'): 'Resposta registrada para análise.'})
    setSaveState('saved')
    } catch (e) {
      console.error(e)
      setError('Não foi possível salvar sua resposta. Tente novamente.')
      setSaveState('idle')
    } finally {
      setSubmitting(false)
      submittingRef.current=false
    }
  }

  function goNext(){window.location.href=nextActivity?`/aluno/central/atividade/${nextActivity.id}`:'/aluno/central'}
  function toggleMultiple(id:string){
    updateAnswers(currentAnswers=>{
      const current=Array.isArray(currentAnswers.answer)?currentAnswers.answer as string[]:[]
      return {...currentAnswers,answer:current.includes(id)?current.filter(x=>x!==id):[...current,id]}
    })
  }

  function moveOrder(index:number,direction:-1|1){
    if(!activity)return
    const current=Array.isArray(answersRef.current.answer)?[...(answersRef.current.answer as string[])]:[...(activity.conteudo.sentences||[])]
    const target=index+direction
    if(target<0||target>=current.length)return
    ;[current[index],current[target]]=[current[target],current[index]]
    updateAnswers(currentAnswers=>({...currentAnswers,answer:current}))
  }

  function renderExercise(contentOverride?:Content){
    const renderContent=contentOverride||activity?.conteudo
    if(!activity||!renderContent)return null
    const c=renderContent

    if(activity.tipo_exercicio==='multipla_escolha'||activity.tipo_exercicio==='verdadeiro_falso'){
      const options = activity.tipo_exercicio === 'verdadeiro_falso' && !(c.options||[]).length
        ? [{id:'true',text:'Verdadeiro'},{id:'false',text:'Falso'}]
        : (c.options||[])
      return <div className="central-options">{options.map(o=><label key={o.id} className={answers.answer===o.id?'central-option selected':'central-option'}><input type="radio" name="answer" checked={answers.answer===o.id} disabled={submitting} onChange={()=>updateAnswers(currentAnswers=>({...currentAnswers,answer:o.id}),true)}/><span>{o.text}</span></label>)}</div>
    }
    if(activity.tipo_exercicio==='multipla_resposta')return <div className="central-options">{(c.options||[]).map(o=>{const selected=Array.isArray(answers.answer)&&answers.answer.includes(o.id);return <label key={o.id} className={selected?'central-option selected':'central-option'}><input type="checkbox" checked={selected} disabled={submitting} onChange={()=>toggleMultiple(o.id)}/><span>{o.text}</span></label>})}</div>
    if(activity.tipo_exercicio==='resposta_curta')return <input className="central-answer-input" value={String(answers.answer||'')} disabled={submitting} onChange={e=>updateAnswers(currentAnswers=>({...currentAnswers,answer:e.target.value}))} onBlur={()=>scheduleRemoteSave(answersRef.current,true)} placeholder="Digite sua resposta..."/>
    if(activity.tipo_exercicio==='dissertativa')return <textarea className="central-answer-textarea" value={String(answers.answer||'')} disabled={submitting} onChange={e=>updateAnswers(currentAnswers=>({...currentAnswers,answer:e.target.value}))} onBlur={()=>scheduleRemoteSave(answersRef.current,true)} placeholder="Escreva sua resposta..." rows={7}/>
    if(activity.tipo_exercicio==='lacunas')return <div className="central-blanks">{(c.blanks||[]).map((b,i)=><input key={b.id} className="central-answer-input" disabled={submitting} value={Array.isArray(answers.answer)?String(answers.answer[i]||''):''} onChange={e=>{const v=Array.isArray(answersRef.current.answer)?[...(answersRef.current.answer as string[])]:[];v[i]=e.target.value;updateAnswers(currentAnswers=>({...currentAnswers,answer:v}))}} placeholder={`Resposta ${i+1}`}/>)}</div>
    if(activity.tipo_exercicio==='ordenar'){const items=Array.isArray(answers.answer)?answers.answer as string[]:[...(c.sentences||[])];return <div className="central-order-list">{items.map((item,i)=><div key={item+i} className="central-order-item"><span>{i+1}</span><strong>{item}</strong><div><button type="button" onClick={()=>moveOrder(i,-1)} disabled={submitting||i===0}>↑</button><button type="button" onClick={()=>moveOrder(i,1)} disabled={submitting||i===items.length-1}>↓</button></div></div>)}</div>}
    if(activity.tipo_exercicio==='associar')return <div className="central-pairs">{(c.pairs||[]).map(p=><div key={p.id} className="central-pair"><span>{p.left}</span><select value={String((answers.pairs as Record<string,string>|undefined)?.[p.id]||'')} disabled={submitting} onChange={e=>updateAnswers(currentAnswers=>({...currentAnswers,pairs:{...(currentAnswers.pairs as Record<string,string>|undefined),[p.id]:e.target.value}}),true)}><option value="">Selecione</option>{(c.pairs||[]).map(x=><option key={x.id} value={x.right}>{x.right}</option>)}</select></div>)}</div>
    return <div className="central-unsupported"><CircleHelp size={22}/>Este tipo de atividade ainda não está disponível.</div>
  }

  if(loading)return <div className="central-activity-loading"><Loader2 size={28} className="central-activity-spin"/><span>Carregando atividade...</span></div>
  if(!activity)return <div className="central-activity-page"><div className="central-activity-error"><CircleHelp size={22}/><strong>{error||'Atividade indisponível.'}</strong><a href="/aluno/central">Voltar para a Central</a></div></div>

  return <div className="central-activity-page">
    <header className="central-activity-header">
      <div className="central-activity-header-inner">
        <div className="central-mobile-header-left">
          <a href="/aluno" className="central-mobile-menu" aria-label="Abrir menu">
            <Menu size={22}/>
          </a>
          <div className="central-mobile-header-text">
            <span>PORTAL DO ALUNO</span>
            <strong>Olá, {studentFirstName}!</strong>
          </div>
        </div>
        <a href="/aluno/central" className="central-activity-back"><ArrowLeft size={18}/><span>Central de Atividades</span></a>
        <img src={logo} alt="AB Academy"/>
        <div className="central-header-progress">{activityNumber!==null&&activityTotal!==null?<><strong>{activityNumber}</strong><span>/ {activityTotal}</span></>:<span>Prática</span>}</div>
      </div>
    </header>
    <main className="central-activity-main">
      <div className="central-activity-breadcrumb">
        <a href="/aluno/central">Central</a><span>›</span><span>{LANGUAGE_LABELS[activity.idioma]}</span><span>›</span><span>{activity.nivel}</span>
      </div>
      <div className="central-activity-shell">
        <aside className="central-activity-sidebar">
          <div className="central-side-brand"><div className="central-side-icon"><CircleHelp size={20}/></div><div><strong>Prática</strong><span>AB Academy</span></div></div>
          <div className="central-side-divider"/>
          <div className="central-side-item"><span>Idioma</span><strong>{LANGUAGE_LABELS[activity.idioma]}</strong></div>
          <div className="central-side-item"><span>Nível</span><strong>{activity.nivel}</strong></div>
          <div className="central-side-item"><span>Categoria</span><strong>{activity.categoria}</strong></div>
          <div className="central-side-item"><span>Tempo estimado</span><strong>{activity.tempo_estimado} min</strong></div>
          <div className="central-side-item"><span>Dificuldade</span><strong>{activity.dificuldade}/5</strong></div>
          <a href="/aluno/central" className="central-side-back"><ArrowLeft size={16}/>Voltar para a Central</a>
        </aside>

        <section className="central-activity-card">
          <div className="central-activity-heading">
            <div className="central-activity-heading-content">
              <div className="central-activity-eyebrow"><span>ATIVIDADE DE PRÁTICA</span><span className="central-exercise-type">{EXERCISE_TYPE_LABELS[activity.tipo_exercicio]}</span><i/><div className="central-live-time"><Clock3 size={14}/>{formatTime(elapsedSeconds)}</div></div>
              <h1>{activity.titulo}</h1>
              {activity.descricao&&<p>{activity.descricao}</p>}
            </div>
          </div>

          <div className="central-activity-content-grid">
            <div className="central-activity-content-main">
              {activity.instrucoes&&<div className={showInstructions?'central-instructions open':'central-instructions'}><button type="button" className="central-instructions-toggle" onClick={()=>setShowInstructions(value=>!value)}><span className="central-instructions-icon"><CircleHelp size={17}/></span><strong>Como fazer</strong><ChevronRight size={16} className="central-instructions-chevron"/></button>{showInstructions&&<p>{activity.instrucoes}</p>}</div>}
              <div className="central-translation-toolbar">
                <button type="button" onClick={()=>void translateActivity()} disabled={translating}>
                  {translating?<><Loader2 size={15} className="central-activity-spin"/>Traduzindo...</>:translation?<><ArrowLeft size={15}/>Voltar ao idioma original</>:<>Aa&nbsp; Traduzir para português</>}
                </button>
                {translationError&&<span>{translationError}</span>}
              </div>
              <div className={translation ? 'central-language-grid translated' : 'central-language-grid'}>
                <div className="central-language-column">
                  <div className="central-language-label">Idioma original</div>
                  {activity.conteudo.text&&<div className="central-exercise-text"><span>Texto de apoio</span><p>{activity.conteudo.text}</p></div>}
                  {activity.conteudo.question&&<div className="central-question"><span>Pergunta</span><strong>{activity.conteudo.question}</strong></div>}
                </div>
                {translation&&<div className="central-language-column translated-column">
                  <div className="central-language-label">Português</div>
                  {translation.text&&<div className="central-exercise-text"><span>Texto de apoio</span><p>{translation.text}</p></div>}
                  {translation.question&&<div className="central-question"><span>Pergunta</span><strong>{translation.question}</strong></div>}
                </div>}
              </div>
              <div className="central-answers-section">
                <div className="central-section-label">RESPOSTA</div>
                <div className="central-exercise-area">{renderExercise()}</div>
              </div>
              <div className="central-progress">
                <div className="central-progress-top"><span>Progresso da atividade</span><strong>{result ? '100%' : hasAnswer() ? 'Em andamento' : 'Comece quando estiver pronto'}</strong></div>
                <div className="central-progress-track"><div className={result ? 'central-progress-fill complete' : 'central-progress-fill'} style={{width:result?'100%':hasAnswer()?'55%':'0%'}}/></div>
              </div>
            </div>
          </div>
          {error&&<div className="central-form-error">{error}</div>}
          {!result&&<div className="central-save-status">{saveState==='saving'?<><Loader2 size={14} className="central-activity-spin"/> Salvando seu progresso...</>:saveState==='saved'?<><CheckCircle2 size={14}/> Progresso salvo</>:saveState==='error'?<span>Não foi possível sincronizar. Seu rascunho permanece salvo neste dispositivo.</span>:<span>Seu progresso será salvo automaticamente.</span>}</div>}
          {result?<div className={result.correct?'central-result success':'central-result'}>
<div className="central-result-hero"><div className="central-result-icon">{result.correct?<CheckCircle2 size={25}/>:<CircleHelp size={25}/>}</div><div className="central-result-copy"><span>{result.correct?'Muito bem!':'Atividade concluída'}</span><strong>{result.message}</strong></div><div className="central-result-score"><strong>{result.score}</strong><span>/100</span></div></div>
{activity.explicacao&&<div className="central-result-explanation"><strong>Explicação</strong><p>{activity.explicacao}</p></div>}
<div className="central-result-actions"><button type="button" className="central-secondary-button" onClick={()=>{window.localStorage.removeItem(`ab-academy-activity-draft-${activity.id}`);updateAnswers({});setResult(null);setSaveState("idle");window.sessionStorage.removeItem(`ab-academy-activity-start-${activity.id}`);const start=Date.now();window.sessionStorage.setItem(`ab-academy-activity-start-${activity.id}`,String(start));setStartedAt(start);setElapsedSeconds(0)}}><RotateCcw size={17}/>Refazer</button><div className="central-result-next">{nextActivity?<><span>PRÓXIMA NA SEQUÊNCIA</span><strong>{nextActivity.titulo}</strong></>:<span>Você chegou ao final desta sequência.</span>}</div><button type="button" className="central-primary-button" onClick={goNext}>{nextActivity?<>Próxima atividade <ArrowRight size={18}/></>:<>Voltar para a Central <ArrowRight size={18}/></>}</button></div></div>:<div className="central-activity-actions"><button type="button" className="central-secondary-button" onClick={()=>window.location.href='/aluno/central'}><ChevronLeft size={18}/>Voltar</button><button type="button" className="central-primary-button" onClick={()=>void submit()} disabled={submitting||!hasAnswer()}>{submitting?<><Loader2 size={18} className="central-activity-spin"/>Salvando...</>:<>Concluir atividade <ChevronRight size={18}/></>}</button></div>}
        </section>
      </div>
    </main>
  </div>
}
export default CentralAtividade