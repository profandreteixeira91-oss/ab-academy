import Home from './pages/Home'

import Matricula from './pages/matricula'

import Checkout from './pages/checkout'

import Aluno from './pages/Aluno'

import CentralAtividades from './pages/CentralAtividades'

import Admin from './pages/Admin'

import Equipe from './pages/admin/Equipe'

import AdminAccess from './pages/admin/AdminAccess'

import PoliticaPrivacidade from './pages/PoliticaPrivacidade'

import TermosServico from './pages/TermosServico'

import SalaAula from './pages/SalaAula'

import SalaProfessor from './pages/admin/SalaProfessor'

import Professor from './pages/Professor'

import ProfessorAccess from './pages/ProfessorAccess'

function App() {
  const path = window.location.pathname

  /*
   * =========================================================
   * MATRÍCULA
   * =========================================================
   */

  if (path === '/matricula') {
    return <Matricula />
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

    return (
      <Checkout
        pagamentoId={pagamentoId}
      />
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
    return <PoliticaPrivacidade />
  }

  /*
   * =========================================================
   * TERMOS DE SERVIÇO
   * =========================================================
   */

  if (path === '/termos-de-servico') {
    return <TermosServico />
  }

  /*
   * =========================================================
   * PORTAL DO PROFESSOR
   * =========================================================
   */

  if (path === '/professor') {
    return <Professor />
  }

  /*
   * =========================================================
   * HOME
   * =========================================================
   */

  return <Home />
}

export default App