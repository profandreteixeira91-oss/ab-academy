import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import webpush from "npm:web-push@3.6.7"
import { createClient } from "npm:@supabase/supabase-js@2"

type NotificationRecord = {
  id: string
  titulo: string
  mensagem: string
  modulo: string
  recipient_id?: string | null
  categoria?: string | null
  prioridade?: string | null
  url?: string | null
}

type WebhookPayload = {
  type?: "INSERT"
  table?: "admin_notificacoes"
  schema?: "public"
  record?: NotificationRecord
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
)

const vapidPublicKey = "BHHIQyYOOzxLTiMitqMuTFAjWt1bRx472WdEyOOFSqoaql77wk3MRRHDnDd1u0XX8IqjxPHKEymJ8Q26PRSCeJI"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function configureVapid() {
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY")
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@abacademyidiomas.com.br"
  if (!privateKey) throw new Error("VAPID_PRIVATE_KEY não configurada.")
  webpush.setVapidDetails(subject, vapidPublicKey, privateKey)
}

async function sendToUser(userId: string, notification: NotificationRecord) {
  const { data: subscriptions, error } = await supabase
    .from("admin_notificacoes_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId)
    .is("revogado_em", null)

  if (error) throw error

  const { data: preference } = await supabase
    .from("notification_preferences")
    .select("push")
    .eq("user_id", userId)
    .eq("categoria", notification.categoria || "sistema")
    .maybeSingle()

  if (preference && preference.push === false) {
    return { sent: 0, removed: 0, skipped: true }
  }

  const payload = JSON.stringify({
    title: notification.titulo,
    body: notification.mensagem,
    icon: "/icons/icon-192.svg",
    badge: "/icons/icon-192.svg",
    tag: `admin-notificacao-${notification.id}`,
    url: notification.url || "/admin",
    prioridade: notification.prioridade || "informativa",
  })

  let sent = 0
  const staleIds: string[] = []

  await Promise.all((subscriptions ?? []).map(async (subscription) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
      )
      sent += 1
      await supabase
        .from("admin_notificacoes_push_subscriptions")
        .update({ ultimo_uso_em: new Date().toISOString() })
        .eq("id", subscription.id)
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) {
        staleIds.push(subscription.id)
      } else {
        console.error("Erro ao enviar Web Push:", error)
      }
    }
  }))

  if (staleIds.length) {
    await supabase
      .from("admin_notificacoes_push_subscriptions")
      .delete()
      .in("id", staleIds)
  }

  return { sent, removed: staleIds.length, skipped: false }
}

async function getAuthenticatedUserId(req: Request) {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) return null
  const token = authHeader.slice("Bearer ".length)

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders })

  try {
    configureVapid()

    const body = await req.json() as WebhookPayload & { action?: string }

    if (body.action === "test") {
      const userId = await getAuthenticatedUserId(req)
      if (!userId) {
        return Response.json({ error: "Sessão administrativa inválida." }, { status: 401, headers: corsHeaders })
      }

      const { data: admin } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", userId)
        .eq("ativo", true)
        .maybeSingle()

      if (!admin) {
        return Response.json({ error: "Usuário não autorizado." }, { status: 403, headers: corsHeaders })
      }

      const result = await sendToUser(userId, {
        id: crypto.randomUUID(),
        titulo: "Notificação de teste",
        mensagem: "As notificações Push do AB Academy estão funcionando corretamente.",
        modulo: "configuracoes",
        recipient_id: userId,
        categoria: "sistema",
        prioridade: "informativa",
        url: "/admin",
      })

      return Response.json(result, { headers: corsHeaders })
    }

    if (body.table !== "admin_notificacoes" || body.type !== "INSERT" || !body.record) {
      return Response.json({ ignored: true }, { headers: corsHeaders })
    }

    const record = body.record
    const recipientIds = record.recipient_id
      ? [record.recipient_id]
      : (await supabase.from("admin_users").select("user_id").eq("ativo", true)).data?.map((item) => item.user_id) ?? []

    const results = await Promise.all(recipientIds.map((userId) => sendToUser(userId, record)))

    return Response.json({
      sent: results.reduce((total, item) => total + item.sent, 0),
      removed: results.reduce((total, item) => total + item.removed, 0),
      skipped: results.filter((item) => item.skipped).length,
    }, { headers: corsHeaders })
  } catch (error) {
    console.error("Erro no envio de Web Push administrativo:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 500, headers: corsHeaders },
    )
  }
})
