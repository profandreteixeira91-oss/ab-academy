import type { ReactNode } from 'react'
import { useEffect } from 'react'
import './styles/mobile-responsive.css'

import Home from './pages/Home'
import Enterprise from './pages/Enterprise'

import Matricula from './pages/matricula'

import Checkout from './pages/checkout'

import Aluno from './pages/Aluno'

import CentralAtividades from './pages/CentralAtividades'

import CentralAtividade from './pages/CentralAtividade'

import Admin from './pages/Admin'

import Equipe from './pages/admin/Equipe'

import AdminAccess from './pages/admin/AdminAccess'

import PoliticaPrivacidade from './pages/PoliticaPrivacidade'

import TermosServico from './pages/TermosServico'

import SalaAula from './pages/SalaAula'

import SalaProfessor from './pages/admin/SalaProfessor'

import Professor from './pages/Professor'

import ProfessorAccess from './pages/ProfessorAccess'

import Error404 from './pages/Error404'
import TrabalheConosco from './pages/TrabalheConosco'
import Planos from './pages/Planos'
import Diagnostica from './pages/Diagnostica'
import LeadCapture from './pages/LeadCapture'
import LanguageLanding from './pages/LanguageLanding'
import Aulas from './pages/Aulas'
import AulaModalidade from './pages/AulaModalidade'
import HorariosFormacao from './pages/HorariosFormacao'
import SiteFooter from './components/SiteFooter'
import { trackPublicPageView } from './lib/analytics'

function App() {
  const withFooter = (content: ReactNode) => (
    <>
      {content}
      <SiteFooter />
    </>
  )

  const attributionParams = new URLSearchParams(window.location.search)
  const attributionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
  const hasAttribution = attributionKeys.some((key) => attributionParams.get(key))

  if (hasAttribution) {
    try {
      const current = JSON.parse(sessionStorage.getItem('abacademy_attribution') || '{}') as Record<string, string>
      const next = { ...current }

      attributionKeys.forEach((key) => {
        const value = attributionParams.get(key)
        const normalizedKey = key.replace('utm_', '')
        if (value && !next[normalizedKey]) next[normalizedKey] = value
      })

      sessionStorage.setItem('abacademy_attribution', JSON.stringify(next))
    } catch {
      // Attribution must never interfere with page rendering.
    }
  }

  const path = window.location.pathname

  const pageTitle =
    path === '/' ? 'Início' :
    path === '/matricula' ? 'Matrícula' :
    path === '/trabalhe-conosco' ? 'Trabalhe conosco' :
    path === '/planos' ? 'Planos' :
    path === '/diagnostica' ? 'Aula diagnóstica' :
    path === '/quero-aprender' ? 'Fale com a AB Academy' :
    path === '/horarios' ? 'Horários em formação' :
    path === '/aulas' ? 'Formatos de aulas' :
    path === '/aulas/individuais' ? 'Aulas individuais' :
    path === '/aulas/duplas' ? 'Aulas em duplas' :
    path === '/aulas/grupos' ? 'Aulas em grupos' :
    path === '/ingles' ? 'Curso de Inglês' :
    path === '/alemao' ? 'Curso de Alemão' :
    path === '/enterprise' ? 'AB Academy Enterprise' :
    path.startsWith('/checkout/') ? 'Checkout' :
    path === '/aluno' ? 'Área do aluno' :
    path === '/aluno/central' ? 'Central de Atividades' :
    path.startsWith('/aluno/central/atividade/') ? 'Atividade' :
    path.startsWith('/aluno/aula/') ? 'Sala de Aula' :
    path === '/professor' ? 'Portal do professor' :
    path.startsWith('/professor/aula/') ? 'Sala do professor' :
    path === '/admin' ? 'Dashboard' :
    path === '/admin/equipe' ? 'Equipe' :
    path.startsWith('/admin/aula/') ? 'Sala do professor' :
    path === '/politica-privacidade' ? 'Política de Privacidade' :
    path === '/termos-de-servico' ? 'Termos de Serviço' :
    'Página não encontrada'

  useEffect(() => {
    trackPublicPageView(path, pageTitle)
  }, [path, pageTitle])

  const pageDescriptions: Record<string, string> = {
    '/': 'Aprenda inglês e alemão com a AB Academy. Metodologia prática, acompanhamento especializado e plataforma completa para sua evolução.',
    '/planos': 'Conheça os planos de inglês e alemão da AB Academy e escolha a opção ideal para seus objetivos.',
    '/diagnostica': 'Faça sua aula diagnóstica de inglês ou alemão e descubra o melhor caminho para sua evolução.',
    '/quero-aprender': 'Fale com a AB Academy e descubra como começar a estudar inglês ou alemão.',
    '/aulas': 'Conheça as modalidades de aulas da AB Academy: individuais, duplas e grupos.',
    '/aulas/individuais': 'Aulas individuais de inglês e alemão na AB Academy.',
    '/aulas/duplas': 'Aulas em duplas de inglês e alemão na AB Academy.',
    '/aulas/grupos': 'Aulas em grupos de inglês e alemão na AB Academy.',
    '/ingles': 'Curso de inglês da AB Academy com metodologia prática e acompanhamento especializado.',
    '/alemao': 'Curso de alemão da AB Academy com metodologia prática e acompanhamento especializado.',
    '/enterprise': 'Inglês e alemão para empresas. Conheça as soluções corporativas da AB Academy Enterprise.',
    '/trabalhe-conosco': 'Faça parte da equipe da AB Academy. Envie seu perfil e candidate-se para trabalhar conosco.',
    '/matricula': 'Matricule-se na AB Academy e comece sua jornada de aprendizagem em inglês ou alemão.',
    '/politica-privacidade': 'Conheça a política de privacidade da AB Academy Idiomas.',
    '/termos-de-servico': 'Conheça os termos de serviço da AB Academy Idiomas.',
  }

  const isPublicPage =
    path === '/' ||
    Object.prototype.hasOwnProperty.call(pageDescriptions, path)

  document.title = pageTitle + ' - AB Academy Idiomas'

  if (isPublicPage) {
    const description = pageDescriptions[path] ?? pageDescriptions['/']
    const canonicalUrl = `https://abacademyidiomas.com.br${path === '/' ? '/' : path}`

    let descriptionTag = document.querySelector('meta[name="description"]')
    if (!descriptionTag) {
      descriptionTag = document.createElement('meta')
      descriptionTag.setAttribute('name', 'description')
      document.head.appendChild(descriptionTag)
    }
    descriptionTag.setAttribute('content', description)

    let canonicalTag = document.querySelector('link[rel="canonical"]')
    if (!canonicalTag) {
      canonicalTag = document.createElement('link')
      canonicalTag.setAttribute('rel', 'canonical')
      document.head.appendChild(canonicalTag)
    }
    canonicalTag.setAttribute('href', canonicalUrl)

    const ogTitle = pageTitle + ' - AB Academy Idiomas'
    let ogTitleTag = document.querySelector('meta[property="og:title"]')
    if (!ogTitleTag) {
      ogTitleTag = document.createElement('meta')
      ogTitleTag.setAttribute('property', 'og:title')
      document.head.appendChild(ogTitleTag)
    }
    ogTitleTag.setAttribute('content', ogTitle)

    let ogDescriptionTag = document.querySelector('meta[property="og:description"]')
    if (!ogDescriptionTag) {
      ogDescriptionTag = document.createElement('meta')
      ogDescriptionTag.setAttribute('property', 'og:description')
      document.head.appendChild(ogDescriptionTag)
    }
    ogDescriptionTag.setAttribute('content', description)

    let ogUrlTag = document.querySelector('meta[property="og:url"]')
    if (!ogUrlTag) {
      ogUrlTag = document.createElement('meta')
      ogUrlTag.setAttribute('property', 'og:url')
      document.head.appendChild(ogUrlTag)
    }
    ogUrlTag.setAttribute('content', canonicalUrl)
  }

  /*
   * =========================================================
   * HOME
   * =========================================================
   */

  if (path === '/') {
    return withFooter(<Home />)
  }

  /*
   * =========================================================
   * MATRÍCULA
   * =========================================================
   */

  if (path === '/enterprise') {
    return withFooter(<Enterprise />)
  }

  if (path === '/trabalhe-conosco') {
    return <TrabalheConosco />
  }

  if (path === '/planos') {
    return withFooter(<Planos />)
  }

  if (path === '/diagnostica') {
    return withFooter(<Diagnostica />)
  }

  if (path === '/quero-aprender') {
    return <LeadCapture />
  }

  if (path === '/horarios') {
    return <HorariosFormacao />
  }

  if (path === '/aulas') {
    return <Aulas />
  }

  if (path === '/aulas/individuais') {
    return <AulaModalidade modality="individual" />
  }

  if (path === '/aulas/duplas') {
    return <AulaModalidade modality="dupla" />
  }

  if (path === '/aulas/grupos') {
    return <AulaModalidade modality="grupo" />
  }

  if (path === '/ingles') {
    return <LanguageLanding language="ingles" />
  }

  if (path === '/alemao') {
    return <LanguageLanding language="alemao" />
  }

  if (path === '/matricula') {
    return withFooter(<Matricula />)
  }

  /*
   * =========================================================
   * CHECKOUT
   * =========================================================
   */

  if (path.startsWith('/checkout/')) {
    const pagamentoId = path
      .replace('/checkout/', '')
      .split('/')[0]
      .trim()

    if (
      !pagamentoId ||
      pagamentoId === 'undefined' ||
      pagamentoId === 'null'
    ) {
      console.error(
        'ID de pagamento inválido na URL:',
        pagamentoId,
      )

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div>
            <h1>Pagamento inválido</h1>

            <p>
              Não foi possível identificar a intenção de pagamento.
            </p>

            <a href="/matricula">
              Voltar para matrícula
            </a>
          </div>
        </div>
      )
    }

    return withFooter(
      <Checkout
        pagamentoId={pagamentoId}
      />,
    )
  }

  /*
   * =========================================================
   * PORTAL DO ALUNO
   * =========================================================
   */

  if (path === '/aluno') {
    return <Aluno />
  }

  /*
   * =========================================================
   * CENTRAL DE ATIVIDADES
   * =========================================================
   */

  if (path === '/aluno/central') {
    return (
      <>
        <CentralAtividades />
        <div className="central-page-footer">
          <SiteFooter />
        </div>
      </>
    )
  }

  /*
   * =========================================================
   * ATIVIDADE DA CENTRAL
   * =========================================================
   */

  if (path.startsWith('/aluno/central/atividade/')) {
    return withFooter(<CentralAtividade />)
  }

  /*
   * =========================================================
   * SALA VIRTUAL DO PROFESSOR
   *
   * O professor entra diretamente pelo próprio portal.
   * A validação de acesso à sala é feita pelo SalaProfessor
   * e pela Edge Function do LiveKit.
   * =========================================================
   */

  if (path.startsWith('/professor/aula/')) {
  return (
    <ProfessorAccess>
      <SalaProfessor />
    </ProfessorAccess>
  )
}

  /*
   * =========================================================
   * SALA VIRTUAL DO ADMIN
   *
   * Esta rota continua protegida pelo AdminAccess.
   * =========================================================
   */

  if (path.startsWith('/admin/aula/')) {
    return (
      <AdminAccess>
        <SalaProfessor />
      </AdminAccess>
    )
  }

  /*
   * =========================================================
   * SALA VIRTUAL DO ALUNO
   * =========================================================
   */

  if (path.startsWith('/aluno/aula/')) {
    return withFooter(<SalaAula />)
  }

  /*
   * =========================================================
   * EQUIPE ADMINISTRATIVA
   * =========================================================
   */

  if (path === '/admin/equipe') {
    return (
      <AdminAccess>
        <Equipe />
      </AdminAccess>
    )
  }

  /*
   * =========================================================
   * ADMIN
   * =========================================================
   */

  if (path === '/admin') {
    return (
      <AdminAccess>
        <Admin />
      </AdminAccess>
    )
  }

  /*
   * =========================================================
   * POLÍTICA DE PRIVACIDADE
   * =========================================================
   */

  if (path === '/politica-privacidade') {
    return withFooter(<PoliticaPrivacidade />)
  }

  /*
   * =========================================================
   * TERMOS DE SERVIÇO
   * =========================================================
   */

  if (path === '/termos-de-servico') {
    return withFooter(<TermosServico />)
  }

  /*
   * =========================================================
   * PORTAL DO PROFESSOR
   * =========================================================
   */

  if (path === '/professor') {
    return withFooter(<Professor />)
  }

  /*
   * =========================================================
   * HOME
   * =========================================================
   */

  return <Error404 />
}

export default App