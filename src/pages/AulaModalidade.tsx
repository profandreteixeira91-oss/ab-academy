import { ArrowRight, CheckCircle2, MessageCircle, UserRound, UserRoundPlus, Users } from 'lucide-react'
import '../styles/aulas.css'
type Modality='individual'|'dupla'|'grupo'
type Props={modality:Modality}
const content={
 individual:{icon:UserRound,name:'Aulas individuais',short:'Uma aula pensada para uma pessoa, com atenção exclusiva do professor.',points:['Conteúdo alinhado ao seu nível e objetivo','Ritmo adaptado à sua evolução','Foco em dificuldades específicas'],cta:'Conhecer planos individuais',href:'/planos?modalidade=individual'},
 dupla:{icon:UserRoundPlus,name:'Aulas em duplas',short:'Aprenda com outra pessoa em uma experiência colaborativa e acompanhada pelo professor.',points:['Possibilidade de estudar com alguém próximo','Prática de comunicação compartilhada','Acompanhamento para os dois participantes'],cta:'Quero montar uma dupla',href:'/quero-aprender?modalidade=dupla'},
 grupo:{icon:Users,name:'Aulas em grupos',short:'Pequenos grupos organizados de acordo com perfil, nível e objetivo.',points:['Experiência colaborativa','Organização por nível e objetivo em comum','Formato para amigos, familiares e equipes'],cta:'Quero montar meu grupo',href:'/quero-aprender?modalidade=grupo'}
} as const
const WA='5511999738440'
export default function AulaModalidade({modality}:Props){
 const d=content[modality],Icon=d.icon
 const lead='/quero-aprender?modalidade='+modality
 const formation=modality==='individual' ? null : '/horarios'
 const wa='https://wa.me/'+WA+'?text='+encodeURIComponent('Olá! Tenho interesse em '+d.name.toLowerCase()+' na AB Academy e gostaria de saber mais.')
 return <main className="aulas-page">
  <header className="aulas-header"><a href="/" className="aulas-brand">AB Academy</a><nav><a href="/ingles">Inglês</a><a href="/alemao">Alemão</a><a href="/aulas">Formatos</a><a href="/planos">Planos</a></nav><a href={lead} className="aulas-header-cta">Fale com a equipe <ArrowRight size={16}/></a></header>
  <section className="aulas-detail-hero"><div className="aulas-container aulas-detail-grid"><div><div className="aulas-detail-icon"><Icon size={27}/></div><span className="aulas-eyebrow">FORMATO AB ACADEMY</span><h1>{d.name}</h1><p>{d.short}</p><div className="aulas-actions"><a href={d.href} className="aulas-primary">{d.cta} <ArrowRight size={17}/></a>{formation && <a href={formation} className="aulas-secondary"><Users size={17}/> Ver horários em formação</a>}<a href={wa} target="_blank" rel="noopener noreferrer" className="aulas-secondary"><MessageCircle size={17}/> WhatsApp</a></div></div><div className="aulas-detail-panel"><span>O que você encontra</span>{d.points.map(x=><div key={x}><CheckCircle2 size={18}/><span>{x}</span></div>)}</div></div></section>
  <section className="aulas-section aulas-soft"><div className="aulas-container"><div className="aulas-heading"><span className="aulas-eyebrow">COMO COMEÇAR</span><h2>O formato é definido de acordo com seu objetivo.</h2><p>Informe o idioma, seu nível, objetivo e disponibilidade. A equipe orienta o próximo passo.</p></div><div className="aulas-process"><article><strong>01</strong><h3>Conte seu objetivo</h3><p>Explique o que deseja alcançar e como pretende estudar.</p></article><article><strong>02</strong><h3>Alinhamos o formato</h3><p>Entendemos se este formato atende ao seu perfil.</p></article><article><strong>03</strong><h3>Comece sua jornada</h3><p>Avançamos para diagnóstico, plano e matrícula quando aplicável.</p></article></div></div></section>
  <section className="aulas-cta"><div className="aulas-container aulas-cta-inner"><div><span className="aulas-eyebrow">PRÓXIMO PASSO</span><h2>Quer estudar neste formato?</h2><p>Fale com a AB Academy e conte como você quer aprender.</p></div><a href={lead} className="aulas-primary">Quero começar <ArrowRight size={17}/></a></div></section>
  <footer className="aulas-footer"><span><strong>AB Academy Idiomas</strong>® 2026 - todos os direitos reservados</span><a href="/aulas">Voltar para formatos</a></footer>
 </main>
}