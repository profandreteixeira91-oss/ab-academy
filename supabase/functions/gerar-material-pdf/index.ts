import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function sanitizeHtml(source: string) {
  let html = String(source || '')
  html = html.replace(/<[/](script|style|iframe|object|embed|form|textarea|select|button)[^>]*>/gi, '')
  html = html.replace(/<(script|style|iframe|object|embed|form|textarea|select|button|input|link|meta)[^>]*>/gi, '')
  html = html.replace(/[ \t\r\n]+on[a-z-]+[ \t\r\n]*=[ \t\r\n]*"[^"]*"/gi, '')
  html = html.replace(/[ \t\r\n]+on[a-z-]+[ \t\r\n]*=[ \t\r\n]*'[^']*'/gi, '')
  html = html.replace(/(href|src)[ \t\r\n]*=[ \t\r\n]*"[^"]*(javascript:|vbscript:|data:text)[^"]*"/gi, '$1="#"')
  html = html.replace(/(href|src)[ \t\r\n]*=[ \t\r\n]*'[^']*(javascript:|vbscript:|data:text)[^']*'/gi, '$1="#"')
  return html
}
function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

async function resolveMaterialImages(html: string, fallbackPaths: string[], admin: ReturnType<typeof createClient>) {
  const paths = new Set<string>(fallbackPaths.filter(Boolean))
  for (const match of html.matchAll(/{{MATERIAL_IMAGE:([^}]+)}}/g)) {
    const path = match[1]?.trim()
    if (path) paths.add(path)
  }
  const urls = new Map<string, string>()
  for (const path of paths) {
    const { data, error } = await admin.storage.from('materiais').createSignedUrl(path, 600)
    if (error || !data?.signedUrl) throw new Error('Não foi possível resolver a imagem do material: ' + path)
    urls.set(path, data.signedUrl)
  }
  let result = html.replace(/{{MATERIAL_IMAGE:([^}]+)}}/g, (_, rawPath) => urls.get(String(rawPath).trim()) || '')
  return result
}

function buildStyles() {
  return `
    @page { size: A4 portrait; margin: 14mm 15mm 17mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { color:#172033; font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; font-size:11.5pt; line-height:1.72; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .material-document { width:100%; margin:0; background:#fff; }
    .material-document-header { position:relative; display:flex; align-items:center; min-height:190px; padding:20px 42px 20px 28px; margin:0 0 22px; background:radial-gradient(circle at 92% 18%,rgba(255,255,255,.22) 0 2px,transparent 3px),linear-gradient(135deg,#0f3f8f 0%,#1649a0 52%,#2464c4 100%); overflow:hidden; color:#fff; }
    .material-document-header:before { content:""; position:absolute; width:180px; height:180px; right:-55px; top:-75px; border:1px solid rgba(255,255,255,.24); transform:rotate(28deg); }
    .material-document-header:after { content:""; position:absolute; width:230px; height:230px; right:-90px; bottom:-150px; border:1px solid rgba(255,255,255,.15); border-radius:50%; }
    .material-document-brand { position:relative; z-index:1; display:flex; align-items:center; justify-content:center; width:150px; height:150px; flex:0 0 150px; border-radius:28px; background:rgba(255,255,255,.96); box-shadow:0 18px 42px rgba(5,28,71,.25); }
    .material-document-logo { width:132px; height:132px; object-fit:contain; }
    .material-document-cover { position:relative; z-index:1; display:flex; flex-direction:column; gap:4px; margin-left:28px; padding-left:24px; border-left:1px solid rgba(255,255,255,.28); }
    .material-document-cover span { font-size:9pt; font-weight:700; letter-spacing:.18em; opacity:.82; }
    .material-document-cover strong { font-size:25pt; line-height:1.05; letter-spacing:-.02em; }
    .material-document-cover small { margin-top:5px; font-size:10pt; opacity:.78; }
    .material-viewer-content,.professor-material-rich-editor { width:100%; margin:0 auto; color:#172033; font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; font-size:11.5pt; line-height:1.72; }
    .material-viewer-content h1,.professor-material-rich-editor h1 { margin:0 0 18px; font-size:24pt; line-height:1.16; color:#0f2f67; break-after:avoid; }
    .material-viewer-content h2,.professor-material-rich-editor h2 { margin:28px 0 12px; padding-bottom:7px; border-bottom:1px solid #dbe5f3; font-size:18pt; line-height:1.25; color:#164a9f; break-after:avoid; }
    .material-viewer-content h3,.professor-material-rich-editor h3 { margin:22px 0 9px; font-size:14pt; color:#1b3767; break-after:avoid; }
    .material-viewer-content h4,.professor-material-rich-editor h4 { margin:18px 0 7px; font-size:12pt; color:#29446f; break-after:avoid; }
    .material-viewer-content p,.professor-material-rich-editor p { margin:0 0 13px; }
    .material-viewer-content ul,.material-viewer-content ol,.professor-material-rich-editor ul,.professor-material-rich-editor ol { margin:0 0 16px; padding-left:24px; }
    .material-viewer-content li,.professor-material-rich-editor li { margin:4px 0; }
    .material-viewer-content blockquote,.professor-material-rich-editor blockquote { margin:20px 0; padding:13px 18px; border-left:4px solid #2f6fc5; background:#f4f8fd; color:#40516b; break-inside:avoid; }
    .material-viewer-content hr,.professor-material-rich-editor hr { margin:25px 0; border:0; border-top:1px solid #dbe5f3; }
    .material-viewer-content pre,.professor-material-rich-editor pre { margin:18px 0; padding:16px 18px; overflow:hidden; border:1px solid #d9e2ef; border-radius:10px; background:#f6f8fb; font-size:9.5pt; line-height:1.55; white-space:pre-wrap; break-inside:avoid; }
    .material-viewer-content code,.professor-material-rich-editor code { font-family:"SFMono-Regular",Consolas,monospace; font-size:.92em; }
    .material-viewer-content a,.professor-material-rich-editor a { color:#1759ad; text-decoration:underline; }
    .material-viewer-content img,.professor-material-rich-editor img { display:block; max-width:100%; height:auto; margin:20px auto; border:1px solid #dce4ef; border-radius:10px; box-shadow:0 10px 24px rgba(15,47,103,.08); break-inside:avoid; page-break-inside:avoid; }
    .material-viewer-content table,.professor-material-rich-editor table { width:100%; margin:22px 0; border-collapse:separate; border-spacing:0; overflow:hidden; border:1px solid #d8e2ef; border-radius:10px; }
    .material-viewer-content th,.professor-material-rich-editor th { padding:10px 12px; border-bottom:1px solid #cfdbea; background:#eef4fb; color:#173c78; font-weight:700; text-align:left; }
    .material-viewer-content td,.professor-material-rich-editor td { padding:9px 12px; border-bottom:1px solid #e1e8f1; vertical-align:top; }
    .material-viewer-content tr:last-child td,.professor-material-rich-editor tr:last-child td { border-bottom:0; }
    tr { break-inside:avoid; page-break-inside:avoid; } img { max-width:100%; }
  `
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Não autenticado.' }, 401)
    const browserlessToken = Deno.env.get('BROWSERLESS_API_TOKEN')
    if (!browserlessToken) return json({ error:'Renderizador PDF não configurado.', code:'PDF_RENDERER_NOT_CONFIGURED' }, 503)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const { data: { user }, error: userError } = await admin.auth.getUser(token)
    if (userError || !user) return json({ error:'Sessão inválida.' }, 401)
    const body = await req.json()
    const materialId = typeof body?.material_id === 'string' ? body.material_id : ''
    if (!materialId) return json({ error:'material_id é obrigatório.' }, 400)
    const { data: professor, error: professorError } = await admin.from('professores').select('id,ativo').eq('user_id', user.id).maybeSingle()
    if (professorError || !professor?.id || professor.ativo === false) return json({ error:'Acesso restrito ao professor autorizado.' }, 403)
    const { data: material, error: materialError } = await admin.from('materiais').select('id,professor_id,titulo,idioma,conteudo_html,imagens').eq('id', materialId).eq('professor_id', professor.id).maybeSingle()
    if (materialError) return json({ error:materialError.message }, 500)
    if (!material) return json({ error:'Material não encontrado ou sem permissão.' }, 404)
    const rawHtml = sanitizeHtml(material.conteudo_html || '')
    const imagePaths = Array.isArray(material.imagens) ? material.imagens.filter((value): value is string => typeof value === 'string') : []
    const contentHtml = await resolveMaterialImages(rawHtml, imagePaths, admin)
    const language = material.idioma === 'ingles' ? 'Inglês' : material.idioma === 'alemao' ? 'Alemão' : 'Material de apoio'
    const title = String(material.titulo || 'Material de apoio')
    const documentHtml = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>' + escapeHtml(title) + '</title><style>' + buildStyles() + '</style></head><body><article class="material-document"><header class="material-document-header"><div class="material-document-brand"><img class="material-document-logo" src="https://abacademyidiomas.com.br/assets/logo_abacademy.png" alt="AB Academy Idiomas"></div><div class="material-document-cover"><span>AB ACADEMY IDIOMAS</span><strong>' + escapeHtml(language.toUpperCase()) + '</strong><small>Material de apoio</small></div></header><main class="material-viewer-content professor-material-rich-editor">' + contentHtml + '</main></article></body></html>'
    const endpoint = 'https://production-sfo.browserless.io/pdf?token=' + encodeURIComponent(browserlessToken)
    const rendererResponse = await fetch(endpoint, { method:'POST', headers:{'Cache-Control':'no-cache','Content-Type':'application/json','Accept':'application/pdf'}, body:JSON.stringify({ html:documentHtml, options:{format:'A4',printBackground:true,displayHeaderFooter:false,preferCSSPageSize:true,tagged:true,margin:{top:'0mm',right:'0mm',bottom:'0mm',left:'0mm'},waitForFonts:true} }) })
    if (!rendererResponse.ok) return json({ error:'O renderizador PDF recusou a geração.', code:'PDF_RENDERER_ERROR', status:rendererResponse.status, details:(await rendererResponse.text()).slice(0,2000) }, 502)
    const pdf = new Uint8Array(await rendererResponse.arrayBuffer())
    if (pdf.byteLength < 1024) return json({ error:'O renderizador retornou um PDF vazio.', code:'PDF_EMPTY' }, 502)
    const pdfPath = professor.id + '/' + material.id + '/publicado-' + Date.now() + '.pdf'
    const { error: uploadError } = await admin.storage.from('materiais').upload(pdfPath, pdf, {contentType:'application/pdf',cacheControl:'31536000',upsert:false})
    if (uploadError) return json({ error:'Não foi possível armazenar o PDF publicado: ' + uploadError.message }, 500)
    return json({ pdf_path:pdfPath, bytes:pdf.byteLength })
  } catch (error) {
    return json({ error:error instanceof Error ? error.message : 'Erro interno na geração do PDF.' }, 500)
  }
})