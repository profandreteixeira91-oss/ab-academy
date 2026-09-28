import { ArrowRight, CheckCircle2, MessageCircle, Sparkles, Target, Users } from 'lucide-react'
import '../styles/language-landing.css'

type Language = 'ingles' | 'alemao'
type Props = { language: Language }

const content = {
  ingles: { name: 'Inglês', headline: 'Inglês para transformar seus próximos passos.', lead: 'Aprenda inglês com uma metodologia prática, acompanhamento próximo e foco no uso real do idioma.', points: ['Conversação desde o início', 'Acompanhamento individualizado', 'Conteúdo conectado aos seus objetivos'], objective: 'Do primeiro contato à autonomia para se comunicar.' },
  alemao: { name: 'Alemão', headline: 'Alemão para quem quer ir além do básico.', lead: 'Construa uma base sólida em alemão com prática, acompanhamento especializado e um caminho claro de evolução.', points: ['Desenvolvimento de comunicação', 'Acompanhamento individualizado', 'Conteúdo conectado aos seus objetivos'], objective: 'Estruture seu aprendizado e avance com segurança.' },
}

const WHATSAPP_NUMBER = '5511999738440'

export default function LanguageLanding({ language }: Props) {
  const data = content[language]
  const leadUrl = '/quero-aprender?idioma=' + language + '&landing_page=/' + language
  const whatsappUrl = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent('Olá! Tenho interesse em estudar ' + data.name + ' na AB Academy e gostaria de saber mais.')
  return (
    <main className="language-landing">
      <header className="language-landing-header"><a href="/" className="language-landing-brand">AB Academy</a><a href="/quero-aprender" className="language-landing-header-link">Fale com a equipe</a></header>
      <section className="language-landing-hero"><div className="language-landing-container language-landing-hero-grid">
        <div className="language-landing-copy"><span className="language-landing-eyebrow"><Sparkles size={15} /> Curso de {data.name}</span><h1>{data.headline}</h1><p className="language-landing-lead">{data.lead}</p>
          <div className="language-landing-actions"><a href={leadUrl} className="language-landing-primary">Quero conhecer <ArrowRight size={17} /></a><a href={'/diagnostica?idioma=' + language} className="language-landing-secondary">Aula diagnóstica <ArrowRight size={17} /></a><a href={'/planos?idioma=' + language} className="language-landing-secondary">Ver planos <ArrowRight size={17} /></a><a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="language-landing-secondary"><MessageCircle size={17} /> WhatsApp</a></div>
          <div className="language-landing-trust"><span><CheckCircle2 size={16} /> Metodologia prática</span><span><CheckCircle2 size={16} /> Atendimento personalizado</span></div>
        </div>
        <div className="language-landing-visual" aria-hidden="true"><div className="language-landing-orbit orbit-one" /><div className="language-landing-orbit orbit-two" /><div className="language-landing-visual-card"><span>AB ACADEMY</span><strong>{data.name}</strong><small>{data.objective}</small><div className="language-landing-visual-line" /><div className="language-landing-visual-meta"><Users size={15} /> Acompanhamento próximo</div></div></div>
      </div></section>
      <section className="language-landing-section"><div className="language-landing-container"><div className="language-landing-section-heading"><span className="language-landing-eyebrow">POR QUE ESTUDAR {data.name.toUpperCase()}?</span><h2>Aprendizado pensado para o seu objetivo.</h2><p>Você não precisa estudar mais. Precisa estudar com direção, prática e acompanhamento.</p></div>
        <div className="language-landing-benefits">{data.points.map((point, index) => { const Icon = index === 0 ? Target : index === 1 ? Users : CheckCircle2; return <article key={point}><div><Icon size={19} /></div><h3>{point}</h3><p>Uma experiência de aprendizagem organizada para transformar conhecimento em uso prático.</p></article> })}</div>
      </div></section>
      <section className="language-landing-cta"><div className="language-landing-container language-landing-cta-inner"><div><span className="language-landing-eyebrow">PRÓXIMO PASSO</span><h2>Quer descobrir como começar?</h2><p>Conte seus objetivos para a AB Academy e receba orientação sobre o melhor caminho para estudar {data.name}.</p></div><a href={leadUrl} className="language-landing-primary">Falar com a AB Academy <ArrowRight size={17} /></a></div></section>
      <footer className="language-landing-footer"><span><strong>AB Academy Idiomas</strong>® 2026 - todos os direitos reservados</span><a href="/">Voltar ao site</a></footer>
    </main>
  )
}