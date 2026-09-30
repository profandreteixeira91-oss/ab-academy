import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ASAAS_API_URL = Deno.env.get('ASAAS_API_URL') || 'https://api.asaas.com/v3'
const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  const suppliedToken = req.headers.get('x-cron-token') || ''
  const { data: config, error: configError } = await supabase
    .from('asaas_cron_config')
    .select('cron_token')
    .eq('id', true)
    .maybeSingle()
  if (configError || !config?.cron_token || suppliedToken !== config.cron_token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }
  if (!ASAAS_API_KEY) return new Response(JSON.stringify({ error: 'ASAAS_API_KEY não configurada.' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  try {
    const res = await fetch(`${ASAAS_API_URL}/finance/balance`, {
      headers: { accept: 'application/json', access_token: ASAAS_API_KEY },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Asaas HTTP ${res.status}`)
    const saldo = Number(data?.balance ?? 0)
    if (!Number.isFinite(saldo)) throw new Error('Saldo inválido retornado pelo Asaas.')
    const now = new Date().toISOString()
    const { error } = await supabase.from('asaas_saldo_cache').upsert({ id: true, saldo, consultado_em: now, atualizado_em: now })
    if (error) throw error
    return new Response(JSON.stringify({ success: true, saldo, consultado_em: now }), { headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('Erro ao atualizar saldo Asaas:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Falha ao consultar saldo.' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})