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
    setCard(
      current => ({
        ...current,
        [field]:
          value,
      }),
    )
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

      if (
        !card.holder_name.trim()
      ) {
        throw new Error(
          'Informe o nome impresso no cartão.',
        )
      }

      if (
        !card.number.trim()
      ) {
        throw new Error(
          'Informe o número do cartão.',
        )
      }

      if (
        !card.expiry_month.trim()
      ) {
        throw new Error(
          'Informe o mês de validade.',
        )
      }

      if (
        !card.expiry_year.trim()
      ) {
        throw new Error(
          'Informe o ano de validade.',
        )
      }

      if (
        !card.ccv.trim()
      ) {
        throw new Error(
          'Informe o código de segurança.',
        )
      }

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
              Matrícula confirmada!
            </h1>

            <p>
              Seu pagamento foi confirmado e
              sua matrícula foi realizada com
              sucesso.
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
              Finalize sua matrícula
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
                  'Plano selecionado'}
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
                    Parcele sua matrícula
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

                <div className="checkout-field">
                  <label>
                    Número de parcelas
                  </label>

                  <select
                    value={
                      parcelas
                    }
                    onChange={event =>
                      setParcelas(
                        event.target.value,
                      )
                    }
                  >
                    {Array.from(
                      {
                        length: 12,
                      },
                      (
                        _,
                        index,
                      ) =>
                        index + 1,
                    ).map(
                      item => (
                        <option
                          key={
                            item
                          }
                          value={
                            item
                          }
                        >
                          {item}x de{' '}
                          {(
                            valor /
                            item
                          ).toLocaleString(
                            'pt-BR',
                            {
                              style:
                                'currency',
                              currency:
                                'BRL',
                            },
                          )}
                        </option>
                      ),
                    )}
                  </select>
                </div>

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
                    {parcelas}x de{' '}
                    {valorParcela.toLocaleString(
                      'pt-BR',
                      {
                        style:
                          'currency',
                        currency:
                          'BRL',
                      },
                    )}
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