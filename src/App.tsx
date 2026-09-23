import type { ReactNode } from 'react'
import Home from './pages/Home'

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
import SiteFooter from './components/SiteFooter'

function App() {
  const withFooter = (content: ReactNode) => (
    <>
      {content}
      <SiteFooter />
    </>
  )

  const path = window.location.pathname

  const pageTitle =
    path === '/' ? 'Início' :
    path === '/matricula' ? 'Matrícula' :
    path === '/trabalhe-conosco' ? 'Trabalhe conosco' :
    path === '/planos' ? 'Planos' :
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

  document.title = pageTitle + ' - AB Academy Idiomas'

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

  if (path === '/trabalhe-conosco') {
    return <TrabalheConosco />
  }

  if (path === '/planos') {
    return withFooter(<Planos />)
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
    return <CentralAtividades />
  }

  /*
   * =========================================================
   * ATIVIDADE DA CENTRAL
   * =========================================================
   */

  if (path.startsWith('/aluno/central/atividade/')) {
    return <CentralAtividade />
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
    return <SalaAula />
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