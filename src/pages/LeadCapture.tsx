import { FormEvent, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Languages, MessageCircle } from 'lucide-react'
import '../styles/lead-capture.css'
import { supabase } from '../lib/supabase'

type Language = 'ingles' | 'alemao' | 'ambos'
type Modality = 'individual' | 'dupla' | 'grupo'
type Modality = 'individual' | 'dupla' | 'grupo'

const languageLabels: Record<Language, string> = {
  ingles: 'Inglês',
  alemao: 'Alemão',
  ambos: 'Inglês e Alemão',
}

const WHATSAPP_NUMBER = '5511999738440'
const WHATSAPP_MESSAGE = 'Olá! Tenho interesse em estudar na AB Academy e gostaria de saber mais.'

function getTracking() {
  const params = new URLSearchParams(window.location.search)
  let stored: Record<string, string> = {}

  try {
    stored = JSON.parse(sessionStorage.getItem('abacademy_attribution') || '{}') as Record<string, string>
  } catch {
    stored = {}
  }

  return {
    source: params.get('utm_source') || params.get('source') || stored.source || 'site',
    medium: params.get('utm_medium') || stored.medium || null,
    campaign: params.get('utm_campaign') || stored.campaign || null,
    term: params.get('utm_term') || stored.term || null,
    content: params.get('utm_content') || stored.content || null,
  }
}

export default function LeadCapture() {
  const initialModality = useMemo<Modality>(() => {
    const value = new URLSearchParams(window.location.search).get('modalidade')
    return value === 'dupla' || value === 'grupo' ? value : 'individual'
  }, [])

  const initialModality = useMemo<Modality>(() => {
    const value = new URLSearchParams(window.location.search).get('modalidade')
    return value === 'dupla' || value === 'grupo' ? value : 'individual'
  }, [])

  const initialLanguage = useMemo<Language>(() => {
    const value = new URLSearchParams(window.location.search).get('idioma')
    return value === 'ingles' || value === 'alemao' || value === 'ambos' ? value : 'ingles'
  }, [])

  const [form, setForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    idioma_interesse: initialLanguage as Language,
    objetivo: '',
    nivel: '',
    modalidade: initialModality as Modality,
    quantidade_participantes: initialModality === 'dupla' ? '2' : '',
    horario_preferido: '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const tracking = getTracking()

    const { error: insertError } = await supabase.from('leads').insert({
      ...form,
      origem: tracking.source,
      landing_page: new URLSearchParams(window.location.search).get('landing_page') || window.location.pathname,
      source: tracking.source,
      medium: tracking.medium,
      campaign: tracking.campaign,
      term: tracking.term,
      content: tracking.content,
      referrer: document.referrer || null,
      modalidade: form.modalidade,
      quantidade_participantes: form.quantidade_participantes ? Number(form.quantidade_participantes) : null,
      horario_preferido: form.horario_preferido || null,
    })

    if (insertError) {
      console.error('Erro ao registrar lead:', insertError)
      setError('Não foi possível enviar seus dados agora. Tente novamente em instantes.')
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <main className="lead-page">
        <section className="lead-success-card">
          <div className="lead-success-icon"><CheckCircle2 size={34} /></div>
          <span className="lead-eyebrow">Cadastro recebido</span>
          <h1>Obrigado, {form.nome.split(' ')[0] || 'por seu interesse'}.</h1>
          <p>
            Recebemos seu interesse em {languageLabels[form.idioma_interesse]}. A equipe da AB Academy entrará em contato para orientar seus próximos passos.
          </p>
          <div className="lead-success-actions">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="lead-whatsapp-button">
              <MessageCircle size={17} /> Falar pelo WhatsApp
            </a>
            <a href="/diagnostica" className="lead-primary-button">Conhecer a aula diagnóstica <ArrowRight size={17} /></a>
            <a href="/" className="lead-secondary-button">Voltar para o site</a>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="lead-page">
      <section className="lead-shell">
        <div className="lead-intro">
          <a href="/" className="lead-brand">AB Academy</a>
          <span className="lead-eyebrow"><Languages size={15} /> Comece sua jornada</span>
          <h1>Vamos encontrar o melhor caminho para você aprender um novo idioma.</h1>
          <p>
            Conte um pouco sobre seu objetivo. Nossa equipe poderá orientar você sobre o idioma, o nível e a melhor forma de começar.
          </p>
          <div className="lead-benefits">
            <span><CheckCircle2 size={17} /> Atendimento personalizado</span>
            <span><CheckCircle2 size={17} /> Inglês e Alemão</span>
            <span><CheckCircle2 size={17} /> Metodologia prática</span>
          </div>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="lead-whatsapp-note">
            <MessageCircle size={18} />
            <div>
              <strong>Prefere conversar?</strong>
              <span>Fale diretamente com a AB Academy pelo WhatsApp.</span>
            </div>
            <ArrowRight size={16} />
          </a>
        </div>

        <form className="lead-form" onSubmit={handleSubmit}>
          <div className="lead-form-heading">
            <span>Fale com a AB Academy</span>
            <h2>Seus dados</h2>
            <p>Leva menos de um minuto.</p>
          </div>

          <label>Nome completo<input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Seu nome" /></label>
          <div className="lead-form-grid">
            <label>E-mail<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="voce@email.com" /></label>
            <label>WhatsApp<input required type="tel" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" /></label>
          </div>

          <fieldset>
            <legend>Como você quer estudar?</legend>
            <div className="lead-language-options">
              {(['individual','dupla','grupo'] as Modality[]).map((modality) => (
                <label className={form.modalidade === modality ? 'selected' : ''} key={modality}>
                  <input type="radio" name="modalidade" value={modality} checked={form.modalidade === modality} onChange={() => setForm({ ...form, modalidade: modality, quantidade_participantes: modality === 'dupla' ? '2' : '' })} />
                  <span>{modality === 'individual' ? 'Individual' : modality === 'dupla' ? 'Dupla' : 'Grupo'}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {(form.modalidade === 'dupla' || form.modalidade === 'grupo') && (
            <div className="lead-form-grid">
              <label>Quantidade de participantes
                <input required min={form.modalidade === 'dupla' ? 2 : 3} max="50" type="number" value={form.quantidade_participantes} onChange={(e) => setForm({ ...form, quantidade_participantes: e.target.value })} placeholder={form.modalidade === 'dupla' ? '2' : 'Ex.: 5'} />
              </label>
              <label>Melhor horário para o grupo
                <input value={form.horario_preferido} onChange={(e) => setForm({ ...form, horario_preferido: e.target.value })} placeholder="Ex.: noites durante a semana" />
              </label>
            </div>
          )}

          <fieldset>
            <legend>Como você quer estudar?</legend>
            <div className="lead-language-options">
              {(['individual','dupla','grupo'] as Modality[]).map((modality) => (
                <label className={form.modalidade === modality ? 'selected' : ''} key={modality}>
                  <input type="radio" name="modalidade" value={modality} checked={form.modalidade === modality} onChange={() => setForm({ ...form, modalidade: modality, quantidade_participantes: modality === 'dupla' ? '2' : '' })} />
                  <span>{modality === 'individual' ? 'Individual' : modality === 'dupla' ? 'Dupla' : 'Grupo'}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {(form.modalidade === 'dupla' || form.modalidade === 'grupo') && (
            <div className="lead-form-grid">
              <label>Quantidade de participantes
                <input required min={form.modalidade === 'dupla' ? 2 : 3} max="50" type="number" value={form.quantidade_participantes} onChange={(e) => setForm({ ...form, quantidade_participantes: e.target.value })} placeholder={form.modalidade === 'dupla' ? '2' : 'Ex.: 5'} />
              </label>
              <label>Melhor horário para o grupo
                <input value={form.horario_preferido} onChange={(e) => setForm({ ...form, horario_preferido: e.target.value })} placeholder="Ex.: noites durante a semana" />
              </label>
            </div>
          )}

          <fieldset>
            <legend>Qual idioma você quer aprender?</legend>
            <div className="lead-language-options">
              {(['ingles', 'alemao', 'ambos'] as Language[]).map((language) => (
                <label className={form.idioma_interesse === language ? 'selected' : ''} key={language}>
                  <input type="radio" name="idioma" value={language} checked={form.idioma_interesse === language} onChange={() => setForm({ ...form, idioma_interesse: language })} />
                  <span>{languageLabels[language]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="lead-form-grid">
            <label>Seu objetivo
              <select value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })}>
                <option value="">Selecione</option>
                <option value="conversacao">Conversação</option>
                <option value="trabalho">Trabalho</option>
                <option value="viagem">Viagem</option>
                <option value="estudos">Estudos</option>
                <option value="mudanca_exterior">Morar no exterior</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label>Seu nível atual
              <select value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value })}>
                <option value="">Ainda não sei</option>
                <option value="basico">Básico</option>
                <option value="intermediario">Intermediário</option>
                <option value="avancado">Avançado</option>
              </select>
            </label>
          </div>

          {error && <div className="lead-form-error">{error}</div>}

          <button type="submit" className="lead-primary-button lead-submit" disabled={loading}>
            {loading ? 'Enviando...' : 'Quero saber mais'}
            {!loading && <ArrowRight size={17} />}
          </button>

          <small className="lead-privacy">Seus dados serão usados exclusivamente para atendimento da AB Academy.</small>
        </form>
      </section>
    </main>
  )
}
