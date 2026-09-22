import { useEffect, useState } from 'react'
import {
  Eye,
  EyeOff,
  LockKeyhole,
  LogIn,
  Mail,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

import '../../styles/admin/AdminAccess.css'

type AdminAccessProps = {
  children: React.ReactNode
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
    event: React.FormEvent<HTMLFormElement>,
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
      <div className="admin-access-page">
        <div className="admin-access-card">
          <div className="admin-access-brand">
            <div className="admin-access-icon">
              <LockKeyhole size={25} />
            </div>

            <span>AB ACADEMY</span>
          </div>

          <div className="admin-access-header">
            <h1>Acesso administrativo</h1>

            <p>
              Entre com sua conta administrativa
              para acessar o painel da AB Academy.
            </p>
          </div>

          <form
            className="admin-access-form"
            onSubmit={handleSubmit}
          >
            <div className="admin-access-field">
              <label htmlFor="admin-email">
                E-mail
              </label>

              <div className="admin-access-input-wrapper">
                <Mail size={18} />

                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="seu@email.com"
                  autoComplete="email"
                  disabled={loginLoading}
                />
              </div>
            </div>

            <div className="admin-access-field">
              <label htmlFor="admin-password">
                Senha
              </label>

              <div className="admin-access-input-wrapper">
                <LockKeyhole size={18} />

                <input
                  id="admin-password"
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  disabled={loginLoading}
                />

                <button
                  type="button"
                  className="admin-access-password-toggle"
                  onClick={() =>
                    setShowPassword(
                      (current) => !current,
                    )
                  }
                  disabled={loginLoading}
                  aria-label={
                    showPassword
                      ? 'Ocultar senha'
                      : 'Mostrar senha'
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="admin-access-error">
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
                  <span className="admin-access-button-spinner" />
                  Entrando...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Entrar no painel
                </>
              )}
            </button>
          </form>

          <div className="admin-access-footer">
            <LockKeyhole size={14} />

            <span>
              Acesso restrito à equipe administrativa
            </span>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}