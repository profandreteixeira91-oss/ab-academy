import { supabase } from './supabase'

export type LiveKitAccessData = {
  token: string
  url: string
  roomName: string
  identity: string
  name: string
  role: 'student' | 'teacher'
}

type LiveKitFunctionResponse = {
  token?: unknown
  url?: unknown
  roomName?: unknown
  identity?: unknown
  name?: unknown
  role?: unknown
  error?: unknown
}

function getFunctionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  return 'Não foi possível preparar sua entrada na sala de aula.'
}

async function readFunctionError(error: unknown): Promise<string> {
  const fallback = getFunctionErrorMessage(error)

  if (!error || typeof error !== 'object' || !('context' in error)) {
    return fallback
  }

  const context = (error as { context?: unknown }).context

  if (!(context instanceof Response)) {
    return fallback
  }

  try {
    const text = await context.clone().text()
    if (!text.trim()) {
      return fallback
    }

    try {
      const parsed = JSON.parse(text) as { error?: unknown }
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        return parsed.error
      }
    } catch {
      // A Edge Function pode devolver texto puro; usamos o conteúdo como fallback.
    }

    return text.trim()
  } catch (readError) {
    console.error('[Classroom] Failed to read token endpoint error', readError)
    return fallback
  }
}

function isLiveKitAccessData(
  value: unknown,
): value is LiveKitAccessData {
  if (!value || typeof value !== 'object') {
    return false
  }

  const data = value as LiveKitFunctionResponse

  return (
    typeof data.token === 'string' &&
    data.token.trim().length > 0 &&
    typeof data.url === 'string' &&
    data.url.trim().length > 0 &&
    typeof data.roomName === 'string' &&
    data.roomName.trim().length > 0 &&
    typeof data.identity === 'string' &&
    data.identity.trim().length > 0 &&
    typeof data.name === 'string' &&
    data.name.trim().length > 0 &&
    (data.role === 'student' || data.role === 'teacher')
  )
}

function assertValidServerUrl(url: string) {
  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    throw new Error('A configuração do servidor LiveKit é inválida.')
  }

  if (parsed.protocol !== 'wss:' && parsed.protocol !== 'ws:') {
    throw new Error('A URL do servidor LiveKit é inválida.')
  }
}

export async function requestLiveKitAccess(
  lessonId: string,
  expectedRole: 'student' | 'teacher',
): Promise<LiveKitAccessData> {
  const normalizedLessonId = lessonId.trim()

  if (!normalizedLessonId) {
    throw new Error('ID da aula não informado.')
  }

  console.info('[Classroom] Requesting LiveKit access', {
    lessonId: normalizedLessonId,
    expectedRole,
  })

  const result = await Promise.race([
    supabase.functions.invoke('livekit-token', {
      body: {
        lessonId: normalizedLessonId,
      },
    }),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => {
        reject(
          new Error(
            'A preparação da sala demorou mais que o esperado. Verifique sua conexão e tente novamente.',
          ),
        )
      }, 20_000)
    }),
  ])

  if (result.error) {
    const message = await readFunctionError(result.error)
    console.error('[Classroom] LiveKit token error', result.error)
    throw new Error(message)
  }

  if (!isLiveKitAccessData(result.data)) {
    const serverMessage =
      result.data &&
      typeof result.data === 'object' &&
      typeof (result.data as LiveKitFunctionResponse).error === 'string'
        ? (result.data as LiveKitFunctionResponse).error
        : null

    throw new Error(
      serverMessage ||
        'A resposta do servidor não contém dados válidos para entrar na sala.',
    )
  }

  assertValidServerUrl(result.data.url)

  if (result.data.role !== expectedRole) {
    console.error('[Classroom] Unexpected LiveKit role', {
      expectedRole,
      receivedRole: result.data.role,
    })

    throw new Error(
      'O servidor retornou uma permissão incompatível com esta sala.',
    )
  }

  console.info('[Classroom] LiveKit access prepared', {
    roomName: result.data.roomName,
    identity: result.data.identity,
    role: result.data.role,
  })

  return result.data
}
