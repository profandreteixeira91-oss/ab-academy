import { supabase } from '../lib/supabase'

export type PaymentMethod = 'pix' | 'cartao'

export type CreatePixPaymentResponse = {
  success: boolean
  metodo: 'pix'
  pagamento_id: string
  asaas_payment_id: string
  status: string
  valor: number
  pix_qr_code: string | null
  pix_copia_cola: string | null
  pix_expiration_date: string | null
}

export type CreateCardPaymentResponse = {
  success: boolean
  metodo: 'cartao'
  pagamento_id: string
  asaas_payment_id: string
  status: string
  asaas_status: string
  valor: number
  parcelas: number
  valor_parcela: number
}

export type CreditCardData = {
  holder_name: string
  number: string
  expiry_month: string
  expiry_year: string
  ccv: string
}

export type CreditCardHolderInfo = {
  name: string
  email: string
  cpf_cnpj: string
  postal_code: string
  address_number: string
  address_complement?: string
  phone: string
  mobile_phone?: string
}

type CreatePaymentParams = {
  pagamento_id: string
  metodo: PaymentMethod
  parcelas?: number
  credit_card?: CreditCardData
  credit_card_holder_info?: CreditCardHolderInfo
}

export async function createPayment(
  params: CreatePaymentParams,
): Promise<
  CreatePixPaymentResponse | CreateCardPaymentResponse
> {
  const {
    data: {
      session,
    },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (
    sessionError ||
    !session?.access_token
  ) {
    throw new Error(
      'Sua sessão expirou. Faça login novamente.',
    )
  }

  const action =
    params.metodo === 'pix'
      ? 'create_pix'
      : 'create_card'

  const { data, error } =
    await supabase.functions.invoke(
      'asaas-payment',
      {
        body: {
          action,
          pagamento_id:
            params.pagamento_id,
          metodo:
            params.metodo,
          parcelas:
            params.parcelas,
          credit_card:
            params.credit_card,
          credit_card_holder_info:
            params.credit_card_holder_info,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    )

  if (error) {
    console.error(
      'Erro ao chamar asaas-payment:',
      error,
    )

    throw new Error(
      error.message ||
        'Não foi possível iniciar o pagamento.',
    )
  }

  if (
    !data ||
    data.success !== true
  ) {
    throw new Error(
      data?.error ||
        'Não foi possível processar o pagamento.',
    )
  }

  return data as
    | CreatePixPaymentResponse
    | CreateCardPaymentResponse
}