import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type ProfessorAccessProps = {
  children: React.ReactNode
}

export default function ProfessorAccess({
  children,
}: ProfessorAccessProps) {
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    checkAccess()
  }, [])

  async function checkAccess() {
    try {
      setLoading(true)
      setAuthorized(false)
      setMessage('')

      /*
       * =========================================================
       * USUÁRIO AUTENTICADO
       * =========================================================
       */

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        throw sessionError
      }

      if (!session?.user) {
        window.location.href = '/professor'
        return
      }

      /*
       * =========================================================
       * ID DA AULA NA URL
       * =========================================================
       */

      const path = window.location.pathname
      const parts = path.split('/').filter(Boolean)

      const lessonId = parts[parts.length - 1]

      if (!lessonId) {
        setMessage('Aula não identificada.')
        return
      }

      /*
       * =========================================================
       * PROFESSOR LOGADO
       * =========================================================
       */

      const { data: professor, error: professorError } =
        await supabase
          .from('professores')
          .select(
            'id, user_id, nome_completo, ativo, acesso_portal',
          )
          .eq('user_id', session.user.id)
          .maybeSingle()

      if (professorError) {
        throw professorError
      }

      if (!professor) {
        setMessage(
          'Seu usuário não está cadastrado como professor.',
        )
        return
      }

      /*
       * =========================================================
       * STATUS DO PROFESSOR
       * =========================================================
       */

      if (!professor.ativo) {
        setMessage(
          'Seu cadastro de professor está inativo.',
        )
        return
      }

      if (!professor.acesso_portal) {
        setMessage(
          'Seu acesso ao portal do professor está bloqueado.',
        )
        return
      }

      /*
       * =========================================================
       * VERIFICA SE A AULA PERTENCE AO PROFESSOR
       * =========================================================
       */

      const { data: horario, error: horarioError } =
        await supabase
          .from('horarios')
          .select('id, professor_id')
          .eq('id', lessonId)
          .eq('professor_id', professor.id)
          .maybeSingle()

      if (horarioError) {
        throw horarioError
      }

      if (!horario) {
        setMessage(
          'Esta aula não está atribuída ao seu cadastro de professor.',
        )
        return
      }

      /*
       * =========================================================
       * ACESSO AUTORIZADO
       * =========================================================
       */

      setAuthorized(true)
    } catch (error) {
      console.error(
        'Erro ao validar acesso à sala do professor:',
        error,
      )

      setMessage(
        'Não foi possível validar seu acesso à aula.',
      )
    } finally {
      setLoading(false)
    }
  }

  /*
   * =========================================================
   * CARREGANDO
   * =========================================================
   */

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f6f7fb',
          padding: '24px',
        }}
      >
        <div
          style={{
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              border: '4px solid #e5e7eb',
              borderTopColor: '#111827',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 0.8s linear infinite',
            }}
          />

          <p
            style={{
              margin: 0,
              color: '#4b5563',
            }}
          >
            Verificando acesso à aula...
          </p>
        </div>

        <style>
          {`
            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}
        </style>
      </div>
    )
  }

  /*
   * =========================================================
   * ACESSO NEGADO
   * =========================================================
   */

  if (!authorized) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f6f7fb',
          padding: '24px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '480px',
            background: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            textAlign: 'center',
            boxShadow:
              '0 10px 30px rgba(0, 0, 0, 0.08)',
          }}
        >
          <h1
            style={{
              margin: '0 0 12px',
              fontSize: '24px',
              color: '#111827',
            }}
          >
            Acesso não autorizado
          </h1>

          <p
            style={{
              margin: '0 0 24px',
              lineHeight: 1.6,
              color: '#6b7280',
            }}
          >
            {message ||
              'Você não possui acesso a esta sala de aula.'}
          </p>

          <button
            type="button"
            onClick={() => {
              window.location.href = '/professor'
            }}
            style={{
              border: 0,
              borderRadius: '10px',
              padding: '12px 20px',
              background: '#111827',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            Voltar para o portal
          </button>
        </div>
      </div>
    )
  }

  /*
   * =========================================================
   * SALA AUTORIZADA
   * =========================================================
   */

  return <>{children}</>
}