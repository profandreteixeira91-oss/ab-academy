import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  ArrowLeft, BookOpen, CheckCircle2, ChevronRight, CircleHelp,
  Filter, GraduationCap, Headphones, Languages, Loader2, PenLine, Search, Sparkles, Target,
} from 'lucide-react'
import logo from '../assets/logo_abacademy.png'
import { supabase } from '../lib/supabase'
import '../styles/central-atividades.css'

type Language = 'ingles' | 'alemao'
type Level = 'iniciante' | 'basico' | 'intermediario' | 'avancado' | 'fluente'
type Category = 'vocabulario' | 'gramatica' | 'leitura' | 'compreensao' | 'escrita' | 'cotidiano' | 'revisao'

type CentralActivity = {
  id: string
  idioma: Language
  nivel: Level
  categoria: Category
  tipo_exercicio: string
  titulo: string
  descricao: string | null
  instrucoes: string | null
  dificuldade: number
  tempo_estimado: number
  mes_referencia: string | null
}

type StudentProfile = {
  id: string
  nome_completo: string
  idioma: Language | null
  nivel_conversacao: Level | null
  nivel_escrita: Level | null
  nivel_compreensao: Level | null
}

const LEVELS: { value: Level; label: string; description: string }[] = [
  { value: 'iniciante', label: 'Iniciante', description: 'Primeiros contatos com o idioma.' },
  { value: 'basico', label: 'Básico', description: 'Estruturas e situações fundamentais.' },
  { value: 'intermediario', label: 'Intermediário', description: 'Comunicação com mais autonomia.' },
  { value: 'avancado', label: 'Avançado', description: 'Uso mais preciso e complexo.' },
  { value: 'fluente', label: 'Fluente', description: 'Prática para alta desenvoltura.' },
]

const CATEGORIES: { value: Category; label: string; icon: typeof BookOpen }[] = [
  { value: 'vocabulario', label: 'Vocabulário', icon: BookOpen },
  { value: 'gramatica', label: 'Gramática', icon: PenLine },
  { value: 'leitura', label: 'Leitura', icon: Search },
  { value: 'compreensao', label: 'Compreensão', icon: Headphones },
  { value: 'escrita', label: 'Escrita', icon: PenLine },
  { value: 'cotidiano', label: 'Cotidiano', icon: Languages },
  { value: 'revisao', label: 'Revisão', icon: CheckCircle2 },
]

const LANGUAGE_LABELS: Record<Language, string> = { ingles: 'Inglês', alemao: 'Alemão' }

const LEVEL_ORDER: Level[] = ['iniciante', 'basico', 'intermediario', 'avancado', 'fluente']

function getRecommendedLevel(profile: StudentProfile | null): Level {
  if (!profile) return 'iniciante'
  const values = [profile.nivel_conversacao, profile.nivel_escrita, profile.nivel_compreensao]
    .filter((value): value is Level => Boolean(value))
  if (!values.length) return 'iniciante'
  const indexes = values.map((value) => LEVEL_ORDER.indexOf(value))
  return LEVEL_ORDER[Math.max(0, Math.min(...indexes))]
}

function CentralAtividades() {
  const [user, setUser] = useState<User | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [activities, setActivities] = useState<CentralActivity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [language, setLanguage] = useState<Language | ''>('')
  const [level, setLevel] = useState<Level>('iniciante')
  const [category, setCategory] = useState<Category | 'todas'>('todas')
  const [search, setSearch] = useState('')
  const [activityStats, setActivityStats] = useState({ completed: 0, correct: 0 })

  useEffect(() => {
    let mounted = true
    async function loadSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      if (!session?.user) {
        window.location.replace('/aluno')
        return
      }
      setUser(session.user)
      setLoadingAuth(false)
    }
    void loadSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        window.location.replace('/aluno')
        return
      }
      setUser(session.user)
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function loadProfile() {
      const { data, error: profileError } = await supabase
        .from('alunos')
        .select('id, nome_completo, idioma, nivel_conversacao, nivel_escrita, nivel_compreensao')
        .eq('user_id', user.id)
        .maybeSingle()
      if (profileError) {
        console.error('Erro ao carregar perfil da central:', profileError)
        return
      }
      if (cancelled) return
      const nextProfile = (data || null) as StudentProfile | null
      setProfile(nextProfile)
      if (nextProfile?.idioma) setLanguage(nextProfile.idioma)
      setLevel(getRecommendedLevel(nextProfile))
    }
    void loadProfile()
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!profile?.id) {
      setActivityStats({ completed: 0, correct: 0 })
      return
    }

    let cancelled = false

    async function loadActivityStats() {
      const { data, error: statsError } = await supabase
        .from('central_respostas')
        .select('pontuacao, concluida')
        .eq('aluno_id', profile.id)
        .eq('concluida', true)

      if (cancelled) return

      if (statsError) {
        console.error('Erro ao carregar resumo das atividades:', statsError)
        setActivityStats({ completed: 0, correct: 0 })
        return
      }

      const completed = data?.length || 0
      const correct = (data || []).filter(
        (response) => typeof response.pontuacao === 'number' && response.pontuacao >= 100,
      ).length

      setActivityStats({ completed, correct })
    }

    void loadActivityStats()
    return () => { cancelled = true }
  }, [profile?.id])

  useEffect(() => {
    if (!user || !language) {
      setActivities([])
      return
    }
    let cancelled = false
    async function loadActivities() {
      setLoading(true)
      setError('')

      const { data: completedResponses, error: completedError } = await supabase
        .from('central_respostas')
        .select('atividade_id')
        .eq('aluno_id', profile?.id || '')
        .eq('concluida', true)

      if (cancelled) return

      if (completedError) {
        console.error('Erro ao verificar atividades já realizadas:', completedError)
        setActivities([])
        setError('Não foi possível verificar suas atividades realizadas.')
        setLoading(false)
        return
      }

      const completedIds = new Set((completedResponses || []).map((response) => response.atividade_id))

      let query = supabase
        .from('central_atividades')
        .select('id, idioma, nivel, categoria, tipo_exercicio, titulo, descricao, instrucoes, dificuldade, tempo_estimado, mes_referencia')
        .eq('idioma', language)
        .eq('nivel', level)
        .eq('status', 'publicada')
        .order('created_at', { ascending: false })
      if (category !== 'todas') query = query.eq('categoria', category)

      const { data, error: activitiesError } = await query
      if (cancelled) return

      if (activitiesError) {
        console.error('Erro ao carregar atividades da central:', activitiesError)
        setActivities([])
        setError('Não foi possível carregar as atividades no momento.')
      } else {
        setActivities((data || []).filter((activity) => !completedIds.has(activity.id)) as CentralActivity[])
      }
      setLoading(false)
    }
    void loadActivities()
    return () => { cancelled = true }
  }, [user, profile?.id, language, level, category])

  const filteredActivities = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return activities
    return activities.filter((activity) =>
      (activity.titulo + ' ' + (activity.descricao || '')).toLocaleLowerCase('pt-BR').includes(term),
    )
  }, [activities, search])

  const selectedLevel = LEVELS.find((item) => item.value === level)
  const [starting, setStarting] = useState(false)

  async function startActivities() {
    if (!language || starting) return

    setStarting(true)
    setError('')

    const firstAvailable = activities[activities.length - 1]

    if (!firstAvailable?.id) {
      setError('Você já realizou todas as atividades disponíveis para este idioma e nível.')
      setStarting(false)
      return
    }

    window.location.assign('/aluno/central/atividade/' + firstAvailable.id)
  }

  if (loadingAuth) {
    return (
      <div className="central-loading">
        <Loader2 size={28} className="central-spin" />
        <span>Carregando Central de Atividades...</span>
      </div>
    )
  }

  return (
    <div className="central-page">
      <header className="central-header">
        <div className="central-header-left">
          <a href="/aluno" className="central-back"><ArrowLeft size={18} /> Portal do aluno</a>
          <img src={logo} alt="AB Academy" className="central-logo" />
        </div>
        <div className="central-header-title">
          <span>AB ACADEMY</span>
          <strong>Central de Atividades</strong>
        </div>
      </header>

      <main className="central-main">
        <section className="central-hero">
          <div>
            <span className="central-eyebrow">PRÁTICA CONTÍNUA</span>
            <h1>Aprenda praticando.</h1>
            <p>Uma biblioteca de atividades organizada por idioma e nível para você praticar no seu ritmo.</p>
          </div>
          <div className="central-hero-badge"><Sparkles size={19} /> <span>Conteúdo em expansão</span></div>
        </section>

        <section className="central-profile-card">
          <div className="central-profile-icon"><GraduationCap size={21} /></div>
          <div className="central-profile-main">
            <span>SEU PERFIL DE PRÁTICA</span>
            <strong>{profile?.nome_completo || 'Aluno'}</strong>
            <p>
              Níveis cadastrados: Conversação — {profile?.nivel_conversacao || 'não informado'}
              {' · '}Escrita — {profile?.nivel_escrita || 'não informado'}
              {' · '}Compreensão — {profile?.nivel_compreensao || 'não informado'}
            </p>
          </div>
          <div className="central-profile-level">
            <small>Nível recomendado</small>
            <strong>{selectedLevel?.label || 'Iniciante'}</strong>
          </div>
        </section>

        <section className="central-activity-summary">
          <div className="central-summary-heading">
            <div>
              <span className="central-eyebrow">SEU RESUMO</span>
              <h2>Seu desempenho nas atividades</h2>
            </div>
            <Target size={22} />
          </div>
          <div className="central-summary-grid">
            <div className="central-summary-item">
              <div className="central-summary-icon"><CheckCircle2 size={20} /></div>
              <div>
                <strong>{activityStats.completed}</strong>
                <span>Atividades realizadas</span>
              </div>
            </div>
            <div className="central-summary-item">
              <div className="central-summary-icon"><Target size={20} /></div>
              <div>
                <strong>{activityStats.completed ? Math.round((activityStats.correct / activityStats.completed) * 100) : 0}%</strong>
                <span>Taxa de acertos</span>
              </div>
            </div>
          </div>
        </section>

        <section className="central-start-card">
          <div className="central-start-visual"><Sparkles size={30}/></div>
          <div className="central-start-content">
            <span className="central-eyebrow">SUA PRÁTICA</span>
            <h2>Pronto para praticar?</h2>
            <p>Vamos começar uma sequência de atividades preparada para <strong>{language ? LANGUAGE_LABELS[language] : 'seu idioma'}</strong> no nível <strong>{selectedLevel?.label || 'Iniciante'}</strong>. Você responderá uma atividade por vez e avançará automaticamente para a próxima.</p>
            <div className="central-start-meta">
              <span><Languages size={15}/> {language ? LANGUAGE_LABELS[language] : 'Idioma'}</span>
              <span><GraduationCap size={15}/> {selectedLevel?.label || 'Iniciante'}</span>
              <span><CheckCircle2 size={15}/> Atividades contínuas</span>
            </div>
          </div>
          <button type="button" className={language && !starting ? "central-start-button" : "central-start-button disabled"} onClick={() => void startActivities()} disabled={!language || starting}>
            {starting ? <><Loader2 size={19} className="central-spin"/> Abrindo atividades...</> : <>Iniciar atividades <ChevronRight size={20}/></>}
          </button>
        </section>

        <section className="central-how-it-works">
          <div><span>1</span><div><strong>Inicie</strong><small>Comece sua sessão de prática.</small></div></div>
          <div><span>2</span><div><strong>Responda</strong><small>Faça uma atividade por vez.</small></div></div>
          <div><span>3</span><div><strong>Avance</strong><small>Após concluir, siga para a próxima.</small></div></div>
        </section>

        {error && <div className="central-error"><CircleHelp size={18}/>{error}</div>}

        {!loading && !error && !activities.length && (
          <div className="central-empty">
            <div className="central-empty-icon"><BookOpen size={27}/></div>
            <h2>Seu conteúdo está sendo preparado</h2>
            <p>Ainda não há atividades publicadas para esta combinação de idioma e nível.</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default CentralAtividades
