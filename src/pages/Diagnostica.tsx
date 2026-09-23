import { useEffect, useState } from 'react'
import { ArrowRight, Clock3, Languages } from 'lucide-react'

import '../styles/diagnostica.css'
import '../styles/global.css'
import logo from '../assets/logo_abacademy.png'
import usaFlag from '../assets/flag-usa.svg'
import germanyFlag from '../assets/flag-germany.svg'
import { supabase } from '../lib/supabase'

type Language = 'ingles' | 'alemao'

type DiagnosticPlan = {
  id: string
  idioma: Language
  tipo: 'avulso'
  nome: string
  descricao: string | null
  preco: number
  ativo: boolean
}

const languageInfo: Record<Language, {
  label: string
  flag: string
}> = {
  ingles: {
    label: 'Inglês',
    flag: usaFlag,
  },
  alemao: {
    label: 'Alemão',
    flag: germanyFlag,
  },
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export default function Diagnostica() {
  const [plans, setPlans] = useState<DiagnosticPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadDiagnosticPlans() {
      const { data, error: queryError } = await supabase
        .from('planos')
        .select('id, idioma, tipo, nome, descricao, preco, ativo')
        .eq('tipo', 'avulso')
        .eq('ativo', true)
        .in('idioma', ['ingles', 'alemao'])

      if (!active) return

      if (queryError) {
        console.error('Erro ao carregar aula diagnóstica:', queryError)
        setError('Não foi possível carregar a aula diagnóstica no momento.')
        setLoading(false)
        return
      }

      setPlans((data || []) as DiagnosticPlan[])
      setLoading(false)
    }

    loadDiagnosticPlans()

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="diagnostic-page">
      <header className="diagnostic-header">
        <a href="/" className="diagnostic-logo">
          <img
            src={logo}
            alt="AB Academy"
            className="academy-header-logo"
          />
        </a>

        <a href="/planos" className="diagnostic-back">
          Voltar para planos
        </a>
      </header>

      <main className="diagnostic-main">
        <section className="diagnostic-hero">
          <span className="diagnostic-eyebrow">AULA DIAGNÓSTICA</span>
          <h1>Descubra seu nível e saiba exatamente por onde começar.</h1>
          <p>
            Uma aula individual de 60 minutos para avaliar seu nível de Inglês
            ou Alemão e orientar o melhor caminho de estudos.
          </p>

          <div className="diagnostic-highlight">
            <Clock3 size={20} />
            <span>60 minutos</span>
            <strong>R$ 50</strong>
            <span>pagamento único</span>
          </div>
        </section>

        <section className="diagnostic-content">
          <div className="diagnostic-section-heading">
            <div className="diagnostic-heading-icon">
              <Languages size={22} />
            </div>
            <div>
              <span>Escolha o idioma</span>
              <h2>Em qual idioma você quer fazer a aula?</h2>
            </div>
          </div>

          {loading && (
            <div className="diagnostic-state">
              Carregando opções...
            </div>
          )}

          {!loading && error && (
            <div className="diagnostic-state diagnostic-state-error">
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="diagnostic-grid">
              {(['ingles', 'alemao'] as Language[]).map((language) => {
                const plan = plans.find((item) => item.idioma === language)
                const info = languageInfo[language]

                if (!plan) return null

                return (
                  <article className="diagnostic-card" key={plan.id}>
                    <img src={info.flag} alt="" className="diagnostic-flag" />

                    <span className="diagnostic-card-label">
                      Aula diagnóstica
                    </span>

                    <h3>{info.label}</h3>

                    <p>
                      {plan.descricao ||
                        'Aula individual de 60 minutos para identificar seu nível e orientar seus próximos passos.'}
                    </p>

                    <div className="diagnostic-price">
                      {formatCurrency(Number(plan.preco))}
                      <small>pagamento único</small>
                    </div>

                    <a
                      href={'/matricula?idioma=' + plan.idioma + '&plano=' + plan.id + '&diagnostica=1'}
                      className="btn btn-primary diagnostic-cta"
                    >
                      Fazer aula diagnóstica
                      <ArrowRight size={17} />
                    </a>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
export default Diagnostica
