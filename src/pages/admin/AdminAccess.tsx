import { useEffect, useState } from 'react'
import { LockKeyhole, LogIn } from 'lucide-react'
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
    const email = window.prompt(
      'Digite o e-mail do administrador:',
    )

    if (!email) return

    const password = window.prompt(
      'Digite a senha:',
    )

    if (!password) return

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      })

    if (error) {
      alert(
        'Não foi possível realizar o login. Verifique seu e-mail e senha.',
      )

      return
    }

    await checkAdminAccess()
  }

  if (loading) {
    return (
      <div className="admin-access-page">
        <div className="admin-access-card">
          <div className="admin-access-icon">
            <LockKeyhole size={24} />
          </div>

          <h1>Verificando acesso</h1>

          <p>
            Aguarde enquanto verificamos suas
            permissões administrativas.
          </p>
        </div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="admin-access-page">
        <div className="admin-access-card">
          <div className="admin-access-icon">
            <LockKeyhole size={25} />
          </div>

          <h1>Acesso administrativo</h1>

          <p>
            Entre com sua conta administrativa para
            acessar o painel da AB Academy.
          </p>

          <button
            type="button"
            className="admin-access-button"
            onClick={handleLogin}
          >
            <LogIn size={18} />
            Entrar no painel
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}