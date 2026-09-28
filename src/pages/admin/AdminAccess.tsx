import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ChevronRight, Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react'
import logo from '../../assets/logo_abacademy.png'
import { supabase } from '../../lib/supabase'

import '../../styles/admin/AdminAccess.css'\nimport '../../styles/aluno.css'

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
      <div className="student-login-page">
        <div className="student-login-card">
          <div className="student-login-brand-panel">
            <img
              src={logo}
              alt="AB Academy"
              className="student-login-logo"
            />
            <div className="student-login-brand-copy">
              <strong>AB ACADEMY</strong>
              <span>IDIOMAS QUE TRANSFORMAM</span>
              <span>CONEXÕES QUE PERMANECEM</span>
            </div>
          </div>

          <div className="student-login-form-area">
            <span className="student-login-label">
              PORTAL ADMINISTRATIVO
            </span>

            <h1>Verificando acesso</h1>

            <p>Verificando a sessão administrativa...</p>

            <div className="student-login-loading">
              <Loader2 size={19} className="student-spin" />
              Aguarde...
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (authorized) {
    return <>{children}</>
  }

  return (
    <div className="student-login-page">
      <div className="student-login-card">
        <div className="student-login-brand-panel">
          <img
            src={logo}
            alt="AB Academy"
            className="student-login-logo"
          />
          <div className="student-login-brand-copy">
            <strong>AB ACADEMY</strong>
            <span>IDIOMAS QUE TRANSFORMAM</span>
            <span>CONEXÕES QUE PERMANECEM</span>
          </div>
        </div>

        <div className="student-login-form-area">
          <span className="student-login-label">
            PORTAL ADMINISTRATIVO
          </span>

          <h1>Acesse sua conta</h1>

          <p>
            Informe o e-mail e a senha do administrador.
          </p>

          <form onSubmit={handleLogin}>
            <div className="student-login-field">
              <label htmlFor="admin-email">E-mail</label>

              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setLoginError('')
                }}
                placeholder="seu@email.com"
                autoComplete="email"
                autoFocus
                disabled={loginLoading}
              />
            </div>

            <div className="student-login-field">
              <label htmlFor="admin-password">Senha</label>

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
                className="auth-password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Ocultar senha' : 'Visualizar senha'}
                aria-pressed={showPassword}
                title={showPassword ? 'Ocultar senha' : 'Visualizar senha'}
                disabled={loginLoading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {loginError && (
              <div className="student-login-error" role="alert">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="student-primary-button student-auth-button"
              disabled={loginLoading}
            >
              {loginLoading ? (
                <>
                  <Loader2 size={19} className="student-spin" />
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

          <div className="student-login-footer">
            <span>AB Academy</span>
            <span>Acesso exclusivo à administração</span>
          </div>
        </div>
      </div>
    </div>
  )
}
