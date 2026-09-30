import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const allowedMime = new Set(['application/pdf'])
const allowedLevels = new Set(['iniciante','basico','intermediario','avancado'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  let rowId: string | null = null
  let admin: ReturnType<typeof createClient> | null = null

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const geminiKey = Deno.env.get('GEMINI_API_KEY')

    if (!geminiKey) return json({ error: 'GEMINI_API_KEY não configurada no Supabase.' }, 500)

    const form = await req.formData()
    const reservaToken = String(form.get('reserva_token') || '').trim()
    const idioma = String(form.get('idioma') || '').trim()
    const file = form.get('arquivo')

    if (!reservaToken || !/^[0-9a-f-]{36}$/i.test(reservaToken)) return json({ error: 'Token de matrícula inválido.' }, 400)
    if (!['ingles','alemao'].includes(idioma)) return json({ error: 'Idioma inválido.' }, 400)
    if (!(file instanceof File)) return json({ error: 'Envie o documento do teste de proficiência.' }, 400)
    if (!allowedMime.has(file.type)) return json({ error: 'O documento deve ser um PDF.' }, 400)
    if (file.size > 10 * 1024 * 1024) return json({ error: 'O PDF deve ter no máximo 10 MB.' }, 400)

    admin = createClient(supabaseUrl, serviceRoleKey)
    const { data: existing } = await admin
      .from('matricula_proficiencia')
      .select('id')
      .eq('reserva_token', reservaToken)
      .maybeSingle()

    rowId = existing?.id || crypto.randomUUID()
    const path = reservaToken + '/' + rowId + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_')

    const { error: uploadError } = await admin.storage
      .from('matricula-proficiencia')
      .upload(path, file, { contentType: file.type, upsert: true })

    if (uploadError) throw uploadError

    await admin.from('matricula_proficiencia').upsert({
      id: rowId,
      reserva_token: reservaToken,
      arquivo_path: path,
      arquivo_nome: file.name,
      mime_type: file.type,
      tamanho_bytes: file.size,
      status: 'processando',
      erro: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'reserva_token' })

    const bytes = new Uint8Array(await file.arrayBuffer())
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)))
    }
    const base64 = btoa(binary)

    const languageName = idioma === 'ingles' ? 'inglês' : 'alemão'
    const prompt = `Analise o documento anexado. Ele é o resultado de um teste de proficiência de ${languageName} para matrícula em uma escola de idiomas.

Extraia somente os resultados que estiverem efetivamente presentes no documento. Não invente pontuações.

Classifique em uma das quatro categorias do sistema: iniciante, basico, intermediario ou avancado. Quando houver resultados separados para conversação, escrita e compreensão, classifique cada dimensão separadamente. Quando o documento apresentar apenas um nível geral, use esse mesmo nível nas três dimensões.

Retorne SOMENTE JSON válido neste formato:
{
  "nivel_geral": "iniciante|basico|intermediario|avancado",
  "nivel_conversacao": "iniciante|basico|intermediario|avancado",
  "nivel_escrita": "iniciante|basico|intermediario|avancado",
  "nivel_compreensao": "iniciante|basico|intermediario|avancado",
  "pontuacoes": [],
  "observacoes": "string"
}

Se não houver dados suficientes para classificar com segurança, retorne os níveis como null e explique o motivo em observacoes.`

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=' + encodeURIComponent(geminiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { inline_data: { mime_type: file.type, data: base64 } },
              { text: prompt },
            ],
          }],
          generationConfig: { response_mime_type: 'application/json' },
        }),
      },
    )

    if (!response.ok) {
      const details = await response.text()
      throw new Error('A análise do documento foi recusada pela IA: ' + details.slice(0, 500))
    }

    const result = await response.json()
    const raw = result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('') || ''
    const parsed = JSON.parse(raw)

    const normalize = (value: unknown) => {
      const level = String(value || '').trim().toUpperCase()
      return allowedLevels.has(level) ? level : null
    }

    const nivelGeral = normalize(parsed.nivel_geral)
    const nivelConversacao = normalize(parsed.nivel_conversacao) || nivelGeral
    const nivelEscrita = normalize(parsed.nivel_escrita) || nivelGeral
    const nivelCompreensao = normalize(parsed.nivel_compreensao) || nivelGeral

    if (!nivelConversacao && !nivelEscrita && !nivelCompreensao) {
      throw new Error(String(parsed.observacoes || 'Não foi possível identificar um nível de proficiência no documento.'))
    }

    const finalResult = {
      ...parsed,
      nivel_geral: nivelGeral,
      nivel_conversacao: nivelConversacao,
      nivel_escrita: nivelEscrita,
      nivel_compreensao: nivelCompreensao,
    }

    await admin.from('matricula_proficiencia').update({
      status: 'concluido',
      resultado: finalResult,
      nivel_conversacao: nivelConversacao,
      nivel_escrita: nivelEscrita,
      nivel_compreensao: nivelCompreensao,
      processado_em: new Date().toISOString(),
      erro: null,
      updated_at: new Date().toISOString(),
    }).eq('id', rowId)

    return json({
      success: true,
      resultado: finalResult,
      arquivo_nome: file.name,
    })
  } catch (error) {
    console.error('Erro ao processar teste de proficiência:', error)
    if (admin && rowId) {
      await admin.from('matricula_proficiencia').update({
        status: 'erro',
        erro: error instanceof Error ? error.message : 'Erro desconhecido.',
        updated_at: new Date().toISOString(),
      }).eq('id', rowId)
    }
    return json({
      error: error instanceof Error ? error.message : 'Não foi possível processar o teste de proficiência.',
    }, 500)
  }
})
