import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL =
  Deno.env.get('SUPABASE_URL')

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const ASAAS_API_KEY =
  Deno.env.get('ASAAS_API_KEY')

const ASAAS_API_URL =
  Deno.env.get('ASAAS_API_URL') ??
  'https://api.asaas.com/v3'

const ASAAS_WEBHOOK_TOKEN =
  Deno.env.get('ASAAS_WEBHOOK_TOKEN')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, asaas-access-token',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
}

const supabaseAdmin = createClient(
  SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!,
)

type AsaasWebhookPayload = {
  event?: string

  payment?: {
    id?: string
    customer?: string
    subscription?: string | null
    status?: string
    value?: number
    billingType?: string
    externalReference?: string | null
    dueDate?: string
  }
}

type Pagamento = {
  id: string
  user_id: string | null
  plano_id: string | null
  idioma: string | null
  tipo_plano: string | null
  valor: number
  parcelas: number | null
  status: string
  metodo: string
  asaas_payment_id: string | null
  asaas_customer_id: string | null
  asaas_subscription_id: string | null
  matricula_id: string | null
  dados_matricula: Record<string, unknown> | null
  horario_ids: string[] | null
}

type Matricula = {
  id: string
  aluno_id: string | null
  status: string
  plano_id: string | null
  idioma: string | null
  data_inicio: string | null
  dia_semana: number | null
  horario: string | null
}

type Horario = {
  id: string
  idioma: string
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  disponivel: boolean
  aluno_id: string | null
}

function jsonResponse(
  data: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type':
          'application/json',
      },
    },
  )
}

/* =========================================================
   STATUS LOCAL DO PAGAMENTO
   ========================================================= */

function getLocalPaymentStatus(
  asaasStatus: string,
) {
  switch (asaasStatus) {
    case 'RECEIVED':
    case 'CONFIRMED':
      return 'pago'

    case 'OVERDUE':
      return 'recusado'

    case 'REFUNDED':
    case 'REFUND_REQUESTED':
    case 'DELETED':
      return 'cancelado'

    case 'EXPIRED':
      return 'expirado'

    default:
      return 'processando'
  }
}

/* =========================================================
   EVENTOS QUE SIGNIFICAM PAGAMENTO CONFIRMADO
   ========================================================= */

function isPaymentConfirmedEvent(
  event: string | undefined,
  status: string,
) {
  return (
    event === 'PAYMENT_CONFIRMED' ||
    event === 'PAYMENT_RECEIVED' ||
    status === 'CONFIRMED' ||
    status === 'RECEIVED'
  )
}

/* =========================================================
   PIX MENSAL
   ========================================================= */

function isMonthlyPixPayment(
  pagamento: Pagamento,
) {
  return (
    pagamento.metodo === 'pix' &&
    pagamento.tipo_plano === 'mensal'
  )
}

function getNextMonthDate() {
  const today = new Date()

  const year =
    today.getUTCFullYear()

  const month =
    today.getUTCMonth()

  const day =
    today.getUTCDate()

  const nextMonthLastDay =
    new Date(
      Date.UTC(
        year,
        month + 2,
        0,
      ),
    ).getUTCDate()

  const nextMonthDay =
    Math.min(
      day,
      nextMonthLastDay,
    )

  const nextDate =
    new Date(
      Date.UTC(
        year,
        month + 1,
        nextMonthDay,
      ),
    )

  return nextDate
    .toISOString()
    .slice(0, 10)
}

/* =========================================================
   API ASAAS
   ========================================================= */

async function asaasRequest(
  path: string,
  options: RequestInit = {},
) {
  if (!ASAAS_API_KEY) {
    throw new Error(
      'ASAAS_API_KEY não configurada.',
    )
  }

  const response =
    await fetch(
      `${ASAAS_API_URL}${path}`,
      {
        ...options,
        headers: {
          Accept:
            'application/json',

          'Content-Type':
            'application/json',

          access_token:
            ASAAS_API_KEY,

          ...(options.headers ?? {}),
        },
      },
    )

  const text =
    await response.text()

  let data: unknown = null

  try {
    data =
      text
        ? JSON.parse(text)
        : null
  } catch {
    data = text
  }

  if (!response.ok) {
    console.error(
      'Erro na API Asaas:',
      {
        status:
          response.status,

        path,

        data,
      },
    )

    throw new Error(
      `Erro na API Asaas (${response.status}).`,
    )
  }

  return data as Record<
    string,
    unknown
  >
}

/* =========================================================
   BUSCA ASSINATURA EXISTENTE
   ========================================================= */

async function findExistingSubscription(
  externalReference: string,
) {
  const params =
    new URLSearchParams()

  params.set(
    'externalReference',
    externalReference,
  )

  params.set(
    'limit',
    '10',
  )

  const data =
    await asaasRequest(
      `/subscriptions?${params.toString()}`,
    )

  const subscriptions =
    Array.isArray(
      data.data,
    )
      ? data.data
      : []

  return (
    subscriptions[0] as
      | Record<string, unknown>
      | undefined
  ) ?? null
}

/* =========================================================
   CRIA ASSINATURA MENSAL PIX
   ========================================================= */

async function createMonthlyPixSubscription(
  pagamento: Pagamento,
  customerId: string,
) {
  if (
    !isMonthlyPixPayment(
      pagamento,
    )
  ) {
    return null
  }

  if (
    pagamento.asaas_subscription_id
  ) {
    return pagamento
      .asaas_subscription_id
  }

  const existingSubscription =
    await findExistingSubscription(
      pagamento.id,
    )

  if (existingSubscription?.id) {
    const subscriptionId =
      String(
        existingSubscription.id,
      )

    const {
      error,
    } = await supabaseAdmin
      .from('pagamentos')
      .update({
        asaas_subscription_id:
          subscriptionId,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        pagamento.id,
      )

    if (error) {
      throw new Error(
        'Não foi possível salvar a assinatura existente.',
      )
    }

    return subscriptionId
  }

  const nextDueDate =
    getNextMonthDate()

  const subscription =
    await asaasRequest(
      '/subscriptions',
      {
        method:
          'POST',

        body:
          JSON.stringify({
            customer:
              customerId,

            billingType:
              'PIX',

            value:
              Number(
                pagamento.valor,
              ),

            nextDueDate,

            cycle:
              'MONTHLY',

            description:
              'Mensalidade AB Academy',

            externalReference:
              pagamento.id,
          }),
      },
    )

  const subscriptionId =
    subscription.id
      ? String(
          subscription.id,
        )
      : null

  if (!subscriptionId) {
    throw new Error(
      'O Asaas criou a assinatura, mas não retornou o ID.',
    )
  }

  const {
    error,
  } = await supabaseAdmin
    .from('pagamentos')
    .update({
      asaas_subscription_id:
        subscriptionId,

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      'id',
      pagamento.id,
    )

  if (error) {
    throw new Error(
      'A assinatura foi criada no Asaas, mas não foi possível salvá-la no banco.',
    )
  }

  console.log(
    'ASSINATURA MENSAL PIX CRIADA:',
    {
      pagamento_id:
        pagamento.id,

      subscription_id:
        subscriptionId,

      customer_id:
        customerId,

      next_due_date:
        nextDueDate,
    },
  )

  return subscriptionId
}

/* =========================================================
   BUSCA PAGAMENTO
   ========================================================= */

async function getPagamento(
  asaasPaymentId: string,
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from('pagamentos')
    .select(`
      id,
      user_id,
      plano_id,
      idioma,
      tipo_plano,
      valor,
      parcelas,
      status,
      metodo,
      asaas_payment_id,
      asaas_customer_id,
      asaas_subscription_id,
      matricula_id,
      dados_matricula,
      horario_ids
    `)
    .eq(
      'asaas_payment_id',
      asaasPaymentId,
    )
    .maybeSingle()

  if (error) {
    console.error(
      'Erro ao buscar pagamento local:',
      error,
    )

    throw new Error(
      'Erro ao consultar pagamento local.',
    )
  }

  return data as Pagamento | null
}

/* =========================================================
   BUSCA PAGAMENTO PELA ASSINATURA
   ========================================================= */

async function getPagamentoBySubscription(
  subscriptionId: string,
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from('pagamentos')
    .select(`
      id,
      user_id,
      plano_id,
      idioma,
      tipo_plano,
      valor,
      parcelas,
      status,
      metodo,
      asaas_payment_id,
      asaas_customer_id,
      asaas_subscription_id,
      matricula_id,
      dados_matricula,
      horario_ids
    `)
    .eq(
      'asaas_subscription_id',
      subscriptionId,
    )
    .order(
      'created_at',
      {
        ascending:
          true,
      },
    )
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error(
      'Erro ao buscar pagamento pela assinatura:',
      error,
    )

    throw new Error(
      'Erro ao consultar assinatura local.',
    )
  }

  return data as Pagamento | null
}

/* =========================================================
   REGISTRA MENSALIDADE RECORRENTE
   ========================================================= */

async function createRecurringPaymentRecord(
  payment: NonNullable<
    AsaasWebhookPayload['payment']
  >,
) {
  const subscriptionId =
    payment.subscription

  if (!subscriptionId) {
    return null
  }

  const pagamentoBase =
    await getPagamentoBySubscription(
      subscriptionId,
    )

  if (!pagamentoBase) {
    console.log(
      'Assinatura ainda não localizada no banco local:',
      subscriptionId,
    )

    return null
  }

  if (
    !isMonthlyPixPayment(
      pagamentoBase,
    )
  ) {
    return null
  }

  const pagamentoExistente =
    await getPagamento(
      payment.id ?? '',
    )

  if (pagamentoExistente) {
    return pagamentoExistente
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from('pagamentos')
    .insert({
      user_id:
        pagamentoBase.user_id,

      plano_id:
        pagamentoBase.plano_id,

      idioma:
        pagamentoBase.idioma,

      tipo_plano:
        pagamentoBase.tipo_plano,

      metodo:
        'pix',

      status:
        getLocalPaymentStatus(
          payment.status ?? '',
        ),

      valor:
        Number(
          payment.value ??
            pagamentoBase.valor,
        ),

      parcelas:
        null,

      asaas_customer_id:
        payment.customer ??
        pagamentoBase.asaas_customer_id,

      asaas_payment_id:
        payment.id,

      asaas_subscription_id:
        subscriptionId,

      matricula_id:
        pagamentoBase.matricula_id,

      dados_matricula:
        pagamentoBase.dados_matricula,

      horario_ids:
        null,

      created_at:
        new Date().toISOString(),

      updated_at:
        new Date().toISOString(),
    })
    .select(`
      id,
      user_id,
      plano_id,
      idioma,
      tipo_plano,
      valor,
      parcelas,
      status,
      metodo,
      asaas_payment_id,
      asaas_customer_id,
      asaas_subscription_id,
      matricula_id,
      dados_matricula,
      horario_ids
    `)
    .single()

  if (error || !data) {
    console.error(
      'Erro ao criar mensalidade recorrente:',
      error,
    )

    throw new Error(
      'Não foi possível registrar a nova mensalidade.',
    )
  }

  return data as Pagamento
}

/* =========================================================
   BUSCA ALUNO PELO USER_ID
   ========================================================= */

async function getAlunoByUserId(
  userId: string,
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from('alunos')
    .select('id')
    .eq(
      'user_id',
      userId,
    )
    .maybeSingle()

  if (error) {
    console.error(
      'Erro ao buscar aluno:',
      error,
    )

    throw new Error(
      'Erro ao consultar aluno.',
    )
  }

  return data
}

/* =========================================================
   CRIA OU ATUALIZA ALUNO
   ========================================================= */

async function createOrUpdateAluno(
  pagamento: Pagamento,
) {
  if (!pagamento.user_id) {
    throw new Error(
      'Pagamento não possui user_id.',
    )
  }

  const dados =
    pagamento.dados_matricula

  if (
    !dados ||
    typeof dados !== 'object'
  ) {
    throw new Error(
      'Dados da matrícula não encontrados.',
    )
  }

  const nome =
    String(
      dados.nome_completo ?? '',
    ).trim()

  const cpf =
    String(
      dados.cpf ?? '',
    ).replace(/\D/g, '')

  const email =
    String(
      dados.email ?? '',
    ).trim()

  const telefone =
    String(
      dados.telefone ?? '',
    ).replace(/\D/g, '')

  if (!nome) {
    throw new Error(
      'Nome do aluno não informado.',
    )
  }

  if (!email) {
    throw new Error(
      'E-mail do aluno não informado.',
    )
  }

  if (
    cpf &&
    cpf.length !== 11
  ) {
    throw new Error(
      'CPF do aluno inválido.',
    )
  }

  const alunoData = {
    user_id:
      pagamento.user_id,

    nome_completo:
      nome,

    cpf:
      cpf || null,

    email:
      email,

    data_nascimento:
      dados.data_nascimento
        ? String(
            dados.data_nascimento,
          )
        : null,

    telefone:
      telefone || null,

    responsavel_nome:
      dados.responsavel_nome
        ? String(
            dados.responsavel_nome,
          )
        : null,

    responsavel_contato:
      dados.responsavel_contato
        ? String(
            dados.responsavel_contato,
          )
        : null,

    idioma:
      String(
        dados.idioma ??
          pagamento.idioma ??
          '',
      ),

    nivel_conversacao:
      dados.nivel_conversacao
        ? String(
            dados.nivel_conversacao,
          )
        : null,

    nivel_escrita:
      dados.nivel_escrita
        ? String(
            dados.nivel_escrita,
          )
        : null,

    nivel_compreensao:
      dados.nivel_compreensao
        ? String(
            dados.nivel_compreensao,
          )
        : null,

    updated_at:
      new Date().toISOString(),
  }

  const alunoExistente =
    await getAlunoByUserId(
      pagamento.user_id,
    )

  if (alunoExistente) {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from('alunos')
      .update(alunoData)
      .eq(
        'id',
        alunoExistente.id,
      )
      .select('id')
      .single()

    if (error || !data) {
      console.error(
        'Erro ao atualizar aluno:',
        error,
      )

      throw new Error(
        'Não foi possível atualizar o aluno.',
      )
    }

    return data.id
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from('alunos')
    .insert({
      ...alunoData,

      created_at:
        new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error(
      'Erro ao criar aluno:',
      error,
    )

    throw new Error(
      'Não foi possível criar o aluno.',
    )
  }

  return data.id
}

/* =========================================================
   BUSCA MATRÍCULA EXISTENTE
   ========================================================= */

async function getMatricula(
  matriculaId: string,
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from('matriculas')
    .select(`
      id,
      aluno_id,
      status,
      plano_id,
      idioma,
      data_inicio,
      dia_semana,
      horario
    `)
    .eq(
      'id',
      matriculaId,
    )
    .maybeSingle()

  if (error) {
    console.error(
      'Erro ao buscar matrícula:',
      error,
    )

    throw new Error(
      'Erro ao consultar matrícula.',
    )
  }

  return data as Matricula | null
}

/* =========================================================
   BUSCA HORÁRIOS
   ========================================================= */

async function getHorariosSelecionados(
  pagamento: Pagamento,
) {
  const ids =
    pagamento.horario_ids ?? []

  if (ids.length === 0) {
    throw new Error(
      'Nenhum horário foi associado ao pagamento.',
    )
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from('horarios')
    .select(`
      id,
      idioma,
      dia_semana,
      hora_inicio,
      hora_fim,
      disponivel,
      aluno_id
    `)
    .in(
      'id',
      ids,
    )

  if (error) {
    console.error(
      'Erro ao consultar horários:',
      error,
    )

    throw new Error(
      'Não foi possível consultar os horários selecionados.',
    )
  }

  if (
    !data ||
    data.length !== ids.length
  ) {
    throw new Error(
      'Um ou mais horários selecionados não foram encontrados.',
    )
  }

  return data as Horario[]
}

/* =========================================================
   VALIDA HORÁRIOS
   ========================================================= */

async function validarHorarios(
  horarios: Horario[],
  alunoId: string,
) {
  for (
    const horario of horarios
  ) {
    if (
      horario.aluno_id &&
      horario.aluno_id !== alunoId
    ) {
      throw new Error(
        `O horário ${horario.id} já está vinculado a outro aluno.`,
      )
    }
  }
}

/* =========================================================
   ATIVA MATRÍCULA PENDENTE
   ========================================================= */

async function ativarMatricula(
  matricula: Matricula,
  alunoId: string,
  pagamento: Pagamento,
  horarios: Horario[],
) {
  /*
   * Idempotência:
   *
   * Se o webhook já foi processado,
   * não fazemos novamente a operação.
   */
  if (
    matricula.status === 'ativa' &&
    matricula.aluno_id === alunoId
  ) {
    return matricula.id
  }

  const dados =
    pagamento.dados_matricula

  const primeiroHorario =
    horarios[0]

  if (!primeiroHorario) {
    throw new Error(
      'Nenhum horário selecionado.',
    )
  }

  const dataInicio =
    dados?.data_inicio
      ? String(
          dados.data_inicio,
        )
      : matricula.data_inicio ??
        new Date()
          .toISOString()
          .slice(0, 10)

  const {
    data,
    error,
  } = await supabaseAdmin
    .from('matriculas')
    .update({
      aluno_id:
        alunoId,

      status:
        'ativa',

      data_inicio:
        dataInicio,

      dia_semana:
        primeiroHorario.dia_semana,

      horario:
        primeiroHorario.hora_inicio,

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      'id',
      matricula.id,
    )
    .select('id')
    .single()

  if (error || !data) {
    console.error(
      'Erro ao ativar matrícula:',
      error,
    )

    throw new Error(
      'Não foi possível ativar a matrícula.',
    )
  }

  return data.id
}

/* =========================================================
   VINCULA HORÁRIOS À MATRÍCULA
   ========================================================= */

async function vincularHorarios(
  matriculaId: string,
  alunoId: string,
  horarios: Horario[],
) {
  for (
    const horario of horarios
  ) {
    const {
      data: vinculoExistente,
      error:
        vinculoBuscaError,
    } = await supabaseAdmin
      .from('matricula_horarios')
      .select('id')
      .eq(
        'matricula_id',
        matriculaId,
      )
      .eq(
        'horario_id',
        horario.id,
      )
      .maybeSingle()

    if (vinculoBuscaError) {
      console.error(
        'Erro ao verificar vínculo do horário:',
        vinculoBuscaError,
      )

      throw new Error(
        'Erro ao verificar vínculo do horário.',
      )
    }

    if (!vinculoExistente) {
      const {
        error:
          vinculoError,
      } = await supabaseAdmin
        .from('matricula_horarios')
        .insert({
          matricula_id:
            matriculaId,

          horario_id:
            horario.id,

          dia_semana:
            horario.dia_semana,

          horario:
            horario.hora_inicio,

          created_at:
            new Date().toISOString(),
        })

      if (vinculoError) {
        /*
         * Se o webhook for reenviado
         * simultaneamente e houver conflito
         * de unicidade, verificamos novamente
         * antes de falhar.
         */
        const {
          data: vinculoConfirmado,
        } = await supabaseAdmin
          .from('matricula_horarios')
          .select('id')
          .eq(
            'matricula_id',
            matriculaId,
          )
          .eq(
            'horario_id',
            horario.id,
          )
          .maybeSingle()

        if (!vinculoConfirmado) {
          console.error(
            'Erro ao criar vínculo do horário:',
            vinculoError,
          )

          throw new Error(
            'Não foi possível vincular o horário à matrícula.',
          )
        }
      }
    }

    const {
      error:
        horarioUpdateError,
    } = await supabaseAdmin
      .from('horarios')
      .update({
        aluno_id:
          alunoId,

        disponivel:
          false,
      })
      .eq(
        'id',
        horario.id,
      )
      .or(
        `aluno_id.is.null,aluno_id.eq.${alunoId}`,
      )

    if (horarioUpdateError) {
      console.error(
        'Erro ao atualizar horário:',
        horarioUpdateError,
      )

      throw new Error(
        'Não foi possível ocupar o horário.',
      )
    }
  }
}

/* =========================================================
   ATUALIZA PAGAMENTO
   ========================================================= */

async function atualizarPagamento(
  pagamentoId: string,
  status: string,
  matriculaId?: string | null,
) {
  const updateData: Record<
    string,
    unknown
  > = {
    status,

    updated_at:
      new Date().toISOString(),
  }

  if (
    matriculaId !== undefined
  ) {
    updateData.matricula_id =
      matriculaId
  }

  const {
    error,
  } = await supabaseAdmin
    .from('pagamentos')
    .update(updateData)
    .eq(
      'id',
      pagamentoId,
    )

  if (error) {
    console.error(
      'Erro ao atualizar pagamento:',
      error,
    )

    throw new Error(
      'Não foi possível atualizar o pagamento.',
    )
  }
}

/* =========================================================
   FINALIZA MATRÍCULA APÓS PAGAMENTO
   ========================================================= */

async function finalizarMatricula(
  pagamento: Pagamento,
  payment: NonNullable<
    AsaasWebhookPayload['payment']
  >,
) {
  if (!pagamento.matricula_id) {
    throw new Error(
      'Pagamento confirmado não possui matricula_id.',
    )
  }

  const matricula =
    await getMatricula(
      pagamento.matricula_id,
    )

  if (!matricula) {
    throw new Error(
      'Matrícula associada ao pagamento não foi encontrada.',
    )
  }

  /*
   * Se já está ativa, significa que este webhook
   * provavelmente já foi processado.
   */
  if (
    matricula.status === 'ativa' &&
    matricula.aluno_id
  ) {
    await atualizarPagamento(
      pagamento.id,
      'pago',
      matricula.id,
    )

    return {
      alunoId:
        matricula.aluno_id,

      matriculaId:
        matricula.id,
    }
  }

  /*
   * Recupera os horários da matrícula pendente.
   */
  const horarios =
    await getHorariosSelecionados(
      pagamento,
    )

  /*
   * Cria o aluno SOMENTE AGORA,
   * depois da confirmação do pagamento.
   */
  const alunoId =
    await createOrUpdateAluno(
      pagamento,
    )

  /*
   * Confirma que os horários ainda não
   * foram ocupados por outro aluno.
   */
  await validarHorarios(
    horarios,
    alunoId,
  )

  /*
   * Ativa a matrícula já existente.
   * NÃO cria uma nova matrícula.
   */
  const matriculaId =
    await ativarMatricula(
      matricula,
      alunoId,
      pagamento,
      horarios,
    )

  /*
   * Vincula os horários à matrícula
   * e ocupa os horários.
   */
  await vincularHorarios(
    matriculaId,
    alunoId,
    horarios,
  )

  /*
   * Finalmente marca o pagamento como pago.
   */
  await atualizarPagamento(
    pagamento.id,
    'pago',
    matriculaId,
  )

  /*
   * Para PIX mensal, cria a assinatura
   * recorrente depois da primeira confirmação.
   */
  let subscriptionId =
    pagamento.asaas_subscription_id

  if (
    pagamento.metodo ===
      'pix' &&
    pagamento.tipo_plano ===
      'mensal'
  ) {
    const customerId =
      payment.customer ??
      pagamento.asaas_customer_id

    if (!customerId) {
      throw new Error(
        'Cliente Asaas não identificado para criar a assinatura mensal.',
      )
    }

    /*
     * Atualiza o pagamento em memória
     * com o customer retornado pelo Asaas,
     * caso ainda não estivesse salvo.
     */
    if (
      !pagamento.asaas_customer_id &&
      payment.customer
    ) {
      await supabaseAdmin
        .from('pagamentos')
        .update({
          asaas_customer_id:
            payment.customer,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          pagamento.id,
        )
    }

    subscriptionId =
      await createMonthlyPixSubscription(
        pagamento,
        customerId,
      )
  }

  console.log(
    'MATRÍCULA FINALIZADA COM SUCESSO:',
    {
      pagamento_id:
        pagamento.id,

      aluno_id:
        alunoId,

      matricula_id:
        matriculaId,

      horario_ids:
        horarios.map(
          (horario) =>
            horario.id,
        ),

      subscription_id:
        subscriptionId ?? null,
    },
  )

  return {
    alunoId,

    matriculaId,

    subscriptionId:
      subscriptionId ?? null,
  }
}

/* =========================================================
   WEBHOOK
   ========================================================= */

Deno.serve(async (req) => {
  if (
    req.method === 'OPTIONS'
  ) {
    return new Response(
      'ok',
      {
        headers:
          corsHeaders,
      },
    )
  }

  if (
    req.method !== 'POST'
  ) {
    return jsonResponse(
      {
        error:
          'Método não permitido.',
      },
      405,
    )
  }

  try {
    /*
     * =====================================================
     * CONFIGURAÇÕES
     * =====================================================
     */

    if (
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      return jsonResponse(
        {
          error:
            'Configuração do Supabase incompleta.',
        },
        500,
      )
    }

    if (!ASAAS_API_KEY) {
      return jsonResponse(
        {
          error:
            'ASAAS_API_KEY não configurada.',
        },
        500,
      )
    }

    /*
     * =====================================================
     * VALIDA TOKEN DO ASAAS
     * =====================================================
     */

    if (
      ASAAS_WEBHOOK_TOKEN
    ) {
      const receivedToken =
        req.headers.get(
          'asaas-access-token',
        )

      if (
        receivedToken !==
        ASAAS_WEBHOOK_TOKEN
      ) {
        console.error(
          'Token do webhook inválido.',
        )

        return jsonResponse(
          {
            error:
              'Não autorizado.',
          },
          401,
        )
      }
    }

    /*
     * =====================================================
     * LÊ PAYLOAD
     * =====================================================
     */

    const body =
      (await req.json()) as AsaasWebhookPayload

    console.log(
      'WEBHOOK ASAAS RECEBIDO:',
      {
        event:
          body.event,

        payment_id:
          body.payment?.id,

        subscription:
          body.payment?.subscription,

        status:
          body.payment?.status,

        billing_type:
          body.payment?.billingType,
      },
    )

    const payment =
      body.payment

    if (!payment?.id) {
      return jsonResponse(
        {
          error:
            'ID do pagamento não informado.',
        },
        400,
      )
    }

    /*
     * =====================================================
     * PAYMENT_CREATED DE ASSINATURA
     * =====================================================
     *
     * É uma nova cobrança gerada por uma assinatura.
     *
     * Criamos apenas o registro financeiro.
     * NÃO criamos aluno.
     * NÃO criamos matrícula.
     */

    if (
      body.event ===
        'PAYMENT_CREATED' &&
      payment.subscription
    ) {
      const recorrente =
        await createRecurringPaymentRecord(
          payment,
        )

      return jsonResponse({
        received: true,

        event:
          body.event,

        pagamento_id:
          recorrente?.id ??
          null,

        subscription_id:
          payment.subscription,
      })
    }

    /*
     * =====================================================
     * LOCALIZA PAGAMENTO
     * =====================================================
     */

    const pagamento =
      await getPagamento(
        payment.id,
      )

    if (!pagamento) {
      console.log(
        'Pagamento ainda não localizado no banco local:',
        payment.id,
      )

      /*
       * Retornamos 200 para evitar que o Asaas
       * fique reenviando indefinidamente um evento
       * que chegou antes do nosso registro local.
       */
      return jsonResponse({
        received: true,

        message:
          'Pagamento ainda não localizado no banco local.',

        asaas_payment_id:
          payment.id,
      })
    }

    /*
     * =====================================================
     * ATUALIZA STATUS LOCAL
     * =====================================================
     */

    const localStatus =
      getLocalPaymentStatus(
        payment.status ?? '',
      )

    /*
     * =====================================================
     * PAGAMENTO AINDA NÃO CONFIRMADO
     * =====================================================
     */

    if (
      !isPaymentConfirmedEvent(
        body.event,
        payment.status ?? '',
      )
    ) {
      await atualizarPagamento(
        pagamento.id,
        localStatus,
      )

      return jsonResponse({
        received: true,

        event:
          body.event,

        status:
          localStatus,

        pagamento_id:
          pagamento.id,
      })
    }

    /*
     * =====================================================
     * PAGAMENTO CONFIRMADO
     * =====================================================
     */

    /*
     * Se já está pago e possui matrícula ativa,
     * tratamos como reenvio do webhook.
     */
    if (
      pagamento.status ===
        'pago' &&
      pagamento.matricula_id
    ) {
      const matricula =
        await getMatricula(
          pagamento.matricula_id,
        )

      if (
        matricula?.status ===
          'ativa' &&
        matricula.aluno_id
      ) {
        return jsonResponse({
          received: true,

          status:
            'pago',

          pagamento_id:
            pagamento.id,

          aluno_id:
            matricula.aluno_id,

          matricula_id:
            matricula.id,

          message:
            'Pagamento já processado anteriormente.',
        })
      }
    }

    /*
     * =====================================================
     * FINALIZA MATRÍCULA EXISTENTE
     * =====================================================
     */

    const resultado =
      await finalizarMatricula(
        pagamento,
        payment,
      )

    /*
     * =====================================================
     * RESPOSTA FINAL
     * =====================================================
     */

    return jsonResponse({
      received: true,

      status:
        'pago',

      event:
        body.event,

      pagamento_id:
        pagamento.id,

      aluno_id:
        resultado.alunoId,

      matricula_id:
        resultado.matriculaId,

      subscription_id:
        resultado.subscriptionId,
    })
  } catch (error) {
    console.error(
      'ERRO NO WEBHOOK ASAAS:',
      error,
    )

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro interno no webhook.',
      },
      500,
    )
  }
})