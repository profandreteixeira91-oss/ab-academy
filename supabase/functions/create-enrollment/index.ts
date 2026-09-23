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
     * AUTENTICAÇÃO
     * =====================================================
     */

    const authorization =
      req.headers.get('Authorization')

    if (!authorization) {
      return jsonResponse(
        {
          error:
            'Usuário não autenticado.',
        },
        401,
      )
    }

    const token =
      authorization.replace(
        /^Bearer\s+/i,
        '',
      )

    const supabaseAuth = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
    )

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabaseAuth.auth.getUser()

    if (
      userError ||
      !user
    ) {
      console.error(
        'Erro ao validar usuário:',
        userError,
      )

      return jsonResponse(
        {
          error:
            'Sessão de usuário inválida ou expirada.',
        },
        401,
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
     * O banco é a fonte oficial dos horários.
     */

    const {
      data: freshSlots,
      error: slotsError,
    } =
      await supabaseAdmin
        .from('horarios')
        .select(
          `
            id,
            hora_inicio,
            hora_fim,
            disponivel,
            aluno_id,
            dia_semana,
            idioma
          `,
        )
        .in(
          'id',
          horarioIds,
        )
        .eq(
          'idioma',
          body.idioma,
        )
        .eq(
          'disponivel',
          true,
        )
        .is(
          'aluno_id',
          null,
        )

    if (slotsError) {
      console.error(
        'Erro ao verificar horários:',
        slotsError,
      )

      return jsonResponse(
        {
          error:
            'Não foi possível verificar os horários disponíveis.',
          details:
            slotsError.message,
        },
        500,
      )
    }

    if (
      !freshSlots ||
      freshSlots.length !==
        horarioIds.length
    ) {
      return jsonResponse(
        {
          error:
            'Um ou mais horários selecionados não estão mais disponíveis.',
        },
        409,
      )
    }

    /*
     * =====================================================
     * LOCALIZAR HORÁRIO PRINCIPAL
     * =====================================================
     */

    const principalSlot =
      freshSlots.find(
        (slot) =>
          slot.id ===
          firstSchedule.id,
      )

    if (!principalSlot) {
      return jsonResponse(
        {
          error:
            'O horário principal selecionado não foi encontrado entre os horários disponíveis.',
        },
        409,
      )
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

    /*
     * =====================================================
     * VERIFICAR PLANO
     * =====================================================
     */

    if (body.plano_id) {
      const {
        data: plano,
        error: planoError,
      } =
        await supabaseAdmin
          .from('planos')
          .select(
            'id, idioma, tipo, preco, ativo',
          )
          .eq(
            'id',
            body.plano_id,
          )
          .maybeSingle()

      if (planoError) {
        console.error(
          'Erro ao verificar plano:',
          planoError,
        )

        return jsonResponse(
          {
            error:
              'Não foi possível verificar o plano selecionado.',
            details:
              planoError.message,
          },
          500,
        )
      }

      if (!plano) {
        return jsonResponse(
          {
            error:
              'O plano selecionado não existe mais.',
          },
          400,
        )
      }

      if (!plano.ativo) {
        return jsonResponse(
          {
            error:
              'O plano selecionado não está disponível.',
          },
          400,
        )
      }

      if (
        plano.idioma !==
        body.idioma
      ) {
        return jsonResponse(
          {
            error:
              'O plano selecionado não corresponde ao idioma escolhido.',
          },
          400,
        )
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
        body.valor_mensal,

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
        user.id,

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
        body.valor_mensal,

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
            user.id,

          matricula_id:
            matricula.id,

          plano_id:
            body.plano_id,

          idioma:
            body.idioma,

          tipo_plano:
            body.tipo_plano,

          metodo:
            'pix',

          status:
            'pendente',

          valor:
            body.valor,

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