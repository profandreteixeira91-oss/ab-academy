import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !key) return new Response(JSON.stringify({ error: 'Configuração indisponível.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const admin = createClient(url, key)
  const urlParams = new URL(req.url).searchParams
  const urlRequestedId = urlParams.get('horario_id')
  let bodyRequestedId: string | null = null
  let requestedModality: 'dupla' | 'grupo' | null = null
  const queryModality = urlParams.get('modalidade')
  if (queryModality === 'dupla' || queryModality === 'grupo') requestedModality = queryModality

  if (req.method === 'POST') {
    try {
      const body = await req.json()
      bodyRequestedId = typeof body?.horario_id === 'string' ? body.horario_id : null
      if (body?.modalidade === 'dupla' || body?.modalidade === 'grupo') requestedModality = body.modalidade
    } catch {
      // Corpo opcional.
    }
  }

  const requestedId = urlRequestedId || bodyRequestedId

  const { data: slots, error } = await admin
    .from('horarios')
    .select('id,idioma,dia_semana,hora_inicio,hora_fim,tipo_horario,disponivel')
    .eq('disponivel', true)
    .is('aluno_id', null)
    .order('idioma')
    .order('dia_semana')
    .order('hora_inicio')

  if (error) return new Response(JSON.stringify({ error: 'Não foi possível carregar os horários.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const candidates = (slots || []).filter((slot) => {
    if (!requestedModality) return ['dupla', 'grupo'].includes(slot.tipo_horario)
    if (slot.tipo_horario === requestedModality) return true
    if (slot.tipo_horario !== 'individual') return false
    return true
  })
  const filtered = requestedId ? candidates.filter((slot) => slot.id === requestedId) : candidates
  const results = []

  for (const slot of filtered) {
    const { data: turma } = await admin
      .from('turmas')
      .select('id,status,quantidade_minima,quantidade_maxima')
      .eq('horario_id', slot.id)
      .in('status', ['em_formacao', 'aguardando_confirmacoes'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let interessados = 0
    if (turma) {
      const { count } = await admin
        .from('turma_participantes')
        .select('id', { count: 'exact', head: true })
        .eq('turma_id', turma.id)
        .in('status', ['convidado', 'confirmado'])
      interessados = count ?? 0
    }

    const { count: leadCount } = await admin
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('horario_id', slot.id)
      .in('formacao_turma', ['preciso_formar_turma', 'iniciar_individual'])
      .in('status', ['novo', 'em_contato', 'qualificado'])

    const total = Math.max(interessados, 0) + (leadCount ?? 0)
    const effectiveModality = requestedModality ?? (slot.tipo_horario === 'dupla' || slot.tipo_horario === 'grupo' ? slot.tipo_horario : 'dupla')
    const quantidadeMaxima = turma?.quantidade_maxima ?? (effectiveModality === 'dupla' ? 2 : 6)
    const quantidadeMinima = turma?.quantidade_minima ?? (effectiveModality === 'dupla' ? 2 : 3)

    results.push({
      horario_id: slot.id,
      idioma: slot.idioma,
      dia_semana: slot.dia_semana,
      hora_inicio: slot.hora_inicio,
      hora_fim: slot.hora_fim,
      tipo_horario: effectiveModality,
      turma_status: turma?.status ?? 'em_formacao',
      quantidade_minima: quantidadeMinima,
      quantidade_maxima: quantidadeMaxima,
      interessados: total,
    })
  }

  return new Response(JSON.stringify({ data: results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
