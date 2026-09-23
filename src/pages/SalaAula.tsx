import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import {
  ArrowLeft,
  Loader2,
  Image,
  Sparkles,
} from 'lucide-react'

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useChat,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
  VideoTrack,
} from '@livekit/components-react'

import {
  LocalVideoTrack,
  Track,
} from 'livekit-client'

import { BackgroundProcessor } from '@livekit/track-processors'

import logo from '../assets/logo_abacademy.png'
import { supabase } from '../lib/supabase'
import '../styles/sala-aula.css'

type Lesson = {
  id: string
  idioma: 'ingles' | 'alemao'
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  disponivel: boolean
  aluno_id: string
}

type Student = {
  id: string
  user_id: string
  nome_completo: string | null
  email: string | null
}

type LessonData = {
  lesson: Lesson
  student: Student
}

type LiveKitData = {
  token: string
  url: string
  roomName: string
  identity: string
  name: string
}

function getLanguageName(language: string) {
  return language === 'ingles'
    ? 'Inglês'
    : 'Alemão'
}

function getNextLessonOccurrence(
  dayOfWeek: number,
  startTime: string,
  endTime: string,
) {
  const now = new Date()

  const jsDay = now.getDay()

  const targetDay =
    dayOfWeek === 7
      ? 0
      : dayOfWeek

  let daysUntil =
    targetDay - jsDay

  if (daysUntil < 0) {
    daysUntil += 7
  }

  const startAt = new Date(now)

  startAt.setDate(
    now.getDate() + daysUntil,
  )

  const [
    startHour,
    startMinute,
  ] = startTime
    .split(':')
    .map(Number)

  startAt.setHours(
    startHour,
    startMinute,
    0,
    0,
  )

  const endAt = new Date(startAt)

  const [
    endHour,
    endMinute,
  ] = endTime
    .split(':')
    .map(Number)

  endAt.setHours(
    endHour,
    endMinute,
    0,
    0,
  )

  if (
    daysUntil === 0 &&
    endAt.getTime() <
      now.getTime()
  ) {
    startAt.setDate(
      startAt.getDate() + 7,
    )

    endAt.setDate(
      endAt.getDate() + 7,
    )
  }

  return {
    startAt,
    endAt,
  }
}

function isLessonAvailable(
  startAt: Date,
  endAt: Date,
) {
  const now = new Date()

  const accessStart =
    new Date(
      startAt.getTime() -
        5 * 60 * 1000,
    )

  return (
    now >= accessStart &&
    now <= endAt
  )
}

function getLessonMessage(
  startAt: Date,
  endAt: Date,
) {
  const now = new Date()

  const accessStart =
    new Date(
      startAt.getTime() -
        5 * 60 * 1000,
    )

  if (now < accessStart) {
    const minutes =
      Math.ceil(
        (
          accessStart.getTime() -
          now.getTime()
        ) / 60000,
      )

    return `A sala estará disponível em aproximadamente ${minutes} minuto${
      minutes === 1
        ? ''
        : 's'
    }.`
  }

  if (now > endAt) {
    return 'Esta aula já foi encerrada.'
  }

  return 'A sala está disponível.'
}

/* =========================================================
   VÍDEO PRINCIPAL
   ========================================================= */

function MainVideo() {
  const tracks = useTracks([
    {
      source: Track.Source.Camera,
      withPlaceholder: true,
    },
  ])

  const participants =
    useParticipants()

  const sortedTracks =
    useMemo(() => {
      return tracks.sort((a, b) => {
        const aIsLocal =
          a.participant.isLocal
        const bIsLocal =
          b.participant.isLocal

        if (
          aIsLocal &&
          !bIsLocal
        ) {
          return 1
        }

        if (
          !aIsLocal &&
          bIsLocal
        ) {
          return -1
        }

        return 0
      })
    }, [tracks])

  if (!participants.length) {
    return (
      <div className="academy-empty-video">
        <div className="academy-empty-video-icon">
          <span />
        </div>

        <strong>
          Aguardando participantes
        </strong>

        <p>
          O vídeo aparecerá quando
          alguém entrar na sala.
        </p>
      </div>
    )
  }

  if (!sortedTracks.length) {
    return (
      <div className="academy-empty-video">
        <div className="academy-empty-video-icon">
          <span />
        </div>

        <strong>
          Câmera desligada
        </strong>

        <p>
          O participante está na sala,
          mas a câmera está desligada.
        </p>
      </div>
    )
  }

  return (
    <div
      className={
        sortedTracks.length > 1
          ? 'academy-video-grid'
          : 'academy-video-single'
      }
    >
      {sortedTracks.map(
        (trackRef) => (
          <div
            className="academy-video-tile"
            key={
              trackRef.participant
                .identity
            }
          >
            <VideoTrack
              trackRef={trackRef}
              className="academy-video-element"
            />

            <div className="academy-video-name">
              {trackRef.participant
                .isLocal
                ? 'Você'
                : trackRef.participant
                    .name ||
                  trackRef.participant
                    .identity}
            </div>
          </div>
        ),
      )}
    </div>
  )
}

/* =========================================================
   PARTICIPANTES
   ========================================================= */

function ParticipantsPanel() {
  const participants =
    useParticipants()

  return (
    <section className="academy-participants">
      <div className="academy-panel-title">
        <strong>
          Participantes
        </strong>

        <span>
          {participants.length}
        </span>
      </div>

      <div className="academy-participants-list">
        {participants.map(
          (participant) => (
            <div
              className="academy-participant"
              key={
                participant.identity
              }
            >
              <div className="academy-participant-avatar">
                {(
                  participant.name ||
                  participant.identity ||
                  'A'
                )
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div className="academy-participant-info">
                <strong>
                  {participant.isLocal
                    ? 'Você'
                    : participant.name ||
                      participant.identity}
                </strong>

                <span>
                  {participant.isLocal
                    ? 'Aluno'
                    : 'Professor / participante'}
                </span>
              </div>

              <div
                className={
                  participant.isSpeaking
                    ? 'academy-speaking'
                    : 'academy-not-speaking'
                }
              >
                <span />
              </div>
            </div>
          ),
        )}
      </div>
    </section>
  )
}

/* =========================================================
   CHAT
   ========================================================= */

function ChatPanel() {
  const room =
    useRoomContext()

  const {
    chatMessages,
    send,
  } = useChat()

  const [message, setMessage] =
    useState('')

  const sendMessage = async () => {
    const text =
      message.trim()

    if (!text) {
      return
    }

    try {
      await send(text)

      setMessage('')
    } catch (error) {
      console.error(
        'Erro ao enviar mensagem:',
        error,
      )
    }
  }

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      event.preventDefault()

      void sendMessage()
    }
  }

  return (
    <section className="academy-chat">
      <div className="academy-panel-title">
        <strong>
          Chat da aula
        </strong>
      </div>

      <div className="academy-chat-messages">
        {chatMessages.length === 0 ? (
          <div className="academy-chat-empty">
            <strong>
              Nenhuma mensagem ainda
            </strong>

            <span>
              Envie uma mensagem para
              iniciar a conversa.
            </span>
          </div>
        ) : (
          chatMessages.map(
            (chatMessage) => {
              const isMine =
                chatMessage.from?.identity ===
                room.localParticipant
                  .identity

              return (
                <div
                  key={
                    chatMessage.timestamp +
                    chatMessage.from
                      ?.identity
                  }
                  className={
                    isMine
                      ? 'academy-chat-message academy-chat-message-own'
                      : 'academy-chat-message'
                  }
                >
                  <div className="academy-chat-author">
                    {isMine
                      ? 'Você'
                      : chatMessage.from
                          ?.name ||
                        chatMessage.from
                          ?.identity ||
                        'Participante'}
                  </div>

                  <div className="academy-chat-bubble">
                    {chatMessage.message}
                  </div>
                </div>
              )
            },
          )
        )}
      </div>

      <div className="academy-chat-input">
        <input
          type="text"
          value={message}
          onChange={(event) =>
            setMessage(
              event.target.value,
            )
          }
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem..."
        />

        <button
          type="button"
          onClick={() =>
            void sendMessage()
          }
          disabled={
            !message.trim()
          }
        >
          Enviar
        </button>
      </div>
    </section>
  )
}

/* =========================================================
   CONTROLES
   ========================================================= */

function ClassroomControls({
  onLeave,
}: {
  onLeave: () => void
}) {
  const { localParticipant } = useLocalParticipant()
  const [backgroundOpen, setBackgroundOpen] = useState(false)
  const [backgroundMode, setBackgroundMode] = useState<'disabled' | 'blur' | 'image'>('disabled')
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null)
  const [backgroundError, setBackgroundError] = useState<string | null>(null)

  const toggleMicrophone = async () => {
    await localParticipant.setMicrophoneEnabled(
      !localParticipant.isMicrophoneEnabled,
    )
  }

  const toggleCamera = async () => {
    await localParticipant.setCameraEnabled(
      !localParticipant.isCameraEnabled,
    )
  }

  const toggleScreenShare = async () => {
    await localParticipant.setScreenShareEnabled(
      !localParticipant.isScreenShareEnabled,
    )
  }

  const applyBackground = async (
    mode: 'disabled' | 'blur' | 'image',
    imagePath?: string,
  ) => {
    setBackgroundError(null)

    const publication = localParticipant.getTrackPublication(
      Track.Source.Camera,
    )
    const track = publication?.track

    if (!track || !(track instanceof LocalVideoTrack)) {
      setBackgroundError('Ative a câmera para aplicar o plano de fundo.')
      return
    }

    try {
      if (mode === 'disabled') {
        await track.stopProcessor()
      } else if (mode === 'blur') {
        const processor = BackgroundProcessor({
          mode: 'background-blur',
          blurRadius: 10,
        })

        await track.setProcessor(processor, true)
      } else if (imagePath) {
        const processor = BackgroundProcessor({
          mode: 'virtual-background',
          imagePath,
        })

        await track.setProcessor(processor, true)
      }

      setBackgroundMode(mode)
    } catch (error) {
      console.error('Erro ao aplicar plano de fundo:', error)
      setBackgroundError(
        'Não foi possível aplicar este plano de fundo neste dispositivo.',
      )
    }
  }

  const handleBackgroundImage = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const imageUrl = URL.createObjectURL(file)
    setBackgroundImage(imageUrl)
    void applyBackground('image', imageUrl)
  }

  const microphoneOn = localParticipant.isMicrophoneEnabled
  const cameraOn = localParticipant.isCameraEnabled
  const screenOn = localParticipant.isScreenShareEnabled

  return (
    <div className="academy-controls">
      <button
        type="button"
        className={
          microphoneOn
            ? 'academy-control-button'
            : 'academy-control-button is-off'
        }
        onClick={() => void toggleMicrophone()}
        title={microphoneOn ? 'Desligar microfone' : 'Ligar microfone'}
      >
        <span>{microphoneOn ? '🎤' : '🔇'}</span>
      </button>

      <button
        type="button"
        className={
          cameraOn
            ? 'academy-control-button'
            : 'academy-control-button is-off'
        }
        onClick={() => void toggleCamera()}
        title={cameraOn ? 'Desligar câmera' : 'Ligar câmera'}
      >
        <span>{cameraOn ? '📹' : '🚫'}</span>
      </button>

      <div className="academy-background-control">
        <button
          type="button"
          className={
            backgroundMode !== 'disabled'
              ? 'academy-control-button is-active'
              : 'academy-control-button'
          }
          onClick={() => setBackgroundOpen((open) => !open)}
          title="Plano de fundo"
          aria-label="Plano de fundo"
        >
          <Image size={20} />
        </button>

        {backgroundOpen && (
          <div className="academy-background-menu">
            <div className="academy-background-menu-header">
              <div>
                <strong>Plano de fundo</strong>
                <span>Escolha como sua câmera será exibida.</span>
              </div>
              <Sparkles size={18} />
            </div>

            <button
              type="button"
              className={
                backgroundMode === 'disabled'
                  ? 'academy-background-option is-selected'
                  : 'academy-background-option'
              }
              onClick={() => void applyBackground('disabled')}
            >
              <span className="academy-background-preview academy-background-original" />
              <span>
                <strong>Original</strong>
                <small>Sem efeito</small>
              </span>
            </button>

            <button
              type="button"
              className={
                backgroundMode === 'blur'
                  ? 'academy-background-option is-selected'
                  : 'academy-background-option'
              }
              onClick={() => void applyBackground('blur')}
            >
              <span className="academy-background-preview academy-background-blur" />
              <span>
                <strong>Desfoque</strong>
                <small>Desfoca o ambiente</small>
              </span>
            </button>

            <label className="academy-background-option academy-background-upload">
              <span className="academy-background-preview academy-background-image">
                {backgroundImage ? (
                  <img src={backgroundImage} alt="" />
                ) : (
                  <Image size={18} />
                )}
              </span>
              <span>
                <strong>Imagem personalizada</strong>
                <small>Escolha uma imagem do computador</small>
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleBackgroundImage}
              />
            </label>

            {backgroundError && (
              <p className="academy-background-error">
                {backgroundError}
              </p>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        className={
          screenOn
            ? 'academy-control-button is-active'
            : 'academy-control-button'
        }
        onClick={() => void toggleScreenShare()}
        title="Compartilhar tela"
      >
        <span>🖥️</span>
      </button>

      <button
        type="button"
        className="academy-leave-button"
        onClick={onLeave}
      >
        Sair da aula
      </button>
    </div>
  )
}

/* =========================================================
   SALA LIVEKIT
   ========================================================= */

function LiveClassroom({
  livekit,
  lesson,
  onLeave,
}: {
  livekit: LiveKitData
  lesson: Lesson
  onLeave: () => void
}) {
  const [connected, setConnected] =
    useState(false)

  return (
    <div className="academy-live-room">
      <LiveKitRoom
        token={livekit.token}
        serverUrl={livekit.url}
        connect={true}
        audio={true}
        video={true}
        onConnected={() =>
          setConnected(true)
        }
        onDisconnected={() =>
          setConnected(false)
        }
        style={{
          width: '100%',
          height: '100%',
        }}
      >
        <RoomAudioRenderer />

        <header className="academy-live-header">
          <div className="academy-live-brand">
            <img
              src={logo}
              alt="AB Academy"
              className="academy-header-logo"
            />

            <div className="academy-live-course">
              <strong>
                Aula de{' '}
                {getLanguageName(
                  lesson.idioma,
                )}
              </strong>

              <span>
                Sala virtual AB Academy
              </span>
            </div>
          </div>

          <div className="academy-live-status">
            <span
              className={
                connected
                  ? 'is-connected'
                  : ''
              }
            />

            {connected
              ? 'Ao vivo'
              : 'Conectando...'}
          </div>
        </header>

        <main className="academy-live-main">
          <section className="academy-video-area">
            <MainVideo />

            <ClassroomControls
              onLeave={onLeave}
            />
          </section>

          <aside className="academy-sidebar">
            <ParticipantsPanel />

            <ChatPanel />
          </aside>
        </main>
      </LiveKitRoom>
    </div>
  )
}

/* =========================================================
   COMPONENTE PRINCIPAL
   ========================================================= */

export default function SalaAula() {
  const [user, setUser] =
    useState<any>(null)

  const [data, setData] =
    useState<LessonData | null>(
      null,
    )

  const [livekit, setLivekit] =
    useState<LiveKitData | null>(
      null,
    )

  const [loading, setLoading] =
    useState(true)

  const [connecting, setConnecting] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [now, setNow] =
    useState(new Date())

  const getLessonIdFromUrl =
    () => {
      const parts =
        window.location.pathname
          .split('/')
          .filter(Boolean)

      return (
        parts[
          parts.length - 1
        ] || null
      )
    }

  /* =========================================================
     SESSÃO
     ========================================================= */

  useEffect(() => {
    let mounted = true

    const loadSession =
      async () => {
        try {
          const {
            data: sessionData,
            error: sessionError,
          } =
            await supabase.auth.getSession()

          if (sessionError) {
            throw sessionError
          }

          if (
            !sessionData.session?.user
          ) {
            window.location.href =
              '/matricula'

            return
          }

          if (mounted) {
            setUser(
              sessionData.session.user,
            )
          }
        } catch (err) {
          console.error(
            'Erro ao verificar sessão:',
            err,
          )

          if (mounted) {
            setError(
              'Não foi possível verificar sua sessão.',
            )

            setLoading(false)
          }
        }
      }

    void loadSession()

    return () => {
      mounted = false
    }
  }, [])

  /* =========================================================
     AULA
     ========================================================= */

  useEffect(() => {
    if (!user) {
      return
    }

    let mounted = true

    const loadLesson =
      async () => {
        try {
          setLoading(true)
          setError(null)

          const lessonId =
            getLessonIdFromUrl()

          if (!lessonId) {
            throw new Error(
              'ID da aula não encontrado.',
            )
          }

          const {
            data: student,
            error: studentError,
          } =
            await supabase
              .from('alunos')
              .select(`
                id,
                user_id,
                nome_completo,
                email
              `)
              .eq(
                'user_id',
                user.id,
              )
              .maybeSingle()

          if (studentError) {
            throw studentError
          }

          if (!student) {
            throw new Error(
              'Aluno não encontrado.',
            )
          }

          const {
            data: lesson,
            error: lessonError,
          } =
            await supabase
              .from('horarios')
              .select(`
                id,
                idioma,
                dia_semana,
                hora_inicio,
                hora_fim,
                disponivel,
                aluno_id
              `)
              .eq(
                'id',
                lessonId,
              )
              .eq(
                'aluno_id',
                student.id,
              )
              .maybeSingle()

          if (lessonError) {
            throw lessonError
          }

          if (!lesson) {
            throw new Error(
              'Aula não encontrada ou você não possui acesso a esta aula.',
            )
          }

          if (!mounted) {
            return
          }

          setData({
            lesson,
            student,
          })
        } catch (err) {
          console.error(
            'Erro ao carregar aula:',
            err,
          )

          if (mounted) {
            setError(
              err instanceof Error
                ? err.message
                : 'Não foi possível carregar a aula.',
            )
          }
        } finally {
          if (mounted) {
            setLoading(false)
          }
        }
      }

    void loadLesson()

    return () => {
      mounted = false
    }
  }, [user])

  /* =========================================================
     RELÓGIO
     ========================================================= */

  useEffect(() => {
    const interval =
      window.setInterval(() => {
        setNow(new Date())
      }, 30000)

    return () =>
      window.clearInterval(
        interval,
      )
  }, [])

  /* =========================================================
     CONECTAR LIVEKIT
     ========================================================= */

  const connectToLiveKit =
    async () => {
      if (!data) {
        return
      }

      try {
        setConnecting(true)
        setError(null)

        const {
          data: response,
          error: functionError,
        } =
          await supabase.functions.invoke(
            'livekit-token',
            {
              body: {
                lessonId:
                  data.lesson.id,
              },
            },
          )

        if (functionError) {
          throw functionError
        }

        if (
          !response?.token ||
          !response?.url
        ) {
          throw new Error(
            response?.error ||
              'Não foi possível obter acesso à sala.',
          )
        }

        setLivekit(response)
      } catch (err) {
        console.error(
          'Erro ao conectar ao LiveKit:',
          err,
        )

        setError(
          err instanceof Error
            ? err.message
            : 'Não foi possível conectar à sala.',
        )
      } finally {
        setConnecting(false)
      }
    }

  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <div className="virtual-classroom-loading">
        <Loader2
          size={32}
          className="virtual-classroom-spinner"
        />

        <span>
          Carregando sala de aula...
        </span>
      </div>
    )
  }

  /* =========================================================
     ERRO
     ========================================================= */

  if (error || !data) {
    return (
      <div className="virtual-classroom-error-page">
        <div className="virtual-classroom-error-card">
          <img
            src={logo}
            alt="AB Academy"
            className="virtual-classroom-logo"
          />

          <h1>
            Sala de aula indisponível
          </h1>

          <p>
            {error ||
              'Não foi possível carregar esta aula.'}
          </p>

          <button
            type="button"
            className="virtual-classroom-back-button"
            onClick={() =>
              window.history.back()
            }
          >
            <ArrowLeft
              size={17}
            />

            Voltar
          </button>
        </div>
      </div>
    )
  }

  const {
    lesson,
    student,
  } = data

  const {
    startAt,
    endAt,
  } =
    getNextLessonOccurrence(
      Number(
        lesson.dia_semana,
      ),
      lesson.hora_inicio,
      lesson.hora_fim,
    )

  const available =
    isLessonAvailable(
      startAt,
      endAt,
    )

  const lessonMessage =
    getLessonMessage(
      startAt,
      endAt,
    )

  /* =========================================================
     SALA CONECTADA
     ========================================================= */

  if (livekit) {
    return (
      <LiveClassroom
        livekit={livekit}
        lesson={lesson}
        onLeave={() => {
          setLivekit(null)
        }}
      />
    )
  }

  /* =========================================================
     PRÉ-SALA
     ========================================================= */

  return (
    <div className="virtual-classroom-page">
      <header className="virtual-classroom-header">
        <div className="virtual-classroom-brand">
          <img
            src={logo}
            alt="AB Academy"
            className="academy-header-logo"
          />
        </div>

        <div className="virtual-classroom-header-info">
          <span>
            Sala de aula virtual
          </span>

          <strong>
            {getLanguageName(
              lesson.idioma,
            )}
          </strong>
        </div>
      </header>

      <main className="virtual-classroom-content">
        <section className="virtual-classroom-title-section">
          <div>
            <span className="virtual-classroom-eyebrow">
              AB ACADEMY
            </span>

            <h1>
              Aula de{' '}
              {getLanguageName(
                lesson.idioma,
              )}
            </h1>

            <p>
              Olá,{' '}
              {student.nome_completo ||
                'Aluno'}
              . Sua sala virtual está pronta.
            </p>
          </div>

          <div
            className={`virtual-classroom-status ${
              available
                ? 'is-available'
                : 'is-locked'
            }`}
          >
            <span />

            {available
              ? 'Sala disponível'
              : 'Sala fechada'}
          </div>
        </section>

        <section className="virtual-classroom-main">
          <div className="virtual-classroom-meet-card">
            <div className="virtual-classroom-meet-placeholder">
              <div className="virtual-classroom-meet-icon">
                <span>
                  ▶
                </span>
              </div>

              <span className="virtual-classroom-meet-label">
                AB ACADEMY LIVE
              </span>

              <h2>
                Sala de videoconferência
              </h2>

              <p>
                Sua aula acontece diretamente
                dentro da plataforma AB Academy,
                com vídeo, áudio e chat.
              </p>

              <button
                type="button"
                className="virtual-classroom-enter-button"
                onClick={() =>
                  void connectToLiveKit()
                }
                disabled={
                  !available ||
                  connecting
                }
              >
                {connecting ? (
                  <>
                    <Loader2
                      size={19}
                      className="virtual-classroom-spinner"
                    />

                    Conectando...
                  </>
                ) : (
                  <>
                    <span>
                      ▶
                    </span>

                    Entrar na aula
                  </>
                )}
              </button>

              <span className="virtual-classroom-access-message">
                {lessonMessage}
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}