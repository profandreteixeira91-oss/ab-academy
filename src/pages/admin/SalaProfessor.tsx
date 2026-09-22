import {
  useEffect,
  useState,
  type KeyboardEvent,
} from 'react'

import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Users,
  Video,
  VideoOff,
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

import { Track } from 'livekit-client'

import logo from '../../assets/logo_abacademy.png'
import { supabase } from '../../lib/supabase'

import '../../styles/sala-aula.css'

/*
 * =========================================================
 * TIPOS
 * =========================================================
 */

type Lesson = {
  id: string
  idioma: 'ingles' | 'alemao'
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  disponivel: boolean
  aluno_id: string | null
}

type LiveKitData = {
  token: string
  url: string
  roomName: string
  identity: string
  name: string
  role: string
}

/*
 * =========================================================
 * AUXILIARES
 * =========================================================
 */

function getLanguageName(
  language: string,
) {
  return language === 'ingles'
    ? 'Inglês'
    : 'Alemão'
}

function getLessonIdFromUrl() {
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

/*
 * =========================================================
 * VÍDEO PRINCIPAL
 * =========================================================
 */

function MainVideo() {
  const tracks = useTracks([
    {
      source: Track.Source.Camera,
      withPlaceholder: true,
    },
  ])

  const participants =
    useParticipants()

  /*
   * Enquanto ninguém estiver conectado,
   * mostramos a tela de espera.
   */

  if (!participants.length) {
    return (
      <div className="academy-empty-video">
        <div className="academy-empty-video-icon">
          <Video size={30} />
        </div>

        <strong>
          Aguardando aluno
        </strong>

        <p>
          O vídeo aparecerá quando
          o aluno entrar na sala.
        </p>
      </div>
    )
  }

  /*
   * O vídeo remoto aparece primeiro.
   * O vídeo do professor aparece depois.
   */

  const orderedTracks =
    [...tracks].sort(
      (a, b) => {
        if (
          a.participant.isLocal &&
          !b.participant.isLocal
        ) {
          return 1
        }

        if (
          !a.participant.isLocal &&
          b.participant.isLocal
        ) {
          return -1
        }

        return 0
      },
    )

  return (
    <div
      className={
        orderedTracks.length > 1
          ? 'academy-video-grid'
          : 'academy-video-single'
      }
    >
      {orderedTracks.map(
        (trackRef) => {
          // useTracks(..., { withPlaceholder: true }) também pode
          // retornar TrackReferencePlaceholder. O VideoTrack aceita
          // apenas TrackReference com publication definida.
          if (!trackRef.publication) {
            return null
          }

          return (
          <div
            key={
              trackRef.participant
                .identity
            }
            className="academy-video-tile"
          >
            <VideoTrack
              trackRef={trackRef}
              className="academy-video-element"
            />

            <div className="academy-video-name">
              {trackRef.participant
                .isLocal
                ? 'Você — Professor'
                : trackRef.participant
                    .name ||
                  'Aluno'}
            </div>
          </div>
        ),
      )}
    </div>
  )
}

/*
 * =========================================================
 * PARTICIPANTES
 * =========================================================
 */

function ParticipantsPanel() {
  const participants =
    useParticipants()

  return (
    <section className="academy-participants">

      <div className="academy-panel-title">
        <div>
          <Users size={17} />

          <strong>
            Participantes
          </strong>
        </div>

        <span>
          {participants.length}
        </span>
      </div>

      <div className="academy-participants-list">

        {participants.length === 0 ? (
          <div className="academy-panel-empty">
            Nenhum participante conectado.
          </div>
        ) : (
          participants.map(
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
                        'Aluno'}
                  </strong>

                  <span>
                    {participant.isLocal
                      ? 'Professor'
                      : 'Aluno'}
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
          )
        )}

      </div>

    </section>
  )
}

/*
 * =========================================================
 * CHAT
 * =========================================================
 */

function ChatPanel() {
  const room =
    useRoomContext()

  const {
    chatMessages,
    send,
  } = useChat()

  const [message, setMessage] =
    useState('')

  async function sendMessage() {
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

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ) {
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
        <div>
          <MessageSquare size={17} />

          <strong>
            Chat da aula
          </strong>
        </div>
      </div>

      <div className="academy-chat-messages">

        {chatMessages.length === 0 ? (
          <div className="academy-chat-empty">

            <MessageSquare
              size={25}
            />

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
                chatMessage.from
                  ?.identity ===
                room.localParticipant
                  .identity

              return (
                <div
                  key={`${chatMessage.timestamp}-${chatMessage.from?.identity}`}
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
                    {
                      chatMessage.message
                    }
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
          onKeyDown={
            handleKeyDown
          }
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

/*
 * =========================================================
 * CONTROLES DO PROFESSOR
 * =========================================================
 */

function ClassroomControls({
  onLeave,
}: {
  onLeave: () => void
}) {
  const {
    localParticipant,
  } =
    useLocalParticipant()

  async function toggleMicrophone() {
    try {
      await localParticipant.setMicrophoneEnabled(
        !localParticipant.isMicrophoneEnabled,
      )
    } catch (error) {
      console.error(
        'Erro ao alterar microfone:',
        error,
      )
    }
  }

  async function toggleCamera() {
    try {
      await localParticipant.setCameraEnabled(
        !localParticipant.isCameraEnabled,
      )
    } catch (error) {
      console.error(
        'Erro ao alterar câmera:',
        error,
      )
    }
  }

  async function toggleScreenShare() {
    try {
      await localParticipant.setScreenShareEnabled(
        !localParticipant.isScreenShareEnabled,
      )
    } catch (error) {
      console.error(
        'Erro ao compartilhar tela:',
        error,
      )
    }
  }

  return (
    <div className="academy-controls">

      <button
        type="button"
        className={
          localParticipant.isMicrophoneEnabled
            ? 'academy-control-button'
            : 'academy-control-button is-off'
        }
        onClick={() =>
          void toggleMicrophone()
        }
        title={
          localParticipant.isMicrophoneEnabled
            ? 'Desativar microfone'
            : 'Ativar microfone'
        }
      >
        {localParticipant.isMicrophoneEnabled ? (
          <Mic size={20} />
        ) : (
          <MicOff size={20} />
        )}
      </button>

      <button
        type="button"
        className={
          localParticipant.isCameraEnabled
            ? 'academy-control-button'
            : 'academy-control-button is-off'
        }
        onClick={() =>
          void toggleCamera()
        }
        title={
          localParticipant.isCameraEnabled
            ? 'Desativar câmera'
            : 'Ativar câmera'
        }
      >
        {localParticipant.isCameraEnabled ? (
          <Video size={20} />
        ) : (
          <VideoOff size={20} />
        )}
      </button>

      <button
        type="button"
        className={
          localParticipant.isScreenShareEnabled
            ? 'academy-control-button is-active'
            : 'academy-control-button'
        }
        onClick={() =>
          void toggleScreenShare()
        }
        title="Compartilhar tela"
      >
        <MonitorUp size={20} />
      </button>

      <button
        type="button"
        className="academy-leave-button"
        onClick={onLeave}
        title="Sair da aula"
      >
        <PhoneOff size={18} />

        <span>
          Sair da aula
        </span>
      </button>

    </div>
  )
}

/*
 * =========================================================
 * SALA LIVEKIT DO PROFESSOR
 * =========================================================
 */

function TeacherLiveRoom({
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

        {/* =============================================
            HEADER
            ============================================= */}

        <header className="academy-live-header">

          <div className="academy-live-brand">

            <img
              src={logo}
              alt="AB Academy"
            />

            <div className="academy-live-course">

              <strong>
                Aula de{' '}
                {getLanguageName(
                  lesson.idioma,
                )}
              </strong>

              <span>
                Sala do professor
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

        {/* =============================================
            CONTEÚDO
            ============================================= */}

        <main className="academy-live-main">

          {/* ===========================================
              VÍDEO
              =========================================== */}

          <section className="academy-video-area">

            <MainVideo />

            <ClassroomControls
              onLeave={onLeave}
            />

          </section>

          {/* ===========================================
              SIDEBAR
              =========================================== */}

          <aside className="academy-sidebar">

            <ParticipantsPanel />

            <ChatPanel />

          </aside>

        </main>

      </LiveKitRoom>

    </div>
  )
}

/*
 * =========================================================
 * COMPONENTE PRINCIPAL
 * =========================================================
 */

export default function SalaProfessor() {

  const [lesson, setLesson] =
    useState<Lesson | null>(null)

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

  /*
   * =======================================================
   * CARREGAR AULA
   * =======================================================
   */

  useEffect(() => {
    loadLesson()
  }, [])

  async function loadLesson() {
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
        data: lessonData,
        error: lessonError,
      } = await supabase
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
        .maybeSingle()

      if (lessonError) {
        throw lessonError
      }

      if (!lessonData) {
        throw new Error(
          'Aula não encontrada.',
        )
      }

      setLesson(
        lessonData as Lesson,
      )
    } catch (err) {
      console.error(
        'Erro ao carregar aula:',
        err,
      )

      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar a aula.',
      )
    } finally {
      setLoading(false)
    }
  }

  /*
   * =======================================================
   * CONECTAR AO LIVEKIT
   * =======================================================
   */

 async function connectToLiveKit() {
  if (!lesson) {
    return
  }

  try {
    setConnecting(true)
    setError(null)

    console.log('=== LIVEKIT PROFESSOR ===')
    console.log('lesson.id:', lesson.id)

    const {
      data: response,
      error: functionError,
    } = await supabase.functions.invoke(
      'livekit-token',
      {
        body: {
          lessonId: lesson.id,
        },
      },
    )

    console.log(
      'LiveKit response:',
      response,
    )

    console.log(
      'LiveKit functionError:',
      functionError,
    )

    if (functionError) {
      let detailedError =
        functionError.message ||
        'Erro ao chamar a Edge Function.'

      try {
        const context =
          (
            functionError as {
              context?: Response
            }
          ).context

        if (context) {
          const responseText =
            await context.text()

          console.error(
            'LiveKit HTTP status:',
            context.status,
          )

          console.error(
            'LiveKit response body:',
            responseText,
          )

          try {
            const parsed =
              JSON.parse(responseText)

            if (parsed?.error) {
              detailedError =
                parsed.error
            }
          } catch {
            if (responseText) {
              detailedError =
                responseText
            }
          }
        }
      } catch (debugError) {
        console.error(
          'Erro ao obter detalhes da Edge Function:',
          debugError,
        )
      }

      throw new Error(
        detailedError,
      )
    }

    if (
      !response?.token ||
      !response?.url
    ) {
      throw new Error(
        response?.error ||
          'A Edge Function não retornou um token válido.',
      )
    }

    if (
      response.role &&
      response.role !== 'teacher'
    ) {
      throw new Error(
        `Acesso recusado. Role recebido: ${response.role}`,
      )
    }

    console.log(
      'LiveKit conectado com sucesso:',
      {
        roomName:
          response.roomName,
        identity:
          response.identity,
        role:
          response.role,
      },
    )

    setLivekit(response)
  } catch (err) {
    console.error(
      'ERRO FINAL LIVEKIT PROFESSOR:',
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

  /*
   * =======================================================
   * SAIR DA SALA
   * =======================================================
   */

  function leaveRoom() {
    setLivekit(null)
  }

  /*
   * =======================================================
   * LOADING
   * =======================================================
   */

  if (loading) {
    return (
      <div className="virtual-classroom-loading">

        <Loader2
          size={32}
          className="virtual-classroom-spinner"
        />

        <span>
          Carregando aula...
        </span>

      </div>
    )
  }

  /*
   * =======================================================
   * ERRO
   * =======================================================
   */

  if (error || !lesson) {
    return (
      <div className="virtual-classroom-error-page">

        <div className="virtual-classroom-error-card">

          <img
            src={logo}
            alt="AB Academy"
            className="virtual-classroom-logo"
          />

          <h1>
            Aula indisponível
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
            <ArrowLeft size={17} />

            Voltar
          </button>

        </div>

      </div>
    )
  }

  /*
   * =======================================================
   * SALA LIVEKIT
   * =======================================================
   */

  if (livekit) {
    return (
      <TeacherLiveRoom
        livekit={livekit}
        lesson={lesson}
        onLeave={leaveRoom}
      />
    )
  }

  /*
   * =======================================================
   * TELA INICIAL
   * =======================================================
   */

  return (
    <div className="virtual-classroom-page">

      <header className="virtual-classroom-header">

        <div className="virtual-classroom-brand">

          <img
            src={logo}
            alt="AB Academy"
          />

        </div>

        <div className="virtual-classroom-header-info">

          <span>
            Sala do professor
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
              Sala virtual do professor.
            </p>

          </div>

          <div className="virtual-classroom-status is-available">

            <span />

            Sala disponível

          </div>

        </section>

        <section className="virtual-classroom-main">

          <div className="virtual-classroom-meet-card">

            <div className="virtual-classroom-meet-placeholder">

              <div className="virtual-classroom-meet-icon">
                <Video size={32} />
              </div>

              <span className="virtual-classroom-meet-label">
                AB ACADEMY LIVE
              </span>

              <h2>
                Sala da aula
              </h2>

              <p>
                Entre para iniciar a aula
                com vídeo, áudio,
                participantes e chat.
              </p>

              <button
                type="button"
                className="virtual-classroom-enter-button"
                onClick={() =>
                  void connectToLiveKit()
                }
                disabled={connecting}
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
                    <Video size={19} />

                    Entrar na aula
                  </>
                )}
              </button>

            </div>

          </div>

        </section>

      </main>

    </div>
  )
}