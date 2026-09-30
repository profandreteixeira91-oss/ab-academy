import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ASAAS_API_URL = Deno.env.get('ASAAS_API_URL') || 'https://api.asaas.com/v3'
const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function authenticate(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new Error('Usuário não autenticado.')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) throw new Error('Sessão inválida ou expirada.')

  const { data: admin, error: adminError } = await supabaseAdmin
    .from('admin_users')
    .select('id')
    .eq('user_id', user.id)
    .eq('ativo', true)
    .maybeSingle()

  if (adminError || !admin) throw new Error('Acesso administrativo não autorizado.')
  return user
}

async function asaasRequest(path: string, options: RequestInit = {}) {
  if (!ASAAS_API_KEY) throw new Error('ASAAS_API_KEY não configurada.')
  const res = await fetch(`${ASAAS_API_URL}${path}`, {
    ...options,
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      access_token: ASAAS_API_KEY,
      ...(options.headers || {}),
    },
  })
  const text = await res.text()
  let data: unknown = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) {
    console.error('Erro Asaas:', res.status, data)
    throw new Error(`Erro Asaas (${res.status}).`)
  }
  return data
}

function normalizeKey(type: string, value: string) {
  const normalizedType = type.toUpperCase()
  if (!['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'].includes(normalizedType)) {
    throw new Error('Tipo de chave Pix inválido.')
  }
  if (normalizedType === 'EMAIL') return value.trim().toLowerCase()
  if (normalizedType === 'EVP') return value.trim()
  return value.replace(/\D/g, '')
}

function validateKey(type: string, key: string) {
  if (type === 'CPF' && key.length !== 11) throw new Error('CPF da chave Pix inválido.')
  if (type === 'CNPJ' && key.length !== 14) throw new Error('CNPJ da chave Pix inválido.')
  if (type === 'PHONE' && key.length !== 11) throw new Error('Telefone da chave Pix deve conter 11 dígitos.')
  if (type === 'EMAIL' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) throw new Error('E-mail da chave Pix inválido.')
  if (type === 'EVP' && !key) throw new Error('Chave Pix aleatória inválida.')
}

async function getBalance() {
  return await asaasRequest('/finance/balance', { method: 'GET' })
}

async function createTransfer(userId: string, body: {
  value: number
  pix_key: string
  pix_key_type: string
  description?: string
}) {
  const value = Number(body.value)
  if (!Number.isFinite(value) || value <= 0) throw new Error('Informe um valor de transferência válido.')

  const type = body.pix_key_type.toUpperCase()
  const key = normalizeKey(type, body.pix_key)
  validateKey(type, key)

  const balance = await getBalance() as { balance?: number }
  const available = Number(balance?.balance ?? 0)
  if (value > available) throw new Error('O valor informado é superior ao saldo disponível no Asaas.')

  const { data: local, error: insertError } = await supabaseAdmin
    .from('asaas_transferencias')
    .insert({
      valor: value,
      chave_pix: key,
      tipo_chave_pix: type,
      descricao: body.description?.trim() || null,
      status: 'PENDING',
      solicitado_por: userId,
    })
    .select('id, valor, chave_pix, tipo_chave_pix, descricao, status, created_at')
    .single()

  if (insertError || !local) throw new Error('Não foi possível registrar a transferência.')

  try {
    const transfer = await asaasRequest('/transfers', {
      method: 'POST',
      body: JSON.stringify({
        value,
        pixAddressKey: key,
        pixAddressKeyType: type,
        operationType: 'PIX',
        description: body.description?.trim() || undefined,
        externalReference: local.id,
      }),
    }) as { id?: string; status?: string; failReason?: string | null }

    if (!transfer.id) throw new Error('O Asaas não retornou o identificador da transferência.')

    await supabaseAdmin
      .from('asaas_transferencias')
      .update({
        asaas_transfer_id: transfer.id,
        status: transfer.status || 'PENDING',
        updated_at: new Date().toISOString(),
      })
      .eq('id', local.id)

    return { ...local, asaas_transfer_id: transfer.id, status: transfer.status || 'PENDING' }
  } catch (error) {
    await supabaseAdmin
      .from('asaas_transferencias')
      .update({
        status: 'FAILED',
        fail_reason: error instanceof Error ? error.message : 'Falha na transferência.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', local.id)
    throw error
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!['GET', 'POST'].includes(req.method)) return response({ error: 'Método não permitido.' }, 405)

  try {
    const user = await authenticate(req)
    if (!ASAAS_API_KEY) return response({ error: 'ASAAS_API_KEY não configurada.' }, 500)

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const action = url.searchParams.get('action') || 'balance'
      if (action === 'balance') {
        const balance = await getBalance()
        const { data: transfers } = await supabaseAdmin
          .from('asaas_transferencias')
          .select('id, asaas_transfer_id, valor, chave_pix, tipo_chave_pix, descricao, status, fail_reason, created_at, updated_at')
          .order('created_at', { ascending: false })
          .limit(10)
        return response({ balance, transfers: transfers || [] })
      }
      if (action === 'transfers') {
        const { data, error } = await supabaseAdmin
          .from('asaas_transferencias')
          .select('id, asaas_transfer_id, valor, chave_pix, tipo_chave_pix, descricao, status, fail_reason, created_at, updated_at')
          .order('created_at', { ascending: false })
          .limit(50)
        if (error) throw error
        return response({ transfers: data || [] })
      }
      return response({ error: 'Ação inválida.' }, 400)
    }

    const body = await req.json()
    if (body.action !== 'transfer') return response({ error: 'Ação inválida.' }, 400)
    const transfer = await createTransfer(user.id, body)
    return response({ success: true, transfer })
  } catch (error) {
    console.error('Erro em asaas-finance:', error)
    return response({ error: error instanceof Error ? error.message : 'Não foi possível processar a operação.' }, 500)
  }
})
