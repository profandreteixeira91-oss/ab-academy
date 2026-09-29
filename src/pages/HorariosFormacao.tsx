import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Clock3, Users, UserRoundPlus } from 'lucide-react'
import '../styles/horarios-formacao.css'
import { supabase } from '../lib/supabase'

type Language = 'ingles' | 'alemao'
type Modality = 'dupla' | 'grupo'

type Opportunity = {
  horario_id: string
  idioma: Language
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  tipo_horario: Modality
  turma_status: string
  quantidade_minima: number
  quantidade_maxima: number
  interessados: number
}

const weekdays = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
const languageLabel = { ingles: 'Inglês', alemao: 'Alemão' }

function formatTime(value: string) { return value?.slice(0,5) || '' }

export default function HorariosFormacao() {
  const [items, setItems] = useState<Opportunity[]>([])
  const [language, setLanguage] = useState<Language | 'todos'>('todos')
  const [modality, setModality] = useState<Modality | 'todos'>('todos')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('horarios_formacao_publicos')
        .select('horario_id,idioma,dia_semana,hora_inicio,hora_fim,tipo_horario,turma_status,quantidade_minima,quantidade_maxima,interessados')
        .order('idioma')
        .order('dia_semana')
        .order('hora_inicio')
      if (error) {
        console.error('Erro ao carregar horários em formação:', error)
        setItems([])
      } else {
        setItems((data || []) as Opportunity[])
      }
      setLoading(false)
    }
    void load()
  }, [])

  const visible = useMemo(() => items.filter(item =>
    (language === 'todos' || item.idioma === language) &&
    (modality === 'todos' || item.tipo_horario === modality)
  ), [items, language, modality])

  return (
    <main className="formation-page">
      <header className="formation-header">
        <a href="/" className="formation-brand">AB Academy</a>
        <nav>
          <a href="/ingles">Inglês</a>
          <a href="/alemao">Alemão</a>
          <a href="/aulas">Formatos</a>
          <a href="/planos">Planos</a>
        </nav>
        <a href="/quero-aprender" className="formation-header-cta">Quero começar <ArrowRight size={16}/></a>
      </header>

      <section className="formation-hero">
        <div className="formation-container">
          <span className="formation-eyebrow"><Users size={15}/> FORMAÇÃO DE TURMAS</span>
          <h1>Encontre um horário que já tenha alunos interessados.</h1>
          <p>Escolha um horário compatível e entre na formação de uma dupla ou grupo. Os dados dos outros alunos permanecem protegidos.</p>
        </div>
      </section>

      <section className="formation-section">
        <div className="formation-container">
          <div className="formation-filters">
            <button className={language === 'todos' ? 'active' : ''} onClick={() => setLanguage('todos')}>Todos os idiomas</button>
            <button className={language === 'ingles' ? 'active' : ''} onClick={() => setLanguage('ingles')}>Inglês</button>
            <button className={language === 'alemao' ? 'active' : ''} onClick={() => setLanguage('alemao')}>Alemão</button>
            <span className="formation-filter-divider" />
            <button className={modality === 'todos' ? 'active' : ''} onClick={() => setModality('todos')}>Todos</button>
            <button className={modality === 'dupla' ? 'active' : ''} onClick={() => setModality('dupla')}>Duplas</button>
            <button className={modality === 'grupo' ? 'active' : ''} onClick={() => setModality('grupo')}>Grupos</button>
          </div>

          {loading ? <div className="formation-empty">Carregando horários...</div> : visible.length === 0 ? (
            <div className="formation-empty">
              <Users size={30}/>
              <strong>Nenhum horário em formação no momento.</strong>
              <span>Você ainda pode informar sua disponibilidade e a AB Academy poderá abrir uma nova formação.</span>
              <a href="/quero-aprender">Informar meu interesse <ArrowRight size={16}/></a>
            </div>
          ) : (
            <div className="formation-grid">
              {visible.map(item => {
                const remaining = Math.max(item.quantidade_maxima - item.interessados, 0)
                const typeLabel = item.tipo_horario === 'dupla' ? 'Dupla' : 'Grupo'
                return (
                  <article className="formation-card" key={item.horario_id}>
                    <div className="formation-card-top">
                      <span>{languageLabel[item.idioma]}</span>
                      <strong>{typeLabel}</strong>
                    </div>
                    <h2>{weekdays[item.dia_semana]}</h2>
                    <div className="formation-time"><Clock3 size={18}/><strong>{formatTime(item.hora_inicio)}–{formatTime(item.hora_fim)}</strong></div>
                    <div className="formation-progress-row">
                      <span>{item.interessados} {item.interessados === 1 ? 'aluno interessado' : 'alunos interessados'}</span>
                      <span>{remaining > 0 ? `falta${remaining > 1 ? 'm' : ''} ${remaining}` : 'completo'}</span>
                    </div>
                    <div className="formation-progress"><span style={{ width: Math.min(100, (item.interessados / item.quantidade_maxima) * 100) + '%' }} /></div>
                    <p>{item.tipo_horario === 'dupla'
                      ? `Esta dupla precisa de ${Math.max(0, 2 - item.interessados)} aluno${Math.max(0, 2 - item.interessados) === 1 ? '' : 's'} para ser formada.`
                      : `Este grupo pode receber até ${item.quantidade_maxima} participantes.`}</p>
                    <a href={`/quero-aprender?modalidade=${item.tipo_horario}&idioma=${item.idioma}&horario_id=${item.horario_id}`} className="formation-join">Tenho interesse neste horário <ArrowRight size={16}/></a>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>
      <footer className="formation-footer"><span><strong>AB Academy Idiomas</strong>® 2026 - todos os direitos reservados</span><a href="/quero-aprender">Não encontrei meu horário</a></footer>
    </main>
  )
}
