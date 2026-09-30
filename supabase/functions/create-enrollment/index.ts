import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type ScheduleInput = {
  id: string
  date?: string
  weekday?: number
  time?: string
  hora_inicio?: string
  hora_fim?: string
}

type EnrollmentRequest = {
  plano_id: string | null
  idioma: 'ingles' | 'alemao'
  tipo_plano: string
  objetivos: string | null
  aulas_semana: number | null
  valor_aula: number | null
  valor_mensal: number | null
  valor_anual: number | null
  horario_ids: string[]
  schedules: ScheduleInput[]

  dados_aluno: {
    nome_completo: string
    cpf: string
    email: string
    data_nascimento: string
    telefone: string
    responsavel_nome: string | null
    responsavel_contato: string | null
    nivel_conversacao: string
    nivel_escrita: string
    nivel_compreensao: string
  }

  valor: number
  turma_token?: string | null
  turma_participante_id?: string | null
  turma_id?: string | null
  horario_formacao_id?: string | null
  aguardando_formacao?: boolean
  reserva_token?: string | null
  modalidade?: 'individual' | 'dupla' | 'grupo'
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    },
  )
}

function normalizeTime(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const match = trimmed.match(
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  )

  if (!match) {
    return null
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3] ?? '0')

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null
  }

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      {
        error: 'Método não permitido.',
      },
      405,
    )
  }

  try {
    /*
     * =====================================================
     * CONFIGURAÇÃO
     * =====================================================
     */

    const supabaseUrl =
      Deno.env.get('SUPABASE_URL') ?? ''

    const supabaseAnonKey =
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    const supabaseServiceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !supabaseServiceRoleKey
    ) {
      console.error(
        'Variáveis do Supabase não configuradas.',
      )

      return jsonResponse(
        {
          error:
            'Configuração do servidor incompleta.',
        },
        500,
      )
    }

    /*
     * =====================================================
     * CLIENTE ADMIN
     * =====================================================
     */

    const supabaseAdmin =
      createClient(
        supabaseUrl,
        supabaseServiceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      )

    /*
     * =====================================================
     * LER BODY
     * =====================================================
     */

    let body: EnrollmentRequest

    try {
      body = await req.json()
    } catch {
      return jsonResponse(
        {
          error:
            'Dados da matrícula inválidos.',
        },
        400,
      )
    }

    /*
     * =====================================================
     * VALIDAÇÕES BÁSICAS
     * =====================================================
     */

    if (
      !body.dados_aluno ||
      !body.dados_aluno.nome_completo ||
      !body.dados_aluno.cpf ||
      !body.dados_aluno.email ||
      !body.dados_aluno.data_nascimento ||
      !body.dados_aluno.telefone
    ) {
      return jsonResponse(
        {
          error:
            'Os dados pessoais obrigatórios não foram preenchidos.',
        },
        400,
      )
    }

    if (
      body.idioma !== 'ingles' &&
      body.idioma !== 'alemao'
    ) {
      return jsonResponse(
        {
          error: 'Idioma inválido.',
        },
        400,
      )
    }

    if (
      !body.modalidade ||
      !['individual', 'dupla', 'grupo'].includes(body.modalidade)
    ) {
      return jsonResponse(
        {
          error: 'Modalidade da matrícula inválida.',
        },
        400,
      )
    }

    /*
     * =====================================================
     * HORÁRIOS
     * =====================================================
     */

    const horarioIds = Array.isArray(
      body.horario_ids,
    )
      ? body.horario_ids.filter(
          (id) =>
            typeof id === 'string' &&
            id.trim().length > 0,
        )
      : []

    if (horarioIds.length === 0) {
      return jsonResponse(
        {
          error:
            'Nenhum horário foi selecionado.',
        },
        400,
      )
    }

    const schedules = Array.isArray(
      body.schedules,
    )
      ? body.schedules
      : []

    if (schedules.length === 0) {
      return jsonResponse(
        {
          error:
            'Os horários selecionados são inválidos.',
        },
        400,
      )
    }

    /*
     * O primeiro horário representa o horário principal
     * da matrícula.
     *
     * Não dependemos mais de:
     *
     * firstSchedule.time.includes(...)
     *
     * porque o frontend pode enviar hora_inicio
     * em vez de time.
     */

    const firstSchedule =
      schedules[0]

    if (
      !firstSchedule ||
      typeof firstSchedule.id !== 'string'
    ) {
      return jsonResponse(
        {
          error:
            'O horário principal da matrícula é inválido.',
        },
        400,
      )
    }

    /*
     * =====================================================
     * VALOR
     * =====================================================
     */

    if (
      typeof body.valor !== 'number' ||
      !Number.isFinite(body.valor) ||
      body.valor <= 0
    ) {
      return jsonResponse(
        {
          error:
            'Valor da matrícula inválido.',
        },
        400,
      )
    }

    /*
     * =====================================================
     * VERIFICAR HORÁRIOS DIRETAMENTE NO BANCO
     * =====================================================
     *
     * Individual: o horário precisa continuar livre.
     * Coletivo: a reserva já foi criada pela RPC e o horário
     * permanece compartilhável; validamos a turma/reserva.
     */

    const isCollectiveRequest =
      Boolean(
        body.modalidade &&
        ['dupla', 'grupo'].includes(body.modalidade) &&
        body.turma_id &&
        body.turma_participante_id,
      )

    let freshSlots: Array<{
      id: string
      hora_inicio: string
      hora_fim: string
      disponivel: boolean
      aluno_id: string | null
      dia_semana: number
      idioma: string
      tipo_horario: string
    }> = []

    if (isCollectiveRequest) {
      const { data: turma, error: turmaError } = await supabaseAdmin
        .from('turmas')
        .select('id,idioma,modalidade,aulas_semana,quantidade_maxima,status')
        .eq('id', body.turma_id)
        .maybeSingle()

      const { data: participante, error: participanteError } = await supabaseAdmin
        .from('turma_participantes')
        .select('id,turma_id,user_id,status,reserva_expira_em,reserva_token,email,valor_coletivo,valor_coletivo_normal')
        .eq('id', body.turma_participante_id)
        .maybeSingle()

      if (
        turmaError ||
        participanteError ||
        !turma ||
        !participante ||
        participante.turma_id !== turma.id
      ) {
        return jsonResponse({ error: 'A turma selecionada não está mais disponível.' }, 409)
      }

      if (
        participante.reserva_token !== body.reserva_token ||
        String(participante.email ?? '').trim().toLowerCase() !== body.dados_aluno.email.trim().toLowerCase()
      ) {
        return jsonResponse({ error: 'A reserva desta turma não pertence a esta matrícula.' }, 403)
      }

      if (!['convidado', 'confirmado'].includes(participante.status)) {
        return jsonResponse({ error: 'A reserva desta turma não está mais ativa.' }, 409)
      }

      if (
        participante.status === 'convidado' &&
        participante.reserva_expira_em &&
        new Date(participante.reserva_expira_em).getTime() < Date.now()
      ) {
        return jsonResponse({ error: 'A reserva desta turma expirou. Escolha o horário novamente.' }, 409)
      }

      if (
        turma.idioma !== body.idioma ||
        turma.aulas_semana !== body.aulas_semana ||
        !['dupla', 'grupo'].includes(turma.modalidade)
      ) {
        return jsonResponse({ error: 'A turma não corresponde à matrícula coletiva.' }, 400)
      }

      const { count: participantCount } = await supabaseAdmin
        .from('turma_participantes')
        .select('id', { count: 'exact', head: true })
        .eq('turma_id', turma.id)
        .in('status', ['convidado', 'confirmado'])

      if ((participantCount ?? 0) > turma.quantidade_maxima) {
        return jsonResponse({ error: 'A turma atingiu sua capacidade máxima.' }, 409)
      }

      const { data: turmaHorarios, error: turmaHorariosError } = await supabaseAdmin
        .from('turma_horarios')
        .select('horario_id')
        .eq('turma_id', turma.id)
        .in('horario_id', horarioIds)

      if (turmaHorariosError || !turmaHorarios || turmaHorarios.length !== horarioIds.length) {
        return jsonResponse({ error: 'Os horários selecionados não correspondem à turma reservada.' }, 409)
      }

      const { data: slots, error: slotsError } = await supabaseAdmin
        .from('horarios')
        .select('id,hora_inicio,hora_fim,disponivel,aluno_id,dia_semana,idioma,tipo_horario')
        .in('id', horarioIds)
        .eq('idioma', body.idioma)

      if (slotsError || !slots || slots.length !== horarioIds.length) {
        return jsonResponse({ error: 'Um ou mais horários da turma não foram encontrados.' }, 409)
      }

      freshSlots = slots
    } else {
      const { data: slots, error: slotsError } = await supabaseAdmin
        .from('horarios')
        .select('id,hora_inicio,hora_fim,disponivel,aluno_id,dia_semana,idioma,tipo_horario')
        .in('id', horarioIds)
        .eq('idioma', body.idioma)
        .eq('disponivel', true)
        .is('aluno_id', null)

      if (slotsError) {
        console.error('Erro ao verificar horários:', slotsError)
        return jsonResponse({
          error: 'Não foi possível verificar os horários disponíveis.',
          details: slotsError.message,
        }, 500)
      }

      if (!slots || slots.length !== horarioIds.length) {
        return jsonResponse({
          error: 'Um ou mais horários selecionados não estão mais disponíveis.',
        }, 409)
      }

      freshSlots = slots
    }

    /*
     * =====================================================
     * LOCALIZAR HORÁRIO PRINCIPAL
     * =====================================================
     */

    const principalSlot = freshSlots.find(
      (slot) => slot.id === firstSchedule.id,
    )

    if (!principalSlot) {
      return jsonResponse({
        error: 'O horário principal da matrícula não foi encontrado entre os horários selecionados.',
      }, 409)
    }

    /*
     * =====================================================
     * DATA DA MATRÍCULA
     * =====================================================
     *
     * Usa a data enviada pelo frontend.
     * Caso não exista, não cria uma matrícula
     * inconsistente.
     */

    const dataInicio =
      typeof firstSchedule.date === 'string' &&
      firstSchedule.date.trim()
        ? firstSchedule.date.trim()
        : null

    if (!dataInicio) {
      return jsonResponse(
        {
          error:
            'A data de início da matrícula não foi informada.',
        },
        400,
      )
    }

    /*
     * =====================================================
     * DIA DA SEMANA
     * =====================================================
     *
     * A fonte oficial é a tabela horarios.
     */

    const diaSemana =
      principalSlot.dia_semana

    /*
     * =====================================================
     * HORÁRIO PRINCIPAL
     * =====================================================
     *
     * Prioridade:
     *
     * 1. time enviado pelo frontend
     * 2. hora_inicio enviado pelo frontend
     * 3. hora_inicio do banco
     *
     * Assim eliminamos o erro:
     * "Cannot read properties of undefined
     * (reading 'includes')"
     */

    const horarioPrincipal =
      normalizeTime(
        firstSchedule.time,
      ) ??
      normalizeTime(
        firstSchedule.hora_inicio,
      ) ??
      normalizeTime(
        principalSlot.hora_inicio,
      )

    if (!horarioPrincipal) {
      return jsonResponse(
        {
          error:
            'Não foi possível identificar o horário principal da matrícula.',
        },
        400,
      )
    }

    let collectiveEnrollment: { turma_id: string; participante_id: string; valor_mensal: number; condicao_meses: number | null; condicao_inicio: string | null; condicao_fim: string | null } | null = null
    let valorFinal = Number(body.valor)

    if (body.turma_token) {
      const { data: collective, error: collectiveError } = await supabaseAdmin
        .from('turma_matriculas')
        .select('id,turma_id,participante_id,valor_mensal,condicao_meses,condicao_inicio,condicao_fim,status,turma:turmas(id,idioma,status,aulas_semana),participante:turma_participantes(id,status)')
        .eq('token', body.turma_token)
        .eq('status', 'liberada')
        .maybeSingle()

      if (collectiveError || !collective) return jsonResponse({ error: 'O link de matrícula coletiva não está mais disponível.' }, 409)
      if (!collective.turma || collective.turma.status !== 'pronta' || !collective.participante || collective.participante.status !== 'confirmado') return jsonResponse({ error: 'A turma ainda não está pronta para matrícula.' }, 409)
      if (body.turma_participante_id !== collective.participante_id) return jsonResponse({ error: 'O participante não corresponde ao link de matrícula.' }, 403)
      if (collective.turma.idioma !== body.idioma) return jsonResponse({ error: 'O idioma da turma não corresponde à matrícula.' }, 400)
      if (Math.abs(Number(collective.valor_mensal) - Number(body.valor)) > 0.01) return jsonResponse({ error: 'O valor coletivo não corresponde à condição liberada.' }, 409)
      collectiveEnrollment = { turma_id: collective.turma_id, participante_id: collective.participante_id, valor_mensal: Number(collective.valor_mensal), condicao_meses: collective.condicao_meses, condicao_inicio: collective.condicao_inicio, condicao_fim: collective.condicao_fim }
    }

    /*
     * =====================================================
     * VERIFICAR PLANO
     * =====================================================
     */

    if (body.plano_id && !collectiveEnrollment) {
      const {
        data: plano,
        error: planoError,
      } = await supabaseAdmin
        .from('planos')
        .select('id, idioma, tipo, preco, ativo, modalidade, aulas_semana')
        .eq('id', body.plano_id)
        .maybeSingle()

      if (planoError || !plano) {
        return jsonResponse({ error: 'Não foi possível verificar o plano selecionado.' }, 500)
      }

      if (!plano.ativo) return jsonResponse({ error: 'O plano selecionado não está disponível.' }, 400)
      if (plano.idioma !== body.idioma) return jsonResponse({ error: 'O plano selecionado não corresponde ao idioma escolhido.' }, 400)
      if (plano.modalidade !== body.modalidade) return jsonResponse({ error: 'A modalidade selecionada não corresponde ao plano.' }, 400)

      const isCollective = plano.modalidade === 'dupla' || plano.modalidade === 'grupo'

      if (isCollective) {
        if (!body.turma_id || !body.turma_participante_id) {
          return jsonResponse({ error: 'Selecione uma dupla ou turma antes de continuar.' }, 409)
        }

        const { data: turma, error: turmaError } = await supabaseAdmin
          .from('turmas')
          .select('id,idioma,modalidade,aulas_semana,quantidade_maxima,status')
          .eq('id', body.turma_id)
          .maybeSingle()

        const { data: participante, error: participanteError } = await supabaseAdmin
          .from('turma_participantes')
          .select('id,turma_id,user_id,status,reserva_expira_em,reserva_token,email')
          .eq('id', body.turma_participante_id)
          .maybeSingle()

        if (turmaError || participanteError || !turma || !participante) {
          return jsonResponse({ error: 'A turma selecionada não está mais disponível.' }, 409)
        }

        if (participante.turma_id !== turma.id || participante.reserva_token !== body.reserva_token || participante.email.trim().toLowerCase() !== body.dados_aluno.email.trim().toLowerCase()) {
          return jsonResponse({ error: 'A reserva desta turma não pertence a esta matrícula.' }, 403)
        }

        if (!['convidado','confirmado'].includes(participante.status)) {
          return jsonResponse({ error: 'A reserva desta turma não está mais ativa.' }, 409)
        }

        if (participante.status === 'convidado' && participante.reserva_expira_em && new Date(participante.reserva_expira_em).getTime() < Date.now()) {
          return jsonResponse({ error: 'A reserva desta turma expirou. Escolha o horário novamente.' }, 409)
        }

        if (turma.idioma !== body.idioma || turma.modalidade !== plano.modalidade || turma.aulas_semana !== (plano.aulas_semana ?? body.aulas_semana)) {
          return jsonResponse({ error: 'A turma não corresponde ao plano selecionado.' }, 409)
        }

        const { count: turmaHorarioCount } = await supabaseAdmin
          .from('turma_horarios')
          .select('horario_id', { count: 'exact', head: true })
          .eq('turma_id', turma.id)
          .in('horario_id', horarioIds)

        if ((turmaHorarioCount ?? 0) !== horarioIds.length || horarioIds.length !== turma.aulas_semana) {
          return jsonResponse({ error: 'Os horários selecionados não correspondem à composição semanal da turma.' }, 409)
        }

        const { count: participantesCount } = await supabaseAdmin
          .from('turma_participantes')
          .select('id', { count: 'exact', head: true })
          .eq('turma_id', turma.id)
          .in('status', ['convidado','confirmado'])

        const participantTotal = participantesCount ?? 1
        const capacidadeDaTurma = turma.quantidade_maxima
        const { data: valorData, error: valorError } = participante.valor_coletivo != null
          ? { data: Number(participante.valor_coletivo), error: null }
          : participantTotal === 1
            ? await supabaseAdmin.rpc('preco_formacao_coletiva', {
                p_idioma: body.idioma,
                p_modalidade: turma.modalidade,
                p_aulas_semana: turma.aulas_semana,
              })
            : await supabaseAdmin.rpc('preco_coletivo', {
                p_idioma: body.idioma,
                p_modalidade: turma.modalidade,
                p_aulas_semana: turma.aulas_semana,
                p_participantes: capacidadeDaTurma,
              })

        if (valorError || valorData == null) {
          return jsonResponse({ error: 'Não foi possível determinar o valor oficial desta matrícula coletiva.' }, 409)
        }

        valorFinal = Number(valorData)
        if (!Number.isFinite(valorFinal) || Math.abs(valorFinal - Number(body.valor)) > 0.01) {
          return jsonResponse({ error: 'O valor da matrícula coletiva não corresponde à condição reservada para este participante.' }, 409)
        }
      } else {
        const requiredSchedules = plano.tipo === 'intensivo' ? 3 : plano.tipo === 'personalizado' ? 2 : (plano.aulas_semana ?? 1)
        if (horarioIds.length !== requiredSchedules) {
          return jsonResponse({ error: `Este plano exige ${requiredSchedules} horário(s) por semana.` }, 409)
        }
        valorFinal = Number(plano.preco)
        if (Math.abs(valorFinal - Number(body.valor)) > 0.01) {
          return jsonResponse({ error: 'O valor enviado não corresponde ao valor oficial do plano.' }, 409)
        }
      }

      if (plano.tipo !== body.tipo_plano) {
        return jsonResponse({ error: 'O tipo do plano selecionado não corresponde ao tipo informado.' }, 400)
      }
    }

    /*
     * =====================================================
     * PREPARAR MATRÍCULA
     * =====================================================
     */

    const matriculaData = {
      aluno_id: null,

      plano_id:
        body.plano_id,

      turma_id: body.turma_id ?? collectiveEnrollment?.turma_id ?? null,
      turma_participante_id: body.turma_participante_id ?? collectiveEnrollment?.participante_id ?? null,
      valor_coletivo: collectiveEnrollment?.valor_mensal ?? (body.modalidade !== 'individual' ? valorFinal : null),
      condicao_meses: collectiveEnrollment?.condicao_meses ?? null,
      condicao_inicio: collectiveEnrollment?.condicao_inicio ?? null,
      condicao_fim: collectiveEnrollment?.condicao_fim ?? null,
      horario_formacao_id: body.aguardando_formacao ? body.horario_formacao_id ?? null : null,

      idioma:
        body.idioma,

      data_inicio:
        dataInicio,

      dia_semana:
        diaSemana,

      horario:
        horarioPrincipal,

      status:
        'pendente',

      objetivo:
        body.objetivos,

      objetivos:
        body.objetivos,

      aulas_semana:
        body.aulas_semana,

      valor_aula:
        body.valor_aula,

      valor_mensal:
        body.modalidade !== 'individual' ? valorFinal : body.valor_mensal,

      valor_anual:
        body.valor_anual,

      tipo_plano:
        body.tipo_plano,
    }

    /*
     * =====================================================
     * CRIAR MATRÍCULA PENDENTE
     * =====================================================
     */

    const {
      data: matricula,
      error: matriculaError,
    } =
      await supabaseAdmin
        .from('matriculas')
        .insert(
          matriculaData,
        )
        .select('id')
        .single()

    if (
      matriculaError ||
      !matricula
    ) {
      console.error(
        'Erro ao criar matrícula pendente:',
        matriculaError,
      )

      return jsonResponse(
        {
          error:
            'Não foi possível criar a matrícula.',
          details:
            matriculaError?.message,
        },
        500,
      )
    }

    /*
     * =====================================================
     * DADOS DA MATRÍCULA
     * =====================================================
     *
     * O aluno NÃO é criado neste momento.
     */

    const dadosMatricula = {
      user_id:
        null,

      matricula_id:
        matricula.id,

      nome_completo:
        body.dados_aluno.nome_completo.trim(),

      cpf:
        body.dados_aluno.cpf
          .replace(/\D/g, ''),

      email:
        body.dados_aluno.email.trim(),

      data_nascimento:
        body.dados_aluno.data_nascimento,

      telefone:
        body.dados_aluno.telefone
          .replace(/\D/g, ''),

      responsavel_nome:
        body.dados_aluno.responsavel_nome
          ?.trim() || null,

      responsavel_contato:
        body.dados_aluno.responsavel_contato
          ?.replace(/\D/g, '') || null,

      idioma:
        body.idioma,

      nivel_conversacao:
        body.dados_aluno
          .nivel_conversacao,

      nivel_escrita:
        body.dados_aluno
          .nivel_escrita,

      nivel_compreensao:
        body.dados_aluno
          .nivel_compreensao,

      data_inicio:
        dataInicio,

      dia_semana:
        diaSemana,

      horario:
        horarioPrincipal,

      tipo_plano:
        body.tipo_plano,

      plano_id:
        body.plano_id,

      objetivos:
        body.objetivos,

      aulas_semana:
        body.aulas_semana,

      valor_aula:
        body.valor_aula,

      valor_mensal:
        body.modalidade !== 'individual' ? valorFinal : body.valor_mensal,

      valor_anual:
        body.valor_anual,

      schedules:
        schedules,
    }

    /*
     * =====================================================
     * CRIAR INTENÇÃO DE PAGAMENTO
     * =====================================================
     */

    const {
      data: pagamento,
      error: pagamentoError,
    } =
      await supabaseAdmin
        .from('pagamentos')
        .insert({
          user_id:
            null,

          matricula_id:
            matricula.id,

          plano_id:
            body.plano_id,

          turma_id:
            body.turma_id ?? collectiveEnrollment?.turma_id ?? null,

          turma_participante_id:
            body.turma_participante_id ?? collectiveEnrollment?.participante_id ?? null,

          horario_formacao_id:
            body.aguardando_formacao ? body.horario_formacao_id ?? null : null,

          idioma:
            body.idioma,

          tipo_plano:
            body.tipo_plano,

          metodo:
            'pix',

          status:
            'pendente',

          valor:
            valorFinal,

          parcelas:
            null,

          dados_matricula:
            dadosMatricula,

          horario_ids:
            horarioIds,
        })
        .select('id')
        .single()

    /*
     * =====================================================
     * ROLLBACK DA MATRÍCULA
     * =====================================================
     */

    if (
      pagamentoError ||
      !pagamento
    ) {
      console.error(
        'Erro ao criar intenção de pagamento:',
        pagamentoError,
      )

      await supabaseAdmin
        .from('matriculas')
        .delete()
        .eq(
          'id',
          matricula.id,
        )

      return jsonResponse(
        {
          error:
            'Não foi possível iniciar o pagamento.',
          details:
            pagamentoError?.message,
        },
        500,
      )
    }

    const collectiveTurmaId = body.turma_id ?? collectiveEnrollment?.turma_id ?? null
    const collectiveParticipanteId = body.turma_participante_id ?? collectiveEnrollment?.participante_id ?? null

    if (collectiveTurmaId && collectiveParticipanteId) {
      const token = crypto.randomUUID()
      const { error: turmaMatriculaError } = await supabaseAdmin
        .from('turma_matriculas')
        .insert({
          turma_id: collectiveTurmaId,
          participante_id: collectiveParticipanteId,
          token,
          status: 'pagamento_pendente',
          valor_mensal: valorFinal,
          matricula_id: matricula.id,
          pagamento_id: pagamento.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      if (turmaMatriculaError) {
        await supabaseAdmin.from('pagamentos').delete().eq('id', pagamento.id)
        await supabaseAdmin.from('matriculas').delete().eq('id', matricula.id)
        return jsonResponse({ error: 'Não foi possível registrar a participação na turma.', details: turmaMatriculaError.message }, 500)
      }
    }

    /*
     * =====================================================
     * SUCESSO
     * =====================================================
     */

    console.log(
      'Matrícula pendente criada:',
      matricula.id,
    )

    console.log(
      'Pagamento criado:',
      pagamento.id,
    )

    if (collectiveEnrollment) {
      await supabaseAdmin.from('turma_matriculas').update({ status: 'pagamento_pendente', matricula_id: matricula.id, pagamento_id: pagamento.id }).eq('participante_id', collectiveEnrollment.participante_id)
    }

    return jsonResponse({
      success: true,

      matricula_id:
        matricula.id,

      pagamento_id:
        pagamento.id,

      status:
        'pendente',
    })
  } catch (error) {
    console.error(
      'Erro inesperado em create-enrollment:',
      error,
    )

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro interno ao criar matrícula.',
      },
      500,
    )
  }
})