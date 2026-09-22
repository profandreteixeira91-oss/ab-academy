import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" }
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Não autenticado.")
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const { data: { user }, error } = await admin.auth.getUser(authHeader.replace("Bearer ", ""))
    if (error || !user) return new Response(JSON.stringify({ error: "Sessão inválida." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    const { data: student } = await admin.from("alunos").select("id").eq("user_id", user.id).maybeSingle()
    if (!student) return new Response(JSON.stringify({ error: "Acesso restrito a alunos." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    const key = Deno.env.get("GEMINI_API_KEY")
    if (!key) throw new Error("GEMINI_API_KEY não configurada.")
    const body = await req.json()
    const target = body?.target === "en" || body?.target === "de" ? body.target : "pt"
    const idioma = body?.idioma === "alemao" ? "alemão" : "inglês"
    const content = body?.content ?? {}
    const prompt = `Traduza do ${idioma} para ${target === "pt" ? "português do Brasil" : target === "en" ? "inglês" : "alemão"} o JSON abaixo para ajudar um aluno a entender a atividade. Preserve a estrutura, IDs e valores de respostas corretas. Traduza somente textos que o aluno vê. Retorne somente JSON válido.
${JSON.stringify(content)}`
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=" + encodeURIComponent(key), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }) })
    if (!response.ok) throw new Error("Falha na tradução.")
    const data = await response.json()
    const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!translated) throw new Error("Tradução vazia.")
    return new Response(JSON.stringify({ translation: JSON.parse(translated) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: "Não foi possível traduzir agora." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})
