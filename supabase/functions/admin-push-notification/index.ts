import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import webpush from "npm:web-push@3.6.7"
import { createClient } from "npm:@supabase/supabase-js@2"

type NotificationRecord = { id: string; titulo: string; mensagem: string }
type WebhookPayload = { type: "INSERT"; table: "admin_notificacoes"; schema: "public"; record: NotificationRecord }

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
const vapidPublicKey = "BHHIQyYOOzxLTiMitqMuTFAjWt1bRx472WdEyOOFSqoaql77wk3MRRHDnDd1u0XX8IqjxPHKEymJ8Q26PRSCeJI"

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 })
  const payload = await req.json() as WebhookPayload
  if (payload.table !== "admin_notificacoes" || payload.type !== "INSERT") return Response.json({ ignored: true })

  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY")
  if (!privateKey) return Response.json({ error: "VAPID_PRIVATE_KEY não configurada." }, { status: 500 })

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") || "mailto:admin@abacademyidiomas.com.br",
    vapidPublicKey,
    privateKey,
  )

  const { data: subscriptions, error } = await supabase
    .from("admin_notificacoes_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const body = JSON.stringify({
    title: payload.record.titulo,
    body: payload.record.mensagem,
    icon: "/icons/icon-192.svg",
    badge: "/icons/icon-192.svg",
    tag: `admin-notificacao-${payload.record.id}`,
    url: "/admin",
  })

  const staleIds: string[] = []
  await Promise.all((subscriptions ?? []).map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, body)
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) staleIds.push(subscription.id)
      else console.error("Erro ao enviar Web Push:", error)
    }
  }))

  if (staleIds.length) {
    await supabase.from("admin_notificacoes_push_subscriptions").delete().in("id", staleIds)
  }

  return Response.json({ sent: (subscriptions ?? []).length - staleIds.length, removed: staleIds.length })
})
