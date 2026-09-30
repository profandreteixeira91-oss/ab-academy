import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  CreditCard,
  QrCode,
  ShieldCheck,
} from 'lucide-react'

import '../styles/checkout.css'
import { supabase } from '../lib/supabase'
import {
  createPayment,
  type CreditCardData,
  type CreditCardHolderInfo,
  type PaymentMethod,
} from '../services/asaas'

type CheckoutProps = {
  pagamentoId: string
}

type PagamentoInfo = {
  id: string
  idioma: string | null
  tipo_plano: string | null
  valor: number
  status: string
  matricula_id?: string | null
  plano_nome: string | null
  dados_matricula: Record<
    string,
    unknown
  > | null
}

type CardBrand = 'Visa' | 'Mastercard' | 'American Express' | 'Elo' | 'Hipercard' | 'Diners Club' | 'Discover' | null

function digits(value: string) { return value.replace(/\D/g, '') }
function luhnValid(value: string) {
  const number = digits(value); let sum = 0; let doubleDigit = false
  for (let index = number.length - 1; index >= 0; index -= 1) {
    let digit = Number(number[index])
    if (doubleDigit) { digit *= 2; if (digit > 9) digit -= 9 }
    sum += digit; doubleDigit = !doubleDigit
  }
  return number.length > 0 && sum % 10 === 0
}
function firstThree(value: string) { return Number(digits(value).slice(0, 3)) }
function getCardBrand(value: string): CardBrand {
  const number = digits(value); if (!number) return null
  const firstTwo = Number(number.slice(0, 2)), firstFour = Number(number.slice(0, 4)), firstSix = Number(number.slice(0, 6))
  if (number.startsWith('606282') || number.startsWith('637095') || number.startsWith('637568') || number.startsWith('637599') || number.startsWith('637609') || number.startsWith('637612') || [384100,384140,384160].includes(firstSix)) return 'Hipercard'
  const eloPrefixes = ['401178','401179','431274','438935','451416','457393','457631','457632','504175','627780','636297','636368','636369']
  if (eloPrefixes.some(prefix => number.startsWith(prefix)) || firstFour === 4576 || (firstSix >= 506699 && firstSix <= 506778) || (firstSix >= 509000 && firstSix <= 509999) || (firstSix >= 650031 && firstSix <= 650033) || (firstSix >= 650035 && firstSix <= 650051) || (firstSix >= 650405 && firstSix <= 650439) || (firstSix >= 650485 && firstSix <= 650538) || (firstSix >= 650541 && firstSix <= 650598) || (firstSix >= 650700 && firstSix <= 650718) || (firstSix >= 650720 && firstSix <= 650727) || (firstSix >= 650901 && firstSix <= 650978) || (firstSix >= 651652 && firstSix <= 651679) || (firstSix >= 655000 && firstSix <= 655019) || (firstSix >= 655021 && firstSix <= 655058)) return 'Elo'
  if (firstTwo === 34 || firstTwo === 37) return 'American Express'
  if ((firstFour >= 2221 && firstFour <= 2720) || (firstTwo >= 51 && firstTwo <= 55)) return 'Mastercard'
  if (number.startsWith('4')) return 'Visa'
  if (number.startsWith('6011') || number.startsWith('65') || (firstThree(value) >= 644 && firstThree(value) <= 649) || (firstSix >= 622126 && firstSix <= 622925)) return 'Discover'
  if ((firstThree(value) >= 300 && firstThree(value) <= 305) || firstTwo === 36 || firstTwo === 38 || firstTwo === 39) return 'Diners Club'
  return null
}
function formatCardNumber(value: string, brand: CardBrand) {
  const number = digits(value)
  if (brand === 'American Express') return number.slice(0,15).replace(/(\d{4})(\d{0,6})(\d{0,5})/, (_m,a,b,d) => [a,b,d].filter(Boolean).join(' '))
  return number.slice(0,19).replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}
function formatCpfCnpj(value: string) {
  const number = digits(value).slice(0,14)
  if (number.length <= 11) return number.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2')
  return number.replace(/(\d{2})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1/$2').replace(/(\d{4})(\d{1,2})$/,'$1-$2')
}
function formatCep(value: string) { return digits(value).slice(0,8).replace(/(\d{5})(\d)/,'$1-$2') }
function formatPhone(value: string) {
  const number = digits(value).slice(0,11)
  const pattern = number.length <= 10 ? /(\d{2})(\d{4})(\d{0,4})/ : /(\d{2})(\d{5})(\d{0,4})/
  return number.replace(pattern, (_m,ddd,first,last) => [ddd ? '('+ddd+')' : '', first, last ? first+'-'+last : ''].filter(Boolean).join(' '))
}

type PaymentResult = {
  pagamento_id: string
  asaas_payment_id: string
  status: string
  asaas_status?: string
  valor: number
  pix_qr_code?: string | null
  pix_copia_cola?: string | null
  pix_expiration_date?: string | null
  parcelas?: number
  valor_parcela?: number
}

export default function Checkout({
  pagamentoId,
}: CheckoutProps) {
  const [pagamento, setPagamento] =
    useState<PagamentoInfo | null>(
      null,
    )

  const [metodo, setMetodo] =
    useState<PaymentMethod>('pix')

  const [parcelas, setParcelas] =
    useState('1')

  const [loading, setLoading] =
    useState(true)

  const [processing, setProcessing] =
    useState(false)

  const [checkingPayment, setCheckingPayment] =
    useState(false)

  const [paymentConfirmed, setPaymentConfirmed] =
    useState(false)

  const [error, setError] =
    useState('')

  const [success, setSuccess] =
    useState('')

  const [paymentResult, setPaymentResult] =
    useState<PaymentResult | null>(
      null,
    )

  const redirectTimeoutRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null)

  const [card, setCard] =
    useState<CreditCardData>({
      holder_name: '',
      number: '',
      expiry_month: '',
      expiry_year: '',
      ccv: '',
    })

  const [holder, setHolder] =
    useState<CreditCardHolderInfo>({
      name: '',
      email: '',
      cpf_cnpj: '',
      postal_code: '',
      address_number: '',
      address_complement: '',
      phone: '',
      mobile_phone: '',
    })

  /*
   * =========================================================
   * LIMPAR REDIRECIONAMENTO
   * =========================================================
   */

  useEffect(() => {
    return () => {
      if (
        redirectTimeoutRef.current
      ) {
        clearTimeout(
          redirectTimeoutRef.current,
        )
      }
    }
  }, [])

  /*
   * =========================================================
   * VERIFICAR STATUS DO PAGAMENTO
   * =========================================================
   */

  async function checkPaymentStatus() {
    try {
      const {
        data: {
          user,
        },
      } =
        await supabase.auth.getUser()

      if (!user) {
        return
      }

      const {
        data,
        error: statusError,
      } =
        await supabase
          .from('pagamentos')
          .select(`
            id,
            status,
            matricula_id
          `)
          .eq(
            'id',
            pagamentoId,
          )
          .eq(
            'user_id',
            user.id,
          )
          .maybeSingle()

      if (statusError) {
        console.error(
          'Erro ao consultar status do pagamento:',
          statusError,
        )

        return
      }

      if (!data) {
        return
      }

      /*
       * O webhook só considera a matrícula concluída
       * quando o pagamento está pago e a matrícula
       * já foi vinculada.
       */

      if (
        data.status ===
          'pago' &&
        data.matricula_id
      ) {
        setPaymentConfirmed(
          true,
        )

        setCheckingPayment(
          false,
        )

        setSuccess(
          'Pagamento confirmado! Sua matrícula foi realizada com sucesso.',
        )

        if (
          redirectTimeoutRef.current
        ) {
          clearTimeout(
            redirectTimeoutRef.current,
          )
        }

        redirectTimeoutRef.current =
          setTimeout(() => {
            window.location.assign(
              '/aluno',
            )
          }, 1800)
      }
    } catch (err) {
      console.error(
        'Erro ao verificar pagamento:',
        err,
      )
    }
  }

  /*
   * =========================================================
   * MONITORAR PAGAMENTO
   * =========================================================
   */

  useEffect(() => {
    if (!pagamento) {
      return
    }

    if (paymentConfirmed) {
      return
    }

    /*
     * Só começa o monitoramento quando:
     *
     * 1. já existe um PIX/cartão processado
     * OU
     * 2. o pagamento já estava pago ao abrir a página.
     */

    const deveMonitorar =
      Boolean(
        paymentResult,
      ) ||
      pagamento.status ===
        'processando' ||
      pagamento.status ===
        'pago'

    if (!deveMonitorar) {
      return
    }

    setCheckingPayment(
      true,
    )

    let ativo = true

    /*
     * Verifica imediatamente.
     */

    checkPaymentStatus()

    /*
     * Depois verifica periodicamente.
     *
     * O webhook do Asaas é quem efetivamente
     * confirma o pagamento no banco.
     */

    const interval =
      window.setInterval(() => {
        if (ativo) {
          checkPaymentStatus()
        }
      }, 3000)

    return () => {
      ativo = false
      window.clearInterval(
        interval,
      )
    }
  }, [
    pagamento,
    paymentResult,
    paymentConfirmed,
  ])

  /*
   * =========================================================
   * CARREGAR INTENÇÃO DE PAGAMENTO
   * =========================================================
   */

  useEffect(() => {
    async function loadPagamento() {
      try {
        setLoading(true)
        setError('')

        const {
          data: {
            user,
          },
        } =
          await supabase.auth.getUser()

        if (!user) {
          throw new Error(
            'Você precisa estar autenticado para acessar o checkout.',
          )
        }

        /*
         * Busca somente a intenção de pagamento.
         *
         * Nenhuma matrícula ou aluno é criado
         * neste momento.
         */

        const {
          data,
          error: pagamentoError,
        } =
          await supabase
            .from('pagamentos')
            .select(`
              id,
              user_id,
              idioma,
              tipo_plano,
              valor,
              status,
              matricula_id,
              plano_id,
              dados_matricula
            `)
            .eq(
              'id',
              pagamentoId,
            )
            .eq(
              'user_id',
              user.id,
            )
            .single()

        if (
          pagamentoError ||
          !data
        ) {
          console.error(
            'Erro ao carregar pagamento:',
            pagamentoError,
          )

          throw new Error(
            'Não foi possível carregar a intenção de pagamento.',
          )
        }

        /*
         * =====================================================
         * PLANO
         * =====================================================
         */

        let planoNome:
          | string
          | null = null

        if (data.plano_id) {
          const {
            data: plano,
            error: planoError,
          } =
            await supabase
              .from('planos')
              .select(
                'nome',
              )
              .eq(
                'id',
                data.plano_id,
              )
              .single()

          if (
            planoError
          ) {
            console.error(
              'Erro ao carregar plano:',
              planoError,
            )
          } else {
            planoNome =
              plano?.nome ??
              null
          }
        }

        /*
         * Plano personalizado
         */

        if (
          !planoNome &&
          data.tipo_plano ===
            'personalizado'
        ) {
          planoNome =
            'Plano personalizado'
        }

        const dados =
          data.dados_matricula as
            | Record<
                string,
                unknown
              >
            | null

        /*
         * =====================================================
         * PREENCHER TITULAR
         * =====================================================
         */

        setHolder({
          name:
            String(
              dados?.nome_completo ??
                '',
            ),

          email:
            String(
              dados?.email ??
                '',
            ),

          cpf_cnpj:
            String(
              dados?.cpf ??
                '',
            ),

          postal_code:
            '',

          address_number:
            '',

          address_complement:
            '',

          phone:
            String(
              dados?.telefone ??
                '',
            ),

          mobile_phone:
            String(
              dados?.telefone ??
                '',
            ),
        })

        /*
         * =====================================================
         * PAGAMENTO
         * =====================================================
         */

        setPagamento({
          id:
            data.id,

          idioma:
            data.idioma,

          tipo_plano:
            data.tipo_plano,

          valor:
            Number(
              data.valor,
            ),

          status:
            data.status,

          matricula_id:
            data.matricula_id,

          plano_nome:
            planoNome,

          dados_matricula:
            dados,
        })

        /*
         * Se o pagamento já estiver concluído,
         * o monitoramento será iniciado pelo useEffect.
         */

        if (
          data.status ===
            'pago' &&
          data.matricula_id
        ) {
          setPaymentConfirmed(
            true,
          )

          setSuccess(
            'Pagamento confirmado! Sua matrícula foi realizada com sucesso.',
          )

          redirectTimeoutRef.current =
            setTimeout(() => {
              window.location.assign(
                '/aluno',
              )
            }, 1800)
        }
      } catch (err) {
        console.error(
          'Erro ao carregar checkout:',
          err,
        )

        setError(
          err instanceof Error
            ? err.message
            : 'Erro ao carregar o checkout.',
        )
      } finally {
        setLoading(false)
      }
    }

    loadPagamento()
  }, [pagamentoId])

  /*
   * =========================================================
   * CAMPOS DO CARTÃO
   * =========================================================
   */

  function updateCard(
    field: keyof CreditCardData,
    value: string,
  ) {
    const normalizedValue =
      field === 'holder_name'
        ? value.replace(/\s+/g, ' ').slice(0, 80)
        : field === 'number'
          ? digits(value).slice(0, 19)
          : field === 'expiry_month'
            ? digits(value).slice(0, 2)
            : field === 'expiry_year'
              ? digits(value).slice(0, 4)
              : digits(value).slice(0, 4)

    setCard(current => ({
      ...current,
      [field]: normalizedValue,
    }))
  }

  function updateHolder(
    field: keyof CreditCardHolderInfo,
    value: string,
  ) {
    setHolder(
      current => ({
        ...current,
        [field]:
          value,
      }),
    )
  }

  /*
   * =========================================================
   * PAGAMENTO
   * =========================================================
   */

  async function handlePayment() {
    try {
      setError('')
      setSuccess('')
      setPaymentResult(null)
      setPaymentConfirmed(false)
      setProcessing(true)

      /*
       * PIX
       */

      if (
        metodo === 'pix'
      ) {
        const result =
          await createPayment({
            pagamento_id:
              pagamentoId,

            metodo:
              'pix',
          })

        const pixResult =
          result as PaymentResult

        setPaymentResult(
          pixResult,
        )

        setSuccess(
          'PIX gerado. Utilize o QR Code ou o código copia e cola para realizar o pagamento.',
        )

        /*
         * O monitoramento do webhook
         * será iniciado pelo useEffect.
         */

        return
      }

      /*
       * =====================================================
       * VALIDAÇÃO DO CARTÃO
       * =====================================================
       */

      const cardNumber = digits(card.number)
      const cardBrand = getCardBrand(cardNumber)
      const expiryMonth = Number(card.expiry_month)
      const expiryYear = Number(card.expiry_year)
      const currentYear = new Date().getFullYear()

      if (!card.holder_name.trim()) throw new Error('Informe o nome impresso no cartão.')
      if (!cardBrand) throw new Error('Não foi possível identificar a bandeira. Verifique o número do cartão.')

      const cardLengths: Record<string, number[]> = {
        Visa: [13, 16, 19], Mastercard: [16], 'American Express': [15],
        Elo: [16], Hipercard: [14, 16], 'Diners Club': [14], Discover: [16],
      }

      if (!cardLengths[cardBrand].includes(cardNumber.length)) throw new Error('O número informado não é válido para ' + cardBrand + '.')
      if (!luhnValid(cardNumber)) throw new Error('O número do cartão é inválido.')
      if (!/^\d{2}$/.test(card.expiry_month) || expiryMonth < 1 || expiryMonth > 12) throw new Error('Informe um mês de validade entre 01 e 12.')
      if (!/^\d{4}$/.test(card.expiry_year) || expiryYear < currentYear) throw new Error('Informe o ano de validade com 4 dígitos.')
      if (expiryYear === currentYear && expiryMonth < new Date().getMonth() + 1) throw new Error('O cartão está vencido.')

      const expectedCvvLength = cardBrand === 'American Express' ? 4 : 3
      const ccvPattern = new RegExp('^\\d{' + expectedCvvLength + '}$')

      if (
        !holder.name.trim()
      ) {
        throw new Error(
          'Informe o nome do titular do cartão.',
        )
      }

      if (
        !holder.email.trim()
      ) {
        throw new Error(
          'Informe o e-mail do titular.',
        )
      }

      const cpfCnpj = digits(holder.cpf_cnpj)
      const postalCode = digits(holder.postal_code)
      const phone = digits(holder.phone)

      if (!/^(?:\d{11}|\d{14})$/.test(cpfCnpj)) throw new Error('Informe um CPF ou CNPJ válido.')
      if (postalCode.length !== 8) throw new Error('Informe um CEP válido com 8 dígitos.')
      if (!holder.address_number.trim()) throw new Error('Informe o número do endereço.')
      if (phone.length < 10 || phone.length > 11) throw new Error('Informe um telefone válido com DDD.')

      /*
       * =====================================================
       * PAGAMENTO CARTÃO
       * =====================================================
       */

      const result =
        await createPayment({
          pagamento_id:
            pagamentoId,

          metodo:
            'cartao',

          parcelas:
            Number(
              parcelas,
            ),

          credit_card:
            card,

          credit_card_holder_info:
            holder,
        })

      const cardResult =
        result as PaymentResult

      setPaymentResult(
        cardResult,
      )

      if (
        cardResult.status ===
        'pago'
      ) {
        setSuccess(
          'Pagamento aprovado! Aguardando a confirmação da matrícula...',
        )
      } else {
        setSuccess(
          'Pagamento enviado para processamento. Aguarde a confirmação.',
        )
      }
    } catch (err) {
      console.error(
        'Erro ao processar pagamento:',
        err,
      )

      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível processar o pagamento.',
      )
    } finally {
      setProcessing(false)
    }
  }

  /*
   * =========================================================
   * COPIAR PIX
   * =========================================================
   */

  async function copyPix() {
    if (
      !paymentResult?.pix_copia_cola
    ) {
      return
    }

    try {
      await navigator.clipboard.writeText(
        paymentResult.pix_copia_cola,
      )

      setSuccess(
        'Código PIX copiado.',
      )
    } catch {
      setError(
        'Não foi possível copiar o código PIX.',
      )
    }
  }

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (loading) {
    return (
      <main className="checkout-page">
        <div className="checkout-loading">
          Carregando checkout...
        </div>
      </main>
    )
  }

  /*
   * =========================================================
   * PAGAMENTO CONFIRMADO
   * =========================================================
   */

  if (
    paymentConfirmed
  ) {
    return (
      <main className="checkout-page">
        <div className="checkout-container">
          <section className="checkout-card checkout-confirmation">

            <div className="checkout-confirmation-icon">
              <CheckCircle2
                size={64}
              />
            </div>

            <h1>
              {pagamento?.tipo_plano === 'avulso'
                ? 'Aula diagnóstica confirmada!'
                : 'Matrícula confirmada!'}
            </h1>

            <p>
              {pagamento?.tipo_plano === 'avulso'
                ? 'Seu pagamento foi confirmado e sua aula diagnóstica foi agendada com sucesso.'
                : 'Seu pagamento foi confirmado e sua matrícula foi realizada com sucesso.'}
            </p>

            <span>
              Redirecionando para a área do aluno...
            </span>

          </section>
        </div>
      </main>
    )
  }

  /*
   * =========================================================
   * ERRO
   * =========================================================
   */

  if (
    error &&
    !pagamento
  ) {
    return (
      <main className="checkout-page">
        <div className="checkout-error">
          {error}
        </div>
      </main>
    )
  }

  if (!pagamento) {
    return (
      <main className="checkout-page">
        <div className="checkout-error">
          Intenção de pagamento não encontrada.
        </div>
      </main>
    )
  }

  /*
   * =========================================================
   * VALORES
   * =========================================================
   */

  const valor =
    Number(
      pagamento.valor,
    )

  const valorParcela =
    valor /
    Number(
      parcelas || 1,
    )

  /*
   * =========================================================
   * CHECKOUT
   * =========================================================
   */

  return (
    <main className="checkout-page">
      <div className="checkout-container">

        <header className="checkout-header">
          <div>
            <span className="checkout-eyebrow">
              AB Academy
            </span>

            <h1>
              {pagamento?.tipo_plano === 'avulso'
                ? 'Finalize sua aula diagnóstica'
                : 'Finalize sua matrícula'}
            </h1>

            <p>
              Escolha a forma de pagamento
              para concluir sua inscrição.
            </p>
          </div>

          <div className="checkout-security">
            <ShieldCheck
              size={20}
            />

            <span>
              Pagamento seguro
            </span>
          </div>
        </header>

        <div className="checkout-grid">

          <section className="checkout-card checkout-summary">
            <h2>
              Resumo da matrícula
            </h2>

            <div className="checkout-summary-row">
              <span>
                Idioma
              </span>

              <strong>
                {pagamento.idioma ===
                'ingles'
                  ? 'Inglês'
                  : 'Alemão'}
              </strong>
            </div>

            <div className="checkout-summary-row">
              <span>
                Plano
              </span>

              <strong>
                {pagamento.plano_nome ??
                  (pagamento.tipo_plano === 'avulso'
                    ? 'Aula diagnóstica'
                    : 'Plano selecionado')}
              </strong>
            </div>

            <div className="checkout-summary-total">
              <span>
                Total
              </span>

              <strong>
                {valor.toLocaleString(
                  'pt-BR',
                  {
                    style:
                      'currency',
                    currency:
                      'BRL',
                  },
                )}
              </strong>
            </div>
          </section>

          <section className="checkout-card checkout-payment">

            <h2>
              Forma de pagamento
            </h2>

            <div className="checkout-methods">

              <button
                type="button"
                className={
                  metodo ===
                  'pix'
                    ? 'checkout-method active'
                    : 'checkout-method'
                }
                onClick={() =>
                  setMetodo(
                    'pix',
                  )
                }
                disabled={
                  checkingPayment
                }
              >
                <QrCode
                  size={22}
                />

                <div>
                  <strong>
                    PIX
                  </strong>

                  <span>
                    Pagamento instantâneo
                  </span>
                </div>
              </button>

              <button
                type="button"
                className={
                  metodo ===
                  'cartao'
                    ? 'checkout-method active'
                    : 'checkout-method'
                }
                onClick={() =>
                  setMetodo(
                    'cartao',
                  )
                }
                disabled={
                  checkingPayment
                }
              >
                <CreditCard
                  size={22}
                />

                <div>
                  <strong>
                    Cartão de crédito
                  </strong>

                  <span>
                    {pagamento.tipo_plano === 'avulso'
                      ? 'Pagamento único'
                      : pagamento.tipo_plano === 'mensal'
                        ? 'Cobrança mensal recorrente'
                        : 'Parcele sua matrícula'}
                  </span>
                </div>
              </button>

            </div>

            {metodo ===
              'pix' && (
              <div className="checkout-pix-info">

                <div className="checkout-pix-icon">
                  <QrCode
                    size={48}
                  />
                </div>

                <h3>
                  Pagamento via PIX
                </h3>

                <p>
                  Clique no botão abaixo para
                  gerar seu QR Code PIX.
                </p>

              </div>
            )}

            {metodo ===
              'cartao' && (
              <div className="checkout-card-form">

                <div className="checkout-field">
                  <label>
                    Nome no cartão
                  </label>

                  <input
                    value={
                      card.holder_name
                    }
                    onChange={event =>
                      updateCard(
                        'holder_name',
                        event.target.value,
                      )
                    }
                    placeholder="Nome impresso no cartão"
                    autoComplete="cc-name"
                  />
                </div>

                <div className="checkout-field">
                  <label>
                    Número do cartão
                  </label>

                  <input
                    value={formatCardNumber(card.number, getCardBrand(card.number))}
                    onChange={event => updateCard('number', event.target.value)}
                    placeholder="0000 0000 0000 0000"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    maxLength={19}
                  />

                  {getCardBrand(card.number) && (
                    <div className="checkout-card-brand">
                      <span>Bandeira identificada</span>
                      <strong>{getCardBrand(card.number)}</strong>
                    </div>
                  )}
                </div>

                <div className="checkout-fields-row">

                  <div className="checkout-field">
                    <label>
                      Mês
                    </label>

                    <input
                      value={card.expiry_month}
                      onChange={event => updateCard('expiry_month', event.target.value)}
                      onBlur={() => updateCard('expiry_month', card.expiry_month.padStart(2, '0'))}
                      placeholder="MM"
                      maxLength={2}
                      inputMode="numeric"
                      autoComplete="cc-exp-month"
                    />
                  </div>

                  <div className="checkout-field">
                    <label>
                      Ano
                    </label>

                    <input
                      value={
                        card.expiry_year
                      }
                      onChange={event =>
                        updateCard(
                          'expiry_year',
                          event.target.value,
                        )
                      }
                      placeholder="AAAA"
                      maxLength={4}
                      inputMode="numeric"
                      autoComplete="cc-exp-year"
                    />
                  </div>

                  <div className="checkout-field">
                    <label>
                      CVV
                    </label>

                    <input
                      value={card.ccv}
                      onChange={event => updateCard('ccv', event.target.value)}
                      placeholder={getCardBrand(card.number) === 'American Express' ? '1234' : '123'}
                      maxLength={getCardBrand(card.number) === 'American Express' ? 4 : 3}
                      inputMode="numeric"
                      autoComplete="cc-csc"
                    />
                  </div>

                </div>

                {pagamento.tipo_plano !== 'avulso' &&
                  pagamento.tipo_plano !== 'mensal' && (
                  <div className="checkout-field">
                    <label>
                      Número de parcelas
                    </label>

                    <select
                      value={parcelas}
                      onChange={event =>
                        setParcelas(event.target.value)
                      }
                    >
                      {Array.from({
                        length:
                          getCardBrand(card.number) === 'Visa' ||
                          getCardBrand(card.number) === 'Mastercard'
                            ? 21
                            : 12,
                      }, (_, index) => index + 1).map(item => (
                        <option key={item} value={item}>
                          {item}x de{' '}
                          {(valor / item).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="checkout-holder-title">
                  Dados do titular
                </div>

                <div className="checkout-field">
                  <label>
                    Nome completo
                  </label>

                  <input
                    value={
                      holder.name
                    }
                    onChange={event =>
                      updateHolder(
                        'name',
                        event.target.value,
                      )
                    }
                    autoComplete="name"
                  />
                </div>

                <div className="checkout-field">
                  <label>
                    E-mail
                  </label>

                  <input
                    type="email"
                    value={
                      holder.email
                    }
                    onChange={event =>
                      updateHolder(
                        'email',
                        event.target.value,
                      )
                    }
                    autoComplete="email"
                  />
                </div>

                <div className="checkout-fields-row">

                  <div className="checkout-field">
                    <label>
                      CPF/CNPJ
                    </label>

                    <input
                      value={formatCpfCnpj(holder.cpf_cnpj)}
                      onChange={event => updateHolder('cpf_cnpj', event.target.value)}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="CPF ou CNPJ"
                    />
                  </div>

                  <div className="checkout-field">
                    <label>
                      CEP
                    </label>

                    <input
                      value={formatCep(holder.postal_code)}
                      onChange={event => updateHolder('postal_code', event.target.value)}
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={9}
                      placeholder="00000-000"
                    />
                  </div>

                </div>

                <div className="checkout-fields-row">

                  <div className="checkout-field">
                    <label>
                      Número
                    </label>

                    <input
                      value={
                        holder.address_number
                      }
                      onChange={event =>
                        updateHolder(
                          'address_number',
                          event.target.value,
                        )
                      }
                      autoComplete="address-line2"
                    />
                  </div>

                  <div className="checkout-field">
                    <label>
                      Complemento
                    </label>

                    <input
                      value={
                        holder.address_complement ??
                        ''
                      }
                      onChange={event =>
                        updateHolder(
                          'address_complement',
                          event.target.value,
                        )
                      }
                    />
                  </div>

                </div>

                <div className="checkout-field">
                  <label>
                    Telefone
                  </label>

                  <input
                    value={formatPhone(holder.phone)}
                    onChange={event => updateHolder('phone', event.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div className="checkout-installment-preview">

                  <span>
                    Total
                  </span>

                  <strong>
                    {valor.toLocaleString(
                      'pt-BR',
                      {
                        style:
                          'currency',
                        currency:
                          'BRL',
                      },
                    )}
                  </strong>

                  <small>
                    {pagamento.tipo_plano === 'avulso'
                      ? 'Pagamento único'
                      : `${parcelas}x de ${valorParcela.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}`}
                  </small>

                </div>

              </div>
            )}

            {error && (
              <div className="checkout-message error">
                {error}
              </div>
            )}

            {success && (
              <div className="checkout-message success">
                {success}
              </div>
            )}

            {checkingPayment && (
              <div className="checkout-message success">
                Aguardando confirmação do pagamento...
              </div>
            )}

            {!paymentResult &&
              !paymentConfirmed && (
              <button
                type="button"
                className="checkout-submit"
                disabled={
                  processing ||
                  checkingPayment
                }
                onClick={
                  handlePayment
                }
              >
                {processing
                  ? 'Processando...'
                  : metodo ===
                      'pix'
                    ? 'Gerar PIX'
                    : 'Pagar com cartão'}
              </button>
            )}

          </section>
        </div>

        {paymentResult &&
          metodo ===
            'pix' && (
          <section className="checkout-card checkout-pix-result">

            <h2>
              Seu pagamento PIX
            </h2>

            {paymentResult.pix_qr_code && (
              <img
                src={`data:image/png;base64,${paymentResult.pix_qr_code}`}
                alt="QR Code PIX"
                className="checkout-pix-qr"
              />
            )}

            {paymentResult.pix_copia_cola && (
              <div className="checkout-copy-area">

                <label>
                  PIX Copia e Cola
                </label>

                <textarea
                  readOnly
                  value={
                    paymentResult.pix_copia_cola
                  }
                />

                <button
                  type="button"
                  onClick={
                    copyPix
                  }
                  className="checkout-copy-button"
                >
                  Copiar código PIX
                </button>

              </div>
            )}

            {checkingPayment && (
              <div className="checkout-pix-waiting">
                <span>
                  Aguardando confirmação do pagamento...
                </span>

                <small>
                  Assim que o pagamento for confirmado,
                  sua matrícula será liberada automaticamente.
                </small>
              </div>
            )}

          </section>
        )}

      </div>
    </main>
  )
})
      if (!ccvPattern.test(card.ccv)) throw new Error('O código de segurança de ' + cardBrand + ' deve ter ' + expectedCvvLength + ' dígitos.')

      if (
        !holder.name.trim()
      ) {
        throw new Error(
          'Informe o nome do titular do cartão.',
        )
      }

      if (
        !holder.email.trim()
      ) {
        throw new Error(
          'Informe o e-mail do titular.',
        )
      }

      if (
        !holder.cpf_cnpj.trim()
      ) {
        throw new Error(
          'Informe o CPF/CNPJ do titular.',
        )
      }

      if (
        !holder.postal_code.trim()
      ) {
        throw new Error(
          'Informe o CEP do titular.',
        )
      }

      if (
        !holder.address_number.trim()
      ) {
        throw new Error(
          'Informe o número do endereço.',
        )
      }

      /*
       * =====================================================
       * PAGAMENTO CARTÃO
       * =====================================================
       */

      const result =
        await createPayment({
          pagamento_id:
            pagamentoId,

          metodo:
            'cartao',

          parcelas:
            Number(
              parcelas,
            ),

          credit_card:
            card,

          credit_card_holder_info:
            holder,
        })

      const cardResult =
        result as PaymentResult

      setPaymentResult(
        cardResult,
      )

      if (
        cardResult.status ===
        'pago'
      ) {
        setSuccess(
          'Pagamento aprovado! Aguardando a confirmação da matrícula...',
        )
      } else {
        setSuccess(
          'Pagamento enviado para processamento. Aguarde a confirmação.',
        )
      }
    } catch (err) {
      console.error(
        'Erro ao processar pagamento:',
        err,
      )

      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível processar o pagamento.',
      )
    } finally {
      setProcessing(false)
    }
  }

  /*
   * =========================================================
   * COPIAR PIX
   * =========================================================
   */

  async function copyPix() {
    if (
      !paymentResult?.pix_copia_cola
    ) {
      return
    }

    try {
      await navigator.clipboard.writeText(
        paymentResult.pix_copia_cola,
      )

      setSuccess(
        'Código PIX copiado.',
      )
    } catch {
      setError(
        'Não foi possível copiar o código PIX.',
      )
    }
  }

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (loading) {
    return (
      <main className="checkout-page">
        <div className="checkout-loading">
          Carregando checkout...
        </div>
      </main>
    )
  }

  /*
   * =========================================================
   * PAGAMENTO CONFIRMADO
   * =========================================================
   */

  if (
    paymentConfirmed
  ) {
    return (
      <main className="checkout-page">
        <div className="checkout-container">
          <section className="checkout-card checkout-confirmation">

            <div className="checkout-confirmation-icon">
              <CheckCircle2
                size={64}
              />
            </div>

            <h1>
              {pagamento?.tipo_plano === 'avulso'
                ? 'Aula diagnóstica confirmada!'
                : 'Matrícula confirmada!'}
            </h1>

            <p>
              {pagamento?.tipo_plano === 'avulso'
                ? 'Seu pagamento foi confirmado e sua aula diagnóstica foi agendada com sucesso.'
                : 'Seu pagamento foi confirmado e sua matrícula foi realizada com sucesso.'}
            </p>

            <span>
              Redirecionando para a área do aluno...
            </span>

          </section>
        </div>
      </main>
    )
  }

  /*
   * =========================================================
   * ERRO
   * =========================================================
   */

  if (
    error &&
    !pagamento
  ) {
    return (
      <main className="checkout-page">
        <div className="checkout-error">
          {error}
        </div>
      </main>
    )
  }

  if (!pagamento) {
    return (
      <main className="checkout-page">
        <div className="checkout-error">
          Intenção de pagamento não encontrada.
        </div>
      </main>
    )
  }

  /*
   * =========================================================
   * VALORES
   * =========================================================
   */

  const valor =
    Number(
      pagamento.valor,
    )

  const valorParcela =
    valor /
    Number(
      parcelas || 1,
    )

  /*
   * =========================================================
   * CHECKOUT
   * =========================================================
   */

  return (
    <main className="checkout-page">
      <div className="checkout-container">

        <header className="checkout-header">
          <div>
            <span className="checkout-eyebrow">
              AB Academy
            </span>

            <h1>
              {pagamento?.tipo_plano === 'avulso'
                ? 'Finalize sua aula diagnóstica'
                : 'Finalize sua matrícula'}
            </h1>

            <p>
              Escolha a forma de pagamento
              para concluir sua inscrição.
            </p>
          </div>

          <div className="checkout-security">
            <ShieldCheck
              size={20}
            />

            <span>
              Pagamento seguro
            </span>
          </div>
        </header>

        <div className="checkout-grid">

          <section className="checkout-card checkout-summary">
            <h2>
              Resumo da matrícula
            </h2>

            <div className="checkout-summary-row">
              <span>
                Idioma
              </span>

              <strong>
                {pagamento.idioma ===
                'ingles'
                  ? 'Inglês'
                  : 'Alemão'}
              </strong>
            </div>

            <div className="checkout-summary-row">
              <span>
                Plano
              </span>

              <strong>
                {pagamento.plano_nome ??
                  (pagamento.tipo_plano === 'avulso'
                    ? 'Aula diagnóstica'
                    : 'Plano selecionado')}
              </strong>
            </div>

            <div className="checkout-summary-total">
              <span>
                Total
              </span>

              <strong>
                {valor.toLocaleString(
                  'pt-BR',
                  {
                    style:
                      'currency',
                    currency:
                      'BRL',
                  },
                )}
              </strong>
            </div>
          </section>

          <section className="checkout-card checkout-payment">

            <h2>
              Forma de pagamento
            </h2>

            <div className="checkout-methods">

              <button
                type="button"
                className={
                  metodo ===
                  'pix'
                    ? 'checkout-method active'
                    : 'checkout-method'
                }
                onClick={() =>
                  setMetodo(
                    'pix',
                  )
                }
                disabled={
                  checkingPayment
                }
              >
                <QrCode
                  size={22}
                />

                <div>
                  <strong>
                    PIX
                  </strong>

                  <span>
                    Pagamento instantâneo
                  </span>
                </div>
              </button>

              <button
                type="button"
                className={
                  metodo ===
                  'cartao'
                    ? 'checkout-method active'
                    : 'checkout-method'
                }
                onClick={() =>
                  setMetodo(
                    'cartao',
                  )
                }
                disabled={
                  checkingPayment
                }
              >
                <CreditCard
                  size={22}
                />

                <div>
                  <strong>
                    Cartão de crédito
                  </strong>

                  <span>
                    {pagamento.tipo_plano === 'avulso'
                      ? 'Pagamento único'
                      : pagamento.tipo_plano === 'mensal'
                        ? 'Cobrança mensal recorrente'
                        : 'Parcele sua matrícula'}
                  </span>
                </div>
              </button>

            </div>

            {metodo ===
              'pix' && (
              <div className="checkout-pix-info">

                <div className="checkout-pix-icon">
                  <QrCode
                    size={48}
                  />
                </div>

                <h3>
                  Pagamento via PIX
                </h3>

                <p>
                  Clique no botão abaixo para
                  gerar seu QR Code PIX.
                </p>

              </div>
            )}

            {metodo ===
              'cartao' && (
              <div className="checkout-card-form">

                <div className="checkout-field">
                  <label>
                    Nome no cartão
                  </label>

                  <input
                    value={
                      card.holder_name
                    }
                    onChange={event =>
                      updateCard(
                        'holder_name',
                        event.target.value,
                      )
                    }
                    placeholder="Nome impresso no cartão"
                    autoComplete="cc-name"
                  />
                </div>

                <div className="checkout-field">
                  <label>
                    Número do cartão
                  </label>

                  <input
                    value={
                      card.number
                    }
                    onChange={event =>
                      updateCard(
                        'number',
                        event.target.value,
                      )
                    }
                    placeholder="0000 0000 0000 0000"
                    inputMode="numeric"
                    autoComplete="cc-number"
                  />
                </div>

                <div className="checkout-fields-row">

                  <div className="checkout-field">
                    <label>
                      Mês
                    </label>

                    <input
                      value={
                        card.expiry_month
                      }
                      onChange={event =>
                        updateCard(
                          'expiry_month',
                          event.target.value,
                        )
                      }
                      placeholder="MM"
                      maxLength={2}
                      inputMode="numeric"
                      autoComplete="cc-exp-month"
                    />
                  </div>

                  <div className="checkout-field">
                    <label>
                      Ano
                    </label>

                    <input
                      value={
                        card.expiry_year
                      }
                      onChange={event =>
                        updateCard(
                          'expiry_year',
                          event.target.value,
                        )
                      }
                      placeholder="AAAA"
                      maxLength={4}
                      inputMode="numeric"
                      autoComplete="cc-exp-year"
                    />
                  </div>

                  <div className="checkout-field">
                    <label>
                      CVV
                    </label>

                    <input
                      value={
                        card.ccv
                      }
                      onChange={event =>
                        updateCard(
                          'ccv',
                          event.target.value,
                        )
                      }
                      placeholder="123"
                      maxLength={4}
                      inputMode="numeric"
                      autoComplete="cc-csc"
                    />
                  </div>

                </div>

                {pagamento.tipo_plano !== 'avulso' &&
                  pagamento.tipo_plano !== 'mensal' && (
                  <div className="checkout-field">
                    <label>
                      Número de parcelas
                    </label>

                    <select
                      value={parcelas}
                      onChange={event =>
                        setParcelas(event.target.value)
                      }
                    >
                      {Array.from({ length: 12 }, (_, index) => index + 1).map(item => (
                        <option key={item} value={item}>
                          {item}x de{' '}
                          {(valor / item).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="checkout-holder-title">
                  Dados do titular
                </div>

                <div className="checkout-field">
                  <label>
                    Nome completo
                  </label>

                  <input
                    value={
                      holder.name
                    }
                    onChange={event =>
                      updateHolder(
                        'name',
                        event.target.value,
                      )
                    }
                    autoComplete="name"
                  />
                </div>

                <div className="checkout-field">
                  <label>
                    E-mail
                  </label>

                  <input
                    type="email"
                    value={
                      holder.email
                    }
                    onChange={event =>
                      updateHolder(
                        'email',
                        event.target.value,
                      )
                    }
                    autoComplete="email"
                  />
                </div>

                <div className="checkout-fields-row">

                  <div className="checkout-field">
                    <label>
                      CPF/CNPJ
                    </label>

                    <input
                      value={
                        holder.cpf_cnpj
                      }
                      onChange={event =>
                        updateHolder(
                          'cpf_cnpj',
                          event.target.value,
                        )
                      }
                    />
                  </div>

                  <div className="checkout-field">
                    <label>
                      CEP
                    </label>

                    <input
                      value={
                        holder.postal_code
                      }
                      onChange={event =>
                        updateHolder(
                          'postal_code',
                          event.target.value,
                        )
                      }
                      inputMode="numeric"
                      autoComplete="postal-code"
                    />
                  </div>

                </div>

                <div className="checkout-fields-row">

                  <div className="checkout-field">
                    <label>
                      Número
                    </label>

                    <input
                      value={
                        holder.address_number
                      }
                      onChange={event =>
                        updateHolder(
                          'address_number',
                          event.target.value,
                        )
                      }
                      autoComplete="address-line2"
                    />
                  </div>

                  <div className="checkout-field">
                    <label>
                      Complemento
                    </label>

                    <input
                      value={
                        holder.address_complement ??
                        ''
                      }
                      onChange={event =>
                        updateHolder(
                          'address_complement',
                          event.target.value,
                        )
                      }
                    />
                  </div>

                </div>

                <div className="checkout-field">
                  <label>
                    Telefone
                  </label>

                  <input
                    value={
                      holder.phone
                    }
                    onChange={event =>
                      updateHolder(
                        'phone',
                        event.target.value,
                      )
                    }
                    autoComplete="tel"
                  />
                </div>

                <div className="checkout-installment-preview">

                  <span>
                    Total
                  </span>

                  <strong>
                    {valor.toLocaleString(
                      'pt-BR',
                      {
                        style:
                          'currency',
                        currency:
                          'BRL',
                      },
                    )}
                  </strong>

                  <small>
                    {pagamento.tipo_plano === 'avulso'
                      ? 'Pagamento único'
                      : `${parcelas}x de ${valorParcela.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}`}
                  </small>

                </div>

              </div>
            )}

            {error && (
              <div className="checkout-message error">
                {error}
              </div>
            )}

            {success && (
              <div className="checkout-message success">
                {success}
              </div>
            )}

            {checkingPayment && (
              <div className="checkout-message success">
                Aguardando confirmação do pagamento...
              </div>
            )}

            {!paymentResult &&
              !paymentConfirmed && (
              <button
                type="button"
                className="checkout-submit"
                disabled={
                  processing ||
                  checkingPayment
                }
                onClick={
                  handlePayment
                }
              >
                {processing
                  ? 'Processando...'
                  : metodo ===
                      'pix'
                    ? 'Gerar PIX'
                    : 'Pagar com cartão'}
              </button>
            )}

          </section>
        </div>

        {paymentResult &&
          metodo ===
            'pix' && (
          <section className="checkout-card checkout-pix-result">

            <h2>
              Seu pagamento PIX
            </h2>

            {paymentResult.pix_qr_code && (
              <img
                src={`data:image/png;base64,${paymentResult.pix_qr_code}`}
                alt="QR Code PIX"
                className="checkout-pix-qr"
              />
            )}

            {paymentResult.pix_copia_cola && (
              <div className="checkout-copy-area">

                <label>
                  PIX Copia e Cola
                </label>

                <textarea
                  readOnly
                  value={
                    paymentResult.pix_copia_cola
                  }
                />

                <button
                  type="button"
                  onClick={
                    copyPix
                  }
                  className="checkout-copy-button"
                >
                  Copiar código PIX
                </button>

              </div>
            )}

            {checkingPayment && (
              <div className="checkout-pix-waiting">
                <span>
                  Aguardando confirmação do pagamento...
                </span>

                <small>
                  Assim que o pagamento for confirmado,
                  sua matrícula será liberada automaticamente.
                </small>
              </div>
            )}

          </section>
        )}

      </div>
    </main>
  )
}