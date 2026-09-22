import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  ArrowLeft, BookOpen, CheckCircle2, ChevronRight, CircleHelp,
  Filter, GraduationCap, Headphones, Languages, Loader2, PenLine, Search, Sparkles,
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
    if (!user || !language) {
      setActivities([])
      return
    }
    let cancelled = false
    async function loadActivities() {
      setLoading(true)
      setError('')
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
        setActivities((data || []) as CentralActivity[])
      }
      setLoading(false)
    }
    void loadActivities()
    return () => { cancelled = true }
  }, [user, language, level, category])

  const filteredActivities = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return activities
    return activities.filter((activity) =>
      (activity.titulo + ' ' + (activity.descricao || '')).toLocaleLowerCase('pt-BR').includes(term),
    )
  }, [activities, search])

  const selectedLevel = LEVELS.find((item) => item.value === level)

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

        <section className="central-filters">
          <div className="central-filter-heading">
            <div><Filter size={18} /><strong>Escolha sua prática</strong></div>
            <span>{filteredActivities.length} atividade(s)</span>
          </div>
          <div className="central-filter-grid">
            <label>
              <span>Idioma</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
                <option value="" disabled>Selecione</option>
                <option value="ingles">Inglês</option>
                <option value="alemao">Alemão</option>
              </select>
            </label>
            <label>
              <span>Nível</span>
              <select value={level} onChange={(event) => setLevel(event.target.value as Level)}>
                {LEVELS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label>
              <span>Categoria</span>
              <select value={category} onChange={(event) => setCategory(event.target.value as Category | 'todas')}>
                <option value="todas">Todas as categorias</option>
                {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="central-search-field">
              <span>Buscar</span>
              <div><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar atividade..." /></div>
            </label>
          </div>
        </section>

        <section className="central-levels">
          {LEVELS.map((item) => (
            <button key={item.value} type="button" className={item.value === level ? 'active' : ''} onClick={() => setLevel(item.value)}>
              <span>{item.label}</span><small>{item.description}</small>
            </button>
          ))}
        </section>

        {error && <div className="central-error"><CircleHelp size={18} />{error}</div>}

        {loading ? (
          <div className="central-empty"><Loader2 size={28} className="central-spin" /><h2>Carregando atividades</h2><p>Buscando práticas disponíveis para seu nível.</p></div>
        ) : filteredActivities.length === 0 ? (
          <div className="central-empty">
            <div className="central-empty-icon"><BookOpen size={27} /></div>
            <h2>Estamos preparando seu conteúdo</h2>
            <p>Ainda não há atividades publicadas para <strong>{LANGUAGE_LABELS[language as Language] || 'este idioma'}</strong> no nível <strong>{selectedLevel?.label || 'selecionado'}</strong>. A biblioteca será alimentada continuamente.</p>
            <button type="button" className="central-primary-button" onClick={() => setCategory('todas')}>
              Ver todas as categorias <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          <div className="central-activity-grid">
            {filteredActivities.map((activity) => {
              const CategoryIcon = CATEGORIES.find((item) => item.value === activity.categoria)?.icon || BookOpen
              return (
                <article key={activity.id} className="central-activity-card">
                  <div className="central-activity-icon"><CategoryIcon size={21} /></div>
                  <div className="central-activity-content">
                    <div className="central-activity-top">
                      <span>{CATEGORIES.find((item) => item.value === activity.categoria)?.label}</span>
                      <small>{activity.tempo_estimado} min</small>
                    </div>
                    <h2>{activity.titulo}</h2>
                    <p>{activity.descricao || activity.instrucoes || 'Pratique este conteúdo e desenvolva suas habilidades no idioma.'}</p>
                    <div className="central-activity-meta">
                      <span>{LANGUAGE_LABELS[activity.idioma]}</span>
                      <span>{LEVELS.find((item) => item.value === activity.nivel)?.label}</span>
                      <span>Dificuldade {activity.dificuldade}/5</span>
                    </div>
                  </div>
                  <button type="button" className="central-primary-button central-activity-button" disabled title="O motor de resolução será implementado na próxima etapa.">
                    Praticar <ChevronRight size={18} />
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export default CentralAtividades
