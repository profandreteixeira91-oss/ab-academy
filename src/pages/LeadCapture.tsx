import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Languages, MessageCircle } from 'lucide-react'
import '../styles/lead-capture.css'
import { supabase } from '../lib/supabase'

type Language = 'ingles' | 'alemao' | 'ambos'
type Modality = 'individual' | 'dupla' | 'grupo'
type FormacaoTurma = 'ja_tenho_participantes' | 'preciso_formar_turma' | 'iniciar_individual'

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
    aulas_semana: initialModality === 'dupla' ? '1' : '2',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [commercialPrice, setCommercialPrice] = useState<number | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)
  const [formacaoTurma, setFormacaoTurma] = useState<FormacaoTurma>(
    initialModality === 'individual' ? 'ja_tenho_participantes' : 'preciso_formar_turma',
  )
  const [individualStartPrice, setIndividualStartPrice] = useState<number | null>(null)
  const [selectedFormationSlot, setSelectedFormationSlot] = useState<{ horario_id: string; idioma: Language; dia_semana: number; hora_inicio: string; hora_fim: string; tipo_horario: Modality; interessados: number; quantidade_maxima: number } | null>(null)

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`

  useEffect(() => {
    const horarioId = new URLSearchParams(window.location.search).get('horario_id')
    if (!horarioId) return
    let active = true
    async function loadFormationSlot() {
      const { data: response, error } = await supabase.functions.invoke('list-formation-slots', { body: { horario_id: horarioId } })
      const data = response?.data?.[0]
      if (!active || error || !data) return
      setSelectedFormationSlot(data as typeof selectedFormationSlot)
      setForm(current => ({
        ...current,
        idioma_interesse: data.idioma as Language,
        modalidade: data.tipo_horario as Modality,
        quantidade_participantes: data.tipo_horario === 'dupla' ? '2' : String(data.quantidade_maxima),
      }))
      setFormacaoTurma('preciso_formar_turma')
    }
    void loadFormationSlot()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (form.modalidade === 'individual' || form.idioma_interesse === 'ambos') {
      setCommercialPrice(null)
      return
    }

    let active = true
    async function loadCommercialPrice() {
      setPriceLoading(true)
      const aulasSemana = Number(form.aulas_semana)
      const quantidade = Number(form.quantidade_participantes)
      const { data: frequencia } = await supabase
        .from('modalidade_frequencias')
        .select('id')
        .eq('idioma', form.idioma_interesse)
        .eq('modalidade', form.modalidade)
        .eq('aulas_semana', aulasSemana)
        .eq('ativo', true)
        .maybeSingle()

      if (!active) return
      if (!frequencia) {
        setCommercialPrice(null)
        setPriceLoading(false)
        return
      }

      if (form.modalidade === 'dupla') {
        const { data } = await supabase.from('modalidade_frequencias').select('preco_mensal').eq('id', frequencia.id).maybeSingle()
        if (active) setCommercialPrice(data?.preco_mensal ?? null)
      } else {
        const { data } = await supabase
          .from('modalidade_frequencia_precos')
          .select('preco_mensal')
          .eq('frequencia_id', frequencia.id)
          .eq('quantidade_participantes', quantidade)
          .eq('ativo', true)
          .maybeSingle()
        if (active) setCommercialPrice(data?.preco_mensal ?? null)
      }
      if (active) setPriceLoading(false)
    }
    loadCommercialPrice()
    return () => { active = false }
  }, [form.modalidade, form.idioma_interesse, form.aulas_semana, form.quantidade_participantes])

  useEffect(() => {
    if (form.modalidade === 'individual' || form.idioma_interesse === 'ambos') {
      setIndividualStartPrice(null)
      return
    }
    let active = true
    async function loadIndividualStartPrice() {
      const { data } = await supabase
        .from('planos')
        .select('preco')
        .eq('idioma', form.idioma_interesse)
        .eq('modalidade', 'individual')
        .eq('tipo', 'mensal')
        .eq('ativo', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (active) setIndividualStartPrice(data?.preco ?? null)
    }
    void loadIndividualStartPrice()
    return () => { active = false }
  }, [form.modalidade, form.idioma_interesse])

  useEffect(() => {
    if (form.modalidade === 'individual') {
      setFormacaoTurma('ja_tenho_participantes')
    } else if (!formacaoTurma) {
      setFormacaoTurma('preciso_formar_turma')
    }
  }, [form.modalidade])

  function formatLeadPrice(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const tracking = getTracking()

    const aulasSemana = form.modalidade === 'individual' ? null : Number(form.aulas_semana)

    if (form.modalidade !== 'individual' && form.idioma_interesse === 'ambos') {
      setError('Para duplas e grupos, escolha um único idioma para a formação da turma.')
      setLoading(false)
      return
    }

    if (form.modalidade === 'dupla' && ![1, 2].includes(aulasSemana || 0)) {
      setError('Selecione uma frequência semanal válida para aulas em dupla.')
      setLoading(false)
      return
    }

    if (form.modalidade === 'grupo' && ![2, 3].includes(aulasSemana || 0)) {
      setError('Selecione uma frequência semanal válida para aulas em grupo.')
      setLoading(false)
      return
    }

    const quantidade = form.quantidade_participantes ? Number(form.quantidade_participantes) : null
    if (form.modalidade === 'dupla' && quantidade !== 2) {
      setError('Para aulas em dupla, informe exatamente 2 participantes.')
      setLoading(false)
      return
    }
    if (form.modalidade === 'grupo' && (!quantidade || quantidade < 3 || quantidade > 6)) {
      setError('Para aulas em grupo, informe entre 3 e 6 participantes.')
      setLoading(false)
      return
    }

    const { data: createdLead, error: insertError } = await supabase.from('leads').insert({
      ...form,
      origem: tracking.source,
      landing_page: new URLSearchParams(window.location.search).get('landing_page') || window.location.pathname,
      source: tracking.source,
      medium: tracking.medium,
      campaign: tracking.campaign,
      term: tracking.term,
      content: tracking.content,
      referrer: document.referrer || null,
      horario_id: selectedFormationSlot?.horario_id || null,
      modalidade: form.modalidade,
      formacao_turma: form.modalidade === 'individual' ? null : formacaoTurma,
      aulas_semana: aulasSemana,
      quantidade_participantes: quantidade,
      horario_preferido: form.horario_preferido || null,
    }).select('id').single()

    if (insertError || !createdLead) {
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
            Recebemos seu interesse em {languageLabels[form.idioma_interesse]}. {form.modalidade === 'individual' ? 'A equipe da AB Academy entrará em contato para orientar seus próximos passos.' : formacaoTurma === 'iniciar_individual' ? 'Você escolheu começar no plano individual. A equipe poderá acompanhar a formação da sua dupla ou turma e registrar a migração quando ela estiver pronta.' : 'Para duplas e grupos, a equipe confirmará os participantes e a formação da turma antes de liberar a matrícula.'}
          </p>
          <div className="lead-success-actions">
            {formacaoTurma === 'iniciar_individual' && form.idioma_interesse !== 'ambos' && <a href={`/planos?modalidade=individual&idioma=${form.idioma_interesse}${selectedFormationSlot ? `&horario_id=${encodeURIComponent(selectedFormationSlot.horario_id)}` : ''}`} className="lead-primary-button">Começar no plano individual <ArrowRight size={17} /></a>}
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

          {selectedFormationSlot && (
            <div className="lead-commercial-price">
              <span>Horário selecionado</span>
              <strong>{selectedFormationSlot.tipo_horario === 'dupla' ? 'Dupla' : 'Grupo'} · {selectedFormationSlot.dia_semana === 0 ? 'Domingo' : selectedFormationSlot.dia_semana === 1 ? 'Segunda-feira' : selectedFormationSlot.dia_semana === 2 ? 'Terça-feira' : selectedFormationSlot.dia_semana === 3 ? 'Quarta-feira' : selectedFormationSlot.dia_semana === 4 ? 'Quinta-feira' : selectedFormationSlot.dia_semana === 5 ? 'Sexta-feira' : 'Sábado'} · {selectedFormationSlot.hora_inicio.slice(0,5)}–{selectedFormationSlot.hora_fim.slice(0,5)}</strong>
              <small>{selectedFormationSlot.interessados} {selectedFormationSlot.interessados === 1 ? 'aluno já interessado' : 'alunos já interessados'}. Seus dados não serão exibidos aos demais interessados.</small>
            </div>
          )}

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
                  <input type="radio" name="modalidade" value={modality} checked={form.modalidade === modality} onChange={() => setForm({ ...form, modalidade: modality, quantidade_participantes: modality === 'dupla' ? '2' : '', aulas_semana: modality === 'dupla' ? '1' : modality === 'grupo' ? '2' : '' })} />
                  <span>{modality === 'individual' ? 'Individual' : modality === 'dupla' ? 'Dupla' : 'Grupo'}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {(form.modalidade === 'dupla' || form.modalidade === 'grupo') && (
            <>
              <div className="lead-form-grid">
                <label>Frequência semanal
                  <select required value={form.aulas_semana} onChange={(e) => setForm({ ...form, aulas_semana: e.target.value })}>
                    {form.modalidade === 'dupla' ? (
                      <>
                        <option value="1">1 aula por semana</option>
                        <option value="2">2 aulas por semana</option>
                        </> 
                    ) : (
                      <>
                        <option value="2">2 aulas por semana</option>
                        <option value="3">3 aulas por semana</option>
                      </>
                    )}
                  </select>
                </label>
                <label>{form.modalidade === 'dupla' ? 'Quantidade de participantes' : formacaoTurma === 'ja_tenho_participantes' ? 'Participantes da turma' : 'Tamanho desejado da turma'}
                  <input required min={form.modalidade === 'dupla' ? 2 : 3} max={form.modalidade === 'dupla' ? 2 : 6} type="number" value={form.quantidade_participantes} onChange={(e) => setForm({ ...form, quantidade_participantes: e.target.value })} placeholder={form.modalidade === 'dupla' ? '2' : 'Ex.: 5'} />
                </label>
              </div>
              <fieldset className="lead-group-formation">
                <legend>Você já tem os participantes?</legend>
                <div className="lead-language-options">
                  <label className={formacaoTurma === 'ja_tenho_participantes' ? 'selected' : ''}>
                    <input type="radio" name="formacao_turma" value="ja_tenho_participantes" checked={formacaoTurma === 'ja_tenho_participantes'} onChange={() => setFormacaoTurma('ja_tenho_participantes')} />
                    <span>Sim, já tenho minha {form.modalidade === 'dupla' ? 'dupla' : 'turma'}</span>
                  </label>
                  <label className={formacaoTurma === 'preciso_formar_turma' ? 'selected' : ''}>
                    <input type="radio" name="formacao_turma" value="preciso_formar_turma" checked={formacaoTurma === 'preciso_formar_turma'} onChange={() => setFormacaoTurma('preciso_formar_turma')} />
                    <span>Quero aguardar a formação</span>
                  </label>
                  <label className={formacaoTurma === 'iniciar_individual' ? 'selected' : ''}>
                    <input type="radio" name="formacao_turma" value="iniciar_individual" checked={formacaoTurma === 'iniciar_individual'} onChange={() => setFormacaoTurma('iniciar_individual')} />
                    <span>Quero começar agora no individual</span>
                  </label>
                </div>
                <p className="lead-group-formation-note">
                  {formacaoTurma === 'ja_tenho_participantes'
                    ? 'A AB Academy confirmará os participantes, nível e disponibilidade antes de liberar a matrícula e o valor da modalidade.'
                    : formacaoTurma === 'preciso_formar_turma'
                      ? 'A AB Academy poderá ajudar a formar uma turma compatível. Você aguarda a formação antes de iniciar.'
                      : 'Você pode começar imediatamente no plano individual com 10% de desconto enquanto aguarda a formação. Quando uma dupla ou turma compatível for formada, você migra para o valor coletivo correspondente.'}
                </p>
              </fieldset>

              <div className="lead-commercial-price" aria-live="polite">
                <span>Investimento estimado</span>
                <strong>{formacaoTurma === 'iniciar_individual' ? (individualStartPrice !== null ? formatLeadPrice(individualStartPrice) : 'A consultar') : formacaoTurma === 'preciso_formar_turma' ? 'A definir' : priceLoading ? 'Calculando...' : commercialPrice !== null ? formatLeadPrice(commercialPrice) : 'A consultar'}</strong>
                {formacaoTurma === 'iniciar_individual' && individualStartPrice !== null && <small>plano individual · por mês</small>}
                {commercialPrice !== null && formacaoTurma === 'ja_tenho_participantes' && <small>por aluno / mês · {form.aulas_semana}x por semana</small>}
                {form.modalidade === 'grupo' && <small>Valor individual conforme o tamanho da turma (3 a 6 participantes).</small>}
                {form.modalidade === 'dupla' && <small>Valor individual para a dupla.</small>}
                {formacaoTurma === 'iniciar_individual' && <small>Você começa agora no plano individual com 10% de desconto enquanto aguarda a formação. Quando a turma for formada, migra para o valor coletivo correspondente.</small>}
                <small>O valor exibido é uma referência comercial. A condição coletiva só começa após a confirmação da turma.</small>
              </div>

              <label>Melhor horário
                <input value={form.horario_preferido} onChange={(e) => setForm({ ...form, horario_preferido: e.target.value })} placeholder="Ex.: noites durante a semana ou sábados" />
              </label>
            </>
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
