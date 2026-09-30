import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ASAAS_API_URL =
  Deno.env.get('ASAAS_API_URL') ||
  'https://api.asaas.com/v3'

const ASAAS_API_KEY =
  Deno.env.get('ASAAS_API_KEY')

const SUPABASE_URL =
  Deno.env.get('SUPABASE_URL')

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
}

type PaymentMethod =
  | 'pix'
  | 'cartao'

type RequestBody = {
  pagamento_id: string
  metodo: PaymentMethod
  parcelas?: number

  credit_card?: {
    holder_name: string
    number: string
    expiry_month: string
    expiry_year: string
    ccv: string
  }

  credit_card_holder_info?: {
    name: string
    email: string
    cpf_cnpj: string
    postal_code: string
    address_number: string
    address_complement?: string
    phone: string
    mobile_phone?: string
  }
}

type Pagamento = {
  id: string
  user_id: string | null
  matricula_id: string | null
  turma_id: string | null
  turma_participante_id: string | null
  plano_id: string | null
  idioma: string | null
  tipo_plano: string | null
  metodo: string
  status: string
  valor: number
  parcelas: number | null
  recorrencia_autorizada: boolean
  recorrencia_autorizada_em: string | null
  asaas_customer_id: string | null
  asaas_payment_id: string | null
  asaas_subscription_id: string | null
  pix_qr_code: string | null
  pix_copia_cola: string | null
  dados_matricula: Record<string, unknown> | null
}

type Plano = {
  id: string
  idioma: string
  tipo: string
  nome: string
  preco: number
  parcelas: number | null
  valor_parcela: number | null
  modalidade: string
  aulas_semana: number | null
}

const supabaseAdmin = createClient(
  SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!,
)

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

/*
 * =========================================================
 * AUTENTICAÇÃO
 * =========================================================
 */

/*
 * =========================================================
 * ASAAS
 * =========================================================
 */

function digits(value: string) {
  return value.replace(/\D/g, '')
}

function luhnValid(value: string) {
  const number = digits(value)
  let sum = 0
  let doubleDigit = false

  for (let index = number.length - 1; index >= 0; index -= 1) {
    let digit = Number(number[index])

    if (doubleDigit) {
      digit *= 2
      if (digit > 9) digit -= 9
    }

    sum += digit
    doubleDigit = !doubleDigit
  }

  return number.length > 0 && sum % 10 === 0
}

function getInstallmentBrand(number: string) {
  const cardNumber = digits(number)
  const firstTwo = Number(cardNumber.slice(0, 2))
  const firstFour = Number(cardNumber.slice(0, 4))

  if (cardNumber.startsWith('4')) return 'Visa'

  if (
    (firstTwo >= 51 && firstTwo <= 55) ||
    (firstFour >= 2221 && firstFour <= 2720)
  ) return 'Mastercard'

  return 'other'
}

function getClientIp(req: Request) {
  const forwardedFor =
    req.headers.get('x-forwarded-for')

  if (forwardedFor) {
    const firstIp =
      forwardedFor
        .split(',')
        .map(value => value.trim())
        .find(Boolean)

    if (firstIp) return firstIp
  }

  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    ''
  ).trim()
}

function normalizeCreditCard(
  card: NonNullable<RequestBody['credit_card']>,
) {
  return {
    holderName:
      card.holder_name
        .trim()
        .replace(/\s+/g, ' '),

    number:
      digits(card.number),

    expiryMonth:
      digits(card.expiry_month)
        .padStart(2, '0'),

    expiryYear:
      digits(card.expiry_year),

    ccv:
      digits(card.ccv),
  }
}

function normalizeCardHolder(
  holder: NonNullable<RequestBody['credit_card_holder_info']>,
) {
  return {
    name:
      holder.name
        .trim()
        .replace(/\s+/g, ' '),

    email:
      holder.email.trim(),

    cpfCnpj:
      digits(holder.cpf_cnpj),

    postalCode:
      digits(holder.postal_code),

    addressNumber:
      holder.address_number.trim(),

    addressComplement:
      holder.address_complement?.trim() || null,

    phone:
      digits(holder.phone),

    mobilePhone:
      digits(holder.mobile_phone || holder.phone),
  }
}

function validateCreditCard(
  card: ReturnType<typeof normalizeCreditCard>,
  holder: ReturnType<typeof normalizeCardHolder>,
) {
  if (!card.holderName) {
    throw new Error('Nome impresso no cartão é obrigatório.')
  }

  const lengths = [13, 14, 15, 16, 17, 18, 19]

  if (!lengths.includes(card.number.length)) {
    throw new Error('Número do cartão inválido.')
  }

  if (!luhnValid(card.number)) {
    throw new Error('Número do cartão inválido.')
  }

  const month = Number(card.expiryMonth)
  const year = Number(card.expiryYear)
  const now = new Date()

  if (
    !/^\d{2}$/.test(card.expiryMonth) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error('Mês de validade inválido.')
  }

  if (
    !/^\d{4}$/.test(card.expiryYear) ||
    year < now.getFullYear() ||
    (
      year === now.getFullYear() &&
      month < now.getMonth() + 1
    )
  ) {
    throw new Error('Ano de validade inválido ou cartão vencido.')
  }

  if (!/^\d{3,4}$/.test(card.ccv)) {
    throw new Error('Código de segurança inválido.')
  }

  if (!holder.name) {
    throw new Error('Nome do titular é obrigatório.')
  }

  if (
    !/^(\d{11}|\d{14})$/.test(
      holder.cpfCnpj,
    )
  ) {
    throw new Error('CPF/CNPJ do titular inválido.')
  }

  if (holder.postalCode.length !== 8) {
    throw new Error('CEP do titular inválido.')
  }

  if (!holder.addressNumber) {
    throw new Error('Número do endereço é obrigatório.')
  }

  if (
    holder.phone.length < 10 ||
    holder.phone.length > 11
  ) {
    throw new Error('Telefone do titular inválido.')
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(holder.email)) {
    throw new Error('E-mail do titular inválido.')
  }
}

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
          'Content-Type':
            'application/json',

          accept:
            'application/json',

          access_token:
            ASAAS_API_KEY,

          ...(options.headers || {}),
        },
      },
    )

  const text =
    await response.text()

  let data: unknown

  try {
    data = text
      ? JSON.parse(text)
      : null
  } catch {
    data = text
  }

  if (!response.ok) {
    console.error(
      'Erro Asaas:',
      response.status,
      data,
    )

    throw new Error(
      `Erro Asaas (${response.status}): ${
        typeof data === 'string'
          ? data
          : JSON.stringify(data)
      }`,
    )
  }

  return data
}

/*
 * =========================================================
 * PAGAMENTO
 * =========================================================
 */

async function getPagamento(
  pagamentoId: string,
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from('pagamentos')
      .select(`
        id,
        user_id,
        matricula_id,
        turma_id,
        turma_participante_id,
        plano_id,
        idioma,
        tipo_plano,
        metodo,
        status,
        valor,
        parcelas,
        recorrencia_autorizada,
        recorrencia_autorizada_em,
        asaas_customer_id,
        asaas_payment_id,
        asaas_subscription_id,
        pix_qr_code,
        pix_copia_cola,
        dados_matricula
      `)
      .eq(
        'id',
        pagamentoId,
      )
      .single()

  if (
    error ||
    !data
  ) {
    console.error(
      'Erro ao buscar pagamento:',
      error,
    )

    throw new Error(
      'Intenção de pagamento não encontrada.',
    )
  }

  return data as Pagamento
}

/*
 * =========================================================
 * PLANO
 * =========================================================
 */

async function getPlano(
  planoId: string,
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from('planos')
      .select(`
        id,
        idioma,
        tipo,
        nome,
        preco,
        parcelas,
        valor_parcela,
        modalidade,
        aulas_semana
      `)
      .eq(
        'id',
        planoId,
      )
      .single()

  if (
    error ||
    !data
  ) {
    throw new Error(
      'Plano não encontrado.',
    )
  }

  return data as Plano
}

/*
 * =========================================================
 * DADOS DO ALUNO
 * =========================================================
 */

function getStudentData(
  pagamento: Pagamento,
) {
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
    ).replace(
      /\D/g,
      '',
    )

  const email =
    String(
      dados.email ?? '',
    ).trim()

  const telefone =
    String(
      dados.telefone ?? '',
    ).replace(
      /\D/g,
      '',
    )

  if (!nome) {
    throw new Error(
      'Nome do aluno não informado.',
    )
  }

  if (
    cpf.length !== 11
  ) {
    throw new Error(
      'CPF do aluno inválido.',
    )
  }

  if (!email) {
    throw new Error(
      'E-mail do aluno não informado.',
    )
  }

  if (
    telefone.length < 10
  ) {
    throw new Error(
      'Telefone do aluno inválido.',
    )
  }

  return {
    nome,
    cpf,
    email,
    telefone,
  }
}

/*
 * =========================================================
 * FINALIZAR MATRÍCULA
 *
 * Executado somente depois que o pagamento
 * foi confirmado.
 *
 * Fluxo:
 *
 * pagamento confirmado
 *       ↓
 * cria/localiza aluno
 *       ↓
 * atualiza matrícula
 *       ↓
 * matrícula = ativa
 *       ↓
 * matrícula.aluno_id = aluno.id
 * =========================================================
 */

async function finalizeEnrollment(
  pagamento: Pagamento,
  userId: string,
) {
  if (
    !pagamento.matricula_id
  ) {
    throw new Error(
      'O pagamento não está vinculado a uma matrícula.',
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

  const student =
    getStudentData(
      pagamento,
    )

  /*
   * ---------------------------------------------------------
   * VERIFICAR MATRÍCULA
   * ---------------------------------------------------------
   */

  const {
    data: matricula,
    error: matriculaError,
  } =
    await supabaseAdmin
      .from('matriculas')
      .select(`
        id,
        aluno_id,
        status
      `)
      .eq(
        'id',
        pagamento.matricula_id,
      )
      .single()

  if (
    matriculaError ||
    !matricula
  ) {
    console.error(
      'Erro ao buscar matrícula:',
      matriculaError,
    )

    throw new Error(
      'Matrícula vinculada ao pagamento não encontrada.',
    )
  }

  /*
   * Se já estiver ativa, não cria outro aluno.
   * Isso torna a operação idempotente.
   */

  if (
    matricula.status ===
      'ativa' &&
    matricula.aluno_id
  ) {
    return {
      aluno_id:
        matricula.aluno_id,

      matricula_id:
        matricula.id,

      status:
        'ativa',
    }
  }

  /*
   * ---------------------------------------------------------
   * VERIFICAR ALUNO EXISTENTE
   * ---------------------------------------------------------
   *
   * Primeiro pelo user_id.
   */

  const {
    data: existingByUser,
    error: existingByUserError,
  } =
    await supabaseAdmin
      .from('alunos')
      .select('id')
      .eq(
        'user_id',
        userId,
      )
      .maybeSingle()

  if (
    existingByUserError
  ) {
    console.error(
      'Erro ao verificar aluno existente:',
      existingByUserError,
    )

    throw new Error(
      'Não foi possível verificar o cadastro do aluno.',
    )
  }

  let alunoId:
    | string
    | null =
    existingByUser?.id ??
    null

  /*
   * ---------------------------------------------------------
   * CRIAR ALUNO
   * ---------------------------------------------------------
   */

  if (!alunoId) {
    const {
      data: novoAluno,
      error: alunoError,
    } =
      await supabaseAdmin
        .from('alunos')
        .insert({
          user_id:
            userId,

          nome_completo:
            student.nome,

          cpf:
            student.cpf,

          email:
            student.email,

          data_nascimento:
            String(
              dados.data_nascimento ??
                '',
            ),

          telefone:
            student.telefone,

          responsavel_nome:
            dados.responsavel_nome
              ? String(
                  dados.responsavel_nome,
                ).trim()
              : null,

          responsavel_contato:
            dados.responsavel_contato
              ? String(
                  dados.responsavel_contato,
                ).replace(
                  /\D/g,
                  '',
                )
              : null,

          idioma:
            pagamento.idioma,

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
        })
        .select('id')
        .single()

    if (
      alunoError ||
      !novoAluno
    ) {
      console.error(
        'Erro ao criar aluno:',
        alunoError,
      )

      throw new Error(
        'Não foi possível criar o cadastro do aluno.',
      )
    }

    alunoId =
      novoAluno.id
  }

  /*
   * ---------------------------------------------------------
   * MATRÍCULA COLETIVA
   * ---------------------------------------------------------
   */
  if (pagamento.turma_id && pagamento.turma_participante_id) {
    const { data: turma, error: turmaError } = await supabaseAdmin
      .from('turmas')
      .select('id,modalidade,idioma,aulas_semana,quantidade_minima,quantidade_maxima')
      .eq('id', pagamento.turma_id)
      .maybeSingle()

    const { data: participante, error: participanteError } = await supabaseAdmin
      .from('turma_participantes')
      .select('id,turma_id,user_id,status,reserva_expira_em')
      .eq('id', pagamento.turma_participante_id)
      .maybeSingle()

    if (turmaError || participanteError || !turma || !participante || participante.user_id !== userId || participante.turma_id !== turma.id) {
      throw new Error('A participação coletiva vinculada ao pagamento não é válida.')
    }

    const { count } = await supabaseAdmin
      .from('turma_participantes')
      .select('id', { count: 'exact', head: true })
      .eq('turma_id', turma.id)
      .in('status', ['convidado','confirmado'])

    const { data: valorColetivo, error: valorError } = await supabaseAdmin.rpc('preco_coletivo', {
      p_idioma: turma.idioma,
      p_modalidade: turma.modalidade,
      p_aulas_semana: turma.aulas_semana,
      p_participantes: count ?? 1,
    })

    if (valorError || valorColetivo == null || Math.abs(Number(pagamento.valor) - Number(valorColetivo)) > 0.01) {
      throw new Error('O valor do pagamento não corresponde ao valor atual da turma.')
    }

    const { data: updatedMatricula, error: updateMatriculaError } = await supabaseAdmin
      .from('matriculas')
      .update({ aluno_id: alunoId, status: 'ativa', updated_at: new Date().toISOString() })
      .eq('id', matricula.id)
      .select('id')
      .single()

    if (updateMatriculaError || !updatedMatricula) {
      throw new Error('Não foi possível ativar a matrícula coletiva.')
    }

    const { error: participantUpdateError } = await supabaseAdmin
      .from('turma_participantes')
      .update({
        aluno_id: alunoId,
        status: 'confirmado',
        confirmado_em: new Date().toISOString(),
        reserva_expira_em: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', participante.id)

    if (participantUpdateError) throw new Error('Não foi possível confirmar a participação na turma.')

    const { count: confirmedCount } = await supabaseAdmin
      .from('turma_participantes')
      .select('id', { count: 'exact', head: true })
      .eq('turma_id', turma.id)
      .eq('status', 'confirmado')

    await supabaseAdmin
      .from('turmas')
      .update({
        status: (confirmedCount ?? 0) >= turma.quantidade_minima ? 'ativa' : 'em_formacao',
        updated_at: new Date().toISOString(),
      })
      .eq('id', turma.id)

    await supabaseAdmin
      .from('turma_matriculas')
      .update({ status: 'ativa', updated_at: new Date().toISOString() })
      .eq('participante_id', participante.id)
      .eq('matricula_id', matricula.id)

    const horarioIds = (pagamento.dados_matricula?.schedules as Array<{ id?: string }> | undefined)?.map((item) => item.id).filter((id): id is string => Boolean(id)) ?? []
    if (horarioIds.length > 0) {
      const { data: selectedHorarios } = await supabaseAdmin
        .from('horarios')
        .select('id,dia_semana,hora_inicio')
        .in('id', horarioIds)

      for (const horario of selectedHorarios ?? []) {
        await supabaseAdmin
          .from('matricula_horarios')
          .upsert({
            matricula_id: matricula.id,
            horario_id: horario.id,
            dia_semana: horario.dia_semana,
            horario: horario.hora_inicio,
            created_at: new Date().toISOString(),
          }, { onConflict: 'matricula_id,horario_id', ignoreDuplicates: true })
      }
    }

    return {
      aluno_id: alunoId,
      matricula_id: matricula.id,
      status: 'ativa',
    }
  }

  /*
   * ---------------------------------------------------------
   * ATIVAR MATRÍCULA
   * ---------------------------------------------------------
   */

  const {
    data: updatedMatricula,
    error: updateMatriculaError,
  } =
    await supabaseAdmin
      .from('matriculas')
      .update({
        aluno_id:
          alunoId,

        status:
          'ativa',

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        pagamento.matricula_id,
      )
      .select(`
        id,
        aluno_id,
        status
      `)
      .single()

  if (
    updateMatriculaError ||
    !updatedMatricula
  ) {
    console.error(
      'Erro ao ativar matrícula:',
      updateMatriculaError,
    )

    throw new Error(
      'Aluno criado, mas não foi possível ativar a matrícula.',
    )
  }

  console.log(
    'MATRÍCULA FINALIZADA:',
    {
      pagamento_id:
        pagamento.id,

      matricula_id:
        updatedMatricula.id,

      aluno_id:
        updatedMatricula.aluno_id,

      status:
        updatedMatricula.status,
    },
  )

  return {
    aluno_id:
      updatedMatricula.aluno_id,

    matricula_id:
      updatedMatricula.id,

    status:
      updatedMatricula.status,
  }
}

/*
 * =========================================================
 * CLIENTE ASAAS
 * =========================================================
 */

async function findOrCreateCustomer(
  student: {
    nome: string
    cpf: string
    email: string
    telefone: string
  },
) {
  const searchResult =
    await asaasRequest(
      `/customers?cpfCnpj=${encodeURIComponent(
        student.cpf,
      )}`,
      {
        method: 'GET',
      },
    ) as {
      data?: Array<{
        id: string
        name: string
        email?: string
        cpfCnpj?: string
      }>
    }

  if (
    searchResult.data &&
    searchResult.data.length > 0
  ) {
    return searchResult.data[0]
  }

  const customer =
    await asaasRequest(
      '/customers',
      {
        method: 'POST',

        body:
          JSON.stringify({
            name:
              student.nome,

            email:
              student.email,

            cpfCnpj:
              student.cpf,

            phone:
              student.telefone,

            notificationDisabled:
              false,
          }),
      },
    ) as {
      id: string
      name: string
      email?: string
      cpfCnpj?: string
    }

  return customer
}

/*
 * =========================================================
 * ATUALIZAR PAGAMENTO LOCAL
 * =========================================================
 */

async function updateLocalPayment(
  paymentId: string,
  values: Record<
    string,
    unknown
  >,
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from('pagamentos')
      .update({
        ...values,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        paymentId,
      )
      .select()
      .single()

  if (
    error ||
    !data
  ) {
    console.error(
      'Erro ao atualizar pagamento:',
      error,
    )

    throw new Error(
      'Não foi possível atualizar o pagamento.',
    )
  }

  return data
}

/*
 * =========================================================
 * FUNÇÃO PRINCIPAL
 * =========================================================
 */

Deno.serve(
  async (
    req,
  ) => {
    /*
     * CORS
     */

    if (
      req.method ===
      'OPTIONS'
    ) {
      return new Response(
        'ok',
        {
          headers:
            corsHeaders,
        },
      )
    }

    /*
     * Apenas POST
     */

    if (
      req.method !==
      'POST'
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
       * REQUEST
       * =====================================================
       */

      const body =
        (await req.json()) as RequestBody

      console.log(
        'BODY RECEBIDO NO ASAAS-PAYMENT:',
        {
          pagamento_id:
            body.pagamento_id,

          metodo:
            body.metodo,

          parcelas:
            body.parcelas,
        },
      )

      if (
        !body.pagamento_id
      ) {
        return jsonResponse(
          {
            error:
              'pagamento_id é obrigatório.',
          },
          400,
        )
      }

      if (
        body.metodo !==
          'pix' &&
        body.metodo !==
          'cartao'
      ) {
        return jsonResponse(
          {
            error:
              'Método de pagamento inválido.',
          },
          400,
        )
      }

      /*
       * =====================================================
       * BUSCAR INTENÇÃO DE PAGAMENTO
       * =====================================================
       */

      const pagamento =
        await getPagamento(
          body.pagamento_id,
        )

      /*
       * Não permite reutilizar uma intenção
       * que já foi efetivamente paga.
       */

      if (
        pagamento.status ===
        'pago'
      ) {
        return jsonResponse(
          {
            error:
              'Este pagamento já foi confirmado.',
          },
          409,
        )
      }

      /*
       * Evita criar dois pagamentos Asaas
       * para a mesma intenção.
       */

      if (
        pagamento.asaas_subscription_id &&
        pagamento.tipo_plano === 'mensalidade' &&
        body.metodo === 'cartao'
      ) {
        return jsonResponse(
          { error: 'Já existe uma assinatura mensal de cartão associada a esta intenção.' },
          409,
        )
      }

      if (
        pagamento.asaas_payment_id
      ) {
        if (
          body.metodo ===
            'pix' &&
          pagamento.pix_qr_code &&
          pagamento.pix_copia_cola
        ) {
          return jsonResponse(
            {
              success:
                true,

              metodo:
                'pix',

              pagamento_id:
                pagamento.id,

              asaas_payment_id:
                pagamento.asaas_payment_id,

              status:
                pagamento.status,

              valor:
                Number(
                  pagamento.valor,
                ),

              pix_qr_code:
                pagamento.pix_qr_code,

              pix_copia_cola:
                pagamento.pix_copia_cola,

              pix_expiration_date:
                null,
            },
          )
        }

        return jsonResponse(
          {
            error:
              'Já existe um pagamento Asaas associado a esta intenção.',
          },
          409,
        )
      }

      /*
       * =====================================================
       * DADOS DO ALUNO
       * =====================================================
       */

      const student =
        getStudentData(
          pagamento,
        )

      /*
       * =====================================================
       * VALOR OFICIAL
       * =====================================================
       */

      let valor: number
      let planoNome: string

      if (
        pagamento.plano_id
      ) {
        const plano =
          await getPlano(
            pagamento.plano_id,
          )

        if (pagamento.turma_id && (plano.modalidade === 'dupla' || plano.modalidade === 'grupo')) {
          const { data: turma, error: turmaError } = await supabaseAdmin
            .from('turmas')
            .select('id,idioma,modalidade,aulas_semana')
            .eq('id', pagamento.turma_id)
            .maybeSingle()

          const { count: participantesCount } = await supabaseAdmin
            .from('turma_participantes')
            .select('id', { count: 'exact', head: true })
            .eq('turma_id', pagamento.turma_id)
            .in('status', ['convidado','confirmado'])

          if (turmaError || !turma) throw new Error('Turma coletiva não encontrada.')
          const participantTotal = participantesCount ?? 1

          // Quando a turma ainda está sendo formada, o primeiro aluno
          // paga a condição de formação (individual com desconto).
          // A partir do segundo participante, aplica-se o preço coletivo
          // correspondente ao tamanho atual da turma.
          const { data: valorCalculado, error: valorError } = participantTotal <= 1
            ? await supabaseAdmin.rpc('preco_formacao_coletiva', {
                p_idioma: turma.idioma,
                p_modalidade: turma.modalidade,
                p_aulas_semana: turma.aulas_semana,
              })
            : await supabaseAdmin.rpc('preco_coletivo', {
                p_idioma: turma.idioma,
                p_modalidade: turma.modalidade,
                p_aulas_semana: turma.aulas_semana,
                p_participantes: participantTotal,
              })

          if (valorError || valorCalculado == null) {
            throw new Error('Não foi possível calcular o valor da turma.')
          }

          valor = Number(valorCalculado)
        } else {
          valor = Number(plano.preco)
        }

        planoNome = plano.nome
      } else {
        const dados =
          pagamento.dados_matricula

        valor =
          Number(
            dados?.valor_mensal ??
              pagamento.valor,
          )

        planoNome =
          'Plano personalizado'
      }

      if (
        !Number.isFinite(
          valor,
        ) ||
        valor < 0
      ) {
        throw new Error(
          'Valor do pagamento inválido.',
        )
      }

      /*
       * Garante que o valor salvo na intenção
       * corresponda ao valor calculado no servidor.
       */

      if (
        Number(
          pagamento.valor,
        ).toFixed(2) !==
        valor.toFixed(2)
      ) {
        await updateLocalPayment(
          pagamento.id,
          {
            valor,
          },
        )
      }

      /*
       * =====================================================
       * CLIENTE ASAAS
       * =====================================================
       */

      const customer =
        await findOrCreateCustomer(
          student,
        )

      /*
       * Salva o cliente antes de criar
       * o pagamento externo.
       */

      await updateLocalPayment(
        pagamento.id,
        {
          asaas_customer_id:
            customer.id,

          metodo:
            body.metodo,

          parcelas:
            body.metodo ===
            'cartao'
              ? Number(
                  body.parcelas ??
                    1,
                )
              : null,

          ...(body.metodo === 'pix'
            ? { status: 'processando' }
            : {}),
        },
      )

      /*
       * =====================================================
       * PIX
       * =====================================================
       */

      if (
        body.metodo ===
        'pix'
      ) {
        const dueDate =
          new Date()
            .toISOString()
            .slice(
              0,
              10,
            )

        const asaasPayment =
          await asaasRequest(
            '/payments',
            {
              method:
                'POST',

              body:
                JSON.stringify({
                  customer:
                    customer.id,

                  billingType:
                    'PIX',

                  value:
                    valor,

                  dueDate,

                  description:
                    `Matrícula AB Academy - ${planoNome}`,
                }),
            },
          ) as {
            id: string
            status: string
            value: number
          }

        /*
         * Buscar QR Code PIX
         */

        const pixData =
          await asaasRequest(
            `/payments/${asaasPayment.id}/pixQrCode`,
            {
              method:
                'GET',
            },
          ) as {
            encodedImage?: string
            payload?: string
            expirationDate?: string
          }

        /*
         * Atualizar intenção
         */

        const localUpdated =
          await updateLocalPayment(
            pagamento.id,
            {
              asaas_payment_id:
                asaasPayment.id,

              status:
                'pendente',

              valor,

              pix_qr_code:
                pixData.encodedImage ??
                null,

              pix_copia_cola:
                pixData.payload ??
                null,
            },
          )

        return jsonResponse({
          success:
            true,

          metodo:
            'pix',

          pagamento_id:
            localUpdated.id,

          asaas_payment_id:
            asaasPayment.id,

          status:
            'pendente',

          valor,

          pix_qr_code:
            pixData.encodedImage ??
            null,

          pix_copia_cola:
            pixData.payload ??
            null,

          pix_expiration_date:
            pixData.expirationDate ??
            null,
        })
      }

      /*
       * =====================================================
       * CARTÃO
       * =====================================================
       * Plano mensal = assinatura recorrente.
       * Outros planos = cobrança parcelada tradicional.
       */
      if (!body.credit_card) {
        return jsonResponse(
          { error: 'Dados do cartão são obrigatórios.' },
          400,
        )
      }

      if (!body.credit_card_holder_info) {
        return jsonResponse(
          { error: 'Dados do titular do cartão são obrigatórios.' },
          400,
        )
      }

      const creditCard =
        normalizeCreditCard(
          body.credit_card,
        )

      const creditCardHolderInfo =
        normalizeCardHolder(
          body.credit_card_holder_info,
        )

      validateCreditCard(
        creditCard,
        creditCardHolderInfo,
      )

      const remoteIp =
        getClientIp(req)

      if (!remoteIp) {
        return jsonResponse(
          {
            error:
              'Não foi possível identificar o IP do dispositivo para processar o cartão com segurança.',
          },
          400,
        )
      }

      if (
        pagamento.tipo_plano === 'mensal' ||
        (
          pagamento.tipo_plano === 'mensalidade' &&
          pagamento.recorrencia_autorizada
        )
      ) {
        const nextDueDate = new Date().toISOString().slice(0, 10)
        const subscription = await asaasRequest('/subscriptions', {
          method: 'POST',
          body: JSON.stringify({
            customer: customer.id,
            billingType: 'CREDIT_CARD',
            value: valor,
            nextDueDate,
            cycle: 'MONTHLY',
            description: 'Mensalidade AB Academy - ' + planoNome,
            externalReference: pagamento.id,
            creditCard,
            creditCardHolderInfo,
            remoteIp,
          }),
        }) as { id?: string }
        const subscriptionId = subscription.id ? String(subscription.id) : null
        if (!subscriptionId) throw new Error('O Asaas criou a assinatura, mas não retornou o ID.')
        const localUpdated = await updateLocalPayment(pagamento.id, {
          asaas_subscription_id: subscriptionId,
          asaas_customer_id: customer.id,
          status: 'processando',
          valor,
          parcelas: null,
        })
        return jsonResponse({
          success: true, metodo: 'cartao', pagamento_id: localUpdated.id,
          asaas_payment_id: null, asaas_subscription_id: subscriptionId,
          status: 'processando', valor, recorrente: true, ciclo: 'MONTHLY',
        })
      }

      const parcelas = Number(body.parcelas ?? 1)
      const installmentBrand =
        getInstallmentBrand(
          creditCard.number,
        )

      const maxInstallments =
        installmentBrand === 'Visa' ||
        installmentBrand === 'Mastercard'
          ? 21
          : 12

      if (
        !Number.isInteger(parcelas) ||
        parcelas < 1 ||
        parcelas > maxInstallments
      ) {
        return jsonResponse(
          {
            error:
              'O número de parcelas informado não é permitido para a bandeira identificada.',
          },
          400,
        )
      }

      const valorParcela =
        Number(
          (valor / parcelas).toFixed(2),
        )

      const installmentFields =
        parcelas > 1
          ? {
              installmentCount:
                parcelas,
              installmentValue:
                valorParcela,
            }
          : {}

      const asaasPayment =
        await asaasRequest(
          '/payments',
          {
            method:
              'POST',
            body:
              JSON.stringify({
                customer:
                  customer.id,
                billingType:
                  'CREDIT_CARD',
                value:
                  valor,
                dueDate:
                  new Date()
                    .toISOString()
                    .slice(0, 10),
                description:
                  'Matrícula AB Academy - ' +
                  planoNome,
                ...installmentFields,
                creditCard,
                creditCardHolderInfo,
                remoteIp,
              }),
          },
        ) as {
          id: string
          status: string
          value: number
        }
      let localStatus = 'processando'
      if (asaasPayment.status === 'CONFIRMED') localStatus = 'pago'
      if (asaasPayment.status === 'OVERDUE') localStatus = 'recusado'
      const localUpdated = await updateLocalPayment(pagamento.id, {
        asaas_payment_id: asaasPayment.id, status: localStatus, valor, parcelas,
      })
      const enrollmentResult: { aluno_id: string | null; matricula_id: string; status: string } | null = null
      return jsonResponse({
        success: true, metodo: 'cartao', pagamento_id: localUpdated.id, asaas_payment_id: asaasPayment.id,
        status: localStatus, asaas_status: asaasPayment.status, valor, parcelas, valor_parcela: valorParcela,
        matricula_id: enrollmentResult?.matricula_id ?? pagamento.matricula_id ?? null,
        aluno_id: enrollmentResult?.aluno_id ?? null, matricula_status: enrollmentResult?.status ?? null,
      })
    } catch (
      error
    ) {
      console.error(
        'Erro na função asaas-payment:',
        error,
      )

      return jsonResponse(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Não foi possível processar o pagamento.',
        },
        500,
      )
    }
  },
)