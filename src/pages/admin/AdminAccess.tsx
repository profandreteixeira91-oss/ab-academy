import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ChevronRight, Loader2, LockKeyhole } from 'lucide-react'
import logo from '../../assets/logo_abacademy.png'
import { supabase } from '../../lib/supabase'

import '../../styles/admin/AdminAccess.css'
import '../../styles/aluno.css'

type AdminAccessProps = {
  children: ReactNode
}

export default function AdminAccess({
  children,
}: AdminAccessProps) {
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    checkAdminAccess()
  }, [])

  async function checkAdminAccess() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setAuthorized(false)
        return
      }

      const { data, error } = await supabase
        .from('admin_users')
        .select('id, ativo')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .maybeSingle()

      if (error) {
        console.error(
          'Erro ao verificar administrador:',
          error,
        )

        setAuthorized(false)
        return
      }

      setAuthorized(!!data)
    } catch (error) {
      console.error(
        'Erro ao verificar acesso administrativo:',
        error,
      )

      setAuthorized(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin() {
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
      const { error } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })

      if (error) {
        setLoginError(
          'Não foi possível realizar o login. Verifique seu e-mail e senha.',
        )

        return
      }

      await checkAdminAccess()
    } catch (error) {
      console.error(
        'Erro ao realizar login administrativo:',
        error,
      )

      setLoginError(
        'Ocorreu um erro ao realizar o login. Tente novamente.',
      )
    } finally {
      setLoginLoading(false)
    }
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!loginLoading) {
      handleLogin()
    }
  }

  if (loading) {
    return (
      <div className="admin-access-page">
        <div className="admin-access-card">
          <div className="admin-access-icon">
            <LockKeyhole size={25} />
          </div>

          <h1>Verificando acesso</h1>

          <p>
            Aguarde enquanto verificamos suas
            permissões administrativas.
          </p>

          <div className="admin-access-loading">
            <span />
            Verificando...
          </div>
        </div>
      </div>
    )
  }

  if (!authorized) {
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

          <h1>
            Acesse sua conta
          </h1>

          <p>
            Informe o e-mail utilizado para
            acessar o painel administrativo.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="student-login-field">
              <label htmlFor="admin-email">
                E-mail
              </label>

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
                disabled={loginLoading}
              />
            </div>

            <div className="student-login-field">
              <label htmlFor="admin-password">
                Senha
              </label>

              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setLoginError('')
                }}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                disabled={loginLoading}
              />
            </div>

            {loginError && (
              <div className="student-login-error">
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
                  <Loader2
                    size={19}
                    className="student-spin"
                  />
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
            <span>
              AB Academy
            </span>

            <span>
              Acesso exclusivo à administração
            </span>
          </div>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}