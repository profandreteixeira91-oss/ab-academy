import { ArrowRight, Users, UserRound, UserRoundPlus, Sparkles } from 'lucide-react'
import '../styles/aulas.css'

const modalities = [
  { href:'/aulas/individuais', icon:UserRound, n:'01 · Individual', title:'Aulas individuais', text:'Aulas totalmente direcionadas ao seu nível, objetivo, rotina e ritmo.' },
  { href:'/aulas/duplas', icon:UserRoundPlus, n:'02 · Dupla', title:'Aulas em duplas', text:'Aprenda com outra pessoa, compartilhando a experiência e o acompanhamento do professor.' },
  { href:'/aulas/grupos', icon:Users, n:'03 · Grupo', title:'Aulas em grupos', text:'Pequenos grupos organizados por perfil, nível e objetivo em comum.' },
]

export default function Aulas(){
 return <main className="aulas-page">
  <header className="aulas-header"><a href="/" className="aulas-brand">AB Academy</a><nav aria-label="Navegação principal"><a href="/">Início</a><a href="/#sobre">Sobre</a><a href="/aulas" aria-current="page">Cursos</a><a href="/planos">Planos</a><a href="/diagnostica">Aula diagnóstica</a><a href="/enterprise">Enterprise</a><a href="/quero-aprender">Contato</a></nav><a href="/matricula" className="aulas-header-cta">Matricule-se <ArrowRight size={16}/></a></header>
  <section className="aulas-hero"><div className="aulas-container aulas-hero-grid"><div><span className="aulas-eyebrow"><Sparkles size={15}/> FORMATOS AB ACADEMY</span><h1>Escolha a forma de aprender que combina com você.</h1><p>Estude inglês ou alemão de forma individual, em dupla ou em pequenos grupos. O formato muda, mas a proposta continua: prática, direção e acompanhamento.</p><div className="aulas-actions"><a href="/ingles" className="aulas-primary">Conhecer Inglês <ArrowRight size={17}/></a><a href="/alemao" className="aulas-secondary">Conhecer Alemão <ArrowRight size={17}/></a></div></div><div className="aulas-hero-card"><span>Uma jornada</span><strong>3 formas de aprender</strong><div><UserRound size={18}/> Individual</div><div><UserRoundPlus size={18}/> Dupla</div><div><Users size={18}/> Grupo</div></div></div></section>
  <section className="aulas-section"><div className="aulas-container"><div className="aulas-heading"><span className="aulas-eyebrow">FORMATOS DE AULA</span><h2>Uma estrutura para cada necessidade.</h2><p>Conheça as possibilidades e escolha o formato que faz mais sentido para seu momento.</p></div><div className="aulas-grid">{modalities.map(({href,icon:Icon,n,title,text})=><article className="aulas-card" key={href}><div className="aulas-icon"><Icon size={21}/></div><span>{n}</span><h3>{title}</h3><p>{text}</p><a href={href}>Conhecer formato <ArrowRight size={16}/></a></article>)}</div></div></section>
  <section className="aulas-cta"><div className="aulas-container aulas-cta-inner"><div><span className="aulas-eyebrow">PRÓXIMO PASSO</span><h2>Não sabe qual formato escolher?</h2><p>Conte seu objetivo para a equipe da AB Academy. Podemos orientar você sobre idioma, formato e melhor caminho.</p></div><a href="/quero-aprender" className="aulas-primary">Falar com a equipe <ArrowRight size={17}/></a></div></section>
  <footer className="aulas-footer"><span><strong>AB Academy Idiomas</strong>® 2026 - todos os direitos reservados</span><a href="/">Voltar ao site</a></footer>
 </main>
}