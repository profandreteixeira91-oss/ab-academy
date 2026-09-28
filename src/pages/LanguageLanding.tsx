import { ArrowRight, BriefcaseBusiness, CheckCircle2, Clock3, MessageCircle, Sparkles, Target, Users, BookOpen, Smartphone, ClipboardCheck, LifeBuoy } from 'lucide-react'
import '../styles/language-landing.css'
import usaFlag from '../assets/flag-usa.svg'
import germanyFlag from '../assets/flag-germany.svg'

type Language = 'ingles' | 'alemao'
type Props = { language: Language }

const content = {
  ingles: {
    name: 'Inglês',
    flag: usaFlag,
    headline: 'Inglês para transformar seus próximos passos.',
    lead: 'Aprenda inglês com uma metodologia prática, acompanhamento próximo e foco no uso real do idioma.',
    objective: 'Do primeiro contato à autonomia para se comunicar.',
    points: ['Conversação desde o início', 'Acompanhamento individualizado', 'Conteúdo conectado aos seus objetivos'],
    audience: ['Quem precisa se comunicar melhor no dia a dia', 'Quem quer desenvolver conversação com mais segurança', 'Quem busca inglês para estudos, viagens ou trabalho'],
    outcomes: ['Compreender melhor situações reais de comunicação', 'Desenvolver vocabulário e estruturas com contexto', 'Ganhar mais segurança para usar o idioma'],
    journey: ['Entender seu momento atual', 'Definir um caminho de aprendizagem', 'Praticar e evoluir com acompanhamento'],
  },
  alemao: {
    name: 'Alemão',
    flag: germanyFlag,
    headline: 'Alemão para quem quer ir além do básico.',
    lead: 'Construa uma base sólida em alemão com prática, acompanhamento especializado e um caminho claro de evolução.',
    objective: 'Estruture seu aprendizado e avance com segurança.',
    points: ['Desenvolvimento de comunicação', 'Acompanhamento individualizado', 'Conteúdo conectado aos seus objetivos'],
    audience: ['Quem está começando ou retomando o alemão', 'Quem quer desenvolver comunicação com mais segurança', 'Quem busca alemão para estudos, viagens ou trabalho'],
    outcomes: ['Construir uma base organizada para evoluir', 'Praticar vocabulário e estruturas em contexto', 'Ganhar mais confiança para se comunicar'],
    journey: ['Entender seu momento atual', 'Definir um caminho de aprendizagem', 'Praticar e evoluir com acompanhamento'],
  },
}

const BENEFITS = [
  { icon: ClipboardCheck, title: 'Conteúdo sob medida', text: 'Ao se matricular, você terá um conteúdo pensado de acordo com o seu nível, seus objetivos e suas principais dificuldades. Assim, você aprende exatamente o que precisa, no seu ritmo, sem perder tempo com conteúdos que já domina ou que não fazem sentido para o seu momento. O resultado: aulas mais direcionadas, um aprendizado mais eficiente e um caminho claro para você evoluir.' },
  { icon: BookOpen, title: 'Materiais e atividades', text: 'O aprendizado continua depois da aula. Você terá materiais e atividades preparados especialmente para o seu nível e para aquilo que precisa desenvolver. Dessa forma, poderá praticar no seu dia a dia, mesmo que ainda esteja começando. Você não recebe apenas conteúdo: recebe ferramentas para transformar o que aprende em prática e desenvolver autonomia ao longo do processo.' },
  { icon: Smartphone, title: 'App do aluno', text: 'Sua evolução não precisa parar quando a aula termina. Você terá acesso ao app do aluno para acompanhar sua jornada de estudos, revisar conteúdos e praticar o idioma de forma simples e rápida, de qualquer lugar. Assim, você não depende apenas do momento da aula para estudar. Você consegue manter o contato com o idioma, acompanhar seu progresso e transformar pequenos momentos do seu dia em oportunidades de aprendizagem.' },
  { icon: CheckCircle2, title: 'Central de Atividades', text: 'Continue aprendendo mesmo quando a aula termina. Com acesso à Central de Atividades, você terá conteúdos e exercícios para praticar o idioma no seu ritmo e nos momentos que forem mais convenientes para você. Assim, você mantém o contato com o idioma ao longo da semana, reforça o que aprendeu nas aulas e cria mais oportunidades para desenvolver suas habilidades. Mais prática, mais contato com o idioma e mais oportunidades para transformar conhecimento em confiança.' },
  { icon: LifeBuoy, title: 'Suporte durante a jornada', text: 'Suporte para você continuar avançando. Sabemos que dúvidas podem surgir justamente quando você está estudando sozinho. Por isso, você terá suporte via WhatsApp e um canal para tirar dúvidas durante sua jornada. Assim, você não precisa esperar até a próxima aula para resolver uma dificuldade. Você recebe orientação para continuar estudando, praticando e avançando sem deixar que uma dúvida interrompa seu aprendizado.' },
]

const WHATSAPP_NUMBER = '5511999738440'

export default function LanguageLanding({ language }: Props) {
  const data = content[language]
  const leadUrl = '/quero-aprender?idioma=' + language + '&landing_page=/' + language
  const diagnosticUrl = '/diagnostica?idioma=' + language
  const plansUrl = '/planos?idioma=' + language
  const whatsappUrl = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent('Olá! Tenho interesse em estudar ' + data.name + ' na AB Academy e gostaria de saber mais.')

  return (
    <main className="language-landing">
      <header className="language-landing-header">
        <a href="/" className="language-landing-brand">AB Academy</a>
        <nav className="language-landing-nav" aria-label="Navegação da página">
          <a href="#como-funciona">Como funciona</a><a href="#para-quem">Para quem é</a><a href="#beneficios">Benefícios</a><a href={plansUrl}>Planos</a>
        </nav>
        <a href={leadUrl} className="language-landing-header-link">Fale com a equipe</a>
      </header>

      <section className="language-landing-hero">
        <div className="language-landing-container language-landing-hero-grid">
          <div className="language-landing-copy">
            <div className="language-landing-hero-meta">
              <div className="language-landing-language">
                <img src={data.flag} alt="" />
                <span>Curso de {data.name}</span>
              </div>
              <span className="language-landing-eyebrow"><Sparkles size={15} /> Metodologia prática AB Academy</span>
            </div>
            <h1>{data.headline}</h1>
            <p className="language-landing-lead">{data.lead}</p>
            <div className="language-landing-actions">
              <a href={leadUrl} className="language-landing-primary">Quero conhecer <ArrowRight size={17} /></a>
              <a href={diagnosticUrl} className="language-landing-secondary">Aula diagnóstica <ArrowRight size={17} /></a>
              <a href={plansUrl} className="language-landing-secondary">Ver planos <ArrowRight size={17} /></a>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="language-landing-secondary"><MessageCircle size={17} /> WhatsApp</a>
            </div>
            <div className="language-landing-trust"><span><CheckCircle2 size={16} /> Metodologia prática</span><span><CheckCircle2 size={16} /> Acompanhamento próximo</span><span><CheckCircle2 size={16} /> Foco no uso real</span></div>
          </div>

          <div className="language-landing-visual" aria-label={'Destaque do curso de ' + data.name}>
            <div className="language-landing-orbit orbit-one" /><div className="language-landing-orbit orbit-two" />
            <div className="language-landing-visual-card"><img src={data.flag} alt="" /><span>AB ACADEMY</span><strong>{data.name}</strong><small>{data.objective}</small><div className="language-landing-visual-line" /><div className="language-landing-visual-meta"><Users size={15} /> Acompanhamento próximo</div></div>
          </div>
        </div>
      </section>

      <section className="language-landing-proof"><div className="language-landing-container language-landing-proof-grid"><div><strong>Prática</strong><span>Conhecimento aplicado em situações de uso</span></div><div><strong>Direção</strong><span>Aprendizado organizado de acordo com seu objetivo</span></div><div><strong>Acompanhamento</strong><span>Suporte próximo durante sua evolução</span></div></div></section>

      <section className="language-landing-section" id="como-funciona"><div className="language-landing-container"><div className="language-landing-section-heading"><span className="language-landing-eyebrow">COMO FUNCIONA</span><h2>Aprenda com direção, prática e acompanhamento.</h2><p>A proposta é transformar o estudo do idioma em uma jornada clara, conectada ao que você realmente precisa fazer com a língua.</p></div><div className="language-landing-steps">{data.journey.map((item, index) => <article key={item}><span>0{index + 1}</span><div><h3>{item}</h3><p>{index === 0 ? 'Começamos entendendo seu momento e seus objetivos.' : index === 1 ? 'Organizamos a aprendizagem de forma coerente com o seu objetivo.' : 'A prática acontece com acompanhamento para você perceber sua evolução.'}</p></div></article>)}</div></div></section>

      <section className="language-landing-section language-landing-section-soft" id="para-quem"><div className="language-landing-container"><div className="language-landing-section-heading"><span className="language-landing-eyebrow">PARA QUEM É</span><h2>Um caminho pensado para diferentes objetivos.</h2><p>{data.name} pode fazer parte de diferentes momentos da sua vida. O ponto de partida é entender o que você quer alcançar.</p></div><div className="language-landing-audience">{data.audience.map((item, index) => <article key={item}><div className="language-landing-icon">{index === 0 ? <Target size={19} /> : index === 1 ? <Users size={19} /> : <BriefcaseBusiness size={19} />}</div><h3>{item}</h3></article>)}</div></div></section>

      <section className="language-landing-section" id="beneficios"><div className="language-landing-container"><div className="language-landing-section-heading"><span className="language-landing-eyebrow">BENEFÍCIOS DOS PLANOS</span><h2>Você não leva apenas aulas. Leva uma estrutura completa para aprender.</h2><p>Os planos da AB Academy incluem recursos para que seu aprendizado continue antes, durante e depois de cada aula.</p></div><div className="language-landing-benefits">{BENEFITS.map(({ icon: Icon, title, text }) => <article key={title} className="language-landing-benefit-card"><div className="language-landing-icon"><Icon size={19} /></div><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></div></section>

      <section className="language-landing-section language-landing-section-soft"><div className="language-landing-container"><div className="language-landing-section-heading"><span className="language-landing-eyebrow">O QUE VOCÊ DESENVOLVE</span><h2>Mais do que estudar conteúdo: desenvolver capacidade de uso.</h2></div><div className="language-landing-outcomes">{data.outcomes.map((item) => <div key={item}><CheckCircle2 size={18} /><span>{item}</span></div>)}</div><div className="language-landing-info-row"><div><Clock3 size={19} /><div><strong>Aula diagnóstica</strong><span>Uma conversa individual para entender seu nível e orientar o próximo passo.</span></div></div><div><Users size={19} /><div><strong>Acompanhamento próximo</strong><span>Uma experiência de aprendizagem com atenção ao seu objetivo.</span></div></div></div></div></section>

      <section className="language-landing-cta"><div className="language-landing-container language-landing-cta-inner"><div><span className="language-landing-eyebrow">PRÓXIMO PASSO</span><h2>Descubra o melhor caminho para estudar {data.name}.</h2><p>Conheça os planos, faça sua aula diagnóstica ou fale com a equipe da AB Academy para entender como começar.</p></div><div className="language-landing-cta-actions"><a href={plansUrl} className="language-landing-primary">Conhecer planos <ArrowRight size={17} /></a><a href={diagnosticUrl} className="language-landing-secondary">Aula diagnóstica <ArrowRight size={17} /></a></div></div></section>

      <footer className="language-landing-footer"><span><strong>AB Academy Idiomas</strong>® 2026 - todos os direitos reservados</span><a href="/">Voltar ao site</a></footer>
    </main>
  )
}