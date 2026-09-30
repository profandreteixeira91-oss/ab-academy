drop index if exists public.admin_push_endpoint_uidx;

create index if not exists admin_notificacoes_recipient_idx
  on public.admin_notificacoes(recipient_id, created_at desc);

create index if not exists admin_push_subscriptions_user_idx
  on public.admin_notificacoes_push_subscriptions(user_id, revogado_em);

create index if not exists notification_preferences_user_idx
  on public.notification_preferences(user_id, categoria);
