import { Bell, BriefcaseBusiness, CheckCheck, ClipboardList, MessageSquare, UserPlus, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Notification = {
  id: string
  tipo: string
  titulo: string
  mensagem: string
  modulo: string
  referencia_id: string | null
  lida: boolean
  created_at: string
}

type Props = {
  onNavigate: (module: string) => void
}

const icons = {
  lead: UserPlus,
  enterprise: BriefcaseBusiness,
  candidatura: ClipboardList,
  solicitacao: MessageSquare,
} as const

function formatRelativeDate(value: string) {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return 'Agora'
  if (minutes < 60) return `Há ${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Há ${hours} h`

  const days = Math.floor(hours / 24)
  if (days < 7) return `Há ${days} d`

  return date.toLocaleDateString('pt-BR')
}

export default function AdminNotifications({ onNavigate }: Props) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('admin_notificacoes')
      .select('id, tipo, titulo, mensagem, modulo, referencia_id, lida, created_at')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Erro ao carregar notificações administrativas:', error)
    } else {
      setItems((data ?? []) as Notification[])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    void load()

    const interval = window.setInterval(() => void load(), 15000)

    return () => window.clearInterval(interval)
  }, [load])

  const unreadCount = useMemo(
    () => items.filter((item) => !item.lida).length,
    [items],
  )

  async function markAsRead(item: Notification) {
    if (item.lida || savingId) return

    setSavingId(item.id)

    const { error } = await supabase
      .from('admin_notificacoes')
      .update({ lida: true })
      .eq('id', item.id)

    if (!error) {
      setItems((current) =>
        current.map((notification) =>
          notification.id === item.id
            ? { ...notification, lida: true }
            : notification,
        ),
      )
    }

    setSavingId(null)
  }

  async function markAllAsRead() {
    if (!unreadCount || savingId) return

    setSavingId('all')

    const { error } = await supabase
      .from('admin_notificacoes')
      .update({ lida: true })
      .eq('lida', false)

    if (!error) {
      setItems((current) =>
        current.map((item) => ({ ...item, lida: true })),
      )
    }

    setSavingId(null)
  }

  function openNotification(item: Notification) {
    void markAsRead(item)
    setOpen(false)
    onNavigate(item.modulo)
  }

  return (
    <div className="admin-notifications">
      <button
        type="button"
        className="admin-header-action admin-notifications-trigger"
        aria-label={unreadCount ? `${unreadCount} notificações não lidas` : 'Notificações'}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell size={19} strokeWidth={1.9} />
        {unreadCount > 0 && (
          <span className="admin-notifications-count">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="admin-notifications-backdrop"
            aria-label="Fechar notificações"
            onClick={() => setOpen(false)}
          />

          <section className="admin-notifications-panel" aria-label="Central de notificações">
            <header className="admin-notifications-panel-header">
              <div>
                <span className="admin-notifications-eyebrow">CENTRAL</span>
                <h2>Notificações</h2>
                <p>
                  {unreadCount
                    ? `${unreadCount} não lida${unreadCount === 1 ? '' : 's'}`
                    : 'Tudo em dia'}
                </p>
              </div>

              <div className="admin-notifications-header-actions">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="admin-notifications-mark-all"
                    onClick={() => void markAllAsRead()}
                    disabled={savingId === 'all'}
                  >
                    <CheckCheck size={15} />
                    Marcar todas como lidas
                  </button>
                )}

                <button
                  type="button"
                  className="admin-notifications-close"
                  aria-label="Fechar central de notificações"
                  onClick={() => setOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            <div className="admin-notifications-list">
              {loading && !items.length ? (
                <div className="admin-notifications-empty">
                  Carregando notificações...
                </div>
              ) : !items.length ? (
                <div className="admin-notifications-empty">
                  <Bell size={25} />
                  <strong>Nenhuma notificação</strong>
                  <span>Novos eventos administrativos aparecerão aqui.</span>
                </div>
              ) : (
                items.map((item) => {
                  const Icon = icons[item.tipo as keyof typeof icons] ?? Bell

                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`admin-notification-item ${item.lida ? 'read' : 'unread'}`}
                      onClick={() => openNotification(item)}
                      disabled={savingId === item.id}
                    >
                      <span className={`admin-notification-icon admin-notification-icon-${item.tipo}`}>
                        <Icon size={17} strokeWidth={1.9} />
                      </span>

                      <span className="admin-notification-copy">
                        <span className="admin-notification-title-row">
                          <strong>{item.titulo}</strong>
                          {!item.lida && <i aria-label="Não lida" />}
                        </span>
                        <span className="admin-notification-message">{item.mensagem}</span>
                        <span className="admin-notification-time">{formatRelativeDate(item.created_at)}</span>
                      </span>
                    </button>
                  )
                })
              )}
            </div>

            <footer className="admin-notifications-panel-footer">
              <span>As notificações são atualizadas automaticamente.</span>
            </footer>
          </section>
        </>
      )}
    </div>
  )
}
