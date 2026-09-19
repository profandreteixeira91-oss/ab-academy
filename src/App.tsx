import Home from './pages/Home'
import Matricula from './pages/matricula'
import Checkout from './pages/checkout'
import Aluno from './pages/Aluno'
import Admin from './pages/Admin'
import AdminAccess from './pages/admin/AdminAccess'
import PoliticaPrivacidade from './pages/PoliticaPrivacidade'
import TermosServico from './pages/TermosServico'

function App() {
  const path = window.location.pathname

  if (path === '/matricula') {
    return <Matricula />
  }

  if (path.startsWith('/checkout/')) {
    const pagamentoId = path
      .replace('/checkout/', '')
      .split('/')[0]
      .trim()

    if (!pagamentoId || pagamentoId === 'undefined' || pagamentoId === 'null') {
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

  if (path === '/aluno') {
    return <Aluno />
  }

  if (path === '/admin') {
    return (
      <AdminAccess>
        <Admin />
      </AdminAccess>
    )
  }

  if (path === '/politica-privacidade') {
  return <PoliticaPrivacidade />
}

if (path === '/termos-de-servico') {
  return <TermosServico />
}

  return <Home />
}

export default App