import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Clock3, Menu, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import '../styles/planos.css'
import logo from '../assets/logo_abacademy.png'
import usaFlag from '../assets/flag-usa.svg'
import germanyFlag from '../assets/flag-germany.svg'

type Plano = {
  id: string
  idioma: 'ingles' | 'alemao'
  tipo: 'mensal' | 'anual' | 'personalizado' | 'intensivo' | 'avulso'
  nome: string
  descricao: string | null
  beneficios: string[] | null
  preco: number
  parcelas: number | null
  valor_parcela: number | null
  ativo: boolean
  modalidade: 'individual' | 'dupla' | 'grupo'
  min_alunos: number | null
  max_alunos: number | null
  aulas_semana: number | null
  created_at?: string | null
}

const ordemTipos: Plano['tipo'][] = ['mensal', 'anual', 'personalizado', 'intensivo']
function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function getPlanCta(tipo: Plano['tipo'], idioma: Plano['idioma']) {
  if (tipo === 'mensal') return 'Quero começar'
  if (tipo === 'anual') return 'Quero garantir minha vaga'
  if (tipo === 'personalizado') {
    return idioma === 'ingles' ? 'Quero acelerar meu inglês' : 'Quero acelerar meu alemão'
  }
  return 'Quero alcançar meu objetivo'
}

function getPlanPrice(plano: Plano) {
  if (plano.tipo === 'anual' && plano.valor_parcela !== null) {
    return {
      value: formatCurrency(Number(plano.valor_parcela)),
      suffix: '/mês',
      detail: formatCurrency(Number(plano.preco)) + ' no plano anual',
    }
  }

  return {
    value: formatCurrency(Number(plano.preco)),
    suffix: '/mês',
    detail: 'Cobrança mensal',
  }
}

type HorarioColetivo = {
  id: string
  idioma: 'ingles' | 'alemao'
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  disponivel: boolean
  aluno_id: string | null
  professor_id: string | null
  professor_nome: string | null
  tipo_horario: 'dupla' | 'grupo'
  nivel_referencia: string | null
  vagas_restantes: number
  participantes: number
}

const WEEKDAYS = [
  { value: 0, short: 'Dom' }, { value: 1, short: 'Seg' }, { value: 2, short: 'Ter' },
  { value: 3, short: 'Qua' }, { value: 4, short: 'Qui' }, { value: 5, short: 'Sex' }, { value: 6, short: 'Sáb' },
]

const NIVEIS = ['iniciante', 'basico', 'intermediario', 'avancado'] as const
const NIVEL_LABELS: Record<(typeof NIVEIS)[number], string> = { iniciante: 'Iniciante', basico: 'Básico', intermediario: 'Intermediário', avancado: 'Avançado' }

function formatTime(value: string) { return value.slice(0, 5) }
function getWeekdayLabel(value: number) { return WEEKDAYS.find((day) => day.value === value)?.short ?? '—' }

function buildScheduleCombinations(candidatos: HorarioColetivo[], frequencia: number) {
  const resultado: HorarioColetivo[][] = []
  function visit(start: number, atual: HorarioColetivo[]) {
    if (atual.length === frequencia) {
      resultado.push([...atual])
      return
    }
    for (let index = start; index < candidatos.length; index += 1) {
      const candidato = candidatos[index]
      if (atual.some((item) => item.dia_semana === candidato.dia_semana)) continue
      if (atual.length > 0) {
        const referencia = atual[0]
        if (referencia.professor_id !== candidato.professor_id || referencia.hora_inicio !== candidato.hora_inicio || referencia.hora_fim !== candidato.hora_fim) continue
      }
      visit(index + 1, [...atual, candidato])
    }
  }
  visit(0, [])
  return resultado
}

function ModalidadeCard({
  modalidade, idioma, planos, horarios, nivel,
}: {
  modalidade: 'dupla' | 'grupo'
  idioma: 'ingles' | 'alemao'
  planos: Plano[]
  horarios: HorarioColetivo[]
  nivel: string
}) {
  const planosColetivos = planos
    .filter((plano) => plano.idioma === idioma && plano.modalidade === modalidade && plano.tipo === 'mensal')
    .sort((a, b) => (a.aulas_semana ?? 0) - (b.aulas_semana ?? 0))

  const filtrados = nivel ? horarios.filter((horario) => horario.nivel_referencia === nivel) : horarios
  const horariosDisponiveis = filtrados.filter((horario) => horario.disponivel)
  const horariosIndisponiveis = filtrados.filter((horario) => !horario.disponivel)
  const [expandedScheduleKey, setExpandedScheduleKey] = useState<string | null>(null)
  const [formationPrices, setFormationPrices] = useState<Record<string, number>>({})
  const [formationPriceLoading, setFormationPriceLoading] = useState<string | null>(null)
  const [reserveTarget, setReserveTarget] = useState<{ key: string; plano: Plano; horarios: HorarioColetivo[] } | null>(null)
  const [reserveName, setReserveName] = useState('')
  const [reserveEmail, setReserveEmail] = useState('')
  const [reservePhone, setReservePhone] = useState('')
  const [reserveSaving, setReserveSaving] = useState(false)
  const [reserveMessage, setReserveMessage] = useState('')

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 10) {
      return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
    }
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
  }

  const handleChooseSchedule = async (key: string, plano: Plano, horariosDaOpcao: HorarioColetivo[]) => {
    setReserveMessage('')
    setReserveTarget(null)
    if (expandedScheduleKey === key) {
      setExpandedScheduleKey(null)
      return
    }
    setExpandedScheduleKey(key)

    if (horariosDaOpcao.some((horario) => horario.participantes > 0) || formationPrices[key] !== undefined) return

    setFormationPriceLoading(key)
    const { data, error: priceError } = await supabase.rpc('preco_formacao_coletiva', {
      p_idioma: idioma,
      p_modalidade: modalidade,
      p_aulas_semana: plano.aulas_semana ?? 1,
    })
    if (!priceError && Number(data ?? 0) > 0) {
      setFormationPrices((current) => ({ ...current, [key]: Number(data) }))
    }
    setFormationPriceLoading(null)
  }

  const submitReserve = async () => {
    if (!reserveTarget) return
    const phoneDigits = reservePhone.replace(/\D/g, '')
    if (!reserveName.trim() || !reserveEmail.trim() || phoneDigits.length < 10) {
      setReserveMessage('Informe nome, e-mail e WhatsApp para reservar a vaga.')
      return
    }

    setReserveSaving(true)
    setReserveMessage('')
    const first = reserveTarget.horarios[0]
    const scheduleText = reserveTarget.horarios
      .map((item) => getWeekdayLabel(item.dia_semana) + ' ' + formatTime(item.hora_inicio) + '-' + formatTime(item.hora_fim))
      .join(' | ')

    const { error: leadError } = await supabase.from('leads').insert({
      nome: reserveName.trim(),
      email: reserveEmail.trim().toLowerCase(),
      telefone: phoneDigits,
      idioma_interesse: reserveTarget.plano.idioma,
      origem: 'matricula',
      landing_page: window.location.pathname,
      status: 'novo',
      observacoes: 'Reserva de vaga em horário coletivo: ' + scheduleText + '.',
      modalidade: reserveTarget.plano.modalidade,
      quantidade_participantes: 1,
      horario_preferido: scheduleText,
      aulas_semana: reserveTarget.plano.aulas_semana ?? 1,
      formacao_turma: 'reservar_vaga',
      horario_id: first?.id ?? null,
      turma_id: null,
    })

    if (leadError) {
      console.error('Erro ao registrar reserva de vaga:', leadError)
      setReserveMessage('Não foi possível registrar sua reserva. Tente novamente.')
    } else {
      setReserveMessage('Sua solicitação foi registrada. A equipe da AB Academy entrará em contato para confirmar a turma.')
      setReserveName('')
      setReserveEmail('')
      setReservePhone('')
    }
    setReserveSaving(false)
  }

  const opcoes = planosColetivos.flatMap((plano) =>
    buildScheduleCombinations(
      horariosDisponiveis,
      plano.aulas_semana ?? 1,
    ).map((horariosDaOpcao) => ({ plano, horariosDaOpcao })),
  )

  return (
    <article className={'planos-detail-card planos-detail-card--' + modalidade}>
      <span className="planos-detail-tag">{modalidade === 'dupla' ? 'Até 2 participantes' : 'Até 3 participantes'}</span>
      <h3>{modalidade === 'dupla' ? 'Aulas em dupla' : 'Aulas em grupo / trio'}</h3>
      <p className="planos-detail-description">
        Escolha um horário disponível na agenda. O preço exibido é sempre o valor atual cadastrado pelo administrador.
      </p>

      <div className="planos-collective-section">
        <div className="planos-collective-section-heading">
          <span className="planos-collective-kicker">Horários disponíveis</span>
          <strong>{nivel ? 'Nível ' + (NIVEL_LABELS[nivel as keyof typeof NIVEL_LABELS] || nivel) : 'Todos os níveis configurados'}</strong>
          <p>Os horários são carregados diretamente da agenda e os preços diretamente dos planos ativos.</p>
        </div>

        <div className="planos-frequency-list">
          {opcoes.map(({ plano, horariosDaOpcao }) => {
            const frequencia = plano.aulas_semana ?? 1
            const individualPlan = planos.find((item) =>
              item.idioma === idioma
              && item.modalidade === 'individual'
              && item.ativo
              && item.tipo === (frequencia === 1 ? 'mensal' : frequencia === 2 ? 'personalizado' : 'intensivo')
              && (item.aulas_semana ?? 1) === frequencia
            )
            const vagasRestantes = Math.min(...horariosDaOpcao.map((horario) => horario.vagas_restantes))
            return (
              <div className="planos-frequency-card planos-frequency-card--regular" key={plano.id + ':' + horariosDaOpcao.map((item) => item.id).join('-')}>
                <div className="planos-frequency-heading">
                  <strong>{frequencia}x por semana</strong>
                  <span>{formatCurrency(Number(plano.preco))}<small>/aluno/mês</small></span>
                </div>
                <div className="planos-schedule-list">
                  {horariosDaOpcao.map((horario) => (
                    <div className="planos-schedule-row" key={horario.id}>
                      <strong>{getWeekdayLabel(horario.dia_semana)}</strong>
                      <span>{formatTime(horario.hora_inicio)}–{formatTime(horario.hora_fim)}</span>
                    </div>
                  ))}
                  <div className="planos-schedule-row">
                    <strong>Nível</strong>
                    <span>{NIVEL_LABELS[(horariosDaOpcao[0]?.nivel_referencia || nivel || '') as keyof typeof NIVEL_LABELS] || horariosDaOpcao[0]?.nivel_referencia || nivel || 'A confirmar'}</span>
                  </div>
                </div>
                <p>
                  {horariosDaOpcao[0]?.professor_nome ? 'Professor: ' + horariosDaOpcao[0].professor_nome : 'Professor a confirmar'}
                  {' · '}{NIVEL_LABELS[(nivel || horariosDaOpcao[0]?.nivel_referencia || '') as keyof typeof NIVEL_LABELS] || nivel || horariosDaOpcao[0]?.nivel_referencia || 'Nível a confirmar'}
                  {' · '}{vagasRestantes} {vagasRestantes === 1 ? 'vaga disponível' : 'vagas disponíveis'}
                </p>
                <button
                  type="button"
                  className="btn btn-outline planos-collective-cta"
                  onClick={() => void handleChooseSchedule(plano.id + ':' + horariosDaOpcao.map((item) => item.id).join('-'), plano, horariosDaOpcao)}
                >
                  {expandedScheduleKey === plano.id + ':' + horariosDaOpcao.map((item) => item.id).join('-') ? 'Fechar opções' : 'Escolher este horário'}
                  <ArrowRight size={16} />
                </button>

                {expandedScheduleKey === plano.id + ':' + horariosDaOpcao.map((item) => item.id).join('-') && (
                  <div className="planos-schedule-choice-panel">
                    {horariosDaOpcao.some((horario) => horario.participantes > 0) ? (
                      <>
                        <div className="planos-schedule-choice-copy">
                          <strong>Esta turma já possui aluno matriculado.</strong>
                          <span>Entre diretamente nesta turma para continuar sua matrícula.</span>
                        </div>
                        <a
                          href={'/matricula?modalidade=' + modalidade + '&idioma=' + idioma + '&plano=' + plano.id + '&horario_id=' + encodeURIComponent(horariosDaOpcao[0].id)}
                          className="btn btn-primary planos-schedule-choice-button"
                        >
                          Entrar nessa turma <ArrowRight size={16} />
                        </a>
                      </>
                    ) : (
                      <>
                        <div className="planos-schedule-choice-copy">
                          <strong>Esta turma ainda está em formação.</strong>
                          <span>Você pode começar individualmente com a condição especial de formação ou reservar sua vaga.</span>
                        </div>
                        <div className="planos-schedule-choice-actions">
                          <a
                            href={individualPlan
                              ? '/matricula?modalidade=individual&idioma=' + idioma + '&plano=' + individualPlan.id + '&horario_id=' + encodeURIComponent(horariosDaOpcao[0].id) + '&aguardando_formacao=1'
                              : '/matricula?modalidade=' + modalidade + '&idioma=' + idioma + '&plano=' + plano.id + '&horario_id=' + encodeURIComponent(horariosDaOpcao[0].id) + '&aguardando_formacao=1'}
                            className="planos-schedule-choice-button planos-schedule-choice-button--individual"
                          >
                            <span>Desejo iniciar individualmente</span>
                            <strong>
                              {formationPriceLoading === plano.id + ':' + horariosDaOpcao.map((item) => item.id).join('-')
                                ? 'Calculando...'
                                : formationPrices[plano.id + ':' + horariosDaOpcao.map((item) => item.id).join('-')] !== undefined
                                  ? formatCurrency(formationPrices[plano.id + ':' + horariosDaOpcao.map((item) => item.id).join('-')])
                                  : 'Condição especial'}
                              <small>{formationPrices[plano.id + ':' + horariosDaOpcao.map((item) => item.id).join('-')] !== undefined ? '/mês' : ''}</small>
                            </strong>
                            <em>Condição especial de formação</em>
                          </a>
                          <button
                            type="button"
                            className="planos-schedule-choice-button planos-schedule-choice-button--reserve"
                            onClick={() => setReserveTarget({ key: plano.id + ':' + horariosDaOpcao.map((item) => item.id).join('-'), plano, horarios: horariosDaOpcao })}
                          >
                            <span>Reservar vaga</span>
                            <strong>Quero participar desta turma</strong>
                            <em>A equipe entrará em contato para confirmar</em>
                          </button>
                        </div>
                        {reserveTarget?.key === plano.id + ':' + horariosDaOpcao.map((item) => item.id).join('-') && (
                          <div className="planos-reserve-form">
                            <div>
                              <strong>Reserve sua vaga</strong>
                              <span>Preencha seus dados e a AB Academy entrará em contato.</span>
                            </div>
                            <div className="planos-reserve-fields">
                              <input type="text" value={reserveName} onChange={(event) => setReserveName(event.target.value)} placeholder="Nome completo" autoComplete="name" />
                              <input type="email" value={reserveEmail} onChange={(event) => setReserveEmail(event.target.value)} placeholder="E-mail" autoComplete="email" />
                              <input type="tel" value={reservePhone} onChange={(event) => setReservePhone(formatPhone(event.target.value))} placeholder="WhatsApp" autoComplete="tel" />
                            </div>
                            {reserveMessage && <p className="planos-reserve-message">{reserveMessage}</p>}
                            <div className="planos-reserve-actions">
                              <button type="button" className="btn btn-outline" onClick={() => setReserveTarget(null)} disabled={reserveSaving}>Cancelar</button>
                              <button type="button" className="btn btn-primary" onClick={() => void submitReserve()} disabled={reserveSaving}>{reserveSaving ? 'Registrando...' : 'Confirmar reserva'}</button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {horariosIndisponiveis.length > 0 && (
            <div className="planos-unavailable-schedules">
              <div className="planos-unavailable-schedules-heading">
                <strong>Horários cadastrados, mas temporariamente indisponíveis</strong>
                <span>O horário permanece visível porque foi configurado pelo administrador, mas não pode ser reservado enquanto houver conflito ou outra indisponibilidade.</span>
              </div>
              {horariosIndisponiveis.map((horario) => (
                <div className="planos-frequency-card planos-frequency-card--unavailable" key={'indisponivel:' + horario.id}>
                  <div className="planos-frequency-heading">
                    <strong>{getWeekdayLabel(horario.dia_semana)} · {formatTime(horario.hora_inicio)}–{formatTime(horario.hora_fim)}</strong>
                    <span>Indisponível</span>
                  </div>
                  <div className="planos-schedule-list">
                    <div className="planos-schedule-row">
                      <strong>Nível</strong>
                      <span>{NIVEL_LABELS[(horario.nivel_referencia || nivel || '') as keyof typeof NIVEL_LABELS] || horario.nivel_referencia || nivel || 'A confirmar'}</span>
                    </div>
                  </div>
                  <p>
                    {horario.professor_nome ? 'Professor: ' + horario.professor_nome + ' · ' : ''}
                    Este horário não pode ser reservado neste momento.
                  </p>
                </div>
              ))}
            </div>
          )}

          {planosColetivos.length === 0 && <div className="planos-empty-collective">Nenhum plano coletivo ativo foi cadastrado para esta modalidade e idioma.</div>}
          {planosColetivos.length > 0 && opcoes.length === 0 && <div className="planos-empty-collective">Nenhum horário disponível foi configurado para este filtro no momento.</div>}
        </div>
      </div>

      <ul className="planos-detail-features">
        <li>Diagnóstico e orientação inicial</li>
        <li>Horários definidos pela agenda da AB Academy</li>
        <li>Preço atualizado diretamente pelo Admin</li>
      </ul>
    </article>
  )
}
function PlanoCard({ plano, horarioId }: { plano: Plano; horarioId?: string | null }) {
  const price = getPlanPrice(plano)

  return (
    <article className={'planos-detail-card planos-detail-card--' + plano.tipo}>
      {plano.tipo === 'anual' && (
        <span className="planos-detail-badge">Plano anual</span>
      )}

      <span className="planos-detail-tag">
        {plano.tipo === 'mensal' && '1x por semana'}
        {plano.tipo === 'anual' && '1x por semana'}
        {plano.tipo === 'personalizado' && '2x por semana'}
        {plano.tipo === 'intensivo' && '3x por semana'}
      </span>

      <h3>{plano.nome}</h3>

      <div className="planos-detail-price">
        <span>A partir de</span>
        <strong>{price.value}<small>{price.suffix}</small></strong>
        <em>{price.detail}</em>
      </div>

      <p className="planos-detail-description">
        {plano.descricao || 'Plano com acompanhamento personalizado pela AB Academy.'}
      </p>

      {plano.beneficios && plano.beneficios.length > 0 && (
        <ul className="planos-detail-features">
          {plano.beneficios.map((beneficio, index) => (
            <li key={index}>
              <CheckCircle2 size={17} />
              {beneficio}
            </li>
          ))}
        </ul>
      )}

      <a
        href={'/matricula?idioma=' + plano.idioma + '&plano=' + plano.id + (horarioId && plano.tipo === 'mensal' ? '&horario_id=' + encodeURIComponent(horarioId) + '&aguardando_formacao=1' : '')}
        className="btn btn-primary planos-detail-cta"
      >
        {getPlanCta(plano.tipo, plano.idioma)}
        <ArrowRight size={17} />
      </a>
    </article>
  )
}

function Planos() {
  const [planos, setPlanos] = useState<Plano[]>([])
  const [modalidadeSelecionada, setModalidadeSelecionada] = useState<'individual' | 'dupla' | 'grupo'>(() => {
    const modalidade = new URLSearchParams(window.location.search).get('modalidade')
    return modalidade === 'dupla' || modalidade === 'grupo' ? modalidade : 'individual'
  })
  const [idiomaSelecionado, setIdiomaSelecionado] = useState<'ingles' | 'alemao'>(() => {
    const idioma = new URLSearchParams(window.location.search).get('idioma')
    return idioma === 'alemao' ? 'alemao' : 'ingles'
  })
  const [nivelSelecionado, setNivelSelecionado] = useState(() => new URLSearchParams(window.location.search).get('nivel') || '')
  const [horariosColetivos, setHorariosColetivos] = useState<HorarioColetivo[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [horarioId] = useState(() => new URLSearchParams(window.location.search).get('horario_id'))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadPlanos() {
      setLoading(true)
      setError('')

      const [{ data: planosData, error: planosError }, { data: duplaData, error: duplaError }, { data: grupoData, error: grupoError }] = await Promise.all([
        supabase
          .from('planos')
          .select('id, idioma, tipo, nome, descricao, beneficios, preco, parcelas, valor_parcela, ativo, modalidade, min_alunos, max_alunos, created_at, aulas_semana')
          .eq('ativo', true),
        supabase.rpc('listar_horarios_coletivos_planos', {
          p_idioma: idiomaSelecionado,
          p_modalidade: 'dupla',
        }),
        supabase.rpc('listar_horarios_coletivos_planos', {
          p_idioma: idiomaSelecionado,
          p_modalidade: 'grupo',
        }),
      ])

      if (!active) return

      if (planosError || duplaError || grupoError) {
        console.error('Erro ao carregar dados dos planos/horários:', planosError || duplaError || grupoError)
        setError('Não foi possível carregar os planos e horários no momento.')
        setLoading(false)
        return
      }

      setPlanos((planosData || []) as Plano[])
      setHorariosColetivos([...(duplaData || []), ...(grupoData || [])] as HorarioColetivo[])
      setLoading(false)
    }

    loadPlanos()
    return () => { active = false }
  }, [idiomaSelecionado])

  const planosPorIdioma = useMemo(() => {
    /*
     * Um idioma pode ter apenas um card por tipo de plano.
     * Se existirem registros duplicados no banco, mantemos apenas um
     * registro de forma determinística, evitando cards repetidos na página.
     * Quando houver data de criação, o registro mais recente é mantido.
     */
    const semDuplicados = (items: Plano[]) => {
      const unicos = new Map<string, Plano>()

      for (const plano of items) {
        const key = plano.tipo + ':' + plano.modalidade
        const atual = unicos.get(key)

        if (!atual) {
          unicos.set(key, plano)
          continue
        }

        const dataAtual = atual.created_at ? Date.parse(atual.created_at) : 0
        const dataNovo = plano.created_at ? Date.parse(plano.created_at) : 0

        if (dataNovo >= dataAtual) {
          unicos.set(key, plano)
        }
      }

      return Array.from(unicos.values())
    }

    const ordenar = (items: Plano[]) =>
      semDuplicados(items).sort(
        (a, b) => ordemTipos.indexOf(a.tipo) - ordemTipos.indexOf(b.tipo),
      )

    return {
      ingles: ordenar(planos.filter((plano) => plano.idioma === 'ingles' && plano.tipo !== 'avulso')),
      alemao: ordenar(planos.filter((plano) => plano.idioma === 'alemao' && plano.tipo !== 'avulso')),
    }
  }, [planos])

  return (
    <div className="home planos-page-shell">
      <header className="header">
        <div className="container header-container">
          <a href="/" className="logo">
            <img
              src={logo}
              alt="AB Academy"
              className="academy-header-logo"
            />
          </a>

          <nav className="navigation">
            <a href="/">Início</a>
            <a href="/#sobre">Sobre</a>
            <a href="/#cursos">Cursos</a>
            <a href="/planos" aria-current="page">Planos</a>
            <a href="/#metodologia">Metodologia</a>
            <a href="/#contato">Contato</a>
          </nav>

          <div className="header-actions">
            <a href="/matricula" className="btn btn-primary header-button">
              Matricule-se
            </a>
            <a href="/aluno" className="btn btn-primary header-button">
              Área do aluno
            </a>
            <a href="/professor" className="btn btn-outline header-button teacher-access-button">
              Portal do professor
            </a>

            <button
              type="button"
              className="mobile-menu-button"
              aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          <div className={`mobile-navigation ${mobileMenuOpen ? 'open' : ''}`}>
            <a href="/" onClick={() => setMobileMenuOpen(false)}>Início</a>
            <a href="/#sobre" onClick={() => setMobileMenuOpen(false)}>Sobre</a>
            <a href="/#cursos" onClick={() => setMobileMenuOpen(false)}>Cursos</a>
            <a href="/planos" onClick={() => setMobileMenuOpen(false)}>Planos</a>
            <a href="/#metodologia" onClick={() => setMobileMenuOpen(false)}>Metodologia</a>
            <a href="/#contato" onClick={() => setMobileMenuOpen(false)}>Contato</a>
            <a href="/matricula" onClick={() => setMobileMenuOpen(false)}>Matricule-se</a>
            <a href="/aluno" onClick={() => setMobileMenuOpen(false)}>Área do aluno</a>
            <a href="/professor" onClick={() => setMobileMenuOpen(false)}>Portal do professor</a>
          </div>
        </div>
      </header>

      <main className="planos-page">
      <section className="planos-hero">
        <div className="planos-container">
          <span className="section-label">Planos AB Academy</span>
          <h1>Escolha o plano ideal para o seu objetivo.</h1>
          <p>
            Conheça todas as opções de Inglês e Alemão, compare frequência,
            investimento e proposta de cada plano e escolha a forma de estudo
            que melhor combina com você.
          </p>
        </div>
      </section>

      <section className="planos-section">
        <div className="planos-container">
          {loading && <div className="planos-state">Carregando planos...</div>}

          {!loading && error && (
            <div className="planos-state planos-state-error">{error}</div>
          )}

          {!loading && !error && (
            <>
              <div className="planos-language-switch">
                <p className="planos-language-switch-label">Como você quer estudar?</p>
                <div className="planos-language-switch-buttons planos-modality-switch" role="tablist">
                  {(['individual', 'dupla', 'grupo'] as const).map((modalidade) => (
                    <button key={modalidade} type="button" role="tab" aria-selected={modalidadeSelecionada === modalidade}
                      className={'planos-language-switch-button' + (modalidadeSelecionada === modalidade ? ' active' : '')}
                      onClick={() => setModalidadeSelecionada(modalidade)}>
                      <h2>{modalidade === 'individual' ? 'Individual' : modalidade === 'dupla' ? 'Dupla' : 'Grupo'}</h2>
                      <span>{modalidade === 'individual' ? 'Planos e frequências' : modalidade === 'dupla' ? 'Preço regular + formação' : 'Preço regular + formação'}</span>
                    </button>
                  ))}
                </div>
                {modalidadeSelecionada !== 'individual' && <p className="planos-modality-note">Escolha a modalidade, o idioma e o nível para visualizar os horários coletivos disponíveis e os valores atuais cadastrados pelo Admin.</p>}
                <p className="planos-language-switch-label">Selecione o curso desejado</p>

                <div className="planos-language-switch-buttons" role="tablist" aria-label="Selecione o curso">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={idiomaSelecionado === 'ingles'}
                    className={'planos-language-switch-button' + (idiomaSelecionado === 'ingles' ? ' active' : '')}
                    onClick={() => setIdiomaSelecionado('ingles')}
                  >
                    <img src={usaFlag} alt="" className="planos-language-flag" />
                    <h2>Inglês</h2>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={idiomaSelecionado === 'alemao'}
                    className={'planos-language-switch-button' + (idiomaSelecionado === 'alemao' ? ' active' : '')}
                    onClick={() => setIdiomaSelecionado('alemao')}
                  >
                    <img src={germanyFlag} alt="" className="planos-language-flag" />
                    <h2>Alemão</h2>
                  </button>
                </div>
              </div>

              {modalidadeSelecionada === 'individual' ? (
                idiomaSelecionado === 'ingles' ? (
                  <div className="planos-language planos-language--stacked"><div className="planos-grid">
                    {planosPorIdioma.ingles.filter((plano) => plano.modalidade === 'individual').map((plano) => <PlanoCard key={plano.id} plano={plano} horarioId={horarioId} />)}
                  </div></div>
                ) : (
                  <div className="planos-language planos-language--stacked"><div className="planos-grid">
                    {planosPorIdioma.alemao.filter((plano) => plano.modalidade === 'individual').map((plano) => <PlanoCard key={plano.id} plano={plano} />)}
                  </div></div>
                )
              ) : (
                <>
                  <div className="planos-level-switch" role="tablist" aria-label="Selecione o nível">
                    <button type="button" className={'planos-level-option' + (!nivelSelecionado ? ' active' : '')} aria-selected={!nivelSelecionado} onClick={() => setNivelSelecionado('')}>Todos</button>
                    {NIVEIS.map((nivel) => (
                      <button key={nivel} type="button" className={'planos-level-option' + (nivelSelecionado === nivel ? ' active' : '')} aria-selected={nivelSelecionado === nivel} onClick={() => setNivelSelecionado(nivel)} >{NIVEL_LABELS[nivel]}</button>
                    ))}
                  </div>
                  <div className="planos-language planos-language--stacked"><div className="planos-grid">
                    <ModalidadeCard modalidade={modalidadeSelecionada} idioma={idiomaSelecionado} planos={planos} horarios={horariosColetivos.filter((horario) => horario.idioma === idiomaSelecionado && horario.tipo_horario === modalidadeSelecionada)} nivel={nivelSelecionado} />
                  </div></div>
                </>
              )}



              <div className="planos-diagnostic">
                <div className="planos-diagnostic-icon"><Clock3 size={24} /></div>
                <div className="planos-diagnostic-content">
                  <span className="planos-diagnostic-label">Antes de começar</span>
                  <h2>Aula diagnóstica — R$ 50</h2>
                  <p>
                    Aula individual de 60 minutos em Inglês ou Alemão para
                    entender seu nível e orientar o melhor caminho de estudo.
                    Pagamento único, sem recorrência.
                  </p>
                </div>
                <a href={'/diagnostica?idioma=' + idiomaSelecionado} className="btn btn-secondary">
                  Quero fazer a aula diagnóstica
                  <ArrowRight size={17} />
                </a>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
    </div>
  )
}

export default Planos
