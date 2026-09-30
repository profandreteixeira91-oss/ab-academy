import { supabase } from './supabase'

const PUBLIC_PATHS = new Set([
  '/',
  '/planos',
  '/diagnostica',
  '/quero-aprender',
  '/ingles',
  '/alemao',
  '/enterprise',
  '/trabalhe-conosco',
  '/matricula',
  '/horarios',
  '/aulas',
  '/aulas/individuais',
  '/aulas/duplas',
  '/aulas/grupos',
  '/politica-privacidade',
  '/termos-de-servico',
])

export function getAnalyticsSessionId() {
  try {
    const key = 'abacademy_analytics_session'
    const existing = sessionStorage.getItem(key)
    if (existing) return existing

    const generated =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`

    sessionStorage.setItem(key, generated)
    return generated
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

function getReferrerDomain() {
  const referrer = document.referrer
  if (!referrer) return null

  try {
    const hostname = new URL(referrer).hostname.toLowerCase()
    if (!hostname || hostname === window.location.hostname) return null
    return hostname
  } catch {
    return null
  }
}

function getDeviceType() {
  const width = window.innerWidth
  if (width <= 767) return 'mobile'
  if (width <= 1024) return 'tablet'
  return 'desktop'
}

function getBrowser() {
  const ua = navigator.userAgent
  if (/Edg\//i.test(ua)) return 'Edge'
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Chrome'
  if (/Firefox\//i.test(ua)) return 'Firefox'
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari'
  if (/OPR\//i.test(ua)) return 'Opera'
  return 'Outro'
}

function getOs() {
  const ua = navigator.userAgent
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Android/i.test(ua)) return 'Android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Mac OS/i.test(ua)) return 'macOS'
  if (/Linux/i.test(ua)) return 'Linux'
  return 'Outro'
}

export function trackPublicPageView(path: string, pageTitle: string) {
  if (!PUBLIC_PATHS.has(path)) return

  const params = new URLSearchParams(window.location.search)
  const stored = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('abacademy_attribution') || '{}') as Record<string, string>
    } catch {
      return {}
    }
  })()
  const referrer = document.referrer || null

  const payload = {
    session_id: getAnalyticsSessionId(),
    event_type: 'page_view',
    path,
    page_title: pageTitle,
    referrer,
    referrer_domain: getReferrerDomain(),
    utm_source: params.get('utm_source') || stored.source || null,
    utm_medium: params.get('utm_medium') || stored.medium || null,
    utm_campaign: params.get('utm_campaign') || stored.campaign || null,
    utm_term: params.get('utm_term') || stored.term || null,
    utm_content: params.get('utm_content') || stored.content || null,
    device_type: getDeviceType(),
    browser: getBrowser(),
    os: getOs(),
    language: navigator.language || null,
    screen_width: window.innerWidth,
  }

  void supabase.from('site_analytics_events').insert(payload).then(({ error }) => {
    if (error) console.warn('[AB Academy Analytics] Falha ao registrar page_view:', error.message)
  })
}

export type ActiveVisitor = {
  session_id: string
  path: string
  page_title: string | null
  referrer_domain: string | null
  device_type: string | null
  browser: string | null
  os: string | null
  language: string | null
  screen_width: number | null
  first_seen_at: string
  last_seen_at: string
}

export function trackActiveVisitor(path: string, pageTitle: string) {
  if (!PUBLIC_PATHS.has(path)) return

  const sessionId = getAnalyticsSessionId()
  const payload = {
    session_id: sessionId,
    path,
    page_title: pageTitle,
    referrer_domain: getReferrerDomain(),
    device_type: getDeviceType(),
    browser: getBrowser(),
    os: getOs(),
    language: navigator.language || null,
    screen_width: window.innerWidth,
    last_seen_at: new Date().toISOString(),
  }

  void supabase
    .from('site_active_visitors')
    .insert(payload)
    .then(async ({ error }) => {
      if (!error) return

      // A visitor already registered cannot use upsert reliably with the
      // public RLS policy because PostgREST may require SELECT on conflict.
      if (error.code === '23505') {
        const { error: updateError } = await supabase
          .from('site_active_visitors')
          .update(payload)
          .eq('session_id', sessionId)

        if (updateError) {
          console.warn('[AB Academy Analytics] Falha ao atualizar visitante ativo:', updateError.message)
        }
        return
      }

      console.warn('[AB Academy Analytics] Falha ao registrar visitante ativo:', error.message)
    })

  return sessionId
}

export async function removeActiveVisitor(sessionId: string) {
  await supabase.from('site_active_visitors').delete().eq('session_id', sessionId)
}
