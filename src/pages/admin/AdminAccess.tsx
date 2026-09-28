import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ChevronRight, Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react'
import logo from '../../assets/logo_abacademy.png'
import { supabase } from '../../lib/supabase'

import '../../styles/admin/AdminAccess.css'

type AdminAccessProps = {
  children: ReactNode
}

export default function AdminAccess({ children }: AdminAccessProps) {
  const [checkingSession, setCheckingSession] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  async function verifyAdmin(userId: string) {
    const { data, error } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', userId)
      .eq('ativo', true)
      .maybeSingle()

    if (error) {
      console.error('Erro ao verificar administrador:', error)
      return false
    }

    return !!data
  }

  async function checkSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        setAuthorized(false)
        return
      }

      setAuthorized(await verifyAdmin(session.user.id))
    } catch (error) {
      console.error('Erro ao verificar sessão administrativa:', error)
      setAuthorized(false)
    } finally {
      setCheckingSession(false)
    }
  }

  useEffect(() => {
    void checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session?.user) {
          setAuthorized(false)
          setCheckingSession(false)
          return
        }

        void verifyAdmin(session.user.id).then((isAdmin) => {
          setAuthorized(isAdmin)
          setCheckingSession(false)
        })
      },
    )

    return () => subscription.unsubscribe()
  }, [])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (loginLoading) return

    setLoginError('')

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setLoginError('Informe o e-mail do administrador.')
      return
    }

    if (!password) {
      setLoginError('Informe sua senha.')
      return
    }

    setLoginLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (error) {
        console.error('Erro no login administrativo:', error)
        setAuthorized(false)
        setLoginError(
          'Não foi possível realizar o login. Verifique seu e-mail e senha.',
        )
        return
      }

      if (!data.user) {
        setAuthorized(false)
        setLoginError('Não foi possível identificar o usuário autenticado.')
        return
      }

      const isAdmin = await verifyAdmin(data.user.id)

      if (!isAdmin) {
        await supabase.auth.signOut()
        setAuthorized(false)
        setLoginError('Este usuário não possui acesso administrativo.')
        return
      }

      setAuthorized(true)
    } catch (error) {
      console.error('Erro ao realizar login administrativo:', error)
      setAuthorized(false)
      setLoginError('Ocorreu um erro ao realizar o login. Tente novamente.')
    } finally {
      setLoginLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="admin-access-page">
        <div className="admin-access-card">
          <div className="admin-access-icon">
            <LockKeyhole size={25} />
          </div>
          <h1>Verificando acesso</h1>
          <p>Verificando a sessão administrativa...</p>
          <div className="admin-access-loading">
            <span />
            Aguarde...
          </div>
        </div>
      </div>
    )
  }

  if (authorized) {
    return <>{children}</>
  }

  return (
    <div className="admin-access-page">
      <div className="admin-access-card">
        <div className="admin-access-brand">
          <img src={logo} alt="AB Academy" />
          <span>PORTAL ADMINISTRATIVO</span>
        </div>

        <div className="admin-access-header">
          <h1>Acesse sua conta</h1>
          <p>Informe o e-mail e a senha do administrador.</p>
        </div>

        <form className="admin-access-form" onSubmit={handleLogin}>
          <div className="admin-access-field">
            <label htmlFor="admin-email">E-mail</label>
            <div className="admin-access-input-wrapper">
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setLoginError('')
                }}
                placeholder="seu@email.com"
                autoComplete="username"
                autoFocus
                disabled={loginLoading}
              />
            </div>
          </div>

          <div className="admin-access-field">
            <label htmlFor="admin-password">Senha</label>
            <div className="admin-access-input-wrapper">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setLoginError('')
                }}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                disabled={loginLoading}
              />
              <button
                type="button"
                className="admin-access-password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Ocultar senha' : 'Visualizar senha'}
                title={showPassword ? 'Ocultar senha' : 'Visualizar senha'}
                disabled={loginLoading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {loginError && (
            <div className="admin-access-error" role="alert">
              {loginError}
            </div>
          )}

          <button
            type="submit"
            className="admin-access-button"
            disabled={loginLoading}
          >
            {loginLoading ? (
              <>
                <Loader2 size={18} className="admin-access-button-spinner" />
                Entrando...
              </>
            ) : (
              <>
                Entrar
                <ChevronRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="admin-access-footer">
          <span>AB Academy</span>
          <span>•</span>
          <span>Acesso exclusivo à administração</span>
        </div>
      </div>
    </div>
  )
}
