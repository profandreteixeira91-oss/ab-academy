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
  plano_id: string | null
  idioma: string | null
  tipo_plano: string | null
  metodo: string
  status: string
  valor: number
  parcelas: number | null
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

async function getAuthenticatedUser(
  req: Request,
) {
  const authHeader =
    req.headers.get(
      'Authorization',
    )

  if (!authHeader) {
    throw new Error(
      'Usuário não autenticado.',
    )
  }

  const token =
    authHeader
      .replace(
        'Bearer ',
        '',
      )
      .trim()

  if (!token) {
    throw new Error(
      'Token de autenticação inválido.',
    )
  }

  const {
    data: {
      user,
    },
    error,
  } =
    await supabaseAdmin.auth.getUser(
      token,
    )

  if (
    error ||
    !user
  ) {
    throw new Error(
      'Sessão do usuário inválida ou expirada.',
    )
  }

  return user
}

/*
 * =========================================================
 * ASAAS
 * =========================================================
 */

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
  userId: string,
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
        plano_id,
        idioma,
        tipo_plano,
        metodo,
        status,
        valor,
        parcelas,
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

  if (
    data.user_id !== userId
  ) {
    throw new Error(
      'Você não tem permissão para acessar este pagamento.',
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
        valor_parcela
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
       * CONFIGURAÇÃO
       * =====================================================
       */

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

      /*
       * =====================================================
       * AUTENTICAÇÃO
       * =====================================================
       */

      const user =
        await getAuthenticatedUser(
          req,
        )

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
          user.id,
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
        pagamento.tipo_plano === 'mensal' &&
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

        valor =
          Number(
            plano.preco,
          )

        planoNome =
          plano.nome
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

          status:
            'processando',

          parcelas:
            body.metodo ===
            'cartao'
              ? Number(
                  body.parcelas ??
                    1,
                )
              : null,
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
      if (!body.credit_card) return jsonResponse({ error: 'Dados do cartão são obrigatórios.' }, 400)
      if (!body.credit_card_holder_info) return jsonResponse({ error: 'Dados do titular do cartão são obrigatórios.' }, 400)

      if (pagamento.tipo_plano === 'mensal') {
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
            creditCard: {
              holderName: body.credit_card.holder_name,
              number: body.credit_card.number,
              expiryMonth: body.credit_card.expiry_month,
              expiryYear: body.credit_card.expiry_year,
              ccv: body.credit_card.ccv,
            },
            creditCardHolderInfo: body.credit_card_holder_info,
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
      if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 12) return jsonResponse({ error: 'O número de parcelas deve estar entre 1 e 12.' }, 400)
      const valorParcela = Number((valor / parcelas).toFixed(2))
      const asaasPayment = await asaasRequest('/payments', {
        method: 'POST',
        body: JSON.stringify({
          customer: customer.id, billingType: 'CREDIT_CARD', value: valor,
          dueDate: new Date().toISOString().slice(0, 10),
          description: 'Matrícula AB Academy - ' + planoNome,
          installmentCount: parcelas, installmentValue: valorParcela,
          creditCard: {
            holderName: body.credit_card.holder_name, number: body.credit_card.number,
            expiryMonth: body.credit_card.expiry_month, expiryYear: body.credit_card.expiry_year, ccv: body.credit_card.ccv,
          },
          creditCardHolderInfo: body.credit_card_holder_info,
        }),
      }) as { id: string; status: string; value: number }
      let localStatus = 'processando'
      if (asaasPayment.status === 'CONFIRMED') localStatus = 'pago'
      if (asaasPayment.status === 'OVERDUE') localStatus = 'recusado'
      const localUpdated = await updateLocalPayment(pagamento.id, {
        asaas_payment_id: asaasPayment.id, status: localStatus, valor, parcelas,
      })
      let enrollmentResult: { aluno_id: string | null; matricula_id: string; status: string } | null = null
      if (localStatus === 'pago') {
        enrollmentResult = await finalizeEnrollment({ ...pagamento, status: 'pago', asaas_payment_id: asaasPayment.id, asaas_subscription_id: null, parcelas, valor }, user.id)
      }
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
              : 'Erro interno ao processar pagamento.',
        },
        500,
      )
    }
  },
)