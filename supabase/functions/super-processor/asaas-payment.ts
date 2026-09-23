import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ASAAS_API_URL =
  Deno.env.get('ASAAS_API_URL') ||
  'https://api-sandbox.asaas.com/v3'

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  'SUPABASE_SERVICE_ROLE_KEY',
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type PaymentMethod = 'pix' | 'cartao'

type RequestBody = {
  action: 'create_pix' | 'create_card'
  matricula_id: string
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

type Matricula = {
  id: string
  aluno_id: string
  plano_id: string
  idioma: string
  status: string
}

type Aluno = {
  id: string
  user_id: string
  nome_completo: string
  cpf: string
  email: string
  telefone: string
}

type Plano = {
  id: string
  idioma: string
  tipo: string
  nome: string
  preco: number
  parcelas: number | null
  valor_parcela: number | null
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
        'Content-Type': 'application/json',
      },
    },
  )
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

  const response = await fetch(
    `${ASAAS_API_URL}${path}`,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        access_token: ASAAS_API_KEY,
        ...(options.headers || {}),
      },
    },
  )

  const text = await response.text()

  let data: unknown

  try {
    data = text ? JSON.parse(text) : null
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

async function getMatricula(
  matriculaId: string,
) {
  const { data, error } =
    await supabaseAdmin
      .from('matriculas')
      .select(`
        id,
        aluno_id,
        plano_id,
        idioma,
        status
      `)
      .eq('id', matriculaId)
      .single()

  if (error || !data) {
    throw new Error(
      'Matrícula não encontrada.',
    )
  }

  return data as Matricula
}

async function getAluno(
  alunoId: string,
) {
  const { data, error } =
    await supabaseAdmin
      .from('alunos')
      .select(`
        id,
        user_id,
        nome_completo,
        cpf,
        email,
        telefone
      `)
      .eq('id', alunoId)
      .single()

  if (error || !data) {
    throw new Error(
      'Aluno não encontrado.',
    )
  }

  return data as Aluno
}

async function getPlano(
  planoId: string,
) {
  const { data, error } =
    await supabaseAdmin
      .from('planos')
      .select(`
        id,
        idioma,
        tipo,
        nome,
        preco,
        parcelas,
        valor_parcela
      `)
      .eq('id', planoId)
      .single()

  if (error || !data) {
    throw new Error(
      'Plano não encontrado.',
    )
  }

  return data as Plano
}

async function findOrCreateCustomer(
  aluno: Aluno,
) {
  const searchResult =
    await asaasRequest(
      `/customers?cpfCnpj=${encodeURIComponent(
        aluno.cpf,
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
        body: JSON.stringify({
          name: aluno.nome_completo,
          email: aluno.email,
          cpfCnpj: aluno.cpf,
          phone: aluno.telefone,
          notificationDisabled: false,
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

async function createLocalPayment(
  matriculaId: string,
  customerId: string,
  metodo: PaymentMethod,
  valor: number,
  parcelas?: number,
) {
  const { data, error } =
    await supabaseAdmin
      .from('pagamentos')
      .insert({
        matricula_id: matriculaId,
        asaas_customer_id: customerId,
        metodo,
        status: 'processando',
        valor,
        parcelas:
          metodo === 'cartao'
            ? parcelas ?? 1
            : null,
      })
      .select()
      .single()

  if (error || !data) {
    console.error(
      'Erro ao criar pagamento local:',
      error,
    )

    throw new Error(
      'Não foi possível registrar o pagamento.',
    )
  }

  return data
}

async function updateLocalPayment(
  paymentId: string,
  values: Record<string, unknown>,
) {
  const { data, error } =
    await supabaseAdmin
      .from('pagamentos')
      .update({
        ...values,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .select()
      .single()

  if (error || !data) {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(
      'ok',
      {
        headers: corsHeaders,
      },
    )
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      {
        error:
          'Método não permitido.',
      },
      405,
    )
  }

  try {
    if (
      !ASAAS_API_KEY ||
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      return jsonResponse(
        {
          error:
            'Configuração da função incompleta.',
        },
        500,
      )
    }

    const body =
      (await req.json()) as RequestBody

    if (!body.matricula_id) {
      return jsonResponse(
        {
          error:
            'matricula_id é obrigatório.',
        },
        400,
      )
    }

    if (
      body.metodo !== 'pix' &&
      body.metodo !== 'cartao'
    ) {
      return jsonResponse(
        {
          error:
            'Método de pagamento inválido.',
        },
        400,
      )
    }

    const matricula =
      await getMatricula(
        body.matricula_id,
      )

    const aluno =
      await getAluno(
        matricula.aluno_id,
      )

    const plano =
      await getPlano(
        matricula.plano_id,
      )

    const valor = Number(
      plano.preco,
    )

    if (
      !Number.isFinite(valor) ||
      valor < 0
    ) {
      throw new Error(
        'Valor do plano inválido.',
      )
    }

    const customer =
      await findOrCreateCustomer(
        aluno,
      )

    const localPayment =
      await createLocalPayment(
        matricula.id,
        customer.id,
        body.metodo,
        valor,
        body.parcelas,
      )

    /*
     * =====================================================
     * PIX
     * =====================================================
     */

    if (body.metodo === 'pix') {
      const dueDate =
        new Date()
          .toISOString()
          .slice(0, 10)

      const asaasPayment =
        await asaasRequest(
          '/payments',
          {
            method: 'POST',
            body: JSON.stringify({
              customer: customer.id,
              billingType: 'PIX',
              value: valor,
              dueDate,
              description:
                `Matrícula AB Academy - ${plano.nome}`,
            }),
          },
        ) as {
          id: string
          status: string
          value: number
        }

      const pixData =
        await asaasRequest(
          `/payments/${asaasPayment.id}/pixQrCode`,
          {
            method: 'GET',
          },
        ) as {
          encodedImage?: string
          payload?: string
          expirationDate?: string
        }

      const localUpdated =
        await updateLocalPayment(
          localPayment.id,
          {
            asaas_payment_id:
              asaasPayment.id,

            status: 'pendente',

            pix_qr_code:
              pixData.encodedImage ?? null,

            pix_copia_cola:
              pixData.payload ?? null,
          },
        )

      return jsonResponse({
        success: true,
        metodo: 'pix',
        pagamento_id:
          localUpdated.id,
        asaas_payment_id:
          asaasPayment.id,
        status: 'pendente',
        valor,
        pix_qr_code:
          pixData.encodedImage ?? null,
        pix_copia_cola:
          pixData.payload ?? null,
        pix_expiration_date:
          pixData.expirationDate ?? null,
      })
    }

    /*
     * =====================================================
     * CARTÃO
     * =====================================================
     */

    if (!body.credit_card) {
      return jsonResponse(
        {
          error:
            'Dados do cartão são obrigatórios.',
        },
        400,
      )
    }

    if (
      !body.credit_card_holder_info
    ) {
      return jsonResponse(
        {
          error:
            'Dados do titular do cartão são obrigatórios.',
        },
        400,
      )
    }

    const parcelas =
      Number(body.parcelas ?? 1)

    if (
      !Number.isInteger(parcelas) ||
      parcelas < 1 ||
      parcelas > 12
    ) {
      return jsonResponse(
        {
          error:
            'O número de parcelas deve estar entre 1 e 12.',
        },
        400,
      )
    }

    const valorParcela =
      Number(
        (valor / parcelas).toFixed(2),
      )

    const asaasPayment =
      await asaasRequest(
        '/payments',
        {
          method: 'POST',
          body: JSON.stringify({
            customer: customer.id,

            billingType:
              'CREDIT_CARD',

            value: valor,

            dueDate:
              new Date()
                .toISOString()
                .slice(0, 10),

            description:
              `Matrícula AB Academy - ${plano.nome}`,

            installmentCount:
              parcelas,

            installmentValue:
              valorParcela,

            creditCard: {
              holderName:
                body.credit_card
                  .holder_name,

              number:
                body.credit_card
                  .number,

              expiryMonth:
                body.credit_card
                  .expiry_month,

              expiryYear:
                body.credit_card
                  .expiry_year,

              ccv:
                body.credit_card.ccv,
            },

            creditCardHolderInfo:
              body.credit_card_holder_info,
          }),
        },
      ) as {
        id: string
        status: string
        value: number
      }

    let localStatus =
      'processando'

    if (
      asaasPayment.status ===
      'CONFIRMED'
    ) {
      localStatus = 'pago'
    }

    if (
      asaasPayment.status ===
      'OVERDUE'
    ) {
      localStatus = 'recusado'
    }

    const localUpdated =
      await updateLocalPayment(
        localPayment.id,
        {
          asaas_payment_id:
            asaasPayment.id,

          status: localStatus,
        },
      )

    return jsonResponse({
      success: true,
      metodo: 'cartao',
      pagamento_id:
        localUpdated.id,
      asaas_payment_id:
        asaasPayment.id,
      status: localStatus,
      asaas_status:
        asaasPayment.status,
      valor,
      parcelas,
      valor_parcela: valorParcela,
    })
  } catch (error) {
    console.error(
      'Erro na função asaas-payment:',
      error,
    )

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro interno ao processar pagamento.',
      },
      500,
    )
  }
})