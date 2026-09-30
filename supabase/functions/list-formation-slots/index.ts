import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

type Modality = 'dupla' | 'grupo'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !key) {
    return new Response(JSON.stringify({ error: 'Configuração indisponível.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(url, key)
  const urlParams = new URL(req.url).searchParams
  const urlRequestedId = urlParams.get('horario_id')
  let bodyRequestedId: string | null = null
  let requestedModality: Modality | null = null

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
    .select('id,idioma,dia_semana,hora_inicio,hora_fim,tipo_horario,disponivel,professor_id,nivel_referencia')
    .eq('disponivel', true)
    .is('aluno_id', null)
    .order('idioma')
    .order('dia_semana')
    .order('hora_inicio')

  if (error) {
    return new Response(JSON.stringify({ error: 'Não foi possível carregar os horários.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const candidates = (slots || []).filter((slot) => {
    if (!['dupla', 'grupo'].includes(slot.tipo_horario)) return false
    return !requestedModality || slot.tipo_horario === requestedModality
  })

  const filtered = requestedId
    ? candidates.filter((slot) => slot.id === requestedId)
    : candidates

  const results: Array<Record<string, unknown>> = []

  for (const slot of filtered) {
    const { data: turma } = await admin
      .from('turmas')
      .select('id,idioma,modalidade,aulas_semana,data_inicio,status,fixa,professor_id,nivel_referencia,quantidade_minima,quantidade_maxima')
      .or(`horario_id.eq.${slot.id},id.in.(select turma_id from turma_horarios where horario_id.eq.${slot.id})`)
      .eq('fixa', true)
      .in('status', ['em_formacao', 'aguardando_confirmacoes'])
      .gte('data_inicio', new Date().toISOString().slice(0, 10))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!turma) continue

    const { count } = await admin
      .from('turma_participantes')
      .select('id', { count: 'exact', head: true })
      .eq('turma_id', turma.id)
      .in('status', ['convidado', 'confirmado'])

    const { count: leadCount } = await admin
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('horario_id', slot.id)
      .in('formacao_turma', ['preciso_formar_turma', 'iniciar_individual'])
      .in('status', ['novo', 'em_contato', 'qualificado'])

    const interessados = Math.max(count ?? 0, 0) + (leadCount ?? 0)
    const quantidadeMaxima = turma.quantidade_maxima ?? (turma.modalidade === 'dupla' ? 2 : 3)

    const { data: encounters, error: encountersError } = await admin
      .from('turma_horarios')
      .select('ordem,horario_id,horario:horarios(id,idioma,dia_semana,hora_inicio,hora_fim,disponivel,professor_id,nivel_referencia)')
      .eq('turma_id', turma.id)
      .order('ordem')

    if (encountersError || !encounters?.length) continue

    const turmaEncounters = encounters
      .map((item) => {
        const horario = item.horario
        if (!horario || typeof horario !== 'object' || Array.isArray(horario)) return null
        return {
          horario_id: String(item.horario_id),
          dia_semana: Number(horario.dia_semana),
          hora_inicio: String(horario.hora_inicio),
          hora_fim: String(horario.hora_fim),
          ordem: Number(item.ordem),
        }
      })
      .filter((item): item is { horario_id: string; dia_semana: number; hora_inicio: string; hora_fim: string; ordem: number } => item !== null)

    if (turmaEncounters.length !== turma.aulas_semana) continue
    if (requestedId && !turmaEncounters.some((item) => item.horario_id === requestedId)) continue

    results.push({
      horario_id: slot.id,
      idioma: turma.idioma,
      dia_semana: slot.dia_semana,
      hora_inicio: slot.hora_inicio,
      hora_fim: slot.hora_fim,
      tipo_horario: turma.modalidade,
      turma_id: turma.id,
      turma_status: turma.status,
      aulas_semana: turma.aulas_semana,
      data_inicio: turma.data_inicio,
      professor_id: turma.professor_id ?? slot.professor_id ?? null,
      nivel_referencia: turma.nivel_referencia ?? slot.nivel_referencia ?? null,
      quantidade_minima: turma.quantidade_minima ?? (turma.modalidade === 'dupla' ? 2 : 3),
      quantidade_maxima: quantidadeMaxima,
      interessados,
      encontros: turmaEncounters,
    })
  }

  return new Response(JSON.stringify({ data: results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
