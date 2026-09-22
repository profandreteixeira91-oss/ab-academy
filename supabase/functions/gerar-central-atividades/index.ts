import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const levels: Record<string,string> = {
  iniciante: 'iniciante',
  basico: 'basico',
  intermediario: 'intermediario',
  avancado: 'avancado',
  fluente: 'fluente',
}

const categories = ['vocabulario','gramatica','leitura','compreensao','escrita','cotidiano','revisao']
const types = ['multipla_escolha','multipla_resposta','verdadeiro_falso','dissertativa','resposta_curta','lacunas','ordenar','associar']

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Não autenticado.' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const geminiKey = Deno.env.get('GEMINI_API_KEY')

    if (!geminiKey) return json({ error: 'GEMINI_API_KEY não configurada no Supabase.' }, 500)

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const { data: { user }, error: userError } = await admin.auth.getUser(token)

    if (userError || !user) return json({ error: 'Sessão inválida.' }, 401)

    const { data: adminUser, error: adminError } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (adminError || !adminUser) return json({ error: 'Acesso restrito ao administrador.' }, 403)

    const body = await req.json()
    const idioma = body.idioma === 'alemao' ? 'alemao' : body.idioma === 'ingles' ? 'ingles' : null
    const nivel = levels[body.nivel]
    const categoria = categories.includes(body.categoria) ? body.categoria : null
    const tipo = types.includes(body.tipo_exercicio) ? body.tipo_exercicio : null
    const quantidade = Math.max(1, Math.min(20, Number(body.quantidade) || 5))

    if (!idioma || !nivel || !categoria || !tipo) {
      return json({ error: 'Parâmetros de geração inválidos.' }, 400)
    }

    const languageName = idioma === 'ingles' ? 'inglês' : 'alemão'
    const prompt = `
Você é um especialista em criação de material didático para uma escola de idiomas chamada AB Academy.

Gere exatamente ${quantidade} atividades INDEPENDENTES para estudantes de ${languageName}, nível ${nivel}, categoria ${categoria}, tipo de exercício ${tipo}.

REGRAS:
- O conteúdo deve ser pedagogicamente adequado ao nível.
- Não repita perguntas, palavras, frases ou contextos entre as atividades.
- Use linguagem natural e correta.
- Para alemão, respeite ortografia, capitalização e acentuação alemãs.
- Para inglês, use inglês natural e apropriado ao nível.
- Cada atividade deve ter uma única resposta correta quando o tipo permitir correção objetiva.
- Não inclua conteúdo ofensivo, político, médico ou inadequado para estudantes.
- O campo conteudo deve ser compatível com o motor da Central de Atividades.
- Retorne SOMENTE JSON válido, sem markdown e sem texto antes ou depois.

FORMATO OBRIGATÓRIO:
{
  "atividades": [
    {
      "titulo": "string",
      "descricao": "string",
      "instrucoes": "string",
      "conteudo": {},
      "explicacao": "string",
      "dificuldade": 1,
      "tempo_estimado": 5
    }
  ]
}

ESTRUTURA DE conteudo:
- multipla_escolha: {"question":"...","options":[{"id":"a","text":"..."},{"id":"b","text":"..."},{"id":"c","text":"..."},{"id":"d","text":"..."}],"correctAnswer":"a"}
- multipla_resposta: {"question":"...","options":[{"id":"a","text":"..."},{"id":"b","text":"..."},{"id":"c","text":"..."},{"id":"d","text":"..."}],"correctAnswers":["a","c"]}
- verdadeiro_falso: {"question":"...","options":[{"id":"true","text":"Verdadeiro"},{"id":"false","text":"Falso"}],"correctAnswer":"true"}
- resposta_curta: {"question":"...","correctAnswer":"...","acceptableAnswers":["..."]}
- lacunas: {"text":"...","blanks":[{"id":"1","answer":"...","acceptableAnswers":["..."]}]}
- ordenar: {"sentences":["...","...","..."],"correctOrder":["...","...","..."]}
- associar: {"pairs":[{"id":"a","left":"...","right":"..."}]}
- dissertativa: {"question":"...","criteria":["..."]}

As respostas corretas devem ficar dentro de conteudo para permitir correção automática quando aplicável.
`

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=' + encodeURIComponent(geminiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.75,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return json({ error: 'A API Gemini recusou a geração.', details: errorText.slice(0, 1000) }, 502)
    }

    const result = await response.json()
    const raw = result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('') || ''
    let parsed: { atividades?: unknown[] }

    try {
      parsed = JSON.parse(raw)
    } catch {
      return json({ error: 'A IA retornou um JSON inválido.', raw: raw.slice(0, 2000) }, 502)
    }

    if (!Array.isArray(parsed.atividades) || parsed.atividades.length === 0) {
      return json({ error: 'A IA não retornou atividades válidas.' }, 502)
    }

    const rows = parsed.atividades.slice(0, quantidade).map((item: any) => ({
      idioma,
      nivel,
      categoria,
      tipo_exercicio: tipo,
      titulo: String(item?.titulo || '').trim(),
      descricao: item?.descricao ? String(item.descricao) : null,
      instrucoes: item?.instrucoes ? String(item.instrucoes) : null,
      conteudo: item?.conteudo && typeof item.conteudo === 'object' ? item.conteudo : {},
      explicacao: item?.explicacao ? String(item.explicacao) : null,
      dificuldade: Math.max(1, Math.min(5, Number(item?.dificuldade) || 1)),
      tempo_estimado: Math.max(1, Number(item?.tempo_estimado) || 5),
      status: 'rascunho',
      origem: 'ia',
      mes_referencia: new Date().toISOString().slice(0, 10),
      versao: 1,
    })).filter((item: any) => item.titulo)

    if (!rows.length) return json({ error: 'Nenhuma atividade utilizável foi gerada.' }, 502)

    const { data: inserted, error: insertError } = await admin
      .from('central_atividades')
      .insert(rows)
      .select('id,titulo,idioma,nivel,categoria,status,origem')

    if (insertError) return json({ error: 'A IA gerou conteúdo, mas não foi possível salvar.', details: insertError.message }, 500)

    return json({ generated: inserted?.length || 0, activities: inserted || [] })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erro interno.' }, 500)
  }
})
